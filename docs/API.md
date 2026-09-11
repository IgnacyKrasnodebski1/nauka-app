# NAUKA — API (apps/web, Next.js route handlers)

Wszystkie endpointy poza webhookiem wymagają nagłówka `Authorization: Bearer <supabase access_token>`.
Błędy: JSON `{ error: string, code?: string }` z odpowiednim statusem (401, 402 limit planu, 400, 500).

## POST /api/generate
Tworzy **temat** w przedmiocie użytkownika. Body:
```json
{ "subjectId": "uuid", "materialIds": ["uuid"], "text": "opcjonalny wklejony tekst",
  "options": { "stage": "liceum", "subjectName": "Biologia", "mode": "materials" | "prompt", "hint": "fotosynteza, klasa 7", "levels": 4, "lang": false } }
```
`mode=materials` wymaga `materialIds.length > 0 || text`; `mode=prompt` wymaga `options.hint`. API sprawdza, że `subjects.owner_id = user`. Limity z `PLANS[plan]`. Synchroniczne (`maxDuration = 300`). Wywołuje `generateTopic()` z `@nauka/ai`, wstawia `topics` (position = liczba tematów w przedmiocie, `source` = mode, `generation_id`).
Odpowiedź 200: `{ "generationId": "uuid", "topicId": "uuid", "topic": Topic }`.
402: `{ error, code: "limit_reached", used, limit }`.
Gdy brak `ANTHROPIC_API_KEY` → tryb demo (przykładowy temat, `tagline` „DEMO”).

## GET /api/generate?id=<generationId>
Status joba: `{ status, topicId?, error? }`.

## POST /api/tutor
Body: `{ "topicId": "uuid", "levelId": "l1", "question": "…", "history": [{ "role": "user"|"assistant", "content": "…" }] }`
Odpowiedź: `text/plain` streamowany (chunked). Limit: 30 wiadomości/dzień free (liczone w `usage.tutor_messages`), Pro bez limitu.

## POST /api/stripe/checkout
Body: `{ "interval": "month" | "year", "platform": "web" | "mobile" }` → `{ "url": "https://checkout.stripe.com/..." }`
Tworzy/odczytuje `stripe_customer_id`, Checkout Session (mode=subscription, metody z ustawień Stripe — karta, Link, Apple/Google Pay; BLIK nie obsługuje subskrypcji, locale pl). success_url: web → `/app?upgraded=1`, mobile → `/billing/success` (strona mówi „wróć do apki”).

## POST /api/stripe/portal
→ `{ "url" }` (Stripe Customer Portal).

## POST /api/stripe/webhook
Stripe → weryfikacja podpisu `STRIPE_WEBHOOK_SECRET`. Obsługa: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed`. Ustawia `profiles.plan` (pro gdy status in active/trialing, inaczej free) i `subscriptions`.

## GET /api/me
→ `{ profile, plan, usage: { month, generations, tutorMessages }, limits: PLANS[plan], subscription }`.

## Dane bezpośrednio przez Supabase (RLS)
- `subjects` (kontenery), `topics` (treść), `progress`, `srs_cards`, `user_meta`, `activity`, `materials`: tylko własne (`owner_id`/`user_id = auth.uid()`).
- RPC: `log_activity(p_xp int, p_minutes int)`, `my_total_xp()`.
- Storage `materials/{uid}/...`: tylko własne.

## Env (apps/web/.env.local)
```
NEXT_PUBLIC_SUPABASE_URL=
NEXT_PUBLIC_SUPABASE_ANON_KEY=
SUPABASE_SERVICE_ROLE_KEY=
ANTHROPIC_API_KEY=            # brak = tryb demo
NAUKA_AI_MODEL=claude-opus-5  # opcjonalnie
STRIPE_SECRET_KEY=
STRIPE_WEBHOOK_SECRET=
STRIPE_PRICE_MONTHLY=price_...
STRIPE_PRICE_YEARLY=price_...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
Mobile (apps/mobile/.env): `EXPO_PUBLIC_SUPABASE_URL`, `EXPO_PUBLIC_SUPABASE_ANON_KEY`, `EXPO_PUBLIC_API_URL` (URL weba).
