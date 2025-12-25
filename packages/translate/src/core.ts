import type { CacheAdapter } from './adapters/types'
import type { TranslateConfig, TranslateParams, TranslateResult, BatchParams, SupportedLanguage, StringKeys, ObjectTranslateParams } from './create-translate'
import { getCached, setCache } from './cache'
import { createHashKey, createResourceKey, hasResourceInfo } from './cache-key'
import { translateWithAI, detectLanguageWithAI } from './providers/ai-sdk'
import { getModelInfo } from './providers/types'

const inFlightRequests = new Map<string, Promise<TranslateResult>>()

export async function translateText(
  adapter: CacheAdapter,
  config: TranslateConfig,
  params: TranslateParams
): Promise<TranslateResult> {
  const { text, to, from, context, resourceType, resourceId, field } = params

  if (!text.trim()) {
    return { text, from: from ?? 'en', to, cached: true }
  }

  // Short-circuit if from === to (no translation needed)
  if (from && from === to) {
    return { text, from, to, cached: true }
  }

  const cached = await getCached(adapter, { text, to, resourceType, resourceId, field })
  if (cached) {
    if (cached.from === to || (from && from === to)) {
      return { text, from: cached.from as SupportedLanguage, to, cached: true }
    }
    return {
      text: cached.text,
      from: cached.from as TranslateResult['from'],
      to,
      cached: true,
      isManualOverride: cached.isManualOverride,
    }
  }

  const flightKey = hasResourceInfo(params)
    ? createResourceKey(resourceType!, resourceId!, field!, to)
    : createHashKey(text, to)

  const existingFlight = inFlightRequests.get(flightKey)
  if (existingFlight) {
    return existingFlight
  }

  const flightPromise = executeTranslation(adapter, config, params)
  inFlightRequests.set(flightKey, flightPromise)

  try {
    return await flightPromise
  } finally {
    inFlightRequests.delete(flightKey)
  }
}

async function executeTranslation(
  adapter: CacheAdapter,
  config: TranslateConfig,
  params: TranslateParams
): Promise<TranslateResult> {
  const { text, to, from, context, resourceType, resourceId, field } = params

  const result = await translateWithAI({
    model: config.model,
    text,
    to,
    from,
    context,
    temperature: config.temperature,
    verbose: config.verbose,
  })

  // Get model info for cache metadata
  const modelInfo = getModelInfo(config.model)

  if (result.from !== to) {
    await setCache(adapter, {
      sourceText: text,
      sourceLanguage: result.from,
      targetLanguage: to,
      translatedText: result.text,
      provider: modelInfo.provider,
      model: modelInfo.modelId,
      resourceType,
      resourceId,
      field,
    })
  }

  return {
    text: result.text,
    from: result.from as TranslateResult['from'],
    to,
    cached: false,
  }
}

export async function translateBatch(
  adapter: CacheAdapter,
  config: TranslateConfig,
  params: BatchParams
): Promise<TranslateResult[]> {
  return Promise.all(
    params.texts.map(text =>
      translateText(adapter, config, {
        text,
        to: params.to,
        from: params.from,
        context: params.context,
      })
    )
  )
}

export async function detectLanguage(
  config: TranslateConfig,
  text: string
): Promise<{ language: string; confidence: number }> {
  return detectLanguageWithAI({
    model: config.model,
    text,
    temperature: 0,
    verbose: config.verbose,
  })
}

export async function translateObject<T extends object, K extends StringKeys<T>>(
  adapter: CacheAdapter,
  config: TranslateConfig,
  item: T,
  params: ObjectTranslateParams<T, K>
): Promise<T> {
  const { fields, to, from, context, resourceType, resourceIdField } = params
  const resourceId = resourceIdField ? String(item[resourceIdField]) : undefined

  // Collect texts to translate with their field info
  const textsToTranslate: { field: K; text: string }[] = []

  for (const field of fields) {
    const value = item[field]
    if (typeof value === 'string' && value.trim()) {
      textsToTranslate.push({ field, text: value })
    }
  }

  // If no texts to translate, return original
  if (textsToTranslate.length === 0) {
    return item
  }

  try {
    // Use translateText for each field when resource info is provided (enables field-level caching)
    // Otherwise use batch translation
    const results = resourceType && resourceId
      ? await Promise.all(
          textsToTranslate.map(({ field, text }) =>
            translateText(adapter, config, {
              text,
              to,
              from,
              context,
              resourceType,
              resourceId,
              field: String(field),
            })
          )
        )
      : await translateBatch(adapter, config, {
          texts: textsToTranslate.map(t => t.text),
          to,
          from,
          context,
        })

    // Build translated object
    const translated = { ...item }
    for (let i = 0; i < textsToTranslate.length; i++) {
      const { field } = textsToTranslate[i]
      const result = results[i]
      if (result) {
        ;(translated as Record<string, unknown>)[field as string] = result.text
      }
    }

    return translated
  } catch (error) {
    console.error('Translation failed for object:', error)
    return item
  }
}

export async function translateObjects<T extends object, K extends StringKeys<T>>(
  adapter: CacheAdapter,
  config: TranslateConfig,
  items: T[],
  params: ObjectTranslateParams<T, K>
): Promise<T[]> {
  const { fields, to, from, context, resourceType, resourceIdField } = params

  // Collect all texts with their item index, field info, and resource ID
  const textsToTranslate: { itemIndex: number; field: K; text: string; resourceId?: string }[] = []

  for (let itemIndex = 0; itemIndex < items.length; itemIndex++) {
    const item = items[itemIndex]
    const resourceId = resourceIdField ? String(item[resourceIdField]) : undefined

    for (const field of fields) {
      const value = item[field]
      if (typeof value === 'string' && value.trim()) {
        textsToTranslate.push({ itemIndex, field, text: value, resourceId })
      }
    }
  }

  // If no texts to translate, return original array
  if (textsToTranslate.length === 0) {
    return items
  }

  try {
    // Use translateText for each field when resource info is provided (enables field-level caching)
    // Otherwise use batch translation
    const results = resourceType && resourceIdField
      ? await Promise.all(
          textsToTranslate.map(({ field, text, resourceId }) =>
            translateText(adapter, config, {
              text,
              to,
              from,
              context,
              resourceType,
              resourceId,
              field: String(field),
            })
          )
        )
      : await translateBatch(adapter, config, {
          texts: textsToTranslate.map(t => t.text),
          to,
          from,
          context,
        })

    // Build translated items
    const translated = items.map(item => ({ ...item }))

    for (let i = 0; i < textsToTranslate.length; i++) {
      const { itemIndex, field } = textsToTranslate[i]
      const result = results[i]
      if (result) {
        ;(translated[itemIndex] as Record<string, unknown>)[field as string] = result.text
      }
    }

    return translated
  } catch (error) {
    console.error('Translation failed for objects:', error)
    return items
  }
}
