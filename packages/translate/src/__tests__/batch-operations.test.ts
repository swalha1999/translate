import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateBatch, translateObject, translateObjects } from '../core'
import { getCachedBatch, setCacheBatch } from '../cache'
import { createMemoryAdapter } from '../adapters/memory'
import type { CacheAdapter, CacheEntry } from '../adapters/types'
import type { TranslateConfig } from '../create-translate'
import type { LanguageModel } from 'ai'

// Mock the AI SDK provider
vi.mock('../providers/ai-sdk', () => ({
  translateWithAI: vi.fn(),
  detectLanguageWithAI: vi.fn(),
}))

vi.mock('../providers/types', () => ({
  getModelInfo: vi.fn(() => ({ provider: 'openai', modelId: 'gpt-4o-mini' })),
}))

import { translateWithAI } from '../providers/ai-sdk'

const mockModel = {
  modelId: 'gpt-4o-mini',
  provider: 'openai',
} as unknown as LanguageModel

describe('Batch Operations', () => {
  let adapter: CacheAdapter
  let config: TranslateConfig

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = createMemoryAdapter()
    config = {
      adapter,
      model: mockModel,
      languages: ['en', 'ar', 'he', 'ru'] as const,
    }

    vi.mocked(translateWithAI).mockImplementation(async ({ text, to }) => ({
      text: `[${to}] ${text}`,
      from: 'en',
    }))
  })

  describe('Adapter getMany/setMany operations', () => {
    describe('getMany edge cases', () => {
      it('should handle very large batch lookups', async () => {
        // Create 1000 entries
        const entries = Array.from({ length: 1000 }, (_, i) => ({
          id: `key-${i}`,
          sourceText: `Text ${i}`,
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: `תרגום ${i}`,
          isManualOverride: false,
          provider: 'openai',
        }))

        await adapter.setMany(entries)

        // Lookup all 1000 entries in a single batch
        const keys = entries.map(e => e.id)
        const result = await adapter.getMany(keys)

        expect(result.size).toBe(1000)
        expect(result.get('key-0')?.translatedText).toBe('תרגום 0')
        expect(result.get('key-999')?.translatedText).toBe('תרגום 999')
      })

      it('should handle mixed existing and non-existing keys in large batch', async () => {
        // Create 50 entries
        const entries = Array.from({ length: 50 }, (_, i) => ({
          id: `exists-${i}`,
          sourceText: `Text ${i}`,
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: `תרגום ${i}`,
          isManualOverride: false,
          provider: 'openai',
        }))

        await adapter.setMany(entries)

        // Lookup with mix of existing and non-existing keys
        const keys = [
          ...Array.from({ length: 50 }, (_, i) => `exists-${i}`),
          ...Array.from({ length: 50 }, (_, i) => `missing-${i}`),
        ]

        const result = await adapter.getMany(keys)

        expect(result.size).toBe(50)
        for (let i = 0; i < 50; i++) {
          expect(result.has(`exists-${i}`)).toBe(true)
          expect(result.has(`missing-${i}`)).toBe(false)
        }
      })

      it('should return entries with all required fields', async () => {
        await adapter.set({
          id: 'full-entry',
          sourceText: 'Hello',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'שלום',
          isManualOverride: true,
          provider: 'openai',
          model: 'gpt-4o-mini',
          resourceType: 'property',
          resourceId: '123',
          field: 'title',
        })

        const result = await adapter.getMany(['full-entry'])
        const entry = result.get('full-entry')

        expect(entry).toBeDefined()
        expect(entry?.sourceText).toBe('Hello')
        expect(entry?.sourceLanguage).toBe('en')
        expect(entry?.targetLanguage).toBe('he')
        expect(entry?.translatedText).toBe('שלום')
        expect(entry?.isManualOverride).toBe(true)
        expect(entry?.provider).toBe('openai')
        expect(entry?.resourceType).toBe('property')
        expect(entry?.resourceId).toBe('123')
        expect(entry?.field).toBe('title')
        expect(entry?.createdAt).toBeInstanceOf(Date)
        expect(entry?.updatedAt).toBeInstanceOf(Date)
        expect(entry?.lastUsedAt).toBeInstanceOf(Date)
      })
    })

    describe('setMany edge cases', () => {
      it('should handle very large batch writes', async () => {
        const entries = Array.from({ length: 1000 }, (_, i) => ({
          id: `bulk-${i}`,
          sourceText: `Text ${i}`,
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: `תרגום ${i}`,
          isManualOverride: false,
          provider: 'openai',
        }))

        await adapter.setMany(entries)

        const stats = await adapter.getStats()
        expect(stats.totalEntries).toBe(1000)
      })

      it('should handle entries with different languages', async () => {
        const entries = [
          { id: 'lang-he', sourceText: 'Hello', sourceLanguage: 'en', targetLanguage: 'he', translatedText: 'שלום', isManualOverride: false, provider: 'openai' },
          { id: 'lang-ar', sourceText: 'Hello', sourceLanguage: 'en', targetLanguage: 'ar', translatedText: 'مرحبا', isManualOverride: false, provider: 'openai' },
          { id: 'lang-ru', sourceText: 'Hello', sourceLanguage: 'en', targetLanguage: 'ru', translatedText: 'Привет', isManualOverride: false, provider: 'openai' },
          { id: 'lang-ja', sourceText: 'Hello', sourceLanguage: 'en', targetLanguage: 'ja', translatedText: 'こんにちは', isManualOverride: false, provider: 'openai' },
        ]

        await adapter.setMany(entries)

        const stats = await adapter.getStats()
        expect(stats.totalEntries).toBe(4)
        expect(stats.byLanguage.he).toBe(1)
        expect(stats.byLanguage.ar).toBe(1)
        expect(stats.byLanguage.ru).toBe(1)
        expect(stats.byLanguage.ja).toBe(1)
      })

      it('should handle concurrent setMany calls', async () => {
        const batch1 = Array.from({ length: 100 }, (_, i) => ({
          id: `concurrent-a-${i}`,
          sourceText: `Text A ${i}`,
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: `תרגום A ${i}`,
          isManualOverride: false,
          provider: 'openai',
        }))

        const batch2 = Array.from({ length: 100 }, (_, i) => ({
          id: `concurrent-b-${i}`,
          sourceText: `Text B ${i}`,
          sourceLanguage: 'en',
          targetLanguage: 'ar',
          translatedText: `ترجمة B ${i}`,
          isManualOverride: false,
          provider: 'openai',
        }))

        await Promise.all([
          adapter.setMany(batch1),
          adapter.setMany(batch2),
        ])

        const stats = await adapter.getStats()
        expect(stats.totalEntries).toBe(200)
      })

      it('should overwrite existing entries with same ids', async () => {
        const original = [
          { id: 'overwrite-1', sourceText: 'Hello', sourceLanguage: 'en', targetLanguage: 'he', translatedText: 'שלום', isManualOverride: false, provider: 'openai' },
          { id: 'overwrite-2', sourceText: 'World', sourceLanguage: 'en', targetLanguage: 'he', translatedText: 'עולם', isManualOverride: false, provider: 'openai' },
        ]

        await adapter.setMany(original)

        const updated = [
          { id: 'overwrite-1', sourceText: 'Hi', sourceLanguage: 'en', targetLanguage: 'he', translatedText: 'היי', isManualOverride: false, provider: 'openai' },
          { id: 'overwrite-2', sourceText: 'Earth', sourceLanguage: 'en', targetLanguage: 'he', translatedText: 'כדור הארץ', isManualOverride: false, provider: 'openai' },
        ]

        await adapter.setMany(updated)

        const result = await adapter.getMany(['overwrite-1', 'overwrite-2'])
        expect(result.get('overwrite-1')?.translatedText).toBe('היי')
        expect(result.get('overwrite-2')?.translatedText).toBe('כדור הארץ')

        const stats = await adapter.getStats()
        expect(stats.totalEntries).toBe(2)
      })

      it('should handle entries with optional fields', async () => {
        const entries = [
          { id: 'minimal', sourceText: 'Hello', sourceLanguage: 'en', targetLanguage: 'he', translatedText: 'שלום', isManualOverride: false, provider: 'openai' },
          { id: 'with-model', sourceText: 'World', sourceLanguage: 'en', targetLanguage: 'he', translatedText: 'עולם', isManualOverride: false, provider: 'openai', model: 'gpt-4o' },
          { id: 'with-resource', sourceText: 'Test', sourceLanguage: 'en', targetLanguage: 'he', translatedText: 'בדיקה', isManualOverride: false, provider: 'openai', resourceType: 'item', resourceId: '456', field: 'name' },
        ]

        await adapter.setMany(entries)

        const result = await adapter.getMany(['minimal', 'with-model', 'with-resource'])

        expect(result.get('minimal')?.model).toBeUndefined()
        expect(result.get('with-model')?.model).toBe('gpt-4o')
        expect(result.get('with-resource')?.resourceType).toBe('item')
      })
    })
  })

  describe('getCachedBatch advanced scenarios', () => {
    it('should handle items with same text but different resource info', async () => {
      // Cache with resource info for property 123
      await adapter.set({
        id: 'res:property:123:title:he',
        sourceText: 'Modern Apartment',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'דירה מודרנית',
        resourceType: 'property',
        resourceId: '123',
        field: 'title',
        isManualOverride: false,
        provider: 'openai',
      })

      // Cache with resource info for property 456
      await adapter.set({
        id: 'res:property:456:title:he',
        sourceText: 'Modern Apartment',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'דירה עכשווית',
        resourceType: 'property',
        resourceId: '456',
        field: 'title',
        isManualOverride: false,
        provider: 'openai',
      })

      const result = await getCachedBatch(
        adapter,
        [
          { text: 'Modern Apartment', resourceType: 'property', resourceId: '123', field: 'title' },
          { text: 'Modern Apartment', resourceType: 'property', resourceId: '456', field: 'title' },
        ],
        'he'
      )

      expect(result.size).toBe(2)
      expect(result.get(0)?.text).toBe('דירה מודרנית')
      expect(result.get(1)?.text).toBe('דירה עכשווית')
    })

    it('should return resource cache for matching resource, hash cache for non-matching', async () => {
      // Set hash cache
      await adapter.set({
        id: 'hash:abc123:he',
        sourceText: 'Luxury Villa',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'וילה יוקרתית (hash)',
        isManualOverride: false,
        provider: 'openai',
      })

      // Set resource cache
      await adapter.set({
        id: 'res:property:789:title:he',
        sourceText: 'Luxury Villa',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'וילה יוקרתית (resource)',
        resourceType: 'property',
        resourceId: '789',
        field: 'title',
        isManualOverride: true,
        provider: 'manual',
      })

      // Need to use the actual hash key
      const { createHashKey } = await import('../cache-key')
      const hashKey = createHashKey('Luxury Villa', 'he')
      await adapter.set({
        id: hashKey,
        sourceText: 'Luxury Villa',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'וילה יוקרתית (hash)',
        isManualOverride: false,
        provider: 'openai',
      })

      const result = await getCachedBatch(
        adapter,
        [
          { text: 'Luxury Villa' }, // Should use hash cache
          { text: 'Luxury Villa', resourceType: 'property', resourceId: '789', field: 'title' }, // Should use resource cache
          { text: 'Luxury Villa', resourceType: 'property', resourceId: '999', field: 'title' }, // Should fall back to hash cache
        ],
        'he'
      )

      expect(result.size).toBe(3)
      expect(result.get(0)?.text).toBe('וילה יוקרתית (hash)')
      expect(result.get(0)?.isManualOverride).toBe(false)
      expect(result.get(1)?.text).toBe('וילה יוקרתית (resource)')
      expect(result.get(1)?.isManualOverride).toBe(true)
      expect(result.get(2)?.text).toBe('וילה יוקרתית (hash)')
      expect(result.get(2)?.isManualOverride).toBe(false)
    })

    it('should handle batch with all items having resource info', async () => {
      await adapter.set({
        id: 'res:product:1:name:ar',
        sourceText: 'Widget',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        translatedText: 'أداة',
        resourceType: 'product',
        resourceId: '1',
        field: 'name',
        isManualOverride: false,
        provider: 'openai',
      })

      await adapter.set({
        id: 'res:product:1:desc:ar',
        sourceText: 'A useful widget',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        translatedText: 'أداة مفيدة',
        resourceType: 'product',
        resourceId: '1',
        field: 'desc',
        isManualOverride: false,
        provider: 'openai',
      })

      const result = await getCachedBatch(
        adapter,
        [
          { text: 'Widget', resourceType: 'product', resourceId: '1', field: 'name' },
          { text: 'A useful widget', resourceType: 'product', resourceId: '1', field: 'desc' },
        ],
        'ar'
      )

      expect(result.size).toBe(2)
      expect(result.get(0)?.text).toBe('أداة')
      expect(result.get(1)?.text).toBe('أداة مفيدة')
    })

    it('should handle batch with interleaved cached and uncached items', async () => {
      const { createHashKey } = await import('../cache-key')

      // Cache items at indices 1, 3, 5
      for (const idx of [1, 3, 5]) {
        const hashKey = createHashKey(`Text ${idx}`, 'he')
        await adapter.set({
          id: hashKey,
          sourceText: `Text ${idx}`,
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: `תרגום ${idx}`,
          isManualOverride: false,
          provider: 'openai',
        })
      }

      const items = Array.from({ length: 7 }, (_, i) => ({ text: `Text ${i}` }))
      const result = await getCachedBatch(adapter, items, 'he')

      expect(result.size).toBe(3)
      expect(result.has(0)).toBe(false)
      expect(result.get(1)?.text).toBe('תרגום 1')
      expect(result.has(2)).toBe(false)
      expect(result.get(3)?.text).toBe('תרגום 3')
      expect(result.has(4)).toBe(false)
      expect(result.get(5)?.text).toBe('תרגום 5')
      expect(result.has(6)).toBe(false)
    })
  })

  describe('setCacheBatch advanced scenarios', () => {
    it('should create correct keys for mixed hash and resource entries', async () => {
      await setCacheBatch(adapter, [
        { sourceText: 'Hash Only', sourceLanguage: 'en', targetLanguage: 'he', translatedText: 'רק האש', provider: 'openai' },
        { sourceText: 'With Resource', sourceLanguage: 'en', targetLanguage: 'he', translatedText: 'עם משאב', provider: 'openai', resourceType: 'item', resourceId: '100', field: 'title' },
      ])

      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(2)

      // Verify hash entry can be retrieved by hash lookup
      const { getCached } = await import('../cache')
      const hashResult = await getCached(adapter, { text: 'Hash Only', to: 'he' })
      expect(hashResult?.text).toBe('רק האש')

      // Verify resource entry can be retrieved by resource lookup
      const resourceResult = await getCached(adapter, {
        text: 'With Resource',
        to: 'he',
        resourceType: 'item',
        resourceId: '100',
        field: 'title',
      })
      expect(resourceResult?.text).toBe('עם משאב')
    })

    it('should handle batch with duplicate texts going to same hash key', async () => {
      await setCacheBatch(adapter, [
        { sourceText: 'Duplicate', sourceLanguage: 'en', targetLanguage: 'he', translatedText: 'כפול 1', provider: 'openai' },
        { sourceText: 'Duplicate', sourceLanguage: 'en', targetLanguage: 'he', translatedText: 'כפול 2', provider: 'openai' },
      ])

      // The second one should overwrite the first (same hash key)
      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(1)

      const { getCached } = await import('../cache')
      const result = await getCached(adapter, { text: 'Duplicate', to: 'he' })
      expect(result?.text).toBe('כפול 2')
    })
  })

  describe('translateBatch integration with batch cache', () => {
    it('should use batch cache lookup and batch cache write', async () => {
      const getManyspy = vi.spyOn(adapter, 'getMany')
      const setManySpy = vi.spyOn(adapter, 'setMany')

      await translateBatch(adapter, config, {
        texts: ['Hello', 'World', 'Test'],
        to: 'he',
      })

      // Should make batch lookups (at least one getMany call)
      expect(getManyspy).toHaveBeenCalled()

      // Wait for fire-and-forget cache write
      await new Promise(resolve => setTimeout(resolve, 10))

      // Should use setMany for batch write
      expect(setManySpy).toHaveBeenCalled()
    })

    it('should not make duplicate API calls for same text at different positions', async () => {
      const results = await translateBatch(adapter, config, {
        texts: ['A', 'B', 'A', 'C', 'A', 'B', 'C'],
        to: 'he',
      })

      expect(results).toHaveLength(7)
      // Only 3 unique texts (A, B, C)
      expect(translateWithAI).toHaveBeenCalledTimes(3)

      // Verify all results are correct
      expect(results[0].text).toBe('[he] A')
      expect(results[1].text).toBe('[he] B')
      expect(results[2].text).toBe('[he] A')
      expect(results[3].text).toBe('[he] C')
      expect(results[4].text).toBe('[he] A')
      expect(results[5].text).toBe('[he] B')
      expect(results[6].text).toBe('[he] C')
    })

    it('should handle empty strings in batch without API calls', async () => {
      const results = await translateBatch(adapter, config, {
        texts: ['Hello', '', '  ', '\t\n', 'World'],
        to: 'he',
      })

      expect(results).toHaveLength(5)
      expect(results[0].text).toBe('[he] Hello')
      expect(results[1].text).toBe('')
      expect(results[2].text).toBe('  ')
      expect(results[3].text).toBe('\t\n')
      expect(results[4].text).toBe('[he] World')

      // Only 2 non-empty unique texts
      expect(translateWithAI).toHaveBeenCalledTimes(2)
    })

    it('should return cached results with cached=true flag', async () => {
      // First batch to populate cache
      await translateBatch(adapter, config, {
        texts: ['Cached Text'],
        to: 'he',
      })
      vi.mocked(translateWithAI).mockClear()

      // Second batch should use cache
      const results = await translateBatch(adapter, config, {
        texts: ['Cached Text', 'Cached Text'],
        to: 'he',
      })

      expect(translateWithAI).not.toHaveBeenCalled()
      expect(results[0].cached).toBe(true)
      expect(results[1].cached).toBe(true)
    })

    it('should handle from === to by returning original text without API calls', async () => {
      const results = await translateBatch(adapter, config, {
        texts: ['Hello', 'World'],
        to: 'en',
        from: 'en',
      })

      expect(translateWithAI).not.toHaveBeenCalled()
      expect(results[0].text).toBe('Hello')
      expect(results[1].text).toBe('World')
      expect(results[0].cached).toBe(true)
      expect(results[1].cached).toBe(true)
    })

    it('should not cache when source === target language detected', async () => {
      vi.mocked(translateWithAI).mockResolvedValueOnce({
        text: 'Hello',
        from: 'he', // Same as target
      })

      await translateBatch(adapter, config, {
        texts: ['Hello'],
        to: 'he',
      })

      // Wait for fire-and-forget
      await new Promise(resolve => setTimeout(resolve, 10))

      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(0)
    })
  })

  describe('translateObject batch cache integration', () => {
    it('should use batch cache lookup for multiple fields', async () => {
      const getManyspy = vi.spyOn(adapter, 'getMany')

      const item = {
        id: '1',
        title: 'Hello',
        description: 'World',
        notes: 'Test',
      }

      await translateObject(adapter, config, item, {
        fields: ['title', 'description', 'notes'],
        to: 'he',
      })

      // Should use batch lookup
      expect(getManyspy).toHaveBeenCalled()
    })

    it('should translate only uncached fields', async () => {
      // Pre-cache one field
      const { setCache } = await import('../cache')
      await setCache(adapter, {
        sourceText: 'Cached Title',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'כותרת במטמון',
        provider: 'openai',
        resourceType: 'item',
        resourceId: '1',
        field: 'title',
      })

      const item = {
        id: '1',
        title: 'Cached Title',
        description: 'Uncached Description',
      }

      const result = await translateObject(adapter, config, item, {
        fields: ['title', 'description'],
        to: 'he',
        resourceType: 'item',
        resourceIdField: 'id',
      })

      // Only description should have been translated via API
      expect(translateWithAI).toHaveBeenCalledTimes(1)
      expect(translateWithAI).toHaveBeenCalledWith(
        expect.objectContaining({ text: 'Uncached Description' })
      )
      expect(result.title).toBe('כותרת במטמון')
    })

    it('should handle object with all fields cached', async () => {
      const { setCache } = await import('../cache')
      await setCache(adapter, {
        sourceText: 'Title',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'כותרת',
        provider: 'openai',
        resourceType: 'item',
        resourceId: '2',
        field: 'title',
      })
      await setCache(adapter, {
        sourceText: 'Description',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'תיאור',
        provider: 'openai',
        resourceType: 'item',
        resourceId: '2',
        field: 'description',
      })

      const item = { id: '2', title: 'Title', description: 'Description' }

      const result = await translateObject(adapter, config, item, {
        fields: ['title', 'description'],
        to: 'he',
        resourceType: 'item',
        resourceIdField: 'id',
      })

      expect(translateWithAI).not.toHaveBeenCalled()
      expect(result.title).toBe('כותרת')
      expect(result.description).toBe('תיאור')
    })
  })

  describe('translateObjects batch cache integration', () => {
    it('should use batch cache lookup for all items and fields', async () => {
      const getManyspy = vi.spyOn(adapter, 'getMany')

      const items = [
        { id: '1', title: 'Hello', description: 'World' },
        { id: '2', title: 'Foo', description: 'Bar' },
      ]

      await translateObjects(adapter, config, items, {
        fields: ['title', 'description'],
        to: 'he',
      })

      // Should use batch lookup
      expect(getManyspy).toHaveBeenCalled()
    })

    it('should deduplicate same text across different objects', async () => {
      const items = [
        { id: '1', title: 'Same Title', description: 'Desc 1' },
        { id: '2', title: 'Same Title', description: 'Desc 2' },
        { id: '3', title: 'Same Title', description: 'Desc 3' },
      ]

      // Without resource info, same text should be deduplicated
      const results = await translateObjects(adapter, config, items, {
        fields: ['title', 'description'],
        to: 'he',
      })

      expect(results).toHaveLength(3)
      // 'Same Title' should only be translated once, plus 3 unique descriptions
      expect(translateWithAI).toHaveBeenCalledTimes(4)
    })

    it('should use resource-specific cache when resourceType is provided', async () => {
      const { setCache } = await import('../cache')

      // Cache translation for item 1
      await setCache(adapter, {
        sourceText: 'Special Title',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'כותרת מיוחדת',
        provider: 'openai',
        resourceType: 'product',
        resourceId: '1',
        field: 'title',
      })

      const items = [
        { id: '1', title: 'Special Title' },
        { id: '2', title: 'Special Title' },
      ]

      const results = await translateObjects(adapter, config, items, {
        fields: ['title'],
        to: 'he',
        resourceType: 'product',
        resourceIdField: 'id',
      })

      // Item 1 should use cached translation
      expect(results[0].title).toBe('כותרת מיוחדת')
      // Item 2 should be translated via API (different resource ID)
      expect(results[1].title).toBe('[he] Special Title')
    })

    it('should handle empty array', async () => {
      const results = await translateObjects(adapter, config, [], {
        fields: ['title'],
        to: 'he',
      })

      expect(results).toEqual([])
      expect(translateWithAI).not.toHaveBeenCalled()
    })

    it('should handle objects with no translatable fields', async () => {
      const items = [
        { id: '1', count: 10, active: true },
        { id: '2', count: 20, active: false },
      ]

      const results = await translateObjects(adapter, config, items as any, {
        fields: ['title', 'description'] as any,
        to: 'he',
      })

      expect(results).toEqual(items)
      expect(translateWithAI).not.toHaveBeenCalled()
    })
  })

  describe('Error handling in batch operations', () => {
    it('should propagate adapter.getMany errors', async () => {
      const failingAdapter: CacheAdapter = {
        ...adapter,
        async getMany() {
          throw new Error('getMany failed')
        },
      }

      await expect(
        getCachedBatch(failingAdapter, [{ text: 'Hello' }], 'he')
      ).rejects.toThrow('getMany failed')
    })

    it('should handle partial failures in translateBatch gracefully', async () => {
      vi.mocked(translateWithAI)
        .mockResolvedValueOnce({ text: 'שלום', from: 'en' })
        .mockRejectedValueOnce(new Error('API error'))
        .mockResolvedValueOnce({ text: 'בדיקה', from: 'en' })

      await expect(
        translateBatch(adapter, config, {
          texts: ['Hello', 'World', 'Test'],
          to: 'he',
        })
      ).rejects.toThrow('API error')
    })

    it('should continue on setMany failure (fire-and-forget)', async () => {
      const failingAdapter: CacheAdapter = {
        ...adapter,
        async setMany() {
          throw new Error('setMany failed')
        },
        async getMany() {
          return new Map()
        },
      }

      // Should not throw despite setMany failing
      const results = await translateBatch(failingAdapter, config, {
        texts: ['Hello'],
        to: 'he',
      })

      expect(results).toHaveLength(1)
      expect(results[0].text).toBe('[he] Hello')
    })
  })

  describe('Analytics events in batch operations', () => {
    it('should emit cache_hit events for cached items in batch', async () => {
      const analyticsCallback = vi.fn()
      const configWithAnalytics = { ...config, onAnalytics: analyticsCallback }

      // First call to cache
      await translateBatch(adapter, configWithAnalytics, {
        texts: ['Analytics Test'],
        to: 'he',
      })

      analyticsCallback.mockClear()

      // Second call should emit cache_hit
      await translateBatch(adapter, configWithAnalytics, {
        texts: ['Analytics Test'],
        to: 'he',
      })

      expect(analyticsCallback).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'cache_hit',
          text: 'Analytics Test',
        })
      )
    })

    it('should emit translation events for uncached items in batch', async () => {
      const analyticsCallback = vi.fn()
      const configWithAnalytics = { ...config, onAnalytics: analyticsCallback }

      await translateBatch(adapter, configWithAnalytics, {
        texts: ['New Text 1', 'New Text 2'],
        to: 'he',
      })

      const translationEvents = analyticsCallback.mock.calls.filter(
        call => call[0].type === 'translation'
      )

      expect(translationEvents).toHaveLength(2)
    })
  })
})
