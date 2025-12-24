import { describe, it, expect, beforeEach } from 'vitest'
import { getCached, setCache, setManualTranslation, clearManualTranslation } from '../cache'
import { createMemoryAdapter } from '../adapters/memory'
import type { CacheAdapter } from '../adapters/types'

describe('cache', () => {
  let adapter: CacheAdapter

  beforeEach(() => {
    adapter = createMemoryAdapter()
  })

  describe('getCached', () => {
    it('should return null for uncached text', async () => {
      const result = await getCached(adapter, {
        text: 'Hello',
        to: 'he',
      })
      expect(result).toBeNull()
    })

    it('should return cached translation', async () => {
      await setCache(adapter, {
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        provider: 'openai',
      })

      const result = await getCached(adapter, {
        text: 'Hello',
        to: 'he',
      })

      expect(result).not.toBeNull()
      expect(result?.text).toBe('שלום')
      expect(result?.from).toBe('en')
      expect(result?.isManualOverride).toBe(false)
    })

    it('should prioritize resource-specific cache over hash cache', async () => {
      // Set hash-based cache
      await setCache(adapter, {
        sourceText: 'flat',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שטוח',
        provider: 'openai',
      })

      // Set resource-specific cache
      await setCache(adapter, {
        sourceText: 'flat',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'דירה',
        provider: 'openai',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      // Without resource info, should get hash-based
      const hashResult = await getCached(adapter, {
        text: 'flat',
        to: 'he',
      })
      expect(hashResult?.text).toBe('שטוח')

      // With resource info, should get resource-specific
      const resourceResult = await getCached(adapter, {
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })
      expect(resourceResult?.text).toBe('דירה')
    })

    it('should fall back to hash cache when resource-specific not found', async () => {
      await setCache(adapter, {
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        provider: 'openai',
      })

      const result = await getCached(adapter, {
        text: 'Hello',
        to: 'he',
        resourceType: 'property',
        resourceId: '999',
        field: 'title',
      })

      expect(result?.text).toBe('שלום')
    })
  })

  describe('setCache', () => {
    it('should store hash-based cache for simple text', async () => {
      await setCache(adapter, {
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        translatedText: 'مرحبا',
        provider: 'openai',
        model: 'gpt-4o-mini',
      })

      const result = await getCached(adapter, { text: 'Hello', to: 'ar' })
      expect(result?.text).toBe('مرحبا')
    })

    it('should store resource-specific cache when resource info provided', async () => {
      await setCache(adapter, {
        sourceText: 'flat',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'דירה',
        provider: 'openai',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      const result = await getCached(adapter, {
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })
      expect(result?.text).toBe('דירה')
    })
  })

  describe('setManualTranslation', () => {
    it('should create manual override entry', async () => {
      await setManualTranslation(adapter, {
        text: 'flat',
        translatedText: 'דירה',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      const result = await getCached(adapter, {
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      expect(result?.text).toBe('דירה')
      expect(result?.isManualOverride).toBe(true)
    })
  })

  describe('clearManualTranslation', () => {
    it('should remove manual override entry', async () => {
      await setManualTranslation(adapter, {
        text: 'flat',
        translatedText: 'דירה',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      await clearManualTranslation(adapter, {
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
        to: 'he',
      })

      const result = await getCached(adapter, {
        text: 'flat',
        to: 'he',
        resourceType: 'property',
        resourceId: '123',
        field: 'type',
      })

      expect(result).toBeNull()
    })
  })
})
