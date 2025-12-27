import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateText, detectLanguage } from '../core'
import { createMemoryAdapter } from '../adapters/memory'
import type { CacheAdapter } from '../adapters/types'
import type { TranslateConfig, AnalyticsEvent, AnalyticsFunction } from '../create-translate'
import type { LanguageModel } from 'ai'

vi.mock('../providers/ai-sdk', () => ({
  translateWithAI: vi.fn(),
  detectLanguageWithAI: vi.fn(),
}))

vi.mock('../providers/types', () => ({
  getModelInfo: vi.fn(() => ({ provider: 'openai', modelId: 'gpt-4o-mini' })),
}))

import { translateWithAI, detectLanguageWithAI } from '../providers/ai-sdk'

const mockModel = {
  modelId: 'gpt-4o-mini',
  provider: 'openai',
} as unknown as LanguageModel

describe('analytics', () => {
  let adapter: CacheAdapter
  let analyticsEvents: AnalyticsEvent[]
  let onAnalytics: AnalyticsFunction

  beforeEach(() => {
    vi.clearAllMocks()
    adapter = createMemoryAdapter()
    analyticsEvents = []
    onAnalytics = (event) => {
      analyticsEvents.push(event)
    }

    vi.mocked(translateWithAI).mockImplementation(async ({ text, to, from }) => ({
      text: `[${to}] ${text}`,
      from: from ?? 'en',
    }))

    vi.mocked(detectLanguageWithAI).mockResolvedValue({
      language: 'en',
      confidence: 0.95,
    })
  })

  describe('translation analytics', () => {
    it('should emit analytics event on successful translation', async () => {
      const config: TranslateConfig = {
        adapter,
        model: mockModel,
        onAnalytics,
      }

      await translateText(adapter, config, { text: 'Hello', to: 'he' })

      expect(analyticsEvents).toHaveLength(1)
      expect(analyticsEvents[0]).toMatchObject({
        type: 'translation',
        text: 'Hello',
        translatedText: '[he] Hello',
        from: 'en',
        to: 'he',
        cached: false,
        provider: 'openai',
        model: 'gpt-4o-mini',
      })
      expect(analyticsEvents[0].duration).toBeGreaterThanOrEqual(0)
    })

    it('should emit cache_hit event when translation is cached', async () => {
      const config: TranslateConfig = {
        adapter,
        model: mockModel,
        onAnalytics,
      }

      await translateText(adapter, config, { text: 'Hello', to: 'he' })
      analyticsEvents = []

      await translateText(adapter, config, { text: 'Hello', to: 'he' })

      expect(analyticsEvents).toHaveLength(1)
      expect(analyticsEvents[0]).toMatchObject({
        type: 'cache_hit',
        text: 'Hello',
        translatedText: '[he] Hello',
        cached: true,
      })
    })

    it('should include resource info in analytics event', async () => {
      const config: TranslateConfig = {
        adapter,
        model: mockModel,
        onAnalytics,
      }

      await translateText(adapter, config, {
        text: 'Hello',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'title',
      })

      expect(analyticsEvents[0]).toMatchObject({
        resourceType: 'property',
        resourceId: '123',
        field: 'title',
      })
    })

    it('should emit error event on translation failure', async () => {
      vi.mocked(translateWithAI).mockRejectedValueOnce(new Error('API Error'))

      const config: TranslateConfig = {
        adapter,
        model: mockModel,
        onAnalytics,
      }

      await expect(
        translateText(adapter, config, { text: 'Hello', to: 'he' })
      ).rejects.toThrow('API Error')

      expect(analyticsEvents).toHaveLength(1)
      expect(analyticsEvents[0]).toMatchObject({
        type: 'error',
        text: 'Hello',
        to: 'he',
        cached: false,
        error: 'API Error',
        provider: 'openai',
        model: 'gpt-4o-mini',
      })
    })

    it('should not emit analytics when onAnalytics is not provided', async () => {
      const config: TranslateConfig = {
        adapter,
        model: mockModel,
      }

      await translateText(adapter, config, { text: 'Hello', to: 'he' })

      expect(analyticsEvents).toHaveLength(0)
    })
  })

  describe('detection analytics', () => {
    it('should emit analytics event on language detection', async () => {
      const config: TranslateConfig = {
        adapter,
        model: mockModel,
        onAnalytics,
      }

      await detectLanguage(config, 'Hello world')

      expect(analyticsEvents).toHaveLength(1)
      expect(analyticsEvents[0]).toMatchObject({
        type: 'detection',
        text: 'Hello world',
        from: 'en',
        cached: false,
        provider: 'openai',
        model: 'gpt-4o-mini',
      })
    })

    it('should emit error event on detection failure', async () => {
      vi.mocked(detectLanguageWithAI).mockRejectedValueOnce(new Error('Detection failed'))

      const config: TranslateConfig = {
        adapter,
        model: mockModel,
        onAnalytics,
      }

      await expect(detectLanguage(config, 'Hello')).rejects.toThrow('Detection failed')

      expect(analyticsEvents).toHaveLength(1)
      expect(analyticsEvents[0]).toMatchObject({
        type: 'error',
        text: 'Hello',
        cached: false,
        error: 'Detection failed',
      })
    })
  })

  describe('async analytics callback', () => {
    it('should handle async analytics function', async () => {
      const asyncAnalytics = vi.fn().mockResolvedValue(undefined)

      const config: TranslateConfig = {
        adapter,
        model: mockModel,
        onAnalytics: asyncAnalytics,
      }

      await translateText(adapter, config, { text: 'Hello', to: 'he' })

      expect(asyncAnalytics).toHaveBeenCalledTimes(1)
    })

    it('should not block translation when async analytics fails', async () => {
      const failingAnalytics = vi.fn().mockRejectedValue(new Error('Analytics failed'))

      const config: TranslateConfig = {
        adapter,
        model: mockModel,
        onAnalytics: failingAnalytics,
        verbose: true,
      }

      const result = await translateText(adapter, config, { text: 'Hello', to: 'he' })

      expect(result.text).toBe('[he] Hello')
      expect(failingAnalytics).toHaveBeenCalled()
    })

    it('should not block translation when sync analytics throws', async () => {
      const throwingAnalytics = vi.fn().mockImplementation(() => {
        throw new Error('Sync analytics error')
      })

      const config: TranslateConfig = {
        adapter,
        model: mockModel,
        onAnalytics: throwingAnalytics,
        verbose: true,
      }

      const result = await translateText(adapter, config, { text: 'Hello', to: 'he' })

      expect(result.text).toBe('[he] Hello')
      expect(throwingAnalytics).toHaveBeenCalled()
    })
  })

  describe('analytics duration', () => {
    it('should track duration accurately', async () => {
      vi.mocked(translateWithAI).mockImplementation(async ({ text, to }) => {
        await new Promise(resolve => setTimeout(resolve, 50))
        return { text: `[${to}] ${text}`, from: 'en' }
      })

      const config: TranslateConfig = {
        adapter,
        model: mockModel,
        onAnalytics,
      }

      await translateText(adapter, config, { text: 'Hello', to: 'he' })

      expect(analyticsEvents[0].duration).toBeGreaterThanOrEqual(50)
    })
  })
})
