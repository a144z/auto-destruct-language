import { describe, it, expect } from "vitest"
import { Parser } from "../src/core/parser.js"
import { Interpreter } from "../src/runtime/interpreter.js"

function run(src: string) {
  const parser = new Parser(src)
  const ast = parser.parseProgram()
  const interp = new Interpreter()
  interp.run(ast)
}

describe("cascade semantics", () => {
  it("deletes object when mandatory field set to null", () => {
    const src = `
struct N { mandatory id, optional next, }
let a = new N { id: 1 }
let b = new N { id: 2 }
a.next = b
b.id = null
`
    run(src)
  })
})

