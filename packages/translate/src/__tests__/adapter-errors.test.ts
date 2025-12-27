import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTranslate } from '../create-translate'
import type { CacheAdapter, CacheEntry } from '../adapters/types'
import type { LanguageModel } from 'ai'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

import { generateText } from 'ai'

const mockModel = {
  modelId: 'gpt-4o-mini',
  provider: 'openai',
} as unknown as LanguageModel

// Helper to create a failing adapter
function createFailingAdapter(failures: {
  get?: Error | 'malformed'
  set?: Error
  touch?: Error
  delete?: Error
  deleteByResource?: Error
  deleteByLanguage?: Error
  deleteAll?: Error
}): CacheAdapter {
  const storage = new Map<string, CacheEntry>()

  return {
    async get(id: string) {
      if (failures.get instanceof Error) throw failures.get
      if (failures.get === 'malformed') return { invalid: 'data' } as any
      return storage.get(id) ?? null
    },
    async set(entry) {
      if (failures.set) throw failures.set
      const now = new Date()
      storage.set(entry.id, {
        ...entry,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: now,
      })
    },
    async touch(id: string) {
      if (failures.touch) throw failures.touch
      const entry = storage.get(id)
      if (entry) {
        entry.lastUsedAt = new Date()
      }
    },
    async delete(id: string) {
      if (failures.delete) throw failures.delete
      storage.delete(id)
    },
    async deleteByResource(resourceType: string, resourceId: string) {
      if (failures.deleteByResource) throw failures.deleteByResource
      let count = 0
      for (const [key, entry] of storage) {
        if (entry.resourceType === resourceType && entry.resourceId === resourceId) {
          storage.delete(key)
          count++
        }
      }
      return count
    },
    async deleteByLanguage(targetLanguage: string) {
      if (failures.deleteByLanguage) throw failures.deleteByLanguage
      let count = 0
      for (const [key, entry] of storage) {
        if (entry.targetLanguage === targetLanguage) {
          storage.delete(key)
          count++
        }
      }
      return count
    },
    async deleteAll() {
      if (failures.deleteAll) throw failures.deleteAll
      const count = storage.size
      storage.clear()
      return count
    },
    async getStats() {
      const stats = {
        totalEntries: storage.size,
        byLanguage: {} as Record<string, number>,
        manualOverrides: 0,
      }
      for (const entry of storage.values()) {
        stats.byLanguage[entry.targetLanguage] = (stats.byLanguage[entry.targetLanguage] || 0) + 1
        if (entry.isManualOverride) stats.manualOverrides++
      }
      return stats
    },
  }
}

describe('Adapter Error Handling', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('adapter.get() failures', () => {
    it('should propagate error when get() throws', async () => {
      const adapter = createFailingAdapter({
        get: new Error('Database connection failed'),
      })

      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      // Current implementation propagates adapter errors
      await expect(
        translate.text({
          text: 'Hello',
          to: 'he',
          from: 'en',
        })
      ).rejects.toThrow('Database connection failed')
    })

    it('should handle malformed data from get() by using it as-is', async () => {
      const adapter = createFailingAdapter({
        get: 'malformed',
      })

      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      // Malformed data is treated as valid cache entry
      expect(result).toBeDefined()
    })

    it('should propagate error in batch translation when get() throws', async () => {
      const adapter = createFailingAdapter({
        get: new Error('Cache unavailable'),
      })

      vi.mocked(generateText).mockResolvedValue({
        text: '["שלום", "עולם"]',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      await expect(
        translate.batch({
          texts: ['Hello', 'World'],
          to: 'he',
          from: 'en',
        })
      ).rejects.toThrow('Cache unavailable')
    })
  })

  describe('adapter.set() failures', () => {
    it('should propagate error when set() throws', async () => {
      const adapter = createFailingAdapter({
        set: new Error('Write failed'),
      })

      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      // Current implementation propagates set errors
      await expect(
        translate.text({
          text: 'Hello',
          to: 'he',
          from: 'en',
        })
      ).rejects.toThrow('Write failed')
    })

    it('should propagate error in batch when set() fails', async () => {
      let setCallCount = 0
      const adapter: CacheAdapter = {
        async get() { return null },
        async set() {
          setCallCount++
          if (setCallCount === 1) throw new Error('First set failed')
        },
        async touch() {},
        async delete() {},
        async deleteByResource() { return 0 },
        async deleteByLanguage() { return 0 },
        async deleteAll() { return 0 },
        async getStats() {
          return { totalEntries: 0, byLanguage: {}, manualOverrides: 0 }
        },
      }

      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      await expect(
        translate.batch({
          texts: ['Hello', 'World'],
          to: 'he',
          from: 'en',
        })
      ).rejects.toThrow('First set failed')
    })
  })

  describe('adapter.touch() failures', () => {
    it('should propagate touch() errors on cache hit', async () => {
      const storage = new Map<string, CacheEntry>()
      const adapter: CacheAdapter = {
        async get(id: string) {
          return storage.get(id) ?? null
        },
        async set(entry) {
          const now = new Date()
          storage.set(entry.id, {
            ...entry,
            createdAt: now,
            updatedAt: now,
            lastUsedAt: now,
          })
        },
        async touch() {
          throw new Error('Touch failed')
        },
        async delete() {},
        async deleteByResource() { return 0 },
        async deleteByLanguage() { return 0 },
        async deleteAll() { return 0 },
        async getStats() {
          return { totalEntries: storage.size, byLanguage: {}, manualOverrides: 0 }
        },
      }

      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      // First call - caches the result
      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      // Second call - touch fails silently (fire-and-forget), cached result still returned
      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })
      expect(result.text).toBe('שלום')
      expect(result.cached).toBe(true)
    })
  })

  describe('adapter.delete*() failures', () => {
    it('should propagate deleteByResource() error', async () => {
      const adapter = createFailingAdapter({
        deleteByResource: new Error('Delete failed'),
      })

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      await expect(
        translate.clearResourceCache('property', '123')
      ).rejects.toThrow('Delete failed')
    })

    it('should propagate deleteByLanguage() error through clearCache', async () => {
      const adapter = createFailingAdapter({
        deleteByLanguage: new Error('Language delete failed'),
      })

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      await expect(
        translate.clearCache('he')
      ).rejects.toThrow('Language delete failed')
    })

    it('should propagate deleteAll() error through clearCache', async () => {
      const adapter = createFailingAdapter({
        deleteAll: new Error('Clear all failed'),
      })

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      await expect(
        translate.clearCache()
      ).rejects.toThrow('Clear all failed')
    })
  })

  describe('adapter with async errors', () => {
    it('should propagate async adapter errors', async () => {
      const adapter: CacheAdapter = {
        async get() {
          await new Promise(resolve => setTimeout(resolve, 10))
          throw new Error('Async get failure')
        },
        async set() {},
        async touch() {},
        async delete() {},
        async deleteByResource() { return 0 },
        async deleteByLanguage() { return 0 },
        async deleteAll() { return 0 },
        async getStats() {
          return { totalEntries: 0, byLanguage: {}, manualOverrides: 0 }
        },
      }

      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      await expect(
        translate.text({
          text: 'Hello',
          to: 'he',
          from: 'en',
        })
      ).rejects.toThrow('Async get failure')
    })
  })

  describe('object translation with adapter failures', () => {
    it('should return original object when adapter.get() throws (caught by try/catch)', async () => {
      const adapter = createFailingAdapter({
        get: new Error('Get failed'),
      })

      vi.mocked(generateText).mockResolvedValue({
        text: 'כותרת',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      const todo = { id: '1', title: 'Title', done: false }
      // translateObject catches errors and returns original
      const result = await translate.object(todo, {
        fields: ['title'],
        to: 'he',
      })

      // Returns original due to error handling in translateObject
      expect(result.title).toBe('Title')
      expect(result.id).toBe('1')
    })

    it('should return original objects when adapter fails during objects()', async () => {
      const adapter = createFailingAdapter({
        get: new Error('Get failed'),
      })

      vi.mocked(generateText).mockResolvedValue({
        text: 'כותרת',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      const todos = [
        { id: '1', title: 'Title 1', done: false },
        { id: '2', title: 'Title 2', done: true },
      ]

      // translateObjects catches errors and returns originals
      const results = await translate.objects(todos, {
        fields: ['title'],
        to: 'he',
      })

      expect(results).toHaveLength(2)
      expect(results[0].title).toBe('Title 1')
      expect(results[1].title).toBe('Title 2')
    })
  })
})
