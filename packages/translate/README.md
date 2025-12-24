# @swalha1999/translate

AI-powered translation for user-generated content with intelligent caching. Supports multiple AI providers (OpenAI, Anthropic, Google Gemini, Mistral, Groq) through a unified interface.

## Features

- **Multi-provider support** - OpenAI, Anthropic, Google Gemini, Mistral, Groq
- **Intelligent caching** - Hash-based and resource-based caching
- **Manual overrides** - Override AI translations for specific resources
- **RTL support** - Built-in RTL language detection
- **Batch translation** - Translate multiple texts efficiently
- **Object translation** - Type-safe translation of object fields in one line
- **Language detection** - Auto-detect source language
- **Database adapters** - Memory, Drizzle, Prisma

## Installation

```bash
# Core package
npm install @swalha1999/translate

# With Drizzle adapter
npm install @swalha1999/translate @swalha1999/translate-adapter-drizzle drizzle-orm

# With Prisma adapter
npm install @swalha1999/translate @swalha1999/translate-adapter-prisma @prisma/client
```

## Quick Start

```typescript
import { createTranslate, createMemoryAdapter, openai } from '@swalha1999/translate'

const translate = createTranslate({
  adapter: createMemoryAdapter(),
  model: openai('gpt-4o-mini'),
  languages: ['en', 'ar', 'he', 'ru'] as const,
})

// Translate text
const result = await translate.text({
  text: 'Hello, world!',
  to: 'ar',
})
console.log(result.text) // مرحبا بالعالم

// Batch translate
const results = await translate.batch({
  texts: ['Hello', 'Goodbye'],
  to: 'he',
})

// Detect language
const detected = await translate.detectLanguage('مرحبا')
console.log(detected.language) // 'ar'

// Translate object fields (type-safe!)
const todo = { id: 1, title: 'Buy groceries', description: 'Milk and eggs' }
const translated = await translate.object(todo, {
  fields: ['title', 'description'],
  to: 'ar',
})
// { id: 1, title: 'شراء البقالة', description: 'حليب وبيض' }

// Translate array of objects
const todos = [
  { id: 1, title: 'Buy groceries', done: false },
  { id: 2, title: 'Call mom', done: true },
]
const translatedTodos = await translate.objects(todos, {
  fields: ['title'],
  to: 'he',
  context: 'task management app',
})
```

## AI Providers

All providers are re-exported from the main package:

```typescript
import { openai, anthropic, google, mistral, groq } from '@swalha1999/translate'

// OpenAI
const t1 = createTranslate({
  model: openai('gpt-4o-mini'),
  // ...
})

// Anthropic Claude
const t2 = createTranslate({
  model: anthropic('claude-3-haiku-20240307'),
  // ...
})

// Google Gemini
const t3 = createTranslate({
  model: google('gemini-1.5-flash'),
  // ...
})

// Mistral
const t4 = createTranslate({
  model: mistral('mistral-small-latest'),
  // ...
})

// Groq (fast inference)
const t5 = createTranslate({
  model: groq('llama-3.1-70b-versatile'),
  // ...
})
```

Set API keys via environment variables:

```bash
OPENAI_API_KEY=sk-xxx
ANTHROPIC_API_KEY=sk-ant-xxx
GOOGLE_GENERATIVE_AI_API_KEY=xxx
MISTRAL_API_KEY=xxx
GROQ_API_KEY=gsk_xxx
```

## Database Adapters

### Drizzle Adapter

```bash
npm install @swalha1999/translate-adapter-drizzle drizzle-orm
```

**1. Add the schema to your Drizzle config:**

You can import the pre-built schema:

```typescript
// schema.ts
import { translationCache } from '@swalha1999/translate-adapter-drizzle/schema'

export { translationCache }
```

Or define it yourself (PostgreSQL):

```typescript
// schema.ts
import { pgTable, text, timestamp, boolean, index } from 'drizzle-orm/pg-core'

export const translationCache = pgTable('translation_cache', {
  id: text('id').primaryKey(),
  sourceText: text('source_text').notNull(),
  sourceLanguage: text('source_language').notNull(),
  targetLanguage: text('target_language').notNull(),
  translatedText: text('translated_text').notNull(),
  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  field: text('field'),
  isManualOverride: boolean('is_manual_override').notNull().default(false),
  provider: text('provider').notNull(),
  model: text('model'),
  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at').notNull().defaultNow(),
}, (table) => ({
  targetLangIdx: index('tc_target_lang_idx').on(table.targetLanguage),
  resourceIdx: index('tc_resource_idx').on(table.resourceType, table.resourceId, table.field),
  manualIdx: index('tc_manual_idx').on(table.isManualOverride),
}))
```

**2. Run migrations to create the table:**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

**3. Use the adapter:**

```typescript
import { createTranslate, openai } from '@swalha1999/translate'
import { createDrizzleAdapter } from '@swalha1999/translate-adapter-drizzle'
import { translationCache } from './schema'
import { drizzle } from 'drizzle-orm/node-postgres'

const db = drizzle(process.env.DATABASE_URL!)

const translate = createTranslate({
  adapter: createDrizzleAdapter({ db, table: translationCache }),
  model: openai('gpt-4o-mini'),
  languages: ['en', 'ar', 'he', 'ru'] as const,
})
```

### Prisma Adapter

```bash
npm install @swalha1999/translate-adapter-prisma @prisma/client
```

**1. Add the model to your Prisma schema:**

```prisma
// schema.prisma
model TranslationCache {
  id              String   @id
  sourceText      String
  sourceLanguage  String
  targetLanguage  String
  translatedText  String
  resourceType    String?
  resourceId      String?
  field           String?
  isManualOverride Boolean @default(false)
  provider        String
  model           String?
  createdAt       DateTime @default(now())
  updatedAt       DateTime @updatedAt
  lastUsedAt      DateTime @default(now())

  @@index([targetLanguage])
  @@index([resourceType, resourceId, field])
  @@index([isManualOverride])
  @@map("translation_cache")
}
```

**2. Run migrations:**

```bash
npx prisma migrate dev
```

**3. Use the adapter:**

```typescript
import { createTranslate, openai } from '@swalha1999/translate'
import { createPrismaAdapter } from '@swalha1999/translate-adapter-prisma'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const translate = createTranslate({
  adapter: createPrismaAdapter({ prisma }),
  model: openai('gpt-4o-mini'),
  languages: ['en', 'ar', 'he', 'ru'] as const,
})
```

## API Reference

### `createTranslate(config)`

Creates a translate instance.

```typescript
interface TranslateConfig {
  adapter: CacheAdapter
  model: LanguageModel
  languages: readonly string[]
  temperature?: number // default: 0.3
}
```

### `translate.text(params)`

Translate a single text.

```typescript
const result = await translate.text({
  text: 'Hello',
  to: 'ar',
  from: 'en', // optional, auto-detected if not provided
  context: 'greeting', // optional, helps with ambiguous terms
  resourceType: 'post', // optional, for resource-based caching
  resourceId: '123',
  field: 'title',
})

// Result
{
  text: 'مرحبا',
  from: 'en',
  to: 'ar',
  cached: false,
  isManualOverride: false
}
```

### `translate.batch(params)`

Translate multiple texts.

```typescript
const results = await translate.batch({
  texts: ['Hello', 'Goodbye'],
  to: 'he',
  from: 'en',
  context: 'greetings',
})
```

### `translate.object(item, params)`

Translate specific fields of an object. Type-safe - only accepts fields with string values.

```typescript
const todo = {
  id: 1,
  title: 'Buy groceries',
  description: 'Milk, eggs, and bread',
  priority: 5,
}

const translated = await translate.object(todo, {
  fields: ['title', 'description'], // Only string fields allowed
  to: 'ar',
  from: 'en', // optional
  context: 'task management', // optional
})

// Result: { id: 1, title: 'شراء البقالة', description: '...', priority: 5 }
```

**Error handling:** On translation failure, logs to console and returns the original object unchanged.

### `translate.objects(items, params)`

Translate specific fields across an array of objects. Batches all translations efficiently.

```typescript
const todos = [
  { id: 1, title: 'Buy groceries', description: 'Milk and eggs' },
  { id: 2, title: 'Call mom', description: null },
  { id: 3, title: 'Exercise', description: 'Go for a run' },
]

const translated = await translate.objects(todos, {
  fields: ['title', 'description'],
  to: 'he',
  context: 'task management app',
})
```

**Features:**
- Batches all text fields into a single translation call
- Skips null/undefined/empty fields automatically
- Returns original array on error (with console.error log)
- Preserves object structure and non-translated fields

### `translate.setManual(params)`

Set a manual translation override.

```typescript
await translate.setManual({
  text: 'flat',
  translatedText: 'דירה',
  to: 'he',
  resourceType: 'property',
  resourceId: '123',
  field: 'type',
})
```

### `translate.clearManual(params)`

Clear a manual override.

```typescript
await translate.clearManual({
  resourceType: 'property',
  resourceId: '123',
  field: 'type',
  to: 'he',
})
```

### `translate.detectLanguage(text)`

Detect the language of a text.

```typescript
const result = await translate.detectLanguage('مرحبا')
// { language: 'ar', confidence: 0.9 }
```

### `translate.isRTL(language)`

Check if a language is RTL.

```typescript
translate.isRTL('ar') // true
translate.isRTL('en') // false
```

### `translate.clearCache(language?)`

Clear cached translations.

```typescript
await translate.clearCache() // Clear all
await translate.clearCache('he') // Clear specific language
```

### `translate.clearResourceCache(resourceType, resourceId)`

Clear cache for a specific resource.

```typescript
await translate.clearResourceCache('property', '123')
```

### `translate.getCacheStats()`

Get cache statistics.

```typescript
const stats = await translate.getCacheStats()
// {
//   totalEntries: 150,
//   byLanguage: { ar: 50, he: 100 },
//   manualOverrides: 5
// }
```

## License

MIT
