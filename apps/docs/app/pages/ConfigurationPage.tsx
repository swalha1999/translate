import { CodeBlock } from '../components/CodeBlock'

export function ConfigurationPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">Configuration</h1>

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

  // Required: AI provider to use
  provider: 'openai'

  // Required: API key for the provider
  apiKey: string

  // Optional: Model to use (default: 'gpt-4o-mini')
  model?: string

  // Required: Supported languages
  languages: readonly SupportedLanguage[]
}`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Supported Languages</h2>
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
              <tr className="border-b border-zinc-800/50">
                <td className="px-4 py-3 font-mono">ar</td>
                <td className="px-4 py-3">Arabic</td>
                <td className="px-4 py-3">RTL</td>
              </tr>
              <tr className="border-b border-zinc-800/50">
                <td className="px-4 py-3 font-mono">he</td>
                <td className="px-4 py-3">Hebrew</td>
                <td className="px-4 py-3">RTL</td>
              </tr>
              <tr>
                <td className="px-4 py-3 font-mono">ru</td>
                <td className="px-4 py-3">Russian</td>
                <td className="px-4 py-3">LTR</td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Environment Variables</h2>
        <CodeBlock
          language="bash"
          code={`# Required
OPENAI_API_KEY=sk-...

# Optional: Custom model
OPENAI_MODEL=gpt-4o-mini`}
        />
      </section>
    </div>
  )
}
