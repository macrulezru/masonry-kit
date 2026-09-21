const generatedIds = new WeakMap<object, string>()
let counter = 0

export function getItemId(item: { id?: string }): string {
  if (item.id !== undefined) return item.id
  let id = generatedIds.get(item)
  if (id === undefined) {
    id = `mk-auto-${++counter}`
    generatedIds.set(item, id)
  }
  return id
}
