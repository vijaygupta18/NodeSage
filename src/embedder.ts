import { Ollama } from "ollama";
import { loadConfig } from "./config.js";

const ollama = new Ollama();
const BATCH_SIZE = 50;
const CONCURRENCY = 3;

export async function embedText(text: string): Promise<number[]> {
  const config = await loadConfig();
  const response = await ollama.embed({
    model: config.embedModel,
    input: text,
  });
  return response.embeddings[0];
}

export async function embedTexts(texts: string[]): Promise<number[][]> {
  const config = await loadConfig();
  const allEmbeddings: number[][] = new Array(texts.length);

  // Split into batches
  const batches: { texts: string[]; startIdx: number }[] = [];
  for (let i = 0; i < texts.length; i += BATCH_SIZE) {
    batches.push({
      texts: texts.slice(i, i + BATCH_SIZE),
      startIdx: i,
    });
  }

  // Process batches with concurrency
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const concurrentBatches = batches.slice(i, i + CONCURRENCY);
    const results = await Promise.all(
      concurrentBatches.map(async (batch) => {
        const response = await ollama.embed({
          model: config.embedModel,
          input: batch.texts,
        });
        return { embeddings: response.embeddings, startIdx: batch.startIdx };
      })
    );

    for (const result of results) {
      for (let j = 0; j < result.embeddings.length; j++) {
        allEmbeddings[result.startIdx + j] = result.embeddings[j];
      }
    }
  }

  return allEmbeddings;
}
