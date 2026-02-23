import { LocalIndex } from "vectra";
import * as path from "path";
import * as os from "os";
import * as fs from "fs/promises";
import type { ChunkMetadata, RetrievedContext, TrainManifest } from "./types.js";

const NODESAGE_DIR = path.join(os.homedir(), ".nodesage");
const INDEX_DIR = path.join(NODESAGE_DIR, "index");
const MANIFEST_PATH = path.join(NODESAGE_DIR, "manifest.json");

let indexInstance: LocalIndex | null = null;

export async function ensureIndex(): Promise<LocalIndex> {
  if (indexInstance) return indexInstance;

  const index = new LocalIndex(INDEX_DIR);
  if (await index.isIndexCreated()) {
    indexInstance = index;
    return index;
  }

  throw new Error(
    'Index not found. Run "nodesage train <path>" first.'
  );
}

export async function createFreshIndex(): Promise<LocalIndex> {
  await fs.rm(INDEX_DIR, { recursive: true, force: true });
  await fs.mkdir(INDEX_DIR, { recursive: true });
  const index = new LocalIndex(INDEX_DIR);
  await index.createIndex();
  indexInstance = index;
  return index;
}

export async function deleteAllData(): Promise<void> {
  await fs.rm(NODESAGE_DIR, { recursive: true, force: true });
  indexInstance = null;
}

export async function isInitialized(): Promise<boolean> {
  const index = new LocalIndex(INDEX_DIR);
  return index.isIndexCreated();
}

export async function addItemsBatch(
  items: Array<{ text: string; metadata: ChunkMetadata; vector: number[] }>
): Promise<number> {
  const index = await ensureIndex();
  await index.beginUpdate();

  for (const item of items) {
    await index.insertItem({
      vector: item.vector,
      metadata: { ...item.metadata } as unknown as Record<string, string | number | boolean>,
    });
  }

  await index.endUpdate();
  return items.length;
}

export async function queryItems(
  queryVector: number[],
  topK: number = 8,
  filter?: { type?: "code" | "knowledge" }
): Promise<RetrievedContext[]> {
  const index = await ensureIndex();

  let metadataFilter: Record<string, unknown> | undefined;
  if (filter?.type) {
    metadataFilter = { type: { $eq: filter.type } };
  }

  const results = await index.queryItems(queryVector, topK, metadataFilter);

  return results.map((r) => ({
    text: r.item.metadata.text as string,
    metadata: r.item.metadata as unknown as ChunkMetadata,
    score: r.score,
  }));
}

export async function loadManifest(): Promise<TrainManifest | null> {
  try {
    const data = await fs.readFile(MANIFEST_PATH, "utf-8");
    return JSON.parse(data) as TrainManifest;
  } catch {
    return null;
  }
}

export async function saveManifest(manifest: TrainManifest): Promise<void> {
  await fs.mkdir(NODESAGE_DIR, { recursive: true });
  await fs.writeFile(MANIFEST_PATH, JSON.stringify(manifest, null, 2), "utf-8");
}
