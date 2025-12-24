import { generateText, type LanguageModel } from 'ai'

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
Respond as JSON: {"from": "xx", "text": "translation"}

Text: {text}`

export async function translateWithAI(params: {
  model: LanguageModel
  text: string
  to: string
  from?: string
  context?: string
  temperature?: number
}): Promise<{ text: string; from: string }> {
  const { model, text, to, from, context, temperature = 0.3 } = params

  if (from) {
    if (from === to) {
      return { text, from }
    }

    const prompt = TRANSLATE_PROMPT
      .replace('{from}', LANGUAGE_NAMES[from] ?? from)
      .replace(/{to}/g, LANGUAGE_NAMES[to] ?? to)
      .replace('{context}', context ?? 'general content')
      .replace('{text}', text)

    const { text: translatedText } = await generateText({
      model,
      prompt,
      temperature,
    })

    return {
      text: translatedText.trim(),
      from,
    }
  }

  // Auto-detect language mode
  const prompt = DETECT_AND_TRANSLATE_PROMPT
    .replace(/{to}/g, LANGUAGE_NAMES[to] ?? to)
    .replace('{context}', context ?? 'general content')
    .replace('{text}', text)

  const { text: responseText } = await generateText({
    model,
    prompt,
    temperature,
  })

  try {
    // Parse JSON response, handling potential markdown code blocks
    const cleanResponse = responseText.replace(/```json\n?|\n?```/g, '').trim()
    const result = JSON.parse(cleanResponse)

    if (result.from === to) {
      return { text, from: result.from }
    }

    return {
      text: result.text?.trim() ?? text,
      from: result.from ?? 'en',
    }
  } catch {
    return { text, from: 'en' }
  }
}

export async function detectLanguageWithAI(params: {
  model: LanguageModel
  text: string
  temperature?: number
}): Promise<{ language: string; confidence: number }> {
  const { model, text, temperature = 0 } = params

  const { text: detected } = await generateText({
    model,
    prompt: `What language is this? Reply with only: en, ar, he, or ru.\n\nText: ${text}`,
    temperature,
  })

  const cleanDetected = detected.trim().toLowerCase()
  const valid = ['en', 'ar', 'he', 'ru']

  return {
    language: valid.includes(cleanDetected) ? cleanDetected : 'en',
    confidence: 0.9,
  }
}
