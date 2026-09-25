# PORT 2.0 — mapa dla agentów UI (web + mobile)

Cel: przenieść design „Recall 2.0” (`design/`) do `apps/web` i `apps/mobile` bez duplikowania logiki. **Cała mechanika jest w `@nauka/shared`** — UI renderuje i trzyma stan, liczy shared. Skóra: `docs/DESIGN.md` → `TOKENS_CSS` / `TOKENS`. Referencja zachowań: `legacy/engine.js` (funkcje wymienione niżej) — czytaj, nie kopiuj.

Zasady niezmienne z `CLAUDE.md`: jeden kontrakt `TopicContent`; klucze tylko w API weba; `addXp` w store = jedyny lejek XP (tam `applyBoost`); plan Stripe tylko webhook.

---

## 1. Mechanika → funkcja shared

| Mechanika | Shared (import z `@nauka/shared`) | Legacy (engine.js) |
|---|---|---|
| Skóra, kolory, ruch | `TOKENS`, `TOKENS_CSS` (web: wstrzyknąć verbatim), `FONT_LINK`, `MOTION_CLASSES`, `MOTION_USAGE`, `COLORS`/`PLAY` (stare nazwy → nowa paleta), `DROP`, `RADIUS`, `TYPE`, `accentVars(accent2)` (`--accent*` na kontenerze przedmiotu), `hueFromColor` | `styles.css`, `applyTheme`, `applyMotion` |
| Sesja poziomu (pytania + zadania w jednym strumieniu) | `levelSession(level, {maxQuiz:6, rand, overrides})` → `LevelSessionItem[]` (`kind: "quiz" \| "task" \| "game"`, `id`, `xp`); `interleave` | `levelSession`, `lessonState.items` |
| Stare `games` → zadania | `levelTasks(level)` (własne `tasks` albo `gamesAsTasks(games)`), `allTasks(topic)`, `taskTypeCounts` | `allTasks` |
| Typy zadań (15 + fiszki) | `Task` (unia), `TASK_TYPES`, `AI_TASK_TYPES`, `TASK_META[type]` (label, tone, icon, desc, nazwa podglądu), `TaskSchema` | `TASKS` (rejestr rendererów), `TASK_META`, `taskBlock` |
| Sprawdzanie odpowiedzi | `checkTypeTerm`, `checkFill` + `fillSlots` + `fillBank`, `checkOrder` + `shuffledOrder`, `checkSort`, `checkTimeline`, `checkChain` + `chainBank`, `checkTf`, `checkSwipe`, `checkMatch(mistakes)`, `checkMathSteps(mistakes)`, `hotspotHit`, `foldAnswer`, `levenshtein`, `leftText` | `norm`, `fold`, `lev`, `chooser`, `tileDrag`, `chartSvg` (UI-only) |
| XP za element | `QUIZ_XP` (5), `TASK_XP` (8), `taskPoints(task)`, `PRACTICE_TASK_XP` (4), `TYPETERM_HINT_XP` (−2), `comboXp(base, streak)` | `QUIZ_XP`, `TASK_XP`, `addXP` |
| Wynik poziomu, gwiazdki, odblokowanie | `applyQuizResult(progress, levelId, correct, total)` (total = liczba elementów sesji, zadanie = 1), `starsFor`, `unlockedIndex`, `isLevelUnlocked`, `LEVEL_PASS` | `finishLesson`, `levelUnlocked` |
| Serca | `heartsNow`, `loseHeart` (raz na zadanie, tylko w lekcji), `gainHeart`, `refillHearts`, `HEART_REFILL_GEMS` (50), `formatCountdown` | `hearts`, `loseHeart`, `showNoHearts` |
| Combo | `emptyCombo`, `comboStep`, `comboMultiplier`, `comboTierHit`, `nextComboAt` | `comboMult`, `comboText` |
| Klejnoty, plecak, boost | `GEMS` (poziom 10, +5 za 3★ → `levelGems(stars)`, skrzynia 10, plan dnia 5, boss 25), `GEM_COSTS` (refill 50, freeze 100, boost 80, theme 150), `SHOP_ITEMS`, `FREEZE_MAX`, `THEMES`, `GEM_SOURCES`, `applyBoost` / `boostUntil` / `boostActive` / `boostLeftMs`, `addGems`, `spendGems`, `chestIndexes`, `chestOpenable`, `openChest`, `trophyClaimable`, `claimTrophy` | `GEM`, `SHOP`, `boostActive`, `planCheck` |
| Misje | `questsForToday(stored, userId, day, dailyGoal)` (3 dzienne), `weeklyQuestFor(stored, userId, day)` (1 tygodniowa, id `w:<poniedziałek>:<kind>`), `applyQuestEvent` (zdarzenia: `xp`, `answer`, `review`, `level`, `game`, **`task {won, timed, perfect}`**, `minutes`), `claimQuest`, `questsSummary`, `untilMidnight`, `pl` | `missions`, `missionEvent`, `claimMission` |
| Seria | `touchStreak` (zamrożenie z `streakFreezes`), `streakDisplay`, `streakAtRisk`, `dayDiff`, `todayStr` | `touchStreak`, `applyFreeze` |
| Powtórki SRS | `newCard`, `review(card, grade)`, `isDue`, `cardKey`, `srsBox(card)` (mapa SM-2 → pudełka 0–4) | `srs`, `srsTouch` |
| Album | `albumCheck(album, key, card, levelProgress, today)` po każdej powtórce, `albumRarity`, `albumKey`, `albumCount`, `albumTiles`, `ALBUM_RARITY_LABEL/TONE` — stan: `AlbumMap` (trzymać per user, np. w `user_meta`/store) | `albumCheck`, `renderAlbum` |
| Boss | `bossNodeState(topic, progress)`, `startBoss(topic)` → `BossState`, `bossNext`, `bossAnswer(state, ok)` (`xp`, `loseHeart`, `won`), `finishBoss(prev, state, win, today)` → `BossOutcome` (rekord do `progress.boss`, XP, gemy, `first` → odznaka `boss`), `bossName`, `BOSS_HP`, `BOSS_SEC`, `BOSS_WARN_SEC` | `startBoss`, `renderBoss`, `finishBoss`, `bossSvg` |
| Duch | `recordStep(run, correct, t0)` po każdej odpowiedzi, `ghostStatus(ghost, run, youIdx, elapsed, total)` co `GHOST_TICK_MS`, `ghostFinish(old, run, passed, total, today)` → `{kind, record, xp, title, sub}` (rekord do `progress.ghost[levelId]`), `ghostWhen`, `fmtSec` | `ghostCard`, `ghostTick`, `ghostFinish` |
| Odznaki | `ACHIEVEMENTS` (+ `album_100`, `exam_90`, `boss`, `plan_5`, `subject_done`), `evaluateAchievements` — nowe liczniki w `UserStats` (opcjonalne): `albumCount`, `bestExamPct`, `bosses`, `planDays`, `subjectsDone`, `timedPerfect`, `tasksDone` | `BADGES`, `checkBadges` |
| Ranga | `rankFor`, `rankChanged`, `RANKS` (kolory z tokenów) | — |
| Dzisiejsza sesja, plan do sprawdzianu | `buildDailySession`, `buildExamPlan`, `markWeak` | `buildDailyTasks`, `buildTestPlan` |
| Egzamin | `pickExam`, `gradeFor`, `allQuiz` | `renderEgzamin/ExamQ/ExamResult` |
| Ścieżka | `layoutPath`, `chestIndexes`, `bossNodeState` (ostatni węzeł) | `renderPath` |
| Źródło pytania | `QuizQuestion.src` / `Task.src` = `{material?, page?, quote?}` — API weba stampuje `material` przez `finalizeGenerated(gen, stage, {materialId})` | `openSourceView`, `wireSrc` |

---

## 2. Ekrany (design/DESIGN.md §3) → legacy → shared

Nazwa podglądu (`design/preview/<Nazwa>.html`) = proponowana trasa. „—” = w legacy tylko placeholder `renderComing` (wymaga wersji online).

| Grupa | Ekran | Legacy engine.js | Shared |
|---|---|---|---|
| Start | `EmptyState` | `renderEmpty` | — |
| | `LevelPick` | `renderLevelPick` (`openLevelPick`) | `STAGES`, `CURRICULUM` |
| | `Onboarding` | `renderOnboarding` (`obShell`) | `DAILY_GOALS`, `DAILY_GOAL_LABEL` |
| | `Catalog` | `renderCatalog` (`subjLevel`) | `CURRICULUM` |
| Materiał | `QuickAdd` | `openQuickAdd` (arkusz) | `isAcceptedMime`, `GenerationOptions` |
| | `Scanner`, `Detected`, `Generating` | — (`openComing`) | API `/api/generate` (docs/API.md), `onProgress` fazy `outline/levels/done` |
| | `SubjectReady` | `openSubject` → `renderSubject` | `paletteFor`, `SUBJECT_HUES` |
| | `EditContent` | `openEditContent` (overrides `sid:lid:qi`) | `levelSession({overrides})`, `QuizQuestionSchema` |
| | `SourceView` | `openSourceView`, `wireSrc`, `srcLine` | `TaskSource` |
| | `ShareClass` | — | — |
| Sprawdziany | `TestPlan` | `renderTestPlan`, `openTestSheet`, `buildTestPlan` | `buildExamPlan` |
| | `SubjectInfo` | `renderInfo` (`infoBlocks`, `scaleRows`) | `gradeFor`, `Grading` |
| | `AddSubject` | `openAddInfo` | `SubjectInputSchema` |
| | `ErrorState` | `renderError`/`renderErrorView`, `netbar`, `openFileError` | — |
| Codzienne | `Main` | `renderToday` (`renderPlan`, `subjectGrid`, `renderNav`, `gemPill`, `heartsPill`) | `buildDailySession`, `weekStrip`, `todayXp`, `dailyGoalPct`, `questsSummary` |
| | `Missions` | `renderMissions` (`missionRow`) | `questsForToday`, `weeklyQuestFor`, `claimQuest`, `untilMidnight` |
| | `League`, `Friends` | — | `LeaderboardRow` (API) |
| | `Shop` | `renderShop` | `SHOP_ITEMS`, `spendGems`, `refillHearts`, `boostUntil`, `THEMES` |
| | `ComeBack` | `renderComeBack` (`needComeBack`) | `dayDiff`, `streakDisplay`, `isDue` |
| | `Streak` | `renderStreak` (`weekDots`, `freezeCard`) | `touchStreak`, `weekStrip`, `FREEZE_MAX` |
| | `Settings` | `renderSettings` (`exportData`, `importData`, `toggleBtn`) | `UserMeta`, `DAILY_GOALS` |
| Nauka | `Path` | `renderPath` (węzły, skrzynie, `.node-boss`) | `layoutPath`, `unlockedIndex`, `chestIndexes`, `chestOpenable`, `bossNodeState` |
| | `Lesson` | `renderLesson` (`lessonHead`, `startLesson`, `closeLesson`), roladka `allFeed` | `XP.feedRead` |
| | `Quiz` / `QuizCorrect` / `QuizWrong` | `quizBlock`, `sessionChips`, `sheetOk`, `sheetBad`, `advOk`, `confetti`, `openExplain` | `levelSession`, `comboXp`, `loseHeart`, `shuffleAnswers`, `MASCOT_LINES` |
| | `NoHearts` | `showNoHearts` | `heartsNow`, `formatCountdown`, `HEART_REFILL_GEMS` |
| | `Flashcards` / `FlashcardsDone` | `renderFiszki`, `renderCardsHub`, `goCards` | `review`, `cardKey`, `albumCheck`, `XP.flashcardKnown` |
| | `Review` | `renderReview`, `renderReviewSession`, `rvAnswer`, `finishReview` | `buildDailySession`, `review`, `isDue` |
| | `LevelComplete` | `finishLesson` (statystyki, `.lcrewards`, `.lcghost`) | `applyQuizResult`, `levelGems`, `ghostFinish`, `evaluateAchievements` |
| | `Profile` | `renderProfile` (`heatmap`, `badgeGrid`) | `rankFor`, `ACHIEVEMENTS`, `ActivityMap` |
| Zadania | `Quiz` wybór | `quizBlock` | `SessionQuizItem` |
| | `TaskMatch` · `TaskFill` · `TaskOrder` · `TaskSort` · `TaskTrueFalse` | `TASKS.match/.fill/.order/.sort/.tf` | `checkMatch`, `checkFill`+`fillBank`, `checkOrder`+`shuffledOrder`, `checkSort`, `checkTf` |
| | `Timeline` · `FindError` · `WhoSaid` · `CauseChain` · `Scenario` · `Swipe` · `TypeTerm` | `TASKS.timeline/.finderror/.thesis/.chain/.scenario/.swipe/.typeterm` (+ `chooser`, `tileDrag`) | `checkTimeline`, `FindErrorTask.wrong`, `ThesisTask.c`, `checkChain`+`chainBank`, `ScenarioTask.c`, `checkSwipe`, `checkTypeTerm` |
| | `ChartRead` · `MathSteps` · `Hotspot` | `TASKS.chart` (`chartSvg`), `.mathsteps`, `.hotspot` | `ChartTask`, `checkMathSteps`, `hotspotHit` |
| | `Flashcards` (16. typ) | `renderFiszki` | `review` |
| Walka | `Boss` | `startBoss`, `renderBoss`, `finishBoss`, `bossSvg`, `bossName` | `boss.ts` |
| | `Ghost` | `ghostCard`, `ghostTick`, `ghostFinish`, `ghostWhen` | `ghost.ts` |
| | `Cram` | `renderCram`, `cramBlocks`, `cramTimer`, `cramFinish` | `buildDailySession`, `pickExam` |
| | `Album` | `renderAlbum`, `albumCheck`, `albumCount` | `album.ts` |
| | `Explain` | `openExplain`, `explainFor` (offline heurystyka) | `tutorStream` (API `/api/tutor`) |
| | `WeeklyStory` | `renderWeekly` (`weekStats`, `weekRange`) | `weekStrip`, `ActivityMap` |
| Egzamin | `ExamStart` | `renderEgzamin`, `examConfig` | `pickExam`, `Grading.examMin` |
| | `ExamRun` | `renderExamQ`, `openExamGrid`, `exTick`, `confirmExamFinish` | `shuffleAnswers` |
| | `Exam` (wynik) | `renderExamResult`, `examFinish`, `startExamDeck`, `ringSvg` | `gradeFor`, `markWeak`, `GEMS.examPass`, stats `bestExamPct` |
| Ćwiczenia | (zakładka) | `renderCwicz`, `cwStartTasks`, `cwRenderTasks`, `cwResult` | `allTasks`, `taskTypeCounts`, `TASK_META`, `PRACTICE_TASK_XP` |

Ikony: legacy `icon(name)` (inline SVG, `TASK_META[type].icon`, `SHOP_ITEMS[].icon`, `ACHIEVEMENTS[].icon`) — web ma własny `Icon` (`components/ui/icons.tsx`), mobile Ionicons; nieznane nazwy mapować z fallbackiem jak `ACH_ICON`.

---

## 3. Kształty danych

### Poziom (rozszerzenie kontraktu, wszystko opcjonalne)
```ts
Level { …, games?: MiniGame[], tasks?: Task[], fromMaterial?: string }
QuizQuestion { q, a, c, e, src?: { material?, page?, quote? } }
Task = MatchTask | FillTask | OrderTask | SortTask | TfTask | TimelineTask | FindErrorTask | ThesisTask
     | ChainTask | ScenarioTask | SwipeTask | TypeTermTask | ChartTask | MathStepsTask | HotspotTask
// każdy: { type, title?, e?, src? } + pola z design/DESIGN.md §4.1 (typy w packages/shared/src/types.ts, zod w schema.ts)
```
Uwaga: `MatchTask.pairs` to krotki `[l, r]` (jak legacy), `MatchGame.pairs` to `{l, r}` — `gamesAsTasks` konwertuje. `FillTask.text` używa `{0}`, `{1}` (legacy `___` z cloze jest przepisywane).

### Sesja lekcji
```ts
levelSession(level, { maxQuiz: 6 }) →
  { kind:"quiz", id:"q:3", q, qi, xp:5 } | { kind:"task", id:"t:1", task, ti, xp:8 } | { kind:"game", … }
// pierwszy element = pytanie; zadania równo między resztą; pasek segmentowy, celność, gwiazdki liczone z items.length
```

### Postęp per temat (`SubjectProgress`, JSONB `progress`)
```ts
{ xp, levels: { [levelId]: { done, best, stars, attempts } }, bestExam?, chests?: number[],
  boss?: { done, n, at?, best? },                         // boss.ts
  ghost?: { [levelId]: { run: [{t, correct}], at } } }    // ghost.ts (legacy: goła tablica też akceptowana)
```

### Per user
```ts
UserMeta.stats += { albumCount?, bestExamPct?, bosses?, planDays?, subjectsDone?, timedPerfect?, tasksDone? }
Quest { …, weekly?: true }   // id "w:<poniedziałek>:<kind>" — trzymać obok dziennych, questsForToday je odfiltrowuje
AlbumMap = { "<topicId>:<levelId>:<cardIdx>": { rarity: "common"|"rare"|"epic", at } }
boost: until (ms) — trzymać w store; addXp: xp = applyBoost(xp, until)
```
`QuestKind` jest zamrożony (oba UI mapują go wyczerpująco). Legacy misje „zadanie na czas bez błędu” → kind `perfect` (zdarzenie `task {timed:true}` albo `level {perfect}`), „N zadań” → kind `games` (zdarzenie `task`/`game`), „cały plan dnia” → bez misji, płatne bezpośrednio `GEMS.dailyGoal` (5).

### Generowanie (AI)
`LevelGenSchema.tasks` = płaskie obiekty `GenTask` (typ + wszystkie pola; `blankGenTask()` do fixtur), tylko typy `AI_TASK_TYPES` (bez chart / mathsteps / hotspot). `finalizeGenerated(gen, stage, { lang, materialId })` waliduje każde zadanie `TaskSchema` i odrzuca błędne; `src_page`/`src_quote` → `src`. Demo (bez klucza) daje 6 zadań na poziom.

---

## 4. Kolejność (design/DESIGN.md §6) i podział
1. Skóra: `TOKENS_CSS` + `FONT_LINK` (web `app/layout` + `globals.css`), mobile `TOKENS` w StyleSheet; zero gradientów, twarde cienie `DROP`.
2. Ikony SVG zamiast emoji (`TASK_META.icon` itd.).
3. `Main` + dolna nawigacja z plusem (`QuickAdd`).
4. `Path`, `Lesson`, `Quiz*` przez `levelSession`; serca/combo/panele.
5. Zadania: proste (`tf`, `fill`, `typeterm`, `swipe`, `thesis`, `scenario`) → przeciągane (`match`, `order`, `sort`, `timeline`, `chain`; pointer events / Gesture Handler) → `chart`, `mathsteps`, `hotspot`.
6. `Review`, `FlashcardsDone`, album.
7. Egzamin, `TestPlan`.
8. Gamifikacja: plecak, misje (+ tygodniowa), seria, boss, duch, odznaki.
9. Materiały: `QuickAdd` → `Scanner`/`Detected`/`Generating` → `SourceView`/`EditContent`.
10. Społeczność.
