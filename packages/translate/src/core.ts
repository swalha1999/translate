import type { CacheAdapter } from './adapters/types'
import type { TranslateConfig, TranslateParams, TranslateResult, BatchParams, SupportedLanguage, StringKeys, ObjectTranslateParams, AnalyticsEvent } from './create-translate'
import { getCached, getCachedBatch, setCache, setCacheBatch } from './cache'
import { createHashKey, createResourceKey, hasResourceInfo } from './cache-key'
import { translateWithAI, detectLanguageWithAI } from './providers/ai-sdk'
import { getModelInfo } from './providers/types'

const inFlightRequests = new Map<string, Promise<TranslateResult>>()

// Helper: Extract error message from any error type
function extractErrorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

// Helper: Handle cache operation errors with optional callback
function handleCacheError(
  config: TranslateConfig,
  operation: 'get' | 'set' | 'touch',
  err: unknown
): void {
  const error = err instanceof Error ? err : new Error(String(err))
  if (config.onCacheError) {
    try {
      config.onCacheError(error, operation)
    } catch {
      // Ignore errors from the error handler itself
    }
  }
  if (config.verbose) {
    console.error(`[Cache] ${operation} failed:`, error.message)
  }
}

// Helper: Fire-and-forget with error handling
function fireAndForget<T>(
  promise: Promise<T>,
  config: TranslateConfig,
  operation: 'get' | 'set' | 'touch'
): void {
  promise.catch(err => handleCacheError(config, operation, err))
}

// Helper: Group items by text to avoid duplicate translations
function deduplicateByText<T extends { text: string }>(items: T[]): Map<string, number[]> {
  const textToIndices = new Map<string, number[]>()
  for (let i = 0; i < items.length; i++) {
    const indices = textToIndices.get(items[i].text) || []
    indices.push(i)
    textToIndices.set(items[i].text, indices)
  }
  return textToIndices
}

// Helper: Process a cached result and emit analytics
function processCachedResult(
  cached: { text: string; from: string; isManualOverride: boolean },
  originalText: string,
  to: string,
  from: string | undefined,
  config: TranslateConfig,
  startTime: number,
  resourceParams?: { resourceType?: string; resourceId?: string; field?: string }
): TranslateResult {
  if (cached.from === to || (from && from === to)) {
    return { text: originalText, from: cached.from as SupportedLanguage, to, cached: true }
  }

  emitAnalytics(config, {
    type: 'cache_hit',
    text: originalText,
    translatedText: cached.text,
    from: cached.from as SupportedLanguage,
    to,
    cached: true,
    duration: Date.now() - startTime,
    ...resourceParams,
  })

  return {
    text: cached.text,
    from: cached.from as SupportedLanguage,
    to,
    cached: true,
    isManualOverride: cached.isManualOverride,
  }
}

// Helper: Translate unique texts with deduplication
async function translateUniqueTexts(
  config: TranslateConfig,
  uniqueTexts: string[],
  params: { to: string; from?: string; context?: string },
  startTime: number,
  resourceType?: string
): Promise<{ text: string; result: TranslateResult; sourceLanguage: string }[]> {
  const modelInfo = getModelInfo(config.model)

  return Promise.all(
    uniqueTexts.map(async text => {
      const aiResult = await translateWithAI({
        model: config.model,
        text,
        to: params.to,
        from: params.from,
        context: params.context,
        temperature: config.temperature,
        verbose: config.verbose,
      })

      emitAnalytics(config, {
        type: 'translation',
        text,
        translatedText: aiResult.text,
        from: aiResult.from as SupportedLanguage,
        to: params.to,
        cached: false,
        duration: Date.now() - startTime,
        provider: modelInfo.provider,
        model: modelInfo.modelId,
        resourceType,
      })

      return {
        text,
        result: {
          text: aiResult.text,
          from: aiResult.from as SupportedLanguage,
          to: params.to,
          cached: false,
        } as TranslateResult,
        sourceLanguage: aiResult.from,
      }
    })
  )
}

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
      fireAndForget(
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
        }),
        config,
        'set'
      )
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
      error: extractErrorMessage(err),
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
  const uncachedItems: { text: string; originalIndex: number }[] = []

  for (let lookupIndex = 0; lookupIndex < itemsToLookup.length; lookupIndex++) {
    const item = itemsToLookup[lookupIndex]
    const cached = cachedResults.get(lookupIndex)

    if (cached) {
      results[item.index] = processCachedResult(cached, item.text, to, from, config, startTime)
    } else {
      uncachedItems.push({ text: item.text, originalIndex: item.index })
    }
  }

  // Translate uncached items in parallel
  if (uncachedItems.length > 0) {
    const modelInfo = getModelInfo(config.model)
    const uniqueTexts = Array.from(deduplicateByText(uncachedItems).keys())
    const translationResults = await translateUniqueTexts(config, uniqueTexts, { to, from, context }, startTime)

    // Map results back to all items (including duplicates)
    const textToResult = new Map(translationResults.map(r => [r.text, r]))
    for (const item of uncachedItems) {
      results[item.originalIndex] = textToResult.get(item.text)!.result
    }

    // Batch cache write (fire-and-forget)
    const cacheEntries = translationResults
      .filter(r => r.sourceLanguage !== to)
      .map(r => ({
        sourceText: r.text,
        sourceLanguage: r.sourceLanguage,
        targetLanguage: to,
        translatedText: r.result.text,
        provider: modelInfo.provider,
        model: modelInfo.modelId,
      }))

    if (cacheEntries.length > 0) {
      fireAndForget(setCacheBatch(adapter, cacheEntries), config, 'set')
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
      error: extractErrorMessage(err),
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
        results[i] = processCachedResult(cached, textsToTranslate[i].text, to, from, config, startTime, {
          resourceType, resourceId, field: String(textsToTranslate[i].field),
        })
      } else {
        uncachedItems.push({ index: i, ...textsToTranslate[i] })
      }
    }

    // Translate uncached items
    if (uncachedItems.length > 0) {
      const modelInfo = getModelInfo(config.model)
      const uniqueTexts = Array.from(deduplicateByText(uncachedItems).keys())
      const translationResults = await translateUniqueTexts(config, uniqueTexts, { to, from, context }, startTime, resourceType)

      // Map results back to all items (including duplicates)
      const textToResult = new Map(translationResults.map(r => [r.text, r]))
      for (const item of uncachedItems) {
        results[item.index] = textToResult.get(item.text)!.result
      }

      // Cache each item with its specific resource info (fire-and-forget)
      for (const item of uncachedItems) {
        const tr = textToResult.get(item.text)!
        if (tr.sourceLanguage !== to) {
          fireAndForget(
            setCache(adapter, {
              sourceText: item.text,
              sourceLanguage: tr.sourceLanguage,
              targetLanguage: to,
              translatedText: tr.result.text,
              provider: modelInfo.provider,
              model: modelInfo.modelId,
              resourceType,
              resourceId,
              field: String(item.field),
            }),
            config,
            'set'
          )
        }
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
        results[i] = processCachedResult(cached, item.text, to, from, config, startTime, {
          resourceType, resourceId: item.resourceId, field: String(item.field),
        })
      } else {
        uncachedItems.push({ index: i, ...item })
      }
    }

    // Translate uncached items
    if (uncachedItems.length > 0) {
      const modelInfo = getModelInfo(config.model)
      const uniqueTexts = Array.from(deduplicateByText(uncachedItems).keys())
      const translationResults = await translateUniqueTexts(config, uniqueTexts, { to, from, context }, startTime, resourceType)

      // Map results back to all items (including duplicates)
      const textToResult = new Map(translationResults.map(r => [r.text, r]))
      for (const item of uncachedItems) {
        results[item.index] = textToResult.get(item.text)!.result
      }

      // Cache each item with its specific resource info (fire-and-forget)
      for (const item of uncachedItems) {
        const tr = textToResult.get(item.text)!
        if (tr.sourceLanguage !== to) {
          fireAndForget(
            setCache(adapter, {
              sourceText: item.text,
              sourceLanguage: tr.sourceLanguage,
              targetLanguage: to,
              translatedText: tr.result.text,
              provider: modelInfo.provider,
              model: modelInfo.modelId,
              resourceType,
              resourceId: item.resourceId,
              field: String(item.field),
            }),
            config,
            'set'
          )
        }
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
