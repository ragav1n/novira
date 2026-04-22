import { NextRequest, NextResponse } from 'next/server'
import Anthropic from '@anthropic-ai/sdk'

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const CATEGORIES = ['food', 'groceries', 'transport', 'fashion', 'beauty', 'healthcare', 'rent', 'bills', 'shopping', 'entertainment', 'education', 'others']

type SupportedMediaType = 'image/jpeg' | 'image/png' | 'image/gif' | 'image/webp'
const SUPPORTED_TYPES: SupportedMediaType[] = ['image/jpeg', 'image/png', 'image/gif', 'image/webp']

export async function POST(req: NextRequest) {
  const { imageBase64, mimeType } = await req.json()

  if (!imageBase64 || !mimeType) {
    return NextResponse.json({ error: 'Missing image data' }, { status: 400 })
  }

  const mediaType: SupportedMediaType = SUPPORTED_TYPES.includes(mimeType) ? mimeType : 'image/jpeg'
  const sizeKB = Math.round((imageBase64.length * 3) / 4 / 1024)
  console.log(`[scan-receipt] mimeType=${mimeType} mediaType=${mediaType} size≈${sizeKB}KB`)

  const message = await client.messages.create({
    model: 'claude-haiku-4-5-20251001',
    max_tokens: 256,
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
  "description": <short summary of items purchased (e.g. "Milk, eggs, bread" or "Coffee & sandwich"), max 40 chars. If too many items, summarise (e.g. "Groceries x7"). Fall back to merchant name if items are not legible>,
  "date": <date in YYYY-MM-DD format, or null if not found>,
  "time": <time in HH:MM 24h format, or null if not found>,
  "currency": <ISO 4217 currency code e.g. EUR, USD, INR, GBP — infer from symbol if needed, or null>,
  "place_name": <store or merchant name, or null>,
  "place_address": <full store address if visible, or null>,
  "category": <one of: ${CATEGORIES.join(', ')}>
}`,
          },
        ],
      },
    ],
  })

  const text = message.content[0].type === 'text' ? message.content[0].text : ''
  console.log(`[scan-receipt] response: ${text}`)

  const cleaned = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '').trim()
  try {
    const data = JSON.parse(cleaned)
    return NextResponse.json(data)
  } catch {
    return NextResponse.json({ error: 'Could not parse receipt' }, { status: 422 })
  }
}
