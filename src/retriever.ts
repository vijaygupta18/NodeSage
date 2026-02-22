import type { RetrievedContext } from "./types.js";
import { embedText } from "./embedder.js";
import { queryItems } from "./store.js";

export async function retrieveContext(
  query: string,
  options?: {
    topK?: number;
    type?: "code" | "knowledge" | "both";
  }
): Promise<RetrievedContext[]> {
  const topK = options?.topK ?? 8;
  const type = options?.type ?? "both";

  const queryVector = await embedText(query);

  if (type === "both") {
    // Retrieve from both, weighted toward code
    const codeResults = await queryItems(queryVector, topK, { type: "code" });
    const knowledgeResults = await queryItems(queryVector, Math.ceil(topK / 2), {
      type: "knowledge",
    });
    // Merge and sort by score, deduplicate
    const combined = [...codeResults, ...knowledgeResults];
    combined.sort((a, b) => b.score - a.score);
    return combined.slice(0, topK);
  }

  return queryItems(queryVector, topK, { type });
}

export function formatContext(results: RetrievedContext[]): string {
  if (results.length === 0) return "";

  const sections: string[] = [];

  for (const r of results) {
    if (r.metadata.type === "code") {
      const loc = r.metadata.startLine && r.metadata.endLine
        ? ` L${r.metadata.startLine}-${r.metadata.endLine}`
        : "";
      const kind = r.metadata.chunkKind ? ` (${r.metadata.chunkKind})` : "";
      sections.push(
        `[CODE: ${r.metadata.filePath}${loc}${kind}]\n${r.text}`
      );
    } else {
      sections.push(
        `[BEST PRACTICE: ${r.metadata.source} - ${r.metadata.section}]\n${r.text}`
      );
    }
  }

  return sections.join("\n\n---\n\n");
}
