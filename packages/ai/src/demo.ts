import type { GeneratedTopic } from "@nauka/shared";

/**
 * Demo generator used when no ANTHROPIC_API_KEY is configured — lets the whole flow
 * (upload → generate → learn) run end-to-end locally. Output is obviously generic.
 */
export function demoGenerated(topic: string, levels: number): GeneratedTopic {
  const t = topic.trim().slice(0, 60) || "Twój materiał";
  const mk = (n: number): GeneratedTopic["levels"][number] => ({
    title: `${t} — część ${n}`,
    emoji: ["🧩", "🔎", "⚙️", "🚀", "🧠", "🎯", "🏁", "✨"][(n - 1) % 8]!,
    summary: `Poziom ${n} przedmiotu „${t}” (tryb demo — bez klucza API).`,
    feed: [
      { title: "Co to jest tryb demo", body: `To jest <b>przykładowy</b> przedmiot wygenerowany bez klucza AI. Po dodaniu <b>ANTHROPIC_API_KEY</b> dostaniesz prawdziwe lekcje z Twoich materiałów o „${t}”.`, real: "Demo = placeholder. Prawdziwa magia po podpięciu klucza.", mnemo: "" },
      { title: "Jak wygląda lekcja", body: "Roladka (mikro-dawki) → fiszki → mini-gry → quiz. Zaliczasz quiz na ≥50% i odblokowujesz kolejny poziom.", real: "Duolingo, ale z Twoich notatek.", mnemo: "R-F-G-Q" },
      { title: "Co liczy XP", body: "Poprawne odpowiedzi, przejście poziomu, perfekcyjny wynik i codzienna seria 🔥.", real: "Grasz codziennie = rośnie streak.", mnemo: "" },
    ],
    flashcards: [
      { t: "Roladka", d: "Krótkie porcje wiedzy do przewijania przed quizem." },
      { t: "Fiszka", d: "Termin z jednej strony, definicja z drugiej. Oznaczasz „umiem / jeszcze nie”." },
      { t: "Powtórki (SRS)", d: "Aplikacja przypomina fiszki w rosnących odstępach czasu." },
      { t: "Poziom", d: "Spójny temat; odblokowuje się po zaliczeniu poprzedniego." },
    ],
    quiz: [
      { q: "Jaki wynik quizu zalicza poziom?", a: ["≥ 30%", "≥ 50%", "≥ 90%", "100%"], c: 1, e: "Próg zaliczenia poziomu to 50%. 70% daje 2 gwiazdki, 90% trzy." },
      { q: "Co robi tryb demo?", a: ["Wysyła materiały do AI", "Pokazuje przykładowy przedmiot bez klucza API", "Kasuje postępy", "Nic"], c: 1, e: "Bez ANTHROPIC_API_KEY apka generuje przykładową treść, żeby dało się przetestować cały flow." },
      { q: "Kolejność w lekcji to…", a: ["Quiz → fiszki → roladka", "Roladka → fiszki → gry → quiz", "Gry → quiz → roladka", "Fiszki → egzamin"], c: 1, e: "Najpierw czytasz mikro-dawki, potem utrwalasz fiszkami i grami, na końcu quiz." },
      { q: "Ile gwiazdek daje 75%?", a: ["0", "1", "2", "3"], c: 2, e: "≥70% = 2 gwiazdki, ≥90% = 3." },
    ],
    games: [
      { type: "match", title: "Dopasuj pojęcia", pairs: [{ l: "XP", r: "punkty doświadczenia" }, { l: "Streak", r: "seria dni z rzędu" }, { l: "SRS", r: "powtórki w odstępach" }, { l: "Egzamin", r: "20 losowych pytań na czas" }], cloze: [], tf: [], prompt: "", steps: [] },
      { type: "truefalse", title: "Prawda czy fałsz", pairs: [], cloze: [], tf: [{ s: "Poziomy odblokowują się po kolei.", v: true, e: "Tak — po zaliczeniu poprzedniego." }, { s: "Egzamin nie ma limitu czasu.", v: false, e: "Ma — czas z grading.examMin." }, { s: "Gość może uczyć się bez konta.", v: true, e: "Postępy trzymane lokalnie do czasu logowania." }], prompt: "", steps: [] },
      { type: "order", title: "Ułóż lekcję", pairs: [], cloze: [], tf: [], prompt: "Ułóż etapy lekcji w kolejności", steps: ["Roladka", "Fiszki", "Mini-gry", "Quiz", "Wynik"] },
    ],
  });
  return {
    name: t,
    short: t.slice(0, 12),
    emoji: "🧪",
    tagline: `DEMO — dodaj ANTHROPIC_API_KEY, żeby AI zrobiło prawdziwe lekcje z Twoich materiałów.`,
    category: "inne",
    info_html: `<div class="zbox"><h3>Tryb demo</h3><p>Ten przedmiot powstał bez klucza AI. Skonfiguruj <b>ANTHROPIC_API_KEY</b> w API weba i wygeneruj ponownie.</p></div>`,
    levels: Array.from({ length: Math.max(1, Math.min(levels, 4)) }, (_, i) => mk(i + 1)),
  };
}
