# NodeSage

RAG-powered Node.js code reviewer and fixer CLI. Runs entirely locally using Ollama — zero API costs, your code never leaves your machine.

Unlike generic AI reviewers or static linters, NodeSage uses RAG to match your code against a curated knowledge base of Node.js security rules, performance patterns, and best practices. Teams can add their own standards too.

## How It Works

```
Your Code ──> Code Parser ──> Code Chunks
                                   │
                                   v
  Ollama  <── RAG Engine <── Vector DB
 (review &    (retrieve      (embedded
  fix code)    best match)    practices)
      │
      v
  Terminal Report / Auto-Fix
```

1. Parses your JS/TS files into chunks
2. Embeds each chunk and retrieves the most relevant best practices from a local vector DB
3. Sends code + matched practices to a local LLM for review
4. Prints colored findings or auto-fixes the code

## Setup (Step by Step)

### 1. Install Node.js

Download and install Node.js v18+ from [nodejs.org](https://nodejs.org/), or use a version manager:

```bash
# Using nvm
nvm install 18
nvm use 18

# Or using Homebrew (macOS)
brew install node
```

### 2. Install Ollama

```bash
# macOS
brew install ollama

# Linux
curl -fsSL https://ollama.com/install.sh | sh

# Or download from https://ollama.com
```

### 3. Start Ollama and pull models

```bash
# Start the Ollama server (keep this running)
ollama serve

# In a new terminal, pull the required models
ollama pull mistral            # LLM for code review (~4.1GB)
ollama pull nomic-embed-text   # Embedding model for RAG (~274MB)
```

### 4. Install NodeSage

```bash
git clone <repo-url> && cd nodesage
npm install
npm run build
npm link    # Makes 'nodesage' available globally
```

### 5. Initialize the knowledge base

```bash
nodesage init
```

Embeds the bundled best-practice docs into a local vector index (`.nodesage/index/`). Only needed once.

### Review code

```bash
# Review a single file
nodesage review ./src/app.js

# Review an entire directory
nodesage review ./src
```

Prints colored findings with severity levels and fix suggestions:

```
  ●  CRITICAL  SQL Injection Vulnerability (L19-24)
     User input is directly concatenated into SQL query string
     Fix: Use parameterized queries: db.query('SELECT * FROM users WHERE id = $1', [userId])

  ●  WARNING   No Error Handling on Async Operation (L47-51)
     Missing try/catch block on async fetch
     Fix: Wrap in try/catch or add .catch() handler
```

### Auto-fix code

```bash
# Review and automatically fix issues
nodesage fix ./src/app.js
```

Reviews the code, generates fixes for CRITICAL and WARNING issues using the LLM, applies them, and shows a line-by-line diff. Original files are backed up as `.bak`.

### Add custom team standards

```bash
nodesage add ./our-coding-standards.md
```

Embeds a custom markdown file into the knowledge base so reviews match against your team's rules too.

### Options

```bash
nodesage review <path> --model <model>   # Use a different Ollama model
nodesage init --force                     # Re-initialize the knowledge base
```

## Bundled Knowledge Base

5 curated docs covering common Node.js issues:

| File | Covers |
|------|--------|
| `security.md` | SQL injection, command injection, prototype pollution, SSRF, path traversal, secrets, XSS |
| `performance.md` | Event loop blocking, memory leaks, streams, N+1 queries, caching |
| `error-handling.md` | Unhandled rejections, try/catch, custom errors, graceful shutdown |
| `async-patterns.md` | Promise.all, async loops, race conditions, timeouts, cleanup |
| `dependencies.md` | Lock files, audit, supply chain security, unused deps |

## Tech Stack

- **Runtime:** Node.js + TypeScript
- **CLI:** Commander
- **LLM:** Ollama (Mistral 7B)
- **Embeddings:** Ollama (nomic-embed-text)
- **Vector Store:** Vectra (local, file-based)
- **Output:** Chalk (colored terminal)

## Project Structure

```
nodesage/
├── src/
│   ├── index.ts          # CLI entry point
│   ├── parser.ts         # Code file reader + chunker
│   ├── rag.ts            # RAG pipeline (embed + retrieve + prompt)
│   ├── reviewer.ts       # LLM review logic + response parsing
│   ├── fixer.ts          # LLM fix generation + diff + apply
│   ├── reporter.ts       # Colored terminal output
│   └── knowledge/
│       ├── loader.ts     # Markdown knowledge base parser
│       └── store.ts      # Vectra vector store wrapper
├── knowledge-base/       # Curated best-practice markdown docs
├── package.json
└── tsconfig.json
```

## License

MIT
