# @swalha1999/translate

AI-powered translation for user-generated content with intelligent caching. Supports multiple AI providers (OpenAI, Anthropic, Google Gemini, Mistral, Groq) through a unified interface.

## Features

- **Multi-provider support** - OpenAI, Anthropic, Google Gemini, Mistral, Groq
- **Intelligent caching** - Hash-based and resource-based caching
- **Manual overrides** - Override AI translations for specific resources
- **RTL support** - Built-in RTL language detection
- **Batch translation** - Translate multiple texts efficiently
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

```typescript
// schema.ts
import { translationCache } from '@swalha1999/translate-adapter-drizzle/schema'

export { translationCache }
```

**2. Run migrations to create the table:**

```bash
npx drizzle-kit generate
npx drizzle-kit migrate
```

**3. Use the adapter:**

```typescript
import { createTranslate, openai } from '@swalha1999/translate'
import { createDrizzleAdapter, translationCache } from '@swalha1999/translate-adapter-drizzle'
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
