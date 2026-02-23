import type { SupportedLanguage } from "./types.js";

const EXTENSION_MAP = new Map<string, SupportedLanguage>([
  // JavaScript / TypeScript
  [".js", "javascript"],
  [".jsx", "javascript"],
  [".mjs", "javascript"],
  [".cjs", "javascript"],
  [".ts", "typescript"],
  [".tsx", "typescript"],

  // Python
  [".py", "python"],
  [".pyw", "python"],
  [".pyi", "python"],

  // Go
  [".go", "go"],

  // Rust
  [".rs", "rust"],

  // Java / JVM
  [".java", "java"],
  [".kt", "kotlin"],
  [".kts", "kotlin"],
  [".scala", "scala"],
  [".groovy", "groovy"],
  [".gvy", "groovy"],
  [".clj", "clojure"],
  [".cljs", "clojure"],
  [".cljc", "clojure"],
  [".edn", "clojure"],

  // C / C++
  [".c", "c"],
  [".h", "c"],
  [".cpp", "cpp"],
  [".cc", "cpp"],
  [".cxx", "cpp"],
  [".hpp", "cpp"],
  [".hh", "cpp"],
  [".hxx", "cpp"],

  // .NET
  [".cs", "csharp"],
  [".fs", "fsharp"],
  [".fsx", "fsharp"],

  // Apple
  [".swift", "swift"],

  // Ruby
  [".rb", "ruby"],
  [".rake", "ruby"],
  [".gemspec", "ruby"],

  // PHP
  [".php", "php"],

  // Shell
  [".sh", "shell"],
  [".bash", "shell"],
  [".zsh", "shell"],
  [".fish", "shell"],

  // Functional
  [".hs", "haskell"],
  [".lhs", "haskell"],
  [".ex", "elixir"],
  [".exs", "elixir"],
  [".erl", "erlang"],
  [".hrl", "erlang"],
  [".elm", "elm"],
  [".purs", "purescript"],
  [".ml", "ocaml"],
  [".mli", "ocaml"],

  // Scripting
  [".lua", "lua"],
  [".pl", "perl"],
  [".pm", "perl"],
  [".r", "r"],
  [".R", "r"],
  [".jl", "julia"],

  // Dart
  [".dart", "dart"],

  // Systems
  [".zig", "zig"],
  [".nim", "nim"],
  [".v", "v"],
  [".cr", "crystal"],

  // SQL
  [".sql", "sql"],

  // Config / IaC
  [".tf", "terraform"],
  [".hcl", "terraform"],
  [".yml", "yaml"],
  [".yaml", "yaml"],
  [".toml", "toml"],

  // Docker / Make
  ["Dockerfile", "dockerfile"],
  ["Makefile", "makefile"],
  [".mk", "makefile"],

  // Docs
  [".md", "markdown"],
  [".mdx", "markdown"],
  [".txt", "text"],
  [".rst", "text"],
]);

// Special filenames (no extension) that should be detected
const FILENAME_MAP = new Map<string, SupportedLanguage>([
  ["Dockerfile", "dockerfile"],
  ["Makefile", "makefile"],
  ["GNUmakefile", "makefile"],
  ["Rakefile", "ruby"],
  ["Gemfile", "ruby"],
  ["Vagrantfile", "ruby"],
  ["Procfile", "text"],
]);

export function detectLanguage(filePath: string): SupportedLanguage {
  const basename = filePath.split("/").pop() ?? "";

  // Check special filenames first
  const byName = FILENAME_MAP.get(basename);
  if (byName) return byName;

  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return EXTENSION_MAP.get(ext) ?? "unknown";
}

export function getFileGlobs(): string[] {
  const exts = [...new Set(EXTENSION_MAP.keys())]
    .filter((e) => e.startsWith("."))
    .map((e) => e.slice(1));
  return [
    `**/*.{${exts.join(",")}}`,
    "**/Dockerfile",
    "**/Makefile",
    "**/GNUmakefile",
    "**/Rakefile",
    "**/Gemfile",
  ];
}

export function getIgnorePatterns(): string[] {
  return [
    "**/node_modules/**",
    "**/dist/**",
    "**/build/**",
    "**/.git/**",
    "**/vendor/**",
    "**/__pycache__/**",
    "**/target/**",
    "**/.next/**",
    "**/coverage/**",
    "**/*.min.js",
    "**/*.d.ts",
    "**/bin/**",
    "**/obj/**",
    "**/.nodesage/**",
    "**/.stack-work/**",
    "**/.cabal-sandbox/**",
    "**/_build/**",
    "**/*.lock",
    "**/package-lock.json",
    "**/.env",
    "**/.env.*",
    "**/venv/**",
    "**/.venv/**",
    "**/deps/**",
    "**/_deps/**",
    "**/.dart_tool/**",
    "**/.pub-cache/**",
    "**/zig-cache/**",
    "**/zig-out/**",
    "**/nimcache/**",
    "**/.terraform/**",
  ];
}

// Regex patterns that indicate the start of a logical code boundary
const BOUNDARY_PATTERNS: Partial<Record<SupportedLanguage, RegExp>> = {
  javascript:
    /^\s*(export\s+)?(async\s+)?function\s|^\s*(export\s+)?(default\s+)?class\s|^\s*module\.exports/,
  typescript:
    /^\s*(export\s+)?(async\s+)?function\s|^\s*(export\s+)?(default\s+)?(abstract\s+)?class\s|^\s*(export\s+)?interface\s|^\s*(export\s+)?type\s+\w+\s*=/,
  python: /^(def\s|class\s|@\w)/,
  go: /^func\s|^type\s+\w+\s+(struct|interface)\s/,
  rust: /^(pub\s+)?(fn\s|struct\s|enum\s|impl\s|trait\s|mod\s)/,
  java: /^\s*(public|private|protected|static|final|abstract)\s.*(class|interface|enum|void|static)\s/,
  c: /^[\w*]+\s+\w+\s*\(|^(struct|enum|typedef|union)\s/,
  cpp: /^[\w*:]+\s+[\w:]+\s*\(|^(struct|class|enum|typedef|namespace|template)\s/,
  ruby: /^(def\s|class\s|module\s)/,
  php: /^\s*(public|private|protected)?\s*(static\s+)?(function\s|class\s)/,
  csharp:
    /^\s*(public|private|protected|internal|static|abstract)\s.*(class|interface|struct|enum|void)\s/,
  swift: /^\s*(func\s|class\s|struct\s|enum\s|protocol\s|extension\s)/,
  kotlin: /^\s*(fun\s|class\s|object\s|interface\s|data\s+class\s)/,
  scala: /^\s*(def\s|class\s|object\s|trait\s|case\s+class\s)/,
  haskell: /^\w+\s*::|\b(module|data|type|newtype|class|instance)\s/,
  elixir: /^\s*(def\s|defp\s|defmodule\s|defimpl\s|defprotocol\s)/,
  erlang: /^-module\(|^\w+\s*\(/,
  shell: /^\w+\s*\(\s*\)\s*\{|^function\s+\w+/,
  lua: /^\s*(local\s+)?function\s/,
  perl: /^\s*sub\s+\w+|^\s*package\s/,
  r: /^\s*\w+\s*<-\s*function\s*\(/,
  dart: /^\s*(class\s|void\s|Future|Stream|\w+\s+\w+\s*\()/,
  sql: /^\s*(CREATE|ALTER|DROP|SELECT|INSERT|UPDATE|DELETE|WITH|FUNCTION|PROCEDURE|TRIGGER)\s/i,
  groovy: /^\s*(def\s|class\s|interface\s)/,
  clojure: /^\s*\(defn?\s|\(defmacro\s|\(ns\s/,
  fsharp: /^\s*(let\s|type\s|module\s|open\s)/,
  ocaml: /^\s*(let\s|type\s|module\s|open\s|val\s)/,
  julia: /^\s*(function\s|struct\s|mutable\s+struct\s|macro\s|module\s)/,
  zig: /^\s*(pub\s+)?(fn\s|const\s+\w+\s*=\s*struct)/,
  nim: /^\s*(proc\s|func\s|method\s|type\s)/,
  v: /^\s*(fn\s|struct\s|pub\s+fn\s)/,
  crystal: /^\s*(def\s|class\s|module\s|struct\s)/,
  elm: /^\w+\s*:|^type\s|^module\s/,
  purescript: /^\w+\s*::|\b(module|data|type|class|instance)\s/,
  terraform: /^\s*(resource|data|variable|output|module|provider|locals)\s/,
  dockerfile: /^(FROM|RUN|CMD|ENTRYPOINT|COPY|ADD|ENV|EXPOSE|WORKDIR)\s/i,
  makefile: /^[\w.-]+\s*:/,
  yaml: /^\w[\w.-]*:/,
  toml: /^\[[\w.-]+\]/,
};

const GENERIC_BOUNDARY = /^(function|class|def|fn|pub|export|module|type|struct|enum|impl|trait|interface)\s/;

export function getBoundaryPattern(language: SupportedLanguage): RegExp {
  return BOUNDARY_PATTERNS[language] ?? GENERIC_BOUNDARY;
}

// Patterns to detect import/require lines
const IMPORT_PATTERNS: Partial<Record<SupportedLanguage, RegExp>> = {
  javascript: /^\s*(import\s|const\s+\w+\s*=\s*require|require\s*\()/,
  typescript: /^\s*(import\s|const\s+\w+\s*=\s*require)/,
  python: /^\s*(import\s|from\s+\w)/,
  go: /^\s*(import\s)/,
  rust: /^\s*(use\s|extern\s+crate)/,
  java: /^\s*(import\s|package\s)/,
  c: /^\s*#\s*include\s/,
  cpp: /^\s*#\s*include\s|^\s*using\s/,
  ruby: /^\s*(require\s|require_relative\s)/,
  php: /^\s*(use\s|require\s|include\s)/,
  csharp: /^\s*using\s/,
  swift: /^\s*import\s/,
  kotlin: /^\s*import\s/,
  scala: /^\s*import\s/,
  haskell: /^\s*import\s/,
  elixir: /^\s*(import\s|alias\s|use\s|require\s)/,
  erlang: /^-include/,
  shell: /^\s*(source\s|\.\s)/,
  lua: /^\s*(require|local\s+\w+\s*=\s*require)/,
  perl: /^\s*(use\s|require\s)/,
  r: /^\s*(library|require)\s*\(/,
  dart: /^\s*import\s/,
  groovy: /^\s*import\s/,
  clojure: /^\s*\(:require|\(require\s/,
  fsharp: /^\s*open\s/,
  ocaml: /^\s*open\s/,
  julia: /^\s*(using\s|import\s)/,
  zig: /^\s*const\s+\w+\s*=\s*@import/,
  nim: /^\s*import\s/,
  v: /^\s*import\s/,
  crystal: /^\s*require\s/,
  elm: /^\s*import\s/,
  purescript: /^\s*import\s/,
  terraform: /^\s*(source|required_providers)\s/,
};

const GENERIC_IMPORT = /^\s*(import|require|include|use|from)\s/;

export function getImportPattern(language: SupportedLanguage): RegExp {
  return IMPORT_PATTERNS[language] ?? GENERIC_IMPORT;
}
