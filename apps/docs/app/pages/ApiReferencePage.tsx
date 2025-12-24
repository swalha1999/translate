import { CodeBlock } from '../components/CodeBlock'

export function ApiReferencePage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">API Reference</h1>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">translate.text()</h2>
        <p className="text-zinc-400 mb-4">Translate a single text string.</p>
        <CodeBlock
          language="typescript"
          code={`interface TranslateParams {
  text: string              // Text to translate
  to: SupportedLanguage     // Target language
  from?: SupportedLanguage  // Source language (auto-detect if omitted)
  context?: string          // Hint for AI translation
  resourceType?: string     // Optional: for resource-specific caching
  resourceId?: string       // Optional: for resource-specific caching
  field?: string            // Optional: for resource-specific caching
}

interface TranslateResult {
  text: string              // Translated text
  from: SupportedLanguage   // Detected/provided source language
  to: SupportedLanguage     // Target language
  cached: boolean           // Was this from cache?
  isManualOverride?: boolean // Was this a manual override?
}

const result = await translate.text({
  text: "Hello world",
  to: 'ar',
})
// → { text: "مرحبا بالعالم", from: "en", to: "ar", cached: false }`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">translate.batch()</h2>
        <p className="text-zinc-400 mb-4">Translate multiple texts in parallel.</p>
        <CodeBlock
          language="typescript"
          code={`interface BatchParams {
  texts: string[]           // Array of texts to translate
  to: SupportedLanguage     // Target language
  from?: SupportedLanguage  // Source language (auto-detect if omitted)
  context?: string          // Hint for AI translation
}

const results = await translate.batch({
  texts: ["Hello", "Goodbye"],
  to: 'he',
})
// → [{ text: "שלום", ... }, { text: "להתראות", ... }]`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">translate.object()</h2>
        <p className="text-zinc-400 mb-4">
          Translate specific fields of an object. Type-safe - only accepts fields with string values.
        </p>
        <CodeBlock
          language="typescript"
          code={`interface ObjectTranslateParams<T, K> {
  fields: K[]               // Fields to translate (must be string fields)
  to: SupportedLanguage     // Target language
  from?: SupportedLanguage  // Source language (auto-detect if omitted)
  context?: string          // Hint for AI translation
}

const todo = {
  id: 1,
  title: 'Buy groceries',
  description: 'Milk, eggs, and bread',
  priority: 5,
}

const translated = await translate.object(todo, {
  fields: ['title', 'description'], // Only string fields allowed
  to: 'ar',
  context: 'task management',
})
// → { id: 1, title: 'شراء البقالة', description: '...', priority: 5 }

// On error: logs to console and returns original object unchanged`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">translate.objects()</h2>
        <p className="text-zinc-400 mb-4">
          Translate specific fields across an array of objects. Batches all translations efficiently.
        </p>
        <CodeBlock
          language="typescript"
          code={`const todos = [
  { id: 1, title: 'Buy groceries', description: 'Milk and eggs' },
  { id: 2, title: 'Call mom', description: null },
  { id: 3, title: 'Exercise', description: 'Go for a run' },
]

const translated = await translate.objects(todos, {
  fields: ['title', 'description'],
  to: 'he',
  context: 'task management app',
})

// Features:
// - Batches all text fields into a single translation call
// - Skips null/undefined/empty fields automatically
// - Returns original array on error (with console.error log)
// - Preserves object structure and non-translated fields`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">translate.setManual()</h2>
        <p className="text-zinc-400 mb-4">Set a manual translation override for a specific resource.</p>
        <CodeBlock
          language="typescript"
          code={`await translate.setManual({
  text: "flat",
  translatedText: "דירה",
  to: 'he',
  resourceType: 'property',
  resourceId: '123',
  field: 'propertyType',
})`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">translate.clearManual()</h2>
        <p className="text-zinc-400 mb-4">Clear a manual override, reverting to AI translation.</p>
        <CodeBlock
          language="typescript"
          code={`await translate.clearManual({
  resourceType: 'property',
  resourceId: '123',
  field: 'propertyType',
  to: 'he',
})`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">translate.detectLanguage()</h2>
        <p className="text-zinc-400 mb-4">Detect the language of a text without translating.</p>
        <CodeBlock
          language="typescript"
          code={`const result = await translate.detectLanguage("مرحبا")
// → { language: "ar", confidence: 0.9 }`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Cache Management</h2>
        <CodeBlock
          language="typescript"
          code={`// Clear all cache entries for a language
await translate.clearCache('he')

// Clear all cache entries
await translate.clearCache()

// Clear cache for a specific resource
await translate.clearResourceCache('property', '123')

// Get cache statistics
const stats = await translate.getCacheStats()
// → { totalEntries: 100, byLanguage: { he: 50, ar: 50 }, manualOverrides: 5 }`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Utilities</h2>
        <CodeBlock
          language="typescript"
          code={`// Check if a language is RTL
translate.isRTL('ar')  // true
translate.isRTL('en')  // false

// Access configured languages
translate.languages  // ['en', 'ar', 'he', 'ru']

// Helper functions (also exported from package)
import { isRTL, getLanguageName } from '@swalha1999/translate'

isRTL('he')           // true
getLanguageName('ar') // "Arabic"`}
        />
      </section>
    </div>
  )
}
