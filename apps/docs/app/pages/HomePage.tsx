import { Link } from 'react-router-dom'

function Feature({ icon, title, desc }: { icon: string; title: string; desc: string }) {
  return (
    <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800/50">
      <div className="text-2xl mb-2">{icon}</div>
      <h3 className="font-semibold text-zinc-100 mb-1">{title}</h3>
      <p className="text-sm text-zinc-500">{desc}</p>
    </div>
  )
}

export function HomePage() {
  return (
    <div className="max-w-4xl">
      <div className="mb-12">
        <span className="px-3 py-1 text-sm font-medium bg-emerald-500/10 text-emerald-400 rounded-full border border-emerald-500/20">
          v0.3.0
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
          desc="Dual-key caching (hash + resource) prevents duplicate translations"
        />
        <Feature
          icon="🔄"
          title="Request Coalescing"
          desc="Prevents thundering herd with in-flight deduplication"
        />
        <Feature
          icon="🤖"
          title="5 AI Providers"
          desc="OpenAI, Anthropic, Google, Mistral, and Groq via Vercel AI SDK"
        />
        <Feature
          icon="🌍"
          title="12 Languages"
          desc="Built-in RTL support for Arabic, Hebrew, and more"
        />
        <Feature
          icon="📦"
          title="Object Translation"
          desc="Type-safe translation of object fields with resource tracking"
        />
        <Feature
          icon="📊"
          title="Analytics Built-in"
          desc="Track translations, cache hits, and errors with callbacks"
        />
      </div>

      <div className="bg-zinc-900 rounded-xl p-6 border border-zinc-800 mb-8">
        <pre className="text-sm font-mono text-zinc-300 overflow-x-auto">
{`import { createTranslate, openai, createMemoryAdapter } from '@swalha1999/translate'

const translate = createTranslate({
  adapter: createMemoryAdapter(),
  model: openai('gpt-4o-mini'),
})

const result = await translate.text({
  text: "شقة فاخرة في تل أبيب",
  to: 'en',
})
// → { text: "Luxury apartment in Tel Aviv", from: "ar", cached: false }`}
        </pre>
      </div>

      <div className="flex gap-4">
        <Link
          to="/docs/getting-started"
          className="px-6 py-3 bg-emerald-500 hover:bg-emerald-600 text-white font-medium rounded-lg transition-colors"
        >
          Get Started
        </Link>
        <Link
          to="/docs/architecture"
          className="px-6 py-3 bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium rounded-lg transition-colors"
        >
          How It Works
        </Link>
      </div>
    </div>
  )
}
