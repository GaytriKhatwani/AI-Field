import "server-only";
import { GoogleGenAI, Type, ThinkingLevel } from "@google/genai";
import { JUDGE_SCHEMA } from "../judge/schema";
import type { JudgeOutput } from "../judge/types";

// The ONE place the app talks to an LLM. Gemini is the only provider. Swapping
// providers means reimplementing this module and nothing else. All calls are
// server-side; the key never reaches the browser. Per SPEC, behaviour is shaped
// by structured output + thinking level — not temperature/top-p/top-k.

const DEFAULT_MODEL = "gemini-3.7-flash";

function client(): { ai: GoogleGenAI; model: string } {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set. Copy .env.local.example to .env.local and fill it in.",
    );
  }
  return {
    ai: new GoogleGenAI({ apiKey }),
    model: process.env.GEMINI_MODEL || DEFAULT_MODEL,
  };
}

export type ChatTurn = { role: "user" | "model"; text: string };

/**
 * Stream a workbench reply. The system instruction makes the AI a capable but
 * NON-pedagogical tool: it executes with only the context given, and does not
 * coach, volunteer missing requirements, repair vague instructions, or reveal a
 * rubric. `systemContext` is the mission's neutral framing (never the rubric).
 */
export async function* streamWorkbench(
  systemContext: string,
  history: ChatTurn[],
): AsyncGenerator<string> {
  const { ai, model } = client();

  const systemInstruction = [
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

  const stream = await ai.models.generateContentStream({
    model,
    contents: history.map((t) => ({
      role: t.role,
      parts: [{ text: t.text }],
    })),
    config: {
      systemInstruction,
      thinkingConfig: { thinkingLevel: ThinkingLevel.LOW },
    },
  });

  for await (const chunk of stream) {
    const text = chunk.text;
    if (text) yield text;
  }
}

/**
 * Run the examiner judge over a prepared prompt. Output is constrained to
 * JUDGE_SCHEMA (structured output) so it parses deterministically. Returns the
 * parsed JudgeOutput plus the model id actually used (stamped onto the evaluation).
 */
export async function runJudge(
  prompt: string,
): Promise<{ output: JudgeOutput; modelId: string }> {
  const { ai, model } = client();

  const response = await ai.models.generateContent({
    model,
    contents: [{ role: "user", parts: [{ text: prompt }] }],
    config: {
      responseMimeType: "application/json",
      responseSchema: JUDGE_SCHEMA,
      thinkingConfig: { thinkingLevel: ThinkingLevel.HIGH },
    },
  });

  const raw = response.text;
  if (!raw) throw new Error("Judge returned an empty response.");

  let output: JudgeOutput;
  try {
    output = JSON.parse(raw) as JudgeOutput;
  } catch {
    throw new Error("Judge returned output that was not valid JSON.");
  }

  return { output, modelId: model };
}

// Re-exported for schema construction elsewhere if needed.
export { Type };
