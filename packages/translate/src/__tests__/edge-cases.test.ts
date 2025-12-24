import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createTranslate } from '../create-translate'
import { createMemoryAdapter } from '../adapters/memory'
import type { LanguageModel } from 'ai'

// Mock the AI SDK provider
vi.mock('../providers/ai-sdk', () => ({
  translateWithAI: vi.fn().mockImplementation(async ({ text, to, from }) => ({
    text: `[translated]: ${text}`,
    from: from ?? 'en',
  })),
  detectLanguageWithAI: vi.fn().mockResolvedValue({
    language: 'en',
    confidence: 0.95,
  }),
}))

vi.mock('../providers/types', () => ({
  getModelInfo: vi.fn(() => ({ provider: 'openai', modelId: 'gpt-4o-mini' })),
}))

import { translateWithAI } from '../providers/ai-sdk'

// Create a mock model
const mockModel = {
  modelId: 'gpt-4o-mini',
  provider: 'openai',
} as unknown as LanguageModel

describe('Edge Cases', () => {
  let translate: ReturnType<typeof createTranslate>

  beforeEach(() => {
    vi.clearAllMocks()
    translate = createTranslate({
      adapter: createMemoryAdapter(),
      model: mockModel,
      languages: ['en', 'ar', 'he', 'ru'] as const,
    })
  })

  describe('Unicode and Special Characters', () => {
    it('should handle Arabic text', async () => {
      const result = await translate.text({
        text: 'مرحبا بالعالم',
        to: 'en',
      })

      expect(result.text).toContain('مرحبا بالعالم')
    })

    it('should handle Hebrew text', async () => {
      const result = await translate.text({
        text: 'שלום עולם',
        to: 'en',
      })

      expect(result.text).toContain('שלום עולם')
    })

    it('should handle Russian text', async () => {
      const result = await translate.text({
        text: 'Привет мир',
        to: 'en',
      })

      expect(result.text).toContain('Привет мир')
    })

    it('should handle emoji', async () => {
      const result = await translate.text({
        text: 'Hello 👋 World 🌍',
        to: 'he',
      })

      expect(result.text).toContain('Hello 👋 World 🌍')
    })

    it('should handle mixed RTL and LTR text', async () => {
      const result = await translate.text({
        text: 'Hello שלום World עולם',
        to: 'ar',
      })

      expect(result.text).toBeDefined()
    })

    it('should handle special HTML characters', async () => {
      const result = await translate.text({
        text: '<div>Hello & World</div>',
        to: 'he',
      })

      expect(result.text).toContain('<div>Hello & World</div>')
    })

    it('should handle newlines', async () => {
      const result = await translate.text({
        text: 'Line 1\nLine 2\nLine 3',
        to: 'he',
      })

      expect(result.text).toContain('Line 1\nLine 2\nLine 3')
    })

    it('should handle tabs', async () => {
      const result = await translate.text({
        text: 'Column1\tColumn2\tColumn3',
        to: 'he',
      })

      expect(result.text).toContain('Column1\tColumn2\tColumn3')
    })

    it('should handle very long text', async () => {
      const longText = 'Hello '.repeat(1000)
      const result = await translate.text({
        text: longText,
        to: 'he',
      })

      expect(result.text).toBeDefined()
    })

    it('should handle text with numbers', async () => {
      const result = await translate.text({
        text: 'Price: $1,234.56',
        to: 'he',
      })

      expect(result.text).toContain('Price: $1,234.56')
    })

    it('should handle URLs', async () => {
      const result = await translate.text({
        text: 'Visit https://example.com for more info',
        to: 'he',
      })

      expect(result.text).toContain('https://example.com')
    })

    it('should handle email addresses', async () => {
      const result = await translate.text({
        text: 'Contact us at test@example.com',
        to: 'he',
      })

      expect(result.text).toContain('test@example.com')
    })
  })

  describe('Whitespace Handling', () => {
    it('should preserve leading whitespace', async () => {
      vi.mocked(translateWithAI).mockResolvedValueOnce({
        text: '   Hello',
        from: 'en',
      })

      const result = await translate.text({
        text: '   Hello',
        to: 'he',
      })

      expect(result.text).toBe('   Hello')
    })

    it('should preserve trailing whitespace', async () => {
      vi.mocked(translateWithAI).mockResolvedValueOnce({
        text: 'Hello   ',
        from: 'en',
      })

      const result = await translate.text({
        text: 'Hello   ',
        to: 'he',
      })

      expect(result.text).toBe('Hello   ')
    })

    it('should handle multiple spaces between words', async () => {
      const result = await translate.text({
        text: 'Hello    World',
        to: 'he',
      })

      expect(result.text).toContain('Hello    World')
    })
  })

  describe('Cache Edge Cases', () => {
    it('should cache texts that differ only by case separately', async () => {
      await translate.text({ text: 'Hello', to: 'he' })
      vi.mocked(translateWithAI).mockClear()

      await translate.text({ text: 'hello', to: 'he' })

      // Different case = different hash = new API call
      expect(translateWithAI).toHaveBeenCalledTimes(1)
    })

    it('should cache texts that differ only by whitespace separately', async () => {
      await translate.text({ text: 'Hello', to: 'he' })
      vi.mocked(translateWithAI).mockClear()

      await translate.text({ text: 'Hello ', to: 'he' })

      expect(translateWithAI).toHaveBeenCalledTimes(1)
    })

    it('should handle rapid sequential requests', async () => {
      for (let i = 0; i < 10; i++) {
        await translate.text({ text: 'Hello', to: 'he' })
      }

      // Only first request should call API
      expect(translateWithAI).toHaveBeenCalledTimes(1)
    })

    it('should handle cache after clearCache', async () => {
      await translate.text({ text: 'Hello', to: 'he' })
      await translate.clearCache()
      vi.mocked(translateWithAI).mockClear()

      await translate.text({ text: 'Hello', to: 'he' })

      expect(translateWithAI).toHaveBeenCalledTimes(1)
    })
  })

  describe('Resource-Specific Edge Cases', () => {
    it('should handle empty resourceId', async () => {
      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        resourceType: 'property',
        resourceId: '',
        field: 'title',
      })

      expect(result.text).toBeDefined()
    })

    it('should handle resourceId with special characters', async () => {
      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        resourceType: 'property',
        resourceId: 'uuid-123-abc-456',
        field: 'title',
      })

      expect(result.text).toBeDefined()
    })

    it('should handle field with dots', async () => {
      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'address.city',
      })

      expect(result.text).toBeDefined()
    })

    it('should handle partial resource info (only resourceType)', async () => {
      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        resourceType: 'property',
      })

      // Should use hash-based cache since incomplete resource info
      expect(result.text).toBeDefined()
    })
  })

  describe('Batch Edge Cases', () => {
    it('should handle batch with single item', async () => {
      const results = await translate.batch({
        texts: ['Hello'],
        to: 'he',
      })

      expect(results).toHaveLength(1)
    })

    it('should handle batch with empty strings', async () => {
      const results = await translate.batch({
        texts: ['Hello', '', 'World'],
        to: 'he',
      })

      expect(results).toHaveLength(3)
      expect(results[1].text).toBe('')
    })

    it('should handle large batch', async () => {
      const texts = Array.from({ length: 100 }, (_, i) => `Text ${i}`)
      const results = await translate.batch({
        texts,
        to: 'he',
      })

      expect(results).toHaveLength(100)
    })
  })

  describe('Manual Override Edge Cases', () => {
    it('should handle setting override with empty translatedText', async () => {
      await translate.setManual({
        text: 'Hello',
        translatedText: '',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'title',
      })

      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'title',
      })

      expect(result.text).toBe('')
      expect(result.isManualOverride).toBe(true)
    })

    it('should allow overriding an override', async () => {
      await translate.setManual({
        text: 'Hello',
        translatedText: 'שלום',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'title',
      })

      await translate.setManual({
        text: 'Hello',
        translatedText: 'היי',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'title',
      })

      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'title',
      })

      expect(result.text).toBe('היי')
    })
  })

  describe('Language Utility Edge Cases', () => {
    it('should handle isRTL with mixed case', () => {
      // isRTL is case-sensitive, so these should return false
      expect(translate.isRTL('AR' as any)).toBe(false)
      expect(translate.isRTL('He' as any)).toBe(false)
    })

    it('should handle isRTL with unknown language', () => {
      expect(translate.isRTL('fr' as any)).toBe(false)
      expect(translate.isRTL('de' as any)).toBe(false)
    })
  })

  describe('Error Scenarios', () => {
    it('should propagate API errors', async () => {
      vi.mocked(translateWithAI).mockRejectedValueOnce(new Error('API Rate Limit'))

      await expect(
        translate.text({ text: 'Hello', to: 'he' })
      ).rejects.toThrow('API Rate Limit')
    })

    it('should not cache failed translations', async () => {
      vi.mocked(translateWithAI).mockRejectedValueOnce(new Error('API Error'))

      await expect(
        translate.text({ text: 'Hello', to: 'he' })
      ).rejects.toThrow()

      // Clear mock and set successful response
      vi.mocked(translateWithAI).mockResolvedValueOnce({
        text: 'שלום',
        from: 'en',
      })

      // Should make new API call
      const result = await translate.text({ text: 'Hello', to: 'he' })
      expect(result.text).toBe('שלום')
    })
  })
})
