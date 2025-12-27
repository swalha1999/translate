import { generateText, type LanguageModel } from 'ai'

// All supported language codes - must match SupportedLanguage type
export const SUPPORTED_LANGUAGES = ['en', 'ar', 'he', 'ru', 'ja', 'ko', 'zh', 'hi', 'el', 'th', 'fr', 'de'] as const

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic',
  he: 'Hebrew',
  ru: 'Russian',
  ja: 'Japanese',
  ko: 'Korean',
  zh: 'Chinese',
  hi: 'Hindi',
  el: 'Greek',
  th: 'Thai',
  fr: 'French',
  de: 'German',
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
  verbose?: boolean
}): Promise<{ text: string; from: string }> {
  const { model, text, to, from, context, temperature = 0.3, verbose = false } = params

  if (from) {
    if (from === to) {
      return { text, from }
    }

    const prompt = TRANSLATE_PROMPT
      .replace('{from}', LANGUAGE_NAMES[from] ?? from)
      .replace(/{to}/g, LANGUAGE_NAMES[to] ?? to)
      .replace('{context}', context ?? 'general content')
      .replace('{text}', text)

    if (verbose) {
      console.log('[Translate] Input:', text)
    }

    const { text: translatedText } = await generateText({
      model,
      prompt,
      temperature,
    })

    if (verbose) {
      console.log('[Translate] Output:', translatedText.trim())
    }

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

  if (verbose) {
    console.log('[Translate] Input:', text)
  }

  const { text: responseText } = await generateText({
    model,
    prompt,
    temperature,
  })

  try {
    // Parse JSON response, handling potential markdown code blocks
    const cleanResponse = responseText.replace(/```json\n?|\n?```/g, '').trim()
    const result = JSON.parse(cleanResponse)

    if (verbose) {
      console.log('[Translate] Output:', result.text?.trim() ?? text)
    }

    if (result.from === to) {
      return { text, from: result.from }
    }

    return {
      text: result.text?.trim() ?? text,
      from: result.from ?? 'en',
    }
  } catch {
    if (verbose) {
      console.log('[Translate] Output:', text, '(parse error, returning original)')
    }
    return { text, from: 'en' }
  }
}

export async function detectLanguageWithAI(params: {
  model: LanguageModel
  text: string
  temperature?: number
  verbose?: boolean
}): Promise<{ language: string; confidence: number }> {
  const { model, text, temperature = 0, verbose = false } = params

  if (verbose) {
    console.log('[DetectLanguage] Input:', text)
  }

  const { text: detected } = await generateText({
    model,
    prompt: `What language is this? Reply with only one of: ${SUPPORTED_LANGUAGES.join(', ')}.\n\nText: ${text}`,
    temperature,
  })

  const cleanDetected = detected.trim().toLowerCase()
  const language = (SUPPORTED_LANGUAGES as readonly string[]).includes(cleanDetected) ? cleanDetected : 'en'

  if (verbose) {
    console.log('[DetectLanguage] Output:', language)
  }

  return {
    language,
    confidence: 0.9,
  }
}
