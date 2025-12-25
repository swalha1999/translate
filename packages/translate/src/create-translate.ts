import type { LanguageModel } from 'ai'
import type { CacheAdapter } from './adapters/types'
import { translateText, translateBatch, detectLanguage, translateObject, translateObjects } from './core'
import { setManualTranslation, clearManualTranslation } from './cache'

export type SupportedLanguage = 'en' | 'ar' | 'he' | 'ru' | 'ja' | 'ko' | 'zh' | 'hi' | 'el' | 'th' | 'fr' | 'de'

export interface TranslateConfig {
  adapter: CacheAdapter
  model: LanguageModel
  languages?: readonly SupportedLanguage[]
  temperature?: number
  defaultLanguage?: SupportedLanguage
  verbose?: boolean
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

// Extract keys where value is string | null | undefined
export type StringKeys<T> = {
  [K in keyof T]: T[K] extends string | null | undefined ? K : never
}[keyof T]

export interface ObjectTranslateParams<T, K extends StringKeys<T>> {
  fields: K[]
  to: SupportedLanguage
  from?: SupportedLanguage
  context?: string
  resourceType?: string
  resourceIdField?: keyof T
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

    object: <T extends object, K extends StringKeys<T>>(
      item: T,
      params: ObjectTranslateParams<T, K>
    ) => translateObject(adapter, config, item, params),

    objects: <T extends object, K extends StringKeys<T>>(
      items: T[],
      params: ObjectTranslateParams<T, K>
    ) => translateObjects(adapter, config, items, params),
  }
}

export type Translate = ReturnType<typeof createTranslate>
