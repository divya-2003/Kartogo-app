// Server-only Lovable AI helper for structured, one-shot results.
// Streams the Responses call and consumes the final object on the server.
import { createOpenAI } from "@ai-sdk/openai";
import { NoObjectGeneratedError, Output, streamText } from "ai";
import type { z } from "zod";
import { createLovableAiGatewayRunIdFetch } from "./ai-run-id.server";

const GATEWAY_URL = "https://ai.gateway.lovable.dev/v1";
export const DEFAULT_AI_MODEL = "openai/gpt-6-astra";

export class AiGatewayError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

function statusOf(e: unknown): number {
  const s = (e as { statusCode?: number; status?: number })?.statusCode ?? (e as { status?: number })?.status;
  return typeof s === "number" ? s : 500;
}

function friendly(status: number): string {
  if (status === 402) return "Lovable AI credits have run out. Add credits in Settings → Plans & credits.";
  if (status === 403) return "Lovable AI is not available for this workspace right now.";
  if (status === 429) return "Lovable AI is busy right now. Please try again in a minute.";
  return "Lovable AI could not answer right now.";
}

/** One structured AI answer. Throws AiGatewayError with the gateway status on failure. */
export async function aiObject<T>(opts: {
  instructions: string;
  prompt: string;
  schema: z.ZodType<T>;
  effort?: "low" | "medium";
}): Promise<T> {
  const apiKey = process.env["LOVABLE_API_KEY"];
  if (!apiKey) throw new AiGatewayError("Lovable AI is not configured for this project yet.", 401);
  const runIdFetch = createLovableAiGatewayRunIdFetch();
  const provider = createOpenAI({
    baseURL: GATEWAY_URL,
    apiKey,
    headers: { "Lovable-API-Key": apiKey, "X-Lovable-AIG-SDK": "vercel-ai-sdk" },
    fetch: runIdFetch.fetch,
  });
  let streamError: unknown = null;
  const result = streamText({
    model: provider.responses(DEFAULT_AI_MODEL),
    instructions: opts.instructions,
    messages: [{ role: "user", content: opts.prompt }],
    output: Output.object({ schema: opts.schema }),
    onError: ({ error }) => { streamError = error; },
    providerOptions: {
      openai: {
        forceReasoning: true,
        reasoningEffort: opts.effort ?? "low",
        reasoningSummary: "auto",
        store: false,
        include: ["reasoning.encrypted_content"],
      },
    },
  });
  try {
    return (await result.output) as T;
  } catch (e) {
    const err = streamError ?? e;
    if (NoObjectGeneratedError.isInstance(err)) throw new AiGatewayError("Lovable AI returned an unexpected answer.", 422);
    const status = statusOf(err);
    console.error(`[ai] request failed [${status}]`, err instanceof Error ? err.message : err);
    throw new AiGatewayError(friendly(status), status);
  }
}
