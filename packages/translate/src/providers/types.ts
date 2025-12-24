export interface TranslationProvider {
  translate(params: {
    text: string
    to: string
    from?: string
    context?: string
  }): Promise<{ text: string; from: string }>

  detectLanguage(text: string): Promise<{ language: string; confidence: number }>
}
