import { describe, it, expect, beforeEach } from 'vitest'
import { getCached, getCachedBatch, setCache, setCacheBatch, setManualTranslation, clearManualTranslation } from '../cache'
import { createMemoryAdapter } from '../adapters/memory'
import type { CacheAdapter } from '../adapters/types'

describe('cache', () => {
  let adapter: CacheAdapter

  beforeEach(() => {
    adapter = createMemoryAdapter()
  })

  describe('getCached', () => {
    it('should return null for uncached text', async () => {
      const result = await getCached(adapter, {
        text: 'Hello',
        to: 'he',
      })
      expect(result).toBeNull()
    })

    it('should return cached translation', async () => {
      await setCache(adapter, {
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        provider: 'openai',
      })

      const result = await getCached(adapter, {
        text: 'Hello',
        to: 'he',
      })

      expect(result).not.toBeNull()
      expect(result?.text).toBe('שלום')
      expect(result?.from).toBe('en')
      expect(result?.isManualOverride).toBe(false)
    })

    it('should prioritize resource-specific cache over hash cache', async () => {
      // Set hash-based cache
      await setCache(adapter, {
        sourceText: 'flat',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שטוח',
        provider: 'openai',
      })

      // Set resource-specific cache
      await setCache(adapter, {
        sourceText: 'flat',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'דירה',
        provider: 'openai',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      // Without resource info, should get hash-based
      const hashResult = await getCached(adapter, {
        text: 'flat',
        to: 'he',
      })
      expect(hashResult?.text).toBe('שטוח')

      // With resource info, should get resource-specific
      const resourceResult = await getCached(adapter, {
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })
      expect(resourceResult?.text).toBe('דירה')
    })

    it('should fall back to hash cache when resource-specific not found', async () => {
      await setCache(adapter, {
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        provider: 'openai',
      })

      const result = await getCached(adapter, {
        text: 'Hello',
        to: 'he',
        resourceType: 'property',
        resourceId: '999',
        field: 'title',
      })

      expect(result?.text).toBe('שלום')
    })
  })

  describe('setCache', () => {
    it('should store hash-based cache for simple text', async () => {
      await setCache(adapter, {
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        translatedText: 'مرحبا',
        provider: 'openai',
        model: 'gpt-4o-mini',
      })

      const result = await getCached(adapter, { text: 'Hello', to: 'ar' })
      expect(result?.text).toBe('مرحبا')
    })

    it('should store resource-specific cache when resource info provided', async () => {
      await setCache(adapter, {
        sourceText: 'flat',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'דירה',
        provider: 'openai',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      const result = await getCached(adapter, {
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })
      expect(result?.text).toBe('דירה')
    })
  })

  describe('setManualTranslation', () => {
    it('should create manual override entry', async () => {
      await setManualTranslation(adapter, {
        text: 'flat',
        translatedText: 'דירה',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      const result = await getCached(adapter, {
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      expect(result?.text).toBe('דירה')
      expect(result?.isManualOverride).toBe(true)
    })
  })

  describe('clearManualTranslation', () => {
    it('should remove manual override entry', async () => {
      await setManualTranslation(adapter, {
        text: 'flat',
        translatedText: 'דירה',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      await clearManualTranslation(adapter, {
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
        to: 'he',
      })

      const result = await getCached(adapter, {
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      expect(result).toBeNull()
    })
  })

  describe('getCachedBatch', () => {
    it('should return empty map for empty items array', async () => {
      const result = await getCachedBatch(adapter, [], 'he')
      expect(result.size).toBe(0)
    })

    it('should return empty map when no items are cached', async () => {
      const result = await getCachedBatch(
        adapter,
        [{ text: 'Hello' }, { text: 'World' }],
        'he'
      )
      expect(result.size).toBe(0)
    })

    it('should retrieve multiple cached translations in single call', async () => {
      await setCache(adapter, {
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        provider: 'openai',
      })

      await setCache(adapter, {
        sourceText: 'World',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'עולם',
        provider: 'openai',
      })

      await setCache(adapter, {
        sourceText: 'Test',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'בדיקה',
        provider: 'openai',
      })

      const result = await getCachedBatch(
        adapter,
        [{ text: 'Hello' }, { text: 'World' }, { text: 'Test' }],
        'he'
      )

      expect(result.size).toBe(3)
      expect(result.get(0)?.text).toBe('שלום')
      expect(result.get(1)?.text).toBe('עולם')
      expect(result.get(2)?.text).toBe('בדיקה')
    })

    it('should return only cached items with correct indices', async () => {
      await setCache(adapter, {
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        provider: 'openai',
      })

      const result = await getCachedBatch(
        adapter,
        [{ text: 'Hello' }, { text: 'NotCached' }, { text: 'AlsoNotCached' }],
        'he'
      )

      expect(result.size).toBe(1)
      expect(result.get(0)?.text).toBe('שלום')
      expect(result.has(1)).toBe(false)
      expect(result.has(2)).toBe(false)
    })

    it('should prioritize resource-specific cache over hash cache', async () => {
      // Set hash-based cache
      await setCache(adapter, {
        sourceText: 'flat',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שטוח',
        provider: 'openai',
      })

      // Set resource-specific cache with same text
      await setCache(adapter, {
        sourceText: 'flat',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'דירה',
        provider: 'openai',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      const result = await getCachedBatch(
        adapter,
        [
          { text: 'flat' }, // Should get hash-based
          { text: 'flat', resourceType: 'property', resourceId: '123', field: 'type' }, // Should get resource-specific
        ],
        'he'
      )

      expect(result.size).toBe(2)
      expect(result.get(0)?.text).toBe('שטוח')
      expect(result.get(1)?.text).toBe('דירה')
    })

    it('should fall back to hash cache when resource cache misses', async () => {
      await setCache(adapter, {
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        provider: 'openai',
      })

      const result = await getCachedBatch(
        adapter,
        [
          { text: 'Hello', resourceType: 'property', resourceId: '999', field: 'title' },
        ],
        'he'
      )

      expect(result.size).toBe(1)
      expect(result.get(0)?.text).toBe('שלום')
      expect(result.get(0)?.isManualOverride).toBe(false)
    })

    it('should return isManualOverride flag correctly', async () => {
      await setManualTranslation(adapter, {
        text: 'flat',
        translatedText: 'דירה',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      await setCache(adapter, {
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        provider: 'openai',
      })

      const result = await getCachedBatch(
        adapter,
        [
          { text: 'flat', resourceType: 'property', resourceId: '123', field: 'type' },
          { text: 'Hello' },
        ],
        'he'
      )

      expect(result.size).toBe(2)
      expect(result.get(0)?.isManualOverride).toBe(true)
      expect(result.get(1)?.isManualOverride).toBe(false)
    })

    it('should handle duplicate texts at different indices', async () => {
      await setCache(adapter, {
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        provider: 'openai',
      })

      const result = await getCachedBatch(
        adapter,
        [{ text: 'Hello' }, { text: 'Hello' }, { text: 'Hello' }],
        'he'
      )

      expect(result.size).toBe(3)
      expect(result.get(0)?.text).toBe('שלום')
      expect(result.get(1)?.text).toBe('שלום')
      expect(result.get(2)?.text).toBe('שלום')
    })
  })

  describe('setCacheBatch', () => {
    it('should do nothing for empty items array', async () => {
      await setCacheBatch(adapter, [])
      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(0)
    })

    it('should store multiple translations in single call', async () => {
      await setCacheBatch(adapter, [
        {
          sourceText: 'Hello',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'שלום',
          provider: 'openai',
        },
        {
          sourceText: 'World',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'עולם',
          provider: 'openai',
        },
        {
          sourceText: 'Test',
          sourceLanguage: 'en',
          targetLanguage: 'ar',
          translatedText: 'اختبار',
          provider: 'openai',
        },
      ])

      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(3)
      expect(stats.byLanguage.he).toBe(2)
      expect(stats.byLanguage.ar).toBe(1)

      const result1 = await getCached(adapter, { text: 'Hello', to: 'he' })
      expect(result1?.text).toBe('שלום')

      const result2 = await getCached(adapter, { text: 'World', to: 'he' })
      expect(result2?.text).toBe('עולם')

      const result3 = await getCached(adapter, { text: 'Test', to: 'ar' })
      expect(result3?.text).toBe('اختبار')
    })

    it('should store with resource keys when resource info provided', async () => {
      await setCacheBatch(adapter, [
        {
          sourceText: 'flat',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'דירה',
          provider: 'openai',
          resourceType: 'property',
          resourceId: '123',
          field: 'type',
        },
        {
          sourceText: 'luxury',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'יוקרה',
          provider: 'openai',
          resourceType: 'property',
          resourceId: '123',
          field: 'category',
        },
      ])

      const result1 = await getCached(adapter, {
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })
      expect(result1?.text).toBe('דירה')

      const result2 = await getCached(adapter, {
        text: 'luxury',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'category',
      })
      expect(result2?.text).toBe('יוקרה')
    })

    it('should store with hash keys when no resource info', async () => {
      await setCacheBatch(adapter, [
        {
          sourceText: 'Hello',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'שלום',
          provider: 'openai',
        },
      ])

      // Should be retrievable without resource info
      const result = await getCached(adapter, { text: 'Hello', to: 'he' })
      expect(result?.text).toBe('שלום')
    })

    it('should set isManualOverride to false for all entries', async () => {
      await setCacheBatch(adapter, [
        {
          sourceText: 'Hello',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'שלום',
          provider: 'openai',
        },
      ])

      const result = await getCached(adapter, { text: 'Hello', to: 'he' })
      expect(result?.isManualOverride).toBe(false)
    })

    it('should handle mixed hash and resource entries', async () => {
      await setCacheBatch(adapter, [
        {
          sourceText: 'Hello',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'שלום',
          provider: 'openai',
          // No resource info - hash key
        },
        {
          sourceText: 'flat',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'דירה',
          provider: 'openai',
          resourceType: 'property',
          resourceId: '123',
          field: 'type',
          // Has resource info - resource key
        },
      ])

      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(2)

      const hashResult = await getCached(adapter, { text: 'Hello', to: 'he' })
      expect(hashResult?.text).toBe('שלום')

      const resourceResult = await getCached(adapter, {
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })
      expect(resourceResult?.text).toBe('דירה')
    })
  })
})
