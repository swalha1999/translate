import type { CacheAdapter } from './adapters/types'
import { translateText, translateBatch, detectLanguage } from './core'
import { setManualTranslation, clearManualTranslation } from './cache'

export type SupportedLanguage = 'en' | 'ar' | 'he' | 'ru'

export interface TranslateConfig {
  adapter: CacheAdapter
  provider: 'openai'
  apiKey: string
  model?: string
  languages: readonly SupportedLanguage[]
}

export interface TranslateParams {
  text: string
  to: SupportedLanguage
  from?: SupportedLanguage
  context?: string
  resourceType?: string
  resourceId?: string
  field?: string
}

export interface TranslateResult {
  text: string
  from: SupportedLanguage
  to: SupportedLanguage
  cached: boolean
  isManualOverride?: boolean
}

export interface BatchParams {
  texts: string[]
  to: SupportedLanguage
  from?: SupportedLanguage
  context?: string
}

export interface SetManualParams {
  text: string
  translatedText: string
  to: SupportedLanguage
  resourceType: string
  resourceId: string
  field: string
}

export function createTranslate(config: TranslateConfig) {
  const { adapter } = config

  return {
    text: (params: TranslateParams) => translateText(adapter, config, params),

    batch: (params: BatchParams) => translateBatch(adapter, config, params),

    setManual: (params: SetManualParams) => setManualTranslation(adapter, params),

    clearManual: (params: { resourceType: string; resourceId: string; field: string; to: SupportedLanguage }) =>
      clearManualTranslation(adapter, params),

    detectLanguage: (text: string) => detectLanguage(config, text),

    clearCache: (targetLanguage?: SupportedLanguage) =>
      targetLanguage ? adapter.deleteByLanguage(targetLanguage) : adapter.deleteAll(),

    clearResourceCache: (resourceType: string, resourceId: string) =>
      adapter.deleteByResource(resourceType, resourceId),

    getCacheStats: () => adapter.getStats(),

    isRTL: (lang: SupportedLanguage) => ['ar', 'he'].includes(lang),

    languages: config.languages,
  }
}

export type Translate = ReturnType<typeof createTranslate>
