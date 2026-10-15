/* Cramfox — konfiguracja backendu (wartości publiczne: klucz anon chroni RLS po stronie Supabase, klucze serwerowe są tylko na Vercelu).
   Dev: na http://localhost:* API idzie przez lokalne proxy (node dev/proxy.js), więc przeglądarka nie potrzebuje CORS.
   privacyUrl / termsUrl (tylko https://) i supportEmail: linki „Polityka prywatności”, „Regulamin”, „Pomoc i kontakt” w Ustawieniach i na ekranie logowania.
   Puste = wiersz ukryty. Uzupełnić, gdy będą stałe adresy (AUDYT D1/D2). */
window.CRAMFOX_CONFIG={
  supabaseUrl:'https://zhgxhdsnizujzygpcyfl.supabase.co',
  anonKey:'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InpoZ3hoZHNuaXp1anp5Z3BjeWZsIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODkxMjY0MzAsImV4cCI6MjEwNDcwMjQzMH0.u_lenMaFPY5g_7bt9gRuid8g7pE8wlgjh4bNINNpEQc',
  apiUrl:'https://nauka-jet.vercel.app',
  privacyUrl:'',
  termsUrl:'',
  supportEmail:''
};
