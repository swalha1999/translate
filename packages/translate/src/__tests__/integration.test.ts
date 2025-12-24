import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTranslate, createMemoryAdapter } from '../index'
import type { CacheAdapter } from '../adapters/types'
import type { LanguageModel } from 'ai'

// Mock the AI SDK provider
vi.mock('../providers/ai-sdk', () => ({
  translateWithAI: vi.fn().mockImplementation(async ({ text, to, from }) => {
    // Simulate realistic translations
    const translations: Record<string, Record<string, string>> = {
      he: {
        'Hello': 'שלום',
        'World': 'עולם',
        'Goodbye': 'להתראות',
        'Luxury apartment': 'דירת יוקרה',
        'flat': 'דירה',
      },
      ar: {
        'Hello': 'مرحبا',
        'World': 'عالم',
        'Goodbye': 'وداعا',
        'Luxury apartment': 'شقة فاخرة',
        'flat': 'شقة',
      },
    }

    const translated = translations[to]?.[text] ?? `[${to}] ${text}`
    return { text: translated, from: from ?? 'en' }
  }),
  detectLanguageWithAI: vi.fn().mockImplementation(async ({ text }) => {
    // Simple language detection based on character ranges
    if (/[\u0590-\u05FF]/.test(text)) return { language: 'he', confidence: 0.95 }
    if (/[\u0600-\u06FF]/.test(text)) return { language: 'ar', confidence: 0.95 }
    if (/[\u0400-\u04FF]/.test(text)) return { language: 'ru', confidence: 0.95 }
    return { language: 'en', confidence: 0.95 }
  }),
}))

vi.mock('../providers/types', () => ({
  getModelInfo: vi.fn(() => ({ provider: 'openai', modelId: 'gpt-4o-mini' })),
}))

// Create a mock model
const mockModel = {
  modelId: 'gpt-4o-mini',
  provider: 'openai',
} as unknown as LanguageModel

describe('Integration Tests', () => {
  let translate: ReturnType<typeof createTranslate>
  let adapter: CacheAdapter

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = createMemoryAdapter()
    translate = createTranslate({
      adapter,
      model: mockModel,
      languages: ['en', 'ar', 'he', 'ru'] as const,
    })
  })

  describe('Complete Translation Workflow', () => {
    it('should translate, cache, and retrieve', async () => {
      // First translation
      const result1 = await translate.text({ text: 'Hello', to: 'he' })
      expect(result1.text).toBe('שלום')
      expect(result1.cached).toBe(false)

      // Second request should hit cache
      const result2 = await translate.text({ text: 'Hello', to: 'he' })
      expect(result2.text).toBe('שלום')
      expect(result2.cached).toBe(true)

      // Verify cache stats
      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(1)
      expect(stats.byLanguage.he).toBe(1)
    })

    it('should handle multiple languages correctly', async () => {
      const heResult = await translate.text({ text: 'Hello', to: 'he' })
      const arResult = await translate.text({ text: 'Hello', to: 'ar' })

      expect(heResult.text).toBe('שלום')
      expect(arResult.text).toBe('مرحبا')

      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(2)
      expect(stats.byLanguage.he).toBe(1)
      expect(stats.byLanguage.ar).toBe(1)
    })

    it('should batch translate efficiently', async () => {
      const results = await translate.batch({
        texts: ['Hello', 'World', 'Goodbye'],
        to: 'he',
      })

      expect(results[0].text).toBe('שלום')
      expect(results[1].text).toBe('עולם')
      expect(results[2].text).toBe('להתראות')

      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(3)
    })
  })

  describe('Manual Override Workflow', () => {
    it('should use manual override over AI translation', async () => {
      // First, get AI translation
      const aiResult = await translate.text({
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })
      expect(aiResult.text).toBe('דירה')
      expect(aiResult.isManualOverride).toBeUndefined()

      // Set manual override with different translation
      await translate.setManual({
        text: 'flat',
        translatedText: 'דירה קטנה',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      // Now should get manual override
      const manualResult = await translate.text({
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })
      expect(manualResult.text).toBe('דירה קטנה')
      expect(manualResult.isManualOverride).toBe(true)

      // Clear the override
      await translate.clearManual({
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
        to: 'he',
      })

      // Should fall back to hash-based cache (from first AI call)
      const afterClear = await translate.text({
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })
      expect(afterClear.isManualOverride).toBeFalsy()
    })

    it('should not affect other resources', async () => {
      await translate.setManual({
        text: 'flat',
        translatedText: 'דירה מיוחדת',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      // Different resource should get AI translation
      const otherResult = await translate.text({
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '456',
        field: 'type',
      })

      expect(otherResult.text).toBe('דירה')
      expect(otherResult.isManualOverride).toBeUndefined()
    })
  })

  describe('Cache Management Workflow', () => {
    it('should clear cache by language', async () => {
      await translate.text({ text: 'Hello', to: 'he' })
      await translate.text({ text: 'Hello', to: 'ar' })

      let stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(2)

      await translate.clearCache('he')

      stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(1)
      expect(stats.byLanguage.ar).toBe(1)
      expect(stats.byLanguage.he).toBeUndefined()
    })

    it('should clear all cache', async () => {
      await translate.text({ text: 'Hello', to: 'he' })
      await translate.text({ text: 'World', to: 'ar' })

      await translate.clearCache()

      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(0)
    })

    it('should clear resource cache', async () => {
      await translate.text({
        text: 'Hello',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'title',
      })
      await translate.text({
        text: 'World',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'description',
      })
      await translate.text({
        text: 'Test',
        to: 'he',
        resourceType: 'property',
        resourceId: '456',
        field: 'title',
      })

      const deleted = await translate.clearResourceCache('property', '123')
      expect(deleted).toBe(2)

      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(1)
    })
  })

  describe('Language Detection Workflow', () => {
    it('should detect Hebrew text', async () => {
      const result = await translate.detectLanguage('שלום עולם')
      expect(result.language).toBe('he')
    })

    it('should detect Arabic text', async () => {
      const result = await translate.detectLanguage('مرحبا بالعالم')
      expect(result.language).toBe('ar')
    })

    it('should detect English text', async () => {
      const result = await translate.detectLanguage('Hello World')
      expect(result.language).toBe('en')
    })
  })

  describe('RTL Support Workflow', () => {
    it('should correctly identify RTL languages', () => {
      expect(translate.isRTL('ar')).toBe(true)
      expect(translate.isRTL('he')).toBe(true)
      expect(translate.isRTL('en')).toBe(false)
      expect(translate.isRTL('ru')).toBe(false)
    })
  })

  describe('Real Estate Use Case', () => {
    it('should translate property listing', async () => {
      const property = {
        title: 'Luxury apartment',
        description: 'Beautiful apartment in city center',
      }

      const [titleResult, descResult] = await translate.batch({
        texts: [property.title, property.description],
        to: 'he',
        context: 'real estate listing',
      })

      expect(titleResult.text).toBe('דירת יוקרה')
      expect(descResult.text).toBeDefined()
    })

    it('should handle ambiguous terms with context', async () => {
      // "flat" in real estate context
      const result = await translate.text({
        text: 'flat',
        to: 'he',
        context: 'real estate property type',
        resourceType: 'property',
        resourceId: '123',
        field: 'propertyType',
      })

      expect(result.text).toBe('דירה')
    })
  })

  describe('Concurrent Requests', () => {
    it('should handle concurrent translations correctly', async () => {
      const promises = [
        translate.text({ text: 'Hello', to: 'he' }),
        translate.text({ text: 'World', to: 'he' }),
        translate.text({ text: 'Hello', to: 'ar' }),
        translate.text({ text: 'World', to: 'ar' }),
      ]

      const results = await Promise.all(promises)

      expect(results[0].text).toBe('שלום')
      expect(results[1].text).toBe('עולם')
      expect(results[2].text).toBe('مرحبا')
      expect(results[3].text).toBe('عالم')
    })

    it('should coalesce identical concurrent requests', async () => {
      const promises = Array(10).fill(null).map(() =>
        translate.text({ text: 'Hello', to: 'he' })
      )

      const results = await Promise.all(promises)

      // All should return same result
      results.forEach(result => {
        expect(result.text).toBe('שלום')
      })
    })
  })

  describe('Export Verification', () => {
    it('should export createTranslate', () => {
      expect(typeof createTranslate).toBe('function')
    })

    it('should export createMemoryAdapter', () => {
      expect(typeof createMemoryAdapter).toBe('function')
    })

    it('should expose languages on translate instance', () => {
      expect(translate.languages).toEqual(['en', 'ar', 'he', 'ru'])
    })

    it('should expose all expected methods', () => {
      expect(typeof translate.text).toBe('function')
      expect(typeof translate.batch).toBe('function')
      expect(typeof translate.setManual).toBe('function')
      expect(typeof translate.clearManual).toBe('function')
      expect(typeof translate.detectLanguage).toBe('function')
      expect(typeof translate.clearCache).toBe('function')
      expect(typeof translate.clearResourceCache).toBe('function')
      expect(typeof translate.getCacheStats).toBe('function')
      expect(typeof translate.isRTL).toBe('function')
    })
  })
})
