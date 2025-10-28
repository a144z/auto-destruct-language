#!/usr/bin/env node
import { Command } from "commander"
import { readFileSync } from "node:fs"
import { Parser } from "./core/parser.js"
import { Interpreter } from "./runtime/interpreter.js"

const program = new Command()
program
  .name("casc")
  .description("CascadeLang CLI")
  .argument("<file>", "Source file (.casc)")
  .action((file: string) => {
    const src = readFileSync(file, "utf-8")
    const parser = new Parser(src)
    const ast = parser.parseProgram()
    const interp = new Interpreter()
    interp.run(ast)
  })

program.parse()

