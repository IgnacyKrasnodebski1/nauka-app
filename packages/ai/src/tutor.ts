import Anthropic from "@anthropic-ai/sdk";
import { TUTOR_SYSTEM_PROMPT, type TopicContent } from "@nauka/shared";
import { aiConfigured, getClient, modelId } from "./client.js";

export interface TutorInput {
  subject: Pick<TopicContent, "name" | "levels">;
  levelId?: string;
  question: string;
  history?: { role: "user" | "assistant"; content: string }[];
}

function strip(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

/** Compact lesson context (level feed + flashcards, trimmed) for the tutor. */
export function tutorContext(subject: TutorInput["subject"], levelId?: string): string {
  const level = subject.levels.find((l) => l.id === levelId) ?? subject.levels[0];
  if (!level) return `Przedmiot: ${subject.name}`;
  const feed = level.feed.map((f) => `- ${f.title}: ${strip(f.body)}`).join("\n");
  const cards = level.flashcards.map((c) => `- ${c.t}: ${strip(c.d)}`).join("\n");
  return `Przedmiot: ${subject.name}\nPoziom: ${level.title}\n\nMateriał:\n${feed}\n\nPojęcia:\n${cards}`.slice(0, 12000);
}

/** Streams tutor answer text chunks. Without an API key yields a canned reply. */
export async function* tutorStream(input: TutorInput): AsyncGenerator<string> {
  if (!aiConfigured()) {
    yield "🤖 Tryb demo: korepetytor AI działa po dodaniu ANTHROPIC_API_KEY. Na razie zerknij do roladki i fiszek w tej lekcji — odpowiedź na pewno tam jest 😉";
    return;
  }
  const client = getClient();
  const history: Anthropic.Beta.BetaMessageParam[] = (input.history ?? []).slice(-8).map((h) => ({ role: h.role, content: h.content }));
  const stream = client.beta.messages.stream({
    model: modelId(),
    max_tokens: 1024,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    thinking: { type: "adaptive" },
    output_config: { effort: "low" },
    system: [
      { type: "text", text: TUTOR_SYSTEM_PROMPT, cache_control: { type: "ephemeral" } },
      { type: "text", text: tutorContext(input.subject, input.levelId), cache_control: { type: "ephemeral" } },
    ],
    messages: [...history, { role: "user", content: input.question.slice(0, 2000) }],
  });
  for await (const ev of stream) {
    if (ev.type === "content_block_delta" && ev.delta.type === "text_delta") yield ev.delta.text;
  }
  const final = await stream.finalMessage();
  if (final.stop_reason === "refusal") yield "\n\n(Nie mogę odpowiedzieć na to pytanie.)";
}
