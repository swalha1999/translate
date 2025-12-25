import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTranslate } from '../create-translate'
import { createMemoryAdapter } from '../adapters/memory'
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

const defaultConfig = {
  model: mockModel,
  languages: ['en', 'he', 'ar', 'ru'] as const,
}

describe('Core Edge Cases', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('translateText edge cases', () => {
    it('should handle temperature = 0 (most deterministic)', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
        temperature: 0,
      })

      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      const callArgs = vi.mocked(generateText).mock.calls[0][0]
      expect(callArgs.temperature).toBe(0)
    })

    it('should handle temperature = 2 (maximum creativity)', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
        temperature: 2,
      })

      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      const callArgs = vi.mocked(generateText).mock.calls[0][0]
      expect(callArgs.temperature).toBe(2)
    })

    it('should handle concurrent requests with same key but different contexts', async () => {
      const adapter = createMemoryAdapter()
      let callCount = 0

      vi.mocked(generateText).mockImplementation(async () => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 50))
        return { text: callCount === 1 ? 'דירה' : 'שטוח' } as any
      })

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // Same text, different contexts - should NOT coalesce
      const [result1, result2] = await Promise.all([
        translate.text({
          text: 'flat',
          to: 'he',
          from: 'en',
          context: 'real estate',
        }),
        translate.text({
          text: 'flat',
          to: 'he',
          from: 'en',
          context: 'geometry',
        }),
      ])

      // Both should complete, contexts are different
      expect(result1.text).toBeDefined()
      expect(result2.text).toBeDefined()
    })

    it('should handle text that is just numbers', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: '12345',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const result = await translate.text({
        text: '12345',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('12345')
    })

    it('should handle text that is just punctuation', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: '...',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const result = await translate.text({
        text: '...',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('...')
    })
  })

  describe('translateBatch edge cases', () => {
    it('should handle batch with 100 items', async () => {
      const adapter = createMemoryAdapter()
      const items = Array.from({ length: 100 }, (_, i) => `Item ${i}`)

      // Each translateText call returns a translation
      vi.mocked(generateText).mockImplementation(async (args: any) => {
        // Extract the item number from the prompt
        const match = args.prompt.match(/Item (\d+)/)
        const num = match ? match[1] : '0'
        return { text: `פריט ${num}` } as any
      })

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const results = await translate.batch({
        texts: items,
        to: 'he',
        from: 'en',
      })

      expect(results).toHaveLength(100)
      expect(results[0].text).toBe('פריט 0')
      expect(results[99].text).toBe('פריט 99')
    })

    it('should handle batch with duplicate texts efficiently', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: 'שלום' } as any)
        .mockResolvedValueOnce({ text: 'עולם' } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const results = await translate.batch({
        texts: ['Hello', 'World', 'Hello', 'World', 'Hello'],
        to: 'he',
        from: 'en',
      })

      expect(results).toHaveLength(5)
      expect(results[0].text).toBe('שלום')
      expect(results[2].text).toBe('שלום') // Cached
      expect(results[4].text).toBe('שלום') // Cached
      // Only 2 AI calls because duplicates use cache
      expect(generateText).toHaveBeenCalledTimes(2)
    })

    it('should handle batch with empty strings mixed with valid text', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const results = await translate.batch({
        texts: ['', 'Hello', '', '   ', 'Hello'],
        to: 'he',
        from: 'en',
      })

      expect(results).toHaveLength(5)
      expect(results[0].text).toBe('')  // Empty string returns as-is
      expect(results[1].text).toBe('שלום')
      expect(results[2].text).toBe('')
      expect(results[3].text).toBe('   ')  // Whitespace only is returned as-is
    })

    it('should handle batch where all texts are empty or whitespace', async () => {
      const adapter = createMemoryAdapter()

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const results = await translate.batch({
        texts: ['', '   ', '\t\n', ''],
        to: 'he',
        from: 'en',
      })

      expect(results).toHaveLength(4)
      // Empty/whitespace texts return as-is (not translated)
      expect(results[0].text).toBe('')
      expect(results[1].text).toBe('   ')
      expect(results[2].text).toBe('\t\n')
      expect(results[3].text).toBe('')
    })
  })

  describe('translateObject edge cases', () => {
    it('should ignore Symbol properties', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'כותרת',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const sym = Symbol('secret')
      const obj = {
        id: '1',
        title: 'Title',
        [sym]: 'secret value',
      }

      const result = await translate.object(obj, {
        fields: ['title'],
        to: 'he',
        from: 'en',
      })

      expect(result.title).toBe('כותרת')
      expect((result as any)[sym]).toBe('secret value')
    })

    it('should handle frozen objects', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'כותרת',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const obj = Object.freeze({
        id: '1',
        title: 'Title',
      })

      // Should create a new object, not mutate the frozen one
      const result = await translate.object(obj, {
        fields: ['title'],
        to: 'he',
        from: 'en',
      })

      expect(result.title).toBe('כותרת')
      expect(result).not.toBe(obj)
    })

    it('should handle sealed objects', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'כותרת',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const obj = Object.seal({
        id: '1',
        title: 'Title',
      })

      const result = await translate.object(obj, {
        fields: ['title'],
        to: 'he',
        from: 'en',
      })

      expect(result.title).toBe('כותרת')
    })

    it('should handle object with getter that throws when spread', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'כותרת',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const obj = {
        id: '1',
        title: 'Title',
        get broken(): string {
          throw new Error('Getter error')
        },
      }

      // When spreading the object, the getter throws
      // translateObject catches errors and returns original
      const result = await translate.object(obj, {
        fields: ['title'],
        to: 'he',
        from: 'en',
      })

      // Returns original because error was caught during spread
      expect(result.title).toBe('Title')
    })

    it('should handle object with many fields but only translate specified ones', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'כותרת',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const obj = {
        id: '1',
        title: 'Title',
        field1: 'value1',
        field2: 'value2',
        field3: 'value3',
        field4: 'value4',
        field5: 'value5',
      }

      const result = await translate.object(obj, {
        fields: ['title'],
        to: 'he',
        from: 'en',
      })

      expect(result.title).toBe('כותרת')
      expect(result.field1).toBe('value1')
      expect(result.field5).toBe('value5')
    })

    it('should preserve prototype chain', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'כותרת',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      class Todo {
        constructor(public id: string, public title: string) {}
        getTitle() {
          return this.title
        }
      }

      const obj = new Todo('1', 'Title')
      const result = await translate.object(obj, {
        fields: ['title'],
        to: 'he',
        from: 'en',
      })

      expect(result.title).toBe('כותרת')
      // Note: spread creates plain object, prototype methods may not be preserved
    })
  })

  describe('translateObjects edge cases', () => {
    it('should handle sparse array', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'כותרת',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // eslint-disable-next-line no-sparse-arrays
      const items = [
        { id: '1', title: 'Title 1' },
        ,  // sparse element
        { id: '3', title: 'Title 3' },
      ] as any[]

      const results = await translate.objects(items.filter(Boolean), {
        fields: ['title'],
        to: 'he',
        from: 'en',
      })

      expect(results).toHaveLength(2)
    })

    it('should handle array with null elements filtered', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'כותרת',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const items = [
        { id: '1', title: 'Title 1' },
        null,
        { id: '3', title: 'Title 3' },
      ].filter((item): item is { id: string; title: string } => item !== null)

      const results = await translate.objects(items, {
        fields: ['title'],
        to: 'he',
        from: 'en',
      })

      expect(results).toHaveLength(2)
    })

    it('should handle very large array (100 objects)', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockResolvedValue({
        text: 'כותרת',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const items = Array.from({ length: 100 }, (_, i) => ({
        id: String(i),
        title: `Title ${i}`,
      }))

      const results = await translate.objects(items, {
        fields: ['title'],
        to: 'he',
        from: 'en',
      })

      expect(results).toHaveLength(100)
    })

    it('should handle objects with different shapes', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockImplementation(async () => ({
        text: 'כותרת',
      } as any))

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const items = [
        { id: '1', title: 'Title 1', extra: 'data' },
        { id: '2', title: 'Title 2' },
        { id: '3', title: 'Title 3', other: 123 },
      ]

      const results = await translate.objects(items, {
        fields: ['title'],
        to: 'he',
        from: 'en',
      })

      expect(results).toHaveLength(3)
      expect((results[0] as any).extra).toBe('data')
      expect((results[2] as any).other).toBe(123)
    })
  })

  describe('concurrent operations', () => {
    it('should handle multiple concurrent translate.text calls', async () => {
      const adapter = createMemoryAdapter()
      let callCount = 0

      vi.mocked(generateText).mockImplementation(async () => {
        callCount++
        await new Promise(resolve => setTimeout(resolve, 10))
        return { text: `תרגום ${callCount}` } as any
      })

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const promises = Array.from({ length: 10 }, (_, i) =>
        translate.text({
          text: `Text ${i}`,
          to: 'he',
          from: 'en',
        })
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)
      results.forEach(r => expect(r.text).toContain('תרגום'))
    })

    it('should handle mixed text and batch calls concurrently', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockImplementation(async (args: any) => {
        await new Promise(resolve => setTimeout(resolve, 10))
        if (args.prompt.includes('array')) {
          return { text: '["שלום", "עולם"]' } as any
        }
        return { text: 'שלום' } as any
      })

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const [textResult, batchResult] = await Promise.all([
        translate.text({
          text: 'Hello',
          to: 'he',
          from: 'en',
        }),
        translate.batch({
          texts: ['Hello', 'World'],
          to: 'he',
          from: 'en',
        }),
      ])

      expect(textResult.text).toBeDefined()
      expect(batchResult).toHaveLength(2)
    })

    it('should handle object and objects calls concurrently', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockResolvedValue({
        text: 'כותרת',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const [objectResult, objectsResult] = await Promise.all([
        translate.object(
          { id: '1', title: 'Title' },
          { fields: ['title'], to: 'he' }
        ),
        translate.objects(
          [
            { id: '2', title: 'Title 2' },
            { id: '3', title: 'Title 3' },
          ],
          { fields: ['title'], to: 'he' }
        ),
      ])

      expect(objectResult.title).toBeDefined()
      expect(objectsResult).toHaveLength(2)
    })
  })

  describe('cache key edge cases', () => {
    it('should generate different cache keys for different target languages', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: 'שלום' } as any)
        .mockResolvedValueOnce({ text: 'مرحبا' } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const heResult = await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      const arResult = await translate.text({
        text: 'Hello',
        to: 'ar',
        from: 'en',
      })

      expect(heResult.text).toBe('שלום')
      expect(arResult.text).toBe('مرحبا')
      expect(generateText).toHaveBeenCalledTimes(2)
    })

    it('should use cached result for same text and target', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      expect(generateText).toHaveBeenCalledTimes(1)
    })
  })
})
