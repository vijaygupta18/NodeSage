# NodeSage

RAG-powered repo Q&A and code fixer CLI. Train it on any codebase, ask anything about the code, and fix issues — all locally using Ollama. Zero API costs, your code never leaves your machine.

Supports all major languages: JavaScript, TypeScript, Python, Go, Rust, Java, C/C++, Ruby, PHP, C#, Swift, Kotlin, Scala, and Shell.

## How It Works

```
Your Repo ──> Smart Chunker ──> Code Chunks ──> Embeddings ──> Vector DB
                                                                   │
                                                                   v
  You ──> "nodesage chat" ──> RAG Retriever ──> Ollama LLM ──> Answers / Fixes
```

1. **Train** — Scans your repo, chunks code by function/class boundaries, and embeds everything into a local vector DB
2. **Chat** — Ask questions. NodeSage retrieves relevant code + best practices and answers using a local LLM
3. **Fix** — Auto-generates fixes with diffs, backs up originals

## Setup

### 1. Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh
```

### 2. Start Ollama and pull models

```bash
ollama serve                    # Keep this running
ollama pull mistral             # LLM for Q&A and fixes (~4.1GB)
ollama pull nomic-embed-text    # Embedding model for RAG (~274MB)
```

### 3. Install NodeSage

```bash
git clone <repo-url> && cd nodesage
npm install
npm run build
npm link    # Makes 'nodesage' available globally
```

## Usage

### Train on a codebase

```bash
# Train on current directory
nodesage train

# Train on a specific repo
nodesage train ./path/to/repo

# Force full re-index (ignore cache)
nodesage train --force
```

Indexes all supported source files, embeds code chunks + bundled best practices into a local vector DB. Supports incremental updates — only re-embeds changed files on subsequent runs.

### Chat with your code

```bash
nodesage chat
```

Starts an interactive session where you can ask anything about the trained codebase:

```
  nodesage> what does the chunker module do?
  nodesage> find potential security issues in the auth handler
  nodesage> how does the database connection pool work?
  nodesage> explain the error handling in src/api.ts
```

Chat commands:
- `/fix <file>` — Fix a file based on conversation context
- `/clear` — Clear conversation history
- `/context` — Show what code was retrieved for the last query
- `/help` — Show available commands
- `/quit` — Exit chat

### Fix a file directly

```bash
nodesage fix ./src/app.js
```

Reviews the file against best practices, generates fixes, shows a diff, and asks before applying. Originals are backed up as `.bak`.

### Options

```bash
nodesage train [path] --force         # Full re-index
nodesage chat --model <model>         # Use a different Ollama model
nodesage fix <file> --model <model>   # Use a different model for fixes
```

## Supported Languages

| Language | Extensions |
|----------|-----------|
| JavaScript | `.js`, `.jsx`, `.mjs`, `.cjs` |
| TypeScript | `.ts`, `.tsx` |
| Python | `.py` |
| Go | `.go` |
| Rust | `.rs` |
| Java | `.java` |
| C | `.c`, `.h` |
| C++ | `.cpp`, `.cc`, `.cxx`, `.hpp` |
| Ruby | `.rb` |
| PHP | `.php` |
| C# | `.cs` |
| Swift | `.swift` |
| Kotlin | `.kt` |
| Scala | `.scala` |
| Shell | `.sh`, `.bash`, `.zsh` |

## Bundled Knowledge Base

5 curated docs covering common coding issues:

| File | Covers |
|------|--------|
| `security.md` | SQL injection, command injection, prototype pollution, SSRF, path traversal, secrets |
| `performance.md` | Event loop blocking, memory leaks, streams, N+1 queries, caching |
| `error-handling.md` | Unhandled rejections, try/catch, custom errors, graceful shutdown |
| `async-patterns.md` | Promise.all, async loops, race conditions, timeouts, cleanup |
| `dependencies.md` | Lock files, audit, supply chain security, unused deps |

## Project Structure

```
nodesage/
├── src/
│   ├── index.ts          # CLI entry point (train, chat, fix commands)
│   ├── types.ts          # Shared interfaces and types
│   ├── languages.ts      # Language detection + boundary patterns
│   ├── chunker.ts        # Smart multi-language code chunker
│   ├── store.ts          # Vector store wrapper (Vectra)
│   ├── embedder.ts       # Ollama embedding (single + batch)
│   ├── retriever.ts      # RAG retrieval + context formatting
│   ├── llm.ts            # Ollama LLM wrapper (chat + streaming)
│   ├── trainer.ts        # Train command logic
│   ├── chat.ts           # Interactive chat REPL
│   ├── fixer.ts          # Fix command logic
│   ├── reporter.ts       # Terminal output helpers
│   └── knowledge/
│       └── loader.ts     # Markdown knowledge base parser
├── knowledge-base/       # Curated best-practice markdown docs
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Runtime:** Node.js 18+ / TypeScript
- **CLI:** Commander
- **LLM:** Ollama (Mistral 7B default, any Ollama model)
- **Embeddings:** Ollama (nomic-embed-text)
- **Vector Store:** Vectra (local, file-based)
- **Output:** Chalk (colored terminal)

## License

MIT
