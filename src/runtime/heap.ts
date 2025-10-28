export type ObjectId = number

export interface FieldSpec {
  name: string
  optional: boolean
}

export interface TypeSpec {
  name: string
  fields: FieldSpec[]
}

export interface HeapObject {
  id: ObjectId
  typeName?: string
  // field -> ObjectId | primitive | null
  fields: Map<string, any>
}

export class Heap {
  private nextId = 1
  private objects = new Map<ObjectId, HeapObject>()
  private types = new Map<string, TypeSpec>()
  // reverse reference graph: childId -> set of { parentId, fieldName }
  private incoming = new Map<ObjectId, Set<string>>()
  // arrays are also heap objects; we store array content under special field name indices

  defineType(spec: TypeSpec) {
    this.types.set(spec.name, spec)
  }

  createObject(typeName?: string, initial?: Record<string, any>): ObjectId {
    const id = this.nextId++
    const fields = new Map<string, any>()
    if (initial) for (const [k, v] of Object.entries(initial)) fields.set(k, v)
    const obj: HeapObject = { id, typeName, fields }
    this.objects.set(id, obj)
    // register incoming for object fields that are object ids
    for (const [key, val] of obj.fields) this.trackIncomingIfObject(val, `${id}.${key}`)
    return id
  }

  createArray(elements: any[]): ObjectId {
    const id = this.createObject("__array__")
    const obj = this.objects.get(id)!
    for (let i = 0; i < elements.length; i++) {
      const key = String(i)
      obj.fields.set(key, elements[i])
      this.trackIncomingIfObject(elements[i], `${id}.${key}`)
    }
    obj.fields.set("length", elements.length)
    return id
  }

  private trackIncomingIfObject(value: any, parentKey: string) {
    if (typeof value === "number" && this.objects.has(value)) {
      const set = this.incoming.get(value) ?? new Set<string>()
      set.add(parentKey)
      this.incoming.set(value, set)
    }
  }

  private untrackIncomingIfObject(value: any, parentKey: string) {
    if (typeof value === "number" && this.objects.has(value)) {
      const set = this.incoming.get(value)
      if (set) {
        set.delete(parentKey)
        if (set.size === 0) this.incoming.delete(value)
      }
    }
  }

  getObject(id: ObjectId) { return this.objects.get(id) }

  getField(id: ObjectId, name: string) { return this.objects.get(id)?.fields.get(name) }

  setField(parentId: ObjectId, name: string, value: any, isMandatory: boolean) {
    const parent = this.objects.get(parentId)
    if (!parent) return
    const key = `${parentId}.${name}`
    const prev = parent.fields.get(name)
    if (prev !== undefined) this.untrackIncomingIfObject(prev, key)

    if (value === null && isMandatory) {
      // cascade delete parent
      this.deleteObjectCascade(parentId)
      return
    }

    parent.fields.set(name, value)
    this.trackIncomingIfObject(value, key)
  }

  arrayPush(id: ObjectId, value: any) {
    const obj = this.objects.get(id)
    if (!obj || obj.typeName !== "__array__") return
    const len = Number(obj.fields.get("length") ?? 0)
    const key = String(len)
    obj.fields.set(key, value)
    obj.fields.set("length", len + 1)
    this.trackIncomingIfObject(value, `${id}.${key}`)
  }

  deleteObjectCascade(id: ObjectId) {
    const toDelete: ObjectId[] = [id]
    const visited = new Set<ObjectId>()
    while (toDelete.length) {
      const cur = toDelete.pop()!
      if (visited.has(cur)) continue
      visited.add(cur)
      const obj = this.objects.get(cur)
      if (!obj) continue
      // enqueue parents that mandatorily rely on this field
      const incoming = this.incoming.get(cur)
      if (incoming) {
        for (const parentKey of incoming) {
          const [pidStr, fieldName] = parentKey.split(".")
          const pid = Number(pidStr)
          const parent = this.objects.get(pid)
          if (!parent) continue
          // set field to null first (break link)
          const prev = parent.fields.get(fieldName)
          parent.fields.set(fieldName, null)
          this.untrackIncomingIfObject(prev, parentKey)
          // if the field is mandatory for parent's type, delete parent too
          const isMandatory = this.isFieldMandatory(parent.typeName, fieldName)
          if (isMandatory) toDelete.push(pid)
        }
      }
      // clear outgoing references and untrack
      for (const [k, v] of obj.fields) this.untrackIncomingIfObject(v, `${cur}.${k}`)
      this.incoming.delete(cur)
      this.objects.delete(cur)
    }
  }

  isFieldMandatory(typeName: string | undefined, fieldName: string): boolean {
    if (!typeName) return false
    const spec = this.types.get(typeName)
    if (!spec) return false
    const field = spec.fields.find(f => f.name === fieldName)
    if (!field) return false
    return !field.optional
  }
}

