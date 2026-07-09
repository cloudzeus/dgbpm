/**
 * DeepSeek client (OpenAI-compatible chat completions API).
 * Χρησιμοποιείται server-side μόνο — απαιτεί DEEPSEEK_API_KEY στο περιβάλλον.
 */

const DEEPSEEK_BASE_URL = process.env.DEEPSEEK_BASE_URL ?? "https://api.deepseek.com";
const DEEPSEEK_MODEL = process.env.DEEPSEEK_MODEL ?? "deepseek-chat";

export class DeepSeekError extends Error {}

type ChatMessage = { role: "system" | "user" | "assistant"; content: string };

export async function deepseekChat(
  messages: ChatMessage[],
  opts: { temperature?: number; maxTokens?: number } = {},
): Promise<string> {
  const apiKey = process.env.DEEPSEEK_API_KEY;
  if (!apiKey) {
    throw new DeepSeekError("Δεν έχει ρυθμιστεί το DEEPSEEK_API_KEY.");
  }

  const res = await fetch(`${DEEPSEEK_BASE_URL}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model: DEEPSEEK_MODEL,
      messages,
      temperature: opts.temperature ?? 0.5,
      max_tokens: opts.maxTokens ?? 1200,
      stream: false,
    }),
    cache: "no-store",
  });

  if (!res.ok) {
    const detail = await res.text().catch(() => "");
    throw new DeepSeekError(`DeepSeek API σφάλμα (${res.status}). ${detail.slice(0, 300)}`);
  }

  const data = await res.json();
  const content = data?.choices?.[0]?.message?.content;
  if (typeof content !== "string" || !content.trim()) {
    throw new DeepSeekError("Το DeepSeek δεν επέστρεψε περιεχόμενο.");
  }
  return content.trim();
}
