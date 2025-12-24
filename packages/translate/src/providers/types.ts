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
  const modelId = model.modelId
  // Extract provider from model - the modelId typically starts with provider prefix
  // e.g., 'gpt-4o-mini' for OpenAI, 'claude-3-haiku' for Anthropic
  const provider = model.provider ?? 'unknown'

  return { provider, modelId }
}
