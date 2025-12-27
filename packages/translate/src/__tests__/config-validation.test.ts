import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTranslate } from '../create-translate'
import { createMemoryAdapter } from '../adapters/memory'
import type { CacheAdapter } from '../adapters/types'
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

describe('Configuration Validation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('model configuration', () => {
    it('should work with valid model configuration', () => {
      const adapter = createMemoryAdapter()

      expect(() =>
        createTranslate({
          model: mockModel,
          adapter,
        })
      ).not.toThrow()
    })

    it('should work with model that has minimal properties', () => {
      const adapter = createMemoryAdapter()
      const minimalModel = { modelId: 'test' } as LanguageModel

      expect(() =>
        createTranslate({
          model: minimalModel,
          adapter,
        })
      ).not.toThrow()
    })
  })

  describe('temperature configuration', () => {
    it('should accept temperature = 0', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
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

    it('should accept temperature = 1', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        temperature: 1,
      })

      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      const callArgs = vi.mocked(generateText).mock.calls[0][0]
      expect(callArgs.temperature).toBe(1)
    })

    it('should accept temperature = 2', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
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

    it('should use default temperature when not specified', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        // No temperature specified
      })

      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      const callArgs = vi.mocked(generateText).mock.calls[0][0]
      expect(callArgs.temperature).toBeDefined()
    })

    it('should accept fractional temperature values', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        temperature: 0.5,
      })

      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      const callArgs = vi.mocked(generateText).mock.calls[0][0]
      expect(callArgs.temperature).toBe(0.5)
    })
  })

  describe('defaultLanguage configuration', () => {
    it('should accept valid default language', () => {
      const adapter = createMemoryAdapter()

      expect(() =>
        createTranslate({
          model: mockModel,
          adapter,
          defaultLanguage: 'en',
        })
      ).not.toThrow()
    })

    it('should accept RTL default language', () => {
      const adapter = createMemoryAdapter()

      const translate = createTranslate({
        model: mockModel,
        adapter,
        defaultLanguage: 'he',
      })

      expect(translate.isRTL('he')).toBe(true)
    })

    it('should work without default language specified', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        // No defaultLanguage specified
      })

      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('שלום')
    })
  })

  describe('adapter configuration', () => {
    it('should work with memory adapter', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('שלום')
    })

    it('should work with custom adapter implementing all methods', async () => {
      const customAdapter: CacheAdapter = {
        get: vi.fn().mockResolvedValue(null),
        getMany: vi.fn().mockResolvedValue(new Map()),
        set: vi.fn().mockResolvedValue(undefined),
        setMany: vi.fn().mockResolvedValue(undefined),
        touch: vi.fn().mockResolvedValue(undefined),
        touchMany: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        deleteByResource: vi.fn().mockResolvedValue(0),
        deleteByLanguage: vi.fn().mockResolvedValue(0),
        deleteAll: vi.fn().mockResolvedValue(0),
        getStats: vi.fn().mockResolvedValue({
          totalEntries: 0,
          byLanguage: {},
          manualOverrides: 0,
        }),
      }

      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter: customAdapter,
      })

      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('שלום')
      expect(customAdapter.get).toHaveBeenCalled()
      expect(customAdapter.set).toHaveBeenCalled()
    })

    it('should call adapter methods with correct types', async () => {
      const setMock = vi.fn()
      const customAdapter: CacheAdapter = {
        get: vi.fn().mockResolvedValue(null),
        getMany: vi.fn().mockResolvedValue(new Map()),
        set: setMock.mockResolvedValue(undefined),
        setMany: vi.fn().mockResolvedValue(undefined),
        touch: vi.fn().mockResolvedValue(undefined),
        touchMany: vi.fn().mockResolvedValue(undefined),
        delete: vi.fn().mockResolvedValue(undefined),
        deleteByResource: vi.fn().mockResolvedValue(0),
        deleteByLanguage: vi.fn().mockResolvedValue(0),
        deleteAll: vi.fn().mockResolvedValue(0),
        getStats: vi.fn().mockResolvedValue({
          totalEntries: 0,
          byLanguage: {},
          manualOverrides: 0,
        }),
      }

      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter: customAdapter,
      })

      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      expect(setMock).toHaveBeenCalledWith(
        expect.objectContaining({
          sourceText: 'Hello',
          targetLanguage: 'he',
          translatedText: 'שלום',
          isManualOverride: false,
        })
      )
    })
  })

  describe('languages list', () => {
    it('should expose languages property when configured', () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      expect(translate.languages).toBeDefined()
      expect(Array.isArray(translate.languages)).toBe(true)
    })

    it('should include configured languages', () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      expect(translate.languages).toContain('en')
      expect(translate.languages).toContain('he')
      expect(translate.languages).toContain('ar')
    })
  })

  describe('method availability', () => {
    it('should expose all expected methods', () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      expect(typeof translate.text).toBe('function')
      expect(typeof translate.batch).toBe('function')
      expect(typeof translate.object).toBe('function')
      expect(typeof translate.objects).toBe('function')
      expect(typeof translate.setManual).toBe('function')
      expect(typeof translate.clearManual).toBe('function')
      expect(typeof translate.clearCache).toBe('function')
      expect(typeof translate.clearResourceCache).toBe('function')
      expect(typeof translate.getCacheStats).toBe('function')
      expect(typeof translate.detectLanguage).toBe('function')
      expect(typeof translate.isRTL).toBe('function')
    })
  })

  describe('getCacheStats', () => {
    it('should return cache statistics', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      // Add some entries to cache
      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      const stats = await translate.getCacheStats()

      expect(stats).toHaveProperty('totalEntries')
      expect(stats).toHaveProperty('byLanguage')
      expect(stats).toHaveProperty('manualOverrides')
      expect(stats.totalEntries).toBeGreaterThanOrEqual(1)
    })

    it('should return empty stats for new adapter', async () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const stats = await translate.getCacheStats()

      expect(stats.totalEntries).toBe(0)
      expect(stats.manualOverrides).toBe(0)
    })
  })

  describe('clearCache', () => {
    it('should clear all cache when called without options', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      const statsBefore = await translate.getCacheStats()
      expect(statsBefore.totalEntries).toBeGreaterThan(0)

      await translate.clearCache()

      const statsAfter = await translate.getCacheStats()
      expect(statsAfter.totalEntries).toBe(0)
    })

    it('should clear cache by language', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText)
        .mockResolvedValueOnce({ text: 'שלום' } as any)
        .mockResolvedValueOnce({ text: 'مرحبا' } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
        languages: ['en', 'he', 'ar', 'ru'],
      })

      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      await translate.text({
        text: 'Hi there',
        to: 'ar',
        from: 'en',
      })

      const statsBefore = await translate.getCacheStats()
      expect(statsBefore.totalEntries).toBe(2)

      // clearCache takes a direct language parameter
      await translate.clearCache('he')

      const statsAfter = await translate.getCacheStats()
      expect(statsAfter.totalEntries).toBe(1)
      expect(statsAfter.byLanguage['ar']).toBe(1)
    })
  })
})
