import { CodeBlock } from '../components/CodeBlock'

export function ExamplesPage() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-4xl font-bold mb-8">Examples</h1>

      <section className="mb-12">
        <h2 className="text-2xl font-semibold mb-4 text-zinc-200">API Route Handler</h2>
        <p className="text-zinc-400 mb-4">
          Translate content in your API based on the requested locale.
        </p>
        <CodeBlock
          language="typescript"
          code={`import { translate } from '../lib/translate'

const getProperty = async ({ id, locale }) => {
  const property = await db.query.property.findFirst({
    where: eq(property.id, id)
  })

  if (locale !== 'en') {
    const [title, description] = await translate.batch({
      texts: [property.title, property.description],
      to: locale,
      context: 'real estate listing',
    })

    return {
      ...property,
      title: title.text,
      description: description.text,
    }
  }

  return property
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
          code={`try {
  const result = await translate.text({
    text: content.title,
    to: locale
  })
  return { ...content, title: result.text }
} catch (error) {
  console.error('Translation failed:', error)
  // Fallback to original content
  return content
}`}
        />
      </section>
    </div>
  )
}
