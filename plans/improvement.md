# Quick Wins: Performance, Bundle Size & DX

## Summary
Make the package faster, lighter, and easier to use with targeted improvements.

---

## 1. Bundle Size - Make It Lighter

### 1.1 Move AI SDK providers to optional peer dependencies (HIGH IMPACT)
**File:** `packages/translate/package.json`

**Problem:** All 5 providers bundled = ~500KB in node_modules even if user only needs one.

**Change:**
```json
"dependencies": {
  "ai": "^6.0.3"
},
"peerDependencies": {
  "@ai-sdk/openai": "^3.0.0",
  "@ai-sdk/anthropic": "^3.0.0",
  "@ai-sdk/google": "^3.0.0",
  "@ai-sdk/mistral": "^3.0.0",
  "@ai-sdk/groq": "^3.0.0"
},
"peerDependenciesMeta": {
  "@ai-sdk/openai": {"optional": true},
  "@ai-sdk/anthropic": {"optional": true},
  "@ai-sdk/google": {"optional": true},
  "@ai-sdk/mistral": {"optional": true},
  "@ai-sdk/groq": {"optional": true}
}
```

### 1.2 Remove provider re-exports from index.ts
**File:** `packages/translate/src/index.ts`

Remove direct provider exports - users import from `@ai-sdk/*` directly.

---

## 2. Performance - Make It Faster

### 2.1 Parallelize cache checks (MEDIUM IMPACT)
**File:** `packages/translate/src/cache.ts`

**Problem:** Sequential `await adapter.get()` calls for resource + hash cache.

**Fix:** Use `Promise.all()` to check both caches simultaneously.

### 2.2 Make touch() fire-and-forget (LOW IMPACT)
**File:** `packages/translate/src/cache.ts:25,38`

**Problem:** `await adapter.touch()` blocks the return of cached results.

**Fix:** Remove `await` - let it run in background.

### 2.3 Deduplicate batch texts (MEDIUM IMPACT)
**File:** `packages/translate/src/core.ts`

**Problem:** `translateBatch(['hello', 'world', 'hello'])` makes 3 API calls.

**Fix:** Dedupe texts → translate unique → map back to original positions.

---

## 3. Developer Experience - Make It Easier

### 3.1 Default to memory adapter (HIGH IMPACT)
**File:** `packages/translate/src/create-translate.ts`

**Problem:** Adapter is required - forces understanding of adapters upfront.

**Fix:** Default to `createMemoryAdapter()` if not provided.

### 3.2 Add default languages array
**File:** `packages/translate/src/create-translate.ts`

**Fix:** Default to `['en', 'ar', 'he', 'fr', 'de', 'es', 'ru']`.

### 3.3 Remove unused `defaultLanguage` config
**File:** `packages/translate/src/create-translate.ts`

It's defined but never used - remove it or implement it.

### 3.4 Better error messages (HIGH IMPACT)
**File:** `packages/translate/src/core.ts:189-191, 259-261`

**Problem:** Silent `console.error` + return original data.

**Fix:** Add `throwOnError` option or always throw with context:
```typescript
throw new TranslationError(`Failed to translate field "${field}" to ${to}: ${error.message}`)
```

### 3.5 Consolidate duplicate LANGUAGE_NAMES
**Files:** `src/utils.ts` and `src/providers/ai-sdk.ts`

Both define the same mapping - export from one place.

---

## Priority Summary

| # | Task | Impact | Effort | Category |
|---|------|--------|--------|----------|
| 1 | Providers → peer deps | High | Low | Bundle |
| 2 | Default memory adapter | High | Low | DX |
| 3 | Better error messages | High | Medium | DX |
| 4 | Parallelize cache checks | Medium | Low | Perf |
| 5 | Dedupe batch texts | Medium | Medium | Perf |
| 6 | Default languages | Low | Low | DX |
| 7 | Fire-and-forget touch() | Low | Low | Perf |
| 8 | Remove provider re-exports | Low | Low | Bundle |
| 9 | Consolidate LANGUAGE_NAMES | Low | Low | Code |
| 10 | Remove unused defaultLanguage | Low | Low | Code |

---

## Files to Modify

- `packages/translate/package.json` - peer deps
- `packages/translate/src/index.ts` - remove provider exports
- `packages/translate/src/cache.ts` - parallelize + fire-and-forget
- `packages/translate/src/core.ts` - batch dedupe + error handling
- `packages/translate/src/create-translate.ts` - defaults
- `packages/translate/src/utils.ts` - consolidate constants
- `packages/translate/src/providers/ai-sdk.ts` - import from utils
