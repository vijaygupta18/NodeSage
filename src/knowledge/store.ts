import { LocalIndex } from "vectra";
import * as path from "path";
import * as fs from "fs/promises";

const INDEX_DIR = path.join(process.cwd(), ".nodesage", "index");

let indexInstance: LocalIndex | null = null;

export async function getIndex(): Promise<LocalIndex> {
  if (indexInstance) return indexInstance;

  const index = new LocalIndex(INDEX_DIR);
  if (await index.isIndexCreated()) {
    indexInstance = index;
    return index;
  }

  throw new Error(
    'Knowledge base not initialized. Run "nodesage init" first.'
  );
}

export async function createIndex(): Promise<LocalIndex> {
  await fs.mkdir(path.dirname(INDEX_DIR), { recursive: true });
  const index = new LocalIndex(INDEX_DIR);

  if (!(await index.isIndexCreated())) {
    await index.createIndex();
  }

  indexInstance = index;
  return index;
}

export async function deleteIndex(): Promise<void> {
  await fs.rm(INDEX_DIR, { recursive: true, force: true });
  indexInstance = null;
}

export async function isInitialized(): Promise<boolean> {
  const index = new LocalIndex(INDEX_DIR);
  return index.isIndexCreated();
}

export interface KnowledgeItem {
  text: string;
  source: string;
  section: string;
}

export async function addItems(
  items: KnowledgeItem[],
  embedFn: (text: string) => Promise<number[]>
): Promise<number> {
  const index = await getIndex();
  let count = 0;

  for (const item of items) {
    const vector = await embedFn(item.text);
    await index.insertItem({
      vector,
      metadata: {
        text: item.text,
        source: item.source,
        section: item.section,
      },
    });
    count++;
  }

  return count;
}

export async function queryItems(
  queryVector: number[],
  topK: number = 5
): Promise<KnowledgeItem[]> {
  const index = await getIndex();
  const results = await index.queryItems(queryVector, topK);

  return results.map((r) => ({
    text: r.item.metadata.text as string,
    source: r.item.metadata.source as string,
    section: r.item.metadata.section as string,
  }));
}
