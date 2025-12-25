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
  languages: ['en', 'he', 'ar', 'ru', 'de'] as const,
}

describe('Request Coalescing', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('basic coalescing', () => {
    it('should coalesce multiple simultaneous requests for same text', async () => {
      const adapter = createMemoryAdapter()
      let resolveTranslation: (value: any) => void
      const translationPromise = new Promise(resolve => {
        resolveTranslation = resolve
      })

      vi.mocked(generateText).mockImplementation(async () => {
        await translationPromise
        return { text: 'שלום' } as any
      })

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // Start 5 concurrent requests for the same text
      const promises = Array.from({ length: 5 }, () =>
        translate.text({
          text: 'Hello',
          to: 'he',
          from: 'en',
        })
      )

      // Resolve the translation
      resolveTranslation!({ text: 'שלום' })

      const results = await Promise.all(promises)

      // All should get the same result
      expect(results).toHaveLength(5)
      results.forEach(r => expect(r.text).toBe('שלום'))

      // But AI should only be called once (coalescing)
      expect(generateText).toHaveBeenCalledTimes(1)
    })

    it('should not coalesce requests with different target languages', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: 'שלום' } as any)
        .mockResolvedValueOnce({ text: 'مرحبا' } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const [heResult, arResult] = await Promise.all([
        translate.text({
          text: 'Hello',
          to: 'he',
          from: 'en',
        }),
        translate.text({
          text: 'Hello',
          to: 'ar',
          from: 'en',
        }),
      ])

      expect(heResult.text).toBe('שלום')
      expect(arResult.text).toBe('مرحبا')
      expect(generateText).toHaveBeenCalledTimes(2)
    })

    it('should coalesce requests with different source languages (hash key ignores source)', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockResolvedValue({ text: 'שלום' } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const [result1, result2] = await Promise.all([
        translate.text({
          text: 'Hello',
          to: 'he',
          from: 'en',
        }),
        translate.text({
          text: 'Hello',
          to: 'he',
          from: 'de', // Different source, but same hash key
        }),
      ])

      // Both get same result since hash key only includes text + target
      expect(result1.text).toBe('שלום')
      expect(result2.text).toBe('שלום')
      // Only 1 call because requests coalesce (same hash key)
      expect(generateText).toHaveBeenCalledTimes(1)
    })

    it('should coalesce requests that start before first completes', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return { text: 'שלום' } as any
      })

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // First request starts
      const promise1 = translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      // Wait a tiny bit, then start more requests
      await new Promise(resolve => setTimeout(resolve, 10))

      const promise2 = translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      const promise3 = translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      const [r1, r2, r3] = await Promise.all([promise1, promise2, promise3])

      expect(r1.text).toBe('שלום')
      expect(r2.text).toBe('שלום')
      expect(r3.text).toBe('שלום')
      // All requests coalesce to one AI call
      expect(generateText).toHaveBeenCalledTimes(1)
    })
  })

  describe('error coalescing', () => {
    it('should propagate error to all coalesced requests', async () => {
      const adapter = createMemoryAdapter()
      let rejectTranslation: (error: Error) => void
      const translationPromise = new Promise((_, reject) => {
        rejectTranslation = reject
      })

      vi.mocked(generateText).mockImplementation(async () => {
        await translationPromise
        return { text: 'שלום' } as any
      })

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // Start 3 concurrent requests
      const promises = Array.from({ length: 3 }, () =>
        translate.text({
          text: 'Hello',
          to: 'he',
          from: 'en',
        })
      )

      // Reject the translation
      rejectTranslation!(new Error('API Error'))

      // All should fail with the same error
      const results = await Promise.allSettled(promises)

      expect(results).toHaveLength(3)
      results.forEach(r => {
        expect(r.status).toBe('rejected')
        if (r.status === 'rejected') {
          expect(r.reason.message).toBe('API Error')
        }
      })

      expect(generateText).toHaveBeenCalledTimes(1)
    })

    it('should allow new request after coalesced request fails', async () => {
      const adapter = createMemoryAdapter()
      let shouldFail = true

      vi.mocked(generateText).mockImplementation(async () => {
        if (shouldFail) {
          throw new Error('First failure')
        }
        return { text: 'שלום' } as any
      })

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // First request fails
      await expect(
        translate.text({
          text: 'Hello',
          to: 'he',
          from: 'en',
        })
      ).rejects.toThrow('First failure')

      // Now make it succeed
      shouldFail = false

      // New request should start fresh
      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('שלום')
      expect(generateText).toHaveBeenCalledTimes(2)
    })

    it('should clean up in-flight map after rejection', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText)
        .mockRejectedValueOnce(new Error('First error'))
        .mockResolvedValueOnce({ text: 'שלום' } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // First request fails
      await expect(
        translate.text({
          text: 'Hello',
          to: 'he',
          from: 'en',
        })
      ).rejects.toThrow()

      // Second request should work (in-flight was cleaned up)
      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('שלום')
    })
  })

  describe('cache interaction', () => {
    it('should use cache if available, bypassing coalescing', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // First request populates cache
      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      // Clear mock to track new calls
      vi.mocked(generateText).mockClear()

      // Multiple concurrent requests should all hit cache
      const promises = Array.from({ length: 5 }, () =>
        translate.text({
          text: 'Hello',
          to: 'he',
          from: 'en',
        })
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(5)
      results.forEach(r => expect(r.text).toBe('שלום'))
      expect(generateText).not.toHaveBeenCalled()
    })

    it('should coalesce uncached requests while cached ones return immediately', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return { text: 'חדש' } as any
      })

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // Pre-populate cache for 'Hello'
      vi.mocked(generateText).mockResolvedValueOnce({ text: 'שלום' } as any)
      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      vi.mocked(generateText).mockClear()
      vi.mocked(generateText).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return { text: 'חדש' } as any
      })

      // Now make concurrent requests: some cached, some not
      const [cachedResult, uncached1, uncached2] = await Promise.all([
        translate.text({
          text: 'Hello', // Cached
          to: 'he',
          from: 'en',
        }),
        translate.text({
          text: 'New text', // Not cached
          to: 'he',
          from: 'en',
        }),
        translate.text({
          text: 'New text', // Not cached, should coalesce
          to: 'he',
          from: 'en',
        }),
      ])

      expect(cachedResult.text).toBe('שלום')
      expect(uncached1.text).toBe('חדש')
      expect(uncached2.text).toBe('חדש')

      // Only one call for the uncached text (coalesced)
      expect(generateText).toHaveBeenCalledTimes(1)
    })
  })

  describe('resource-based coalescing', () => {
    it('should not coalesce requests with different resource IDs', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: 'כותרת 1' } as any)
        .mockResolvedValueOnce({ text: 'כותרת 2' } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const [result1, result2] = await Promise.all([
        translate.text({
          text: 'Title',
          to: 'he',
          from: 'en',
          resourceType: 'todo',
          resourceId: '1',
          field: 'title',
        }),
        translate.text({
          text: 'Title',
          to: 'he',
          from: 'en',
          resourceType: 'todo',
          resourceId: '2',
          field: 'title',
        }),
      ])

      expect(result1.text).toBe('כותרת 1')
      expect(result2.text).toBe('כותרת 2')
      expect(generateText).toHaveBeenCalledTimes(2)
    })

    it('should coalesce requests with same resource info', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return { text: 'כותרת' } as any
      })

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const promises = Array.from({ length: 3 }, () =>
        translate.text({
          text: 'Title',
          to: 'he',
          from: 'en',
          resourceType: 'todo',
          resourceId: '1',
          field: 'title',
        })
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(3)
      results.forEach(r => expect(r.text).toBe('כותרת'))
      expect(generateText).toHaveBeenCalledTimes(1)
    })
  })
})
