# UGC AI Translation - Monorepo

## Summary

A **generic text translation library** with caching, published as `@swalha1999/translate`. Framework-agnostic, ORM-agnostic, designed to translate user-generated content with intelligent caching.

**Key Principle:** The translation package is data-model agnostic. Your application decides what to translate and how to store the results.

---

## Monorepo Structure

```
translate/
├── apps/
│   └── docs/                    # TanStack Start documentation site
│       ├── app/
│       │   ├── routes/
│       │   │   ├── __root.tsx
│       │   │   ├── index.tsx
│       │   │   ├── docs/
│       │   │   │   ├── getting-started.tsx
│       │   │   │   ├── configuration.tsx
│       │   │   │   ├── adapters.tsx
│       │   │   │   ├── api-reference.tsx
│       │   │   │   └── examples.tsx
│       │   │   └── playground.tsx
│       │   ├── components/
│       │   │   ├── Sidebar.tsx
│       │   │   ├── CodeBlock.tsx
│       │   │   ├── Button.tsx
│       │   │   └── Card.tsx
│       │   └── styles/
│       │       └── global.css
│       ├── app.config.ts
│       └── package.json
│
├── packages/
│   ├── translate/               # Core translation package (@swalha1999/translate)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── create-translate.ts
│   │   │   ├── core.ts
│   │   │   ├── cache.ts
│   │   │   ├── cache-key.ts
│   │   │   ├── types.ts
│   │   │   ├── utils.ts
│   │   │   ├── providers/
│   │   │   │   ├── index.ts
│   │   │   │   ├── openai.ts
│   │   │   │   └── types.ts
│   │   │   └── adapters/
│   │   │       ├── index.ts
│   │   │       ├── types.ts
│   │   │       ├── memory.ts
│   │   │       └── drizzle.ts
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── tsdown.config.ts
│   │
│   ├── adapter-drizzle/         # Drizzle ORM adapter (@swalha1999/translate-adapter-drizzle)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   ├── adapter.ts
│   │   │   └── schema.ts        # Ready-to-use Drizzle schema
│   │   └── package.json
│   │
│   ├── adapter-prisma/          # Prisma adapter (@swalha1999/translate-adapter-prisma)
│   │   ├── src/
│   │   │   ├── index.ts
│   │   │   └── adapter.ts
│   │   ├── prisma/
│   │   │   └── schema.prisma    # Ready-to-use Prisma schema
│   │   └── package.json
│   │
│   └── config/                  # Shared configs (@swalha1999/config)
│       ├── eslint/
│       ├── typescript/
│       └── package.json
│
├── examples/
│   ├── with-nextjs/             # Next.js example
│   ├── with-tanstack-start/     # TanStack Start example
│   └── with-express/            # Express API example
│
├── pnpm-workspace.yaml
├── turbo.json
├── package.json
└── README.md
```

---

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     @swalha1999/translate                   │
│  ┌─────────────────────────────────────────────────────────┐│
│  │  createTranslate({ adapter, provider, ... })            ││
│  │       │                                                 ││
│  │       ├── CacheAdapter interface                        ││
│  │       │     ├── Memory (built-in)                       ││
│  │       │     ├── @swalha1999/translate-adapter-drizzle   ││
│  │       │     ├── @swalha1999/translate-adapter-prisma    ││
│  │       │     └── Custom implementation                   ││
│  │       │                                                 ││
│  │       └── AI Provider interface                         ││
│  │             ├── OpenAI (built-in)                       ││
│  │             ├── Anthropic (future)                      ││
│  │             └── Custom implementation                   ││
│  └─────────────────────────────────────────────────────────┘│
└─────────────────────────────────────────────────────────────┘
```

The translate package:
- ✅ Translates any text from language A to language B
- ✅ Auto-detects source language when not specified
- ✅ Caches translations by text hash (not by resource type)
- ✅ Request coalescing (prevents thundering herd)
- ❌ Does NOT know about your data model
- ❌ Does NOT know your database schema

---

## How It Works

```
Input:  "شقة فاخرة في تل أبيب" + targetLanguage: "en"
Output: { text: "Luxury apartment in Tel Aviv", detectedLanguage: "ar" }
```

The package:
1. Hashes the input text
2. Checks cache for hash + targetLanguage
3. If cached → return immediately
4. If not → call AI, cache result, return

**Your API code** decides:
- What fields to translate (title, description, etc.)
- How to store translations (inline, separate table, etc.)
- When to trigger translations (on create, on request, etc.)

---

## Supported Languages

| Code | Language | Direction |
|------|----------|-----------|
| en | English | LTR |
| ar | Arabic | RTL |
| he | Hebrew | RTL |
| ru | Russian | LTR |

---

## Translation Strategy

### Cache by Text Hash (Not Resource ID)

The key insight: **cache by the text content itself**, not by resource ID.

```
Hash("شقة فاخرة") + "en" → "Luxury apartment"
Hash("شقة فاخرة") + "he" → "דירת יוקרה"
```

**Benefits:**
- Same text in different resources shares the same translation
- No coupling to your data model
- Works for any content type automatically

### When to Translate

**Option A: On-Demand (Lazy)** ⭐ Recommended for simplicity
```
User requests property → API checks cache → translates if missing → returns
```

**Option B: Background (Proactive)**
```
Content saved → Queue translations → Process async
```

### Flow Example

```
1. API receives: GET /property/123?locale=he
2. API fetches property from DB: { title: "Luxury apartment", ... }
3. API calls: translate.text({ text: property.title, to: "he" })
4. Translate package:
   - Hashes "Luxury apartment"
   - Checks cache for hash + "he"
   - If found → returns cached
   - If not → calls AI, caches, returns
5. API returns property with translated title
```

---

## Initialization Pattern (like Better Auth)

Initialize once with adapter and AI provider config:

```ts
// lib/translate.ts
import { createTranslate } from '@swalha1999/translate'
import { createDrizzleAdapter } from '@swalha1999/translate-adapter-drizzle'
import { db } from './db'
import { translationCache } from './schema'

export const translate = createTranslate({
  adapter: createDrizzleAdapter({ db, table: translationCache }),
  
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  model: 'gpt-4o-mini',
  
  languages: ['en', 'ar', 'he', 'ru'] as const,
})
```

### Quick Start (In-Memory - No Database)

```ts
import { createTranslate, createMemoryAdapter } from '@swalha1999/translate'

export const translate = createTranslate({
  adapter: createMemoryAdapter(),
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  languages: ['en', 'ar', 'he', 'ru'],
})
```

### Simple Usage (Hash-Based Cache)

```ts
import { translate } from '../lib/translate'

// Simple: just translate text (uses hash-based cache)
const result = await translate.text({
  text: "شقة فاخرة في تل أبيب",
  to: 'en',
})
// → { text: "Luxury apartment in Tel Aviv", from: "ar", cached: false }

// With context hint for better translation
const result2 = await translate.text({
  text: "flat",
  to: 'he',
  context: 'real estate property type', // AI hint
})
// → { text: "דירה", from: "en", cached: false }
```

### Resource-Specific Control (Optional)

When you need **granular control** (manual overrides, context-specific caching):

```ts
// Resource-specific: "flat" in real estate context
const realEstateFlat = await translate.text({
  text: "flat",
  to: 'he',
  resourceType: 'property',      // Optional: enables resource-specific cache
  resourceId: property.id,       // Optional: specific resource instance
  field: 'propertyType',         // Optional: specific field
  context: 'real estate',
})
// → { text: "דירה", from: "en" }

// Resource-specific: "flat" in finance context  
const financeFlat = await translate.text({
  text: "flat",
  to: 'he',
  resourceType: 'deal',
  resourceId: deal.id,
  field: 'feeType',
  context: 'financial terms',
})
// → { text: "קבוע", from: "en" } // Different translation!
```

### Cache Priority

1. **Resource-specific cache** (if resourceType/resourceId/field provided) → checked first
2. **Hash-based cache** → fallback for general translations
3. **AI translation** → if neither cache hit

This means:
- Simple calls share translations via hash
- Resource-specific calls get their own cache entries (for manual overrides)

### Usage in Your API Router

```ts
// packages/api/src/routers/properties.ts
import { translate } from '../lib/translate'

const getProperty = async ({ id, locale }) => {
  const property = await db.query.property.findFirst({ where: eq(property.id, id) })
  
  // Translate if needed
  if (locale !== 'en') {
    const [title, description] = await translate.batch({
      texts: [property.title, property.description],
      to: locale,
      context: 'real estate listing', // Optional hint for AI
    })
    
    return {
      ...property,
      title: title.text,
      description: description.text,
    }
  }
  
  return property
}
```

---

## Root Configuration

### pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'examples/*'
```

### turbo.json

```json
{
  "$schema": "https://turbo.build/schema.json",
  "tasks": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": ["dist/**", ".next/**", ".output/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {
      "dependsOn": ["^build"]
    },
    "typecheck": {
      "dependsOn": ["^build"]
    }
  }
}
```

### Root package.json

```json
{
  "name": "swalha1999-translate",
  "private": true,
  "scripts": {
    "dev": "turbo dev",
    "build": "turbo build",
    "lint": "turbo lint",
    "typecheck": "turbo typecheck",
    "changeset": "changeset",
    "release": "turbo build && changeset publish"
  },
  "devDependencies": {
    "@changesets/cli": "^2.27.0",
    "turbo": "^2.0.0",
    "typescript": "^5.5.0"
  },
  "packageManager": "pnpm@9.0.0"
}
```

---

## Step 1: Create Core Package (@swalha1999/translate)

### packages/translate/package.json

```json
{
  "name": "@swalha1999/translate",
  "version": "0.0.1",
  "description": "AI-powered translation for user-generated content with intelligent caching",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./adapters": {
      "import": "./dist/adapters/index.mjs",
      "require": "./dist/adapters/index.js",
      "types": "./dist/adapters/index.d.ts"
    }
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "openai": "^4.0.0"
  },
  "devDependencies": {
    "tsdown": "^0.9.5",
    "typescript": "^5.5.0"
  },
  "peerDependencies": {
    "drizzle-orm": ">=0.30.0"
  },
  "peerDependenciesMeta": {
    "drizzle-orm": {
      "optional": true
    }
  },
  "keywords": ["translation", "ai", "openai", "cache", "ugc", "i18n"],
  "license": "MIT"
}
```

---

## Step 2: Create Translation Cache Schema

Two-tier cache: hash-based (simple) + resource-specific (granular control):

```ts
import { pgTable, text, timestamp, boolean, index, uniqueIndex } from "drizzle-orm/pg-core";

export const translationCache = pgTable("translation_cache", {
  id: text("id").primaryKey(), // Format: "{hash}:{targetLang}" or "{resourceType}:{resourceId}:{field}:{targetLang}"
  
  // Source
  sourceText: text("source_text").notNull(),
  sourceLanguage: text("source_language").notNull(),
  
  // Target
  targetLanguage: text("target_language").notNull(),
  translatedText: text("translated_text").notNull(),
  
  // Optional: Resource-specific (for granular control)
  resourceType: text("resource_type"),    // 'property', 'deal', 'lead', etc.
  resourceId: text("resource_id"),        // UUID of the resource
  field: text("field"),                   // 'title', 'description', 'notes', etc.
  
  // Manual override flag
  isManualOverride: boolean("is_manual_override").notNull().default(false),
  
  // Metadata
  provider: text("provider").notNull(),   // 'openai', 'manual'
  model: text("model"),                   // 'gpt-4o-mini'
  
  // Timestamps
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
}, (table) => ({
  targetLangIdx: index("tc_target_lang_idx").on(table.targetLanguage),
  resourceIdx: index("tc_resource_idx").on(table.resourceType, table.resourceId, table.field),
  manualIdx: index("tc_manual_idx").on(table.isManualOverride),
}));
```

**How the ID works:**
- Hash-based: `"a1b2c3:he"` (text hash + language)
- Resource-specific: `"property:uuid-123:title:he"` (type + id + field + language)

**Migration:** `packages/db/src/migrations/XXXX_translation_cache.sql`

```sql
CREATE TABLE translation_cache (
  id TEXT PRIMARY KEY,
  source_text TEXT NOT NULL,
  source_language TEXT NOT NULL,
  target_language TEXT NOT NULL,
  translated_text TEXT NOT NULL,
  resource_type TEXT,
  resource_id TEXT,
  field TEXT,
  is_manual_override BOOLEAN NOT NULL DEFAULT FALSE,
  provider TEXT NOT NULL,
  model TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMP NOT NULL DEFAULT NOW()
);

CREATE INDEX tc_target_lang_idx ON translation_cache(target_language);
CREATE INDEX tc_resource_idx ON translation_cache(resource_type, resource_id, field);
CREATE INDEX tc_manual_idx ON translation_cache(is_manual_override);
```

**Export from db:** Update `packages/db/src/schema/index.ts` to export.

---

## Step 3: Create Memory Adapter (Built-in)

**File:** `packages/translate/src/adapters/memory.ts`

In-memory adapter for development, testing, or simple use cases:

```ts
import type { CacheAdapter, CacheEntry } from './types'

export function createMemoryAdapter(): CacheAdapter {
  const cache = new Map<string, CacheEntry>()

  return {
    async get(id: string) {
      return cache.get(id) ?? null
    },

    async set(entry) {
      const now = new Date()
      cache.set(entry.id, {
        ...entry,
        createdAt: now,
        updatedAt: now,
        lastUsedAt: now,
      })
    },

    async touch(id: string) {
      const entry = cache.get(id)
      if (entry) {
        entry.lastUsedAt = new Date()
      }
    },

    async delete(id: string) {
      cache.delete(id)
    },

    async deleteByResource(resourceType: string, resourceId: string) {
      let count = 0
      for (const [key, entry] of cache) {
        if (entry.resourceType === resourceType && entry.resourceId === resourceId) {
          cache.delete(key)
          count++
        }
      }
      return count
    },

    async deleteByLanguage(targetLanguage: string) {
      let count = 0
      for (const [key, entry] of cache) {
        if (entry.targetLanguage === targetLanguage) {
          cache.delete(key)
          count++
        }
      }
      return count
    },

    async deleteAll() {
      const count = cache.size
      cache.clear()
      return count
    },

    async getStats() {
      const byLanguage: Record<string, number> = {}
      let manualOverrides = 0

      for (const entry of cache.values()) {
        byLanguage[entry.targetLanguage] = (byLanguage[entry.targetLanguage] ?? 0) + 1
        if (entry.isManualOverride) manualOverrides++
      }

      return {
        totalEntries: cache.size,
        byLanguage,
        manualOverrides,
      }
    },
  }
}
```

---

## Step 4: Create Cache Adapter Interface

**File:** `packages/translate/src/adapters/types.ts`

Generic interface - ORM agnostic:

```ts
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
  // Get a single entry by ID
  get(id: string): Promise<CacheEntry | null>
  
  // Set/upsert an entry
  set(entry: Omit<CacheEntry, 'createdAt' | 'updatedAt' | 'lastUsedAt'>): Promise<void>
  
  // Update last used timestamp
  touch(id: string): Promise<void>
  
  // Delete by ID
  delete(id: string): Promise<void>
  
  // Delete by resource (for cleanup when resource is deleted)
  deleteByResource(resourceType: string, resourceId: string): Promise<number>
  
  // Delete by language (admin cache clear)
  deleteByLanguage(targetLanguage: string): Promise<number>
  
  // Delete all (admin full cache clear)
  deleteAll(): Promise<number>
  
  // Get stats
  getStats(): Promise<{
    totalEntries: number
    byLanguage: Record<string, number>
    manualOverrides: number
  }>
}
```

---

## Step 5: Create Drizzle Adapter Package

### packages/adapter-drizzle/package.json

```json
{
  "name": "@swalha1999/translate-adapter-drizzle",
  "version": "0.0.1",
  "description": "Drizzle ORM adapter for @swalha1999/translate",
  "main": "dist/index.js",
  "module": "dist/index.mjs",
  "types": "dist/index.d.ts",
  "exports": {
    ".": {
      "import": "./dist/index.mjs",
      "require": "./dist/index.js",
      "types": "./dist/index.d.ts"
    },
    "./schema": {
      "import": "./dist/schema.mjs",
      "require": "./dist/schema.js",
      "types": "./dist/schema.d.ts"
    }
  },
  "scripts": {
    "build": "tsdown",
    "dev": "tsdown --watch"
  },
  "dependencies": {
    "@swalha1999/translate": "workspace:*"
  },
  "peerDependencies": {
    "drizzle-orm": ">=0.30.0"
  },
  "keywords": ["swalha1999-translate", "drizzle", "adapter"],
  "license": "MIT"
}
```

### packages/adapter-drizzle/src/schema.ts

Ready-to-use Drizzle schema (users can import and use directly):

```ts
import { pgTable, text, timestamp, boolean, index } from "drizzle-orm/pg-core"

export const translationCache = pgTable("translation_cache", {
  id: text("id").primaryKey(),
  
  sourceText: text("source_text").notNull(),
  sourceLanguage: text("source_language").notNull(),
  
  targetLanguage: text("target_language").notNull(),
  translatedText: text("translated_text").notNull(),
  
  resourceType: text("resource_type"),
  resourceId: text("resource_id"),
  field: text("field"),
  
  isManualOverride: boolean("is_manual_override").notNull().default(false),
  
  provider: text("provider").notNull(),
  model: text("model"),
  
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
  lastUsedAt: timestamp("last_used_at").notNull().defaultNow(),
}, (table) => ({
  targetLangIdx: index("tc_target_lang_idx").on(table.targetLanguage),
  resourceIdx: index("tc_resource_idx").on(table.resourceType, table.resourceId, table.field),
  manualIdx: index("tc_manual_idx").on(table.isManualOverride),
}))
```

### packages/adapter-drizzle/src/adapter.ts

```ts
import { eq, and, sql } from 'drizzle-orm'
import type { CacheAdapter, CacheEntry } from './types'

// Generic Drizzle table type
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
  db: any // Drizzle DB instance
  table: DrizzleTable // Your translation_cache table
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
        totalEntries: stats.reduce((sum: number, s: any) => sum + s.count, 0),
        byLanguage: Object.fromEntries(
          stats.filter((s: any) => !s.isManual).map((s: any) => [s.targetLanguage, s.count])
        ),
        manualOverrides: stats.filter((s: any) => s.isManual).reduce((sum: number, s: any) => sum + s.count, 0),
      }
    },
  }
}
```

---

## Step 6: Create Factory Function

**File:** `packages/translate/src/create-translate.ts`

Accepts adapter instead of raw db:

```ts
import type { CacheAdapter } from './adapters/types'

export type SupportedLanguage = 'en' | 'ar' | 'he' | 'ru'

export interface TranslateConfig {
  adapter: CacheAdapter  // ORM-agnostic cache adapter
  provider: 'openai'
  apiKey: string
  model?: string         // Default: 'gpt-4o-mini'
  languages: readonly SupportedLanguage[]
}

export function createTranslate(config: TranslateConfig) {
  const { adapter } = config

  return {
    // Core: Translate single text (supports optional resource-specific)
    text: (params: TranslateParams) => translateText(adapter, config, params),
    
    // Batch: Translate multiple texts (hash-based only)
    batch: (params: BatchParams) => translateBatch(adapter, config, params),
    
    // Manual override: Set a specific translation for a resource
    setManual: (params: SetManualParams) => setManualTranslation(adapter, params),
    
    // Clear manual override (falls back to AI translation)
    clearManual: (params: { resourceType: string; resourceId: string; field: string; to: SupportedLanguage }) => 
      clearManualTranslation(adapter, params),
    
    // Detect language only (no translation)
    detectLanguage: (text: string) => detectLanguage(config, text),
    
    // Cache management
    clearCache: (targetLanguage?: SupportedLanguage) => 
      targetLanguage ? adapter.deleteByLanguage(targetLanguage) : adapter.deleteAll(),
    clearResourceCache: (resourceType: string, resourceId: string) => 
      adapter.deleteByResource(resourceType, resourceId),
    getCacheStats: () => adapter.getStats(),
    
    // Utilities
    isRTL: (lang: SupportedLanguage) => ['ar', 'he'].includes(lang),
    languages: config.languages,
  }
}

export type Translate = ReturnType<typeof createTranslate>
```

### Types

```ts
export interface TranslateParams {
  text: string
  to: SupportedLanguage
  from?: SupportedLanguage      // Optional: auto-detect if not provided
  context?: string              // Hint for AI: "real estate", "finance", etc.
  
  // Optional: Resource-specific (for granular control)
  resourceType?: string         // 'property', 'deal', 'lead', etc.
  resourceId?: string           // UUID of the resource
  field?: string                // 'title', 'description', 'notes', etc.
}

export interface TranslateResult {
  text: string                  // Translated text
  from: SupportedLanguage       // Detected or provided source language
  to: SupportedLanguage
  cached: boolean               // Was this from cache?
  isManualOverride?: boolean    // Was this a manual override?
}

export interface BatchParams {
  texts: string[]
  to: SupportedLanguage
  from?: SupportedLanguage
  context?: string
  // Note: batch doesn't support resource-specific - use individual calls for that
}

export interface SetManualParams {
  text: string                  // Original text
  translatedText: string        // Manual translation
  to: SupportedLanguage
  resourceType: string          // Required for manual overrides
  resourceId: string
  field: string
}
```

---

## Step 7: Create Cache Key Utilities

**File:** `packages/translate/src/cache-key.ts`

Two types of cache keys:

```ts
export function hashText(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

// Hash-based key (simple, shared across resources)
export function createHashKey(text: string, targetLanguage: string): string {
  return `hash:${hashText(text)}:${targetLanguage}`
}

// Resource-specific key (granular control)
export function createResourceKey(
  resourceType: string,
  resourceId: string,
  field: string,
  targetLanguage: string
): string {
  return `res:${resourceType}:${resourceId}:${field}:${targetLanguage}`
}

// Check if params have resource info
export function hasResourceInfo(params: { resourceType?: string; resourceId?: string; field?: string }): boolean {
  return !!(params.resourceType && params.resourceId && params.field)
}
```

---

## Step 8: Create OpenAI Provider

**File:** `packages/translate/src/providers/openai.ts`

Handles both translation with known source and auto-detection:

```ts
import OpenAI from 'openai'

const LANGUAGE_NAMES: Record<string, string> = {
  en: 'English',
  ar: 'Arabic',
  he: 'Hebrew',
  ru: 'Russian',
}

// When source language is known
const TRANSLATE_PROMPT = `Translate from {from} to {to}.
Context: {context}
Rules: Keep numbers, measurements, proper nouns unchanged. Natural {to} phrasing.
Return ONLY the translation.

Text: {text}`

// When source language needs detection
const DETECT_AND_TRANSLATE_PROMPT = `Detect language and translate to {to}.
Context: {context}
Rules: Keep numbers, measurements, proper nouns unchanged. Natural {to} phrasing.
Return ONLY the translation.
Respond as JSON: {"from": "xx", "text": "translation"}

Text: {text}`

export async function translateWithOpenAI(params: {
  apiKey: string
  model: string
  text: string
  to: string
  from?: string // If undefined, auto-detect
  context?: string
}): Promise<{ text: string; from: string }> {
  const openai = new OpenAI({ apiKey: params.apiKey })
  
  // Known source language - simple translation
  if (params.from) {
    // Skip if same language
    if (params.from === params.to) {
      return { text: params.text, from: params.from }
    }
    
    const prompt = TRANSLATE_PROMPT
      .replace('{from}', LANGUAGE_NAMES[params.from] ?? params.from)
      .replace('{to}', LANGUAGE_NAMES[params.to] ?? params.to)
      .replace('{context}', params.context ?? 'general content')
      .replace('{text}', params.text)

    const response = await openai.chat.completions.create({
      model: params.model,
      messages: [{ role: 'user', content: prompt }],
      temperature: 0.3,
      max_tokens: params.text.length * 3,
    })

    return {
      text: response.choices[0].message.content?.trim() ?? params.text,
      from: params.from,
    }
  }
  
  // Unknown source - detect and translate in one call
  const prompt = DETECT_AND_TRANSLATE_PROMPT
    .replace('{to}', LANGUAGE_NAMES[params.to] ?? params.to)
    .replace('{context}', params.context ?? 'general content')
    .replace('{text}', params.text)

  const response = await openai.chat.completions.create({
    model: params.model,
    messages: [{ role: 'user', content: prompt }],
    temperature: 0.3,
    max_tokens: params.text.length * 3 + 50,
    response_format: { type: 'json_object' },
  })

  try {
    const result = JSON.parse(response.choices[0].message.content ?? '{}')
    
    // If detected language equals target, return original
    if (result.from === params.to) {
      return { text: params.text, from: result.from }
    }
    
    return {
      text: result.text?.trim() ?? params.text,
      from: result.from ?? 'en',
    }
  } catch {
    // Fallback if JSON parsing fails
    return { text: params.text, from: 'en' }
  }
}

// Standalone detection (no translation)
export async function detectLanguageWithOpenAI(params: {
  apiKey: string
  model: string
  text: string
}): Promise<{ language: string; confidence: number }> {
  const openai = new OpenAI({ apiKey: params.apiKey })

  const response = await openai.chat.completions.create({
    model: params.model,
    messages: [{
      role: 'user',
      content: `What language is this? Reply with only: en, ar, he, or ru.\n\nText: ${params.text}`,
    }],
    temperature: 0,
    max_tokens: 5,
  })

  const detected = response.choices[0].message.content?.trim().toLowerCase() ?? 'en'
  const valid = ['en', 'ar', 'he', 'ru']
  
  return {
    language: valid.includes(detected) ? detected : 'en',
    confidence: 0.9,
  }
}
```

---

## Step 9: Create Cache Logic (Uses Adapter)

**File:** `packages/translate/src/cache.ts`

ORM-agnostic - uses adapter interface:

```ts
import type { CacheAdapter } from './adapters/types'
import { createHashKey, createResourceKey, hasResourceInfo } from './cache-key'

interface CacheResult {
  text: string
  from: string
  isManualOverride: boolean
}

// Get from cache - checks resource-specific first, then hash-based
export async function getCached(
  adapter: CacheAdapter,
  params: {
    text: string
    to: string
    resourceType?: string
    resourceId?: string
    field?: string
  }
): Promise<CacheResult | null> {
  // 1. Check resource-specific cache first (if resource info provided)
  if (hasResourceInfo(params)) {
    const resourceKey = createResourceKey(params.resourceType!, params.resourceId!, params.field!, params.to)
    const resourceCached = await adapter.get(resourceKey)

    if (resourceCached) {
      await adapter.touch(resourceKey)
      return {
        text: resourceCached.translatedText,
        from: resourceCached.sourceLanguage,
        isManualOverride: resourceCached.isManualOverride,
      }
    }
  }

  // 2. Fall back to hash-based cache
  const hashKey = createHashKey(params.text, params.to)
  const hashCached = await adapter.get(hashKey)

  if (hashCached) {
    await adapter.touch(hashKey)
    return {
      text: hashCached.translatedText,
      from: hashCached.sourceLanguage,
      isManualOverride: false,
    }
  }

  return null
}

// Save to cache
export async function setCache(
  adapter: CacheAdapter,
  params: {
    sourceText: string
    sourceLanguage: string
    targetLanguage: string
    translatedText: string
    provider: string
    model?: string
    resourceType?: string
    resourceId?: string
    field?: string
    isManualOverride?: boolean
  }
): Promise<void> {
  const key = hasResourceInfo(params)
    ? createResourceKey(params.resourceType!, params.resourceId!, params.field!, params.targetLanguage)
    : createHashKey(params.sourceText, params.targetLanguage)

  await adapter.set({
    id: key,
    sourceText: params.sourceText,
    sourceLanguage: params.sourceLanguage,
    targetLanguage: params.targetLanguage,
    translatedText: params.translatedText,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    field: params.field,
    isManualOverride: params.isManualOverride ?? false,
    provider: params.provider,
    model: params.model,
  })
}

// Set manual override (always resource-specific)
export async function setManualTranslation(
  adapter: CacheAdapter,
  params: {
    text: string
    translatedText: string
    to: string
    resourceType: string
    resourceId: string
    field: string
  }
): Promise<void> {
  const key = createResourceKey(params.resourceType, params.resourceId, params.field, params.to)
  
  await adapter.set({
    id: key,
    sourceText: params.text,
    sourceLanguage: 'manual',
    targetLanguage: params.to,
    translatedText: params.translatedText,
    resourceType: params.resourceType,
    resourceId: params.resourceId,
    field: params.field,
    isManualOverride: true,
    provider: 'manual',
    model: null,
  })
}

// Clear manual override for a resource
export async function clearManualTranslation(
  adapter: CacheAdapter,
  params: { resourceType: string; resourceId: string; field: string; to: string }
): Promise<void> {
  const key = createResourceKey(params.resourceType, params.resourceId, params.field, params.to)
  await adapter.delete(key)
}
```

---

## Step 10: Create Core Translation Logic

**File:** `packages/translate/src/core.ts`

Uses adapter + includes **request coalescing** to prevent thundering herd:

```ts
import type { CacheAdapter } from './adapters/types'
import type { TranslateConfig, TranslateParams, TranslateResult, BatchParams } from './types'
import { getCached, setCache } from './cache'
import { createHashKey, createResourceKey, hasResourceInfo } from './cache-key'
import { translateWithOpenAI, detectLanguageWithOpenAI } from './providers/openai'

// In-flight requests map: key → Promise
// Prevents thundering herd - multiple concurrent requests for same translation share one AI call
const inFlightRequests = new Map<string, Promise<TranslateResult>>()

export async function translateText(
  adapter: CacheAdapter,
  config: TranslateConfig,
  params: TranslateParams
): Promise<TranslateResult> {
  const { text, to, from, context, resourceType, resourceId, field } = params
  
  // Empty text - return as-is
  if (!text.trim()) {
    return { text, from: from ?? 'en', to, cached: true }
  }

  // Check cache (resource-specific first, then hash-based)
  const cached = await getCached(adapter, { text, to, resourceType, resourceId, field })
  if (cached) {
    if (cached.from === to || (from && from === to)) {
      return { text, from: cached.from, to, cached: true }
    }
    return { 
      text: cached.text, 
      from: cached.from, 
      to, 
      cached: true,
      isManualOverride: cached.isManualOverride,
    }
  }

  // Create flight key for request coalescing
  const flightKey = hasResourceInfo(params)
    ? createResourceKey(resourceType!, resourceId!, field!, to)
    : createHashKey(text, to)

  // Check if there's already an in-flight request for this translation
  const existingFlight = inFlightRequests.get(flightKey)
  if (existingFlight) {
    // Wait for existing request instead of making new one
    return existingFlight
  }

  // Create new request and track it
  const flightPromise = executeTranslation(adapter, config, params)
  inFlightRequests.set(flightKey, flightPromise)

  try {
    return await flightPromise
  } finally {
    // Clean up after request completes (success or failure)
    inFlightRequests.delete(flightKey)
  }
}

async function executeTranslation(
  adapter: CacheAdapter,
  config: TranslateConfig,
  params: TranslateParams
): Promise<TranslateResult> {
  const { text, to, from, context, resourceType, resourceId, field } = params

  // Call AI
  const result = await translateWithOpenAI({
    apiKey: config.apiKey,
    model: config.model ?? 'gpt-4o-mini',
    text,
    to,
    from,
    context,
  })

  // Save to cache
  if (result.from !== to) {
    await setCache(adapter, {
      sourceText: text,
      sourceLanguage: result.from,
      targetLanguage: to,
      translatedText: result.text,
      provider: config.provider,
      model: config.model,
      resourceType,
      resourceId,
      field,
    })
  }

  return {
    text: result.text,
    from: result.from,
    to,
    cached: false,
  }
}

export async function translateBatch(
  adapter: CacheAdapter,
  config: TranslateConfig,
  params: BatchParams
): Promise<TranslateResult[]> {
  // Process in parallel (hash-based cache only for batch)
  return Promise.all(
    params.texts.map(text =>
      translateText(adapter, config, {
        text,
        to: params.to,
        from: params.from,
        context: params.context,
      })
    )
  )
}

export async function detectLanguage(
  config: TranslateConfig,
  text: string
): Promise<{ language: string; confidence: number }> {
  return detectLanguageWithOpenAI({
    apiKey: config.apiKey,
    model: config.model ?? 'gpt-4o-mini',
    text,
  })
}
```

---

## Step 11: Main Package Export

**File:** `packages/translate/src/index.ts`

```ts
export { createTranslate } from './create-translate'
export type { Translate, TranslateConfig } from './create-translate'

export type { CacheAdapter, CacheEntry } from './adapters/types'

export { createMemoryAdapter } from './adapters/memory'

export type {
  SupportedLanguage,
  TranslateParams,
  TranslateResult,
  BatchParams,
} from './types'

export { isRTL, getLanguageName } from './utils'
```

**File:** `packages/translate/src/utils.ts`

```ts
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
```

## Step 12: Create TanStack Start Documentation App

### apps/docs/package.json

```json
{
  "name": "@swalha1999/docs",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vinxi dev",
    "build": "vinxi build",
    "start": "vinxi start"
  },
  "dependencies": {
    "@tanstack/react-router": "^1.0.0",
    "@tanstack/start": "^1.0.0",
    "@swalha1999/translate": "workspace:*",
    "react": "^18.3.0",
    "react-dom": "^18.3.0",
    "vinxi": "^0.4.0",
    "shiki": "^1.0.0"
  },
  "devDependencies": {
    "@types/react": "^18.3.0",
    "@types/react-dom": "^18.3.0",
    "typescript": "^5.5.0",
    "tailwindcss": "^3.4.0"
  }
}
```

### apps/docs/app.config.ts

```ts
import { defineConfig } from '@tanstack/start/config'

export default defineConfig({
  server: {
    preset: 'node-server',
  },
})
```

### apps/docs/app/routes/__root.tsx

```tsx
import { Outlet, createRootRoute } from '@tanstack/react-router'
import { Sidebar } from '../components/Sidebar'
import '../styles/global.css'

export const Route = createRootRoute({
  component: RootLayout,
})

function RootLayout() {
  return (
    <html lang="en">
      <head>
        <meta charSet="UTF-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1.0" />
        <title>@swalha1999/translate - AI Translation for UGC</title>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link href="https://fonts.googleapis.com/css2?family=JetBrains+Mono:wght@400;500&family=Outfit:wght@400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body className="bg-zinc-950 text-zinc-100 font-outfit">
        <div className="flex min-h-screen">
          <Sidebar />
          <main className="flex-1 px-8 py-12 ml-64">
            <Outlet />
          </main>
        </div>
      </body>
    </html>
  )
}
```

### apps/docs/app/routes/index.tsx

```tsx
import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/')({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-12">
        <span className="px-3 py-1 text-sm font-medium bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
          v0.0.1
        </span>
      </div>
      
      <h1 className="text-6xl font-bold mb-6 bg-gradient-to-r from-white via-zinc-200 to-zinc-400 bg-clip-text text-transparent">
        @swalha1999/translate
      </h1>
      
      <p className="text-xl text-zinc-400 mb-12 leading-relaxed max-w-2xl">
        AI-powered translation for user-generated content. 
        Framework-agnostic, ORM-agnostic, with intelligent caching 
        and request coalescing.
      </p>

      <div className="grid grid-cols-2 gap-4 mb-12">
        <Feature 
          icon="⚡" 
          title="Intelligent Caching" 
          desc="Hash-based caching prevents duplicate translations"
        />
        <Feature 
          icon="🔄" 
          title="Request Coalescing" 
          desc="Prevents thundering herd with in-flight deduplication"
        />
        <Feature 
          icon="🔌" 
          title="Adapter Pattern" 
          desc="Works with Drizzle, Prisma, or custom storage"
        />
        <Feature 
          icon="🌍" 
          title="RTL Support" 
          desc="Built-in support for Arabic, Hebrew, and more"
        />
      </div>

      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800">
        <pre className="text-sm font-mono text-zinc-300">
{`import { createTranslate, createMemoryAdapter } from '@swalha1999/translate'

const translate = createTranslate({
  adapter: createMemoryAdapter(),
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  languages: ['en', 'ar', 'he', 'ru'],
})

const result = await translate.text({
  text: "شقة فاخرة في تل أبيب",
  to: 'en',
})
// → { text: "Luxury apartment in Tel Aviv", from: "ar" }`}
        </pre>
      </div>
    </div>
  )
}

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800/50">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-zinc-100 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500">{desc}</p>
    </div>
  )
}
```

### apps/docs/app/routes/docs/getting-started.tsx

```tsx
import { createFileRoute } from '@tanstack/react-router'
import { CodeBlock } from '../../components/CodeBlock'

export const Route = createFileRoute('/docs/getting-started')({
  component: GettingStartedPage,
})

function GettingStartedPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">Getting Started</h1>
      
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Installation</h2>
        <CodeBlock language="bash" code="pnpm add @swalha1999/translate" />
        
        <p className="text-zinc-400 mt-4 mb-4">
          For database persistence, install an adapter:
        </p>
        <CodeBlock language="bash" code="pnpm add @swalha1999/translate-adapter-drizzle" />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Quick Start</h2>
        <CodeBlock 
          language="typescript" 
          code={`import { createTranslate, createMemoryAdapter } from '@swalha1999/translate'

const translate = createTranslate({
  adapter: createMemoryAdapter(),
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  languages: ['en', 'ar', 'he', 'ru'],
})

// Translate text
const result = await translate.text({
  text: "Hello world",
  to: 'ar',
})

console.log(result.text)  // "مرحبا بالعالم"
console.log(result.from)  // "en" (auto-detected)`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">With Database Caching</h2>
        <CodeBlock 
          language="typescript" 
          code={`import { createTranslate } from '@swalha1999/translate'
import { createDrizzleAdapter, translationCache } from '@swalha1999/translate-adapter-drizzle'
import { db } from './db'

const translate = createTranslate({
  adapter: createDrizzleAdapter({ db, table: translationCache }),
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY,
  languages: ['en', 'ar', 'he', 'ru'],
})`}
        />
      </section>
    </div>
  )
}
```

### apps/docs/app/components/Sidebar.tsx

```tsx
import { Link, useLocation } from '@tanstack/react-router'

const navigation = [
  { name: 'Introduction', href: '/' },
  { name: 'Getting Started', href: '/docs/getting-started' },
  { name: 'Configuration', href: '/docs/configuration' },
  { name: 'Adapters', href: '/docs/adapters' },
  { name: 'API Reference', href: '/docs/api-reference' },
  { name: 'Examples', href: '/docs/examples' },
  { name: 'Playground', href: '/playground' },
]

export function Sidebar() {
  const location = useLocation()

  return (
    <aside className="fixed left-0 top-0 h-screen w-64 bg-zinc-900/50 border-r border-zinc-800 p-6">
      <div className="mb-8">
        <Link to="/" className="text-xl font-bold text-white">
          @swalha1999/translate
        </Link>
      </div>

      <nav className="space-y-1">
        {navigation.map((item) => {
          const isActive = location.pathname === item.href
          return (
            <Link
              key={item.href}
              to={item.href}
              className={`block px-3 py-2 rounded-lg text-sm transition-colors ${
                isActive
                  ? 'bg-emerald-500/10 text-emerald-400'
                  : 'text-zinc-400 hover:text-zinc-100 hover:bg-zinc-800/50'
              }`}
            >
              {item.name}
            </Link>
          )
        })}
      </nav>

      <div className="absolute bottom-6 left-6 right-6">
        <a
          href="https://github.com/swalha1999/translate"
          className="flex items-center gap-2 text-sm text-zinc-500 hover:text-zinc-300"
        >
          <span>GitHub</span>
        </a>
      </div>
    </aside>
  )
}
```

---

## Step 14: Example Usage Patterns

### With Any Framework

```ts
import { createTranslate } from '@swalha1999/translate'
import { createDrizzleAdapter } from '@swalha1999/translate-adapter-drizzle'
import { db } from './db'
import { translationCache } from './schema'

const adapter = createDrizzleAdapter({ db, table: translationCache })

export const translate = createTranslate({
  adapter,
  provider: 'openai',
  apiKey: process.env.OPENAI_API_KEY!,
  model: 'gpt-4o-mini',
  languages: ['en', 'ar', 'he', 'ru'],
})
```

### Using Other ORMs

```ts
// Prisma (via @swalha1999/translate-adapter-prisma)
import { createPrismaAdapter } from '@swalha1999/translate-adapter-prisma'
const adapter = createPrismaAdapter({ prisma, model: 'translationCache' })

// Custom (implement CacheAdapter interface)
import type { CacheAdapter } from '@swalha1999/translate'
const adapter: CacheAdapter = {
  get: async (id) => { /* your implementation */ },
  set: async (entry) => { /* your implementation */ },
  touch: async (id) => { /* ... */ },
  delete: async (id) => { /* ... */ },
  deleteByResource: async (type, id) => { /* ... */ },
  deleteByLanguage: async (lang) => { /* ... */ },
  deleteAll: async () => { /* ... */ },
  getStats: async () => { /* ... */ },
}
```

---

## Step 15: Usage in API Routes (Example)

Your API knows about your data model - the translate package doesn't need to:

```ts
import { translate } from '../lib/translate'

// Get property with translation
export const getProperty = publicProcedure
  .input(z.object({ 
    id: z.string(),
    locale: z.enum(['en', 'ar', 'he', 'ru']).optional(),
  }))
  .query(async ({ input }) => {
    const property = await getPropertyById(input.id)
    if (!property) return null
    
    const locale = input.locale ?? 'en'
    
    // Translate title and description (auto-detects source language)
    const [titleResult, descResult] = await translate.batch({
      texts: [property.title, property.description],
      to: locale,
      context: 'real estate property listing',
    })
    
    // If source language = target, original text is returned
    return {
      ...property,
      title: titleResult.text,
      description: descResult.text,
      _detectedLanguage: titleResult.from, // What language was the original?
    }
  })

// List properties with translation
export const listProperties = publicProcedure
  .input(z.object({ locale: z.string().optional() }))
  .query(async ({ input }) => {
    const properties = await getAllProperties()
    const locale = input.locale ?? 'en'
    
    // Batch translate all titles (descriptions loaded on detail view)
    const titles = await translate.batch({
      texts: properties.map(p => p.title),
      to: locale,
      context: 'real estate property title',
    })
    
    return properties.map((p, i) => ({
      ...p,
      title: titles[i].text,
    }))
  })
```

---

## Step 16: Use in Any Context

Same pattern works for any content:

```ts
// Simple: hash-based cache (shared across resources)
const todoTitle = await translate.text({
  text: todo.title,
  to: locale,
  context: 'task title',
})

// Resource-specific: when you need granular control
const propertyTitle = await translate.text({
  text: property.title,
  to: locale,
  context: 'real estate listing',
  resourceType: 'property',
  resourceId: property.id,
  field: 'title',
})
```

---

## Step 17: Manual Override Pattern

Allow users to correct AI translations:

```ts
// Set manual override
await translate.setManual({
  text: 'flat',
  translatedText: 'דירה',
  to: 'he',
  resourceType: 'property',
  resourceId: '123',
  field: 'propertyType',
})

// Clear manual override (reverts to AI translation)
await translate.clearManual({
  resourceType: 'property',
  resourceId: '123',
  field: 'propertyType',
  to: 'he',
})
```

## Files to Create

### Root Configuration
| File | Description |
|------|-------------|
| `pnpm-workspace.yaml` | Workspace configuration |
| `turbo.json` | Turborepo build configuration |
| `package.json` | Root package with scripts |
| `.changeset/config.json` | Changesets for versioning |

### Core Package (@swalha1999/translate)
| File | Description |
|------|-------------|
| `packages/translate/package.json` | Package config |
| `packages/translate/tsconfig.json` | TypeScript config |
| `packages/translate/tsdown.config.ts` | Build config |
| `packages/translate/src/index.ts` | Main exports |
| `packages/translate/src/create-translate.ts` | Factory function |
| `packages/translate/src/types.ts` | TypeScript types |
| `packages/translate/src/core.ts` | Core translation logic |
| `packages/translate/src/cache.ts` | Cache logic |
| `packages/translate/src/cache-key.ts` | Cache key utilities |
| `packages/translate/src/utils.ts` | isRTL, getLanguageName |
| `packages/translate/src/adapters/types.ts` | CacheAdapter interface |
| `packages/translate/src/adapters/memory.ts` | In-memory adapter |
| `packages/translate/src/providers/openai.ts` | OpenAI provider |
| `packages/translate/src/providers/types.ts` | Provider interface |

### Drizzle Adapter (@swalha1999/translate-adapter-drizzle)
| File | Description |
|------|-------------|
| `packages/adapter-drizzle/package.json` | Package config |
| `packages/adapter-drizzle/src/index.ts` | Main exports |
| `packages/adapter-drizzle/src/adapter.ts` | Drizzle adapter implementation |
| `packages/adapter-drizzle/src/schema.ts` | Ready-to-use Drizzle schema |

### Prisma Adapter (@swalha1999/translate-adapter-prisma)
| File | Description |
|------|-------------|
| `packages/adapter-prisma/package.json` | Package config |
| `packages/adapter-prisma/src/index.ts` | Main exports |
| `packages/adapter-prisma/src/adapter.ts` | Prisma adapter implementation |
| `packages/adapter-prisma/prisma/schema.prisma` | Ready-to-use Prisma schema |


### Shared Config Package (@swalha1999/config)
| File | Description |
|------|-------------|
| `packages/config/eslint/base.js` | Base ESLint config |
| `packages/config/typescript/base.json` | Base TSConfig |

### Documentation (TanStack Start)
| File | Description |
|------|-------------|
| `apps/docs/package.json` | Package config |
| `apps/docs/app.config.ts` | TanStack Start config |
| `apps/docs/app/routes/__root.tsx` | Root layout |
| `apps/docs/app/routes/index.tsx` | Homepage |
| `apps/docs/app/routes/docs/getting-started.tsx` | Getting started guide |
| `apps/docs/app/routes/docs/configuration.tsx` | Configuration docs |
| `apps/docs/app/routes/docs/adapters.tsx` | Adapters documentation |
| `apps/docs/app/routes/docs/api-reference.tsx` | API reference |
| `apps/docs/app/routes/docs/examples.tsx` | Usage examples |
| `apps/docs/app/routes/playground.tsx` | Interactive playground |
| `apps/docs/app/components/Sidebar.tsx` | Navigation sidebar |
| `apps/docs/app/components/CodeBlock.tsx` | Syntax-highlighted code |
| `apps/docs/app/components/Button.tsx` | Button component |
| `apps/docs/app/components/Card.tsx` | Card component |
| `apps/docs/app/styles/global.css` | Global styles (Tailwind) |

### Examples
| File | Description |
|------|-------------|
| `examples/with-nextjs/` | Next.js integration example |
| `examples/with-tanstack-start/` | TanStack Start example |
| `examples/with-express/` | Express.js API example |

---

## Package Dependencies Graph

```
                    ┌─────────────────────┐
                    │@swalha1999/translate│
                    │   (core package)    │
                    └─────────┬───────────┘
                              │
              ┌───────────────┴───────────────┐
              │                               │
              ▼                               ▼
    ┌─────────────────┐             ┌─────────────────┐
    │ adapter-drizzle │             │  adapter-prisma │
    │   (optional)    │             │   (optional)    │
    └────────┬────────┘             └────────┬────────┘
             │                               │
             └───────────────┬───────────────┘
                             │
                             ▼
                   ┌─────────────────────┐
                   │      Your App       │
                   └─────────────────────┘
```

### NPM Packages

| Package | Description |
|---------|-------------|
| `@swalha1999/translate` | Core translation library with memory adapter |
| `@swalha1999/translate-adapter-drizzle` | Drizzle ORM adapter + ready-to-use schema |
| `@swalha1999/translate-adapter-prisma` | Prisma adapter + ready-to-use schema |

---

## Cost Considerations

### GPT-4o-mini Pricing (as of late 2024)
- Input: $0.15 per 1M tokens
- Output: $0.60 per 1M tokens

### Estimated Costs
| Content | Avg Tokens | Cost per Translation |
|---------|------------|---------------------|
| Property title | ~20 | ~$0.000015 |
| Property description | ~200 | ~$0.00015 |
| Full property (3 languages) | ~660 | ~$0.0005 |

**1000 properties × 4 languages = ~$2.00**

### Cost Optimization
1. Cache aggressively - translations rarely change
2. Batch similar content in single API calls
3. Use shorter context prompts
4. Consider local models for high-volume scenarios

---

## Error Handling

```ts
try {
  const result = await translate.text({ text: content.title, to: locale })
  return { ...content, title: result.text }
} catch (error) {
  console.error('Translation failed:', error)
  return content
}
```

---

## Request Coalescing (Thundering Herd Prevention)

**Problem:** 10 users request same translation simultaneously → 10 identical AI requests

**Solution:** In-flight request tracking

```
User 1 requests "Luxury apartment" → he  (no cache)
  → Creates in-flight promise, calls AI
User 2 requests "Luxury apartment" → he  (no cache, but in-flight exists)
  → Waits for User 1's promise
...
AI responds → All users get the same result
Cache is populated → Future requests hit cache
```

**Result:** 10 concurrent requests = 1 AI call (not 10)

---

## Future Enhancements

1. **Batch API calls** - Group multiple translations into single OpenAI request
2. **Alternative providers** - Add Anthropic, Google Translate as fallbacks
3. **Glossary/context hints** - Improve translations with domain-specific terminology
4. **Quality metrics** - Track translation quality and user satisfaction
5. **LRU cleanup** - Automatically remove least-recently-used cache entries
