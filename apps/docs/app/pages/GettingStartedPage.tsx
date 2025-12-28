import { CodeBlock } from '../components/CodeBlock'

export function GettingStartedPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-bold mb-8 text-white">Getting Started</h1>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Installation</h2>
        <CodeBlock language="bash" code="pnpm add @swalha1999/translate" />

        <p className="text-zinc-400 mt-4 mb-4">
          For database persistence, install an adapter:
        </p>
        <CodeBlock
          language="bash"
          code={`# For Drizzle ORM
pnpm add @swalha1999/translate-adapter-drizzle

# For Prisma
pnpm add @swalha1999/translate-adapter-prisma`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Quick Start</h2>
        <p className="text-zinc-400 mb-4">
          The library uses the Vercel AI SDK for model integration. Import your preferred provider
          and pass it to <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono">createTranslate</code>.
        </p>
        <CodeBlock
          language="typescript"
          code={`import { createTranslate, openai, createMemoryAdapter } from '@swalha1999/translate'

const translate = createTranslate({
  adapter: createMemoryAdapter(),
  model: openai('gpt-4o-mini'),
})

// Translate text
const result = await translate.text({
  text: "Hello world",
  to: 'ar',
})

console.log(result.text)  // "مرحبا بالعالم"
console.log(result.from)  // "en" (auto-detected)
console.log(result.cached) // false (first request)`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">With Database Caching</h2>
        <p className="text-zinc-400 mb-4">
          Use the Drizzle or Prisma adapter for persistent caching across server restarts.
        </p>
        <CodeBlock
          language="typescript"
          code={`import { createTranslate, openai } from '@swalha1999/translate'
import { createDrizzleAdapter, translationCache } from '@swalha1999/translate-adapter-drizzle'
import { db } from './db'

const translate = createTranslate({
  adapter: createDrizzleAdapter({ db, table: translationCache }),
  model: openai('gpt-4o-mini'),
})`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Translate Objects</h2>
        <p className="text-zinc-400 mb-4">
          Translate specific fields of an object with type safety.
        </p>
        <CodeBlock
          language="typescript"
          code={`const product = {
  id: '123',
  title: 'Wireless Headphones',
  description: 'Premium noise-canceling headphones',
  price: 199,
}

const translated = await translate.object({
  object: product,
  fields: ['title', 'description'], // Only string fields allowed
  to: 'ar',
})

// translated.title → "سماعات لاسلكية"
// translated.description → "سماعات رأس متميزة بخاصية إلغاء الضوضاء"
// translated.id → "123" (unchanged)
// translated.price → 199 (unchanged)`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Batch Translation</h2>
        <p className="text-zinc-400 mb-4">
          Translate multiple texts or objects efficiently with automatic deduplication.
        </p>
        <CodeBlock
          language="typescript"
          code={`// Batch text translation
const results = await translate.batch({
  texts: ['Hello', 'World', 'Hello'], // Duplicates only translated once
  to: 'he',
})
// → ['שלום', 'עולם', 'שלום']

// Batch object translation
const products = [
  { id: '1', title: 'Chair', description: 'Comfortable office chair' },
  { id: '2', title: 'Desk', description: 'Standing desk' },
]

const translatedProducts = await translate.objects({
  objects: products,
  fields: ['title', 'description'],
  to: 'ja',
})`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Language Detection</h2>
        <p className="text-zinc-400 mb-4">
          Detect the language of any text.
        </p>
        <CodeBlock
          language="typescript"
          code={`const detected = await translate.detect('مرحبا بالعالم')
console.log(detected) // 'ar'`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Environment Variables</h2>
        <p className="text-zinc-400 mb-4">
          Set the API key for your chosen provider:
        </p>
        <CodeBlock
          language="bash"
          code={`# OpenAI
OPENAI_API_KEY=sk-...

# Anthropic
ANTHROPIC_API_KEY=sk-ant-...

# Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=...

# Mistral
MISTRAL_API_KEY=...

# Groq
GROQ_API_KEY=gsk_...`}
        />
      </section>
    </div>
  )
}
