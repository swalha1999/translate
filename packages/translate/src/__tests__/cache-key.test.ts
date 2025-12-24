import { describe, it, expect } from 'vitest'
import { hashText, createHashKey, createResourceKey, hasResourceInfo } from '../cache-key'

describe('cache-key', () => {
  describe('hashText', () => {
    it('should return consistent hash for same text', () => {
      const text = 'Hello world'
      expect(hashText(text)).toBe(hashText(text))
    })

    it('should return different hashes for different texts', () => {
      expect(hashText('Hello')).not.toBe(hashText('World'))
    })

    it('should handle empty string', () => {
      expect(hashText('')).toBe('0')
    })

    it('should handle unicode text', () => {
      const hash = hashText('שלום עולם')
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })

    it('should handle Arabic text', () => {
      const hash = hashText('مرحبا بالعالم')
      expect(typeof hash).toBe('string')
      expect(hash.length).toBeGreaterThan(0)
    })
  })

  describe('createHashKey', () => {
    it('should create key with hash prefix', () => {
      const key = createHashKey('Hello', 'he')
      expect(key).toMatch(/^hash:.+:he$/)
    })

    it('should create different keys for different languages', () => {
      const key1 = createHashKey('Hello', 'he')
      const key2 = createHashKey('Hello', 'ar')
      expect(key1).not.toBe(key2)
    })

    it('should create same key for same text and language', () => {
      const key1 = createHashKey('Hello', 'he')
      const key2 = createHashKey('Hello', 'he')
      expect(key1).toBe(key2)
    })
  })

  describe('createResourceKey', () => {
    it('should create key with res prefix', () => {
      const key = createResourceKey('property', '123', 'title', 'he')
      expect(key).toBe('res:property:123:title:he')
    })

    it('should create different keys for different resources', () => {
      const key1 = createResourceKey('property', '123', 'title', 'he')
      const key2 = createResourceKey('property', '456', 'title', 'he')
      expect(key1).not.toBe(key2)
    })

    it('should create different keys for different fields', () => {
      const key1 = createResourceKey('property', '123', 'title', 'he')
      const key2 = createResourceKey('property', '123', 'description', 'he')
      expect(key1).not.toBe(key2)
    })
  })

  describe('hasResourceInfo', () => {
    it('should return true when all resource info is provided', () => {
      expect(hasResourceInfo({
        resourceType: 'property',
        resourceId: '123',
        field: 'title',
      })).toBe(true)
    })

    it('should return false when resourceType is missing', () => {
      expect(hasResourceInfo({
        resourceId: '123',
        field: 'title',
      })).toBe(false)
    })

    it('should return false when resourceId is missing', () => {
      expect(hasResourceInfo({
        resourceType: 'property',
        field: 'title',
      })).toBe(false)
    })

    it('should return false when field is missing', () => {
      expect(hasResourceInfo({
        resourceType: 'property',
        resourceId: '123',
      })).toBe(false)
    })

    it('should return false for empty object', () => {
      expect(hasResourceInfo({})).toBe(false)
    })
  })
})
