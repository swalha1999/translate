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
        'Buy groceries': 'לקנות מצרכים',
        'Milk and eggs': 'חלב וביצים',
        'Call mom': 'להתקשר לאמא',
        'Wish her happy birthday': 'לאחל לה יום הולדת שמח',
        'Fix the bug': 'לתקן את הבאג',
        'In the login page': 'בדף ההתחברות',
      },
      ar: {
        'Hello': 'مرحبا',
        'World': 'عالم',
        'Goodbye': 'وداعا',
        'Luxury apartment': 'شقة فاخرة',
        'flat': 'شقة',
        'Buy groceries': 'شراء البقالة',
        'Milk and eggs': 'حليب وبيض',
        'Call mom': 'اتصل بأمي',
        'Wish her happy birthday': 'تمنى لها عيد ميلاد سعيد',
        'Fix the bug': 'إصلاح الخطأ',
        'In the login page': 'في صفحة تسجيل الدخول',
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
      expect(typeof translate.object).toBe('function')
      expect(typeof translate.objects).toBe('function')
    })
  })

  describe('Object Translation Workflow', () => {
    it('should translate single object fields to Hebrew', async () => {
      const todo = {
        id: '1',
        title: 'Buy groceries',
        description: 'Milk and eggs',
        done: false,
      }

      const translated = await translate.object(todo, {
        fields: ['title', 'description'],
        to: 'he',
      })

      expect(translated.id).toBe('1')
      expect(translated.title).toBe('לקנות מצרכים')
      expect(translated.description).toBe('חלב וביצים')
      expect(translated.done).toBe(false)
    })

    it('should translate single object fields to Arabic', async () => {
      const todo = {
        id: '1',
        title: 'Buy groceries',
        description: 'Milk and eggs',
        done: false,
      }

      const translated = await translate.object(todo, {
        fields: ['title', 'description'],
        to: 'ar',
      })

      expect(translated.id).toBe('1')
      expect(translated.title).toBe('شراء البقالة')
      expect(translated.description).toBe('حليب وبيض')
      expect(translated.done).toBe(false)
    })

    it('should translate object with resource caching', async () => {
      const todo = {
        id: '123',
        title: 'Fix the bug',
        description: 'In the login page',
      }

      const translated = await translate.object(todo, {
        fields: ['title', 'description'],
        to: 'he',
        resourceType: 'todo',
        resourceIdField: 'id',
      })

      expect(translated.title).toBe('לתקן את הבאג')
      expect(translated.description).toBe('בדף ההתחברות')

      // Verify resource-based cache was created
      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(2)
    })

    it('should skip null/undefined fields', async () => {
      const todo = {
        id: '1',
        title: 'Buy groceries',
        description: null as string | null,
      }

      const translated = await translate.object(todo, {
        fields: ['title', 'description'],
        to: 'he',
      })

      expect(translated.title).toBe('לקנות מצרכים')
      expect(translated.description).toBeNull()
    })

    it('should return original object if no fields to translate', async () => {
      const todo = {
        id: '1',
        title: '',
        description: '   ',
      }

      const translated = await translate.object(todo, {
        fields: ['title', 'description'],
        to: 'he',
      })

      expect(translated).toEqual(todo)
    })
  })

  describe('Objects Array Translation Workflow', () => {
    it('should translate array of objects to Hebrew', async () => {
      const todos = [
        { id: '1', title: 'Buy groceries', description: 'Milk and eggs' },
        { id: '2', title: 'Call mom', description: 'Wish her happy birthday' },
      ]

      const translated = await translate.objects(todos, {
        fields: ['title', 'description'],
        to: 'he',
      })

      expect(translated[0].id).toBe('1')
      expect(translated[0].title).toBe('לקנות מצרכים')
      expect(translated[0].description).toBe('חלב וביצים')

      expect(translated[1].id).toBe('2')
      expect(translated[1].title).toBe('להתקשר לאמא')
      expect(translated[1].description).toBe('לאחל לה יום הולדת שמח')
    })

    it('should translate array of objects to Arabic', async () => {
      const todos = [
        { id: '1', title: 'Buy groceries', description: 'Milk and eggs' },
        { id: '2', title: 'Call mom', description: 'Wish her happy birthday' },
      ]

      const translated = await translate.objects(todos, {
        fields: ['title', 'description'],
        to: 'ar',
      })

      expect(translated[0].title).toBe('شراء البقالة')
      expect(translated[0].description).toBe('حليب وبيض')

      expect(translated[1].title).toBe('اتصل بأمي')
      expect(translated[1].description).toBe('تمنى لها عيد ميلاد سعيد')
    })

    it('should translate array with resource caching', async () => {
      const todos = [
        { id: '1', title: 'Buy groceries', description: 'Milk and eggs' },
        { id: '2', title: 'Call mom', description: 'Wish her happy birthday' },
      ]

      const translated = await translate.objects(todos, {
        fields: ['title', 'description'],
        to: 'he',
        resourceType: 'todo',
        resourceIdField: 'id',
      })

      expect(translated[0].title).toBe('לקנות מצרכים')
      expect(translated[1].title).toBe('להתקשר לאמא')

      // Each item has 2 fields = 4 cache entries
      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(4)
    })

    it('should handle mixed null/undefined fields in array', async () => {
      const todos = [
        { id: '1', title: 'Buy groceries', description: null as string | null },
        { id: '2', title: 'Call mom', description: 'Wish her happy birthday' },
      ]

      const translated = await translate.objects(todos, {
        fields: ['title', 'description'],
        to: 'he',
      })

      expect(translated[0].title).toBe('לקנות מצרכים')
      expect(translated[0].description).toBeNull()

      expect(translated[1].title).toBe('להתקשר לאמא')
      expect(translated[1].description).toBe('לאחל לה יום הולדת שמח')
    })

    it('should return original array if empty', async () => {
      const todos: { id: string; title: string }[] = []

      const translated = await translate.objects(todos, {
        fields: ['title'],
        to: 'he',
      })

      expect(translated).toEqual([])
    })

    it('should return original array if no texts to translate', async () => {
      const todos = [
        { id: '1', title: '', description: '' },
        { id: '2', title: '   ', description: null as string | null },
      ]

      const translated = await translate.objects(todos, {
        fields: ['title', 'description'],
        to: 'he',
      })

      expect(translated).toEqual(todos)
    })
  })

  describe('Object Translation with Manual Overrides', () => {
    it('should respect manual overrides in object translation', async () => {
      // Set manual override first
      await translate.setManual({
        text: 'Buy groceries',
        translatedText: 'קניות בסופר',
        to: 'he',
        resourceType: 'todo',
        resourceId: '1',
        field: 'title',
      })

      const todo = {
        id: '1',
        title: 'Buy groceries',
        description: 'Milk and eggs',
      }

      const translated = await translate.object(todo, {
        fields: ['title', 'description'],
        to: 'he',
        resourceType: 'todo',
        resourceIdField: 'id',
      })

      // Should use manual override for title
      expect(translated.title).toBe('קניות בסופר')
      // Should use AI translation for description
      expect(translated.description).toBe('חלב וביצים')
    })
  })
})
