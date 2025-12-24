export interface CacheEntry {
  id: string
  sourceText: string
  sourceLanguage: string
  targetLanguage: string
  translatedText: string
  resourceType?: string | null
  resourceId?: string | null
  field?: string | null
  isManualOverride: boolean
  provider: string
  model?: string | null
  createdAt: Date
  updatedAt: Date
  lastUsedAt: Date
}

export interface CacheAdapter {
  get(id: string): Promise<CacheEntry | null>
  set(entry: Omit<CacheEntry, 'createdAt' | 'updatedAt' | 'lastUsedAt'>): Promise<void>
  touch(id: string): Promise<void>
  delete(id: string): Promise<void>
  deleteByResource(resourceType: string, resourceId: string): Promise<number>
  deleteByLanguage(targetLanguage: string): Promise<number>
  deleteAll(): Promise<number>
  getStats(): Promise<{
    totalEntries: number
    byLanguage: Record<string, number>
    manualOverrides: number
  }>
}
