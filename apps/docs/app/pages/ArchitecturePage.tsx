import { Mermaid } from '../components/Mermaid'

export function ArchitecturePage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-4xl font-bold mb-4 text-white">Architecture</h1>
      <p className="text-zinc-400 mb-8">
        Understanding how @swalha1999/translate works under the hood.
      </p>

      {/* High-Level Overview */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-4">High-Level Overview</h2>
        <p className="text-zinc-400 mb-4">
          The translation library is designed around three core principles: <strong>intelligent caching</strong>,{' '}
          <strong>request deduplication</strong>, and <strong>adapter-based storage</strong>.
        </p>
        <Mermaid
          title="System Architecture"
          chart={`
flowchart TB
    subgraph Client["Your Application"]
        A[translate.text] --> B[translate.batch]
        A --> C[translate.object]
        A --> D[translate.objects]
    end

    subgraph Core["Translation Core"]
        E[Request Deduplication]
        F[Cache Layer]
        G[AI Provider]
    end

    subgraph Storage["Cache Adapters"]
        H[(Memory)]
        I[(Drizzle/PostgreSQL)]
        J[(Prisma/Any DB)]
    end

    subgraph Providers["AI Providers"]
        K[OpenAI]
        L[Anthropic]
        M[Google Gemini]
        N[Mistral]
        O[Groq]
    end

    B --> E
    C --> E
    D --> E
    E --> F
    F -->|Cache Miss| G
    F -->|Cache Hit| Client
    G --> Providers
    F --> Storage
`}
        />
      </section>

      {/* Request Flow */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-4">Translation Request Flow</h2>
        <p className="text-zinc-400 mb-4">
          Every translation request goes through a multi-stage pipeline optimized for performance and cost reduction.
        </p>
        <Mermaid
          title="Request Processing Pipeline"
          chart={`
sequenceDiagram
    participant App as Your App
    participant Core as Translation Core
    participant Dedup as Request Deduplication
    participant Cache as Cache Layer
    participant AI as AI Provider

    App->>Core: translate.text({ text, to })
    Core->>Dedup: Check in-flight requests

    alt Duplicate Request
        Dedup-->>Core: Return existing Promise
        Core-->>App: Await shared result
    else New Request
        Dedup->>Cache: Check cache (hash + resource key)

        alt Cache Hit
            Cache-->>Core: Return cached translation
            Core->>Cache: Touch (update lastUsedAt)
            Core-->>App: Return result (cached: true)
        else Cache Miss
            Cache->>AI: Call AI provider
            AI-->>Cache: Translation result
            Cache->>Cache: Store in cache (fire-and-forget)
            Core-->>App: Return result (cached: false)
        end
    end
`}
        />
      </section>

      {/* Caching Strategy */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-4">Dual Cache Key Strategy</h2>
        <p className="text-zinc-400 mb-4">
          The library uses two caching strategies that work together: <strong>hash-based</strong> for text deduplication
          and <strong>resource-based</strong> for object field tracking.
        </p>
        <Mermaid
          title="Cache Key Selection"
          chart={`
flowchart TD
    A[Translation Request] --> B{Has Resource Info?}

    B -->|Yes| C[Resource Key]
    B -->|No| D[Hash Key]

    C --> E["res:{type}:{id}:{field}:{lang}"]
    D --> F["hash:{textHash}:{lang}"]

    E --> G[Lookup Both Keys in Parallel]
    F --> G

    G --> H{Resource Key Found?}
    H -->|Yes| I[Return Resource Result]
    H -->|No| J{Hash Key Found?}
    J -->|Yes| K[Return Hash Result]
    J -->|No| L[Call AI Provider]

    I --> M[Supports Manual Overrides]
    K --> N[Text-based Deduplication]

    style E fill:#10b981,color:#fff
    style F fill:#3b82f6,color:#fff
`}
        />

        <div className="grid grid-cols-2 gap-4 mt-6">
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <h4 className="font-semibold text-emerald-400 mb-2">Resource Key</h4>
            <code className="text-sm text-zinc-300">res:product:123:title:he</code>
            <p className="text-sm text-zinc-500 mt-2">
              Used for object fields. Enables manual overrides and field-specific caching.
            </p>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <h4 className="font-semibold text-blue-400 mb-2">Hash Key</h4>
            <code className="text-sm text-zinc-300">hash:a1b2c3d4:he</code>
            <p className="text-sm text-zinc-500 mt-2">
              Used for plain text. Prevents duplicate translations of identical content.
            </p>
          </div>
        </div>
      </section>

      {/* Request Deduplication */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-4">Request Deduplication</h2>
        <p className="text-zinc-400 mb-4">
          When multiple requests for the same translation come in simultaneously, only one AI call is made.
          All requests share the same Promise.
        </p>
        <Mermaid
          title="In-Flight Request Coalescing"
          chart={`
sequenceDiagram
    participant R1 as Request 1
    participant R2 as Request 2
    participant R3 as Request 3
    participant Map as inFlightRequests Map
    participant AI as AI Provider

    R1->>Map: Check "hello" → "he"
    Map-->>R1: Not found
    R1->>Map: Store Promise
    R1->>AI: Call AI (async)

    Note over R1,AI: AI processing...

    R2->>Map: Check "hello" → "he"
    Map-->>R2: Found existing Promise
    R2->>R1: Await shared Promise

    R3->>Map: Check "hello" → "he"
    Map-->>R3: Found existing Promise
    R3->>R1: Await shared Promise

    AI-->>R1: Return translation
    R1->>Map: Delete entry
    R1-->>R2: Resolve with result
    R1-->>R3: Resolve with result

    Note over R1,R3: 3 requests, 1 AI call
`}
        />
      </section>

      {/* Batch Operations */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-4">Batch Processing</h2>
        <p className="text-zinc-400 mb-4">
          Batch operations are optimized with text deduplication. If the same text appears multiple times,
          it's only translated once.
        </p>
        <Mermaid
          title="Batch Translation with Deduplication"
          chart={`
flowchart LR
    subgraph Input["Input Array"]
        A1["'Hello'"]
        A2["'World'"]
        A3["'Hello'"]
        A4["'Hello'"]
    end

    subgraph Dedup["Deduplicate"]
        B1["'Hello' → [0,2,3]"]
        B2["'World' → [1]"]
    end

    subgraph Translate["AI Calls"]
        C1["Translate 'Hello'"]
        C2["Translate 'World'"]
    end

    subgraph Output["Result Array"]
        D1["'שלום'"]
        D2["'עולם'"]
        D3["'שלום'"]
        D4["'שלום'"]
    end

    Input --> Dedup
    Dedup --> Translate
    Translate --> Output

    style C1 fill:#10b981,color:#fff
    style C2 fill:#10b981,color:#fff
`}
        />
        <p className="text-sm text-zinc-500 mt-4">
          In this example, 4 texts result in only 2 AI calls. The results are mapped back to their original indices.
        </p>
      </section>

      {/* Adapter Pattern */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-4">Adapter Pattern</h2>
        <p className="text-zinc-400 mb-4">
          The cache adapter interface abstracts storage, allowing you to use any database or storage system.
        </p>
        <Mermaid
          title="Cache Adapter Interface"
          chart={`
classDiagram
    class CacheAdapter {
        <<interface>>
        +get(id: string) CacheEntry | null
        +getMany(ids: string[]) Map~string, CacheEntry~
        +set(entry: CacheEntry) void
        +setMany(entries: CacheEntry[]) void
        +touch(id: string) void
        +touchMany(ids: string[]) void
        +delete(id: string) void
        +deleteByResource(type, id) number
        +deleteByLanguage(lang) number
        +deleteAll() number
        +getStats() CacheStats
    }

    class MemoryAdapter {
        -cache: Map
        +get()
        +set()
        ...
    }

    class DrizzleAdapter {
        -db: DrizzleDB
        -table: Table
        +get()
        +set()
        ...
    }

    class PrismaAdapter {
        -prisma: PrismaClient
        +get()
        +set()
        ...
    }

    CacheAdapter <|.. MemoryAdapter
    CacheAdapter <|.. DrizzleAdapter
    CacheAdapter <|.. PrismaAdapter
`}
        />
      </section>

      {/* Analytics Flow */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-4">Analytics & Monitoring</h2>
        <p className="text-zinc-400 mb-4">
          The library emits analytics events for every operation, allowing you to track usage, cache hit rates, and errors.
        </p>
        <Mermaid
          title="Analytics Event Flow"
          chart={`
flowchart LR
    subgraph Events["Analytics Events"]
        A[translation]
        B[cache_hit]
        C[detection]
        D[error]
    end

    subgraph Data["Event Data"]
        E[text, translatedText]
        F[from, to languages]
        G[duration ms]
        H[provider, model]
        I[cached: boolean]
        J[error message]
    end

    subgraph Handlers["Your Handlers"]
        K[Logging]
        L[Metrics]
        M[Cost Tracking]
        N[Alerting]
    end

    Events --> Data
    Data --> Handlers
`}
        />

        <div className="bg-zinc-900 rounded-lg p-4 mt-4 border border-zinc-800">
          <pre className="text-sm font-mono text-zinc-300 overflow-x-auto">
{`const translate = createTranslate({
  model: openai('gpt-4o-mini'),
  adapter: createMemoryAdapter(),
  onAnalytics: (event) => {
    // event.type: 'translation' | 'cache_hit' | 'detection' | 'error'
    console.log(\`[\${event.type}] \${event.text} → \${event.translatedText}\`)
    console.log(\`  Duration: \${event.duration}ms, Cached: \${event.cached}\`)
  },
  onCacheError: (error, operation) => {
    console.error(\`Cache \${operation} failed:\`, error.message)
  },
})`}
          </pre>
        </div>
      </section>

      {/* Provider Architecture */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-4">Multi-Provider Support</h2>
        <p className="text-zinc-400 mb-4">
          Built on the Vercel AI SDK, the library supports multiple AI providers with a unified interface.
        </p>
        <Mermaid
          title="AI Provider Integration"
          chart={`
flowchart TB
    subgraph SDK["Vercel AI SDK"]
        A[LanguageModel Interface]
    end

    subgraph Providers["Supported Providers"]
        B[openai] --> A
        C[anthropic] --> A
        D[google] --> A
        E[mistral] --> A
        F[groq] --> A
    end

    subgraph Models["Example Models"]
        B --> G["gpt-4o-mini"]
        B --> H["gpt-4o"]
        C --> I["claude-3-haiku"]
        C --> J["claude-3-sonnet"]
        D --> K["gemini-1.5-flash"]
        E --> L["mistral-small"]
        F --> M["llama-3.1-70b"]
    end

    A --> N[translateWithAI]
    A --> O[detectLanguageWithAI]
`}
        />
      </section>

      {/* Data Flow Summary */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold text-white mb-4">Complete Data Flow</h2>
        <Mermaid
          chart={`
flowchart TB
    A[Your App] -->|translate.text/batch/object| B[Translation Core]

    B --> C{In-Flight Check}
    C -->|Duplicate| D[Return Shared Promise]
    C -->|New| E[Cache Lookup]

    E --> F{Cache Hit?}
    F -->|Yes| G[Return Cached + Analytics]
    F -->|No| H[AI Translation]

    H --> I[AI Provider]
    I --> J[Store in Cache]
    J --> K[Emit Analytics]
    K --> L[Return Result]

    G --> A
    D --> A
    L --> A

    style A fill:#10b981,color:#fff
    style I fill:#3b82f6,color:#fff
    style J fill:#f59e0b,color:#fff
`}
        />
      </section>
    </div>
  )
}
