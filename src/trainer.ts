import * as path from "path";
import * as fs from "fs/promises";
import { fileURLToPath } from "url";
import chalk from "chalk";
import { discoverFiles, chunkAllFiles, chunkFile } from "./chunker.js";
import { embedTexts } from "./embedder.js";
import {
  createFreshIndex,
  isInitialized,
  ensureIndex,
  addItemsBatch,
  loadManifest,
  saveManifest,
} from "./store.js";
import { loadKnowledgeBase } from "./knowledge/loader.js";
import { printProgress, printTrainSummary } from "./reporter.js";
import type { ChunkMetadata, CodeChunk, TrainManifest } from "./types.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const EMBED_BATCH_SIZE = 20;

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

  // Embed and store code chunks in batches
  if (chunks.length > 0) {
    console.log(chalk.cyan("  Embedding code..."));
    let embedded = 0;

    for (let i = 0; i < chunks.length; i += EMBED_BATCH_SIZE) {
      const batch = chunks.slice(i, i + EMBED_BATCH_SIZE);
      const texts = batch.map((c) => c.content);
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

  // Embed knowledge base (only on fresh index)
  let knowledgeCount = 0;
  if (!isIncremental) {
    console.log(chalk.cyan("\n  Embedding knowledge base..."));
    const knowledgeDir = path.resolve(__dirname, "..", "knowledge-base");

    try {
      const knowledgeItems = await loadKnowledgeBase(knowledgeDir);

      for (let i = 0; i < knowledgeItems.length; i += EMBED_BATCH_SIZE) {
        const batch = knowledgeItems.slice(i, i + EMBED_BATCH_SIZE);
        const texts = batch.map((k) => k.text);
        const vectors = await embedTexts(texts);

        const items = batch.map((k, idx) => ({
          text: k.text,
          metadata: {
            type: "knowledge" as const,
            text: k.text,
            source: k.source,
            section: k.section,
          } satisfies ChunkMetadata,
          vector: vectors[idx],
        }));

        await addItemsBatch(items);
        knowledgeCount += batch.length;
        printProgress(knowledgeCount, knowledgeItems.length, "Knowledge");
      }
      console.log();
    } catch {
      console.log(chalk.yellow("\n  Knowledge base not found, skipping.\n"));
    }
  }

  // Save manifest
  const newManifest: TrainManifest = {
    version: 1,
    trainedAt: new Date().toISOString(),
    files: {},
  };

  // Carry forward unchanged entries from previous manifest
  if (manifest) {
    Object.assign(newManifest.files, manifest.files);
  }

  // Update entries for processed files
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
    knowledgeChunks: knowledgeCount,
    elapsed,
  });
}
