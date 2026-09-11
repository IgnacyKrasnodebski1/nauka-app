# 📚 NAUKA — AI zamienia Twoje materiały w naukę, która wciąga

Wrzucasz screeny notatek, slajdy, PDF albo wklejasz tekst → AI robi z tego przedmiot w stylu Duolingo: **poziomy**, **roladkę** (mikro-dawki), **fiszki z powtórkami**, **mini-gry** (dopasuj, luki, prawda/fałsz, ułóż), **quizy** i **egzamin na czas**. Podstawówka → liceum → studia.

Monorepo: web (Next.js, PWA) + mobile (Expo, iOS/Android) + Supabase + Stripe + Claude.

## Szybki start (dev)
```bash
npm install
npm run build:shared && npm run build -w @nauka/ai
cp apps/web/.env.example apps/web/.env.local     # uzupełnij (bez kluczy działa tryb demo/gość)
npm run web                                       # http://localhost:3000
npm run mobile                                    # Expo (skanuj w Expo Go)
```
Testy i sprawdzenie typów: `npm test`, `npm run typecheck`.

## Struktura
Patrz [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md). API: [docs/API.md](docs/API.md). Wdrożenie i sprzedaż: [docs/DEPLOY.md](docs/DEPLOY.md).

| Pakiet | Co robi |
|---|---|
| `packages/shared` | kontrakt danych (typy + zod), XP/gwiazdki/streak, SRS, prompty, plany |
| `packages/content` | 7 przedmiotów seed (JSON) skonwertowanych ze starej apki |
| `packages/ai` | Claude: materiały → przedmiot (vision + PDF + structured outputs), tutor |
| `apps/web` | landing, auth, aplikacja, API (generate, tutor, Stripe) |
| `apps/mobile` | Expo Router, ten sam kontrakt i API |
| `supabase/` | migracje, RLS, storage, seed |
| `legacy/` | stara wersja vanilla JS (`node legacy/build.js`) — nadal działa offline |

## Model biznesowy
Freemium: Free = 3 generacje AI/mies., Pro = 29 zł/mies. lub 199 zł/rok (150 generacji, tutor bez limitu). Limity: `packages/shared/src/plans.ts`.
