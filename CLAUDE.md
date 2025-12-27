# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Build & Development Commands

```bash
# Build all packages
pnpm build

# Run tests (single run)
pnpm test

# Run specific test file
cd packages/translate && pnpm vitest run src/__tests__/cache.test.ts

# Watch mode for development
pnpm dev

# Type checking
pnpm typecheck

# Linting
pnpm lint

# Version bumping (all packages)
pnpm version:patch   # or version:minor, version:major

# Release workflow
pnpm changeset       # Create changeset
pnpm release         # Build and publish
```

## Architecture

This is a PNPM monorepo using Turbo for task orchestration.

### Packages

- **`@swalha1999/translate`** - Core translation library with AI providers and caching
- **`@swalha1999/translate-adapter-drizzle`** - Drizzle ORM cache adapter
- **`@swalha1999/translate-adapter-prisma`** - Prisma ORM cache adapter
- **`@swalha1999/config`** - Shared ESLint and TypeScript configs (private)

### Core Package Structure (`packages/translate/src/`)

- `create-translate.ts` - Factory function `createTranslate()` and all type definitions
- `core.ts` - Translation logic with request deduplication via `inFlightRequests` Map
- `cache.ts` - Caching layer with `getCached()` and `setCache()`
- `cache-key.ts` - Dual key strategies: hash-based (`hash:{hash}:{lang}`) and resource-based (`res:{type}:{id}:{field}:{lang}`)
- `adapters/` - `CacheAdapter` interface and memory implementation
- `providers/ai-sdk.ts` - AI SDK integration for OpenAI, Anthropic, Google, Mistral, Groq

### Key Patterns

**Request Deduplication**: `core.ts` maintains an `inFlightRequests` Map to coalesce concurrent identical translation requests into a single API call.

**Adapter Pattern**: `CacheAdapter` interface allows swappable cache backends (memory, Drizzle, Prisma).

**Type-Safe Object Translation**: `StringKeys<T>` utility type extracts only string-valued fields for the `fields` parameter in `translate.object()`.

**Analytics**: Optional `onAnalytics` callback emits events for translations, cache hits, detection, and errors with timing data.

## Testing

Tests are in `packages/translate/src/__tests__/`. Uses Vitest with mocked AI providers:

```typescript
vi.mock('../providers/ai-sdk', () => ({
  translateWithAI: vi.fn(),
  detectLanguageWithAI: vi.fn(),
}))
```

## Supported Languages

`'en' | 'ar' | 'he' | 'ru' | 'ja' | 'ko' | 'zh' | 'hi' | 'el' | 'th' | 'fr' | 'de'`

RTL languages: `ar`, `he`
