import { CodeBlock } from '../components/CodeBlock'

export function ConfigurationPage() {
  return (
    <div className="max-w-4xl">
      <h1 className="text-4xl font-bold mb-4 text-white">Configuration</h1>
      <p className="text-zinc-400 mb-8">
        Configure your translation instance with AI providers, caching, and advanced options.
      </p>

      {/* TranslateConfig Interface */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">TranslateConfig</h2>
        <p className="text-zinc-400 mb-4">
          The <code className="bg-zinc-800 px-1.5 py-0.5 rounded text-sm font-mono">createTranslate</code> function accepts the following configuration:
        </p>
        <CodeBlock
          language="typescript"
          code={`interface TranslateConfig {
  // Required: Cache adapter for storing translations
  adapter: CacheAdapter

  // Required: AI model from any supported provider
  model: LanguageModel

  // Optional: Supported languages (for validation)
  languages?: readonly SupportedLanguage[]

  // Optional: Default source language
  defaultLanguage?: SupportedLanguage

  // Optional: Model temperature (0-1, default varies by operation)
  temperature?: number

  // Optional: Enable debug logging
  verbose?: boolean

  // Optional: Analytics callback for tracking
  onAnalytics?: (event: AnalyticsEvent) => void | Promise<void>

  // Optional: Cache error callback
  onCacheError?: (error: Error, operation: 'get' | 'set' | 'touch') => void
}`}
        />
      </section>

      {/* AI Providers */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">AI Providers</h2>
        <p className="text-zinc-400 mb-4">
          The library supports 5 AI providers through the Vercel AI SDK. Each provider is exported directly from the package.
        </p>

        <div className="space-y-6">
          {/* OpenAI */}
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🟢</span>
              <h3 className="text-lg font-semibold text-white">OpenAI</h3>
            </div>
            <CodeBlock
              language="typescript"
              code={`import { createTranslate, openai, createMemoryAdapter } from '@swalha1999/translate'

const translate = createTranslate({
  adapter: createMemoryAdapter(),
  model: openai('gpt-4o-mini'), // or 'gpt-4o', 'gpt-4-turbo'
})`}
            />
            <p className="text-sm text-zinc-500 mt-2">
              Env: <code className="bg-zinc-800 px-1 rounded">OPENAI_API_KEY</code>
            </p>
          </div>

          {/* Anthropic */}
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🟤</span>
              <h3 className="text-lg font-semibold text-white">Anthropic</h3>
            </div>
            <CodeBlock
              language="typescript"
              code={`import { createTranslate, anthropic, createMemoryAdapter } from '@swalha1999/translate'

const translate = createTranslate({
  adapter: createMemoryAdapter(),
  model: anthropic('claude-3-haiku-20240307'), // or 'claude-3-sonnet', 'claude-3-opus'
})`}
            />
            <p className="text-sm text-zinc-500 mt-2">
              Env: <code className="bg-zinc-800 px-1 rounded">ANTHROPIC_API_KEY</code>
            </p>
          </div>

          {/* Google */}
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🔵</span>
              <h3 className="text-lg font-semibold text-white">Google Gemini</h3>
            </div>
            <CodeBlock
              language="typescript"
              code={`import { createTranslate, google, createMemoryAdapter } from '@swalha1999/translate'

const translate = createTranslate({
  adapter: createMemoryAdapter(),
  model: google('gemini-1.5-flash'), // or 'gemini-1.5-pro'
})`}
            />
            <p className="text-sm text-zinc-500 mt-2">
              Env: <code className="bg-zinc-800 px-1 rounded">GOOGLE_GENERATIVE_AI_API_KEY</code>
            </p>
          </div>

          {/* Mistral */}
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">🟠</span>
              <h3 className="text-lg font-semibold text-white">Mistral</h3>
            </div>
            <CodeBlock
              language="typescript"
              code={`import { createTranslate, mistral, createMemoryAdapter } from '@swalha1999/translate'

const translate = createTranslate({
  adapter: createMemoryAdapter(),
  model: mistral('mistral-small-latest'), // or 'mistral-medium', 'mistral-large'
})`}
            />
            <p className="text-sm text-zinc-500 mt-2">
              Env: <code className="bg-zinc-800 px-1 rounded">MISTRAL_API_KEY</code>
            </p>
          </div>

          {/* Groq */}
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <div className="flex items-center gap-3 mb-3">
              <span className="text-2xl">⚡</span>
              <h3 className="text-lg font-semibold text-white">Groq</h3>
            </div>
            <CodeBlock
              language="typescript"
              code={`import { createTranslate, groq, createMemoryAdapter } from '@swalha1999/translate'

const translate = createTranslate({
  adapter: createMemoryAdapter(),
  model: groq('llama-3.1-70b-versatile'), // Fast inference
})`}
            />
            <p className="text-sm text-zinc-500 mt-2">
              Env: <code className="bg-zinc-800 px-1 rounded">GROQ_API_KEY</code>
            </p>
          </div>
        </div>
      </section>

      {/* Supported Languages */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Supported Languages</h2>
        <p className="text-zinc-400 mb-4">
          12 languages are supported out of the box, including RTL languages.
        </p>
        <div className="bg-zinc-900/50 rounded-xl border border-zinc-800 overflow-hidden">
          <table className="w-full text-sm">
            <thead className="border-b border-zinc-800">
              <tr>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Code</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Language</th>
                <th className="px-4 py-3 text-left text-zinc-400 font-medium">Direction</th>
              </tr>
            </thead>
            <tbody className="text-zinc-300">
              <tr className="border-b border-zinc-800/50">
                <td className="px-4 py-3 font-mono">en</td>
                <td className="px-4 py-3">English</td>
                <td className="px-4 py-3">LTR</td>
              </tr>
              <tr className="border-b border-zinc-800/50 bg-amber-500/5">
                <td className="px-4 py-3 font-mono">ar</td>
                <td className="px-4 py-3">Arabic</td>
                <td className="px-4 py-3 text-amber-400">RTL</td>
              </tr>
              <tr className="border-b border-zinc-800/50 bg-amber-500/5">
                <td className="px-4 py-3 font-mono">he</td>
                <td className="px-4 py-3">Hebrew</td>
                <td className="px-4 py-3 text-amber-400">RTL</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="px-4 py-3 font-mono">ru</td>
                <td className="px-4 py-3">Russian</td>
                <td className="px-4 py-3">LTR</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="px-4 py-3 font-mono">ja</td>
                <td className="px-4 py-3">Japanese</td>
                <td className="px-4 py-3">LTR</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="px-4 py-3 font-mono">ko</td>
                <td className="px-4 py-3">Korean</td>
                <td className="px-4 py-3">LTR</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="px-4 py-3 font-mono">zh</td>
                <td className="px-4 py-3">Chinese</td>
                <td className="px-4 py-3">LTR</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="px-4 py-3 font-mono">hi</td>
                <td className="px-4 py-3">Hindi</td>
                <td className="px-4 py-3">LTR</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="px-4 py-3 font-mono">el</td>
                <td className="px-4 py-3">Greek</td>
                <td className="px-4 py-3">LTR</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="px-4 py-3 font-mono">th</td>
                <td className="px-4 py-3">Thai</td>
                <td className="px-4 py-3">LTR</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="px-4 py-3 font-mono">fr</td>
                <td className="px-4 py-3">French</td>
                <td className="px-4 py-3">LTR</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono">de</td>
                <td className="px-4 py-3">German</td>
                <td className="px-4 py-3">LTR</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="text-sm text-zinc-500 mt-3">
          Use <code className="bg-zinc-800 px-1 rounded">isRTL(lang)</code> to check if a language is right-to-left.
        </p>
      </section>

      {/* Analytics */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Analytics & Monitoring</h2>
        <p className="text-zinc-400 mb-4">
          Track translation usage, cache performance, and errors with the analytics callback.
        </p>
        <CodeBlock
          language="typescript"
          code={`const translate = createTranslate({
  model: openai('gpt-4o-mini'),
  adapter: createMemoryAdapter(),

  onAnalytics: (event) => {
    // event.type: 'translation' | 'cache_hit' | 'detection' | 'error'
    console.log(\`[\${event.type}]\`, {
      text: event.text,
      translatedText: event.translatedText,
      from: event.from,
      to: event.to,
      cached: event.cached,
      duration: event.duration, // milliseconds
      provider: event.provider,
      model: event.model,
      error: event.error, // only on 'error' type
    })
  },

  onCacheError: (error, operation) => {
    // Called when cache read/write fails
    console.error(\`Cache \${operation} error:\`, error.message)
  },

  verbose: true, // Enable debug logging
})`}
        />

        <div className="mt-6 grid grid-cols-2 gap-4">
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <h4 className="font-semibold text-emerald-400 mb-2">translation</h4>
            <p className="text-sm text-zinc-400">Emitted when AI translates text (cache miss)</p>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <h4 className="font-semibold text-blue-400 mb-2">cache_hit</h4>
            <p className="text-sm text-zinc-400">Emitted when translation is served from cache</p>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <h4 className="font-semibold text-purple-400 mb-2">detection</h4>
            <p className="text-sm text-zinc-400">Emitted when language is detected</p>
          </div>
          <div className="bg-zinc-900/50 rounded-lg p-4 border border-zinc-800">
            <h4 className="font-semibold text-red-400 mb-2">error</h4>
            <p className="text-sm text-zinc-400">Emitted when translation fails</p>
          </div>
        </div>
      </section>

      {/* Environment Variables */}
      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Environment Variables</h2>
        <CodeBlock
          language="bash"
          code={`# Choose your provider(s)
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...
GOOGLE_GENERATIVE_AI_API_KEY=...
MISTRAL_API_KEY=...
GROQ_API_KEY=gsk_...

# Database (for persistent caching)
DATABASE_URL=postgresql://...`}
        />
      </section>
    </div>
  )
}
