import { describe, it, expect, vi, beforeEach } from 'vitest'
import { translateWithOpenAI, detectLanguageWithOpenAI } from '../providers/openai'

// Mock the OpenAI module
vi.mock('openai', () => {
  return {
    default: vi.fn().mockImplementation(() => ({
      chat: {
        completions: {
          create: vi.fn(),
        },
      },
    })),
  }
})

import OpenAI from 'openai'

describe('OpenAI Provider', () => {
  let mockCreate: ReturnType<typeof vi.fn>

  beforeEach(() => {
    vi.clearAllMocks()
    mockCreate = vi.fn()
    ;(OpenAI as unknown as ReturnType<typeof vi.fn>).mockImplementation(() => ({
      chat: {
        completions: {
          create: mockCreate,
        },
      },
    }))
  })

  describe('translateWithOpenAI', () => {
    describe('with known source language', () => {
      it('should return original text when source equals target', async () => {
        const result = await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'en',
          from: 'en',
        })

        expect(result.text).toBe('Hello')
        expect(result.from).toBe('en')
        expect(mockCreate).not.toHaveBeenCalled()
      })

      it('should translate text when source differs from target', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'שלום' } }],
        })

        const result = await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'he',
          from: 'en',
        })

        expect(result.text).toBe('שלום')
        expect(result.from).toBe('en')
        expect(mockCreate).toHaveBeenCalledTimes(1)
      })

      it('should use language names in prompt', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'مرحبا' } }],
        })

        await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'ar',
          from: 'en',
        })

        const callArgs = mockCreate.mock.calls[0][0]
        expect(callArgs.messages[0].content).toContain('English')
        expect(callArgs.messages[0].content).toContain('Arabic')
      })

      it('should include context in prompt when provided', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'דירה' } }],
        })

        await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'flat',
          to: 'he',
          from: 'en',
          context: 'real estate property type',
        })

        const callArgs = mockCreate.mock.calls[0][0]
        expect(callArgs.messages[0].content).toContain('real estate property type')
      })

      it('should use default context when not provided', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'שלום' } }],
        })

        await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'he',
          from: 'en',
        })

        const callArgs = mockCreate.mock.calls[0][0]
        expect(callArgs.messages[0].content).toContain('general content')
      })

      it('should handle null response content', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: null } }],
        })

        const result = await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'he',
          from: 'en',
        })

        expect(result.text).toBe('Hello')
      })

      it('should trim whitespace from response', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: '  שלום  \n' } }],
        })

        const result = await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'he',
          from: 'en',
        })

        expect(result.text).toBe('שלום')
      })

      it('should use correct model in API call', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'שלום' } }],
        })

        await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4-turbo',
          text: 'Hello',
          to: 'he',
          from: 'en',
        })

        const callArgs = mockCreate.mock.calls[0][0]
        expect(callArgs.model).toBe('gpt-4-turbo')
      })

      it('should set appropriate max_tokens based on text length', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'שלום' } }],
        })

        await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello world',
          to: 'he',
          from: 'en',
        })

        const callArgs = mockCreate.mock.calls[0][0]
        expect(callArgs.max_tokens).toBe(11 * 3) // text.length * 3
      })

      it('should handle unknown language codes gracefully', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'Bonjour' } }],
        })

        await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'fr',
          from: 'en',
        })

        const callArgs = mockCreate.mock.calls[0][0]
        // Should use 'fr' as-is since it's not in LANGUAGE_NAMES
        expect(callArgs.messages[0].content).toContain('fr')
      })
    })

    describe('with auto-detection (no source language)', () => {
      it('should detect and translate in one call', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: '{"from": "en", "text": "שלום"}' } }],
        })

        const result = await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'he',
        })

        expect(result.text).toBe('שלום')
        expect(result.from).toBe('en')
      })

      it('should return original text when detected language equals target', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: '{"from": "he", "text": "שלום"}' } }],
        })

        const result = await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'שלום',
          to: 'he',
        })

        expect(result.text).toBe('שלום')
        expect(result.from).toBe('he')
      })

      it('should use json_object response format', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: '{"from": "en", "text": "שלום"}' } }],
        })

        await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'he',
        })

        const callArgs = mockCreate.mock.calls[0][0]
        expect(callArgs.response_format).toEqual({ type: 'json_object' })
      })

      it('should handle JSON parse errors gracefully', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: 'not valid json' } }],
        })

        const result = await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'he',
        })

        expect(result.text).toBe('Hello')
        expect(result.from).toBe('en')
      })

      it('should handle null response content in JSON mode', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: null } }],
        })

        const result = await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'he',
        })

        expect(result.text).toBe('Hello')
        expect(result.from).toBe('en')
      })

      it('should handle missing text in JSON response', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: '{"from": "en"}' } }],
        })

        const result = await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'he',
        })

        expect(result.text).toBe('Hello')
      })

      it('should handle missing from in JSON response', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: '{"text": "שלום"}' } }],
        })

        const result = await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'he',
        })

        expect(result.from).toBe('en')
      })

      it('should trim text from JSON response', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: '{"from": "en", "text": "  שלום  "}' } }],
        })

        const result = await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'he',
        })

        expect(result.text).toBe('שלום')
      })

      it('should add extra tokens for JSON overhead', async () => {
        mockCreate.mockResolvedValue({
          choices: [{ message: { content: '{"from": "en", "text": "שלום"}' } }],
        })

        await translateWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'Hello',
          to: 'he',
        })

        const callArgs = mockCreate.mock.calls[0][0]
        expect(callArgs.max_tokens).toBe(5 * 3 + 50) // text.length * 3 + 50
      })
    })
  })

  describe('detectLanguageWithOpenAI', () => {
    it('should detect valid language', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'ar' } }],
      })

      const result = await detectLanguageWithOpenAI({
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        text: 'مرحبا',
      })

      expect(result.language).toBe('ar')
      expect(result.confidence).toBe(0.9)
    })

    it('should handle uppercase response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'EN' } }],
      })

      const result = await detectLanguageWithOpenAI({
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        text: 'Hello',
      })

      expect(result.language).toBe('en')
    })

    it('should handle response with whitespace', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: '  he  \n' } }],
      })

      const result = await detectLanguageWithOpenAI({
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        text: 'שלום',
      })

      expect(result.language).toBe('he')
    })

    it('should default to en for invalid language', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'french' } }],
      })

      const result = await detectLanguageWithOpenAI({
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        text: 'Bonjour',
      })

      expect(result.language).toBe('en')
    })

    it('should default to en for null response', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: null } }],
      })

      const result = await detectLanguageWithOpenAI({
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        text: 'Hello',
      })

      expect(result.language).toBe('en')
    })

    it('should use temperature 0 for deterministic detection', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'en' } }],
      })

      await detectLanguageWithOpenAI({
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        text: 'Hello',
      })

      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.temperature).toBe(0)
    })

    it('should use max_tokens of 5', async () => {
      mockCreate.mockResolvedValue({
        choices: [{ message: { content: 'en' } }],
      })

      await detectLanguageWithOpenAI({
        apiKey: 'test-key',
        model: 'gpt-4o-mini',
        text: 'Hello',
      })

      const callArgs = mockCreate.mock.calls[0][0]
      expect(callArgs.max_tokens).toBe(5)
    })

    it('should detect all supported languages', async () => {
      const languages = ['en', 'ar', 'he', 'ru']

      for (const lang of languages) {
        mockCreate.mockResolvedValueOnce({
          choices: [{ message: { content: lang } }],
        })

        const result = await detectLanguageWithOpenAI({
          apiKey: 'test-key',
          model: 'gpt-4o-mini',
          text: 'test',
        })

        expect(result.language).toBe(lang)
      }
    })
  })
})
