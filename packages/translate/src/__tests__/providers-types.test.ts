import { describe, it, expect } from 'vitest'
import { getModelInfo } from '../providers/types'
import type { LanguageModel } from 'ai'

describe('getModelInfo', () => {
  describe('valid inputs', () => {
    it('should extract info from model with provider and modelId', () => {
      const model = {
        modelId: 'gpt-4o-mini',
        provider: 'openai',
      } as unknown as LanguageModel

      const info = getModelInfo(model)

      expect(info.modelId).toBe('gpt-4o-mini')
      expect(info.provider).toBe('openai')
    })

    it('should extract info from model with only modelId', () => {
      const model = {
        modelId: 'claude-3-opus',
      } as unknown as LanguageModel

      const info = getModelInfo(model)

      expect(info.modelId).toBe('claude-3-opus')
      expect(info.provider).toBe('unknown')
    })

    it('should extract info from model with nested provider object', () => {
      const model = {
        modelId: 'gpt-4',
        provider: 'openai',
        config: { nested: true },
      } as unknown as LanguageModel

      const info = getModelInfo(model)

      expect(info.modelId).toBe('gpt-4')
      expect(info.provider).toBe('openai')
    })

    it('should handle model with string provider', () => {
      const model = {
        modelId: 'mistral-large',
        provider: 'mistral',
      } as unknown as LanguageModel

      const info = getModelInfo(model)

      expect(info.provider).toBe('mistral')
    })

    it('should handle anthropic model format', () => {
      const model = {
        modelId: 'claude-3-5-sonnet-20241022',
        provider: 'anthropic',
      } as unknown as LanguageModel

      const info = getModelInfo(model)

      expect(info.modelId).toBe('claude-3-5-sonnet-20241022')
      expect(info.provider).toBe('anthropic')
    })

    it('should handle google model format', () => {
      const model = {
        modelId: 'gemini-1.5-pro',
        provider: 'google',
      } as unknown as LanguageModel

      const info = getModelInfo(model)

      expect(info.modelId).toBe('gemini-1.5-pro')
      expect(info.provider).toBe('google')
    })
  })

  describe('edge cases', () => {
    it('should handle empty object', () => {
      const model = {} as unknown as LanguageModel

      const info = getModelInfo(model)

      expect(info.modelId).toBe('[object Object]')
      expect(info.provider).toBe('unknown')
    })

    it('should handle object with extra properties', () => {
      const model = {
        modelId: 'gpt-4',
        provider: 'openai',
        temperature: 0.7,
        maxTokens: 1000,
        customField: 'value',
      } as unknown as LanguageModel

      const info = getModelInfo(model)

      expect(info.modelId).toBe('gpt-4')
      expect(info.provider).toBe('openai')
      // Should only extract provider and modelId
      expect(info).not.toHaveProperty('temperature')
      expect(info).not.toHaveProperty('maxTokens')
    })

    it('should handle model with numeric provider (converts to string)', () => {
      const model = {
        modelId: 'test-model',
        provider: 123,
      } as unknown as LanguageModel

      const info = getModelInfo(model)

      expect(info.provider).toBe(123)
    })

    it('should handle model with null modelId', () => {
      const model = {
        modelId: null,
        provider: 'test',
      } as unknown as LanguageModel

      const info = getModelInfo(model)

      // null ?? String(model) should use String(model)
      expect(info.modelId).toBe('[object Object]')
    })

    it('should handle model with undefined provider', () => {
      const model = {
        modelId: 'test-model',
        provider: undefined,
      } as unknown as LanguageModel

      const info = getModelInfo(model)

      expect(info.provider).toBe('unknown')
    })

    it('should handle model with empty string modelId', () => {
      const model = {
        modelId: '',
        provider: 'test',
      } as unknown as LanguageModel

      const info = getModelInfo(model)

      // Empty string is falsy but not nullish, so ?? won't trigger
      expect(info.modelId).toBe('')
    })

    it('should handle model with empty string provider', () => {
      const model = {
        modelId: 'test',
        provider: '',
      } as unknown as LanguageModel

      const info = getModelInfo(model)

      // Empty string is falsy but not nullish, so ?? won't trigger
      expect(info.provider).toBe('')
    })
  })

  describe('string coercion', () => {
    it('should convert non-object model to string for modelId', () => {
      // This is an edge case where model might be a string identifier
      const model = 'gpt-4' as unknown as LanguageModel

      const info = getModelInfo(model)

      expect(info.modelId).toBe('gpt-4')
      expect(info.provider).toBe('unknown')
    })

    it('should handle model that is a number', () => {
      const model = 12345 as unknown as LanguageModel

      const info = getModelInfo(model)

      expect(info.modelId).toBe('12345')
      expect(info.provider).toBe('unknown')
    })
  })

  describe('return type', () => {
    it('should return object with exactly two properties', () => {
      const model = {
        modelId: 'gpt-4',
        provider: 'openai',
      } as unknown as LanguageModel

      const info = getModelInfo(model)
      const keys = Object.keys(info)

      expect(keys).toHaveLength(2)
      expect(keys).toContain('provider')
      expect(keys).toContain('modelId')
    })

    it('should return new object each call', () => {
      const model = {
        modelId: 'gpt-4',
        provider: 'openai',
      } as unknown as LanguageModel

      const info1 = getModelInfo(model)
      const info2 = getModelInfo(model)

      expect(info1).not.toBe(info2)
      expect(info1).toEqual(info2)
    })
  })
})
