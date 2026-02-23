#!/usr/bin/env node

import { Command } from "commander";
import chalk from "chalk";
import { train } from "./trainer.js";
import { startChat } from "./chat.js";
import { fixFile } from "./fixer.js";
import { printHeader } from "./reporter.js";
import { isInitialized } from "./store.js";
import { loadConfig, saveConfig, getDefaults, CONFIG_KEYS, type NodesageConfig } from "./config.js";

function formatError(err: unknown): void {
  const message = err instanceof Error ? err.message : String(err);

  if (message.includes("ECONNREFUSED") || message.includes("fetch failed")) {
    console.log(chalk.red("\n  Cannot connect to Ollama.\n"));
    console.log(chalk.dim("  Make sure Ollama is running:"));
    console.log(chalk.dim("    1. Install: https://ollama.com"));
    console.log(chalk.dim("    2. Start:   ollama serve"));
    console.log(
      chalk.dim(
        "    3. Pull:    ollama pull <model> && ollama pull <embed-model>\n"
      )
    );
    console.log(chalk.dim("  Check your models with: nodesage config\n"));
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
  .option("-m, --model <model>", "Ollama embedding model override")
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
  .option("-m, --model <model>", "Ollama chat model override")
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
  .option("-m, --model <model>", "Ollama chat model override")
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

program
  .command("config [key] [value]")
  .description("View or set configuration (stored at ~/.nodesage/config.json)")
  .option("-r, --reset [key]", "Reset a key to default (or all if no key given)")
  .action(async (key?: string, value?: string, opts?: { reset?: string | boolean }) => {
    try {
      const config = await loadConfig();
      const defaults = getDefaults();

      // Reset
      if (opts?.reset !== undefined) {
        if (typeof opts.reset === "string" && CONFIG_KEYS.includes(opts.reset as keyof NodesageConfig)) {
          await saveConfig({ [opts.reset]: defaults[opts.reset as keyof NodesageConfig] });
          console.log(chalk.green(`\n  Reset ${opts.reset} to default: ${defaults[opts.reset as keyof NodesageConfig]}\n`));
        } else {
          await saveConfig(defaults);
          console.log(chalk.green("\n  Reset all config to defaults.\n"));
        }
        return;
      }

      // Set a value
      if (key && value) {
        if (!CONFIG_KEYS.includes(key as keyof NodesageConfig)) {
          console.log(chalk.red(`\n  Unknown config key: ${key}`));
          console.log(chalk.dim(`  Available keys: ${CONFIG_KEYS.join(", ")}\n`));
          process.exitCode = 1;
          return;
        }

        // Parse numeric values
        let parsed: string | number = value;
        const numVal = Number(value);
        if (!isNaN(numVal) && typeof defaults[key as keyof NodesageConfig] === "number") {
          parsed = numVal;
        }

        await saveConfig({ [key]: parsed });
        console.log(chalk.green(`\n  Set ${key} = ${parsed}\n`));
        return;
      }

      // Show single key
      if (key) {
        if (!CONFIG_KEYS.includes(key as keyof NodesageConfig)) {
          console.log(chalk.red(`\n  Unknown config key: ${key}`));
          console.log(chalk.dim(`  Available keys: ${CONFIG_KEYS.join(", ")}\n`));
          process.exitCode = 1;
          return;
        }
        const val = config[key as keyof NodesageConfig];
        const def = defaults[key as keyof NodesageConfig];
        const isDefault = val === def;
        console.log(`\n  ${chalk.cyan(key)} = ${chalk.white(String(val))}${isDefault ? chalk.dim(" (default)") : ""}\n`);
        return;
      }

      // Show all config
      console.log();
      console.log(chalk.bold.white("  NodeSage Configuration"));
      console.log(chalk.dim("  ~/.nodesage/config.json"));
      console.log();

      const maxKeyLen = Math.max(...CONFIG_KEYS.map((k) => k.length));
      for (const k of CONFIG_KEYS) {
        const val = config[k];
        const def = defaults[k];
        const isDefault = val === def;
        const padding = " ".repeat(maxKeyLen - k.length);
        console.log(
          `  ${chalk.cyan(k)}${padding}  ${chalk.white(String(val))}${isDefault ? chalk.dim(" (default)") : chalk.yellow(" (custom)")}`
        );
      }

      console.log();
      console.log(chalk.dim("  Set:   nodesage config <key> <value>"));
      console.log(chalk.dim("  Reset: nodesage config --reset [key]"));
      console.log(chalk.dim("  Env:   NODESAGE_CHAT_MODEL, NODESAGE_EMBED_MODEL, ..."));
      console.log();
    } catch (err) {
      formatError(err);
      process.exitCode = 1;
    }
  });

await program.parseAsync();
