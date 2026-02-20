import { Ollama } from "ollama";
import * as fs from "fs/promises";
import * as path from "path";
import chalk from "chalk";
import { Finding, ReviewResult } from "./reviewer.js";
import { retrieveContext } from "./rag.js";

const ollama = new Ollama();
const DEFAULT_MODEL = "mistral";

export interface FixResult {
  filePath: string;
  original: string;
  fixed: string;
  findings: Finding[];
}

function buildFixPrompt(
  originalCode: string,
  findings: Finding[],
  language: string
): string {
  const issueList = findings
    .filter((f) => f.severity === "CRITICAL" || f.severity === "WARNING")
    .map(
      (f, i) =>
        `${i + 1}. [${f.severity}] ${f.title} (Lines ${f.startLine}-${f.endLine})\n   ${f.description}\n   Suggested fix: ${f.fix}`
    )
    .join("\n\n");

  return `You are NodeSage, an expert Node.js code fixer.

The following code has been reviewed and these issues were found:

${issueList}

Fix ALL the issues listed above in the code below. Rules:
- Return ONLY the complete fixed code, nothing else
- Do NOT add markdown fences, explanations, or comments about what you changed
- Do NOT remove any existing functionality
- Keep the same code style and structure
- Only fix the issues listed above, don't refactor unrelated code
- If a deprecated library is flagged, replace it with the modern equivalent

Original code:
${originalCode}`;
}

export async function fixFile(
  result: ReviewResult,
  model: string = DEFAULT_MODEL
): Promise<FixResult | null> {
  const actionableFindings = result.findings.filter(
    (f) => f.severity === "CRITICAL" || f.severity === "WARNING"
  );

  if (actionableFindings.length === 0) {
    return null;
  }

  const originalCode = await fs.readFile(result.filePath, "utf-8");
  const ext = path.extname(result.filePath);
  const language = [".ts", ".tsx"].includes(ext) ? "typescript" : "javascript";

  const prompt = buildFixPrompt(originalCode, actionableFindings, language);

  const response = await ollama.chat({
    model,
    messages: [{ role: "user", content: prompt }],
    options: {
      temperature: 0.1,
      num_predict: 4096,
    },
  });

  let fixedCode = response.message.content.trim();

  // Strip markdown fences if the LLM wraps the code
  fixedCode = stripMarkdownFences(fixedCode);

  if (fixedCode === originalCode.trim()) {
    return null;
  }

  return {
    filePath: result.filePath,
    original: originalCode,
    fixed: fixedCode + "\n",
    findings: actionableFindings,
  };
}

function stripMarkdownFences(code: string): string {
  // Remove any preamble text before the first code fence or code line
  // e.g., "Here is the fixed code:\n```javascript\n..."
  const fenceMatch = code.match(/```[\w]*\n([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  // Remove lines like "Here is the fixed code:" before actual code
  code = code.replace(/^(?:Here|Below|The following)[\s\S]*?:\s*\n/, "");
  // Remove opening fence like ```javascript or ```js or ```
  code = code.replace(/^```[\w]*\n?/, "");
  // Remove closing fence
  code = code.replace(/\n?```\s*$/, "");
  return code.trim();
}

export async function applyFix(fixResult: FixResult): Promise<string> {
  const backupPath = fixResult.filePath + ".bak";
  await fs.writeFile(backupPath, fixResult.original, "utf-8");
  await fs.writeFile(fixResult.filePath, fixResult.fixed, "utf-8");
  return backupPath;
}

export function printDiff(fixResult: FixResult): void {
  const originalLines = fixResult.original.split("\n");
  const fixedLines = fixResult.fixed.split("\n");
  const relPath = path.basename(fixResult.filePath);

  console.log(
    chalk.bold.underline(`\n  📝 ${relPath}`) +
      chalk.dim(` (${fixResult.findings.length} fixes applied)`)
  );
  console.log();

  // Simple line-by-line diff
  const maxLines = Math.max(originalLines.length, fixedLines.length);
  let diffCount = 0;
  const contextLines = 2;
  const changedLines: Set<number> = new Set();

  // First pass: find changed lines
  for (let i = 0; i < maxLines; i++) {
    const orig = originalLines[i] ?? "";
    const fixed = fixedLines[i] ?? "";
    if (orig !== fixed) {
      changedLines.add(i);
      // Add context lines
      for (let c = Math.max(0, i - contextLines); c <= Math.min(maxLines - 1, i + contextLines); c++) {
        changedLines.add(c);
      }
    }
  }

  if (changedLines.size === 0) {
    console.log(chalk.dim("    No changes detected."));
    return;
  }

  // Second pass: print diff with context
  let lastPrinted = -2;
  const sortedLines = [...changedLines].sort((a, b) => a - b);

  for (const i of sortedLines) {
    if (i > lastPrinted + 1) {
      console.log(chalk.dim("    ..."));
    }
    lastPrinted = i;

    const orig = originalLines[i] ?? "";
    const fixed = fixedLines[i] ?? "";
    const lineNum = String(i + 1).padStart(4);

    if (orig !== fixed) {
      diffCount++;
      if (orig) {
        console.log(chalk.red(`  ${lineNum} - ${orig}`));
      }
      if (fixed) {
        console.log(chalk.green(`  ${lineNum} + ${fixed}`));
      }
    } else {
      console.log(chalk.dim(`  ${lineNum}   ${orig}`));
    }
  }

  console.log();
  console.log(chalk.dim(`    ${diffCount} line(s) changed`));
}
