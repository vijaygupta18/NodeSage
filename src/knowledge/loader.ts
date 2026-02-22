import * as fs from "fs/promises";
import * as path from "path";
export interface KnowledgeItem {
  text: string;
  source: string;
  section: string;
}

export async function loadKnowledgeBase(
  knowledgeDir: string
): Promise<KnowledgeItem[]> {
  const files = await fs.readdir(knowledgeDir);
  const mdFiles = files.filter((f) => f.endsWith(".md"));
  const items: KnowledgeItem[] = [];

  for (const file of mdFiles) {
    const filePath = path.join(knowledgeDir, file);
    const content = await fs.readFile(filePath, "utf-8");
    const chunks = chunkMarkdown(content, file);
    items.push(...chunks);
  }

  return items;
}

function chunkMarkdown(content: string, filename: string): KnowledgeItem[] {
  const items: KnowledgeItem[] = [];
  const sections = content.split(/\n## /);

  for (let i = 0; i < sections.length; i++) {
    let section = sections[i];
    if (i > 0) section = "## " + section;

    const sectionTitle = extractTitle(section);
    const paragraphs = splitIntoParagraphs(section);

    for (const para of paragraphs) {
      const trimmed = para.trim();
      if (trimmed.length < 30) continue;

      items.push({
        text: trimmed,
        source: filename,
        section: sectionTitle,
      });
    }
  }

  return items;
}

function extractTitle(section: string): string {
  const match = section.match(/^#{1,3}\s+(.+)$/m);
  return match ? match[1].trim() : "General";
}

function splitIntoParagraphs(section: string): string[] {
  const chunks: string[] = [];
  let current = "";
  const lines = section.split("\n");

  for (const line of lines) {
    if (line.startsWith("### ") && current.trim().length > 30) {
      chunks.push(current.trim());
      current = line + "\n";
    } else if (line.trim() === "" && current.trim().length > 200) {
      chunks.push(current.trim());
      current = "";
    } else {
      current += line + "\n";
    }
  }

  if (current.trim().length > 30) {
    chunks.push(current.trim());
  }

  return chunks;
}

export async function loadCustomFile(
  filePath: string
): Promise<KnowledgeItem[]> {
  const content = await fs.readFile(filePath, "utf-8");
  const filename = path.basename(filePath);
  return chunkMarkdown(content, filename);
}
