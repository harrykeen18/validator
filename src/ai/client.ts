import Anthropic from "@anthropic-ai/sdk";
import { loadConfig } from "../config.js";

let client: Anthropic | null = null;

export function getAiClient(): Anthropic {
  if (!client) {
    const config = loadConfig();
    if (!config.anthropicApiKey) {
      throw new Error("ANTHROPIC_API_KEY environment variable is required for AI-powered features");
    }
    client = new Anthropic({ apiKey: config.anthropicApiKey });
  }
  return client;
}

export type AiModel = "claude-sonnet-4-6" | "claude-opus-4-6";

export async function generateText(
  model: AiModel,
  systemPrompt: string,
  userMessage: string,
  maxTokens = 2048
): Promise<string> {
  const ai = getAiClient();
  const response = await ai.messages.create({
    model,
    max_tokens: maxTokens,
    system: systemPrompt,
    messages: [{ role: "user", content: userMessage }],
  });
  const textBlock = response.content.find((b) => b.type === "text");
  return textBlock ? textBlock.text : "";
}
