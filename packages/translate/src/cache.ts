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

// Helper: Convert a cache entry to a CacheResult
function toCacheResult(
  entry: { translatedText: string; sourceLanguage: string; isManualOverride: boolean },
  isManualOverride?: boolean
): CacheResult {
  return {
    text: entry.translatedText,
    from: entry.sourceLanguage,
    isManualOverride: isManualOverride ?? entry.isManualOverride,
  }
}

// Helper: Build a cache entry from params
function buildCacheEntry(params: {
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
}) {
  const key = hasResourceInfo(params)
    ? createResourceKey(params.resourceType!, params.resourceId!, params.field!, params.targetLanguage)
    : createHashKey(params.sourceText, params.targetLanguage)

  return {
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
  }
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
  const hashKey = createHashKey(params.text, params.to)

  // When resource info is present, fetch both keys in parallel for speed
  if (hasResourceInfo(params)) {
    const resourceKey = createResourceKey(params.resourceType!, params.resourceId!, params.field!, params.to)
    const [resourceCached, hashCached] = await Promise.all([
      adapter.get(resourceKey),
      adapter.get(hashKey),
    ])

    // Resource key takes priority
    if (resourceCached) {
      adapter.touch(resourceKey).catch(() => {}) // fire-and-forget
      return toCacheResult(resourceCached)
    }

    // Fall back to hash key
    if (hashCached) {
      adapter.touch(hashKey).catch(() => {}) // fire-and-forget
      return toCacheResult(hashCached, false)
    }

    return null
  }

  // No resource info - just check hash key
  const hashCached = await adapter.get(hashKey)

  if (hashCached) {
    adapter.touch(hashKey).catch(() => {}) // fire-and-forget
    return toCacheResult(hashCached, false)
  }

  return null
}

export async function getCachedBatch(
  adapter: CacheAdapter,
  items: BatchCacheParams[],
  to: string
): Promise<Map<number, CacheResult>> {
  const results = new Map<number, CacheResult>()
  const keysToTouch: string[] = []

  // Build all possible keys (resource keys take priority, then hash keys)
  // Store arrays of indices since the same key can appear at multiple indices
  const keyToIndices = new Map<string, number[]>()
  const hashKeyToIndices = new Map<string, number[]>()

  for (let i = 0; i < items.length; i++) {
    const item = items[i]
    if (hasResourceInfo(item)) {
      const resourceKey = createResourceKey(item.resourceType!, item.resourceId!, item.field!, to)
      const indices = keyToIndices.get(resourceKey) || []
      indices.push(i)
      keyToIndices.set(resourceKey, indices)
    }
    // Always create hash key as fallback
    const hashKey = createHashKey(item.text, to)
    const hashIndices = hashKeyToIndices.get(hashKey) || []
    hashIndices.push(i)
    hashKeyToIndices.set(hashKey, hashIndices)
  }

  // Batch lookup all resource keys first
  if (keyToIndices.size > 0) {
    const resourceEntries = await adapter.getMany(Array.from(keyToIndices.keys()))
    for (const [key, entry] of resourceEntries) {
      const indices = keyToIndices.get(key)!
      const result = toCacheResult(entry)
      // Set result for all indices that have this resource key
      for (const index of indices) {
        results.set(index, result)
      }
      keysToTouch.push(key)
    }
  }

  // For items not found via resource key, try hash keys
  const missingHashKeys = new Set<string>()
  for (const [hashKey, indices] of hashKeyToIndices) {
    // Check if any index for this hash key is missing a result
    for (const index of indices) {
      if (!results.has(index)) {
        missingHashKeys.add(hashKey)
        break
      }
    }
  }

  if (missingHashKeys.size > 0) {
    const hashEntries = await adapter.getMany(Array.from(missingHashKeys))
    for (const [key, entry] of hashEntries) {
      const indices = hashKeyToIndices.get(key)!
      const result = toCacheResult(entry, false) // Hash-based lookups are never manual overrides
      // Set result for all indices that don't already have a result
      for (const index of indices) {
        if (!results.has(index)) {
          results.set(index, result)
        }
      }
      keysToTouch.push(key)
    }
  }

  // Fire-and-forget batch touch for all found keys
  if (keysToTouch.length > 0) {
    adapter.touchMany(keysToTouch).catch(() => {})
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
  await adapter.set(buildCacheEntry(params))
}

export async function setCacheBatch(
  adapter: CacheAdapter,
  items: {
    sourceText: string
    sourceLanguage: string
    targetLanguage: string
    translatedText: string
    provider: string
    model?: string
    resourceType?: string
    resourceId?: string
    field?: string
  }[]
): Promise<void> {
  if (items.length === 0) return

  const entries = items.map(params => buildCacheEntry(params))
  await adapter.setMany(entries)
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
