import type { CacheAdapter, CacheEntry } from '@swalha1999/translate'

export interface PrismaAdapterConfig {
  prisma: any
}

export function createPrismaAdapter(config: PrismaAdapterConfig): CacheAdapter {
  const { prisma } = config

  return {
    async get(id: string): Promise<CacheEntry | null> {
      const row = await prisma.translationCache.findUnique({
        where: { id },
      })
      return row ?? null
    },

    async getMany(ids: string[]): Promise<Map<string, CacheEntry>> {
      if (ids.length === 0) {
        return new Map()
      }
      const rows = await prisma.translationCache.findMany({
        where: { id: { in: ids } },
      })
      const result = new Map<string, CacheEntry>()
      for (const row of rows) {
        result.set(row.id, row)
      }
      return result
    },

    async set(entry): Promise<void> {
      const now = new Date()
      await prisma.translationCache.upsert({
        where: { id: entry.id },
        create: {
          ...entry,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: now,
        },
        update: {
          translatedText: entry.translatedText,
          sourceLanguage: entry.sourceLanguage,
          isManualOverride: entry.isManualOverride,
          updatedAt: now,
          lastUsedAt: now,
        },
      })
    },

    async touch(id: string): Promise<void> {
      await prisma.translationCache.update({
        where: { id },
        data: { lastUsedAt: new Date() },
      })
    },

    async delete(id: string): Promise<void> {
      await prisma.translationCache.delete({
        where: { id },
      }).catch(() => {})
    },

    async deleteByResource(resourceType: string, resourceId: string): Promise<number> {
      const result = await prisma.translationCache.deleteMany({
        where: {
          resourceType,
          resourceId,
        },
      })
      return result.count
    },

    async deleteByLanguage(targetLanguage: string): Promise<number> {
      const result = await prisma.translationCache.deleteMany({
        where: { targetLanguage },
      })
      return result.count
    },

    async deleteAll(): Promise<number> {
      const result = await prisma.translationCache.deleteMany({})
      return result.count
    },

    async getStats() {
      const stats = await prisma.translationCache.groupBy({
        by: ['targetLanguage', 'isManualOverride'],
        _count: true,
      })

      const byLanguage: Record<string, number> = {}
      let manualOverrides = 0
      let total = 0

      for (const stat of stats) {
        total += stat._count
        if (stat.isManualOverride) {
          manualOverrides += stat._count
        } else {
          byLanguage[stat.targetLanguage] = (byLanguage[stat.targetLanguage] ?? 0) + stat._count
        }
      }

      return {
        totalEntries: total,
        byLanguage,
        manualOverrides,
      }
    },
  }
}
