# NodeSage

RAG-powered repo Q&A and code fixer CLI. Train it on any codebase, ask anything about the code, and fix issues — all locally using Ollama. Zero API costs, your code never leaves your machine.

Supports **40+ languages** including JavaScript, TypeScript, Python, Go, Rust, Java, C/C++, Ruby, PHP, Haskell, Dart, Lua, SQL, Terraform, and many more.

## How It Works

```
Your Repo ──> Smart Chunker ──> Code Chunks ──> Embeddings ──> Vector DB
                                                                   │
                                                                   v
  You ──> "nodesage chat" ──> RAG Retriever ──> Ollama LLM ──> Answers / Fixes
```

1. **Train** — Scans your repo, chunks code by function/class boundaries, and embeds everything into a local vector DB at `~/.nodesage/`
2. **Chat** — Ask questions in an interactive REPL. NodeSage retrieves relevant code via RAG and answers using a local LLM with streaming output
3. **Fix** — Auto-generates fixes with diffs, asks before applying, backs up originals

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
ollama serve                       # Keep this running
ollama pull qwen2.5-coder:7b      # Code LLM for Q&A and fixes (~4.7GB, 128K context)
ollama pull nomic-embed-text       # Embedding model for RAG (~274MB)
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

Indexes all supported source files, embeds code chunks into a local vector DB at `~/.nodesage/`. Supports **incremental updates** — only re-embeds changed files on subsequent runs.

### Chat with your code

```bash
nodesage chat
```

Starts an interactive session with streaming markdown output:

```
  NodeSage v2.0.0
  Ask anything about your trained codebase.
  Type /help for commands, /quit to exit.

  Model: qwen2.5-coder:7b

  > what does the chunker module do?
  ⠹ Thinking...

  The chunker module handles splitting source files into
  semantic chunks for embedding...

  > find security issues in the auth handler
  > how does the database connection pool work?
```

Chat commands:
- `/fix <file>` — Fix a file based on conversation context
- `/model [name]` — Switch LLM model mid-session (e.g. `/model llama3.1:8b`)
- `/clear` — Clear conversation history
- `/context` — Show what code chunks were retrieved for the last query
- `/help` — Show available commands
- `/quit` — Exit chat

### Fix a file directly

```bash
nodesage fix ./src/app.js
```

Reviews the file, generates fixes, shows a colored diff, and asks before applying. Originals are backed up as `.bak`.

## Configuration

All settings are configurable via `nodesage config`, environment variables, or `~/.nodesage/config.json`.

### View current config

```bash
nodesage config
```

```
  NodeSage Configuration
  ~/.nodesage/config.json

  chatModel      qwen2.5-coder:7b (default)
  embedModel     nomic-embed-text (default)
  temperature    0.3 (default)
  maxTokens      4096 (default)
  topK           10 (default)
  chunkSize      40 (default)
  chunkOverlap   5 (default)
  contextWindow  20 (default)
```

### Set a value

```bash
# Switch to a different chat model
nodesage config chatModel llama3.1:8b

# Use a different embedding model
nodesage config embedModel mxbai-embed-large

# Adjust creativity (0.0 = deterministic, 1.0 = creative)
nodesage config temperature 0.5

# Increase max response length
nodesage config maxTokens 8192

# Retrieve more/fewer code chunks per query
nodesage config topK 15

# Reset a single key to default
nodesage config --reset chatModel

# Reset all config to defaults
nodesage config --reset
```

### Config options

| Key | Default | Description |
|-----|---------|-------------|
| `chatModel` | `qwen2.5-coder:7b` | Ollama model for chat and fixes |
| `embedModel` | `nomic-embed-text` | Ollama model for embeddings |
| `temperature` | `0.3` | LLM creativity (0.0-1.0) |
| `maxTokens` | `4096` | Max tokens per response |
| `topK` | `10` | Number of code chunks retrieved per query |
| `chunkSize` | `40` | Target lines per code chunk |
| `chunkOverlap` | `5` | Overlap lines between chunks |
| `contextWindow` | `20` | Messages kept in conversation history |

### Environment variables

Override any setting without modifying the config file:

```bash
NODESAGE_CHAT_MODEL=llama3.1:8b nodesage chat
NODESAGE_EMBED_MODEL=mxbai-embed-large nodesage train
NODESAGE_TEMPERATURE=0.1 nodesage fix ./src/app.js
NODESAGE_TOP_K=20 nodesage chat
```

### CLI flag overrides

The `--model` flag on any command overrides the configured chat model for that session:

```bash
nodesage chat --model deepseek-coder:6.7b
nodesage fix ./src/app.js --model codellama:13b
```

### Recommended models

| Model | Size | Context | Best for |
|-------|------|---------|----------|
| `qwen2.5-coder:7b` | 4.7GB | 128K | General code Q&A (default) |
| `deepseek-coder-v2:16b` | 8.9GB | 128K | Complex code analysis |
| `codellama:13b` | 7.4GB | 16K | Code generation and fixes |
| `llama3.1:8b` | 4.7GB | 128K | General purpose |
| `nomic-embed-text` | 274MB | 8K | Embeddings (default) |
| `mxbai-embed-large` | 670MB | 512 | Higher quality embeddings |

## Supported Languages

NodeSage supports **40+ languages** with smart boundary detection for accurate code chunking.

| Category | Languages |
|----------|-----------|
| **Web** | JavaScript (`.js`, `.jsx`, `.mjs`, `.cjs`), TypeScript (`.ts`, `.tsx`), PHP (`.php`) |
| **Systems** | C (`.c`, `.h`), C++ (`.cpp`, `.cc`, `.cxx`, `.hpp`), Rust (`.rs`), Go (`.go`), Zig (`.zig`), Nim (`.nim`), V (`.v`) |
| **JVM** | Java (`.java`), Kotlin (`.kt`), Scala (`.scala`), Groovy (`.groovy`), Clojure (`.clj`, `.cljs`) |
| **Scripting** | Python (`.py`), Ruby (`.rb`), Perl (`.pl`, `.pm`), Lua (`.lua`), Shell (`.sh`, `.bash`, `.zsh`, `.fish`) |
| **.NET** | C# (`.cs`), F# (`.fs`, `.fsx`) |
| **Functional** | Haskell (`.hs`, `.lhs`), Elixir (`.ex`, `.exs`), Erlang (`.erl`, `.hrl`), Elm (`.elm`), PureScript (`.purs`), OCaml (`.ml`, `.mli`) |
| **Mobile** | Swift (`.swift`), Kotlin (`.kt`), Dart (`.dart`) |
| **Data / Science** | R (`.r`, `.R`), Julia (`.jl`), SQL (`.sql`) |
| **DevOps / Config** | Terraform (`.tf`, `.hcl`), Dockerfile, Makefile, YAML (`.yml`, `.yaml`), TOML (`.toml`) |
| **Other** | Crystal (`.cr`), Markdown (`.md`, `.mdx`) |

## Project Structure

```
nodesage/
├── src/
│   ├── index.ts          # CLI entry point (train, chat, fix, config commands)
│   ├── config.ts          # Configuration management (file, env, defaults)
│   ├── types.ts          # Shared interfaces and types
│   ├── languages.ts      # Language detection + boundary patterns (40+ languages)
│   ├── chunker.ts        # Smart multi-language code chunker
│   ├── store.ts          # Vector store wrapper (Vectra, ~/.nodesage/)
│   ├── embedder.ts       # Ollama embedding (concurrent batch)
│   ├── retriever.ts      # RAG retrieval with file-aware context grouping
│   ├── llm.ts            # Ollama LLM wrapper (chat + streaming)
│   ├── trainer.ts        # Train command logic (full + incremental)
│   ├── chat.ts           # Interactive chat REPL with streaming markdown
│   ├── fixer.ts          # Fix command logic (standalone + interactive)
│   └── reporter.ts       # Terminal output (spinner, markdown rendering, diffs)
├── package.json
└── tsconfig.json
```

## Tech Stack

- **Runtime:** Node.js 18+ / TypeScript
- **CLI:** Commander
- **LLM:** Ollama (any model — configurable)
- **Embeddings:** Ollama (nomic-embed-text default — configurable)
- **Vector Store:** Vectra (local, file-based)
- **Output:** Chalk (colored terminal with streaming markdown)

## License

MIT
