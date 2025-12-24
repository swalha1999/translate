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

    it('should respect manual overrides in objects array translation', async () => {
      await translate.setManual({
        text: 'Call mom',
        translatedText: 'התקשר לאמא שלך',
        to: 'he',
        resourceType: 'todo',
        resourceId: '2',
        field: 'title',
      })

      const todos = [
        { id: '1', title: 'Buy groceries' },
        { id: '2', title: 'Call mom' },
      ]

      const translated = await translate.objects(todos, {
        fields: ['title'],
        to: 'he',
        resourceType: 'todo',
        resourceIdField: 'id',
      })

      expect(translated[0].title).toBe('לקנות מצרכים')
      expect(translated[1].title).toBe('התקשר לאמא שלך') // Manual override
    })
  })

  describe('Object Translation Caching', () => {
    it('should cache object translations and reuse on second call', async () => {
      const todo = { id: '1', title: 'Buy groceries', description: 'Milk and eggs' }

      // First call
      await translate.object(todo, {
        fields: ['title', 'description'],
        to: 'he',
      })

      const stats1 = await translate.getCacheStats()
      expect(stats1.totalEntries).toBe(2)

      // Second call - should use cache
      const translated = await translate.object(todo, {
        fields: ['title', 'description'],
        to: 'he',
      })

      expect(translated.title).toBe('לקנות מצרכים')
      expect(translated.description).toBe('חלב וביצים')

      // Cache should not grow
      const stats2 = await translate.getCacheStats()
      expect(stats2.totalEntries).toBe(2)
    })

    it('should cache objects array translations', async () => {
      const todos = [
        { id: '1', title: 'Buy groceries' },
        { id: '2', title: 'Call mom' },
      ]

      await translate.objects(todos, { fields: ['title'], to: 'he' })
      const stats1 = await translate.getCacheStats()
      expect(stats1.totalEntries).toBe(2)

      // Second call
      await translate.objects(todos, { fields: ['title'], to: 'he' })
      const stats2 = await translate.getCacheStats()
      expect(stats2.totalEntries).toBe(2) // No new entries
    })

    it('should create separate cache entries for different languages', async () => {
      const todo = { id: '1', title: 'Buy groceries' }

      await translate.object(todo, { fields: ['title'], to: 'he' })
      await translate.object(todo, { fields: ['title'], to: 'ar' })

      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(2)
      expect(stats.byLanguage.he).toBe(1)
      expect(stats.byLanguage.ar).toBe(1)
    })

    it('should clear resource cache and require re-translation', async () => {
      const todo = { id: '123', title: 'Fix the bug' }

      await translate.object(todo, {
        fields: ['title'],
        to: 'he',
        resourceType: 'todo',
        resourceIdField: 'id',
      })

      const stats1 = await translate.getCacheStats()
      expect(stats1.totalEntries).toBe(1)

      // Clear resource cache
      await translate.clearResourceCache('todo', '123')

      const stats2 = await translate.getCacheStats()
      expect(stats2.totalEntries).toBe(0)
    })
  })

  describe('Object Translation with Context', () => {
    it('should pass context to translation', async () => {
      const todo = { id: '1', title: 'Hello', description: 'World' }

      const translated = await translate.object(todo, {
        fields: ['title', 'description'],
        to: 'he',
        context: 'greeting in a chat app',
      })

      expect(translated.title).toBe('שלום')
      expect(translated.description).toBe('עולם')
    })

    it('should pass context in objects array translation', async () => {
      const todos = [
        { id: '1', title: 'Hello' },
        { id: '2', title: 'Goodbye' },
      ]

      const translated = await translate.objects(todos, {
        fields: ['title'],
        to: 'ar',
        context: 'greetings',
      })

      expect(translated[0].title).toBe('مرحبا')
      expect(translated[1].title).toBe('وداعا')
    })
  })

  describe('Object Translation with Source Language', () => {
    it('should use explicit source language', async () => {
      const todo = { id: '1', title: 'Hello' }

      const translated = await translate.object(todo, {
        fields: ['title'],
        to: 'he',
        from: 'en',
      })

      expect(translated.title).toBe('שלום')
    })

    it('should use explicit source language in array', async () => {
      const todos = [
        { id: '1', title: 'Hello' },
        { id: '2', title: 'World' },
      ]

      const translated = await translate.objects(todos, {
        fields: ['title'],
        to: 'ar',
        from: 'en',
      })

      expect(translated[0].title).toBe('مرحبا')
      expect(translated[1].title).toBe('عالم')
    })
  })

  describe('Object Translation Preserves Non-String Fields', () => {
    it('should preserve numbers, booleans, and other types', async () => {
      const todo = {
        id: '1',
        title: 'Buy groceries',
        priority: 5,
        done: false,
        createdAt: new Date('2024-01-01'),
        tags: ['shopping', 'food'],
        metadata: { urgent: true },
      }

      const translated = await translate.object(todo, {
        fields: ['title'],
        to: 'he',
      })

      expect(translated.title).toBe('לקנות מצרכים')
      expect(translated.priority).toBe(5)
      expect(translated.done).toBe(false)
      expect(translated.createdAt).toEqual(new Date('2024-01-01'))
      expect(translated.tags).toEqual(['shopping', 'food'])
      expect(translated.metadata).toEqual({ urgent: true })
    })

    it('should preserve non-string fields in array', async () => {
      const todos = [
        { id: '1', title: 'Hello', count: 10, active: true },
        { id: '2', title: 'World', count: 20, active: false },
      ]

      const translated = await translate.objects(todos, {
        fields: ['title'],
        to: 'he',
      })

      expect(translated[0].count).toBe(10)
      expect(translated[0].active).toBe(true)
      expect(translated[1].count).toBe(20)
      expect(translated[1].active).toBe(false)
    })
  })

  describe('Object Translation with Numeric IDs', () => {
    it('should handle numeric resourceIdField', async () => {
      const todo = {
        id: 123,
        title: 'Buy groceries',
      }

      const translated = await translate.object(todo, {
        fields: ['title'],
        to: 'he',
        resourceType: 'todo',
        resourceIdField: 'id',
      })

      expect(translated.title).toBe('לקנות מצרכים')

      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(1)
    })

    it('should handle numeric IDs in array', async () => {
      const todos = [
        { id: 1, title: 'Buy groceries' },
        { id: 2, title: 'Call mom' },
      ]

      const translated = await translate.objects(todos, {
        fields: ['title'],
        to: 'he',
        resourceType: 'todo',
        resourceIdField: 'id',
      })

      expect(translated[0].title).toBe('לקנות מצרכים')
      expect(translated[1].title).toBe('להתקשר לאמא')
    })
  })

  describe('Object Translation Concurrent Requests', () => {
    it('should handle concurrent object translations', async () => {
      const todo = { id: '1', title: 'Hello', description: 'World' }

      const [heResult, arResult] = await Promise.all([
        translate.object(todo, { fields: ['title', 'description'], to: 'he' }),
        translate.object(todo, { fields: ['title', 'description'], to: 'ar' }),
      ])

      expect(heResult.title).toBe('שלום')
      expect(heResult.description).toBe('עולם')
      expect(arResult.title).toBe('مرحبا')
      expect(arResult.description).toBe('عالم')
    })

    it('should handle concurrent objects array translations', async () => {
      const todos = [
        { id: '1', title: 'Hello' },
        { id: '2', title: 'Goodbye' },
      ]

      const [heResult, arResult] = await Promise.all([
        translate.objects(todos, { fields: ['title'], to: 'he' }),
        translate.objects(todos, { fields: ['title'], to: 'ar' }),
      ])

      expect(heResult[0].title).toBe('שלום')
      expect(heResult[1].title).toBe('להתראות')
      expect(arResult[0].title).toBe('مرحبا')
      expect(arResult[1].title).toBe('وداعا')
    })
  })

  describe('Object Translation Edge Cases', () => {
    it('should handle object with only one field', async () => {
      const todo = { id: '1', title: 'Hello' }

      const translated = await translate.object(todo, {
        fields: ['title'],
        to: 'he',
      })

      expect(translated.title).toBe('שלום')
    })

    it('should handle translating subset of available string fields', async () => {
      const todo = {
        id: '1',
        title: 'Hello',
        description: 'World',
        notes: 'Goodbye',
      }

      const translated = await translate.object(todo, {
        fields: ['title'], // Only translate title
        to: 'he',
      })

      expect(translated.title).toBe('שלום')
      expect(translated.description).toBe('World') // Unchanged
      expect(translated.notes).toBe('Goodbye') // Unchanged
    })

    it('should handle whitespace-only strings as empty', async () => {
      const todo = { id: '1', title: '   ', description: '\t\n' }

      const translated = await translate.object(todo, {
        fields: ['title', 'description'],
        to: 'he',
      })

      // Should return original since nothing to translate
      expect(translated.title).toBe('   ')
      expect(translated.description).toBe('\t\n')
    })

    it('should handle very long text', async () => {
      const longText = 'Hello '.repeat(100).trim()
      const todo = { id: '1', title: longText }

      const translated = await translate.object(todo, {
        fields: ['title'],
        to: 'he',
      })

      // Mock returns [he] prefix for unknown texts
      expect(translated.title).toBe(`[he] ${longText}`)
    })

    it('should handle special characters in text', async () => {
      const todo = { id: '1', title: 'Hello! @#$%^&*()' }

      const translated = await translate.object(todo, {
        fields: ['title'],
        to: 'he',
      })

      expect(translated.title).toBe('[he] Hello! @#$%^&*()')
    })

    it('should handle unicode in source text', async () => {
      const todo = { id: '1', title: 'Hello 你好 مرحبا' }

      const translated = await translate.object(todo, {
        fields: ['title'],
        to: 'he',
      })

      expect(translated.title).toBe('[he] Hello 你好 مرحبا')
    })
  })

  describe('Object Translation Large Arrays', () => {
    it('should handle large arrays efficiently', async () => {
      const todos = Array.from({ length: 50 }, (_, i) => ({
        id: String(i + 1),
        title: i % 2 === 0 ? 'Hello' : 'World',
      }))

      const translated = await translate.objects(todos, {
        fields: ['title'],
        to: 'he',
      })

      expect(translated.length).toBe(50)
      expect(translated[0].title).toBe('שלום')
      expect(translated[1].title).toBe('עולם')
      expect(translated[48].title).toBe('שלום')
      expect(translated[49].title).toBe('עולם')
    })

    it('should handle array with many fields per object', async () => {
      const items = [
        {
          id: '1',
          field1: 'Hello',
          field2: 'World',
          field3: 'Goodbye',
          field4: 'Hello',
          field5: 'World',
        },
      ]

      const translated = await translate.objects(items, {
        fields: ['field1', 'field2', 'field3', 'field4', 'field5'],
        to: 'he',
      })

      expect(translated[0].field1).toBe('שלום')
      expect(translated[0].field2).toBe('עולם')
      expect(translated[0].field3).toBe('להתראות')
      expect(translated[0].field4).toBe('שלום')
      expect(translated[0].field5).toBe('עולם')
    })
  })

  describe('Object Translation Both Languages Sequential', () => {
    it('should translate same object to Hebrew then Arabic', async () => {
      const todo = { id: '1', title: 'Hello', description: 'World' }

      const heTranslated = await translate.object(todo, {
        fields: ['title', 'description'],
        to: 'he',
      })

      const arTranslated = await translate.object(todo, {
        fields: ['title', 'description'],
        to: 'ar',
      })

      expect(heTranslated.title).toBe('שלום')
      expect(heTranslated.description).toBe('עולם')
      expect(arTranslated.title).toBe('مرحبا')
      expect(arTranslated.description).toBe('عالم')
    })

    it('should translate array to Hebrew then Arabic', async () => {
      const todos = [
        { id: '1', title: 'Hello' },
        { id: '2', title: 'Goodbye' },
      ]

      const heTranslated = await translate.objects(todos, {
        fields: ['title'],
        to: 'he',
      })

      const arTranslated = await translate.objects(todos, {
        fields: ['title'],
        to: 'ar',
      })

      expect(heTranslated[0].title).toBe('שלום')
      expect(heTranslated[1].title).toBe('להתראות')
      expect(arTranslated[0].title).toBe('مرحبا')
      expect(arTranslated[1].title).toBe('وداعا')

      // Should have 4 cache entries (2 texts × 2 languages)
      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(4)
    })
  })

  describe('Object Translation Does Not Mutate Original', () => {
    it('should not mutate original object', async () => {
      const original = { id: '1', title: 'Hello', description: 'World' }
      const originalCopy = { ...original }

      await translate.object(original, {
        fields: ['title', 'description'],
        to: 'he',
      })

      expect(original).toEqual(originalCopy)
    })

    it('should not mutate original array', async () => {
      const original = [
        { id: '1', title: 'Hello' },
        { id: '2', title: 'World' },
      ]
      const originalCopy = original.map(o => ({ ...o }))

      await translate.objects(original, {
        fields: ['title'],
        to: 'he',
      })

      expect(original).toEqual(originalCopy)
    })
  })
})
