import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";

export interface CodeChunk {
  filePath: string;
  startLine: number;
  endLine: number;
  content: string;
}

const CHUNK_SIZE = 50;
const CHUNK_OVERLAP = 10;

export async function getFiles(targetPath: string): Promise<string[]> {
  const stat = await fs.stat(targetPath);

  if (stat.isFile()) {
    const ext = path.extname(targetPath);
    if ([".js", ".ts", ".mjs", ".cjs"].includes(ext)) {
      return [targetPath];
    }
    throw new Error(
      `Unsupported file type: ${ext}. Supported: .js, .ts, .mjs, .cjs`
    );
  }

  if (stat.isDirectory()) {
    const files = await glob("**/*.{js,ts,mjs,cjs}", {
      cwd: targetPath,
      absolute: true,
      ignore: [
        "**/node_modules/**",
        "**/dist/**",
        "**/build/**",
        "**/.next/**",
        "**/coverage/**",
        "**/*.d.ts",
        "**/*.min.js",
      ],
    });
    if (files.length === 0) {
      throw new Error(`No JavaScript/TypeScript files found in ${targetPath}`);
    }
    return files.sort();
  }

  throw new Error(`Invalid path: ${targetPath}`);
}

export async function parseFile(filePath: string): Promise<CodeChunk[]> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const chunks: CodeChunk[] = [];

  if (lines.length <= CHUNK_SIZE) {
    chunks.push({
      filePath,
      startLine: 1,
      endLine: lines.length,
      content,
    });
    return chunks;
  }

  for (let i = 0; i < lines.length; i += CHUNK_SIZE - CHUNK_OVERLAP) {
    const chunkLines = lines.slice(i, i + CHUNK_SIZE);
    if (chunkLines.length < 5) break;

    chunks.push({
      filePath,
      startLine: i + 1,
      endLine: Math.min(i + CHUNK_SIZE, lines.length),
      content: chunkLines.join("\n"),
    });
  }

  return chunks;
}

export async function parseFiles(targetPath: string): Promise<CodeChunk[]> {
  const absPath = path.resolve(targetPath);
  const files = await getFiles(absPath);
  const allChunks: CodeChunk[] = [];

  for (const file of files) {
    const chunks = await parseFile(file);
    allChunks.push(...chunks);
  }

  return allChunks;
}
