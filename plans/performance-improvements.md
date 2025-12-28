# Performance Improvements Plan

## User Decisions
- **Cache Architecture**: Tiered L1 + L2 (Redis as fast cache, DB as persistent)
- **Redis Client**: ioredis
- **Default TTL**: 7 days

---

## Implementation Tasks

### 1. Redis Adapter Package

**Package**: `packages/adapter-redis/` → `@swalha1999/translate-adapter-redis`

**Files to create**:
- `packages/adapter-redis/package.json`
- `packages/adapter-redis/tsconfig.json`
- `packages/adapter-redis/tsdown.config.ts`
- `packages/adapter-redis/src/adapter.ts`
- `packages/adapter-redis/src/index.ts`

**Features**:
- Implements all 12 `CacheAdapter` methods
- Uses `SETEX` with 7-day TTL (configurable)
- Pipeline support for `getMany`, `setMany`, `touchMany`
- Secondary indexes via Redis Sets for `deleteByLanguage`, `deleteByResource`
- `SCAN` for `deleteAll` and `getStats`
- `ioredis` as optional peer dependency

**Redis Adapter Implementation**:

```typescript
import type { Redis } from 'ioredis'
import type { CacheAdapter, CacheEntry } from '@swalha1999/translate'

export interface RedisAdapterConfig {
  redis: Redis
  prefix?: string           // Key prefix, default: 'translate:'
  ttl?: number              // TTL in seconds, default: 7 days (604800)
}

const DEFAULT_TTL = 7 * 24 * 60 * 60  // 7 days in seconds
const DEFAULT_PREFIX = 'translate:'

export function createRedisAdapter(config: RedisAdapterConfig): CacheAdapter {
  const { redis, prefix = DEFAULT_PREFIX, ttl = DEFAULT_TTL } = config

  const key = (id: string) => `${prefix}${id}`
  const langSetKey = (lang: string) => `${prefix}lang:${lang}`
  const resourceSetKey = (type: string, id: string) => `${prefix}res:${type}:${id}`
  const manualSetKey = () => `${prefix}manual`

  const serialize = (entry: CacheEntry): string => JSON.stringify({
    ...entry,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    lastUsedAt: entry.lastUsedAt.toISOString(),
  })

  const deserialize = (data: string): CacheEntry => {
    const parsed = JSON.parse(data)
    return {
      ...parsed,
      createdAt: new Date(parsed.createdAt),
      updatedAt: new Date(parsed.updatedAt),
      lastUsedAt: new Date(parsed.lastUsedAt),
    }
  }

  return {
    async get(id) {
      const data = await redis.get(key(id))
      return data ? deserialize(data) : null
    },

    async getMany(ids) {
      const result = new Map<string, CacheEntry>()
      if (ids.length === 0) return result

      const keys = ids.map(key)
      const values = await redis.mget(...keys)

      for (let i = 0; i < ids.length; i++) {
        if (values[i]) {
          result.set(ids[i], deserialize(values[i]!))
        }
      }
      return result
    },

    async set(entry) {
      const now = new Date()
      const fullEntry: CacheEntry = {
        ...entry,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: now,
      }

      const pipeline = redis.pipeline()
      pipeline.setex(key(entry.id), ttl, serialize(fullEntry))
      pipeline.sadd(langSetKey(entry.targetLanguage), entry.id)

      if (entry.resourceType && entry.resourceId) {
        pipeline.sadd(resourceSetKey(entry.resourceType, entry.resourceId), entry.id)
      }

      if (entry.isManualOverride) {
        pipeline.sadd(manualSetKey(), entry.id)
      }

      await pipeline.exec()
    },

    async setMany(entries) {
      if (entries.length === 0) return

      const now = new Date()
      const pipeline = redis.pipeline()

      for (const entry of entries) {
        const fullEntry: CacheEntry = {
          ...entry,
          createdAt: now,
          updatedAt: now,
          lastUsedAt: now,
        }

        pipeline.setex(key(entry.id), ttl, serialize(fullEntry))
        pipeline.sadd(langSetKey(entry.targetLanguage), entry.id)

        if (entry.resourceType && entry.resourceId) {
          pipeline.sadd(resourceSetKey(entry.resourceType, entry.resourceId), entry.id)
        }

        if (entry.isManualOverride) {
          pipeline.sadd(manualSetKey(), entry.id)
        }
      }

      await pipeline.exec()
    },

    async touch(id) {
      const data = await redis.get(key(id))
      if (!data) return

      const entry = deserialize(data)
      entry.lastUsedAt = new Date()

      await redis.setex(key(id), ttl, serialize(entry))
    },

    async touchMany(ids) {
      if (ids.length === 0) return

      const keys = ids.map(key)
      const values = await redis.mget(...keys)
      const pipeline = redis.pipeline()
      const now = new Date()

      for (let i = 0; i < ids.length; i++) {
        if (values[i]) {
          const entry = deserialize(values[i]!)
          entry.lastUsedAt = now
          pipeline.setex(keys[i], ttl, serialize(entry))
        }
      }

      await pipeline.exec()
    },

    async delete(id) {
      const data = await redis.get(key(id))
      if (!data) return

      const entry = deserialize(data)
      const pipeline = redis.pipeline()

      pipeline.del(key(id))
      pipeline.srem(langSetKey(entry.targetLanguage), id)

      if (entry.resourceType && entry.resourceId) {
        pipeline.srem(resourceSetKey(entry.resourceType, entry.resourceId), id)
      }

      if (entry.isManualOverride) {
        pipeline.srem(manualSetKey(), id)
      }

      await pipeline.exec()
    },

    async deleteByResource(resourceType, resourceId) {
      const setKey = resourceSetKey(resourceType, resourceId)
      const ids = await redis.smembers(setKey)

      if (ids.length === 0) return 0

      const pipeline = redis.pipeline()

      for (const id of ids) {
        const data = await redis.get(key(id))
        if (data) {
          const entry = deserialize(data)
          pipeline.del(key(id))
          pipeline.srem(langSetKey(entry.targetLanguage), id)
          if (entry.isManualOverride) {
            pipeline.srem(manualSetKey(), id)
          }
        }
      }

      pipeline.del(setKey)
      await pipeline.exec()

      return ids.length
    },

    async deleteByLanguage(targetLanguage) {
      const setKey = langSetKey(targetLanguage)
      const ids = await redis.smembers(setKey)

      if (ids.length === 0) return 0

      const pipeline = redis.pipeline()

      for (const id of ids) {
        const data = await redis.get(key(id))
        if (data) {
          const entry = deserialize(data)
          pipeline.del(key(id))

          if (entry.resourceType && entry.resourceId) {
            pipeline.srem(resourceSetKey(entry.resourceType, entry.resourceId), id)
          }

          if (entry.isManualOverride) {
            pipeline.srem(manualSetKey(), id)
          }
        }
      }

      pipeline.del(setKey)
      await pipeline.exec()

      return ids.length
    },

    async deleteAll() {
      const keys: string[] = []
      let cursor = '0'

      do {
        const [newCursor, foundKeys] = await redis.scan(cursor, 'MATCH', `${prefix}*`, 'COUNT', 1000)
        cursor = newCursor
        keys.push(...foundKeys)
      } while (cursor !== '0')

      if (keys.length === 0) return 0

      const pipeline = redis.pipeline()
      for (const k of keys) {
        pipeline.del(k)
      }
      await pipeline.exec()

      return keys.filter(k => !k.includes('lang:') && !k.includes('res:') && k !== manualSetKey()).length
    },

    async getStats() {
      const byLanguage: Record<string, number> = {}
      let cursor = '0'
      const langSetPattern = `${prefix}lang:*`

      do {
        const [newCursor, keys] = await redis.scan(cursor, 'MATCH', langSetPattern, 'COUNT', 100)
        cursor = newCursor

        for (const k of keys) {
          const lang = k.replace(`${prefix}lang:`, '')
          const count = await redis.scard(k)
          byLanguage[lang] = count
        }
      } while (cursor !== '0')

      const manualOverrides = await redis.scard(manualSetKey())
      const totalEntries = Object.values(byLanguage).reduce((sum, count) => sum + count, 0)

      return { totalEntries, byLanguage, manualOverrides }
    },
  }
}
```

---

### 2. Tiered Cache Adapter

**File**: `packages/translate/src/adapters/tiered.ts`

**Behavior**:
- `get`: L1 → miss → L2 → populate L1 (fire-and-forget)
- `getMany`: batch L1 → missing → batch L2 → populate L1
- `set/setMany`: write to both L1 and L2 in parallel
- `delete*`: delete from both layers
- `getStats`: return L2 stats (source of truth)

**Export from**:
- `packages/translate/src/adapters/index.ts`
- `packages/translate/src/index.ts`

**Implementation**:

```typescript
import type { CacheAdapter, CacheEntry } from './types'

export interface TieredCacheConfig {
  l1: CacheAdapter       // Fast layer (e.g., Redis, Memory)
  l2: CacheAdapter       // Persistent layer (e.g., Drizzle, Prisma)
  populateL1OnL2Hit?: boolean  // Default: true
}

export function createTieredAdapter(config: TieredCacheConfig): CacheAdapter {
  const { l1, l2, populateL1OnL2Hit = true } = config

  return {
    async get(id) {
      const l1Result = await l1.get(id)
      if (l1Result) return l1Result

      const l2Result = await l2.get(id)
      if (l2Result && populateL1OnL2Hit) {
        l1.set({
          id: l2Result.id,
          sourceText: l2Result.sourceText,
          sourceLanguage: l2Result.sourceLanguage,
          targetLanguage: l2Result.targetLanguage,
          translatedText: l2Result.translatedText,
          resourceType: l2Result.resourceType,
          resourceId: l2Result.resourceId,
          field: l2Result.field,
          isManualOverride: l2Result.isManualOverride,
          provider: l2Result.provider,
          model: l2Result.model,
        }).catch(() => {})
      }

      return l2Result
    },

    async getMany(ids) {
      if (ids.length === 0) return new Map()

      const l1Results = await l1.getMany(ids)
      const missingIds = ids.filter(id => !l1Results.has(id))

      if (missingIds.length === 0) return l1Results

      const l2Results = await l2.getMany(missingIds)

      if (l2Results.size > 0 && populateL1OnL2Hit) {
        const entriesToPopulate = Array.from(l2Results.values()).map(entry => ({
          id: entry.id,
          sourceText: entry.sourceText,
          sourceLanguage: entry.sourceLanguage,
          targetLanguage: entry.targetLanguage,
          translatedText: entry.translatedText,
          resourceType: entry.resourceType,
          resourceId: entry.resourceId,
          field: entry.field,
          isManualOverride: entry.isManualOverride,
          provider: entry.provider,
          model: entry.model,
        }))
        l1.setMany(entriesToPopulate).catch(() => {})
      }

      const combined = new Map(l1Results)
      for (const [id, entry] of l2Results) {
        combined.set(id, entry)
      }

      return combined
    },

    async set(entry) {
      await Promise.all([l1.set(entry), l2.set(entry)])
    },

    async setMany(entries) {
      if (entries.length === 0) return
      await Promise.all([l1.setMany(entries), l2.setMany(entries)])
    },

    async touch(id) {
      await Promise.all([l1.touch(id), l2.touch(id)])
    },

    async touchMany(ids) {
      if (ids.length === 0) return
      await Promise.all([l1.touchMany(ids), l2.touchMany(ids)])
    },

    async delete(id) {
      await Promise.all([l1.delete(id), l2.delete(id)])
    },

    async deleteByResource(resourceType, resourceId) {
      const [l1Count, l2Count] = await Promise.all([
        l1.deleteByResource(resourceType, resourceId),
        l2.deleteByResource(resourceType, resourceId),
      ])
      return Math.max(l1Count, l2Count)
    },

    async deleteByLanguage(targetLanguage) {
      const [l1Count, l2Count] = await Promise.all([
        l1.deleteByLanguage(targetLanguage),
        l2.deleteByLanguage(targetLanguage),
      ])
      return Math.max(l1Count, l2Count)
    },

    async deleteAll() {
      const [l1Count, l2Count] = await Promise.all([l1.deleteAll(), l2.deleteAll()])
      return Math.max(l1Count, l2Count)
    },

    async getStats() {
      return l2.getStats()  // L2 is source of truth
    },
  }
}
```

---

### 3. Performance Fixes

#### 3.1 Batch Cache Writes in Object Translations
**File**: `packages/translate/src/core.ts`

Replace individual `setCache()` loops with `setCacheBatch()`:
- Lines 479-499 in `translateObject()`
- Lines 588-605 in `translateObjects()`

**Before**:
```typescript
for (const item of uncachedItems) {
  const tr = textToResult.get(item.text)!
  if (tr.sourceLanguage !== to) {
    fireAndForget(setCache(adapter, {...}), config, 'set')
  }
}
```

**After**:
```typescript
const cacheEntries = uncachedItems
  .filter(item => {
    const tr = textToResult.get(item.text)!
    return tr.sourceLanguage !== to
  })
  .map(item => {
    const tr = textToResult.get(item.text)!
    return {
      sourceText: item.text,
      sourceLanguage: tr.sourceLanguage,
      targetLanguage: to,
      translatedText: tr.result.text,
      provider: modelInfo.provider,
      model: modelInfo.modelId,
      resourceType,
      resourceId: item.resourceId ?? resourceId,
      field: String(item.field),
    }
  })

if (cacheEntries.length > 0) {
  fireAndForget(setCacheBatch(adapter, cacheEntries), config, 'set')
}
```

#### 3.2 Optimize Hash Function
**File**: `packages/translate/src/cache-key.ts`

For texts > 1000 chars, sample start/middle/end (500 chars each) + include length in hash.

**Before**:
```typescript
export function hashText(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}
```

**After**:
```typescript
export function hashText(text: string): string {
  const len = text.length
  const THRESHOLD = 1000
  const SAMPLE_SIZE = 500

  let hash = 0

  if (len <= THRESHOLD) {
    for (let i = 0; i < len; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
  } else {
    // Include length in hash for uniqueness
    hash = len

    // Sample first SAMPLE_SIZE characters
    for (let i = 0; i < SAMPLE_SIZE && i < len; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }

    // Sample middle SAMPLE_SIZE characters
    const midStart = Math.floor((len - SAMPLE_SIZE) / 2)
    for (let i = midStart; i < midStart + SAMPLE_SIZE && i < len; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }

    // Sample last SAMPLE_SIZE characters
    const endStart = Math.max(0, len - SAMPLE_SIZE)
    for (let i = endStart; i < len; i++) {
      const char = text.charCodeAt(i)
      hash = ((hash << 5) - hash) + char
      hash = hash & hash
    }
  }

  return Math.abs(hash).toString(36)
}
```

#### 3.3 Lazy Hash Key Generation
**File**: `packages/translate/src/cache.ts`

In `getCached()`, only compute hash key if resource key lookup fails.

---

## Critical Files

| File | Purpose |
|------|---------|
| `packages/translate/src/adapters/types.ts` | CacheAdapter interface (must implement) |
| `packages/translate/src/core.ts:479-499, 588-605` | Batch write fixes |
| `packages/translate/src/cache-key.ts:1-9` | Hash optimization |
| `packages/translate/src/cache.ts` | Lazy key generation |
| `packages/adapter-drizzle/src/adapter.ts` | Reference for Redis adapter |

---

## Implementation Order

1. Create Redis adapter package structure
2. Implement Redis adapter with all 12 methods
3. Create TieredCacheAdapter in core package
4. Fix batch cache writes in `core.ts`
5. Optimize hash function in `cache-key.ts`
6. Add lazy hash generation in `cache.ts`
7. Write tests for Redis and Tiered adapters
8. Update package exports

---

## Usage Example

```typescript
import { createTranslate, createTieredAdapter } from '@swalha1999/translate'
import { createDrizzleAdapter } from '@swalha1999/translate-adapter-drizzle'
import { createRedisAdapter } from '@swalha1999/translate-adapter-redis'
import Redis from 'ioredis'

const redis = new Redis()
const redisAdapter = createRedisAdapter({ redis, ttl: 7 * 24 * 60 * 60 })
const dbAdapter = createDrizzleAdapter({ db, table: translationCache })

const tieredAdapter = createTieredAdapter({
  l1: redisAdapter,  // Fast layer
  l2: dbAdapter,     // Persistent layer
})

const translate = createTranslate({
  adapter: tieredAdapter,
  model: openai('gpt-4o-mini'),
})
```
