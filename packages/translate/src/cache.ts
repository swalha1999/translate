import type { CacheAdapter } from './adapters/types'
import { createHashKey, createResourceKey, hasResourceInfo } from './cache-key'

interface CacheResult {
  text: string
  from: string
  isManualOverride: boolean
}

export async function getCached(
  adapter: CacheAdapter,
  params: {
    text: string
    to: string
    resourceType?: string
    resourceId?: string
    field?: string
  }
): Promise<CacheResult | null> {
  if (hasResourceInfo(params)) {
    const resourceKey = createResourceKey(params.resourceType!, params.resourceId!, params.field!, params.to)
    const resourceCached = await adapter.get(resourceKey)

    if (resourceCached) {
      adapter.touch(resourceKey).catch(() => {}) // fire-and-forget
      return {
        text: resourceCached.translatedText,
        from: resourceCached.sourceLanguage,
        isManualOverride: resourceCached.isManualOverride,
      }
    }
  }

  const hashKey = createHashKey(params.text, params.to)
  const hashCached = await adapter.get(hashKey)

  if (hashCached) {
    adapter.touch(hashKey).catch(() => {}) // fire-and-forget
    return {
      text: hashCached.translatedText,
      from: hashCached.sourceLanguage,
      isManualOverride: false,
    }
  }

  return null
}

export async function setCache(
  adapter: CacheAdapter,
  params: {
    sourceText: string
    sourceLanguage: string
    targetLanguage: string
    translatedText: string
    provider: string
    model?: string
    resourceType?: string
    resourceId?: string
    field?: string
    isManualOverride?: boolean
  }
): Promise<void> {
  const key = hasResourceInfo(params)
    ? createResourceKey(params.resourceType!, params.resourceId!, params.field!, params.targetLanguage)
    : createHashKey(params.sourceText, params.targetLanguage)

  await adapter.set({
    id: key,
    sourceText: params.sourceText,
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
    translatedText: params.translatedText,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    field: params.field,
    isManualOverride: params.isManualOverride ?? false,
    provider: params.provider,
    model: params.model,
  })
}

export async function setManualTranslation(
  adapter: CacheAdapter,
  params: {
    text: string
    translatedText: string
    to: string
    resourceType: string
    resourceId: string
    field: string
  }
): Promise<void> {
  const key = createResourceKey(params.resourceType, params.resourceId, params.field, params.to)

  await adapter.set({
    id: key,
    sourceText: params.text,
    sourceLanguage: 'manual',
    targetLanguage: params.to,
    translatedText: params.translatedText,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    field: params.field,
    isManualOverride: true,
    provider: 'manual',
    model: null,
  })
}

export async function clearManualTranslation(
  adapter: CacheAdapter,
  params: { resourceType: string; resourceId: string; field: string; to: string }
): Promise<void> {
  const key = createResourceKey(params.resourceType, params.resourceId, params.field, params.to)
  await adapter.delete(key)
}
