import type { RetrievedContext } from "./types.js";
import { embedText } from "./embedder.js";
import { queryItems } from "./store.js";

export async function retrieveContext(
  query: string,
  options?: { topK?: number }
): Promise<RetrievedContext[]> {
  const topK = options?.topK ?? 10;

  const queryVector = await embedText(query);
  const results = await queryItems(queryVector, topK);

  // File-aware deduplication: if multiple chunks from the same file
  // are retrieved, keep them but group them together for better context
  const byFile = new Map<string, RetrievedContext[]>();
  for (const r of results) {
    const file = r.metadata.filePath;
    const existing = byFile.get(file) ?? [];
    existing.push(r);
    byFile.set(file, existing);
  }

  // Sort chunks within each file by line number for coherent reading
  const sorted: RetrievedContext[] = [];
  for (const [, chunks] of byFile) {
    chunks.sort((a, b) => (a.metadata.startLine) - (b.metadata.startLine));
    sorted.push(...chunks);
  }

  return sorted;
}

export function formatContext(results: RetrievedContext[]): string {
  if (results.length === 0) return "";

  // Group by file for cleaner context
  const byFile = new Map<string, RetrievedContext[]>();
  for (const r of results) {
    const file = r.metadata.filePath;
    const existing = byFile.get(file) ?? [];
    existing.push(r);
    byFile.set(file, existing);
  }

  const sections: string[] = [];

  for (const [filePath, chunks] of byFile) {
    // Sort by line number within each file
    chunks.sort((a, b) => a.metadata.startLine - b.metadata.startLine);

    const lang = chunks[0].metadata.language;
    const ranges = chunks
      .map((c) => `L${c.metadata.startLine}-${c.metadata.endLine}`)
      .join(", ");

    const code = chunks.map((c) => c.text).join("\n\n// ...\n\n");

    sections.push(
      `[FILE: ${filePath} (${lang}) ${ranges}]\n\`\`\`${lang}\n${code}\n\`\`\``
    );
  }

  return sections.join("\n\n---\n\n");
}
