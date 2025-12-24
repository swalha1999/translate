import type { CacheAdapter, CacheEntry } from './types'

export function createMemoryAdapter(): CacheAdapter {
  const cache = new Map<string, CacheEntry>()

  return {
    async get(id: string) {
      return cache.get(id) ?? null
    },

    async set(entry) {
      const now = new Date()
      cache.set(entry.id, {
        ...entry,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: now,
      })
    },

    async touch(id: string) {
      const entry = cache.get(id)
      if (entry) {
        entry.lastUsedAt = new Date()
      }
    },

    async delete(id: string) {
      cache.delete(id)
    },

    async deleteByResource(resourceType: string, resourceId: string) {
      let count = 0
      for (const [key, entry] of cache) {
        if (entry.resourceType === resourceType && entry.resourceId === resourceId) {
          cache.delete(key)
          count++
        }
      }
      return count
    },

    async deleteByLanguage(targetLanguage: string) {
      let count = 0
      for (const [key, entry] of cache) {
        if (entry.targetLanguage === targetLanguage) {
          cache.delete(key)
          count++
        }
      }
      return count
    },

    async deleteAll() {
      const count = cache.size
      cache.clear()
      return count
    },

    async getStats() {
      const byLanguage: Record<string, number> = {}
      let manualOverrides = 0

      for (const entry of cache.values()) {
        byLanguage[entry.targetLanguage] = (byLanguage[entry.targetLanguage] ?? 0) + 1
        if (entry.isManualOverride) manualOverrides++
      }

      return {
        totalEntries: cache.size,
        byLanguage,
        manualOverrides,
      }
    },
  }
}
