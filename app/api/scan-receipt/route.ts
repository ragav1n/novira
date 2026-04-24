import 'server-only'
import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })


type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const SUPPORTED_TYPES: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(req: NextRequest) {
  const { imageBase64, mimeType } = await req.json()

  if (!imageBase64 || !mimeType) {
    return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
  }

  const mediaType: SupportedMediaType = SUPPORTED_TYPES.includes(mimeType) ? mimeType : 'image/jpeg'
  if (process.env.NODE_ENV === 'development') {
    const sizeKB = Math.round((imageBase64.length * 3) / 4 / 1024)
    console.log(`[scan-receipt] mimeType=${mimeType} mediaType=${mediaType} size≈${sizeKB}KB`)
  }

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 512,
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'image',
            source: { type: 'base64', media_type: mediaType, data: imageBase64 },
          },
          {
            type: 'text',
            text: `Extract the following from this receipt and respond with ONLY valid JSON, no markdown:
{
  "amount": <total amount as a number, no currency symbol>,
  "description": <short summary of items purchased IN ENGLISH, max 40 chars (e.g. "Milk, eggs, bread" or "Coffee & sandwich"). Translate foreign-language item names to English (e.g. "Brot"→"Bread", "Käse"→"Cheese"). Keep brand names, proper nouns, and untranslatable foreign words as-is. If there are too many items to list, pick the 2–3 most prominent/expensive ones (e.g. "Steak, wine, cheese"). Never output placeholder text like "Groceries x7" — always describe actual items. Fall back to merchant name if items are not legible>,
  "date": <date in YYYY-MM-DD format, or null if not found>,
  "time": <time in HH:MM 24h format, or null if not found>,
  "currency": <ISO 4217 currency code e.g. EUR, USD, INR, GBP — infer from symbol if needed, or null>,
  "is_online": <true if this was an online/e-commerce purchase (website URL, order number, "shipped to", no physical store address), false if it was at a physical location>,
  "place_name": <physical store or merchant name — null if is_online is true>,
  "place_address": <full physical store address if visible — null if is_online is true>,
  "category": <pick exactly one from the list below based on what was purchased>
}

Category definitions — pick the best match:
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
- others: anything that does not clearly fit the above categories`,
          },
        ],
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  if (process.env.NODE_ENV === 'development') {
    console.log(`[scan-receipt] response: ${text}`)
  }

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    const data = JSON.parse(cleaned)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Could not parse receipt' }, { status: 422 })
  }
}
