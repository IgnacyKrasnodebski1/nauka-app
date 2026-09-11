/**
 * Minimal local stand-in for `@nauka/ai` (used until packages/ai/dist exists).
 * Mirrors its public surface: generateSubject() + tutorStream(). Always runs in demo mode.
 */
import { finalizeGenerated, GenerationOptionsSchema, type GenerationOptions, type SubjectContent, type Subject } from "@nauka/shared";

export interface AiMaterial {
  mime: string;
  data: Buffer | string;
  name?: string;
}

export interface GenerateResult {
  content: SubjectContent;
  category: string;
  model: string;
  usage: { input: number; output: number };
  demo: boolean;
}

function sentences(text: string): string[] {
  return text
    .replace(/\s+/g, " ")
    .split(/(?<=[.!?])\s+/)
    .map((s) => s.trim())
    .filter((s) => s.length > 12)
    .slice(0, 60);
}

function words(text: string): string[] {
  const stop = new Set(["jest", "oraz", "który", "która", "które", "this", "that", "with", "from", "have", "będzie", "przez", "jako", "tego", "tylko"]);
  const freq = new Map<string, number>();
  for (const w of text.toLowerCase().match(/[a-ząćęłńóśźż]{5,}/g) ?? []) {
    if (stop.has(w)) continue;
    freq.set(w, (freq.get(w) ?? 0) + 1);
  }
  return [...freq.entries()].sort((a, b) => b[1] - a[1]).map(([w]) => w);
}

const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

/** Demo generation: slices the pasted text / hint into levels with feed, flashcards, quiz and games. */
export async function generateSubject(input: { materials: AiMaterial[]; text?: string; options: GenerationOptions }): Promise<GenerateResult> {
  const options = GenerationOptionsSchema.parse(input.options);
  const textParts = [input.text ?? ""];
  for (const m of input.materials) {
    if (m.mime.startsWith("text/")) textParts.push(typeof m.data === "string" ? Buffer.from(m.data, "base64").toString("utf8") : m.data.toString("utf8"));
  }
  const raw = textParts.join("\n").trim();
  const topic = (options.hint || raw.split(/\n/)[0] || "Nowy materiał").slice(0, 60);
  const sents = sentences(raw);
  const keys = words(raw);
  const nLevels = Math.max(1, Math.min(options.levels ?? 3, Math.max(1, Math.ceil(sents.length / 4)) || 1));
  const per = Math.max(1, Math.ceil(Math.max(sents.length, 1) / nLevels));

  const levels = Array.from({ length: nLevels }, (_, li) => {
    const chunk = sents.slice(li * per, (li + 1) * per);
    const kw = keys.slice(li * 4, li * 4 + 4);
    const feed = (chunk.length ? chunk : [`Materiał demo dla tematu „${topic}”. Dodaj klucz ANTHROPIC_API_KEY, żeby AI naprawdę przeczytało Twoje notatki.`]).slice(0, 6).map((s, i) => ({
      title: kw[i % Math.max(1, kw.length)] ? cap(kw[i % kw.length]!) : `Dawka ${i + 1}`,
      body: s,
      real: "DEMO: to zdanie pochodzi wprost z Twojego tekstu.",
      mnemo: "",
    }));
    const flashcards = kw.map((w) => ({ t: cap(w), d: chunk.find((s) => s.toLowerCase().includes(w)) ?? `Pojęcie z materiału: ${w}` }));
    const quiz = kw.slice(0, 4).map((w, i) => {
      const others = keys.filter((k) => k !== w).slice(0, 3);
      const a = [cap(w), ...others.map(cap)];
      while (a.length < 4) a.push(`Opcja ${a.length + 1}`);
      return { q: `Które pojęcie pasuje do zdania: „${(chunk[i] ?? chunk[0] ?? topic).replace(new RegExp(w, "i"), "___")}”?`, a, c: 0, e: `W materiale to zdanie dotyczy pojęcia „${w}”.` };
    });
    return {
      title: `Część ${li + 1}${kw[0] ? ": " + cap(kw[0]) : ""}`,
      emoji: ["📘", "📗", "📙", "📕", "📒", "📔", "📓", "📖"][li % 8]!,
      summary: chunk[0]?.slice(0, 120) ?? "",
      feed,
      flashcards: flashcards.length ? flashcards : [{ t: cap(topic), d: raw.slice(0, 200) || "Materiał demo." }],
      quiz: quiz.length >= 1 ? quiz : [{ q: `Czego dotyczy materiał „${topic}”?`, a: [cap(topic), "Czegoś innego", "Niczego", "Nie wiadomo"], c: 0, e: "Tryb demo — dodaj klucz API, żeby dostać prawdziwe pytania." }],
      games: [
        ...(flashcards.length >= 3 ? [{ type: "match" as const, title: "Połącz pojęcia", pairs: flashcards.slice(0, 5).map((f) => ({ l: f.t, r: f.d.slice(0, 80) })), cloze: [], tf: [], prompt: "", steps: [] }] : []),
        ...(chunk.length >= 3
          ? [{ type: "truefalse" as const, title: "Prawda czy fałsz", pairs: [], cloze: [], tf: chunk.slice(0, 5).map((s, i) => ({ s: i % 2 ? s.replace(/\bnie\b/i, "") : s, v: true, e: "Zdanie z Twojego materiału." })), prompt: "", steps: [] }]
          : []),
        ...(chunk.length >= 3 ? [{ type: "order" as const, title: "Ułóż w kolejności", pairs: [], cloze: [], tf: [], prompt: "Ułóż zdania w kolejności z materiału", steps: chunk.slice(0, 4).map((s) => s.slice(0, 90)) }] : []),
        ...(kw.length >= 2 && chunk[0]
          ? [{ type: "cloze" as const, title: "Uzupełnij lukę", pairs: [], cloze: kw.slice(0, 3).map((w) => ({ s: (chunk.find((s) => s.toLowerCase().includes(w)) ?? chunk[0]!).replace(new RegExp(w, "i"), "___"), answer: w, options: keys.filter((k) => k !== w).slice(0, 3), e: "" })), tf: [], prompt: "", steps: [] }]
          : []),
      ],
    };
  });

  const content = finalizeGenerated(
    {
      name: cap(topic),
      short: cap(topic).slice(0, 12),
      emoji: "🧪",
      tagline: `DEMO · wygenerowane bez klucza API z ${input.materials.length} plik(ów) i ${raw.length} znaków tekstu`,
      category: "inne",
      info_html: `<div class="zbox"><h3>Tryb demo</h3><p>Ten przedmiot powstał bez AI. Ustaw <b>ANTHROPIC_API_KEY</b> w apps/web/.env.local, a NAUKA naprawdę przeczyta Twoje materiały.</p></div>`,
      levels,
    },
    options.stage,
    { lang: options.lang },
  );
  return { content, category: "inne", model: "demo", usage: { input: 0, output: 0 }, demo: true };
}

/** Demo tutor: streams a canned but context-aware answer. */
export async function* tutorStream(input: { subject: Subject | SubjectContent; levelId: string; question: string; history: { role: "user" | "assistant"; content: string }[] }): AsyncIterable<string> {
  const level = input.subject.levels.find((l) => l.id === input.levelId) ?? input.subject.levels[0];
  const hit = level?.feed.find((f) => input.question.toLowerCase().split(/\W+/).some((w) => w.length > 4 && (f.title + f.body).toLowerCase().includes(w)));
  const text = hit
    ? `(tryb demo) W tym poziomie masz o tym notkę „${hit.title}”: ${hit.body.replace(/<[^>]+>/g, "")}${hit.real ? ` Po ludzku: ${hit.real}` : ""}`
    : `(tryb demo) Nie mam klucza API, więc nie mogę tego wytłumaczyć na żywo. Zerknij do feedu poziomu „${level?.title ?? ""}” — tam są najważniejsze rzeczy. Dodaj ANTHROPIC_API_KEY, a tutor zacznie odpowiadać naprawdę.`;
  for (const chunk of text.match(/.{1,12}/g) ?? [text]) {
    await new Promise((r) => setTimeout(r, 15));
    yield chunk;
  }
}
