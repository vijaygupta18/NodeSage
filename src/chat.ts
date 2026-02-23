import * as readline from "readline";
import chalk from "chalk";
import { retrieveContext, formatContext } from "./retriever.js";
import { chatStream, type Message } from "./llm.js";
import { fixFileInteractive } from "./fixer.js";
import { printChatWelcome, createSpinner, StreamRenderer } from "./reporter.js";
import { loadConfig } from "./config.js";
import type { RetrievedContext } from "./types.js";

const SYSTEM_PROMPT = `You are NodeSage, an AI assistant that deeply understands codebases. You have been trained on a codebase and have access to its source code and best practices.

When answering questions:
- Reference specific files, functions, and line numbers when relevant
- Explain code clearly and concisely
- Suggest improvements when appropriate
- If asked to fix code, explain what you would change and why
- Use markdown formatting: code blocks with language tags, bold for emphasis, bullet points for lists
- Be direct and avoid unnecessary verbosity`;

export async function startChat(options: { model?: string }): Promise<void> {
  const config = await loadConfig();
  let model = options.model ?? config.chatModel;

  printChatWelcome();
  console.log(
    chalk.dim("  Model: ") + chalk.cyan(model) + "\n"
  );

  const conversationHistory: Message[] = [];
  let lastContext: RetrievedContext[] = [];
  let turnCount = 0;

  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  const prompt = (): Promise<string> =>
    new Promise((resolve) => {
      rl.question(chalk.bold.cyan("\n  > "), (answer) => {
        resolve(answer);
      });
    });

  while (true) {
    let input: string;
    try {
      input = await prompt();
    } catch {
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
          console.log(
            chalk.dim("\n  ──────────────────────────────────────")
          );
          console.log(chalk.dim(`  Session ended. ${turnCount} exchanges.\n`));
          rl.close();
          return;

        case "/help":
          console.log();
          console.log(chalk.dim("  ──────────────────────────────────────"));
          console.log(chalk.bold.white("  Available Commands"));
          console.log();
          console.log(
            chalk.dim("    ") + chalk.cyan("/fix <file>") + chalk.dim("      Fix a specific file")
          );
          console.log(
            chalk.dim("    ") + chalk.cyan("/model [name]") + chalk.dim("    Switch or show current model")
          );
          console.log(
            chalk.dim("    ") + chalk.cyan("/clear") + chalk.dim("           Clear conversation history")
          );
          console.log(
            chalk.dim("    ") + chalk.cyan("/context") + chalk.dim("         Show last retrieved context")
          );
          console.log(
            chalk.dim("    ") + chalk.cyan("/help") + chalk.dim("            Show this help")
          );
          console.log(
            chalk.dim("    ") + chalk.cyan("/quit") + chalk.dim("            Exit chat")
          );
          console.log(chalk.dim("  ──────────────────────────────────────"));
          continue;

        case "/clear":
          conversationHistory.length = 0;
          lastContext = [];
          turnCount = 0;
          console.log(chalk.dim("\n  Conversation cleared.\n"));
          continue;

        case "/model":
          if (args.length === 0) {
            console.log(chalk.dim("\n  Current model: ") + chalk.cyan(model));
            console.log(chalk.dim("  Usage: /model <name>  (e.g. /model llama3.1:8b)\n"));
          } else {
            model = args[0];
            console.log(chalk.green("\n  Switched to ") + chalk.cyan(model) + "\n");
          }
          continue;

        case "/context":
          if (lastContext.length === 0) {
            console.log(chalk.dim("\n  No context retrieved yet.\n"));
          } else {
            console.log();
            console.log(chalk.dim("  ──────────────────────────────────────"));
            console.log(chalk.bold.white(`  Retrieved Context (${lastContext.length} chunks)`));
            console.log();
            for (const ctx of lastContext) {
              const label = `${ctx.metadata.filePath} L${ctx.metadata.startLine}-${ctx.metadata.endLine}`;
              const score = ctx.score.toFixed(3);
              console.log(
                `  ${chalk.green("▸")} ${chalk.white(label)} ${chalk.dim(`(${score})`)}`
              );
            }
            console.log(chalk.dim("  ──────────────────────────────────────"));
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
      // Show spinner while retrieving and thinking
      const spinner = createSpinner("Searching codebase...");
      spinner.start();

      lastContext = await retrieveContext(trimmed, { topK: config.topK });
      const contextStr = formatContext(lastContext);

      spinner.update("Thinking...");

      // Build messages for LLM
      const messages: Message[] = [
        { role: "system", content: SYSTEM_PROMPT },
      ];

      const historySlice = conversationHistory.slice(-config.contextWindow);
      messages.push(...historySlice);

      if (contextStr) {
        messages.push({
          role: "system",
          content: `Here is relevant context from the codebase:\n\n${contextStr}`,
        });
      }
      messages.push({ role: "user", content: trimmed });

      // Stream response with real-time rendering
      let fullResponse = "";
      const renderer = new StreamRenderer();
      let firstToken = true;

      for await (const token of chatStream(messages, model)) {
        if (firstToken) {
          spinner.stop();
          console.log();
          firstToken = false;
        }
        fullResponse += token;
        renderer.write(token);
      }

      if (firstToken) {
        // No tokens received
        spinner.stop();
      }

      renderer.flush();
      console.log();

      // Save to history
      conversationHistory.push({ role: "user", content: trimmed });
      conversationHistory.push({ role: "assistant", content: fullResponse });
      turnCount++;
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      console.log(chalk.red(`\n  Error: ${message}\n`));
    }
  }

  rl.close();
}
