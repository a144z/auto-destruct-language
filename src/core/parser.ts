import { Token, TokenKind } from "./tokens.js"
import { Lexer } from "./lexer.js"
import {
  AccessExpr,
  AssignStmt,
  BoolLit,
  Expression,
  IdentExpr,
  LetStmt,
  NullLit,
  NumberLit,
  ObjectLit,
  PrintStmt,
  Program,
  StringLit,
  StructField,
  StructStmt,
  ExprStmt,
} from "./ast.js"

export class Parser {
  private lexer: Lexer
  private current: Token

  constructor(src: string) {
    this.lexer = new Lexer(src)
    this.current = this.lexer.next()
  }

  private advance() { this.current = this.lexer.next() }
  private is(kind: TokenKind) { return this.current.kind === kind }
  private match(kind: TokenKind) {
    if (this.current.kind !== kind) throw new Error(`Expected ${kind} but got ${this.current.kind}`)
    const t = this.current; this.advance(); return t
  }

  parseProgram(): Program {
    const statements = [] as Program["statements"]
    while (this.current.kind !== TokenKind.EOF) statements.push(this.parseStatement())
    return { statements }
  }

  private parseStatement(): any {
    switch (this.current.kind) {
      case TokenKind.LET: return this.parseLet()
      case TokenKind.STRUCT: return this.parseStruct()
      case TokenKind.PRINT: return this.parsePrint()
      case TokenKind.LBRACE: return this.parseBlock()
      case TokenKind.IF: return this.parseIf()
      case TokenKind.WHILE: return this.parseWhile()
      case TokenKind.FN: return this.parseFnDecl()
      case TokenKind.RETURN: return this.parseReturn()
      default: return this.parseAssign()
    }
  }

  private parseLet(): LetStmt {
    this.match(TokenKind.LET)
    const name = this.match(TokenKind.IDENT).lexeme
    let value: Expression | undefined
    if (this.current.kind === TokenKind.EQUAL) { this.advance(); value = this.parseExpression() }
    if (this.is(TokenKind.SEMICOLON)) this.advance()
    return { kind: "LetStmt", name, value }
  }

  private parseStruct(): StructStmt {
    this.match(TokenKind.STRUCT)
    const name = this.match(TokenKind.IDENT).lexeme
    this.match(TokenKind.LBRACE)
    const fields: StructField[] = []
    while (this.current.kind !== TokenKind.RBRACE) {
      let optional = false
      if (this.current.kind === TokenKind.OPTIONAL) { optional = true; this.advance() }
      else if (this.current.kind === TokenKind.MANDATORY) { optional = false; this.advance() }
      const fieldName = this.match(TokenKind.IDENT).lexeme
      if (this.current.kind === TokenKind.COMMA) this.advance()
      fields.push({ name: fieldName, optional })
    }
    this.match(TokenKind.RBRACE)
    if (this.is(TokenKind.SEMICOLON)) this.advance()
    return { kind: "StructStmt", name, fields }
  }

  private parsePrint(): PrintStmt {
    this.match(TokenKind.PRINT)
    this.match(TokenKind.LPAREN)
    const expr = this.parseExpression()
    this.match(TokenKind.RPAREN)
    if (this.is(TokenKind.SEMICOLON)) this.advance()
    return { kind: "PrintStmt", expr }
  }

  private parseAssign(): AssignStmt | ExprStmt {
    const expr = this.parseAssignmentExpr()
    if (this.is(TokenKind.SEMICOLON)) this.advance()
    if ((expr as any).__assign) return (expr as any).__assign
    return { kind: "ExprStmt", expr }
  }

  private parseExpression(): Expression {
    return this.parseLogicalOr()
  }

  private parseLogicalOr(): Expression {
    let expr = this.parseLogicalAnd()
    while (this.current.kind === TokenKind.OROR) { const op = this.current.lexeme; this.advance(); const right = this.parseLogicalAnd(); expr = { kind: "BinaryExpr", left: expr, op, right } }
    return expr
  }

  private parseLogicalAnd(): Expression {
    let expr = this.parseEquality()
    while (this.current.kind === TokenKind.ANDAND) { const op = this.current.lexeme; this.advance(); const right = this.parseEquality(); expr = { kind: "BinaryExpr", left: expr, op, right } }
    return expr
  }

  private parseEquality(): Expression {
    let expr = this.parseComparison()
    while (this.current.kind === TokenKind.EQEQ || this.current.kind === TokenKind.BANGEQ) { const op = this.current.lexeme; this.advance(); const right = this.parseComparison(); expr = { kind: "BinaryExpr", left: expr, op, right } }
    return expr
  }

  private parseComparison(): Expression {
    let expr = this.parseTerm()
    while ([TokenKind.LT, TokenKind.GT, TokenKind.LTEQ, TokenKind.GTEQ].includes(this.current.kind)) { const op = this.current.lexeme; this.advance(); const right = this.parseTerm(); expr = { kind: "BinaryExpr", left: expr, op, right } }
    return expr
  }

  private parseTerm(): Expression {
    let expr = this.parseFactor()
    while (this.current.kind === TokenKind.PLUS || this.current.kind === TokenKind.MINUS) { const op = this.current.lexeme; this.advance(); const right = this.parseFactor(); expr = { kind: "BinaryExpr", left: expr, op, right } }
    return expr
  }

  private parseFactor(): Expression {
    let expr = this.parseUnary()
    while (this.current.kind === TokenKind.STAR || this.current.kind === TokenKind.SLASH) { const op = this.current.lexeme; this.advance(); const right = this.parseUnary(); expr = { kind: "BinaryExpr", left: expr, op, right } }
    return expr
  }

  private parseUnary(): Expression {
    if (this.current.kind === TokenKind.BANG || this.current.kind === TokenKind.MINUS) { const op = this.current.lexeme; this.advance(); const expr = this.parseUnary(); return { kind: "UnaryExpr", op: op as any, expr } }
    return this.parseCallIndexAccess()
  }

  private parseCallIndexAccess(): Expression {
    let expr: Expression
    if (this.current.kind === TokenKind.NEW) expr = this.parseTypedObject()
    else if (this.current.kind === TokenKind.LBRACE) expr = this.parseObject(undefined)
    else if (this.current.kind === TokenKind.LBRACKET) expr = this.parseArray()
    else expr = this.parsePrimary()
    while (true) {
      if (this.current.kind === TokenKind.DOT) {
        this.advance(); const prop = this.match(TokenKind.IDENT).lexeme; expr = { kind: "AccessExpr", base: expr, prop }; continue
      }
      if (this.current.kind === TokenKind.LBRACKET) {
        this.advance(); const idx = this.parseExpression(); this.match(TokenKind.RBRACKET); expr = { kind: "IndexExpr", base: expr, index: idx }; continue
      }
      if (this.current.kind === TokenKind.LPAREN) {
        this.advance(); const args: Expression[] = []
        if (!this.is(TokenKind.RPAREN)) { args.push(this.parseExpression()); while (this.is(TokenKind.COMMA)) { this.advance(); args.push(this.parseExpression()) } }
        this.match(TokenKind.RPAREN); expr = { kind: "CallExpr", callee: expr, args }; continue
      }
      break
    }
    return expr
  }

  private parseAssignmentExpr(): any {
    const start = this.parseCallIndexAccess()
    if (this.current.kind === TokenKind.EQUAL) {
      this.advance()
      const value = this.parseExpression()
      const target = this.toLValue(start)
      return { __assign: { kind: "AssignStmt", target, value } }
    }
    return start
  }

  private toLValue(expr: Expression): any {
    if (expr.kind === "IdentExpr") return { kind: "IdentTarget", name: (expr as any).name }
    if (expr.kind === "AccessExpr") return expr
    if (expr.kind === "IndexExpr") return expr
    throw new Error("Invalid assignment target")
  }

  private parseAccessOrPrimary(): Expression {
    let expr = this.parsePrimary()
    while (this.current.kind === TokenKind.DOT) {
      this.advance()
      const prop = this.match(TokenKind.IDENT).lexeme
      expr = { kind: "AccessExpr", base: expr, prop }
    }
    return expr
  }

  private parseAccess(): AccessExpr { throw new Error("deprecated") }

  private parseObject(typeName: string | undefined): ObjectLit {
    this.match(TokenKind.LBRACE)
    const props: ObjectLit["props"] = []
    while (this.current.kind !== TokenKind.RBRACE) {
      const key = this.match(TokenKind.IDENT).lexeme
      let value: Expression | undefined
      if (this.current.kind === TokenKind.COLON) { this.advance(); value = this.parseExpression() }
      if (this.current.kind === TokenKind.COMMA) this.advance()
      props.push({ key, value })
    }
    this.match(TokenKind.RBRACE)
    return { kind: "ObjectLit", typeName, props }
  }

  private parseTypedObject(): ObjectLit {
    this.match(TokenKind.NEW)
    const typeName = this.match(TokenKind.IDENT).lexeme
    return this.parseObject(typeName)
  }

  private parseBlock(): any {
    this.match(TokenKind.LBRACE)
    const statements: any[] = []
    while (this.current.kind !== TokenKind.RBRACE) statements.push(this.parseStatement())
    this.match(TokenKind.RBRACE)
    return { kind: "BlockStmt", statements }
  }

  private parseIf(): any {
    this.match(TokenKind.IF)
    this.match(TokenKind.LPAREN)
    const condition = this.parseExpression()
    this.match(TokenKind.RPAREN)
    const thenBranch = this.parseStatement()
    let elseBranch
    if (this.current.kind === TokenKind.ELSE) { this.advance(); elseBranch = this.parseStatement() }
    return { kind: "IfStmt", condition, thenBranch, elseBranch }
  }

  private parseWhile(): any {
    this.match(TokenKind.WHILE)
    this.match(TokenKind.LPAREN)
    const condition = this.parseExpression()
    this.match(TokenKind.RPAREN)
    const body = this.parseStatement()
    return { kind: "WhileStmt", condition, body }
  }

  private parseFnDecl(): any {
    this.match(TokenKind.FN)
    const name = this.match(TokenKind.IDENT).lexeme
    this.match(TokenKind.LPAREN)
    const params: string[] = []
    if (this.current.kind !== TokenKind.RPAREN) { params.push(this.match(TokenKind.IDENT).lexeme); while (this.current.kind === TokenKind.COMMA) { this.advance(); params.push(this.match(TokenKind.IDENT).lexeme) } }
    this.match(TokenKind.RPAREN)
    const body = this.parseBlock()
    return { kind: "FnDeclStmt", name, params, body }
  }

  private parseReturn(): any {
    this.match(TokenKind.RETURN)
    let value: Expression | undefined
    if (!this.is(TokenKind.SEMICOLON) && !this.is(TokenKind.RBRACE)) value = this.parseExpression()
    if (this.is(TokenKind.SEMICOLON)) this.advance()
    return { kind: "ReturnStmt", value }
  }

  private parsePrimary(): Expression {
    switch (this.current.kind) {
      case TokenKind.NUMBER: { const t = this.current; this.advance(); return { kind: "NumberLit", value: Number(t.lexeme) } }
      case TokenKind.STRING: { const t = this.current; this.advance(); return { kind: "StringLit", value: t.lexeme } }
      case TokenKind.TRUE: { this.advance(); return { kind: "BoolLit", value: true } }
      case TokenKind.FALSE: { this.advance(); return { kind: "BoolLit", value: false } }
      case TokenKind.NULL: { this.advance(); return { kind: "NullLit" } }
      case TokenKind.IDENT: { const name = this.current.lexeme; this.advance(); return { kind: "IdentExpr", name } }
      case TokenKind.LPAREN: {
        this.advance()
        const e = this.parseExpression()
        this.match(TokenKind.RPAREN)
        return e
      }
      case TokenKind.LBRACKET: return this.parseArray()
      default:
        throw new Error(`Unexpected token ${this.current.kind}`)
    }
  }

  private parseArray(): any {
    this.match(TokenKind.LBRACKET)
    const elements: Expression[] = []
    if (!this.is(TokenKind.RBRACKET)) { elements.push(this.parseExpression()); while (this.is(TokenKind.COMMA)) { this.advance(); elements.push(this.parseExpression()) } }
    this.match(TokenKind.RBRACKET)
    return { kind: "ArrayLit", elements }
  }
}

