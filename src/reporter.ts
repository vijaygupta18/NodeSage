import chalk from "chalk";
import * as path from "path";

// ── Welcome & Headers ────────────────────────────────

export function printHeader(): void {
  console.log();
  console.log(chalk.bold.white("  NodeSage") + chalk.dim(" v2.0.0"));
  console.log(chalk.dim("  RAG-powered code Q&A — local, free, private"));
  console.log();
}

export function printChatWelcome(): void {
  console.log();
  console.log(chalk.bold.white("  NodeSage") + chalk.dim(" v2.0.0"));
  console.log(chalk.dim("  Ask anything about your trained codebase."));
  console.log(chalk.dim("  Type /help for commands, /quit to exit."));
  console.log();
}

// ── Progress ─────────────────────────────────────────

export function printProgress(
  current: number,
  total: number,
  label: string = "Processing"
): void {
  const pct = Math.round((current / total) * 100);
  const barLen = 25;
  const filled = Math.round((current / total) * barLen);
  const bar = chalk.cyan("━".repeat(filled)) + chalk.dim("━".repeat(barLen - filled));

  process.stdout.write(
    `\r  ${chalk.dim(label)} ${bar} ${chalk.dim(`${pct}% (${current}/${total})`)}`
  );

  if (current === total) {
    process.stdout.write("\n");
  }
}

export function printTrainSummary(stats: {
  files: number;
  codeChunks: number;
  knowledgeChunks: number;
  elapsed: number;
}): void {
  console.log();
  console.log(
    chalk.green("  ✓") +
      chalk.bold.white(" Training complete") +
      chalk.dim(
        `  ${stats.files} files · ${stats.codeChunks} chunks · ${(stats.elapsed / 1000).toFixed(1)}s`
      )
  );
  console.log();
  console.log(
    chalk.dim("  Run ") +
      chalk.white("nodesage chat") +
      chalk.dim(" to start asking questions.")
  );
  console.log();
}

// ── Diff ─────────────────────────────────────────────

export function printDiff(
  original: string,
  fixed: string,
  filePath: string
): void {
  const originalLines = original.split("\n");
  const fixedLines = fixed.split("\n");

  const maxLines = Math.max(originalLines.length, fixedLines.length);
  let diffCount = 0;
  const contextLines = 2;
  const changedLines: Set<number> = new Set();

  for (let i = 0; i < maxLines; i++) {
    const orig = originalLines[i] ?? "";
    const fix = fixedLines[i] ?? "";
    if (orig !== fix) {
      changedLines.add(i);
      for (
        let c = Math.max(0, i - contextLines);
        c <= Math.min(maxLines - 1, i + contextLines);
        c++
      ) {
        changedLines.add(c);
      }
    }
  }

  if (changedLines.size === 0) {
    console.log(chalk.dim("  No changes detected."));
    return;
  }

  console.log(chalk.bold.white(`\n  ${filePath}`));

  let lastPrinted = -2;
  const sortedLines = [...changedLines].sort((a, b) => a - b);

  for (const i of sortedLines) {
    if (i > lastPrinted + 1) {
      console.log(chalk.dim("    ···"));
    }
    lastPrinted = i;

    const orig = originalLines[i] ?? "";
    const fix = fixedLines[i] ?? "";
    const lineNum = String(i + 1).padStart(4);

    if (orig !== fix) {
      diffCount++;
      if (orig) console.log(chalk.red(`  ${lineNum} - ${orig}`));
      if (fix) console.log(chalk.green(`  ${lineNum} + ${fix}`));
    } else {
      console.log(chalk.dim(`  ${lineNum}   ${orig}`));
    }
  }

  console.log(chalk.dim(`\n  ${diffCount} line(s) changed`));
}

// ── Spinner ──────────────────────────────────────────

const SPINNER_FRAMES = ["⠋", "⠙", "⠹", "⠸", "⠼", "⠴", "⠦", "⠧", "⠇", "⠏"];

export function createSpinner(label: string): {
  start: () => void;
  stop: () => void;
  update: (newLabel: string) => void;
} {
  let frame = 0;
  let interval: ReturnType<typeof setInterval> | null = null;
  let currentLabel = label;

  return {
    start() {
      interval = setInterval(() => {
        const spinner = chalk.cyan(SPINNER_FRAMES[frame % SPINNER_FRAMES.length]);
        process.stdout.write(
          `\r  ${spinner} ${chalk.dim(currentLabel)}` + " ".repeat(20)
        );
        frame++;
      }, 80);
    },
    update(newLabel: string) {
      currentLabel = newLabel;
    },
    stop() {
      if (interval) {
        clearInterval(interval);
        process.stdout.write("\r" + " ".repeat(80) + "\r");
      }
    },
  };
}

// ── Streaming Markdown Renderer ──────────────────────

export class StreamRenderer {
  private inCodeBlock = false;
  private codeBlockLang = "";
  private lineBuffer = "";
  private firstLine = true;

  writeLine(line: string): void {
    // Code block toggle
    if (line.trim().startsWith("```")) {
      if (!this.inCodeBlock) {
        this.inCodeBlock = true;
        this.codeBlockLang = line.trim().slice(3).trim();
        const label = this.codeBlockLang || "code";
        console.log(
          chalk.dim("  ┌ ") + chalk.dim.italic(label)
        );
      } else {
        this.inCodeBlock = false;
        this.codeBlockLang = "";
        console.log(chalk.dim("  └"));
      }
      return;
    }

    if (this.inCodeBlock) {
      console.log(chalk.dim("  │ ") + chalk.green(line));
      return;
    }

    // Headers
    if (line.startsWith("### ")) {
      if (!this.firstLine) console.log();
      console.log(chalk.bold.white("  " + line.slice(4)));
      return;
    }
    if (line.startsWith("## ")) {
      if (!this.firstLine) console.log();
      console.log(chalk.bold.cyan("  " + line.slice(3)));
      return;
    }
    if (line.startsWith("# ")) {
      if (!this.firstLine) console.log();
      console.log(chalk.bold.cyan("  " + line.slice(2)));
      return;
    }

    // Bullet points
    const bulletMatch = line.match(/^(\s*)[-*]\s+(.*)/);
    if (bulletMatch) {
      console.log(
        `  ${bulletMatch[1]}${chalk.cyan("•")} ${formatInline(bulletMatch[2])}`
      );
      return;
    }

    // Numbered lists
    const numMatch = line.match(/^(\s*)(\d+\.)\s+(.*)/);
    if (numMatch) {
      console.log(
        `  ${numMatch[1]}${chalk.cyan(numMatch[2])} ${formatInline(numMatch[3])}`
      );
      return;
    }

    // Empty line
    if (line.trim() === "") {
      console.log();
      return;
    }

    // Regular text
    console.log("  " + formatInline(line));
    this.firstLine = false;
  }

  // Feed raw streamed tokens and render complete lines
  write(token: string): void {
    this.lineBuffer += token;

    // Process complete lines
    while (this.lineBuffer.includes("\n")) {
      const newlineIdx = this.lineBuffer.indexOf("\n");
      const line = this.lineBuffer.slice(0, newlineIdx);
      this.lineBuffer = this.lineBuffer.slice(newlineIdx + 1);
      this.writeLine(line);
    }
  }

  // Flush remaining buffer
  flush(): void {
    if (this.lineBuffer.trim()) {
      this.writeLine(this.lineBuffer);
    }
    this.lineBuffer = "";

    // Close unclosed code block
    if (this.inCodeBlock) {
      console.log(chalk.dim("  └"));
      this.inCodeBlock = false;
    }
  }
}

// ── Inline Markdown Formatting ───────────────────────

function formatInline(text: string): string {
  // Inline code `...`
  text = text.replace(/`([^`]+)`/g, (_m, code: string) => chalk.yellow(code));
  // Bold **...**
  text = text.replace(/\*\*([^*]+)\*\*/g, (_m, b: string) => chalk.bold.white(b));
  // Italic *...*
  text = text.replace(/(?<!\*)\*([^*]+)\*(?!\*)/g, (_m, i: string) => chalk.italic(i));
  // File paths
  text = text.replace(
    /(\S+\.(ts|js|py|go|rs|hs|java|rb|php|c|cpp|h|swift|kt|scala|sh|ex|erl))\b/g,
    (_m, fp: string) => chalk.underline.cyan(fp)
  );
  return text;
}

// ── Utility ──────────────────────────────────────────

export function wrapText(text: string, maxWidth: number): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    if (current.length + word.length + 1 > maxWidth) {
      lines.push(current);
      current = word;
    } else {
      current = current ? current + " " + word : word;
    }
  }
  if (current) lines.push(current);

  return lines;
}
