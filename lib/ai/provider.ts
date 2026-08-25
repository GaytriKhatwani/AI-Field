import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { zodOutputFormat } from "@anthropic-ai/sdk/helpers/zod";
import { JudgeOutputSchema } from "../judge/schema";
import type { JudgeOutput } from "../judge/types";

// The ONE place the app talks to an LLM. Anthropic Claude is the only provider;
// the same model backs both roles, differentiated by system prompt + effort, not
// by provider. Swapping models later is a one-line change here (or via
// ANTHROPIC_MODEL); swapping providers means reimplementing this module and
// nothing else. All calls are server-side; the key never reaches the browser.

const DEFAULT_MODEL = "claude-sonnet-5";

function client(): { anthropic: Anthropic; model: string } {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error(
      "ANTHROPIC_API_KEY is not set. Copy .env.local.example to .env.local and fill it in.",
    );
  }
  return {
    anthropic: new Anthropic({ apiKey }),
    model: process.env.ANTHROPIC_MODEL || DEFAULT_MODEL,
  };
}

export type ChatTurn = { role: "user" | "assistant"; text: string };

/**
 * Stream a workbench reply. System prompt makes the AI a capable but
 * NON-pedagogical tool: it executes with only the context given, and does not
 * coach, volunteer missing requirements, repair vague instructions, or reveal a
 * rubric. Low effort — it executes, it doesn't deliberate. `systemContext` is the
 * mission's neutral framing (never the rubric).
 */
export async function* streamWorkbench(
  systemContext: string,
  history: ChatTurn[],
): AsyncGenerator<string> {
  const { anthropic, model } = client();

  const system = [
    systemContext,
    "",
    "You are a literal, capable tool — not a tutor and not a coach.",
    "Rules you must follow:",
    "- Work only from the material the operator has explicitly given you in this conversation. If they have given you nothing to work from, say so plainly and do not invent source material.",
    "- Do exactly what the operator instructs. Do not volunteer requirements, goals, or structure they did not ask for.",
    "- Do not repair vague instructions by guessing their intent. Produce a literal best effort and, only if the task is genuinely impossible without it, ask one narrow clarifying question.",
    "- Never coach the operator, never evaluate how well they are directing you, and never reveal or hint at any grading rubric.",
    "- Do not fabricate facts, dates, owners, or figures that are not present in the material you were given.",
  ].join("\n");

  const stream = anthropic.messages.stream({
    model,
    max_tokens: 4096,
    system,
    output_config: { effort: "low" },
    messages: history.map((t) => ({ role: t.role, content: t.text })),
  });

  for await (const event of stream) {
    if (
      event.type === "content_block_delta" &&
      event.delta.type === "text_delta"
    ) {
      yield event.delta.text;
    }
  }
}

/**
 * Run the examiner judge over a prepared prompt. Output is constrained to the
 * JudgeOutputSchema via structured outputs, so it parses deterministically. High
 * effort — rubric-driven evaluation is the quality-critical call. Returns the
 * parsed JudgeOutput plus the model id actually used (stamped onto the evaluation).
 */
export async function runJudge(
  prompt: string,
): Promise<{ output: JudgeOutput; modelId: string }> {
  const { anthropic, model } = client();

  const response = await anthropic.messages.parse({
    model,
    max_tokens: 16000,
    output_config: {
      effort: "high",
      format: zodOutputFormat(JudgeOutputSchema),
    },
    messages: [{ role: "user", content: prompt }],
  });

  const parsed = response.parsed_output;
  if (!parsed) throw new Error("Judge returned output that did not match the schema.");

  return { output: parsed as JudgeOutput, modelId: model };
}
