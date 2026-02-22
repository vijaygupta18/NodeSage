import chalk from "chalk";

export function printHeader(): void {
  console.log();
  console.log(
    chalk.bold.cyan("  ╔══════════════════════════════════════╗")
  );
  console.log(
    chalk.bold.cyan("  ║") +
      chalk.bold.white("     NodeSage                          ") +
      chalk.bold.cyan("║")
  );
  console.log(
    chalk.bold.cyan("  ║") +
      chalk.dim("     RAG-powered • Local • Free        ") +
      chalk.bold.cyan("║")
  );
  console.log(
    chalk.bold.cyan("  ╚══════════════════════════════════════╝")
  );
  console.log();
}

export function printChatWelcome(): void {
  console.log();
  console.log(
    chalk.bold.cyan("  ╔══════════════════════════════════════╗")
  );
  console.log(
    chalk.bold.cyan("  ║") +
      chalk.bold.white("     NodeSage Chat                     ") +
      chalk.bold.cyan("║")
  );
  console.log(
    chalk.bold.cyan("  ║") +
      chalk.dim("     Ask anything about your code      ") +
      chalk.bold.cyan("║")
  );
  console.log(
    chalk.bold.cyan("  ╚══════════════════════════════════════╝")
  );
  console.log();
  console.log(chalk.dim("  Commands:"));
  console.log(chalk.dim("    /fix <file>  - Fix a specific file"));
  console.log(chalk.dim("    /clear       - Clear conversation history"));
  console.log(chalk.dim("    /context     - Show last retrieved context"));
  console.log(chalk.dim("    /help        - Show this help"));
  console.log(chalk.dim("    /quit        - Exit chat"));
  console.log();
}

export function printProgress(
  current: number,
  total: number,
  label: string = "Processing"
): void {
  const pct = Math.round((current / total) * 100);
  const barLen = 25;
  const filled = Math.round((current / total) * barLen);
  const bar = "█".repeat(filled) + "░".repeat(barLen - filled);

  process.stdout.write(
    `\r  ${chalk.cyan(label)} ${bar} ${chalk.dim(`${pct}% (${current}/${total})`)}`
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
  console.log(chalk.bold.green("  Training complete!"));
  console.log(chalk.dim(`    ${stats.files} files indexed`));
  console.log(chalk.dim(`    ${stats.codeChunks} code chunks embedded`));
  if (stats.knowledgeChunks > 0) {
    console.log(
      chalk.dim(`    ${stats.knowledgeChunks} knowledge chunks embedded`)
    );
  }
  console.log(
    chalk.dim(`    ${(stats.elapsed / 1000).toFixed(1)}s elapsed`)
  );
  console.log();
  console.log(chalk.cyan('  Run "nodesage chat" to start asking questions'));
  console.log();
}

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
    console.log(chalk.dim("    No changes detected."));
    return;
  }

  console.log(chalk.bold.underline(`\n  ${filePath}`));
  console.log();

  let lastPrinted = -2;
  const sortedLines = [...changedLines].sort((a, b) => a - b);

  for (const i of sortedLines) {
    if (i > lastPrinted + 1) {
      console.log(chalk.dim("    ..."));
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

  console.log();
  console.log(chalk.dim(`    ${diffCount} line(s) changed`));
}

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
