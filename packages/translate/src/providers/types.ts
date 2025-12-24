import type { LanguageModel } from 'ai'

export interface TranslationProvider {
  translate(params: {
    text: string
    to: string
    from?: string
    context?: string
  }): Promise<{ text: string; from: string }>

  detectLanguage(text: string): Promise<{ language: string; confidence: number }>
}

export interface ModelInfo {
  provider: string
  modelId: string
}

export function getModelInfo(model: LanguageModel): ModelInfo {
  // Handle different model formats - could be string or object with various shapes
  const modelAny = model as any
  const modelId = modelAny.modelId ?? String(model)
  const provider = modelAny.provider ?? 'unknown'

  return { provider, modelId }
}
