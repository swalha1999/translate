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
        <pre className="text-sm font-mono text-zinc-300 overflow-x-auto">
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
