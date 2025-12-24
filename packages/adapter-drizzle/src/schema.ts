import { pgTable, text, timestamp, boolean, index } from 'drizzle-orm/pg-core'

export const translationCache = pgTable('translation_cache', {
  id: text('id').primaryKey(),

  sourceText: text('source_text').notNull(),
  sourceLanguage: text('source_language').notNull(),

  targetLanguage: text('target_language').notNull(),
  translatedText: text('translated_text').notNull(),

  resourceType: text('resource_type'),
  resourceId: text('resource_id'),
  field: text('field'),

  isManualOverride: boolean('is_manual_override').notNull().default(false),

  provider: text('provider').notNull(),
  model: text('model'),

  createdAt: timestamp('created_at').notNull().defaultNow(),
  updatedAt: timestamp('updated_at').notNull().defaultNow(),
  lastUsedAt: timestamp('last_used_at').notNull().defaultNow(),
}, (table) => ({
  targetLangIdx: index('tc_target_lang_idx').on(table.targetLanguage),
  resourceIdx: index('tc_resource_idx').on(table.resourceType, table.resourceId, table.field),
  manualIdx: index('tc_manual_idx').on(table.isManualOverride),
}))
