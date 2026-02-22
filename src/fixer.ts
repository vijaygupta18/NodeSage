import * as fs from "fs/promises";
import * as path from "path";
import * as readline from "readline";
import chalk from "chalk";
import { retrieveContext, formatContext } from "./retriever.js";
import { chat, type Message } from "./llm.js";
import { detectLanguage } from "./languages.js";
import { printDiff } from "./reporter.js";
import type { FixResult } from "./types.js";

function stripMarkdownFences(code: string): string {
  const fenceMatch = code.match(/```[\w]*\n([\s\S]*?)```/);
  if (fenceMatch) {
    return fenceMatch[1].trim();
  }
  code = code.replace(/^(?:Here|Below|The following)[\s\S]*?:\s*\n/, "");
  code = code.replace(/^```[\w]*\n?/, "");
  code = code.replace(/\n?```\s*$/, "");
  return code.trim();
}

function buildFixPrompt(
  originalCode: string,
  context: string,
  language: string
): string {
  return `You are NodeSage, an expert code reviewer and fixer.

Given these best practices and related code:
---
${context}
---

Review this ${language} file and fix any issues related to security, performance, error handling, and best practices.

Rules:
- Return ONLY the complete fixed code, nothing else
- Do NOT add markdown fences, explanations, or comments about what you changed
- Do NOT remove any existing functionality
- Keep the same code style and structure
- Only fix real issues, don't refactor working code

Code to fix:
${originalCode}`;
}

export async function fixFile(
  filePath: string,
  options: { model?: string } = {}
): Promise<void> {
  const absPath = path.resolve(filePath);
  const language = detectLanguage(absPath);
  const originalCode = await fs.readFile(absPath, "utf-8");
  const model = options.model ?? "mistral";

  console.log(chalk.dim(`  File: ${absPath}`));
  console.log(chalk.dim(`  Language: ${language}`));
  console.log(chalk.cyan("\n  Analyzing code...\n"));

  // Retrieve relevant knowledge
  const context = await retrieveContext(originalCode, {
    topK: 5,
    type: "knowledge",
  });
  const contextStr = formatContext(context);

  const prompt = buildFixPrompt(originalCode, contextStr, language);

  console.log(chalk.cyan("  Generating fixes...\n"));

  const response = await chat(
    [{ role: "user", content: prompt }],
    model,
    { temperature: 0.1, num_predict: 4096 }
  );

  let fixedCode = stripMarkdownFences(response);

  if (fixedCode === originalCode.trim()) {
    console.log(chalk.green("  No issues found. Code looks good!\n"));
    return;
  }

  // Show diff
  printDiff(originalCode, fixedCode + "\n", path.relative(process.cwd(), absPath));

  // Ask user to apply
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question(chalk.cyan("\n  Apply fixes? (y/n) "), resolve);
  });
  rl.close();

  if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
    const backupPath = absPath + ".bak";
    await fs.writeFile(backupPath, originalCode, "utf-8");
    await fs.writeFile(absPath, fixedCode + "\n", "utf-8");
    console.log(chalk.green(`\n  Fixed! Backup saved to ${path.basename(backupPath)}\n`));
  } else {
    console.log(chalk.dim("\n  Fix cancelled.\n"));
  }
}

export async function fixFileInteractive(
  filePath: string,
  conversationHistory: Message[],
  model: string
): Promise<void> {
  const absPath = path.resolve(filePath);
  const language = detectLanguage(absPath);

  let originalCode: string;
  try {
    originalCode = await fs.readFile(absPath, "utf-8");
  } catch {
    console.log(chalk.red(`\n  Cannot read file: ${filePath}\n`));
    return;
  }

  console.log(chalk.cyan(`\n  Generating fix for ${path.basename(absPath)}...\n`));

  // Build prompt with conversation context
  const fixPrompt = `Based on our conversation, fix the following ${language} file.

Rules:
- Return ONLY the complete fixed code, nothing else
- Do NOT add markdown fences or explanations
- Do NOT remove existing functionality
- Only fix real issues

File: ${filePath}
\`\`\`${language}
${originalCode}
\`\`\``;

  const messages: Message[] = [
    ...conversationHistory.slice(-10), // Last 5 exchanges for context
    { role: "user", content: fixPrompt },
  ];

  const response = await chat(messages, model, {
    temperature: 0.1,
    num_predict: 4096,
  });

  let fixedCode = stripMarkdownFences(response);

  if (fixedCode === originalCode.trim()) {
    console.log(chalk.green("  No issues found. Code looks good!\n"));
    return;
  }

  printDiff(originalCode, fixedCode + "\n", path.relative(process.cwd(), absPath));

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const answer = await new Promise<string>((resolve) => {
    rl.question(chalk.cyan("\n  Apply fixes? (y/n) "), resolve);
  });
  rl.close();

  if (answer.toLowerCase() === "y" || answer.toLowerCase() === "yes") {
    const backupPath = absPath + ".bak";
    await fs.writeFile(backupPath, originalCode, "utf-8");
    await fs.writeFile(absPath, fixedCode + "\n", "utf-8");
    console.log(chalk.green(`\n  Fixed! Backup saved to ${path.basename(backupPath)}\n`));
  } else {
    console.log(chalk.dim("\n  Fix cancelled.\n"));
  }
}
