export function isRTL(lang: string): boolean {
  return ['ar', 'he'].includes(lang)
}

export function getLanguageName(code: string): string {
  const names: Record<string, string> = {
    en: 'English',
    ar: 'Arabic',
    he: 'Hebrew',
    ru: 'Russian',
  }
  return names[code] ?? code
}
