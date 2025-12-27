import { describe, it, expect, beforeEach } from 'vitest'
import { createMemoryAdapter } from '../adapters/memory'
import type { CacheAdapter } from '../adapters/types'

describe('createMemoryAdapter', () => {
  let adapter: CacheAdapter

  beforeEach(() => {
    adapter = createMemoryAdapter()
  })

  describe('get/set', () => {
    it('should return null for non-existent entry', async () => {
      const result = await adapter.get('non-existent')
      expect(result).toBeNull()
    })

    it('should update existing entry on set', async () => {
      await adapter.set({
        id: 'test-update',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        isManualOverride: false,
        provider: 'openai',
      })

      await adapter.set({
        id: 'test-update',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'היי',
        isManualOverride: false,
        provider: 'openai',
      })

      const result = await adapter.get('test-update')
      expect(result?.translatedText).toBe('היי')
    })

    it('should store and retrieve an entry', async () => {
      await adapter.set({
        id: 'test-1',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        isManualOverride: false,
        provider: 'openai',
        model: 'gpt-4o-mini',
      })

      const result = await adapter.get('test-1')
      expect(result).not.toBeNull()
      expect(result?.sourceText).toBe('Hello')
      expect(result?.translatedText).toBe('שלום')
      expect(result?.sourceLanguage).toBe('en')
      expect(result?.targetLanguage).toBe('he')
    })

    it('should set timestamps on creation', async () => {
      await adapter.set({
        id: 'test-2',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        translatedText: 'مرحبا',
        isManualOverride: false,
        provider: 'openai',
      })

      const result = await adapter.get('test-2')
      expect(result?.createdAt).toBeInstanceOf(Date)
      expect(result?.updatedAt).toBeInstanceOf(Date)
      expect(result?.lastUsedAt).toBeInstanceOf(Date)
    })

    it('should handle manual override flag', async () => {
      await adapter.set({
        id: 'test-3',
        sourceText: 'flat',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'דירה',
        isManualOverride: true,
        provider: 'manual',
      })

      const result = await adapter.get('test-3')
      expect(result?.isManualOverride).toBe(true)
    })
  })

  describe('getMany', () => {
    it('should return empty map for empty ids array', async () => {
      const result = await adapter.getMany([])
      expect(result.size).toBe(0)
    })

    it('should return empty map when no entries exist', async () => {
      const result = await adapter.getMany(['non-existent-1', 'non-existent-2'])
      expect(result.size).toBe(0)
    })

    it('should retrieve multiple entries in single call', async () => {
      await adapter.set({
        id: 'batch-1',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        isManualOverride: false,
        provider: 'openai',
      })

      await adapter.set({
        id: 'batch-2',
        sourceText: 'World',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'עולם',
        isManualOverride: false,
        provider: 'openai',
      })

      await adapter.set({
        id: 'batch-3',
        sourceText: 'Test',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'בדיקה',
        isManualOverride: false,
        provider: 'openai',
      })

      const result = await adapter.getMany(['batch-1', 'batch-2', 'batch-3'])

      expect(result.size).toBe(3)
      expect(result.get('batch-1')?.translatedText).toBe('שלום')
      expect(result.get('batch-2')?.translatedText).toBe('עולם')
      expect(result.get('batch-3')?.translatedText).toBe('בדיקה')
    })

    it('should return only existing entries, ignoring missing ones', async () => {
      await adapter.set({
        id: 'existing-1',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        isManualOverride: false,
        provider: 'openai',
      })

      const result = await adapter.getMany(['existing-1', 'non-existent', 'also-missing'])

      expect(result.size).toBe(1)
      expect(result.get('existing-1')?.translatedText).toBe('שלום')
      expect(result.has('non-existent')).toBe(false)
      expect(result.has('also-missing')).toBe(false)
    })

    it('should handle duplicate ids in request', async () => {
      await adapter.set({
        id: 'dup-test',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        isManualOverride: false,
        provider: 'openai',
      })

      const result = await adapter.getMany(['dup-test', 'dup-test', 'dup-test'])

      expect(result.size).toBe(1)
      expect(result.get('dup-test')?.translatedText).toBe('שלום')
    })
  })

  describe('setMany', () => {
    it('should do nothing for empty entries array', async () => {
      await adapter.setMany([])
      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(0)
    })

    it('should store multiple entries in single call', async () => {
      await adapter.setMany([
        {
          id: 'set-many-1',
          sourceText: 'Hello',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'שלום',
          isManualOverride: false,
          provider: 'openai',
        },
        {
          id: 'set-many-2',
          sourceText: 'World',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'עולם',
          isManualOverride: false,
          provider: 'openai',
        },
        {
          id: 'set-many-3',
          sourceText: 'Test',
          sourceLanguage: 'en',
          targetLanguage: 'ar',
          translatedText: 'اختبار',
          isManualOverride: false,
          provider: 'openai',
        },
      ])

      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(3)
      expect(stats.byLanguage.he).toBe(2)
      expect(stats.byLanguage.ar).toBe(1)

      const result1 = await adapter.get('set-many-1')
      expect(result1?.translatedText).toBe('שלום')

      const result2 = await adapter.get('set-many-2')
      expect(result2?.translatedText).toBe('עולם')

      const result3 = await adapter.get('set-many-3')
      expect(result3?.translatedText).toBe('اختبار')
    })

    it('should set timestamps on all entries', async () => {
      await adapter.setMany([
        {
          id: 'ts-1',
          sourceText: 'Hello',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'שלום',
          isManualOverride: false,
          provider: 'openai',
        },
        {
          id: 'ts-2',
          sourceText: 'World',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'עולם',
          isManualOverride: false,
          provider: 'openai',
        },
      ])

      const result1 = await adapter.get('ts-1')
      const result2 = await adapter.get('ts-2')

      expect(result1?.createdAt).toBeInstanceOf(Date)
      expect(result1?.updatedAt).toBeInstanceOf(Date)
      expect(result1?.lastUsedAt).toBeInstanceOf(Date)

      expect(result2?.createdAt).toBeInstanceOf(Date)
      expect(result2?.updatedAt).toBeInstanceOf(Date)
      expect(result2?.lastUsedAt).toBeInstanceOf(Date)
    })

    it('should update existing entries with same ids', async () => {
      await adapter.setMany([
        {
          id: 'upsert-1',
          sourceText: 'Hello',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'שלום',
          isManualOverride: false,
          provider: 'openai',
        },
      ])

      await adapter.setMany([
        {
          id: 'upsert-1',
          sourceText: 'Hello',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'היי',
          isManualOverride: false,
          provider: 'openai',
        },
      ])

      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(1)

      const result = await adapter.get('upsert-1')
      expect(result?.translatedText).toBe('היי')
    })

    it('should handle mixed manual and auto translations', async () => {
      await adapter.setMany([
        {
          id: 'mixed-1',
          sourceText: 'Hello',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'שלום',
          isManualOverride: false,
          provider: 'openai',
        },
        {
          id: 'mixed-2',
          sourceText: 'World',
          sourceLanguage: 'en',
          targetLanguage: 'he',
          translatedText: 'עולם מותאם',
          isManualOverride: true,
          provider: 'manual',
        },
      ])

      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(2)
      expect(stats.manualOverrides).toBe(1)

      const result1 = await adapter.get('mixed-1')
      expect(result1?.isManualOverride).toBe(false)

      const result2 = await adapter.get('mixed-2')
      expect(result2?.isManualOverride).toBe(true)
    })
  })

  describe('touch', () => {
    it('should update lastUsedAt timestamp', async () => {
      await adapter.set({
        id: 'test-touch',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        isManualOverride: false,
        provider: 'openai',
      })

      const before = await adapter.get('test-touch')
      const beforeTime = before?.lastUsedAt.getTime()

      await new Promise(resolve => setTimeout(resolve, 10))
      await adapter.touch('test-touch')

      const after = await adapter.get('test-touch')
      expect(after?.lastUsedAt.getTime()).toBeGreaterThan(beforeTime!)
    })
  })

  describe('delete', () => {
    it('should delete an entry', async () => {
      await adapter.set({
        id: 'test-delete',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        isManualOverride: false,
        provider: 'openai',
      })

      await adapter.delete('test-delete')
      const result = await adapter.get('test-delete')
      expect(result).toBeNull()
    })

    it('should not throw when deleting non-existent entry', async () => {
      await expect(adapter.delete('non-existent')).resolves.not.toThrow()
    })
  })

  describe('deleteByResource', () => {
    it('should delete all entries for a resource', async () => {
      await adapter.set({
        id: 'res:property:123:title:he',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        resourceType: 'property',
        resourceId: '123',
        field: 'title',
        isManualOverride: false,
        provider: 'openai',
      })

      await adapter.set({
        id: 'res:property:123:description:he',
        sourceText: 'World',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'עולם',
        resourceType: 'property',
        resourceId: '123',
        field: 'description',
        isManualOverride: false,
        provider: 'openai',
      })

      const count = await adapter.deleteByResource('property', '123')
      expect(count).toBe(2)

      expect(await adapter.get('res:property:123:title:he')).toBeNull()
      expect(await adapter.get('res:property:123:description:he')).toBeNull()
    })
  })

  describe('deleteByLanguage', () => {
    it('should delete all entries for a language', async () => {
      await adapter.set({
        id: 'lang-test-1',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        isManualOverride: false,
        provider: 'openai',
      })

      await adapter.set({
        id: 'lang-test-2',
        sourceText: 'World',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'עולם',
        isManualOverride: false,
        provider: 'openai',
      })

      await adapter.set({
        id: 'lang-test-3',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        translatedText: 'مرحبا',
        isManualOverride: false,
        provider: 'openai',
      })

      const count = await adapter.deleteByLanguage('he')
      expect(count).toBe(2)

      expect(await adapter.get('lang-test-1')).toBeNull()
      expect(await adapter.get('lang-test-2')).toBeNull()
      expect(await adapter.get('lang-test-3')).not.toBeNull()
    })
  })

  describe('deleteAll', () => {
    it('should delete all entries', async () => {
      await adapter.set({
        id: 'all-1',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        isManualOverride: false,
        provider: 'openai',
      })

      await adapter.set({
        id: 'all-2',
        sourceText: 'World',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        translatedText: 'عالم',
        isManualOverride: false,
        provider: 'openai',
      })

      const count = await adapter.deleteAll()
      expect(count).toBe(2)

      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(0)
    })
  })

  describe('getStats', () => {
    it('should return correct statistics', async () => {
      await adapter.set({
        id: 'stats-1',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'שלום',
        isManualOverride: false,
        provider: 'openai',
      })

      await adapter.set({
        id: 'stats-2',
        sourceText: 'World',
        sourceLanguage: 'en',
        targetLanguage: 'he',
        translatedText: 'עולם',
        isManualOverride: true,
        provider: 'manual',
      })

      await adapter.set({
        id: 'stats-3',
        sourceText: 'Hello',
        sourceLanguage: 'en',
        targetLanguage: 'ar',
        translatedText: 'مرحبا',
        isManualOverride: false,
        provider: 'openai',
      })

      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(3)
      expect(stats.byLanguage.he).toBe(2)
      expect(stats.byLanguage.ar).toBe(1)
      expect(stats.manualOverrides).toBe(1)
    })

    it('should return empty stats for empty cache', async () => {
      const stats = await adapter.getStats()
      expect(stats.totalEntries).toBe(0)
      expect(stats.byLanguage).toEqual({})
      expect(stats.manualOverrides).toBe(0)
    })
  })
})
