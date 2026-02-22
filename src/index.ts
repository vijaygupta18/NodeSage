#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { train } from "./trainer.js";
import { startChat } from "./chat.js";
import { fixFile } from "./fixer.js";
import { printHeader } from "./reporter.js";
import { isInitialized } from "./store.js";

function formatError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
    console.log(chalk.red("\n  Cannot connect to Ollama.\n"));
    console.log(chalk.dim("  Make sure Ollama is running:"));
    console.log(chalk.dim("    1. Install: https://ollama.com"));
    console.log(chalk.dim("    2. Start:   ollama serve"));
    console.log(
      chalk.dim(
        "    3. Pull:    ollama pull mistral && ollama pull nomic-embed-text\n"
      )
    );
  } else {
    console.log(chalk.red(`\n  Error: ${message}\n`));
  }
}

const program = new Command();

program
  .name("nodesage")
  .description("RAG-powered repo Q&A and code fixer — local, free, private")
  .version("2.0.0");

program
  .command("train [path]")
  .description("Index a codebase into the vector store")
  .option("-f, --force", "Re-index from scratch (ignore cache)")
  .option("-m, --model <model>", "Ollama model for embeddings", "mistral")
  .action(async (targetPath = ".", opts) => {
    try {
      printHeader();
      await train(targetPath, { force: opts.force });
    } catch (err) {
      formatError(err);
      process.exitCode = 1;
    }
  });

program
  .command("chat")
  .description("Start interactive Q&A session about your codebase")
  .option("-m, --model <model>", "Ollama model to use", "mistral")
  .action(async (opts) => {
    try {
      if (!(await isInitialized())) {
        console.log(
          chalk.red(
            '\n  Index not found. Run "nodesage train <path>" first.\n'
          )
        );
        process.exitCode = 1;
        return;
      }
      await startChat({ model: opts.model });
    } catch (err) {
      formatError(err);
      process.exitCode = 1;
    }
  });

program
  .command("fix <file>")
  .description("Review and auto-fix a source file")
  .option("-m, --model <model>", "Ollama model to use", "mistral")
  .action(async (filePath, opts) => {
    try {
      printHeader();
      if (!(await isInitialized())) {
        console.log(
          chalk.red(
            '\n  Index not found. Run "nodesage train <path>" first.\n'
          )
        );
        process.exitCode = 1;
        return;
      }
      await fixFile(filePath, { model: opts.model });
    } catch (err) {
      formatError(err);
      process.exitCode = 1;
    }
  });

await program.parseAsync();
