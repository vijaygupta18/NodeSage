import { Ollama } from "ollama";
import type { Message } from "ollama";

const ollama = new Ollama();
const DEFAULT_MODEL = "mistral";

export type { Message };

export async function chat(
  messages: Message[],
  model: string = DEFAULT_MODEL,
  options?: { temperature?: number; num_predict?: number }
): Promise<string> {
  const response = await ollama.chat({
    model,
    messages,
    options: {
      temperature: options?.temperature ?? 0.3,
      num_predict: options?.num_predict ?? 4096,
    },
  });
  return response.message.content;
}

export async function* chatStream(
  messages: Message[],
  model: string = DEFAULT_MODEL,
  options?: { temperature?: number; num_predict?: number }
): AsyncGenerator<string, void, unknown> {
  const response = await ollama.chat({
    model,
    messages,
    stream: true,
    options: {
      temperature: options?.temperature ?? 0.3,
      num_predict: options?.num_predict ?? 4096,
    },
  });

  for await (const chunk of response) {
    if (chunk.message.content) {
      yield chunk.message.content;
    }
  }
}
