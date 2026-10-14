# Cramfox — dev bez backendu (atrapa) i zrzuty ekranów

`test/dev/index.html` to ta sama apka co `/index.html` (4 skrypty + `styles.css`), ale z **atrapą backendu** ładowaną na początku (`mock-backend.js`). Atrapa podmienia `fetch` i udaje Supabase (konto, baza, pliki, TUS) oraz API (`/api/me`, `/api/generate` — temat z `test/fixtures/*.json`). **Nic nie idzie do produkcji** i nic nie kosztuje. Stan „serwera” trzyma w `localStorage` (`mockbe:*`), więc przeładowanie zachowuje się jak prawdziwy backend.

## Uruchomienie

```sh
# z katalogu głównego repo
python3 -m http.server 8765
```

Otwórz w przeglądarce (najlepiej w trybie urządzenia mobilnego w DevTools):

- http://localhost:8765/test/dev/?mock=fresh&reset=1 — nowe konto od zera (rejestracja → etap → cel → pusty „Dziś”)
- http://localhost:8765/test/dev/?mock=seeded&reset=1 — konto testowe z 2 przedmiotami i postępami, od razu zalogowane
- http://localhost:8765/test/dev/?mock=seeded&reset=1&gen=slow:30 — generowanie trwa 30 s
- http://localhost:8765/test/dev/?mock=seeded&reset=1&gen=err:limit_reached — błąd limitu przy tworzeniu lekcji

`reset=1` czyści stan atrapy i apki (raz — parametr znika z adresu). Bez `reset` stan zostaje między przeładowaniami. Wszystkie parametry (`gen`, `genfx`, `upload`, `net`, `sync`, `fail`, `auth`, `plan`, `used`, `trial`, `clock`, `nostore`, `native`, `lang`, `extra`, `away`, `weekly`, `lat`, `log`) są opisane na początku `mock-backend.js`.

Konto testowe (tylko w atrapie): `test@cramfox.test` / `cramfox-test-1` (`?mock=seeded&reset=1&login=0` — logowanie ręczne).

W konsoli przeglądarki: `MOCK.db()` (stan serwera), `MOCK.log` (ostatnie żądania), `MOCK.set('gen','err:api')` (zmiana bez przeładowania), `MOCK.reset('seeded')`.

## Zrzuty ekranów (wszystkie ekrany i stany)

```sh
cd test
npm install                      # puppeteer-core (bez pobierania Chrome — używa /Applications/Google Chrome.app)
node dev/shoot.mjs --out /ścieżka/na/zrzuty
node dev/shoot.mjs --only fresh,errors     # wybrane scenariusze
```

Skrypt sam stawia serwer plików (port 8790), przechodzi przez scenariusze `fresh, seeded, comeback, monday, errors, boot, nostore, xss, narrow, native` w rozmiarze iPhone'a (375×812 @2x, dotyk, ograniczone animacje; część 360×780) i zapisuje `NN-nazwa.png` oraz `INDEX.md` (plik → stan → jak dojść) z listą problemów wykrytych automatycznie: błędy w konsoli, emoji w UI, poziome przewijanie, XSS (`window.__pwned`), ponowne wywołanie `/api/generate`, pasek offline po powrocie sieci. Chrome blokuje każde żądanie poza localhost i Google Fonts. Całość trwa ok. 7 minut.

Atrapa i skrypt nie wchodzą do `build/` ani do apki na iOS.
