import OpenAI from 'openai'

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic',
  he: 'Hebrew',
  ru: 'Russian',
}

const TRANSLATE_PROMPT = `Translate from {from} to {to}.
Context: {context}
Rules: Keep numbers, measurements, proper nouns unchanged. Natural {to} phrasing.
Return ONLY the translation.

Text: {text}`

const DETECT_AND_TRANSLATE_PROMPT = `Detect language and translate to {to}.
Context: {context}
Rules: Keep numbers, measurements, proper nouns unchanged. Natural {to} phrasing.
Return ONLY the translation.
Respond as JSON: {"from": "xx", "text": "translation"}

Text: {text}`

export async function translateWithOpenAI(params: {
  apiKey: string
  model: string
  text: string
  to: string
  from?: string
  context?: string
}): Promise<{ text: string; from: string }> {
  const openai = new OpenAI({ apiKey: params.apiKey })

  if (params.from) {
    if (params.from === params.to) {
      return { text: params.text, from: params.from }
    }

    const prompt = TRANSLATE_PROMPT
      .replace('{from}', LANGUAGE_NAMES[params.from] ?? params.from)
      .replace(/{to}/g, LANGUAGE_NAMES[params.to] ?? params.to)
      .replace('{context}', params.context ?? 'general content')
      .replace('{text}', params.text)

    const response = await openai.chat.completions.create({
      model: params.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: params.text.length * 3,
    })

    return {
      text: response.choices[0].message.content?.trim() ?? params.text,
      from: params.from,
    }
  }

  const prompt = DETECT_AND_TRANSLATE_PROMPT
    .replace(/{to}/g, LANGUAGE_NAMES[params.to] ?? params.to)
    .replace('{context}', params.context ?? 'general content')
    .replace('{text}', params.text)

  const response = await openai.chat.completions.create({
    model: params.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: params.text.length * 3 + 50,
    response_format: { type: 'json_object' },
  })

  try {
    const result = JSON.parse(response.choices[0].message.content ?? '{}')

    if (result.from === params.to) {
      return { text: params.text, from: result.from }
    }

    return {
      text: result.text?.trim() ?? params.text,
      from: result.from ?? 'en',
    }
  } catch {
    return { text: params.text, from: 'en' }
  }
}

export async function detectLanguageWithOpenAI(params: {
  apiKey: string
  model: string
  text: string
}): Promise<{ language: string; confidence: number }> {
  const openai = new OpenAI({ apiKey: params.apiKey })

  const response = await openai.chat.completions.create({
    model: params.model,
    messages: [{
      role: 'user',
      content: `What language is this? Reply with only: en, ar, he, or ru.\n\nText: ${params.text}`,
    }],
    temperature: 0,
    max_tokens: 5,
  })

  const detected = response.choices[0].message.content?.trim().toLowerCase() ?? 'en'
  const valid = ['en', 'ar', 'he', 'ru']

  return {
    language: valid.includes(detected) ? detected : 'en',
    confidence: 0.9,
  }
}
