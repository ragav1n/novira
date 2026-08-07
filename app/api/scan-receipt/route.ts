import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'
import { createClient } from '@/utils/supabase/server'
import { checkRateLimit, rateLimitResponse } from '@/lib/server/rate-limit'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })


type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const SUPPORTED_TYPES: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']
const MAX_IMAGE_BYTES = 5 * 1024 * 1024 // 5MB raw

const RATE_CFG = { max: 30, windowMs: 24 * 60 * 60 * 1000 }

// Static extraction instructions live in the system block; the user turn carries
// the image and nothing else. (No cache_control — Haiku 4.5 needs a 4096-token
// prefix before caching engages, and this is well under it.)
const SYSTEM_PROMPT = `You read a photographed receipt and return its details as JSON. Respond with the JSON object only — no markdown fences, no prose around it.

{
  "amount": <number, no currency symbol>,
  "description": <short summary of what was bought, in English, max 40 chars>,
  "date": <"YYYY-MM-DD", or null if not printed>,
  "time": <"HH:MM" 24-hour, or null if not printed>,
  "currency": <ISO 4217 code, or null>,
  "is_online": <true for an online order, false for an in-person purchase>,
  "place_name": <store or merchant name — null when is_online is true>,
  "place_address": <full street address if visible — null when is_online is true>,
  "category": <exactly one value from the category list below>
}

Field rules:
- "amount" is the final sum actually charged — after tax, tip, service charge, and discounts. It is not the subtotal, not the cash tendered, and not the change given. If the receipt shows several payment methods, use the combined total. If the image isn't a receipt, or no total is legible, return null and leave the other fields as your best effort.
- "description" names the actual items: "Milk, eggs, bread", "Coffee & sandwich". Translate foreign item names to English ("Brot"→"Bread", "Käse"→"Cheese"), but keep brand names, proper nouns, and untranslatable words as they are. With too many items to list, pick the 2–3 most prominent or expensive ("Steak, wine, cheese"). Never write placeholder text like "Groceries x7". If no item line is legible, fall back to the merchant name.
- "date": when the day/month order is ambiguous ("03/04/2026"), settle it from the merchant's country, address, or language — most of the world prints DD/MM, the US prints MM/DD. A receipt is never dated in the future; if your reading lands there, you misread it.
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
function readReceiptDate(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null
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

function readReceiptTime(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{2}:\d{2}$/.test(value)) return null
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

  let parsedBody: { imageBase64?: unknown; mimeType?: unknown }
  try {
    parsedBody = await req.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }
  const { imageBase64, mimeType } = parsedBody

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

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    system: SYSTEM_PROMPT,
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

  const firstBlock = message.content[0]
  const text = firstBlock?.type === 'text' ? firstBlock.text : ''
  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch (err) {
    console.error('[scan-receipt] JSON parse failed', { err, raw: text })
    return NextResponse.json({ error: 'Could not parse receipt' }, { status: 422 })
  }

  if (!parsed || typeof parsed !== 'object') {
    return NextResponse.json({ error: 'Receipt response missing fields' }, { status: 422 })
  }

  const r = parsed as Record<string, unknown>
  const amount = typeof r.amount === 'number' && Number.isFinite(r.amount) && r.amount >= 0 ? r.amount : null
  if (amount === null) {
    return NextResponse.json({ error: 'Receipt amount could not be read' }, { status: 422 })
  }

  const VALID_CATEGORIES = new Set([
    'food', 'groceries', 'transport', 'fashion', 'beauty', 'healthcare',
    'rent', 'bills', 'shopping', 'entertainment', 'education', 'others',
  ])
  const category = typeof r.category === 'string' && VALID_CATEGORIES.has(r.category) ? r.category : 'others'
  const description = typeof r.description === 'string' ? r.description.slice(0, 80) : ''
  const date = readReceiptDate(r.date)
  const time = readReceiptTime(r.time)
  const currency = typeof r.currency === 'string' && /^[A-Z]{3}$/.test(r.currency) ? r.currency : null
  const is_online = typeof r.is_online === 'boolean' ? r.is_online : false
  const place_name = typeof r.place_name === 'string' ? r.place_name : null
  const place_address = typeof r.place_address === 'string' ? r.place_address : null

  return NextResponse.json({
    amount,
    description,
    date,
    time,
    currency,
    is_online,
    place_name,
    place_address,
    category,
  })
}
