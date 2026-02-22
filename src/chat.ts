import * as readline from "readline";
import chalk from "chalk";
import { retrieveContext, formatContext } from "./retriever.js";
import { chatStream, type Message } from "./llm.js";
import { fixFileInteractive } from "./fixer.js";
import { printChatWelcome } from "./reporter.js";
import type { RetrievedContext } from "./types.js";

const MAX_HISTORY = 20; // messages (10 exchanges)

const SYSTEM_PROMPT = `You are NodeSage, an AI assistant that deeply understands codebases. You have been trained on a codebase and have access to its source code and best practices.

When answering questions:
- Reference specific files, functions, and line numbers when relevant
- Explain code clearly and concisely
- Suggest improvements when appropriate
- If asked to fix code, explain what you would change and why
- Be direct and avoid unnecessary verbosity`;

export async function startChat(options: { model?: string }): Promise<void> {
  const model = options.model ?? "mistral";

  printChatWelcome();
  console.log(chalk.dim(`  Model: ${model}\n`));

  const conversationHistory: Message[] = [];
  let lastContext: RetrievedContext[] = [];

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): Promise<string> =>
    new Promise((resolve) => {
      rl.question(chalk.cyan("  nodesage> "), (answer) => {
        resolve(answer);
      });
    });

  while (true) {
    let input: string;
    try {
      input = await prompt();
    } catch {
      // EOF or closed
      break;
    }

    const trimmed = input.trim();
    if (!trimmed) continue;

    // Handle slash commands
    if (trimmed.startsWith("/")) {
      const [cmd, ...args] = trimmed.split(/\s+/);

      switch (cmd) {
        case "/quit":
        case "/exit":
          console.log(chalk.dim("\n  Goodbye!\n"));
          rl.close();
          return;

        case "/help":
          console.log();
          console.log(chalk.dim("  Commands:"));
          console.log(chalk.dim("    /fix <file>  - Fix a specific file"));
          console.log(chalk.dim("    /clear       - Clear conversation history"));
          console.log(chalk.dim("    /context     - Show last retrieved context"));
          console.log(chalk.dim("    /help        - Show this help"));
          console.log(chalk.dim("    /quit        - Exit chat"));
          console.log();
          continue;

        case "/clear":
          conversationHistory.length = 0;
          lastContext = [];
          console.log(chalk.dim("\n  Conversation cleared.\n"));
          continue;

        case "/context":
          if (lastContext.length === 0) {
            console.log(chalk.dim("\n  No context retrieved yet.\n"));
          } else {
            console.log(chalk.dim("\n  Last retrieved context:"));
            for (const ctx of lastContext) {
              const label =
                ctx.metadata.type === "code"
                  ? `${ctx.metadata.filePath} L${ctx.metadata.startLine}-${ctx.metadata.endLine}`
                  : `${ctx.metadata.source} - ${ctx.metadata.section}`;
              console.log(
                chalk.dim(`    [${ctx.metadata.type}] `) +
                  chalk.white(label) +
                  chalk.dim(` (score: ${ctx.score.toFixed(3)})`)
              );
            }
            console.log();
          }
          continue;

        case "/fix":
          if (args.length === 0) {
            console.log(chalk.yellow("\n  Usage: /fix <file>\n"));
          } else {
            await fixFileInteractive(
              args.join(" "),
              conversationHistory,
              model
            );
          }
          continue;

        default:
          console.log(
            chalk.yellow(`\n  Unknown command: ${cmd}. Type /help for commands.\n`)
          );
          continue;
      }
    }

    // Normal question: retrieve context and stream response
    try {
      lastContext = await retrieveContext(trimmed, { topK: 8, type: "both" });
      const contextStr = formatContext(lastContext);

      // Build messages for LLM
      const messages: Message[] = [
        { role: "system", content: SYSTEM_PROMPT },
      ];

      // Add conversation history (sliding window)
      const historySlice = conversationHistory.slice(-MAX_HISTORY);
      messages.push(...historySlice);

      // Add context + user question
      if (contextStr) {
        messages.push({
          role: "system",
          content: `Here is relevant context from the codebase:\n\n${contextStr}`,
        });
      }
      messages.push({ role: "user", content: trimmed });

      // Stream response
      process.stdout.write(chalk.dim("\n  "));
      let fullResponse = "";

      for await (const token of chatStream(messages, model)) {
        process.stdout.write(token);
        fullResponse += token;
      }
      process.stdout.write("\n\n");

      // Save to history
      conversationHistory.push({ role: "user", content: trimmed });
      conversationHistory.push({ role: "assistant", content: fullResponse });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`\n  Error: ${message}\n`));
    }
  }

  rl.close();
}
