import { useState } from 'react'

export function PlaygroundPage() {
  const [text, setText] = useState('شقة فاخرة في تل أبيب')
  const [targetLang, setTargetLang] = useState<'en' | 'ar' | 'he' | 'ru'>('en')
  const [result, setResult] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)

  const handleTranslate = async () => {
    setLoading(true)
    await new Promise(resolve => setTimeout(resolve, 1000))
    setResult(`[Translation to ${targetLang}]: ${text}`)
    setLoading(false)
  }

  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">Playground</h1>

      <p className="text-zinc-400 mb-8">
        Try out the translation API in real-time. Enter text and select a target language.
      </p>

      <div className="space-y-6">
        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Text to translate
          </label>
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            className="w-full h-32 px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 placeholder-zinc-500 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
            placeholder="Enter text to translate..."
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-zinc-300 mb-2">
            Target language
          </label>
          <select
            value={targetLang}
            onChange={(e) => setTargetLang(e.target.value as typeof targetLang)}
            className="w-full px-4 py-3 bg-zinc-900 border border-zinc-800 rounded-lg text-zinc-100 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
          >
            <option value="en">English</option>
            <option value="ar">Arabic</option>
            <option value="he">Hebrew</option>
            <option value="ru">Russian</option>
          </select>
        </div>

        <button
          onClick={handleTranslate}
          disabled={loading || !text.trim()}
          className="w-full px-4 py-3 bg-emerald-500 text-white font-medium rounded-lg hover:bg-emerald-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {loading ? 'Translating...' : 'Translate'}
        </button>

        {result && (
          <div className="p-4 bg-zinc-900 border border-zinc-800 rounded-lg">
            <label className="block text-sm font-medium text-zinc-400 mb-2">
              Result
            </label>
            <p className="text-zinc-100">{result}</p>
          </div>
        )}

        <div className="p-4 bg-zinc-900/50 border border-zinc-800/50 rounded-lg">
          <p className="text-sm text-zinc-500">
            Note: This playground is a demo. To test real translations, you'll need to
            set up the package with your OpenAI API key.
          </p>
        </div>
      </div>
    </div>
  )
}
