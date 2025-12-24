import { describe, it, expect } from 'vitest'
import { isRTL, getLanguageName } from '../utils'

describe('utils', () => {
  describe('isRTL', () => {
    it('should return true for Arabic', () => {
      expect(isRTL('ar')).toBe(true)
    })

    it('should return true for Hebrew', () => {
      expect(isRTL('he')).toBe(true)
    })

    it('should return false for English', () => {
      expect(isRTL('en')).toBe(false)
    })

    it('should return false for Russian', () => {
      expect(isRTL('ru')).toBe(false)
    })

    it('should return false for unknown language', () => {
      expect(isRTL('fr')).toBe(false)
    })
  })

  describe('getLanguageName', () => {
    it('should return English for en', () => {
      expect(getLanguageName('en')).toBe('English')
    })

    it('should return Arabic for ar', () => {
      expect(getLanguageName('ar')).toBe('Arabic')
    })

    it('should return Hebrew for he', () => {
      expect(getLanguageName('he')).toBe('Hebrew')
    })

    it('should return Russian for ru', () => {
      expect(getLanguageName('ru')).toBe('Russian')
    })

    it('should return code for unknown language', () => {
      expect(getLanguageName('fr')).toBe('fr')
      expect(getLanguageName('de')).toBe('de')
    })
  })
})
