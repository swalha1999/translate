// Re-export AI SDK provider functions for simpler developer experience
export { openai } from '@ai-sdk/openai'
export { anthropic } from '@ai-sdk/anthropic'
export { google } from '@ai-sdk/google'
export { mistral } from '@ai-sdk/mistral'
export { groq } from '@ai-sdk/groq'

// Re-export AI SDK types for custom implementations
export type { LanguageModel, GenerateTextResult } from 'ai'

// Internal translation functions
export { translateWithAI, detectLanguageWithAI } from './ai-sdk'

// Types and utilities
export type { TranslationProvider, ModelInfo } from './types'
export { getModelInfo } from './types'
