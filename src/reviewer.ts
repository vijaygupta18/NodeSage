import { Ollama } from "ollama";
import * as path from "path";
import { CodeChunk } from "./parser.js";
import { retrieveContext, buildPrompt } from "./rag.js";

const ollama = new Ollama();
const DEFAULT_MODEL = "mistral";

export interface Finding {
  severity: "CRITICAL" | "WARNING" | "INFO" | "OK";
  title: string;
  description: string;
  fix: string;
  filePath: string;
  startLine: number;
  endLine: number;
}

export interface ReviewResult {
  filePath: string;
  findings: Finding[];
}

export async function reviewChunk(
  chunk: CodeChunk,
  model: string = DEFAULT_MODEL
): Promise<Finding[]> {
  const ext = path.extname(chunk.filePath);
  const language = [".ts", ".tsx"].includes(ext) ? "typescript" : "javascript";

  const practices = await retrieveContext(chunk.content, 5);
  const prompt = buildPrompt(chunk.content, practices, language);

  const response = await ollama.chat({
    model,
    messages: [{ role: "user", content: prompt }],
    options: {
      temperature: 0.1,
      num_predict: 2048,
    },
  });

  const findings = parseResponse(response.message.content);

  return findings.map((f) => ({
    ...f,
    filePath: chunk.filePath,
    startLine: chunk.startLine,
    endLine: chunk.endLine,
  }));
}

function parseResponse(content: string): Omit<Finding, "filePath" | "startLine" | "endLine">[] {
  try {
    const jsonMatch = content.match(/\[[\s\S]*\]/);
    if (!jsonMatch) {
      return [
        {
          severity: "INFO",
          title: "Review Complete",
          description: content.slice(0, 500),
          fix: "",
        },
      ];
    }

    const parsed = JSON.parse(jsonMatch[0]);
    if (!Array.isArray(parsed)) {
      return [
        {
          severity: "INFO",
          title: "Review Complete",
          description: content.slice(0, 500),
          fix: "",
        },
      ];
    }

    return parsed.map((item: Record<string, unknown>) => ({
      severity: validateSeverity(item.severity as string),
      title: String(item.title || "Finding"),
      description: String(item.description || ""),
      fix: String(item.fix || ""),
    }));
  } catch {
    return [
      {
        severity: "INFO",
        title: "Review Complete",
        description: content.slice(0, 500),
        fix: "",
      },
    ];
  }
}

function validateSeverity(
  s: string
): "CRITICAL" | "WARNING" | "INFO" | "OK" {
  const upper = (s || "").toUpperCase();
  if (["CRITICAL", "WARNING", "INFO", "OK"].includes(upper)) {
    return upper as "CRITICAL" | "WARNING" | "INFO" | "OK";
  }
  return "INFO";
}

export async function reviewChunks(
  chunks: CodeChunk[],
  model: string = DEFAULT_MODEL,
  onProgress?: (current: number, total: number) => void
): Promise<ReviewResult[]> {
  const resultsByFile = new Map<string, Finding[]>();

  for (let i = 0; i < chunks.length; i++) {
    if (onProgress) onProgress(i + 1, chunks.length);

    const findings = await reviewChunk(chunks[i], model);

    for (const finding of findings) {
      const existing = resultsByFile.get(finding.filePath) || [];
      existing.push(finding);
      resultsByFile.set(finding.filePath, existing);
    }
  }

  return Array.from(resultsByFile.entries()).map(([filePath, findings]) => ({
    filePath,
    findings,
  }));
}
