import * as path from "path";
import * as fs from "fs/promises";
import chalk from "chalk";
import { discoverFiles, chunkAllFiles } from "./chunker.js";
import { embedTexts } from "./embedder.js";
import {
  createFreshIndex,
  isInitialized,
  ensureIndex,
  addItemsBatch,
  loadManifest,
  saveManifest,
} from "./store.js";
import { printProgress, printTrainSummary } from "./reporter.js";
import type { ChunkMetadata, CodeChunk, TrainManifest } from "./types.js";

const EMBED_BATCH_SIZE = 100;

// Prepend file path and context to chunk text for better embeddings
function buildEmbeddingText(chunk: CodeChunk): string {
  const relPath = path.relative(process.cwd(), chunk.filePath);
  const kind = chunk.chunkKind !== "general" ? ` (${chunk.chunkKind})` : "";
  return `File: ${relPath}${kind}\n\n${chunk.content}`;
}

export async function train(
  targetPath: string,
  options: { force?: boolean } = {}
): Promise<void> {
  const absPath = path.resolve(targetPath);
  const startTime = Date.now();

  console.log(chalk.dim(`  Target: ${absPath}`));

  // Decide: full or incremental
  const initialized = await isInitialized();
  const manifest = initialized && !options.force ? await loadManifest() : null;
  const isIncremental = !!manifest;

  if (!initialized || options.force) {
    console.log(chalk.cyan("  Creating fresh index...\n"));
    await createFreshIndex();
  } else {
    await ensureIndex();
  }

  // Discover files
  const files = await discoverFiles(absPath);
  console.log(chalk.dim(`  Found ${files.length} source files\n`));

  // Partition files for incremental training
  let filesToProcess: string[] = files;
  if (isIncremental && manifest) {
    const newOrChanged: string[] = [];
    for (const file of files) {
      const stat = await fs.stat(file);
      const mtime = stat.mtimeMs;
      const entry = manifest.files[file];
      if (!entry || entry.mtime !== mtime) {
        newOrChanged.push(file);
      }
    }
    filesToProcess = newOrChanged;

    if (filesToProcess.length === 0) {
      console.log(chalk.green("  No changes detected. Index is up to date.\n"));
      return;
    }

    console.log(
      chalk.dim(
        `  Incremental: ${filesToProcess.length} new/changed files (${files.length - filesToProcess.length} unchanged)\n`
      )
    );
  }

  // Chunk files
  console.log(chalk.cyan("  Chunking files..."));
  const chunks = await chunkAllFiles(filesToProcess, (current, total) =>
    printProgress(current, total, "Scanning")
  );
  console.log(chalk.dim(`\n  ${chunks.length} code chunks created\n`));

  // Embed and store code chunks in batches with concurrency
  if (chunks.length > 0) {
    console.log(chalk.cyan("  Embedding code..."));
    let embedded = 0;

    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      // Build embedding text with file path context
      const texts = batch.map(buildEmbeddingText);
      const vectors = await embedTexts(texts);

      const items = batch.map((chunk, idx) => ({
        text: chunk.content,
        metadata: {
          type: "code" as const,
          text: chunk.content,
          filePath: chunk.filePath,
          language: chunk.language,
          startLine: chunk.startLine,
          endLine: chunk.endLine,
          chunkKind: chunk.chunkKind,
        } satisfies ChunkMetadata,
        vector: vectors[idx],
      }));

      await addItemsBatch(items);
      embedded += batch.length;
      printProgress(embedded, chunks.length, "Embedding");
    }
    console.log();
  }

  // Save manifest
  const newManifest: TrainManifest = {
    version: 1,
    trainedAt: new Date().toISOString(),
    files: {},
  };

  if (manifest) {
    Object.assign(newManifest.files, manifest.files);
  }

  for (const file of filesToProcess) {
    const stat = await fs.stat(file);
    const fileChunks = chunks.filter((c) => c.filePath === file);
    newManifest.files[file] = {
      mtime: stat.mtimeMs,
      chunkCount: fileChunks.length,
    };
  }

  await saveManifest(newManifest);

  const elapsed = Date.now() - startTime;
  printTrainSummary({
    files: filesToProcess.length,
    codeChunks: chunks.length,
    knowledgeChunks: 0,
    elapsed,
  });
}
