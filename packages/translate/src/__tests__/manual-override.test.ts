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
  languages: ['en', 'he', 'ar', 'ru'] as const,
}

describe('Manual Override', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('setting overrides', () => {
    it('should create override for non-existent resource', async () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      await translate.setManual({
        text: 'flat',
        translatedText: 'דירה',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      // Verify override is used
      const result = await translate.text({
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      expect(result.text).toBe('דירה')
      expect(result.isManualOverride).toBe(true)
      expect(generateText).not.toHaveBeenCalled()
    })

    it('should update override when set again with different translation', async () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // Set initial override
      await translate.setManual({
        text: 'flat',
        translatedText: 'דירה',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      // Update override
      await translate.setManual({
        text: 'flat',
        translatedText: 'דירת גג',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      const result = await translate.text({
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      expect(result.text).toBe('דירת גג')
    })

    it('should set override with empty translated text', async () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      await translate.setManual({
        text: 'optional field',
        translatedText: '',
        to: 'he',
        resourceType: 'form',
        resourceId: '1',
        field: 'hint',
      })

      const result = await translate.text({
        text: 'optional field',
        to: 'he',
        resourceType: 'form',
        resourceId: '1',
        field: 'hint',
      })

      expect(result.text).toBe('')
      expect(result.isManualOverride).toBe(true)
    })

    it('should handle override with special characters', async () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      await translate.setManual({
        text: 'Hello <world> & "friends"',
        translatedText: 'שלום <עולם> & "חברים"',
        to: 'he',
        resourceType: 'message',
        resourceId: '1',
        field: 'content',
      })

      const result = await translate.text({
        text: 'Hello <world> & "friends"',
        to: 'he',
        resourceType: 'message',
        resourceId: '1',
        field: 'content',
      })

      expect(result.text).toBe('שלום <עולם> & "חברים"')
    })
  })

  describe('clearing overrides', () => {
    it('should not error when clearing non-existent override', async () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // Should not throw
      await expect(
        translate.clearManual({
          resourceType: 'nonexistent',
          resourceId: '999',
          field: 'title',
          to: 'he',
        })
      ).resolves.not.toThrow()
    })

    it('should use AI translation after clearing override', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockResolvedValue({
        text: 'תרגום מ-AI',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // Set override
      await translate.setManual({
        text: 'Hello',
        translatedText: 'תרגום ידני',
        to: 'he',
        resourceType: 'greeting',
        resourceId: '1',
        field: 'text',
      })

      // Clear override
      await translate.clearManual({
        resourceType: 'greeting',
        resourceId: '1',
        field: 'text',
        to: 'he',
      })

      // Should now use AI
      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
        resourceType: 'greeting',
        resourceId: '1',
        field: 'text',
      })

      expect(result.text).toBe('תרגום מ-AI')
      expect(result.isManualOverride).toBeFalsy()
      expect(generateText).toHaveBeenCalled()
    })

    it('should clear all overrides for a resource via clearResourceCache', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockResolvedValue({
        text: 'AI translation',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // Set multiple overrides for same resource
      await translate.setManual({
        text: 'Title',
        translatedText: 'כותרת',
        to: 'he',
        resourceType: 'todo',
        resourceId: '1',
        field: 'title',
      })

      await translate.setManual({
        text: 'Description',
        translatedText: 'תיאור',
        to: 'he',
        resourceType: 'todo',
        resourceId: '1',
        field: 'description',
      })

      // Clear all for resource
      await translate.clearResourceCache('todo', '1')

      // Both should now use AI
      const titleResult = await translate.text({
        text: 'Title',
        to: 'he',
        resourceType: 'todo',
        resourceId: '1',
        field: 'title',
      })

      expect(titleResult.isManualOverride).toBeFalsy()
    })
  })

  describe('priority testing', () => {
    it('should prioritize manual override over hash cache', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockResolvedValue({
        text: 'AI cached',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // First, translate to populate hash cache
      await translate.text({
        text: 'Hello',
        to: 'he',
        from: 'en',
      })

      // Then set manual override for specific resource
      await translate.setManual({
        text: 'Hello',
        translatedText: 'Manual override',
        to: 'he',
        resourceType: 'greeting',
        resourceId: '1',
        field: 'text',
      })

      // Resource-specific request should use manual override
      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        resourceType: 'greeting',
        resourceId: '1',
        field: 'text',
      })

      expect(result.text).toBe('Manual override')
      expect(result.isManualOverride).toBe(true)
    })

    it('should prioritize manual override over resource cache', async () => {
      const adapter = createMemoryAdapter()

      vi.mocked(generateText).mockResolvedValue({
        text: 'AI resource cached',
      } as any)

      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // First, translate with resource info to populate resource cache
      await translate.text({
        text: 'Hello',
        to: 'he',
        resourceType: 'greeting',
        resourceId: '1',
        field: 'text',
      })

      // Then set manual override (should take priority)
      await translate.setManual({
        text: 'Hello',
        translatedText: 'Manual wins',
        to: 'he',
        resourceType: 'greeting',
        resourceId: '1',
        field: 'text',
      })

      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        resourceType: 'greeting',
        resourceId: '1',
        field: 'text',
      })

      expect(result.text).toBe('Manual wins')
      expect(result.isManualOverride).toBe(true)
    })

    it('should maintain separate overrides for different fields of same resource', async () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // Set different overrides for different fields
      await translate.setManual({
        text: 'Title text',
        translatedText: 'כותרת מותאמת',
        to: 'he',
        resourceType: 'todo',
        resourceId: '1',
        field: 'title',
      })

      await translate.setManual({
        text: 'Description text',
        translatedText: 'תיאור מותאם',
        to: 'he',
        resourceType: 'todo',
        resourceId: '1',
        field: 'description',
      })

      // Verify each field has its own override
      const titleResult = await translate.text({
        text: 'Title text',
        to: 'he',
        resourceType: 'todo',
        resourceId: '1',
        field: 'title',
      })

      const descResult = await translate.text({
        text: 'Description text',
        to: 'he',
        resourceType: 'todo',
        resourceId: '1',
        field: 'description',
      })

      expect(titleResult.text).toBe('כותרת מותאמת')
      expect(descResult.text).toBe('תיאור מותאם')
    })

    it('should maintain separate overrides for different languages', async () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      await translate.setManual({
        text: 'Hello',
        translatedText: 'שלום',
        to: 'he',
        resourceType: 'greeting',
        resourceId: '1',
        field: 'text',
      })

      await translate.setManual({
        text: 'Hello',
        translatedText: 'مرحبا',
        to: 'ar',
        resourceType: 'greeting',
        resourceId: '1',
        field: 'text',
      })

      const heResult = await translate.text({
        text: 'Hello',
        to: 'he',
        resourceType: 'greeting',
        resourceId: '1',
        field: 'text',
      })

      const arResult = await translate.text({
        text: 'Hello',
        to: 'ar',
        resourceType: 'greeting',
        resourceId: '1',
        field: 'text',
      })

      expect(heResult.text).toBe('שלום')
      expect(arResult.text).toBe('مرحبا')
    })
  })

  describe('edge cases', () => {
    it('should handle override with very long text', async () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      const longText = 'A'.repeat(10000)
      const longTranslation = 'א'.repeat(10000)

      await translate.setManual({
        text: longText,
        translatedText: longTranslation,
        to: 'he',
        resourceType: 'article',
        resourceId: '1',
        field: 'content',
      })

      const result = await translate.text({
        text: longText,
        to: 'he',
        resourceType: 'article',
        resourceId: '1',
        field: 'content',
      })

      expect(result.text).toBe(longTranslation)
    })

    it('should handle override with unicode text', async () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      await translate.setManual({
        text: '👋 Hello 世界',
        translatedText: '👋 שלום עולם',
        to: 'he',
        resourceType: 'emoji',
        resourceId: '1',
        field: 'greeting',
      })

      const result = await translate.text({
        text: '👋 Hello 世界',
        to: 'he',
        resourceType: 'emoji',
        resourceId: '1',
        field: 'greeting',
      })

      expect(result.text).toBe('👋 שלום עולם')
    })

    it('should handle concurrent setManual calls for same resource', async () => {
      const adapter = createMemoryAdapter()
      const translate = createTranslate({
        ...defaultConfig,
        adapter,
      })

      // Concurrent updates - last one should win
      await Promise.all([
        translate.setManual({
          text: 'Hello',
          translatedText: 'First',
          to: 'he',
          resourceType: 'test',
          resourceId: '1',
          field: 'text',
        }),
        translate.setManual({
          text: 'Hello',
          translatedText: 'Second',
          to: 'he',
          resourceType: 'test',
          resourceId: '1',
          field: 'text',
        }),
        translate.setManual({
          text: 'Hello',
          translatedText: 'Third',
          to: 'he',
          resourceType: 'test',
          resourceId: '1',
          field: 'text',
        }),
      ])

      // One of them should be the result (order not guaranteed)
      const result = await translate.text({
        text: 'Hello',
        to: 'he',
        resourceType: 'test',
        resourceId: '1',
        field: 'text',
      })

      expect(['First', 'Second', 'Third']).toContain(result.text)
      expect(result.isManualOverride).toBe(true)
    })
  })
})
