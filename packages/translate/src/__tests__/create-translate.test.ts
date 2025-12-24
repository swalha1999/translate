import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTranslate } from '../create-translate'
import { createMemoryAdapter } from '../adapters/memory'
import type { LanguageModel } from 'ai'

// Mock the AI SDK provider
vi.mock('../providers/ai-sdk', () => ({
  translateWithAI: vi.fn().mockImplementation(async ({ text, to, from }) => ({
    text: `[translated to ${to}]: ${text}`,
    from: from ?? 'en',
  })),
  detectLanguageWithAI: vi.fn().mockImplementation(async () => ({
    language: 'en',
    confidence: 0.95,
  })),
}))

vi.mock('../providers/types', () => ({
  getModelInfo: vi.fn(() => ({ provider: 'openai', modelId: 'gpt-4o-mini' })),
}))

// Create a mock model
const mockModel = {
  modelId: 'gpt-4o-mini',
  provider: 'openai',
} as unknown as LanguageModel

describe('createTranslate', () => {
  let translate: ReturnType<typeof createTranslate>

  beforeEach(() => {
    translate = createTranslate({
      adapter: createMemoryAdapter(),
      model: mockModel,
      languages: ['en', 'ar', 'he', 'ru'] as const,
    })
  })

  describe('text()', () => {
    it('should translate text', async () => {
      const result = await translate.text({
        text: 'Hello',
        to: 'he',
      })

      expect(result.text).toBe('[translated to he]: Hello')
      expect(result.to).toBe('he')
      expect(result.cached).toBe(false)
    })

    it('should return cached translation on second call', async () => {
      await translate.text({ text: 'Hello', to: 'he' })
      const result = await translate.text({ text: 'Hello', to: 'he' })

      expect(result.cached).toBe(true)
    })

    it('should return empty text as-is', async () => {
      const result = await translate.text({ text: '', to: 'he' })
      expect(result.text).toBe('')
      expect(result.cached).toBe(true)
    })

    it('should return whitespace-only text as-is', async () => {
      const result = await translate.text({ text: '   ', to: 'he' })
      expect(result.text).toBe('   ')
      expect(result.cached).toBe(true)
    })
  })

  describe('batch()', () => {
    it('should translate multiple texts', async () => {
      const results = await translate.batch({
        texts: ['Hello', 'World'],
        to: 'ar',
      })

      expect(results).toHaveLength(2)
      expect(results[0].text).toBe('[translated to ar]: Hello')
      expect(results[1].text).toBe('[translated to ar]: World')
    })

    it('should handle empty array', async () => {
      const results = await translate.batch({
        texts: [],
        to: 'ar',
      })

      expect(results).toEqual([])
    })
  })

  describe('setManual()', () => {
    it('should set manual translation', async () => {
      await translate.setManual({
        text: 'flat',
        translatedText: 'דירה',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      const result = await translate.text({
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      expect(result.text).toBe('דירה')
      expect(result.isManualOverride).toBe(true)
    })
  })

  describe('clearManual()', () => {
    it('should clear manual translation', async () => {
      await translate.setManual({
        text: 'flat',
        translatedText: 'דירה',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      await translate.clearManual({
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
        to: 'he',
      })

      // After clearing, it should call the API again
      const result = await translate.text({
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      expect(result.isManualOverride).toBeUndefined()
    })
  })

  describe('detectLanguage()', () => {
    it('should detect language', async () => {
      const result = await translate.detectLanguage('Hello world')

      expect(result.language).toBe('en')
      expect(result.confidence).toBe(0.95)
    })
  })

  describe('clearCache()', () => {
    it('should clear all cache', async () => {
      await translate.text({ text: 'Hello', to: 'he' })
      await translate.text({ text: 'World', to: 'ar' })

      const count = await translate.clearCache()
      expect(count).toBe(2)

      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(0)
    })

    it('should clear cache for specific language', async () => {
      await translate.text({ text: 'Hello', to: 'he' })
      await translate.text({ text: 'World', to: 'ar' })

      const count = await translate.clearCache('he')
      expect(count).toBe(1)

      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(1)
    })
  })

  describe('clearResourceCache()', () => {
    it('should clear cache for specific resource', async () => {
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

      const count = await translate.clearResourceCache('property', '123')
      expect(count).toBe(2)
    })
  })

  describe('getCacheStats()', () => {
    it('should return cache statistics', async () => {
      await translate.text({ text: 'Hello', to: 'he' })
      await translate.text({ text: 'World', to: 'he' })
      await translate.text({ text: 'Test', to: 'ar' })

      const stats = await translate.getCacheStats()

      expect(stats.totalEntries).toBe(3)
      expect(stats.byLanguage.he).toBe(2)
      expect(stats.byLanguage.ar).toBe(1)
    })
  })

  describe('isRTL()', () => {
    it('should return true for RTL languages', () => {
      expect(translate.isRTL('ar')).toBe(true)
      expect(translate.isRTL('he')).toBe(true)
    })

    it('should return false for LTR languages', () => {
      expect(translate.isRTL('en')).toBe(false)
      expect(translate.isRTL('ru')).toBe(false)
    })
  })

  describe('languages', () => {
    it('should expose configured languages', () => {
      expect(translate.languages).toEqual(['en', 'ar', 'he', 'ru'])
    })
  })
})
