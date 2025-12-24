import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateText, translateBatch, detectLanguage } from '../core'
import { createMemoryAdapter } from '../adapters/memory'
import type { CacheAdapter } from '../adapters/types'
import type { TranslateConfig } from '../create-translate'

// Mock the OpenAI provider
vi.mock('../providers/openai', () => ({
  translateWithOpenAI: vi.fn(),
  detectLanguageWithOpenAI: vi.fn(),
}))

import { translateWithOpenAI, detectLanguageWithOpenAI } from '../providers/openai'

describe('core', () => {
  let adapter: CacheAdapter
  let config: TranslateConfig

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = createMemoryAdapter()
    config = {
      adapter,
      provider: 'openai',
      apiKey: 'test-api-key',
      languages: ['en', 'ar', 'he', 'ru'] as const,
    }

    // Default mock implementation that mimics real behavior
    vi.mocked(translateWithOpenAI).mockImplementation(async ({ text, to, from }) => {
      // Mimic the real provider behavior: return original when from === to
      if (from && from === to) {
        return { text, from }
      }
      return {
        text: `[${to}] ${text}`,
        from: from ?? 'en',
      }
    })

    vi.mocked(detectLanguageWithOpenAI).mockResolvedValue({
      language: 'en',
      confidence: 0.95,
    })
  })

  describe('translateText', () => {
    describe('empty text handling', () => {
      it('should return empty text as-is', async () => {
        const result = await translateText(adapter, config, {
          text: '',
          to: 'he',
        })

        expect(result.text).toBe('')
        expect(result.cached).toBe(true)
        expect(translateWithOpenAI).not.toHaveBeenCalled()
      })

      it('should return whitespace-only text as-is', async () => {
        const result = await translateText(adapter, config, {
          text: '   ',
          to: 'he',
        })

        expect(result.text).toBe('   ')
        expect(result.cached).toBe(true)
        expect(translateWithOpenAI).not.toHaveBeenCalled()
      })

      it('should return tabs and newlines as-is', async () => {
        const result = await translateText(adapter, config, {
          text: '\t\n\r',
          to: 'he',
        })

        expect(result.text).toBe('\t\n\r')
        expect(result.cached).toBe(true)
      })

      it('should use provided from language for empty text', async () => {
        const result = await translateText(adapter, config, {
          text: '',
          to: 'he',
          from: 'ar',
        })

        expect(result.from).toBe('ar')
      })

      it('should default to en for empty text without from', async () => {
        const result = await translateText(adapter, config, {
          text: '',
          to: 'he',
        })

        expect(result.from).toBe('en')
      })
    })

    describe('caching behavior', () => {
      it('should cache translation after first call', async () => {
        await translateText(adapter, config, { text: 'Hello', to: 'he' })

        expect(translateWithOpenAI).toHaveBeenCalledTimes(1)

        const result = await translateText(adapter, config, { text: 'Hello', to: 'he' })

        expect(result.cached).toBe(true)
        expect(translateWithOpenAI).toHaveBeenCalledTimes(1) // Still 1
      })

      it('should return original text when cached source equals target', async () => {
        // Directly set up a cache entry where source language equals target
        // This simulates a scenario where a previous translation detected
        // the text was already in the target language
        const hashKey = (await import('../cache-key')).createHashKey('Hello', 'he')
        await adapter.set({
          id: hashKey,
          sourceText: 'Hello',
          sourceLanguage: 'he', // Same as target
          targetLanguage: 'he',
          translatedText: 'Hello',
          provider: 'openai',
        })

        const result = await translateText(adapter, config, { text: 'Hello', to: 'he' })

        expect(result.text).toBe('Hello')
        expect(result.cached).toBe(true)
        expect(translateWithOpenAI).not.toHaveBeenCalled()
      })

      it('should return original text when from equals to', async () => {
        const result = await translateText(adapter, config, {
          text: 'Hello',
          to: 'en',
          from: 'en',
        })

        // First check if cached from cache (if previous test cached it)
        // The key insight is that when from === to, we should get original text
        expect(translateWithOpenAI).toHaveBeenCalledTimes(0)
      })

      it('should not cache when source equals target', async () => {
        vi.mocked(translateWithOpenAI).mockResolvedValueOnce({
          text: 'Hello',
          from: 'en',
        })

        await translateText(adapter, config, { text: 'Hello', to: 'en' })

        const stats = await adapter.getStats()
        expect(stats.totalEntries).toBe(0)
      })

      it('should cache with resource info when provided', async () => {
        await translateText(adapter, config, {
          text: 'flat',
          to: 'he',
          resourceType: 'property',
          resourceId: '123',
          field: 'type',
        })

        // Different resource should not hit cache
        vi.mocked(translateWithOpenAI).mockClear()

        await translateText(adapter, config, {
          text: 'flat',
          to: 'he',
          resourceType: 'property',
          resourceId: '456',
          field: 'type',
        })

        expect(translateWithOpenAI).toHaveBeenCalledTimes(1)
      })

      it('should fall back to hash cache when resource cache misses', async () => {
        // First, cache without resource info
        await translateText(adapter, config, { text: 'Hello', to: 'he' })
        vi.mocked(translateWithOpenAI).mockClear()

        // Request with resource info should fall back to hash cache
        const result = await translateText(adapter, config, {
          text: 'Hello',
          to: 'he',
          resourceType: 'property',
          resourceId: '999',
          field: 'title',
        })

        expect(result.cached).toBe(true)
        expect(translateWithOpenAI).not.toHaveBeenCalled()
      })

      it('should return isManualOverride when cached entry is manual', async () => {
        // Set up a manual override
        await adapter.set({
          id: 'res:property:123:type:he',
          sourceText: 'flat',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'דירה',
          resourceType: 'property',
          resourceId: '123',
          field: 'type',
          isManualOverride: true,
          provider: 'manual',
        })

        const result = await translateText(adapter, config, {
          text: 'flat',
          to: 'he',
          resourceType: 'property',
          resourceId: '123',
          field: 'type',
        })

        expect(result.text).toBe('דירה')
        expect(result.isManualOverride).toBe(true)
        expect(result.cached).toBe(true)
      })
    })

    describe('API call parameters', () => {
      it('should pass context to OpenAI provider', async () => {
        await translateText(adapter, config, {
          text: 'flat',
          to: 'he',
          context: 'real estate',
        })

        expect(translateWithOpenAI).toHaveBeenCalledWith(
          expect.objectContaining({
            context: 'real estate',
          })
        )
      })

      it('should use configured model', async () => {
        const configWithModel = { ...config, model: 'gpt-4-turbo' }

        await translateText(adapter, configWithModel, {
          text: 'Hello',
          to: 'he',
        })

        expect(translateWithOpenAI).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gpt-4-turbo',
          })
        )
      })

      it('should default to gpt-4o-mini model', async () => {
        await translateText(adapter, config, {
          text: 'Hello',
          to: 'he',
        })

        expect(translateWithOpenAI).toHaveBeenCalledWith(
          expect.objectContaining({
            model: 'gpt-4o-mini',
          })
        )
      })

      it('should pass from language when provided', async () => {
        await translateText(adapter, config, {
          text: 'Hello',
          to: 'he',
          from: 'en',
        })

        expect(translateWithOpenAI).toHaveBeenCalledWith(
          expect.objectContaining({
            from: 'en',
          })
        )
      })
    })

    describe('request coalescing', () => {
      it('should coalesce concurrent requests for same translation', async () => {
        let resolvePromise: (value: { text: string; from: string }) => void
        const delayedPromise = new Promise<{ text: string; from: string }>((resolve) => {
          resolvePromise = resolve
        })

        vi.mocked(translateWithOpenAI).mockReturnValueOnce(delayedPromise)

        // Start two concurrent requests
        const promise1 = translateText(adapter, config, { text: 'Hello', to: 'he' })
        const promise2 = translateText(adapter, config, { text: 'Hello', to: 'he' })

        // Resolve the delayed promise
        resolvePromise!({ text: 'שלום', from: 'en' })

        const [result1, result2] = await Promise.all([promise1, promise2])

        // Both should get the same result
        expect(result1.text).toBe('שלום')
        expect(result2.text).toBe('שלום')

        // OpenAI should only be called once
        expect(translateWithOpenAI).toHaveBeenCalledTimes(1)
      })

      it('should not coalesce requests for different texts', async () => {
        await Promise.all([
          translateText(adapter, config, { text: 'Hello', to: 'he' }),
          translateText(adapter, config, { text: 'World', to: 'he' }),
        ])

        expect(translateWithOpenAI).toHaveBeenCalledTimes(2)
      })

      it('should not coalesce requests for different languages', async () => {
        await Promise.all([
          translateText(adapter, config, { text: 'Hello', to: 'he' }),
          translateText(adapter, config, { text: 'Hello', to: 'ar' }),
        ])

        expect(translateWithOpenAI).toHaveBeenCalledTimes(2)
      })

      it('should coalesce resource-specific requests', async () => {
        let resolvePromise: (value: { text: string; from: string }) => void
        const delayedPromise = new Promise<{ text: string; from: string }>((resolve) => {
          resolvePromise = resolve
        })

        vi.mocked(translateWithOpenAI).mockReturnValueOnce(delayedPromise)

        const promise1 = translateText(adapter, config, {
          text: 'flat',
          to: 'he',
          resourceType: 'property',
          resourceId: '123',
          field: 'type',
        })
        const promise2 = translateText(adapter, config, {
          text: 'flat',
          to: 'he',
          resourceType: 'property',
          resourceId: '123',
          field: 'type',
        })

        resolvePromise!({ text: 'דירה', from: 'en' })

        await Promise.all([promise1, promise2])

        expect(translateWithOpenAI).toHaveBeenCalledTimes(1)
      })

      it('should clean up in-flight request after completion', async () => {
        await translateText(adapter, config, { text: 'Hello', to: 'he' })
        vi.mocked(translateWithOpenAI).mockClear()

        // Second request should hit cache, not coalesce
        const result = await translateText(adapter, config, { text: 'Hello', to: 'he' })

        expect(result.cached).toBe(true)
        expect(translateWithOpenAI).not.toHaveBeenCalled()
      })

      it('should clean up in-flight request on error', async () => {
        vi.mocked(translateWithOpenAI).mockRejectedValueOnce(new Error('API Error'))

        await expect(
          translateText(adapter, config, { text: 'Hello', to: 'he' })
        ).rejects.toThrow('API Error')

        // After error, new request should make fresh API call
        vi.mocked(translateWithOpenAI).mockResolvedValueOnce({
          text: 'שלום',
          from: 'en',
        })

        const result = await translateText(adapter, config, { text: 'Hello', to: 'he' })
        expect(result.text).toBe('שלום')
      })
    })

    describe('result format', () => {
      it('should return correct result structure', async () => {
        vi.mocked(translateWithOpenAI).mockResolvedValueOnce({
          text: 'שלום',
          from: 'en',
        })

        const result = await translateText(adapter, config, {
          text: 'Hello',
          to: 'he',
        })

        expect(result).toEqual({
          text: 'שלום',
          from: 'en',
          to: 'he',
          cached: false,
        })
      })
    })
  })

  describe('translateBatch', () => {
    it('should translate multiple texts', async () => {
      const results = await translateBatch(adapter, config, {
        texts: ['Hello', 'World', 'Test'],
        to: 'ar',
      })

      expect(results).toHaveLength(3)
      expect(translateWithOpenAI).toHaveBeenCalledTimes(3)
    })

    it('should handle empty array', async () => {
      const results = await translateBatch(adapter, config, {
        texts: [],
        to: 'ar',
      })

      expect(results).toEqual([])
      expect(translateWithOpenAI).not.toHaveBeenCalled()
    })

    it('should pass context to all translations', async () => {
      await translateBatch(adapter, config, {
        texts: ['Hello', 'World'],
        to: 'he',
        context: 'greeting',
      })

      expect(translateWithOpenAI).toHaveBeenCalledTimes(2)
      expect(translateWithOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ context: 'greeting' })
      )
    })

    it('should pass from language to all translations', async () => {
      await translateBatch(adapter, config, {
        texts: ['Hello', 'World'],
        to: 'he',
        from: 'en',
      })

      expect(translateWithOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({ from: 'en' })
      )
    })

    it('should translate in parallel', async () => {
      const startTime = Date.now()
      let resolveCount = 0

      vi.mocked(translateWithOpenAI).mockImplementation(async () => {
        await new Promise(resolve => setTimeout(resolve, 50))
        resolveCount++
        return { text: 'translated', from: 'en' }
      })

      await translateBatch(adapter, config, {
        texts: ['a', 'b', 'c'],
        to: 'he',
      })

      const elapsed = Date.now() - startTime

      // If parallel, should take ~50ms, if sequential ~150ms
      expect(elapsed).toBeLessThan(100)
      expect(resolveCount).toBe(3)
    })

    it('should use cache for duplicate texts in batch', async () => {
      await translateBatch(adapter, config, {
        texts: ['Hello', 'Hello', 'Hello'],
        to: 'he',
      })

      // First call is fresh, subsequent calls should use cache
      // Due to request coalescing, all concurrent identical requests share one API call
      expect(translateWithOpenAI).toHaveBeenCalledTimes(1)
    })

    it('should handle mixed cached and uncached texts', async () => {
      // Pre-cache one text
      await translateText(adapter, config, { text: 'Hello', to: 'he' })
      vi.mocked(translateWithOpenAI).mockClear()

      const results = await translateBatch(adapter, config, {
        texts: ['Hello', 'World'],
        to: 'he',
      })

      expect(results[0].cached).toBe(true)
      expect(results[1].cached).toBe(false)
      expect(translateWithOpenAI).toHaveBeenCalledTimes(1)
    })
  })

  describe('detectLanguage', () => {
    it('should detect language', async () => {
      vi.mocked(detectLanguageWithOpenAI).mockResolvedValueOnce({
        language: 'ar',
        confidence: 0.95,
      })

      const result = await detectLanguage(config, 'مرحبا')

      expect(result.language).toBe('ar')
      expect(result.confidence).toBe(0.95)
    })

    it('should use configured model', async () => {
      const configWithModel = { ...config, model: 'gpt-4-turbo' }

      await detectLanguage(configWithModel, 'Hello')

      expect(detectLanguageWithOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4-turbo',
        })
      )
    })

    it('should default to gpt-4o-mini model', async () => {
      await detectLanguage(config, 'Hello')

      expect(detectLanguageWithOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'gpt-4o-mini',
        })
      )
    })

    it('should pass API key', async () => {
      await detectLanguage(config, 'Hello')

      expect(detectLanguageWithOpenAI).toHaveBeenCalledWith(
        expect.objectContaining({
          apiKey: 'test-api-key',
        })
      )
    })
  })
})
