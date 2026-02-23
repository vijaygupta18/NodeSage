import { Ollama } from "ollama";
import type { Message } from "ollama";
import { loadConfig } from "./config.js";

const ollama = new Ollama();

export type { Message };

export async function chat(
  messages: Message[],
  model?: string,
  options?: { temperature?: number; num_predict?: number }
): Promise<string> {
  const config = await loadConfig();
  const response = await ollama.chat({
    model: model ?? config.chatModel,
    messages,
    options: {
      temperature: options?.temperature ?? config.temperature,
      num_predict: options?.num_predict ?? config.maxTokens,
    },
  });
  return response.message.content;
}

export async function* chatStream(
  messages: Message[],
  model?: string,
  options?: { temperature?: number; num_predict?: number }
): AsyncGenerator<string, void, unknown> {
  const config = await loadConfig();
  const response = await ollama.chat({
    model: model ?? config.chatModel,
    messages,
    stream: true,
    options: {
      temperature: options?.temperature ?? config.temperature,
      num_predict: options?.num_predict ?? config.maxTokens,
    },
  });

  for await (const chunk of response) {
    if (chunk.message.content) {
      yield chunk.message.content;
    }
  }
}
