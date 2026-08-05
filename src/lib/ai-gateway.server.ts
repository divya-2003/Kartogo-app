// Server-only Lovable AI Gateway provider. Never import from client code.
import { createOpenAICompatible } from "@ai-sdk/openai-compatible";

export function createLovableAiGatewayProvider(apiKey: string) {
  return createOpenAICompatible({
    name: "lovable-ai-gateway",
    baseURL: "https://ai.gateway.lovable.dev/v1",
    headers: { "Lovable-API-Key": apiKey },
  });
}

export function requireAiKey(): string {
  const key = process.env.LOVABLE_API_KEY;
  if (!key) throw new Error("AI is not configured for this project yet.");
  return key;
}
