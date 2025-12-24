import { CodeBlock } from '../components/CodeBlock'

export function AdaptersPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">Adapters</h1>

      <p className="text-zinc-400 mb-8">
        Adapters provide storage backends for caching translations. Choose the adapter
        that matches your stack, or implement your own.
      </p>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Memory Adapter</h2>
        <p className="text-zinc-400 mb-4">
          Built-in adapter for development and testing. Stores translations in memory.
        </p>
        <CodeBlock
          language="typescript"
          code={`import { createTranslate, createMemoryAdapter } from '@swalha1999/translate'

const translate = createTranslate({
  adapter: createMemoryAdapter(),
  // ...
})`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Drizzle Adapter</h2>
        <p className="text-zinc-400 mb-4">
          For production use with Drizzle ORM. Includes a ready-to-use schema.
        </p>
        <CodeBlock
          language="bash"
          code="pnpm add @swalha1999/translate-adapter-drizzle"
        />
        <div className="mt-4">
          <CodeBlock
            language="typescript"
            code={`import { createTranslate } from '@swalha1999/translate'
import { createDrizzleAdapter, translationCache } from '@swalha1999/translate-adapter-drizzle'
import { db } from './db'

const translate = createTranslate({
  adapter: createDrizzleAdapter({ db, table: translationCache }),
  // ...
})`}
          />
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Prisma Adapter</h2>
        <p className="text-zinc-400 mb-4">
          For production use with Prisma ORM. Includes a ready-to-use schema.
        </p>
        <CodeBlock
          language="bash"
          code="pnpm add @swalha1999/translate-adapter-prisma"
        />
        <div className="mt-4">
          <CodeBlock
            language="typescript"
            code={`import { createTranslate } from '@swalha1999/translate'
import { createPrismaAdapter } from '@swalha1999/translate-adapter-prisma'
import { prisma } from './db'

const translate = createTranslate({
  adapter: createPrismaAdapter({ prisma }),
  // ...
})`}
          />
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Custom Adapter</h2>
        <p className="text-zinc-400 mb-4">
          Implement the <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono">CacheAdapter</code> interface for custom storage:
        </p>
        <CodeBlock
          language="typescript"
          code={`import type { CacheAdapter } from '@swalha1999/translate'

const customAdapter: CacheAdapter = {
  get: async (id) => { /* ... */ },
  set: async (entry) => { /* ... */ },
  touch: async (id) => { /* ... */ },
  delete: async (id) => { /* ... */ },
  deleteByResource: async (type, id) => { /* ... */ },
  deleteByLanguage: async (lang) => { /* ... */ },
  deleteAll: async () => { /* ... */ },
  getStats: async () => { /* ... */ },
}`}
        />
      </section>
    </div>
  )
}
