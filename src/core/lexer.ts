import { Keywords, Token, TokenKind } from "./tokens.js"

function isAlpha(ch: string) {
  if (ch.length === 0) return false
  const c = ch.charCodeAt(0)
  return (c >= 65 && c <= 90) || (c >= 97 && c <= 122) || ch === "_"
}

function isDigit(ch: string) {
  if (ch.length === 0) return false
  const c = ch.charCodeAt(0)
  return c >= 48 && c <= 57
}

export class Lexer {
  private src: string
  private pos = 0
  private line = 1
  private col = 1

  constructor(src: string) {
    this.src = src
  }

  private peek(): string {
    return this.src[this.pos] ?? ""
  }

  private advance(): string {
    const ch = this.src[this.pos++] ?? ""
    if (ch === "\n") {
      this.line++
      this.col = 1
    } else this.col++
    return ch
  }

  private make(kind: TokenKind, lexeme: string): Token {
    return { kind, lexeme, line: this.line, column: this.col }
  }

  private skipWhitespaceAndComments() {
    while (true) {
      const ch = this.peek()
      if (ch === " " || ch === "\t" || ch === "\r" || ch === "\n") {
        this.advance()
        continue
      }
      if (ch === "/" && this.src[this.pos + 1] === "/") {
        while (this.peek() && this.peek() !== "\n") this.advance()
        continue
      }
      if (ch === "/" && this.src[this.pos + 1] === "*") {
        this.advance(); this.advance()
        while (this.peek() && !(this.peek() === "*" && this.src[this.pos + 1] === "/")) this.advance()
        if (this.peek()) { this.advance(); this.advance() }
        continue
      }
      break
    }
  }

  next(): Token {
    this.skipWhitespaceAndComments()
    const startCol = this.col
    const ch = this.peek()
    if (!ch) return { kind: TokenKind.EOF, lexeme: "", line: this.line, column: startCol }

    // identifiers/keywords
    if (isAlpha(ch)) {
      let text = ""
      while (isAlpha(this.peek()) || isDigit(this.peek())) text += this.advance()
      const kw = Keywords[text]
      if (kw) return { kind: kw, lexeme: text, line: this.line, column: startCol }
      return { kind: TokenKind.IDENT, lexeme: text, line: this.line, column: startCol }
    }

    // number
    if (isDigit(ch)) {
      let text = ""
      while (isDigit(this.peek())) text += this.advance()
      if (this.peek() === ".") {
        text += this.advance()
        while (isDigit(this.peek())) text += this.advance()
      }
      return { kind: TokenKind.NUMBER, lexeme: text, line: this.line, column: startCol }
    }

    // string
    if (ch === '"' || ch === "'") {
      const quote = this.advance()
      let text = ""
      while (this.peek() && this.peek() !== quote) {
        if (this.peek() === "\\") {
          this.advance()
          const esc = this.advance()
          if (esc === "n") text += "\n"
          else if (esc === "t") text += "\t"
          else text += esc
          continue
        }
        text += this.advance()
      }
      if (this.peek() !== quote) throw new Error(`Unterminated string at ${this.line}:${startCol}`)
      this.advance()
      return { kind: TokenKind.STRING, lexeme: text, line: this.line, column: startCol }
    }

    // two-char operators
    if (ch === "=" && this.src[this.pos + 1] === "=") { this.advance(); this.advance(); return { kind: TokenKind.EQEQ, lexeme: "==", line: this.line, column: startCol } }
    if (ch === "!" && this.src[this.pos + 1] === "=") { this.advance(); this.advance(); return { kind: TokenKind.BANGEQ, lexeme: "!=", line: this.line, column: startCol } }
    if (ch === "<" && this.src[this.pos + 1] === "=") { this.advance(); this.advance(); return { kind: TokenKind.LTEQ, lexeme: "<=", line: this.line, column: startCol } }
    if (ch === ">" && this.src[this.pos + 1] === "=") { this.advance(); this.advance(); return { kind: TokenKind.GTEQ, lexeme: ">=", line: this.line, column: startCol } }
    if (ch === "&" && this.src[this.pos + 1] === "&") { this.advance(); this.advance(); return { kind: TokenKind.ANDAND, lexeme: "&&", line: this.line, column: startCol } }
    if (ch === "|" && this.src[this.pos + 1] === "|") { this.advance(); this.advance(); return { kind: TokenKind.OROR, lexeme: "||", line: this.line, column: startCol } }

    // symbols
    const sym = this.advance()
    switch (sym) {
      case "{" : return { kind: TokenKind.LBRACE, lexeme: sym, line: this.line, column: startCol }
      case "}" : return { kind: TokenKind.RBRACE, lexeme: sym, line: this.line, column: startCol }
      case "(" : return { kind: TokenKind.LPAREN, lexeme: sym, line: this.line, column: startCol }
      case ")" : return { kind: TokenKind.RPAREN, lexeme: sym, line: this.line, column: startCol }
      case "[" : return { kind: TokenKind.LBRACKET, lexeme: sym, line: this.line, column: startCol }
      case "]" : return { kind: TokenKind.RBRACKET, lexeme: sym, line: this.line, column: startCol }
      case ":" : return { kind: TokenKind.COLON, lexeme: sym, line: this.line, column: startCol }
      case ";" : return { kind: TokenKind.SEMICOLON, lexeme: sym, line: this.line, column: startCol }
      case "," : return { kind: TokenKind.COMMA, lexeme: sym, line: this.line, column: startCol }
      case "." : return { kind: TokenKind.DOT, lexeme: sym, line: this.line, column: startCol }
      case "=" : return { kind: TokenKind.EQUAL, lexeme: sym, line: this.line, column: startCol }
      case "+" : return { kind: TokenKind.PLUS, lexeme: sym, line: this.line, column: startCol }
      case "-" : return { kind: TokenKind.MINUS, lexeme: sym, line: this.line, column: startCol }
      case "*" : return { kind: TokenKind.STAR, lexeme: sym, line: this.line, column: startCol }
      case "/" : return { kind: TokenKind.SLASH, lexeme: sym, line: this.line, column: startCol }
      case "!" : return { kind: TokenKind.BANG, lexeme: sym, line: this.line, column: startCol }
      case "<" : return { kind: TokenKind.LT, lexeme: sym, line: this.line, column: startCol }
      case ">" : return { kind: TokenKind.GT, lexeme: sym, line: this.line, column: startCol }
      default:
        throw new Error(`Unexpected character '${sym}' at ${this.line}:${startCol}`)
    }
  }
}

