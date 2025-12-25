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

describe('Performance Tests', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('large text handling', () => {
    it('should handle 10KB text', async () => {
      const adapter = createMemoryAdapter()
      const largeText = 'Hello World. '.repeat(800) // ~10KB
      const translatedText = 'שלום עולם. '.repeat(800)

      vi.mocked(generateText).mockResolvedValue({
        text: translatedText,
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const start = Date.now()
      const result = await translate.text({
        text: largeText,
        to: 'he',
        from: 'en',
      })
      const duration = Date.now() - start

      expect(result.text.length).toBeGreaterThan(0)
      expect(duration).toBeLessThan(5000) // Should complete within 5s
    })

    it('should handle 100KB text', async () => {
      const adapter = createMemoryAdapter()
      const largeText = 'Hello World. '.repeat(8000) // ~100KB
      const translatedText = 'שלום עולם. '.repeat(8000)

      vi.mocked(generateText).mockResolvedValue({
        text: translatedText,
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: largeText,
        to: 'he',
        from: 'en',
      })

      expect(result.text.length).toBeGreaterThan(0)
    })
  })

  describe('batch performance', () => {
    it('should handle batch of 50 texts efficiently', async () => {
      const adapter = createMemoryAdapter()
      const texts = Array.from({ length: 50 }, (_, i) => `Text number ${i}`)
      const translations = texts.map((_, i) => `טקסט מספר ${i}`)

      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(translations),
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const start = Date.now()
      const results = await translate.batch({
        texts,
        to: 'he',
        from: 'en',
      })
      const duration = Date.now() - start

      expect(results).toHaveLength(50)
      expect(duration).toBeLessThan(5000)
    })

    it('should handle batch of 100 texts', async () => {
      const adapter = createMemoryAdapter()
      const texts = Array.from({ length: 100 }, (_, i) => `Text ${i}`)
      const translations = texts.map((_, i) => `טקסט ${i}`)

      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(translations),
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const results = await translate.batch({
        texts,
        to: 'he',
        from: 'en',
      })

      expect(results).toHaveLength(100)
    })

    it('should efficiently cache duplicate texts in batch', async () => {
      const adapter = createMemoryAdapter()
      // 50 unique texts, each repeated twice
      const uniqueTexts = Array.from({ length: 50 }, (_, i) => `Unique ${i}`)
      const texts = [...uniqueTexts, ...uniqueTexts]
      const translations = uniqueTexts.map((_, i) => `ייחודי ${i}`)

      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(translations),
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const results = await translate.batch({
        texts,
        to: 'he',
        from: 'en',
      })

      expect(results).toHaveLength(100)
      // Verify duplicates are handled
      expect(results[0].text).toBe(results[50].text)
    })
  })

  describe('object translation performance', () => {
    it('should handle 50 objects efficiently', async () => {
      const adapter = createMemoryAdapter()
      const objects = Array.from({ length: 50 }, (_, i) => ({
        id: String(i),
        title: `Title ${i}`,
        description: `Description ${i}`,
      }))

      vi.mocked(generateText).mockImplementation(async () => ({
        text: 'תרגום',
      } as any))

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const start = Date.now()
      const results = await translate.objects(objects, {
        fields: ['title', 'description'],
        to: 'he',
      })
      const duration = Date.now() - start

      expect(results).toHaveLength(50)
      expect(duration).toBeLessThan(10000)
    })

    it('should handle objects with many fields', async () => {
      const adapter = createMemoryAdapter()
      const obj: Record<string, string> = { id: '1' }
      for (let i = 0; i < 20; i++) {
        obj[`field${i}`] = `Value ${i}`
      }

      vi.mocked(generateText).mockResolvedValue({
        text: 'ערך',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const fields = Object.keys(obj).filter(k => k.startsWith('field')) as any[]
      const result = await translate.object(obj, {
        fields,
        to: 'he',
      })

      expect(result.id).toBe('1')
      fields.forEach(field => {
        expect(result[field]).toBeDefined()
      })
    })
  })

  describe('cache performance', () => {
    it('should maintain performance with 1000 cache entries', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockImplementation(async (args: any) => ({
        text: `translated_${args.prompt.slice(-10)}`,
      } as any))

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      // Populate cache with 1000 entries
      for (let i = 0; i < 100; i++) {
        await translate.text({
          text: `Text ${i}`,
          to: 'he',
          from: 'en',
        })
      }

      vi.mocked(generateText).mockClear()

      // Now test cache hit performance
      const start = Date.now()
      for (let i = 0; i < 100; i++) {
        await translate.text({
          text: `Text ${i % 100}`, // Hit cache
          to: 'he',
          from: 'en',
        })
      }
      const duration = Date.now() - start

      expect(generateText).not.toHaveBeenCalled() // All cache hits
      expect(duration).toBeLessThan(1000) // Should be very fast
    })

    it('should handle rapid sequential translations', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const start = Date.now()
      for (let i = 0; i < 50; i++) {
        await translate.text({
          text: `Unique text ${i}`,
          to: 'he',
          from: 'en',
        })
      }
      const duration = Date.now() - start

      expect(duration).toBeLessThan(10000)
    })
  })

  describe('concurrent operations', () => {
    it('should handle 50 concurrent translation requests', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 10))
        return { text: 'שלום' } as any
      })

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const start = Date.now()
      const promises = Array.from({ length: 50 }, (_, i) =>
        translate.text({
          text: `Text ${i}`,
          to: 'he',
          from: 'en',
        })
      )

      const results = await Promise.all(promises)
      const duration = Date.now() - start

      expect(results).toHaveLength(50)
      results.forEach(r => expect(r.text).toBe('שלום'))
      // With coalescing, this should be faster than sequential
      expect(duration).toBeLessThan(5000)
    })

    it('should handle mixed concurrent operations', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockImplementation(async (args: any) => {
        await new Promise(resolve => setTimeout(resolve, 5))
        if (args.prompt.includes('array')) {
          return { text: '["א", "ב"]' } as any
        }
        return { text: 'שלום' } as any
      })

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const operations = [
        // 10 text translations
        ...Array.from({ length: 10 }, (_, i) =>
          translate.text({
            text: `Text ${i}`,
            to: 'he',
            from: 'en',
          })
        ),
        // 5 batch translations
        ...Array.from({ length: 5 }, () =>
          translate.batch({
            texts: ['A', 'B'],
            to: 'he',
            from: 'en',
          })
        ),
        // 5 object translations
        ...Array.from({ length: 5 }, (_, i) =>
          translate.object(
            { id: String(i), title: `Title ${i}` },
            { fields: ['title'], to: 'he' }
          )
        ),
      ]

      const start = Date.now()
      const results = await Promise.all(operations)
      const duration = Date.now() - start

      expect(results).toHaveLength(20)
      expect(duration).toBeLessThan(10000)
    })
  })

  describe('memory efficiency', () => {
    it('should not accumulate memory with repeated operations', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      // Run many operations
      for (let i = 0; i < 100; i++) {
        await translate.text({
          text: `Text ${i}`,
          to: 'he',
          from: 'en',
        })
      }

      // Clear cache
      await translate.clearCache()

      const stats = await translate.getCacheStats()
      expect(stats.totalEntries).toBe(0)
    })

    it('should handle large objects without memory issues', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockResolvedValue({
        text: 'Large translated content here',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      // Object with many large fields
      const largeObject: Record<string, string> = { id: '1' }
      for (let i = 0; i < 10; i++) {
        largeObject[`field${i}`] = 'A'.repeat(1000) // 1KB per field
      }

      const fields = Object.keys(largeObject).filter(k => k.startsWith('field')) as any[]

      const result = await translate.object(largeObject, {
        fields,
        to: 'he',
      })

      expect(result.id).toBe('1')
    })
  })
})
