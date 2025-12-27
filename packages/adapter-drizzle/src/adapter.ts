import { eq, and, sql, inArray } from 'drizzle-orm'
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

    async getMany(ids: string[]): Promise<Map<string, CacheEntry>> {
      if (ids.length === 0) {
        return new Map()
      }
      const rows = await db
        .select()
        .from(table)
        .where(inArray(table.id, ids))
      const result = new Map<string, CacheEntry>()
      for (const row of rows) {
        result.set(row.id, row)
      }
      return result
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

    async setMany(entries): Promise<void> {
      if (entries.length === 0) return
      const now = new Date()
      const values = entries.map(entry => ({
        ...entry,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: now,
      }))
      await db
        .insert(table)
        .values(values)
        .onConflictDoUpdate({
          target: table.id,
          set: {
            translatedText: sql`excluded.translated_text`,
            sourceLanguage: sql`excluded.source_language`,
            isManualOverride: sql`excluded.is_manual_override`,
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

    async touchMany(ids: string[]): Promise<void> {
      if (ids.length === 0) return
      await db
        .update(table)
        .set({ lastUsedAt: new Date() })
        .where(inArray(table.id, ids))
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
