import { Ollama } from "ollama";

const ollama = new Ollama();
const EMBED_MODEL = "nomic-embed-text";
const BATCH_SIZE = 20;

export async function embedText(text: string): Promise<number[]> {
  const response = await ollama.embed({
    model: EMBED_MODEL,
    input: text,
  });
  return response.embeddings[0];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const allEmbeddings: number[][] = [];

  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    const batch = texts.slice(i, i + BATCH_SIZE);
    const response = await ollama.embed({
      model: EMBED_MODEL,
      input: batch,
    });
    allEmbeddings.push(...response.embeddings);
  }

  return allEmbeddings;
}
