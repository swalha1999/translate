export type SupportedLanguage = 'en' | 'ar' | 'he' | 'ru'

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
