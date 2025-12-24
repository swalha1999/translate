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
