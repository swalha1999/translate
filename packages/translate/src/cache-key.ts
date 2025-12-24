export function hashText(text: string): string {
  let hash = 0
  for (let i = 0; i < text.length; i++) {
    const char = text.charCodeAt(i)
    hash = ((hash << 5) - hash) + char
    hash = hash & hash
  }
  return Math.abs(hash).toString(36)
}

export function createHashKey(text: string, targetLanguage: string): string {
  return `hash:${hashText(text)}:${targetLanguage}`
}

export function createResourceKey(
  resourceType: string,
  resourceId: string,
  field: string,
  targetLanguage: string
): string {
  return `res:${resourceType}:${resourceId}:${field}:${targetLanguage}`
}

export function hasResourceInfo(params: { resourceType?: string; resourceId?: string; field?: string }): boolean {
  return !!(params.resourceType && params.resourceId && params.field)
}
