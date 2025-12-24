import { CodeBlock } from '../components/CodeBlock'

export function GettingStartedPage() {
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
