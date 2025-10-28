export interface Program {
  statements: Statement[]
}

export type Statement =
  | LetStmt
  | AssignStmt
  | StructStmt
  | PrintStmt
  | BlockStmt
  | IfStmt
  | WhileStmt
  | FnDeclStmt
  | ReturnStmt
  | ExprStmt

export interface LetStmt {
  kind: "LetStmt"
  name: string
  value?: Expression
}

export interface AssignStmt {
  kind: "AssignStmt"
  target: LValue
  value?: Expression // undefined means assign null (deletion)
}

export interface StructStmt {
  kind: "StructStmt"
  name: string
  fields: StructField[]
}

export interface StructField {
  name: string
  optional: boolean // false => mandatory
}

export interface PrintStmt {
  kind: "PrintStmt"
  expr: Expression
}

export interface BlockStmt {
  kind: "BlockStmt"
  statements: Statement[]
}

export interface IfStmt {
  kind: "IfStmt"
  condition: Expression
  thenBranch: Statement
  elseBranch?: Statement
}

export interface WhileStmt {
  kind: "WhileStmt"
  condition: Expression
  body: Statement
}

export interface FnDeclStmt {
  kind: "FnDeclStmt"
  name: string
  params: string[]
  body: BlockStmt
}

export interface ReturnStmt {
  kind: "ReturnStmt"
  value?: Expression
}

export interface ExprStmt {
  kind: "ExprStmt"
  expr: Expression
}

export type Expression =
  | NumberLit
  | StringLit
  | BoolLit
  | NullLit
  | ObjectLit
  | IdentExpr
  | AccessExpr
  | ArrayLit
  | IndexExpr
  | CallExpr
  | UnaryExpr
  | BinaryExpr

export interface NumberLit { kind: "NumberLit"; value: number }
export interface StringLit { kind: "StringLit"; value: string }
export interface BoolLit { kind: "BoolLit"; value: boolean }
export interface NullLit { kind: "NullLit" }
export interface IdentExpr { kind: "IdentExpr"; name: string }

export interface AccessExpr { kind: "AccessExpr"; base: Expression; prop: string }

export interface ObjectLit { kind: "ObjectLit"; typeName?: string; props: { key: string; value?: Expression }[] }

export interface ArrayLit { kind: "ArrayLit"; elements: (Expression | undefined)[] }

export interface IndexExpr { kind: "IndexExpr"; base: Expression; index: Expression }

export interface CallExpr { kind: "CallExpr"; callee: Expression; args: Expression[] }

export interface UnaryExpr { kind: "UnaryExpr"; op: "!" | "-"; expr: Expression }

export interface BinaryExpr { kind: "BinaryExpr"; left: Expression; op: string; right: Expression }

export type LValue = AccessExpr | IndexExpr | IdentTarget

export interface IdentTarget { kind: "IdentTarget"; name: string }

