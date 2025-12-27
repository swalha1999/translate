N+1 Issues

  1. Batch Cache Lookups (biggest issue)

  translateBatch() and translateObjects() call translateText() N times, each doing a separate cache lookup:

  // core.ts:171-180 - N separate cache queries!
  return Promise.all(
    params.texts.map(text => translateText(...))  // Each calls getCached()
  )

  Fix: Add getMany(ids: string[]) to CacheAdapter and batch the lookups.

  2. setCache is awaited

  core.ts:114 - Cache write blocks the response:

  await setCache(adapter, {...})  // Could be fire-and-forget

  Fix: Make it fire-and-forget like touch.

  3. No batch AI calls

  Each text = 1 LLM API call. Translating 10 texts = 10 API calls.

  Fix: Batch multiple texts into a single prompt for uncached texts.

  Proposed Optimizations

  | Issue                    | Impact | Effort |
  |--------------------------|--------|--------|
  | Batch cache getMany()    | High   | Medium |
  | Fire-and-forget setCache | Medium | Low    |
  | Batch LLM calls          | High   | Medium |
  | Batch cache setMany()    | Medium | Medium |

  Want me to implement these? I'd suggest starting with:
  1. Fire-and-forget setCache (quick win)
  2. Add getMany/setMany to CacheAdapter
  3. Batch cache lookups in translateBatch
