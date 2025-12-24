import type { CacheAdapter } from './adapters/types'
import type { TranslateConfig, TranslateParams, TranslateResult, BatchParams, SupportedLanguage } from './create-translate'
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
  })
}
