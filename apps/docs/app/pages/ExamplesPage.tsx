import { CodeBlock } from '../components/CodeBlock'

export function ExamplesPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">Examples</h1>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">API Route Handler</h2>
        <p className="text-zinc-400 mb-4">
          Translate content in your API based on the requested locale. Using <code className="text-emerald-400">translate.object()</code> for clean one-liner translation.
        </p>
        <CodeBlock
          language="typescript"
          code={`import { translate } from '../lib/translate'

const getProperty = async ({ id, locale }) => {
  const property = await db.query.property.findFirst({
    where: eq(property.id, id)
  })

  if (locale === 'en') return property

  // One-liner! Type-safe field translation
  return translate.object(property, {
    fields: ['title', 'description'],
    to: locale,
    context: 'real estate listing',
  })
}`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Translating Lists</h2>
        <p className="text-zinc-400 mb-4">
          Translate multiple objects efficiently with <code className="text-emerald-400">translate.objects()</code>.
        </p>
        <CodeBlock
          language="typescript"
          code={`import { translate } from '../lib/translate'

const getTodos = async ({ userId, locale }) => {
  const todos = await db.query.todo.findMany({
    where: eq(todo.userId, userId)
  })

  if (locale === 'en') return todos

  // Translates all todos in one batched call
  return translate.objects(todos, {
    fields: ['title', 'description'],
    to: locale,
    context: 'task management application',
  })
}

// Before translate.objects(), you had to do this:
const translateTodosManually = async (todos, locale) => {
  return Promise.all(
    todos.map(async (todo) => {
      const texts = []
      if (todo.title) texts.push(todo.title)
      if (todo.description) texts.push(todo.description)

      if (texts.length === 0) return todo

      const results = await translate.batch({ texts, to: locale })
      let idx = 0
      return {
        ...todo,
        title: todo.title ? results[idx++]?.text : todo.title,
        description: todo.description ? results[idx]?.text : todo.description,
      }
    })
  )
}`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Context-Specific Translation</h2>
        <p className="text-zinc-400 mb-4">
          Use context hints and resource-specific caching for ambiguous terms.
        </p>
        <CodeBlock
          language="typescript"
          code={`// "flat" in real estate context
const realEstateFlat = await translate.text({
  text: "flat",
  to: 'he',
  resourceType: 'property',
  resourceId: property.id,
  field: 'propertyType',
  context: 'real estate property type',
})
// → { text: "דירה" }

// "flat" in finance context
const financeFlat = await translate.text({
  text: "flat",
  to: 'he',
  resourceType: 'deal',
  resourceId: deal.id,
  field: 'feeType',
  context: 'financial terms',
})
// → { text: "קבוע" }`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Manual Override Flow</h2>
        <p className="text-zinc-400 mb-4">
          Allow users to correct AI translations.
        </p>
        <CodeBlock
          language="typescript"
          code={`// User submits a correction
await translate.setManual({
  text: 'flat',
  translatedText: 'דירה',
  to: 'he',
  resourceType: 'property',
  resourceId: '123',
  field: 'propertyType',
})

// Future requests for this resource use the manual translation
const result = await translate.text({
  text: 'flat',
  to: 'he',
  resourceType: 'property',
  resourceId: '123',
  field: 'propertyType',
})
// → { text: "דירה", isManualOverride: true }

// Admin clears the override
await translate.clearManual({
  resourceType: 'property',
  resourceId: '123',
  field: 'propertyType',
  to: 'he',
})`}
        />
      </section>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">Error Handling</h2>
        <p className="text-zinc-400 mb-4">
          Handle translation failures gracefully.
        </p>
        <CodeBlock
          language="typescript"
          code={`// translate.text() and translate.batch() throw on error
try {
  const result = await translate.text({
    text: content.title,
    to: locale
  })
  return { ...content, title: result.text }
} catch (error) {
  console.error('Translation failed:', error)
  // Fallback to original content
  return content
}

// translate.object() and translate.objects() handle errors silently
// They log to console.error and return the original object/array
const translated = await translate.object(content, {
  fields: ['title', 'description'],
  to: locale
})
// On error: logs error, returns original content unchanged`}
        />
      </section>
    </div>
  )
}
