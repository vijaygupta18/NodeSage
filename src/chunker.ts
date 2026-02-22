import * as fs from "fs/promises";
import * as path from "path";
import { glob } from "glob";
import type { CodeChunk, SupportedLanguage } from "./types.js";
import {
  detectLanguage,
  getFileGlobs,
  getIgnorePatterns,
  getBoundaryPattern,
  getImportPattern,
} from "./languages.js";

const MIN_CHUNK_LINES = 5;
const TARGET_CHUNK_LINES = 40;
const MAX_CHUNK_LINES = 80;
const OVERLAP_LINES = 5;

export async function discoverFiles(targetPath: string): Promise<string[]> {
  const absPath = path.resolve(targetPath);
  const stat = await fs.stat(absPath);

  if (stat.isFile()) {
    const lang = detectLanguage(absPath);
    if (lang === "unknown") {
      throw new Error(`Unsupported file type: ${path.extname(absPath)}`);
    }
    return [absPath];
  }

  if (stat.isDirectory()) {
    const ignorePatterns = getIgnorePatterns();

    // Try to read .gitignore for additional patterns
    try {
      const gitignore = await fs.readFile(
        path.join(absPath, ".gitignore"),
        "utf-8"
      );
      const extraPatterns = gitignore
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l && !l.startsWith("#"))
        .map((l) => (l.startsWith("/") ? `**${l}/**` : `**/${l}/**`));
      ignorePatterns.push(...extraPatterns);
    } catch {
      // No .gitignore, that's fine
    }

    const files = await glob(getFileGlobs(), {
      cwd: absPath,
      absolute: true,
      ignore: ignorePatterns,
    });

    if (files.length === 0) {
      throw new Error(`No supported source files found in ${targetPath}`);
    }

    return files.sort();
  }

  throw new Error(`Invalid path: ${targetPath}`);
}

function classifyChunk(
  lines: string[],
  language: SupportedLanguage
): CodeChunk["chunkKind"] {
  const boundaryPattern = getBoundaryPattern(language);
  const importPattern = getImportPattern(language);

  const firstNonBlank = lines.find((l) => l.trim().length > 0) ?? "";

  if (importPattern.test(firstNonBlank)) return "imports";
  if (/^\s*(class\s|abstract\s+class\s|data\s+class\s)/.test(firstNonBlank))
    return "class";
  if (boundaryPattern.test(firstNonBlank)) return "function";
  return "general";
}

export async function chunkFile(filePath: string): Promise<CodeChunk[]> {
  const content = await fs.readFile(filePath, "utf-8");
  const lines = content.split("\n");
  const language = detectLanguage(filePath);
  const boundaryPattern = getBoundaryPattern(language);
  const chunks: CodeChunk[] = [];

  if (lines.length <= TARGET_CHUNK_LINES) {
    if (lines.length < MIN_CHUNK_LINES) return [];
    chunks.push({
      filePath,
      language,
      startLine: 1,
      endLine: lines.length,
      content,
      chunkKind: classifyChunk(lines, language),
    });
    return chunks;
  }

  let chunkStart = 0;

  while (chunkStart < lines.length) {
    let chunkEnd = Math.min(chunkStart + TARGET_CHUNK_LINES, lines.length);

    // If we haven't reached the end, look for a boundary to split at
    if (chunkEnd < lines.length) {
      // Search forward from TARGET for a boundary line (up to MAX)
      let bestSplit = -1;
      for (
        let i = chunkStart + TARGET_CHUNK_LINES;
        i < Math.min(chunkStart + MAX_CHUNK_LINES, lines.length);
        i++
      ) {
        if (boundaryPattern.test(lines[i])) {
          bestSplit = i;
          break;
        }
      }

      if (bestSplit > 0) {
        chunkEnd = bestSplit;
      } else if (chunkEnd - chunkStart >= MAX_CHUNK_LINES) {
        // Force split at nearest blank line before MAX
        for (let i = chunkStart + MAX_CHUNK_LINES - 1; i >= chunkStart + TARGET_CHUNK_LINES; i--) {
          if (lines[i].trim() === "") {
            chunkEnd = i + 1;
            break;
          }
        }
      }
    }

    const chunkLines = lines.slice(chunkStart, chunkEnd);
    if (chunkLines.length >= MIN_CHUNK_LINES) {
      chunks.push({
        filePath,
        language,
        startLine: chunkStart + 1,
        endLine: chunkEnd,
        content: chunkLines.join("\n"),
        chunkKind: classifyChunk(chunkLines, language),
      });
    }

    // Move forward, with overlap
    chunkStart = chunkEnd - OVERLAP_LINES;
    if (chunkStart <= (chunks.length > 0 ? chunkEnd - chunkLines.length : 0)) {
      chunkStart = chunkEnd; // Prevent infinite loop
    }
  }

  return chunks;
}

export async function chunkAllFiles(
  files: string[],
  onProgress?: (current: number, total: number) => void
): Promise<CodeChunk[]> {
  const allChunks: CodeChunk[] = [];

  for (let i = 0; i < files.length; i++) {
    if (onProgress) onProgress(i + 1, files.length);
    try {
      const chunks = await chunkFile(files[i]);
      allChunks.push(...chunks);
    } catch {
      // Skip files that can't be read (binary, permissions, etc.)
    }
  }

  return allChunks;
}
