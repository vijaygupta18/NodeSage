import chalk from "chalk";
import * as path from "path";
import { ReviewResult, Finding } from "./reviewer.js";

const SEVERITY_ICON = {
  CRITICAL: chalk.red("●  CRITICAL"),
  WARNING: chalk.yellow("●  WARNING"),
  INFO: chalk.blue("●  INFO"),
  OK: chalk.green("●  OK"),
} as const;

const SEVERITY_ORDER: Record<string, number> = {
  CRITICAL: 0,
  WARNING: 1,
  INFO: 2,
  OK: 3,
};

export function printHeader(): void {
  console.log();
  console.log(
    chalk.bold.cyan("  ╔══════════════════════════════════════╗")
  );
  console.log(
    chalk.bold.cyan("  ║") +
      chalk.bold.white("     🌿 NodeSage Code Review          ") +
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

export function printResults(results: ReviewResult[], cwd: string): void {
  if (results.length === 0) {
    console.log(chalk.green("  No files to review."));
    return;
  }

  let totalCritical = 0;
  let totalWarning = 0;
  let totalInfo = 0;

  for (const result of results) {
    const relPath = path.relative(cwd, result.filePath);
    const sortedFindings = [...result.findings].sort(
      (a, b) =>
        (SEVERITY_ORDER[a.severity] ?? 3) - (SEVERITY_ORDER[b.severity] ?? 3)
    );

    const hasIssues = sortedFindings.some((f) => f.severity !== "OK");

    console.log(
      chalk.bold.underline(`\n  📄 ${relPath}`) +
        (hasIssues ? "" : chalk.green(" ✓"))
    );
    console.log();

    for (const finding of sortedFindings) {
      if (finding.severity === "OK") {
        console.log(`    ${SEVERITY_ICON.OK} ${chalk.green(finding.title)}`);
        continue;
      }

      if (finding.severity === "CRITICAL") totalCritical++;
      else if (finding.severity === "WARNING") totalWarning++;
      else totalInfo++;

      const icon = SEVERITY_ICON[finding.severity] || SEVERITY_ICON.INFO;
      const lineRange =
        finding.startLine === finding.endLine
          ? `L${finding.startLine}`
          : `L${finding.startLine}-${finding.endLine}`;

      console.log(`    ${icon}  ${chalk.bold(finding.title)} ${chalk.dim(`(${lineRange})`)}`);

      if (finding.description) {
        const wrapped = wrapText(finding.description, 70);
        for (const line of wrapped) {
          console.log(chalk.dim(`      ${line}`));
        }
      }

      if (finding.fix) {
        console.log(chalk.green(`      💡 Fix: `) + chalk.white(finding.fix));
      }

      console.log();
    }
  }

  printSummary(totalCritical, totalWarning, totalInfo);
}

function printSummary(
  critical: number,
  warning: number,
  info: number
): void {
  const total = critical + warning + info;

  console.log(chalk.dim("  ──────────────────────────────────────"));
  console.log(chalk.bold("\n  📊 Summary"));

  if (total === 0) {
    console.log(chalk.green("  ✅ No issues found. Code looks good!"));
  } else {
    if (critical > 0)
      console.log(chalk.red(`     ${critical} critical issue${critical !== 1 ? "s" : ""}`));
    if (warning > 0)
      console.log(chalk.yellow(`     ${warning} warning${warning !== 1 ? "s" : ""}`));
    if (info > 0)
      console.log(chalk.blue(`     ${info} info${info !== 1 ? "s" : ""}`));
    console.log(chalk.dim(`     ${total} total finding${total !== 1 ? "s" : ""}`));
  }

  console.log();
}

export function printProgress(current: number, total: number): void {
  const pct = Math.round((current / total) * 100);
  const barLen = 25;
  const filled = Math.round((current / total) * barLen);
  const bar = "█".repeat(filled) + "░".repeat(barLen - filled);

  process.stdout.write(
    `\r  ${chalk.cyan("Reviewing")} ${bar} ${chalk.dim(`${pct}% (${current}/${total} chunks)`)}`
  );

  if (current === total) {
    process.stdout.write("\n\n");
  }
}

export function printInitProgress(current: number, total: number): void {
  const pct = Math.round((current / total) * 100);
  const barLen = 25;
  const filled = Math.round((current / total) * barLen);
  const bar = "█".repeat(filled) + "░".repeat(barLen - filled);

  process.stdout.write(
    `\r  ${chalk.cyan("Embedding")} ${bar} ${chalk.dim(`${pct}% (${current}/${total} chunks)`)}`
  );

  if (current === total) {
    process.stdout.write("\n");
  }
}

function wrapText(text: string, maxWidth: number): string[] {
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
