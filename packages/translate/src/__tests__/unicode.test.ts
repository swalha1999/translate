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

describe('Unicode and Special Characters', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('emoji handling', () => {
    it('should handle simple emoji text', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: '👋🌍🎉',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: '👋🌍🎉',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('👋🌍🎉')
    })

    it('should handle mixed emoji and text', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: '👋 שלום עולם 🌍',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: '👋 Hello World 🌍',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('👋 שלום עולם 🌍')
    })

    it('should handle complex emoji sequences (skin tones, ZWJ)', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: '👨‍👩‍👧‍👦 משפחה',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: '👨‍👩‍👧‍👦 Family',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('👨‍👩‍👧‍👦 משפחה')
    })

    it('should handle flag emojis', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: '🇮🇱 ישראל',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: '🇮🇱 Israel',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('🇮🇱 ישראל')
    })
  })

  describe('RTL text handling', () => {
    it('should handle Hebrew text', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'Hello',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: 'שלום',
        to: 'en',
        from: 'he',
      })

      expect(result.text).toBe('Hello')
    })

    it('should handle Arabic text', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'Hello',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: 'مرحبا',
        to: 'en',
        from: 'ar',
      })

      expect(result.text).toBe('Hello')
    })

    it('should handle mixed LTR/RTL text', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום Hello עולם World',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: 'Hello שלום World עולם',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('שלום Hello עולם World')
    })

    it('should verify isRTL utility for Hebrew', () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      expect(translate.isRTL('he')).toBe(true)
    })

    it('should verify isRTL utility for Arabic', () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      expect(translate.isRTL('ar')).toBe(true)
    })

    it('should verify isRTL utility for English', () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      expect(translate.isRTL('en')).toBe(false)
    })
  })

  describe('CJK characters', () => {
    it('should handle Chinese text', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'Hello',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: '你好世界',
        to: 'en',
        from: 'zh',
      })

      expect(result.text).toBe('Hello')
    })

    it('should handle Japanese text with mixed scripts', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'Hello',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: 'こんにちは世界カタカナ',
        to: 'en',
        from: 'ja',
      })

      expect(result.text).toBe('Hello')
    })

    it('should handle Korean text', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'Hello',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: '안녕하세요',
        to: 'en',
        from: 'ko',
      })

      expect(result.text).toBe('Hello')
    })
  })

  describe('combining characters', () => {
    it('should handle precomposed vs decomposed characters (NFC vs NFD)', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'café',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      // NFD: e + combining acute accent
      const nfd = 'cafe\u0301'
      // NFC: precomposed é
      const nfc = 'café'

      const result1 = await translate.text({
        text: nfd,
        to: 'he',
        from: 'en',
      })

      vi.mocked(generateText).mockResolvedValue({
        text: 'café',
      } as any)

      const result2 = await translate.text({
        text: nfc,
        to: 'he',
        from: 'en',
      })

      expect(result1.text).toBe('café')
      expect(result2.text).toBe('café')
    })

    it('should handle diacritical marks', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'resume',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: 'résumé',
        to: 'en',
        from: 'fr',
      })

      expect(result.text).toBe('resume')
    })
  })

  describe('special Unicode characters', () => {
    it('should handle zero-width characters', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      // Text with zero-width space and zero-width joiner
      const result = await translate.text({
        text: 'Hel\u200Blo\u200DWorld',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('שלום')
    })

    it('should handle surrogate pairs', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: '𝕳𝖊𝖑𝖑𝖔',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      // 𝕳 is outside BMP, uses surrogate pair
      const result = await translate.text({
        text: '𝕳𝖊𝖑𝖑𝖔',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('𝕳𝖊𝖑𝖑𝖔')
    })

    it('should handle control characters in text', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: 'Hello\x00\x01\x02World',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('שלום')
    })

    it('should handle newlines and tabs in text', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'שורה 1\nשורה 2\tעם טאב',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: 'Line 1\nLine 2\twith tab',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('שורה 1\nשורה 2\tעם טאב')
    })

    it('should handle Unicode escapes', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: '© ® ™',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: '\u00A9 \u00AE \u2122',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('© ® ™')
    })
  })

  describe('very long text without spaces', () => {
    it('should handle long word without spaces', async () => {
      const adapter = createMemoryAdapter()
      const longWord = 'a'.repeat(1000)
      vi.mocked(generateText).mockResolvedValue({
        text: 'א'.repeat(1000),
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: longWord,
        to: 'he',
        from: 'en',
      })

      expect(result.text.length).toBe(1000)
    })

    it('should handle German compound words', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'law on the delegation of duties for the monitoring of cattle',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: 'Rindfleischetikettierungsüberwachungsaufgabenübertragungsgesetz',
        to: 'en',
        from: 'de',
      })

      expect(result.text.length).toBeGreaterThan(0)
    })
  })

  describe('mathematical and technical symbols', () => {
    it('should handle mathematical symbols', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'א + ב = ג',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: 'a + b = c',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('א + ב = ג')
    })

    it('should handle currency symbols', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: '₪100 = $27',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const result = await translate.text({
        text: '$27 = ₪100',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toContain('₪')
      expect(result.text).toContain('$')
    })
  })

  describe('batch with unicode', () => {
    it('should handle batch with mixed unicode texts', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: JSON.stringify(['שלום', '你好', 'مرحبا', '👋']),
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const results = await translate.batch({
        texts: ['Hello', '你好', 'مرحبا', '👋'],
        to: 'he',
        from: 'en',
      })

      expect(results).toHaveLength(4)
    })
  })

  describe('object translation with unicode', () => {
    it('should handle object with unicode field values', async () => {
      const adapter = createMemoryAdapter()
      vi.mocked(generateText).mockResolvedValue({
        text: 'תרגום',
      } as any)

      const translate = createTranslate({
        model: mockModel,
        adapter,
      })

      const obj = {
        id: '1',
        title: '👋 Hello 世界',
        description: 'مرحبا שלום',
      }

      const result = await translate.object(obj, {
        fields: ['title', 'description'],
        to: 'he',
      })

      expect(result.id).toBe('1')
      expect(result.title).toBeDefined()
      expect(result.description).toBeDefined()
    })
  })
})
