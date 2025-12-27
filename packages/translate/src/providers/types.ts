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

// Type guard to check if model has modelId property
function hasModelId(model: unknown): model is { modelId: string } {
  return typeof model === 'object' && model !== null && 'modelId' in model && typeof (model as Record<string, unknown>).modelId === 'string'
}

// Type guard to check if model has provider property
function hasProvider(model: unknown): model is { provider: string } {
  return typeof model === 'object' && model !== null && 'provider' in model && typeof (model as Record<string, unknown>).provider === 'string'
}

export function getModelInfo(model: LanguageModel): ModelInfo {
  // Safely extract model info using type guards
  const modelId = hasModelId(model) ? model.modelId : String(model)
  const provider = hasProvider(model) ? model.provider : 'unknown'

  return { provider, modelId }
}
