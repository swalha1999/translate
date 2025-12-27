import type { CacheAdapter } from './adapters/types'
import { createHashKey, createResourceKey, hasResourceInfo } from './cache-key'

interface CacheResult {
  text: string
  from: string
  isManualOverride: boolean
}

interface BatchCacheParams {
  text: string
  resourceType?: string
  resourceId?: string
  field?: string
}

interface BatchCacheResult extends CacheResult {
  index: number
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

export async function getCachedBatch(
  adapter: CacheAdapter,
  items: BatchCacheParams[],
  to: string
): Promise<Map<number, CacheResult>> {
  const results = new Map<number, CacheResult>()

  // Build all possible keys (resource keys take priority, then hash keys)
  const keyToIndex = new Map<string, number>()
  const hashKeyToIndex = new Map<string, number>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (hasResourceInfo(item)) {
      const resourceKey = createResourceKey(item.resourceType!, item.resourceId!, item.field!, to)
      keyToIndex.set(resourceKey, i)
    }
    // Always create hash key as fallback
    const hashKey = createHashKey(item.text, to)
    hashKeyToIndex.set(hashKey, i)
  }

  // Batch lookup all resource keys first
  if (keyToIndex.size > 0) {
    const resourceEntries = await adapter.getMany(Array.from(keyToIndex.keys()))
    for (const [key, entry] of resourceEntries) {
      const index = keyToIndex.get(key)!
      results.set(index, {
        text: entry.translatedText,
        from: entry.sourceLanguage,
        isManualOverride: entry.isManualOverride,
      })
      // Fire-and-forget touch
      adapter.touch(key).catch(() => {})
    }
  }

  // For items not found via resource key, try hash keys
  const missingHashKeys: string[] = []
  for (const [hashKey, index] of hashKeyToIndex) {
    if (!results.has(index)) {
      missingHashKeys.push(hashKey)
    }
  }

  if (missingHashKeys.length > 0) {
    const hashEntries = await adapter.getMany(missingHashKeys)
    for (const [key, entry] of hashEntries) {
      const index = hashKeyToIndex.get(key)!
      if (!results.has(index)) {
        results.set(index, {
          text: entry.translatedText,
          from: entry.sourceLanguage,
          isManualOverride: false, // Hash-based lookups are never manual overrides
        })
        // Fire-and-forget touch
        adapter.touch(key).catch(() => {})
      }
    }
  }

  return results
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
