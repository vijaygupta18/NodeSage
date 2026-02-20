#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import * as path from "path";
import { fileURLToPath } from "url";
import * as fs from "fs/promises";
import { loadKnowledgeBase } from "./knowledge/loader.js";
import {
  createIndex,
  deleteIndex,
  addItems,
  isInitialized,
} from "./knowledge/store.js";
import { embedText } from "./rag.js";
import { parseFiles } from "./parser.js";
import { reviewChunks } from "./reviewer.js";
import {
  printHeader,
  printResults,
  printProgress,
  printInitProgress,
} from "./reporter.js";
import { fixFile, applyFix, printDiff } from "./fixer.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

function formatError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
    console.log(chalk.red("\n  ❌ Cannot connect to Ollama.\n"));
    console.log(chalk.dim("  Make sure Ollama is running:"));
    console.log(chalk.dim("    1. Install: https://ollama.com"));
    console.log(chalk.dim("    2. Start:   ollama serve"));
    console.log(chalk.dim("    3. Pull:    ollama pull mistral && ollama pull nomic-embed-text\n"));
  } else {
    console.log(chalk.red(`\n  ❌ Error: ${message}\n`));
  }
}

async function initAction(opts: { force?: boolean }): Promise<void> {
  printHeader();

  if ((await isInitialized()) && !opts.force) {
    console.log(
      chalk.yellow(
        "  Knowledge base already initialized. Use --force to re-initialize."
      )
    );
    return;
  }

  console.log(chalk.cyan("  Setting up NodeSage knowledge base...\n"));

  if (opts.force) {
    await deleteIndex();
  }

  await createIndex();

  const knowledgeDir = path.resolve(__dirname, "..", "knowledge-base");
  console.log(chalk.dim(`  Loading knowledge from ${knowledgeDir}\n`));

  const items = await loadKnowledgeBase(knowledgeDir);
  console.log(chalk.dim(`  Found ${items.length} knowledge chunks\n`));

  let embedded = 0;
  const embedFn = async (text: string): Promise<number[]> => {
    const vector = await embedText(text);
    embedded++;
    printInitProgress(embedded, items.length);
    return vector;
  };

  await addItems(items, embedFn);

  console.log(
    chalk.green(
      `\n  ✅ Knowledge base initialized with ${items.length} chunks`
    )
  );
  console.log(chalk.dim("  Index stored in .nodesage/index/\n"));
  console.log(chalk.cyan('  Run "nodesage review <path>" to review code\n'));
}

async function reviewAction(
  targetPath: string,
  opts: { model: string }
): Promise<void> {
  printHeader();

  if (!(await isInitialized())) {
    console.log(
      chalk.red(
        '  ❌ Knowledge base not initialized. Run "nodesage init" first.\n'
      )
    );
    process.exitCode = 1;
    return;
  }

  const absPath = path.resolve(targetPath);
  console.log(chalk.dim(`  Target: ${absPath}`));
  console.log(chalk.dim(`  Model:  ${opts.model}\n`));

  const chunks = await parseFiles(targetPath);
  console.log(
    chalk.dim(
      `  Found ${chunks.length} code chunk${chunks.length !== 1 ? "s" : ""} to review\n`
    )
  );

  const results = await reviewChunks(chunks, opts.model, printProgress);
  printResults(results, process.cwd());
}

async function addAction(filePath: string): Promise<void> {
  printHeader();

  if (!(await isInitialized())) {
    console.log(
      chalk.red(
        '  ❌ Knowledge base not initialized. Run "nodesage init" first.\n'
      )
    );
    process.exitCode = 1;
    return;
  }

  const absPath = path.resolve(filePath);
  const stat = await fs.stat(absPath);
  if (!stat.isFile() || !absPath.endsWith(".md")) {
    console.log(chalk.red("  ❌ Please provide a markdown (.md) file.\n"));
    process.exitCode = 1;
    return;
  }

  console.log(
    chalk.cyan(
      `  Adding custom knowledge from ${path.basename(absPath)}...\n`
    )
  );

  const { loadCustomFile } = await import("./knowledge/loader.js");
  const items = await loadCustomFile(absPath);

  let embedded = 0;
  const embedFn = async (text: string): Promise<number[]> => {
    const vector = await embedText(text);
    embedded++;
    printInitProgress(embedded, items.length);
    return vector;
  };

  await addItems(items, embedFn);

  console.log(
    chalk.green(
      `\n  ✅ Added ${items.length} chunks from ${path.basename(absPath)}\n`
    )
  );
}

async function fixAction(
  targetPath: string,
  opts: { model: string }
): Promise<void> {
  printHeader();

  if (!(await isInitialized())) {
    console.log(
      chalk.red(
        '  ❌ Knowledge base not initialized. Run "nodesage init" first.\n'
      )
    );
    process.exitCode = 1;
    return;
  }

  const absPath = path.resolve(targetPath);
  console.log(chalk.dim(`  Target: ${absPath}`));
  console.log(chalk.dim(`  Model:  ${opts.model}\n`));

  // Step 1: Review
  console.log(chalk.cyan("  Step 1/3: Reviewing code...\n"));
  const chunks = await parseFiles(targetPath);
  const results = await reviewChunks(chunks, opts.model, printProgress);

  // Check if there are actionable findings
  const actionableResults = results.filter((r) =>
    r.findings.some((f) => f.severity === "CRITICAL" || f.severity === "WARNING")
  );

  if (actionableResults.length === 0) {
    console.log(chalk.green("\n  ✅ No issues to fix. Code looks good!\n"));
    return;
  }

  const totalIssues = actionableResults.reduce(
    (sum, r) =>
      sum +
      r.findings.filter(
        (f) => f.severity === "CRITICAL" || f.severity === "WARNING"
      ).length,
    0
  );
  console.log(
    chalk.cyan(
      `\n  Step 2/3: Generating fixes for ${totalIssues} issue(s) across ${actionableResults.length} file(s)...\n`
    )
  );

  // Step 2: Generate fixes
  const fixResults = [];
  for (let i = 0; i < actionableResults.length; i++) {
    const result = actionableResults[i];
    const relPath = path.relative(process.cwd(), result.filePath);
    process.stdout.write(
      `\r  ${chalk.cyan("Fixing")} ${chalk.dim(`(${i + 1}/${actionableResults.length})`)} ${relPath}`
    );

    const fixResult = await fixFile(result, opts.model);
    if (fixResult) {
      fixResults.push(fixResult);
    }
  }
  process.stdout.write("\n");

  if (fixResults.length === 0) {
    console.log(chalk.yellow("\n  ⚠️  No fixes could be generated.\n"));
    return;
  }

  // Step 3: Show diffs and apply
  console.log(chalk.cyan(`\n  Step 3/3: Applying fixes...\n`));
  console.log(chalk.dim("  ──────────────────────────────────────"));

  for (const fixResult of fixResults) {
    printDiff(fixResult);
    const backupPath = await applyFix(fixResult);
    console.log(chalk.dim(`    Backup: ${path.basename(backupPath)}`));
  }

  console.log(chalk.dim("\n  ──────────────────────────────────────"));
  console.log(
    chalk.green(
      `\n  ✅ Fixed ${fixResults.length} file(s). Backups saved as .bak files.`
    )
  );
  console.log(
    chalk.dim('  Run "nodesage review <path>" to verify the fixes.\n')
  );
}

const program = new Command();

program
  .name("nodesage")
  .description("RAG-powered Node.js code reviewer — local, free, private")
  .version("1.0.0");

program
  .command("init")
  .description("Initialize the knowledge base (run this first)")
  .option("-f, --force", "Re-initialize even if already set up")
  .action(async (opts) => {
    try {
      await initAction(opts);
    } catch (err) {
      formatError(err);
      process.exitCode = 1;
    }
  });

program
  .command("review <path>")
  .description("Review Node.js code files or directory")
  .option("-m, --model <model>", "Ollama model to use", "mistral")
  .action(async (targetPath, opts) => {
    try {
      await reviewAction(targetPath, opts);
    } catch (err) {
      formatError(err);
      process.exitCode = 1;
    }
  });

program
  .command("fix <path>")
  .description("Review and auto-fix Node.js code issues")
  .option("-m, --model <model>", "Ollama model to use", "mistral")
  .action(async (targetPath, opts) => {
    try {
      await fixAction(targetPath, opts);
    } catch (err) {
      formatError(err);
      process.exitCode = 1;
    }
  });

program
  .command("add <file>")
  .description("Add a custom knowledge base document")
  .action(async (filePath) => {
    try {
      await addAction(filePath);
    } catch (err) {
      formatError(err);
      process.exitCode = 1;
    }
  });

await program.parseAsync();
