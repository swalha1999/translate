import { eq, and, sql } from 'drizzle-orm'
import type { CacheAdapter, CacheEntry } from '@swalha1999/translate'

interface DrizzleTable {
  id: any
  sourceText: any
  sourceLanguage: any
  targetLanguage: any
  translatedText: any
  resourceType: any
  resourceId: any
  field: any
  isManualOverride: any
  provider: any
  model: any
  createdAt: any
  updatedAt: any
  lastUsedAt: any
}

export interface DrizzleAdapterConfig {
  db: any
  table: DrizzleTable
}

export function createDrizzleAdapter(config: DrizzleAdapterConfig): CacheAdapter {
  const { db, table } = config

  return {
    async get(id: string): Promise<CacheEntry | null> {
      const [row] = await db
        .select()
        .from(table)
        .where(eq(table.id, id))
        .limit(1)
      return row ?? null
    },

    async set(entry): Promise<void> {
      const now = new Date()
      await db
        .insert(table)
        .values({
          ...entry,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: now,
        })
        .onConflictDoUpdate({
          target: table.id,
          set: {
            translatedText: entry.translatedText,
            sourceLanguage: entry.sourceLanguage,
            isManualOverride: entry.isManualOverride,
            updatedAt: now,
            lastUsedAt: now,
          },
        })
    },

    async touch(id: string): Promise<void> {
      await db
        .update(table)
        .set({ lastUsedAt: new Date() })
        .where(eq(table.id, id))
    },

    async delete(id: string): Promise<void> {
      await db.delete(table).where(eq(table.id, id))
    },

    async deleteByResource(resourceType: string, resourceId: string): Promise<number> {
      const result = await db
        .delete(table)
        .where(
          and(
            eq(table.resourceType, resourceType),
            eq(table.resourceId, resourceId)
          )
        )
      return result.rowCount ?? 0
    },

    async deleteByLanguage(targetLanguage: string): Promise<number> {
      const result = await db
        .delete(table)
        .where(eq(table.targetLanguage, targetLanguage))
      return result.rowCount ?? 0
    },

    async deleteAll(): Promise<number> {
      const result = await db.delete(table)
      return result.rowCount ?? 0
    },

    async getStats() {
      const stats = await db
        .select({
          targetLanguage: table.targetLanguage,
          isManual: table.isManualOverride,
          count: sql<number>`count(*)`,
        })
        .from(table)
        .groupBy(table.targetLanguage, table.isManualOverride)

      return {
        totalEntries: stats.reduce((sum: number, s: any) => sum + Number(s.count), 0),
        byLanguage: Object.fromEntries(
          stats.filter((s: any) => !s.isManual).map((s: any) => [s.targetLanguage, Number(s.count)])
        ),
        manualOverrides: stats.filter((s: any) => s.isManual).reduce((sum: number, s: any) => sum + Number(s.count), 0),
      }
    },
  }
}
