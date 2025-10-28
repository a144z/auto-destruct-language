import { Program, Statement, LetStmt, AssignStmt, PrintStmt, Expression, NumberLit, StringLit, BoolLit, IdentExpr, AccessExpr, ObjectLit, StructStmt, BlockStmt, IfStmt, WhileStmt, FnDeclStmt, ReturnStmt, ExprStmt, ArrayLit, IndexExpr, CallExpr, UnaryExpr, BinaryExpr, IdentTarget, LValue } from "../core/ast.js"
import { Heap } from "./heap.js"

interface EnvEntry { kind: "value"; value: any }

class Environment {
  private values = new Map<string, EnvEntry>()
  constructor(public readonly parent?: Environment) {}
  get(name: string): EnvEntry | undefined { return this.values.get(name) ?? this.parent?.get(name) }
  setLocal(name: string, value: any) { this.values.set(name, { kind: "value", value }) }
  set(name: string, value: any): boolean {
    if (this.values.has(name)) { this.values.set(name, { kind: "value", value }); return true }
    if (this.parent) return this.parent.set(name, value)
    this.values.set(name, { kind: "value", value }); return true
  }
}

interface FunctionValue {
  kind: "function"
  name?: string
  params: string[]
  body: BlockStmt
  env: Environment
}

export class Interpreter {
  private heap = new Heap()
  private globals = new Environment()
  private env = this.globals

  run(program: Program) {
    this.installStdlib()
    for (const stmt of program.statements) this.execStatement(stmt)
  }

  private execStatement(stmt: Statement): any {
    if (stmt.kind === "StructStmt") return this.execStruct(stmt as StructStmt)
    if (stmt.kind === "LetStmt") return this.execLet(stmt as LetStmt)
    if (stmt.kind === "AssignStmt") return this.execAssign(stmt as AssignStmt)
    if (stmt.kind === "PrintStmt") return this.execPrint(stmt as PrintStmt)
    if (stmt.kind === "BlockStmt") return this.execBlock(stmt as BlockStmt)
    if (stmt.kind === "IfStmt") return this.execIf(stmt as IfStmt)
    if (stmt.kind === "WhileStmt") return this.execWhile(stmt as WhileStmt)
    if (stmt.kind === "FnDeclStmt") return this.execFnDecl(stmt as FnDeclStmt)
    if (stmt.kind === "ReturnStmt") return this.execReturn(stmt as ReturnStmt)
    if (stmt.kind === "ExprStmt") return this.evalExpr((stmt as ExprStmt).expr)
  }

  private execStruct(stmt: StructStmt) {
    this.heap.defineType({ name: stmt.name, fields: stmt.fields.map(f => ({ name: f.name, optional: f.optional })) })
  }

  private execLet(stmt: LetStmt) {
    const value = stmt.value ? this.evalExpr(stmt.value) : null
    this.env.setLocal(stmt.name, value)
  }

  private execAssign(stmt: AssignStmt) {
    const value = stmt.value ? this.evalExpr(stmt.value) : null
    this.assignTo(stmt.target, value)
  }

  private assignTo(target: LValue, value: any) {
    if ((target as IdentTarget).kind === "IdentTarget") {
      const name = (target as IdentTarget).name
      this.env.set(name, value)
      return
    }
    if ((target as AccessExpr).kind === "AccessExpr") {
      const t = target as AccessExpr
      const baseVal = this.evalExpr(t.base)
      if (typeof baseVal !== "number") throw new Error("Property access on non-object")
      const parentObj = this.heap.getObject(baseVal)
      if (!parentObj) return
      const isMandatory = this.heap.isFieldMandatory(parentObj.typeName, t.prop)
      this.heap.setField(baseVal, t.prop, value, isMandatory)
      return
    }
    if ((target as IndexExpr).kind === "IndexExpr") {
      const t = target as IndexExpr
      const baseVal = this.evalExpr(t.base)
      if (typeof baseVal !== "number") throw new Error("Indexing non-array")
      const obj = this.heap.getObject(baseVal)
      if (!obj || obj.typeName !== "__array__") throw new Error("Indexing non-array")
      const idx = this.evalExpr(t.index)
      const key = String(idx)
      obj.fields.set(key, value)
      const len = Number(obj.fields.get("length") ?? 0)
      if (Number(idx) >= len) obj.fields.set("length", Number(idx) + 1)
      return
    }
    throw new Error("Invalid assignment target")
  }

  private execPrint(stmt: PrintStmt) {
    const value = this.evalExpr(stmt.expr)
    console.log(this.formatValue(value))
  }

  private execBlock(block: BlockStmt) {
    const prev = this.env
    this.env = new Environment(prev)
    try {
      for (const s of block.statements) {
        const res = this.execStatement(s)
        if ((res as any)?.__return !== undefined) return res
      }
    } finally {
      this.env = prev
    }
  }

  private execIf(stmt: IfStmt) {
    if (this.truthy(this.evalExpr(stmt.condition))) return this.execStatement(stmt.thenBranch)
    if (stmt.elseBranch) return this.execStatement(stmt.elseBranch)
  }

  private execWhile(stmt: WhileStmt) {
    while (this.truthy(this.evalExpr(stmt.condition))) {
      const res = this.execStatement(stmt.body)
      if ((res as any)?.__return !== undefined) return res
    }
  }

  private execFnDecl(stmt: FnDeclStmt) {
    const fn: FunctionValue = { kind: "function", name: stmt.name, params: stmt.params, body: stmt.body, env: this.env }
    this.env.setLocal(stmt.name, fn)
  }

  private execReturn(stmt: ReturnStmt) {
    const value = stmt.value ? this.evalExpr(stmt.value) : null
    return { __return: value }
  }

  private formatValue(value: any): string {
    if (value === null || value === undefined) return "null"
    if (typeof value === "number") {
      const isObjectId = this.heap.getObject(value) !== undefined
      return isObjectId ? `[Object#${value}]` : String(value)
    }
    if (typeof value === "boolean") return String(value)
    if (typeof value === "string") return JSON.stringify(value)
    return String(value)
  }

  private evalExpr(expr: Expression): any {
    switch (expr.kind) {
      case "NumberLit": return (expr as NumberLit).value
      case "StringLit": return (expr as StringLit).value
      case "BoolLit": return (expr as BoolLit).value
      case "NullLit": return null
      case "IdentExpr": return this.evalIdent(expr as IdentExpr)
      case "AccessExpr": return this.evalAccess(expr as AccessExpr)
      case "ObjectLit": return this.evalObject(expr as ObjectLit)
      case "ArrayLit": return this.evalArray(expr as ArrayLit)
      case "IndexExpr": return this.evalIndex(expr as IndexExpr)
      case "CallExpr": return this.evalCall(expr as CallExpr)
      case "UnaryExpr": return this.evalUnary(expr as UnaryExpr)
      case "BinaryExpr": return this.evalBinary(expr as BinaryExpr)
    }
  }

  private evalIdent(expr: IdentExpr): any {
    const entry = this.env.get(expr.name)
    if (!entry) throw new Error(`Undefined variable ${expr.name}`)
    return entry.value
  }

  private evalAccess(expr: AccessExpr): any {
    const base = this.evalExpr(expr.base)
    if (typeof base !== "number") throw new Error("Property access on non-object")
    const value = this.heap.getField(base, expr.prop)
    return value ?? null
  }

  private evalObject(expr: ObjectLit): any {
    const id = this.heap.createObject(expr.typeName)
    for (const { key, value } of expr.props) {
      const v = value ? this.evalExpr(value) : null
      const obj = this.heap.getObject(id)
      if (!obj) continue
      const isMandatory = this.heap.isFieldMandatory(obj.typeName, key)
      this.heap.setField(id, key, v, isMandatory)
    }
    return id
  }

  private evalArray(expr: ArrayLit): any {
    const elements = expr.elements.map(e => e ? this.evalExpr(e) : null)
    return this.heap.createArray(elements)
  }

  private evalIndex(expr: IndexExpr): any {
    const base = this.evalExpr(expr.base)
    if (typeof base !== "number") throw new Error("Indexing non-array")
    const obj = this.heap.getObject(base)
    if (!obj || obj.typeName !== "__array__") throw new Error("Indexing non-array")
    const idx = this.evalExpr(expr.index)
    const value = obj.fields.get(String(idx))
    return value ?? null
  }

  private evalCall(expr: CallExpr): any {
    const callee = this.evalExpr(expr.callee)
    const args = expr.args.map(a => this.evalExpr(a))
    if (typeof callee === "function") return callee(...args)
    const fn = callee as FunctionValue
    if (!fn || fn.kind !== "function") throw new Error("Call to non-function")
    const prev = this.env
    this.env = new Environment(fn.env)
    for (let i = 0; i < fn.params.length; i++) this.env.setLocal(fn.params[i], args[i])
    try {
      const result = this.execBlock(fn.body)
      if (result && (result as any).__return !== undefined) return (result as any).__return
      return null
    } finally {
      this.env = prev
    }
  }

  private evalUnary(expr: UnaryExpr): any {
    const v = this.evalExpr(expr.expr)
    if (expr.op === "-") return -Number(v)
    if (expr.op === "!") return !this.truthy(v)
    return null
  }

  private evalBinary(expr: BinaryExpr): any {
    const l = this.evalExpr(expr.left)
    if (expr.op === "&&") return this.truthy(l) ? this.evalExpr(expr.right) : l
    if (expr.op === "||") return this.truthy(l) ? l : this.evalExpr(expr.right)
    const r = this.evalExpr(expr.right)
    switch (expr.op) {
      case "+": return Number(l) + Number(r)
      case "-": return Number(l) - Number(r)
      case "*": return Number(l) * Number(r)
      case "/": return Number(l) / Number(r)
      case "==": return this.equals(l, r)
      case "!=": return !this.equals(l, r)
      case "<": return Number(l) < Number(r)
      case ">": return Number(l) > Number(r)
      case "<=": return Number(l) <= Number(r)
      case ">=": return Number(l) >= Number(r)
      default: throw new Error(`Unknown operator ${expr.op}`)
    }
  }

  private truthy(v: any): boolean { return !(v === null || v === false) }
  private equals(a: any, b: any): boolean { return a === b }

  private installStdlib() {
    this.globals.setLocal("println", (...args: any[]) => { console.log(...args.map(v => this.formatValue(v))); return null })
    this.globals.setLocal("len", (arr: any) => {
      if (typeof arr !== "number") return 0
      const obj = this.heap.getObject(arr)
      if (!obj || obj.typeName !== "__array__") return 0
      return Number(obj.fields.get("length") ?? 0)
    })
    this.globals.setLocal("assert", (cond: any, msg?: any) => { if (!cond) throw new Error(`Assertion failed${msg ? ": " + msg : ""}`); return null })
  }
}

