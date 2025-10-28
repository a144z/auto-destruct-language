export enum TokenKind {
  EOF = "EOF",
  IDENT = "IDENT",
  NUMBER = "NUMBER",
  STRING = "STRING",
  TRUE = "TRUE",
  FALSE = "FALSE",
  NULL = "NULL",
  LET = "LET",
  STRUCT = "STRUCT",
  PRINT = "PRINT",
  NEW = "NEW",
  FN = "FN",
  RETURN = "RETURN",
  IF = "IF",
  ELSE = "ELSE",
  WHILE = "WHILE",
  OPTIONAL = "OPTIONAL", // keyword 'optional'
  MANDATORY = "MANDATORY", // keyword 'mandatory'
  // symbols
  LBRACE = "LBRACE",
  RBRACE = "RBRACE",
  LPAREN = "LPAREN",
  RPAREN = "RPAREN",
  LBRACKET = "LBRACKET",
  RBRACKET = "RBRACKET",
  COLON = "COLON",
  SEMICOLON = "SEMICOLON",
  COMMA = "COMMA",
  DOT = "DOT",
  EQUAL = "EQUAL",
  PLUS = "PLUS",
  MINUS = "MINUS",
  STAR = "STAR",
  SLASH = "SLASH",
  BANG = "BANG",
  LT = "LT",
  GT = "GT",
  EQEQ = "EQEQ",
  BANGEQ = "BANGEQ",
  LTEQ = "LTEQ",
  GTEQ = "GTEQ",
  ANDAND = "ANDAND",
  OROR = "OROR",
}

export interface Token {
  kind: TokenKind
  lexeme: string
  line: number
  column: number
}

export const Keywords: Record<string, TokenKind | undefined> = {
  let: TokenKind.LET,
  struct: TokenKind.STRUCT,
  print: TokenKind.PRINT,
  fn: TokenKind.FN,
  return: TokenKind.RETURN,
  if: TokenKind.IF,
  else: TokenKind.ELSE,
  while: TokenKind.WHILE,
  true: TokenKind.TRUE,
  false: TokenKind.FALSE,
  null: TokenKind.NULL,
  new: TokenKind.NEW,
  optional: TokenKind.OPTIONAL,
  mandatory: TokenKind.MANDATORY,
}

