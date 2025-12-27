import type { CacheAdapter } from './adapters/types'
import type { TranslateConfig, TranslateParams, TranslateResult, BatchParams, SupportedLanguage, StringKeys, ObjectTranslateParams, AnalyticsEvent } from './create-translate'
import { getCached, getCachedBatch, setCache } from './cache'
import { createHashKey, createResourceKey, hasResourceInfo } from './cache-key'
import { translateWithAI, detectLanguageWithAI } from './providers/ai-sdk'
import { getModelInfo } from './providers/types'

const inFlightRequests = new Map<string, Promise<TranslateResult>>()

function emitAnalytics(config: TranslateConfig, event: AnalyticsEvent): void {
  if (config.onAnalytics) {
    try {
      const result = config.onAnalytics(event)
      if (result instanceof Promise) {
        result.catch((err) => {
          if (config.verbose) {
            console.error('Analytics callback error:', err)
          }
        })
      }
    } catch (err) {
      if (config.verbose) {
        console.error('Analytics callback error:', err)
      }
    }
  }
}

export async function translateText(
  adapter: CacheAdapter,
  config: TranslateConfig,
  params: TranslateParams
): Promise<TranslateResult> {
  const { text, to, from, context, resourceType, resourceId, field } = params
  const startTime = Date.now()

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

    emitAnalytics(config, {
      type: 'cache_hit',
      text,
      translatedText: cached.text,
      from: cached.from as SupportedLanguage,
      to,
      cached: true,
      duration: Date.now() - startTime,
      resourceType,
      resourceId,
      field,
    })

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

  const flightPromise = executeTranslation(adapter, config, params, startTime)
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
  params: TranslateParams,
  startTime: number
): Promise<TranslateResult> {
  const { text, to, from, context, resourceType, resourceId, field } = params
  const modelInfo = getModelInfo(config.model)

  try {
    const result = await translateWithAI({
      model: config.model,
      text,
      to,
      from,
      context,
      temperature: config.temperature,
      verbose: config.verbose,
    })

    if (result.from !== to) {
      setCache(adapter, {
        sourceText: text,
        sourceLanguage: result.from,
        targetLanguage: to,
        translatedText: result.text,
        provider: modelInfo.provider,
        model: modelInfo.modelId,
        resourceType,
        resourceId,
        field,
      }).catch(() => {}) // fire-and-forget
    }

    emitAnalytics(config, {
      type: 'translation',
      text,
      translatedText: result.text,
      from: result.from as SupportedLanguage,
      to,
      cached: false,
      duration: Date.now() - startTime,
      provider: modelInfo.provider,
      model: modelInfo.modelId,
      resourceType,
      resourceId,
      field,
    })

    return {
      text: result.text,
      from: result.from as TranslateResult['from'],
      to,
      cached: false,
    }
  } catch (err) {
    emitAnalytics(config, {
      type: 'error',
      text,
      to,
      cached: false,
      duration: Date.now() - startTime,
      provider: modelInfo.provider,
      model: modelInfo.modelId,
      error: err instanceof Error ? err.message : String(err),
      resourceType,
      resourceId,
      field,
    })
    throw err
  }
}

export async function translateBatch(
  adapter: CacheAdapter,
  config: TranslateConfig,
  params: BatchParams
): Promise<TranslateResult[]> {
  const { texts, to, from, context } = params
  const startTime = Date.now()

  // Filter out empty texts and track their indices
  const itemsToLookup = texts.map((text, index) => ({ text, index }))
    .filter(item => item.text.trim())

  // Short-circuit: if from === to, return all texts as-is
  if (from && from === to) {
    return texts.map(text => ({ text, from, to, cached: true }))
  }

  // Batch cache lookup
  const cachedResults = await getCachedBatch(
    adapter,
    itemsToLookup.map(item => ({ text: item.text })),
    to
  )

  // Build results array, translating only uncached items
  const results: TranslateResult[] = new Array(texts.length)

  // Fill in empty texts
  for (let i = 0; i < texts.length; i++) {
    if (!texts[i].trim()) {
      results[i] = { text: texts[i], from: from ?? 'en', to, cached: true }
    }
  }

  // Fill in cached results and collect uncached items
  const uncachedItems: { text: string; originalIndex: number; lookupIndex: number }[] = []

  for (let lookupIndex = 0; lookupIndex < itemsToLookup.length; lookupIndex++) {
    const item = itemsToLookup[lookupIndex]
    const cached = cachedResults.get(lookupIndex)

    if (cached) {
      // Handle same-language case
      if (cached.from === to || (from && from === to)) {
        results[item.index] = { text: item.text, from: cached.from as SupportedLanguage, to, cached: true }
      } else {
        emitAnalytics(config, {
          type: 'cache_hit',
          text: item.text,
          translatedText: cached.text,
          from: cached.from as SupportedLanguage,
          to,
          cached: true,
          duration: Date.now() - startTime,
        })
        results[item.index] = {
          text: cached.text,
          from: cached.from as SupportedLanguage,
          to,
          cached: true,
          isManualOverride: cached.isManualOverride,
        }
      }
    } else {
      uncachedItems.push({ text: item.text, originalIndex: item.index, lookupIndex })
    }
  }

  // Translate uncached items in parallel
  if (uncachedItems.length > 0) {
    const translations = await Promise.all(
      uncachedItems.map(item =>
        translateText(adapter, config, {
          text: item.text,
          to,
          from,
          context,
        })
      )
    )

    for (let i = 0; i < uncachedItems.length; i++) {
      results[uncachedItems[i].originalIndex] = translations[i]
    }
  }

  return results
}

export async function detectLanguage(
  config: TranslateConfig,
  text: string
): Promise<{ language: string; confidence: number }> {
  const startTime = Date.now()
  const modelInfo = getModelInfo(config.model)

  try {
    const result = await detectLanguageWithAI({
      model: config.model,
      text,
      temperature: 0,
      verbose: config.verbose,
    })

    emitAnalytics(config, {
      type: 'detection',
      text,
      from: result.language as SupportedLanguage,
      cached: false,
      duration: Date.now() - startTime,
      provider: modelInfo.provider,
      model: modelInfo.modelId,
    })

    return result
  } catch (err) {
    emitAnalytics(config, {
      type: 'error',
      text,
      cached: false,
      duration: Date.now() - startTime,
      provider: modelInfo.provider,
      model: modelInfo.modelId,
      error: err instanceof Error ? err.message : String(err),
    })
    throw err
  }
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
    // Batch cache lookup first
    const cacheItems = textsToTranslate.map(({ field, text }) => ({
      text,
      resourceType,
      resourceId,
      field: String(field),
    }))

    const cachedResults = await getCachedBatch(adapter, cacheItems, to)
    const results: TranslateResult[] = new Array(textsToTranslate.length)
    const uncachedItems: { index: number; field: K; text: string }[] = []
    const startTime = Date.now()

    // Fill in cached results and collect uncached items
    for (let i = 0; i < textsToTranslate.length; i++) {
      const cached = cachedResults.get(i)
      if (cached) {
        if (cached.from === to || (from && from === to)) {
          results[i] = { text: textsToTranslate[i].text, from: cached.from as SupportedLanguage, to, cached: true }
        } else {
          emitAnalytics(config, {
            type: 'cache_hit',
            text: textsToTranslate[i].text,
            translatedText: cached.text,
            from: cached.from as SupportedLanguage,
            to,
            cached: true,
            duration: Date.now() - startTime,
            resourceType,
            resourceId,
            field: String(textsToTranslate[i].field),
          })
          results[i] = {
            text: cached.text,
            from: cached.from as SupportedLanguage,
            to,
            cached: true,
            isManualOverride: cached.isManualOverride,
          }
        }
      } else {
        uncachedItems.push({ index: i, ...textsToTranslate[i] })
      }
    }

    // Translate uncached items
    if (uncachedItems.length > 0) {
      const translations = await Promise.all(
        uncachedItems.map(({ field, text }) =>
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

      for (let i = 0; i < uncachedItems.length; i++) {
        results[uncachedItems[i].index] = translations[i]
      }
    }

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
    // Batch cache lookup first
    const cacheItems = textsToTranslate.map(({ text, field, resourceId }) => ({
      text,
      resourceType,
      resourceId,
      field: String(field),
    }))

    const cachedResults = await getCachedBatch(adapter, cacheItems, to)
    const results: TranslateResult[] = new Array(textsToTranslate.length)
    const uncachedItems: { index: number; itemIndex: number; field: K; text: string; resourceId?: string }[] = []
    const startTime = Date.now()

    // Fill in cached results and collect uncached items
    for (let i = 0; i < textsToTranslate.length; i++) {
      const cached = cachedResults.get(i)
      const item = textsToTranslate[i]

      if (cached) {
        if (cached.from === to || (from && from === to)) {
          results[i] = { text: item.text, from: cached.from as SupportedLanguage, to, cached: true }
        } else {
          emitAnalytics(config, {
            type: 'cache_hit',
            text: item.text,
            translatedText: cached.text,
            from: cached.from as SupportedLanguage,
            to,
            cached: true,
            duration: Date.now() - startTime,
            resourceType,
            resourceId: item.resourceId,
            field: String(item.field),
          })
          results[i] = {
            text: cached.text,
            from: cached.from as SupportedLanguage,
            to,
            cached: true,
            isManualOverride: cached.isManualOverride,
          }
        }
      } else {
        uncachedItems.push({ index: i, ...item })
      }
    }

    // Translate uncached items
    if (uncachedItems.length > 0) {
      const translations = await Promise.all(
        uncachedItems.map(({ field, text, resourceId }) =>
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

      for (let i = 0; i < uncachedItems.length; i++) {
        results[uncachedItems[i].index] = translations[i]
      }
    }

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
