# NAUKA — API (apps/web, Next.js route handlers)

Wszystkie endpointy poza webhookiem wymagają nagłówka `Authorization: Bearer <supabase access_token>`.
Błędy: JSON `{ error: string, code?: string }` z odpowiednim statusem (401, 402 limit planu, 400, 500).

## POST /api/generate
Body:
```json
{ "materialIds": ["uuid"], "text": "opcjonalny wklejony tekst", "options": { "stage": "liceum", "hint": "biologia, fotosynteza", "levels": 4, "lang": false } }
```
Wymaga `materialIds.length > 0 || text`. Limity z `PLANS[plan]`. Synchroniczne (do ~4 min, `maxDuration = 300`).
Odpowiedź 200: `{ "generationId": "uuid", "subjectId": "uuid", "subject": Subject }`.
402: `{ error, code: "limit_reached", used, limit }`.
Gdy brak `ANTHROPIC_API_KEY` → tryb demo: generuje przykładowy przedmiot z `text`/`hint` (oznaczony w `tagline` „DEMO”).

## GET /api/generate?id=<generationId>
Status joba: `{ status, subjectId?, error? }` (do pollowania po zerwaniu połączenia).

## POST /api/tutor
Body: `{ "subjectId": "uuid", "levelId": "l1", "question": "…", "history": [{ "role": "user"|"assistant", "content": "…" }] }`
Odpowiedź: `text/plain` streamowany (chunked). Limit: 30 wiadomości/dzień free (liczone w `usage.tutor_messages`), Pro bez limitu.

## POST /api/stripe/checkout
Body: `{ "interval": "month" | "year", "platform": "web" | "mobile" }` → `{ "url": "https://checkout.stripe.com/..." }`
Tworzy/odczytuje `stripe_customer_id`, Checkout Session (mode=subscription, BLIK + karta, locale pl). success_url: web → `/app?upgraded=1`, mobile → `/billing/success` (strona mówi „wróć do apki”).

## POST /api/stripe/portal
→ `{ "url" }` (Stripe Customer Portal).

## POST /api/stripe/webhook
Stripe → weryfikacja podpisu `STRIPE_WEBHOOK_SECRET`. Obsługa: `checkout.session.completed`, `customer.subscription.created|updated|deleted`, `invoice.payment_failed`. Ustawia `profiles.plan` (pro gdy status in active/trialing, inaczej free) i `subscriptions`.

## GET /api/me
→ `{ profile, plan, usage: { month, generations, tutorMessages }, limits: PLANS[plan], subscription }`.

## Dane bezpośrednio przez Supabase (RLS)
- `subjects`: select `is_public or owner`; insert/update/delete owner. Public seed: `owner_id is null`.
- `progress`, `srs_cards`, `user_meta`, `library`, `materials`: tylko własne.
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
