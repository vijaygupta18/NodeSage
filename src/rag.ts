import { Ollama } from "ollama";
import { queryItems, KnowledgeItem } from "./knowledge/store.js";

const ollama = new Ollama();
const EMBED_MODEL = "nomic-embed-text";

export async function embedText(text: string): Promise<number[]> {
  const response = await ollama.embed({
    model: EMBED_MODEL,
    input: text,
  });
  return response.embeddings[0];
}

export async function retrieveContext(
  codeChunk: string,
  topK: number = 5
): Promise<KnowledgeItem[]> {
  const queryVector = await embedText(codeChunk);
  return queryItems(queryVector, topK);
}

export function buildPrompt(
  codeChunk: string,
  practices: KnowledgeItem[],
  language: string
): string {
  const practiceText = practices
    .map(
      (p) =>
        `[${p.source} - ${p.section}]\n${p.text}`
    )
    .join("\n\n---\n\n");

  return `You are NodeSage, an expert Node.js code reviewer.

Given these Node.js best practices:
---
${practiceText}
---

Review this code and identify issues related to security, performance, error handling, and best practices. For each issue found:
- State the issue clearly
- Explain why it matters
- Show how to fix it
- Rate severity: CRITICAL | WARNING | INFO

If the code follows best practices well, say so briefly. Be specific and actionable, not generic.

IMPORTANT: Respond ONLY with a valid JSON array. Each element must have these fields:
- "severity": one of "CRITICAL", "WARNING", "INFO", "OK"
- "title": short issue title
- "description": explanation of the issue
- "fix": suggested fix or code example (use \\n for newlines in code)

Example response format:
[
  {
    "severity": "CRITICAL",
    "title": "SQL Injection Vulnerability",
    "description": "User input is directly concatenated into SQL query string",
    "fix": "Use parameterized queries: db.query('SELECT * FROM users WHERE id = $1', [userId])"
  }
]

If code is fine, return:
[{"severity": "OK", "title": "No issues found", "description": "This code follows best practices", "fix": ""}]

Code to review:
\`\`\`${language}
${codeChunk}
\`\`\``;
}
