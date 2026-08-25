import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
// Schema written as JSON Schema rather than zod: the SDK's `zodOutputFormat`
// converts through zod/v4, and this project is still on zod 3's v3 surface.
import { jsonSchemaOutputFormat } from '@anthropic-ai/sdk/helpers/json-schema'
import { createClient } from '@/utils/supabase/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })


type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const SUPPORTED_TYPES: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB raw

const RATE_CFG = { max: 30, windowMs: 24 * 60 * 60 * 1000 }

const nullableString = (description: string) =>
  ({ anyOf: [{ type: 'string' }, { type: 'null' }], description }) as const

// The response shape is enforced by the API against this schema, so the system
// prompt below carries only the reading rules — not the field list or a "reply
// with JSON only" instruction.
const RECEIPT_SCHEMA = {
  type: 'object',
  properties: {
    amount: {
      anyOf: [{ type: 'number' }, { type: 'null' }],
      description: 'Final sum charged, as a number with no currency symbol. Null when no total is legible.',
    },
    description: {
      type: 'string',
      description: 'Short summary of what was bought, in English, max 40 characters.',
    },
    date: nullableString('Purchase date as YYYY-MM-DD, or null when not printed on the receipt.'),
    time: nullableString('Purchase time as HH:MM on a 24-hour clock, or null when not printed.'),
    currency: nullableString('ISO 4217 currency code, or null when it cannot be determined.'),
    is_online: {
      type: 'boolean',
      description: 'True for an online order, false for an in-person purchase.',
    },
    place_name: nullableString('Store or merchant name. Null when is_online is true.'),
    place_address: nullableString('Full street address if visible. Null when is_online is true.'),
    category: {
      type: 'string',
      enum: [
        'food', 'groceries', 'transport', 'fashion', 'beauty', 'healthcare',
        'rent', 'bills', 'shopping', 'entertainment', 'education', 'others',
      ],
      description: 'The single best-matching category, chosen by the rules in the system prompt.',
    },
  },
  required: [
    'amount', 'description', 'date', 'time', 'currency',
    'is_online', 'place_name', 'place_address', 'category',
  ],
  additionalProperties: false,
} as const

// `transform: false` sends the schema above verbatim. The SDK's default
// transform keeps only an allowlist of keywords and folds the rest into the
// description — `enum` is not on that list, so the category list would reach
// the model as a prose hint instead of a constraint the API enforces.
const RECEIPT_FORMAT = jsonSchemaOutputFormat(RECEIPT_SCHEMA, { transform: false })
type Receipt = ReturnType<typeof RECEIPT_FORMAT.parse>

// The extraction instructions live in the system block; the user turn carries the
// image and nothing else. Today's date is interpolated in because the model has
// no clock: with nothing to anchor against it dates a hard-to-read receipt from
// its training prior, which is how a purchase made today lands in 2024.
// (No cache_control — Haiku 4.5 needs a 4096-token prefix before caching
// engages, this is well under it, and a per-day prefix would not hit anyway.)
const buildSystemPrompt = (today: string) => `You read a photographed receipt and report its details.

Today's date is ${today}.

Field rules:
- "amount" is the final sum actually charged — after tax, tip, service charge, and discounts. It is not the subtotal, not the cash tendered, and not the change given. If the receipt shows several payment methods, use the combined total. If the image isn't a receipt, or no total is legible, return null and leave the other fields as your best effort.
- "description" names the actual items: "Milk, eggs, bread", "Coffee & sandwich". Translate foreign item names to English ("Brot"→"Bread", "Käse"→"Cheese"), but keep brand names, proper nouns, and untranslatable words as they are. With too many items to list, pick the 2–3 most prominent or expensive ("Steak, wine, cheese"). Never write placeholder text like "Groceries x7". If no item line is legible, fall back to the merchant name.
- "date": read the year off the receipt — never assume one. A receipt is normally photographed within days of the purchase, so a reading that lands well before ${today} deserves a second look, and one dated after ${today} is impossible. A two-digit year is in the 2000s ("25" → 2025). When the day/month order is ambiguous ("03/04/2026"), settle it from the merchant's country, address, or language — most of the world prints DD/MM, the US prints MM/DD. Return null when no date is printed or the year is not legible: a null is filled in with today's date, whereas a guessed year is silently wrong.
- "currency": read the printed symbol together with the address, language, and tax labels. "$" alone is ambiguous across USD, CAD, AUD, SGD, NZD, and MXN — use the country to decide, and return null rather than guessing.
- "is_online" is true when the receipt shows a website, an order number, or a shipping address and no physical storefront.

Category — pick the single best match. On a mixed basket, go by where most of the money went:
- food: restaurants, cafes, takeaway, fast food, coffee shops, delivery (Zomato, Swiggy, UberEats)
- groceries: supermarkets, grocery stores, fresh produce, dairy, household consumables (BigBasket, Blinkit, Whole Foods, Tesco)
- transport: fuel, petrol, taxi, ride-hail (Uber, Ola), parking, bus/train tickets, tolls
- fashion: clothing, shoes, accessories, apparel stores (Zara, H&M, Myntra, Nike)
- beauty: skincare, haircare, cosmetics, salon, spa, pharmacy beauty products (Nykaa, Sephora, MAC)
- healthcare: doctor, hospital, pharmacy/chemist, medicine, dental, optician, gym/fitness
- rent: rent payment, lease, property maintenance
- bills: electricity, water, gas, internet, phone recharge, insurance, utility providers
- shopping: general retail, electronics, home goods, online marketplaces (Amazon, Flipkart) — use this when no more specific category fits
- entertainment: movies, concerts, streaming (Netflix, Spotify), games, sports events, amusement
- education: school fees, tuition, courses, books, stationery, online learning (Udemy, Coursera)
- others: anything that does not clearly fit the above`

/**
 * A shape-only regex accepts "2103-05-40" and dates years in the future, which
 * then land in the expense form as a real transaction date. Check the calendar
 * and the clock too — a misread year is the most common OCR failure here.
 */
function readReceiptDate(value: string | null): string | null {
  if (value === null || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
  const [y, m, d] = value.split('-').map(Number)
  const parsed = new Date(Date.UTC(y, m - 1, d))
  // Rejects overflow like month 13 or 31 February, which Date silently rolls over.
  if (parsed.getUTCFullYear() !== y || parsed.getUTCMonth() !== m - 1 || parsed.getUTCDate() !== d) return null
  if (y < 2000) return null
  // One day of slack covers a receipt written across a timezone boundary.
  const tomorrow = Date.now() + 24 * 60 * 60 * 1000
  if (parsed.getTime() > tomorrow) return null
  return value
}

/**
 * The client sends its own local date: this server runs in UTC, so an evening
 * purchase in the Americas would otherwise be told "today" is already tomorrow.
 * A clock more than a day out is ignored rather than fed to the model.
 */
function resolveToday(value: unknown): string {
  const serverToday = new Date().toISOString().slice(0, 10)
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return serverToday
  const skew = Math.abs(Date.parse(`${value}T00:00:00Z`) - Date.parse(`${serverToday}T00:00:00Z`))
  return skew <= 24 * 60 * 60 * 1000 ? value : serverToday
}

function readReceiptTime(value: string | null): string | null {
  if (value === null || !/^\d{2}:\d{2}$/.test(value)) return null
  const [h, min] = value.split(':').map(Number)
  return h <= 23 && min <= 59 ? value : null
}

export async function POST(req: NextRequest) {
  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json({ error: 'Receipt scanning is not configured (missing ANTHROPIC_API_KEY).' }, { status: 503 })
  }

  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const limit = checkRateLimit('scan-receipt', user.id, RATE_CFG)
  if (!limit.allowed) return rateLimitResponse(limit, RATE_CFG, `Daily scan limit reached (${RATE_CFG.max}/day).`)

  let parsedBody: { imageBase64?: unknown; mimeType?: unknown; today?: unknown }
  try {
    parsedBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { imageBase64, mimeType, today } = parsedBody

  if (typeof imageBase64 !== 'string' || typeof mimeType !== 'string') {
    return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
  }

  if (!SUPPORTED_TYPES.includes(mimeType as SupportedMediaType)) {
    return NextResponse.json(
      { error: `Unsupported image type. Use one of: ${SUPPORTED_TYPES.join(', ')}` },
      { status: 400 }
    )
  }
  const mediaType: SupportedMediaType = mimeType as SupportedMediaType

  const approxBytes = Math.floor((imageBase64.length * 3) / 4)
  if (approxBytes > MAX_IMAGE_BYTES) {
    return NextResponse.json(
      { error: `Image too large (max ${MAX_IMAGE_BYTES / 1024 / 1024}MB)` },
      { status: 413 }
    )
  }

  let receipt: Receipt | null
  try {
    const message = await client.messages.parse({
      model: 'claude-haiku-4-5-20251001',
      max_tokens: 512,
      system: buildSystemPrompt(resolveToday(today)),
      output_config: { format: RECEIPT_FORMAT },
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType, data: imageBase64 },
            },
            { type: 'text', text: 'Extract this receipt.' },
          ],
        },
      ],
    })
    receipt = message.parsed_output
  } catch (err) {
    // A schema-shaped response can still fail to parse — a `max_tokens` cutoff
    // truncates the JSON mid-object. Transport and rate-limit failures are a
    // different problem and keep their own status.
    if (err instanceof Anthropic.APIError) throw err
    console.error('[scan-receipt] structured output parse failed', { err })
    return NextResponse.json({ error: 'Could not parse receipt' }, { status: 422 })
  }

  if (!receipt) {
    return NextResponse.json({ error: 'Receipt response missing fields' }, { status: 422 })
  }

  if (receipt.amount === null || receipt.amount < 0) {
    return NextResponse.json({ error: 'Receipt amount could not be read' }, { status: 422 })
  }

  return NextResponse.json({
    amount: receipt.amount,
    description: receipt.description.slice(0, 80),
    date: readReceiptDate(receipt.date),
    time: readReceiptTime(receipt.time),
    currency: /^[A-Z]{3}$/.test(receipt.currency ?? '') ? receipt.currency : null,
    is_online: receipt.is_online,
    place_name: receipt.place_name,
    place_address: receipt.place_address,
    category: receipt.category,
  })
}
