import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateWithAI, detectLanguageWithAI } from '../providers/ai-sdk'
import type { LanguageModel } from 'ai'

// Mock the AI SDK
vi.mock('ai', () => ({
  generateText: vi.fn(),
}))

import { generateText } from 'ai'

// Create a mock model
const mockModel = {
  modelId: 'gpt-4o-mini',
  provider: 'openai',
} as unknown as LanguageModel

describe('AI SDK Provider', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('translateWithAI', () => {
    describe('with known source language', () => {
      it('should return original text when source equals target', async () => {
        const result = await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'en',
          from: 'en',
        })

        expect(result.text).toBe('Hello')
        expect(result.from).toBe('en')
        expect(generateText).not.toHaveBeenCalled()
      })

      it('should translate text when source differs from target', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: 'שלום',
        } as any)

        const result = await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
          from: 'en',
        })

        expect(result.text).toBe('שלום')
        expect(result.from).toBe('en')
        expect(generateText).toHaveBeenCalledTimes(1)
      })

      it('should use language names in prompt', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: 'مرحبا',
        } as any)

        await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'ar',
          from: 'en',
        })

        const callArgs = vi.mocked(generateText).mock.calls[0][0]
        expect(callArgs.prompt).toContain('English')
        expect(callArgs.prompt).toContain('Arabic')
      })

      it('should include context in prompt when provided', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: 'דירה',
        } as any)

        await translateWithAI({
          model: mockModel,
          text: 'flat',
          to: 'he',
          from: 'en',
          context: 'real estate property type',
        })

        const callArgs = vi.mocked(generateText).mock.calls[0][0]
        expect(callArgs.prompt).toContain('real estate property type')
      })

      it('should use default context when not provided', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: 'שלום',
        } as any)

        await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
          from: 'en',
        })

        const callArgs = vi.mocked(generateText).mock.calls[0][0]
        expect(callArgs.prompt).toContain('general content')
      })

      it('should trim whitespace from response', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: '  שלום  \n',
        } as any)

        const result = await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
          from: 'en',
        })

        expect(result.text).toBe('שלום')
      })

      it('should use configured temperature', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: 'שלום',
        } as any)

        await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
          from: 'en',
          temperature: 0.1,
        })

        const callArgs = vi.mocked(generateText).mock.calls[0][0]
        expect(callArgs.temperature).toBe(0.1)
      })

      it('should handle unknown language codes gracefully', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: 'Bonjour',
        } as any)

        await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'fr',
          from: 'en',
        })

        const callArgs = vi.mocked(generateText).mock.calls[0][0]
        // Should use 'fr' as-is since it's not in LANGUAGE_NAMES
        expect(callArgs.prompt).toContain('fr')
      })
    })

    describe('with auto-detection (no source language)', () => {
      it('should detect and translate in one call', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: '{"from": "en", "text": "שלום"}',
        } as any)

        const result = await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
        })

        expect(result.text).toBe('שלום')
        expect(result.from).toBe('en')
      })

      it('should return original text when detected language equals target', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: '{"from": "he", "text": "שלום"}',
        } as any)

        const result = await translateWithAI({
          model: mockModel,
          text: 'שלום',
          to: 'he',
        })

        expect(result.text).toBe('שלום')
        expect(result.from).toBe('he')
      })

      it('should handle JSON wrapped in markdown code blocks', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: '```json\n{"from": "en", "text": "שלום"}\n```',
        } as any)

        const result = await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
        })

        expect(result.text).toBe('שלום')
        expect(result.from).toBe('en')
      })

      it('should handle JSON parse errors gracefully', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: 'not valid json',
        } as any)

        const result = await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
        })

        expect(result.text).toBe('Hello')
        expect(result.from).toBe('en')
      })

      it('should handle missing text in JSON response', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: '{"from": "en"}',
        } as any)

        const result = await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
        })

        expect(result.text).toBe('Hello')
      })

      it('should handle missing from in JSON response', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: '{"text": "שלום"}',
        } as any)

        const result = await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
        })

        expect(result.from).toBe('en')
      })

      it('should trim text from JSON response', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: '{"from": "en", "text": "  שלום  "}',
        } as any)

        const result = await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
        })

        expect(result.text).toBe('שלום')
      })

    })
  })

  describe('detectLanguageWithAI', () => {
    it('should detect valid language', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: 'ar',
      } as any)

      const result = await detectLanguageWithAI({
        model: mockModel,
        text: 'مرحبا',
      })

      expect(result.language).toBe('ar')
      expect(result.confidence).toBe(0.9)
    })

    it('should handle uppercase response', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: 'EN',
      } as any)

      const result = await detectLanguageWithAI({
        model: mockModel,
        text: 'Hello',
      })

      expect(result.language).toBe('en')
    })

    it('should handle response with whitespace', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: '  he  \n',
      } as any)

      const result = await detectLanguageWithAI({
        model: mockModel,
        text: 'שלום',
      })

      expect(result.language).toBe('he')
    })

    it('should default to en for invalid language', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: 'french',
      } as any)

      const result = await detectLanguageWithAI({
        model: mockModel,
        text: 'Bonjour',
      })

      expect(result.language).toBe('en')
    })

    it('should use temperature 0 for deterministic detection', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: 'en',
      } as any)

      await detectLanguageWithAI({
        model: mockModel,
        text: 'Hello',
      })

      const callArgs = vi.mocked(generateText).mock.calls[0][0]
      expect(callArgs.temperature).toBe(0)
    })

    it('should detect all supported languages', async () => {
      const languages = ['en', 'ar', 'he', 'ru']

      for (const lang of languages) {
        vi.mocked(generateText).mockResolvedValueOnce({
          text: lang,
        } as any)

        const result = await detectLanguageWithAI({
          model: mockModel,
          text: 'test',
        })

        expect(result.language).toBe(lang)
      }
    })
  })

  describe('error scenarios', () => {
    describe('translateWithAI errors', () => {
      it('should propagate network errors from generateText', async () => {
        vi.mocked(generateText).mockRejectedValue(new Error('Network error: ECONNREFUSED'))

        await expect(
          translateWithAI({
            model: mockModel,
            text: 'Hello',
            to: 'he',
            from: 'en',
          })
        ).rejects.toThrow('Network error: ECONNREFUSED')
      })

      it('should propagate timeout errors from generateText', async () => {
        vi.mocked(generateText).mockRejectedValue(new Error('Request timeout after 30000ms'))

        await expect(
          translateWithAI({
            model: mockModel,
            text: 'Hello',
            to: 'he',
            from: 'en',
          })
        ).rejects.toThrow('Request timeout')
      })

      it('should propagate rate limit errors from generateText', async () => {
        const rateLimitError = new Error('Rate limit exceeded')
        ;(rateLimitError as any).status = 429

        vi.mocked(generateText).mockRejectedValue(rateLimitError)

        await expect(
          translateWithAI({
            model: mockModel,
            text: 'Hello',
            to: 'he',
            from: 'en',
          })
        ).rejects.toThrow('Rate limit exceeded')
      })

      it('should handle empty string response from generateText', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: '',
        } as any)

        const result = await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
          from: 'en',
        })

        // Empty response should return empty string
        expect(result.text).toBe('')
      })

      it('should handle null response text', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: null,
        } as any)

        await expect(
          translateWithAI({
            model: mockModel,
            text: 'Hello',
            to: 'he',
            from: 'en',
          })
        ).rejects.toThrow()
      })

      it('should handle undefined response', async () => {
        vi.mocked(generateText).mockResolvedValue(undefined as any)

        await expect(
          translateWithAI({
            model: mockModel,
            text: 'Hello',
            to: 'he',
            from: 'en',
          })
        ).rejects.toThrow()
      })

      it('should handle JSON with wrong structure in auto-detect mode', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: '{"translation": "שלום", "language": "he"}',
        } as any)

        const result = await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
        })

        // Should fallback to original since structure is wrong
        expect(result.text).toBe('Hello')
      })

      it('should handle nested JSON in auto-detect mode', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: '{"from": "en", "text": {"nested": "value"}}',
        } as any)

        const result = await translateWithAI({
          model: mockModel,
          text: 'Hello',
          to: 'he',
        })

        // Should handle non-string text gracefully
        expect(result.from).toBe('en')
      })
    })

    describe('detectLanguageWithAI errors', () => {
      it('should propagate errors from generateText', async () => {
        vi.mocked(generateText).mockRejectedValue(new Error('API error'))

        await expect(
          detectLanguageWithAI({
            model: mockModel,
            text: 'Hello',
          })
        ).rejects.toThrow('API error')
      })

      it('should handle empty response for detection', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: '',
        } as any)

        const result = await detectLanguageWithAI({
          model: mockModel,
          text: 'Hello',
        })

        // Should default to 'en' for empty response
        expect(result.language).toBe('en')
      })

      it('should handle numeric-only text detection', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: 'en',
        } as any)

        const result = await detectLanguageWithAI({
          model: mockModel,
          text: '12345',
        })

        expect(result.language).toBe('en')
        expect(generateText).toHaveBeenCalled()
      })

      it('should handle emoji-only text detection', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: 'en',
        } as any)

        const result = await detectLanguageWithAI({
          model: mockModel,
          text: '👋🌍🎉',
        })

        expect(result.language).toBe('en')
      })

      it('should handle very short text detection', async () => {
        vi.mocked(generateText).mockResolvedValue({
          text: 'en',
        } as any)

        const result = await detectLanguageWithAI({
          model: mockModel,
          text: 'a',
        })

        expect(result.language).toBe('en')
      })
    })
  })

  describe('edge case inputs', () => {
    it('should handle text with null bytes', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const result = await translateWithAI({
        model: mockModel,
        text: 'Hello\x00World',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('שלום')
    })

    it('should handle text with control characters', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      const result = await translateWithAI({
        model: mockModel,
        text: 'Hello\x01\x02World',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('שלום')
    })

    it('should handle text with only whitespace variations', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: ' ',
      } as any)

      const result = await translateWithAI({
        model: mockModel,
        text: '   \t\n  ',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('')
    })

    it('should handle very long text', async () => {
      const longText = 'Hello '.repeat(10000)
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום '.repeat(10000).trim(),
      } as any)

      const result = await translateWithAI({
        model: mockModel,
        text: longText,
        to: 'he',
        from: 'en',
      })

      expect(result.text.length).toBeGreaterThan(0)
    })

    it('should handle mixed language text for detection', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: '{"from": "en", "text": "שלום mixed עולם"}',
      } as any)

      const result = await translateWithAI({
        model: mockModel,
        text: 'Hello mixed world',
        to: 'he',
      })

      expect(result.from).toBe('en')
    })

    it('should handle emoji text', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: '👋🌍🎉',
      } as any)

      const result = await translateWithAI({
        model: mockModel,
        text: '👋🌍🎉',
        to: 'he',
        from: 'en',
      })

      expect(result.text).toBe('👋🌍🎉')
    })

    it('should handle temperature at minimum (0)', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      await translateWithAI({
        model: mockModel,
        text: 'Hello',
        to: 'he',
        from: 'en',
        temperature: 0,
      })

      const callArgs = vi.mocked(generateText).mock.calls[0][0]
      expect(callArgs.temperature).toBe(0)
    })

    it('should handle temperature at maximum (2)', async () => {
      vi.mocked(generateText).mockResolvedValue({
        text: 'שלום',
      } as any)

      await translateWithAI({
        model: mockModel,
        text: 'Hello',
        to: 'he',
        from: 'en',
        temperature: 2,
      })

      const callArgs = vi.mocked(generateText).mock.calls[0][0]
      expect(callArgs.temperature).toBe(2)
    })
  })
})
