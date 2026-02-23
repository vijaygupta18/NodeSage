export type SupportedLanguage =
  | "javascript"
  | "typescript"
  | "python"
  | "go"
  | "rust"
  | "java"
  | "c"
  | "cpp"
  | "ruby"
  | "php"
  | "csharp"
  | "swift"
  | "kotlin"
  | "scala"
  | "haskell"
  | "elixir"
  | "erlang"
  | "shell"
  | "lua"
  | "perl"
  | "r"
  | "dart"
  | "sql"
  | "groovy"
  | "clojure"
  | "fsharp"
  | "ocaml"
  | "julia"
  | "zig"
  | "nim"
  | "v"
  | "crystal"
  | "elm"
  | "purescript"
  | "terraform"
  | "dockerfile"
  | "makefile"
  | "yaml"
  | "toml"
  | "markdown"
  | "text"
  | "unknown";

export interface ChunkMetadata {
  type: "code";
  text: string;
  filePath: string;
  language: string;
  startLine: number;
  endLine: number;
  chunkKind: "function" | "class" | "block" | "imports" | "general";
}

export interface CodeChunk {
  filePath: string;
  language: SupportedLanguage;
  startLine: number;
  endLine: number;
  content: string;
  chunkKind: "function" | "class" | "block" | "imports" | "general";
}

export interface RetrievedContext {
  text: string;
  metadata: ChunkMetadata;
  score: number;
}

export interface TrainManifest {
  version: number;
  trainedAt: string;
  files: Record<string, { mtime: number; chunkCount: number }>;
}

export interface FixResult {
  filePath: string;
  original: string;
  fixed: string;
  description: string;
}
