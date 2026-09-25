import { blankGenTask, type GeneratedTopic } from "@nauka/shared";

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
    /* tasks 2.0 — one of each simple type, so both UIs can exercise the renderers without an API key */
    tasks: [
      blankGenTask({
        type: "tf",
        seconds: 45,
        e: "Próg to 50%, seria rośnie codziennie, a serca odnawiają się co 30 minut.",
        statements: [
          { s: "Poziom zaliczasz od 50% poprawnych odpowiedzi.", v: true, e: "50% = 1 gwiazdka, 70% = 2, 90% = 3." },
          { s: "Seria rośnie tylko w weekendy.", v: false, e: "Seria rośnie każdego dnia z nauką." },
          { s: "Jedno serce odnawia się co 30 minut.", v: true, e: "Pięć serc, każde wraca po 30 minutach." },
          { s: "Zadanie na czas daje mniej XP niż pytanie.", v: false, e: "Zadanie = 8 XP bazowo, pytanie = 5." },
        ],
      }),
      blankGenTask({
        type: "fill",
        title: "Uzupełnij zasady",
        text: "Poziom zaliczasz od {0} procent, a trzy gwiazdki dostajesz od {1} procent.",
        blanks: ["50", "90"],
        bank: ["30", "70"],
        hint: "Progi gwiazdek: 50 / 70 / 90.",
        e: "50% zalicza, 70% daje 2 gwiazdki, 90% trzy.",
      }),
      blankGenTask({
        type: "typeterm",
        definition: "Metoda powtórek, w której odstępy między kolejnymi powtórzeniami rosną.",
        answer: "SRS",
        accept: ["spaced repetition", "powtórki w odstępach"],
        e: "SRS = spaced repetition system: karta wraca po 1, 3, 7, 21 dniach.",
      }),
      blankGenTask({
        type: "swipe",
        left: "Nagroda",
        right: "Kara",
        cards: [
          { front: "+5 XP", sub: "poprawna odpowiedź", side: "left", e: "" },
          { front: "−1 serce", sub: "zła odpowiedź", side: "right", e: "" },
          { front: "Skrzynia", sub: "co trzeci poziom", side: "left", e: "" },
          { front: "Utrata serii", sub: "dzień bez nauki", side: "right", e: "" },
        ],
      }),
      blankGenTask({
        type: "scenario",
        scene: `Kasia ma sprawdzian z „${t}” za 3 dni i dwa niezaliczone poziomy.`,
        q: "Co podpowie jej plan do sprawdzianu?",
        a: ["Po jednym poziomie dziennie, ostatni dzień tylko powtórka", "Wszystko ostatniej nocy", "Tylko egzamin próbny", "Nic — plan liczy jedynie XP"],
        c: 0,
        e: "Plan rozkłada poziomy na dni, a dzień przed sprawdzianem zostawia krótką powtórkę.",
      }),
      blankGenTask({
        type: "order",
        title: "Kolejność lekcji",
        items: ["Roladka", "Fiszki", "Zadania i quiz", "Wynik poziomu"],
        e: "Najpierw czytasz, potem utrwalasz, na końcu sprawdzasz.",
      }),
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
