import type { SupportedLanguage } from "./types.js";

const EXTENSION_MAP = new Map<string, SupportedLanguage>([
  [".js", "javascript"],
  [".jsx", "javascript"],
  [".mjs", "javascript"],
  [".cjs", "javascript"],
  [".ts", "typescript"],
  [".tsx", "typescript"],
  [".py", "python"],
  [".pyw", "python"],
  [".go", "go"],
  [".rs", "rust"],
  [".java", "java"],
  [".c", "c"],
  [".h", "c"],
  [".cpp", "cpp"],
  [".cc", "cpp"],
  [".cxx", "cpp"],
  [".hpp", "cpp"],
  [".hh", "cpp"],
  [".rb", "ruby"],
  [".php", "php"],
  [".cs", "csharp"],
  [".swift", "swift"],
  [".kt", "kotlin"],
  [".kts", "kotlin"],
  [".scala", "scala"],
  [".sh", "shell"],
  [".bash", "shell"],
  [".zsh", "shell"],
]);

export function detectLanguage(filePath: string): SupportedLanguage {
  const ext = filePath.slice(filePath.lastIndexOf(".")).toLowerCase();
  return EXTENSION_MAP.get(ext) ?? "unknown";
}

export function getFileGlobs(): string {
  const exts = [...new Set(EXTENSION_MAP.keys())]
    .map((e) => e.slice(1)) // remove leading dot
    .join(",");
  return `**/*.{${exts}}`;
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
    "**/*.lock",
    "**/package-lock.json",
  ];
}

// Regex patterns that indicate the start of a logical code boundary
const BOUNDARY_PATTERNS: Record<SupportedLanguage, RegExp> = {
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
  shell: /^\w+\s*\(\s*\)\s*\{|^function\s+\w+/,
  unknown: /^(function|class|def|fn|pub|export)\s/,
};

export function getBoundaryPattern(language: SupportedLanguage): RegExp {
  return BOUNDARY_PATTERNS[language] ?? BOUNDARY_PATTERNS.unknown;
}

// Patterns to detect import/require lines
const IMPORT_PATTERNS: Record<string, RegExp> = {
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
  shell: /^\s*(source\s|\.?\s)/,
};

export function getImportPattern(language: SupportedLanguage): RegExp {
  return IMPORT_PATTERNS[language] ?? /^\s*import\s/;
}
