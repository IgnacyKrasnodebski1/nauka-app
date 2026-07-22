/* ============================================================
   PRZEDMIOT: Globalizacja, regionalizacja i konkurencyjność międzynarodowa
   Źródło: 4 prezentacje dr. Dominika Brodackiego (Zajęcia 1–4)
   Zaliczenie: aktywność 20% + prezentacja 40% + zaliczenie pisemne 40%
   ============================================================ */
window.SUBJECTS = window.SUBJECTS || [];
window.SUBJECTS.push({
  id:"globalizacja",
  name:"Globalizacja i regionalizacja",
  short:"Global",
  emoji:"🌍",
  tagline:"Fale globalizacji, teorie (liberalizm/realizm/krytycyzm), global governance, efekt brukselski, konkurencyjność, kultura, regionalizacja.",
  accent:"linear-gradient(135deg,#2563eb,#06b6d4,#22c55e)",
  accent2:"#06b6d4",
  grading:{pass:50,examMin:20,scale:[[98,"5,5"],[90,"5"],[80,"4,5"],[70,"4"],[60,"3,5"],[50,"3"]],failLabel:"2 — niezaliczone"},
  info:`
    <div class="zbox"><h3>Jak liczy się ocena</h3>
      <p>🙋 <b>Aktywność na zajęciach = 20%</b><br>
      🎤 <b>Prezentacja (pary/trójki) = 40%</b> — 10 min, najważniejsze wydarzenia z ostatnich 2 tygodni (co / kto / kiedy / jak / dlaczego ważne) i ich wpływ na konkurencyjność.<br>
      🧪 <b>Zaliczenie pisemne (ostatnie zajęcia) = 40%</b>.</p></div>
    <div class="zbox"><h3>Siatka ocen (test)</h3>
      <table class="gradetbl">
        <tr><td>50–59</td><td>3</td></tr><tr><td>60–69</td><td>3,5</td></tr><tr><td>70–79</td><td>4</td></tr>
        <tr><td>80–89</td><td>4,5</td></tr><tr><td>90–98</td><td>5</td></tr><tr><td>98–100</td><td>5,5</td></tr></table></div>
    <div class="zbox"><h3>⚡ Motyw przewodni kursu</h3>
      <p>Świat przechodzi <b>od logiki efektywności do logiki bezpieczeństwa</b>. „Produkować najtaniej” → „produkować bezpiecznie”. Zapamiętaj to zdanie — spina cały przedmiot.</p></div>`,
  levels:[
    /* ---------------- L1 ---------------- */
    {id:"l1",title:"Czym jest globalizacja",emoji:"🧭",
     feed:[
      {title:"Definicja, którą musisz umieć",body:"<b>Globalizacja</b> = proces rosnącej <b>współzależności</b> między państwami, gospodarkami i społeczeństwami, obejmujący przepływy <b>towarów, kapitału, ludzi, technologii i idei</b>.",real:"Świat coraz mocniej połączony kablami zależności. Ruszysz jeden koniec — drga drugi.",mnemo:"Przepływy: <b>TO-KA-LU-TE-I</b> — Towary, Kapitał, Ludzie, Technologia, Idee."},
      {title:"To NIE tylko gospodarka",body:"Globalizacja obejmuje też: 🏛️ <b>politykę</b> (instytucje globalne, np. WTO), 👥 <b>społeczeństwo</b> (migracje), 🎭 <b>kulturę</b> i 🌱 <b>środowisko</b> (zmiany klimatu).",real:"Nie tylko o tym, skąd masz telefon — też o memach, wizach i CO₂."},
      {title:"5 wymiarów globalizacji",body:"💰 <b>Gospodarczy</b> · 🔌 <b>Technologiczny</b> · 👥 <b>Społeczny</b> · 🎭 <b>Kulturowy</b> · 🏛️ <b>Polityczny</b>.",mnemo:"<b>GO-TE-SPO-KU-PO</b> — pięć nóg globalizacji."},
      {title:"Czym globalizacja NIE jest",body:"❌ To nie to samo co <b>liberalizm gospodarczy</b> (integracja może iść przy różnych systemach).<br>❌ Nie <b>McDonaldyzacja</b> — wymiana kultur jest wielokierunkowa, powstają hybrydy.<br>❌ Nie sam <b>internet</b> — cyfryzacja ją przyspieszyła, ale nie jest jej źródłem.<br>❌ Nie zwykły <b>handel</b> — chodzi o integrację systemów produkcji, nie tylko eksport/import.",real:"Globalizacja ≠ 'wszędzie ten sam Big Mac'. To głębsza integracja, nie tylko przelewy i paczki."},
      {title:"Globalizacja vs internacjonalizacja vs regionalizacja",body:"<b>Globalizacja</b> = integracja w skali świata.<br><b>Internacjonalizacja</b> = współpraca między odrębnymi państwami (bez zlewania się w jeden system).<br><b>Regionalizacja</b> = zacieśnianie więzi wewnątrz jednego regionu (np. UE, ASEAN).",real:"Regionalizacja to globalizacja 'na dzielni' — bliżej, bezpieczniej, w gronie sąsiadów/sojuszników."}
     ],
     flashcards:[
      {t:"Globalizacja",d:"Proces rosnącej współzależności między państwami, gospodarkami i społeczeństwami; obejmuje przepływy towarów, kapitału, ludzi, technologii i idei."},
      {t:"5 wymiarów globalizacji",d:"Gospodarczy, technologiczny, społeczny, kulturowy, polityczny."},
      {t:"Globalizacja to nie McDonaldyzacja",d:"Wymiana kulturowa jest wielokierunkowa; lokalne kultury adaptują globalne wzorce, powstają hybrydy — to przenikanie kultur, nie tylko ich ujednolicanie."},
      {t:"Internacjonalizacja",d:"Współpraca i wymiana między odrębnymi państwami — bez zlewania się gospodarek w jeden zintegrowany system (to odróżnia ją od globalizacji)."},
      {t:"Regionalizacja",d:"Zacieśnianie integracji gospodarczej/handlowej między państwami jednego regionu lub bliskiego sąsiedztwa (UE, ASEAN, USMCA)."},
      {t:"Globalna wioska",d:"Marshall McLuhan — dzięki elektronicznej łączności świat staje się jedną wioską: natychmiastowa komunikacja, wspólna przestrzeń medialna. Nie musi oznaczać harmonii."}
     ],
     quiz:[
      {q:"Globalizacja to przede wszystkim:",a:["tylko wolny handel towarami","proces rosnącej współzależności obejmujący przepływy towarów, kapitału, ludzi, technologii i idei","synonim McDonaldyzacji świata","to samo co internet"],c:1,e:"Definicja z wykładu: rosnąca współzależność + 5 typów przepływów."},
      {q:"Które NIE jest jednym z 5 wymiarów globalizacji?",a:["gospodarczy","technologiczny","militarny","kulturowy"],c:2,e:"5 wymiarów: gospodarczy, technologiczny, społeczny, kulturowy, polityczny."},
      {q:"Dlaczego globalizacja to NIE to samo co McDonaldyzacja?",a:["bo McDonald's zbankrutował","bo wymiana kultur jest wielokierunkowa i powstają hybrydy, a nie samo ujednolicenie","bo kultura się nie zmienia","bo globalizacja dotyczy tylko gospodarki"],c:1,e:"Kultury się przenikają i adaptują wzorce — to hybrydyzacja, nie prosta homogenizacja."},
      {q:"Czym regionalizacja różni się od globalizacji?",a:["to integracja w obrębie jednego regionu/sąsiedztwa, nie całego świata","to zakaz handlu","to synonim globalizacji","dotyczy tylko kultury"],c:0,e:"Regionalizacja = zacieśnianie więzi wewnątrz regionu (UE, ASEAN, RCEP)."}
     ]},
    /* ---------------- L2 ---------------- */
    {id:"l2",title:"Fale globalizacji",emoji:"🌊",
     feed:[
      {title:"Falowy charakter — I FALA (1870–1914)",body:"Napęd: <b>rewolucja przemysłowa</b>, wynalazki (<b>kolej i telegraf</b>), <b>standard złota</b>, masowe migracje. Udział eksportu w światowym PKB skoczył z ~5% (1870) do ~14% (1913).",real:"Pierwsza globalizacja to nie internet — to para, tory i telegraf. Londyn = centrum finansów świata.",mnemo:"I fala = <b>Kolej + Telegraf + Złoto + Migracje</b>."},
      {title:"Wielki reset: wojny i protekcjonizm",body:"Wojny światowe, <b>Wielki Kryzys</b>, nacjonalizm gospodarczy i protekcjonizm cofnęły integrację. Poziom handlu z 1913 r. odzyskano dopiero w latach <b>70.–80. XX w.</b>",real:"Globalizacja NIE jest liniowa. Raz się cofnęła na ~60 lat. Może znów."},
      {title:"II FALA (1945–2008)",body:"Fundamenty ładu: <b>Bretton Woods</b> (1944, MFW + Bank Światowy), <b>GATT → WTO</b>. Potem globalne łańcuchy wartości, <b>offshoring</b>, <b>China shock</b>, <b>just-in-time</b>.",real:"Po wojnie zbudowano 'reguły gry' i produkcja rozlała się po świecie w poszukiwaniu taniości."},
      {title:"Hiperglobalizacja (1990–2008)",body:"Turbo-faza: <b>upadek ZSRR</b>, <b>liberalizacja kapitału</b>, <b>cyfryzacja</b>, ekspansja WTO. Świat jednobiegunowy, kapitał płynie swobodnie.",real:"Lata 90.–2000. — 'im więcej globalizacji, tym lepiej'. Szczyt wiary w wolny rynek bez granic."},
      {title:"2008 — ROK PRZEŁOMU",body:"<b>Kryzys finansowy</b> + wzrost <b>populizmu</b> + <b>wojny handlowe</b> + <b>kryzys zaufania do instytucji</b>. Od tego momentu mówimy o <b>deglobalizacji / slowbalisation</b>.",real:"2008 to zakręt. Później: friend-shoring, nearshoring, decoupling — dobił to COVID i wojna w Ukrainie.",mnemo:"Po 2008: <b>Slow-Friend-Near-De</b> (slowbalisation, friend-shoring, nearshoring, decoupling)."}
     ],
     flashcards:[
      {t:"I fala globalizacji (1870–1914)",d:"Napęd: rewolucja przemysłowa, kolej i telegraf, standard złota, masowe migracje. Eksport w PKB świata: z ~5% (1870) do ~14% (1913). Londyn = centrum finansów."},
      {t:"Przerwa 1914–lata 70./80.",d:"Wojny światowe, Wielki Kryzys, nacjonalizm gospodarczy i protekcjonizm cofnęły globalizację; poziom handlu z 1913 r. odzyskano dopiero w latach 70.–80. XX w."},
      {t:"II fala globalizacji (1945–2008)",d:"Bretton Woods (MFW, Bank Światowy), GATT → WTO. Globalne łańcuchy wartości, offshoring, China shock, just-in-time."},
      {t:"Hiperglobalizacja (1990–2008)",d:"Upadek ZSRR, liberalizacja przepływów kapitału, cyfryzacja, ekspansja WTO. Szczyt integracji świata."},
      {t:"Rok przełomu 2008",d:"Kryzys finansowy, wzrost populizmu, wojny handlowe, kryzys zaufania do instytucji. Początek deglobalizacji / slowbalisation."},
      {t:"China shock",d:"Gwałtowny wpływ wejścia Chin do WTO (2001) i ich taniej produkcji na przemysł krajów rozwiniętych — utrata miejsc pracy w produkcji na Zachodzie."},
      {t:"Just-in-time vs just-in-case",d:"JIT = minimalne zapasy, dostawa 'na czas' (maks. efektywność). JIC = bufory i zapasy na wypadek szoków (maks. odporność). Świat przechodzi z JIT na JIC."}
     ],
     quiz:[
      {q:"Co napędzało I falę globalizacji (1870–1914)?",a:["internet i social media","kolej, telegraf, standard złota i masowe migracje","WTO i Bretton Woods","upadek ZSRR"],c:1,e:"I fala = rewolucja przemysłowa, kolej/telegraf, złoto, migracje."},
      {q:"Rok 2008 w historii globalizacji to:",a:["początek I fali","rok przełomu — kryzys finansowy, populizm, wojny handlowe, spadek zaufania do instytucji","podpisanie Bretton Woods","upadek ZSRR"],c:1,e:"2008 = zakręt ku deglobalizacji / slowbalisation."},
      {q:"Instytucje Bretton Woods (1944) to m.in.:",a:["WTO i NATO","MFW i Bank Światowy","ASEAN i Mercosur","G20 i BRICS"],c:1,e:"Bretton Woods powołało MFW i Bank Światowy; handlem zajął się GATT → WTO."},
      {q:"Kiedy świat odzyskał poziom integracji handlowej z 1913 r.?",a:["już w 1920 r.","dopiero w latach 70.–80. XX w.","w 1945 r.","nigdy"],c:1,e:"Wojny, Wielki Kryzys i protekcjonizm cofnęły globalizację aż do lat 70.–80."},
      {q:"Just-in-time oznacza:",a:["duże zapasy na wypadek kryzysu","produkcję z minimalnymi zapasami, dostawą 'na czas' — maks. efektywność","zakaz importu","powrót produkcji do kraju"],c:1,e:"JIT = efektywność; przeciwieństwo to just-in-case (odporność)."}
     ]},
    /* ---------------- L3 ---------------- */
    {id:"l3",title:"Teorie globalizacji",emoji:"🎓",
     feed:[
      {title:"Liberalizm — 'rynek sam integruje świat'",body:"Globalizacja to <b>pozytywny, naturalny</b> efekt technologii i rynku. Napędza ją: <b>technologia, rynek (efektywność), kapitał</b>. Prowadzi do <b>konwergencji</b> (biedniejsi nadrabiają), a państwa wolą <b>współpracować niż walczyć</b> (kompleksowa współzależność).",real:"'Im więcej globalizacji, tym lepiej.' Kapitał nie ma narodowości — kraje muszą się dostosować.",mnemo:"Liberalizm: napędza <b>RYNEK</b>, priorytet = <b>EFEKTYWNOŚĆ</b>, państwo = rola <b>ograniczona</b>."},
      {title:"Realizm — 'liczą się państwa i siła'",body:"Najważniejsi aktorzy to <b>państwa</b>, a ich cel to <b>bezpieczeństwo i siła</b>. Globalizacja jest <b>narzędziem</b> zwiększania potęgi. Świat = system <b>rywalizujących państw</b>, nie współpracujących rynków. Trwa tylko, gdy zgadza się z interesem najsilniejszych.",real:"Wojny handlowe, sankcje, kontrola eksportu chipów, USA vs Chiny, friend-shoring. Bezpieczeństwo > tania cena.",mnemo:"Realizm: napędza <b>PAŃSTWO</b>, priorytet = <b>BEZPIECZEŃSTWO</b>, państwo = rola <b>kluczowa</b>."},
      {title:"Instytucjonalizm (neoliberalizm)",body:"Globalizacja generuje chaos — <b>instytucje</b> (ONZ, WTO, MFW, NATO) tworzą zasady i normy, dostarczają wiarygodnych informacji, zmniejszają ryzyko oszustwa. Państwa współpracują nie dlatego, że 'są dobre', ale bo <b>im się to opłaca</b>.",real:"Reguły > dobra wola. Instytucje to 'sędzia i tablica wyników', dzięki którym opłaca się grać fair."},
      {title:"Podejście krytyczne",body:"Globalizacja = rozszerzenie <b>kapitalizmu/neoliberalizmu</b> → pogłębia <b>nierówności</b>. Świat dzieli się na <b>centrum</b> (Zachód) i <b>peryferie</b>. Napędza ją kapitał (korporacje, rynki finansowe) i interesy elit; osłabia suwerenność biedniejszych.",real:"Outsourcing do tańszych krajów, niskie płace globalnego Południa, zyski w centrum, dominacja Big Tech."},
      {title:"Konstruktywizm — 'globalizacja jest tym, co o niej myślimy'",body:"Globalizacja <b>nie jest 'dana'</b> — jest tworzona przez <b>idee</b> (wolny handel), <b>normy</b> (prawa człowieka, klimat) i <b>przekonania</b> (świat bez granic). Interesy państw <b>nie są stałe</b>.",real:"Dlaczego w latach 90. globalizacja była 'dobra', a dziś 'problematyczna'? Bo zmieniło się to, jak o niej myślimy."}
     ],
     flashcards:[
      {t:"Liberalizm (teoria globalizacji)",d:"Globalizacja = naturalny, pozytywny efekt rynku i technologii. Napęd: technologia, rynek, kapitał. Prowadzi do konwergencji; współzależność skłania państwa do współpracy. Napędza rynek, priorytet efektywność, rola państwa ograniczona."},
      {t:"Realizm (teoria globalizacji)",d:"Państwa to główni aktorzy; cel = bezpieczeństwo i siła. Globalizacja to narzędzie potęgi. Napędza państwo, priorytet bezpieczeństwo, rola państwa kluczowa. Tłumaczy wojny handlowe, sankcje, friend-shoring."},
      {t:"Instytucjonalizm / neoliberalizm",d:"Instytucje (ONZ, WTO, MFW, NATO) porządkują chaos globalizacji, dostarczają informacji i zmniejszają ryzyko oszustwa. Państwa współpracują, bo to się opłaca (zyski + bezpieczeństwo)."},
      {t:"Podejście krytyczne",d:"Globalizacja = rozszerzenie kapitalizmu/neoliberalizmu, pogłębia nierówności. Podział świata na centrum i peryferie; napędza ją kapitał i interesy elit. Tłumaczy nierówności, ale ignoruje wzrost gospodarczy."},
      {t:"Konstruktywizm",d:"Globalizacja jest społecznie konstruowana przez idee, normy i przekonania; interesy państw nie są stałe. Świat konstruktywistów to świat idei."},
      {t:"Liberalizm vs realizm (tabela)",d:"Co napędza? rynek vs państwo. Co ma priorytet? efektywność vs bezpieczeństwo. Rola państwa? ograniczona vs kluczowa."},
      {t:"Krytyka liberalizmu",d:"Tłumaczy wzrost handlu po 1945, sukces globalnych firm i tygrysów azjatyckich, ALE: ignoruje politykę, zakłada, że wszyscy korzystają, nie przewidział kryzysu 2008 ani wojen handlowych."}
     ],
     quiz:[
      {q:"Według liberalizmu globalizację napędza przede wszystkim:",a:["państwo i jego siła","rynek, technologia i kapitał","instytucje międzynarodowe","interesy elit i kapitał (nierówności)"],c:1,e:"Liberalizm: rynek + technologia + kapitał; priorytet efektywność, rola państwa ograniczona."},
      {q:"Realizm najlepiej tłumaczy:",a:["konwergencję biednych krajów","wojny handlowe, sankcje, kontrolę eksportu technologii, friend-shoring","zanik roli państw","świat idei i norm"],c:1,e:"Realizm: liczą się państwa, siła i bezpieczeństwo — stąd sankcje i wojny handlowe."},
      {q:"Podejście krytyczne opisuje globalizację jako:",a:["naturalny, korzystny proces dla wszystkich","dominację centrum (Zachodu) nad peryferiami, pogłębiającą nierówności","chaos porządkowany przez instytucje","zbiór idei i przekonań"],c:1,e:"Krytycyzm: kapitalizm + podział centrum–peryferie + nierówności."},
      {q:"Kluczowa teza konstruktywizmu:",a:["globalizacja jest 'dana' i niezmienna","globalizacja jest konstruowana przez idee, normy i przekonania; interesy państw nie są stałe","liczy się tylko rynek","liczy się tylko siła militarna"],c:1,e:"Dlatego w latach 90. globalizacja była 'dobra', a dziś 'problematyczna'."},
      {q:"Wg instytucjonalizmu państwa współpracują, ponieważ:",a:["są z natury dobre","współpraca instytucjonalna po prostu im się opłaca (zyski i bezpieczeństwo)","zmusza je do tego jedno mocarstwo","nie mają wojska"],c:1,e:"Instytucje zmniejszają ryzyko oszustwa i dostarczają informacji — kooperacja się opłaca."}
     ]},
    /* ---------------- L4 ---------------- */
    {id:"l4",title:"Polityka i global governance",emoji:"🏛️",
     feed:[
      {title:"Państwa wracają do gry",body:"Po dekadach 'rynek załatwi wszystko' państwo znów sięga po narzędzia: <b>regulacje, polityka handlowa, sankcje, subsydia, bariery handlowe, kontrole eksportu</b>.",real:"Widmo neoliberalizmu odchodzi. Rząd znów ustawia stół, a nie tylko sprząta po rynku."},
      {title:"Global governance — co to jest",body:"<b>Globalne zarządzanie</b> = sposób koordynowania zasad, norm i działań między państwami, organizacjami, firmami i innymi aktorami, by rozwiązywać problemy <b>przekraczające granice</b> (klimat, handel, zdrowie, prawa człowieka).",real:"Nie ma rządu światowego, ale są 'reguły gry'. Zarządzanie bez jednego szefa.",mnemo:"Global governance = <b>rządzenie bez rządu</b> — sieć, nie hierarchia."},
      {title:"Usieciowienie zamiast hierarchii",body:"Cecha global governance: <b>rezygnacja z hierarchii</b>. Więzi wertykalne ustępują <b>horyzontalnym</b> — współpracują autonomiczne podmioty. Rośnie rola prywatnych ciał (ISO, ICANN, IASB, FSC) i korporacji ponadnarodowych.",real:"Świat rządzony jak sieć znajomości, nie jak wojsko. Nikt nie wydaje rozkazów — wszyscy się dogadują (albo nie)."},
      {title:"Rola instytucji — 4 funkcje",body:"🛡️ <b>Stabilność</b>: MFW (pożyczki), Bank Światowy, Komitet Bazylejski (normy dla banków).<br>🔮 <b>Przewidywalność</b>: WTO (zasady handlu), OECD (podatki), IFRS/IASB (rachunkowość).<br>🤝 <b>Koordynacja</b>: WHO (pandemie), UNFCCC (klimat), G20 (polityka makro).<br>⚖️ <b>Rozwiązywanie sporów</b>: WTO DSU, ICSID (arbitraż inwestycyjny), MTS w Hadze.",mnemo:"4 funkcje: <b>Stabilność · Przewidywalność · Koordynacja · Spory</b>."},
      {title:"Kryzys instytucji — paraliż WTO",body:"<b>USA</b>: WTO nie radzi sobie z krajem o gospodarce nie w pełni rynkowej (subsydia Chin). <b>Chiny</b>: USA łamią zasady, nakładając jednostronne cła. <b>Fakt</b>: USA <b>zablokowały obsadzanie sędziów odwoławczych (2019–2023)</b> → WTO działa, ale nie egzekwuje odwołań.",real:"Sędzia jest, ale bez asystentów VAR — wyroki zapadają, tylko nikt ich nie wdroży. Instytucja słabnie.",mnemo:"Kryzys: <b>paraliż WTO + unilateralizm państw + spadek zaufania</b>."},
      {title:"Plurilateralizm i nowe bloki",body:"Obok WTO rosną kluby: <b>BRICS</b> (Brazylia, Rosja, Indie, Chiny, RPA), <b>QUAD</b> (USA, Japonia, Indie, Australia), <b>SCO</b> (Szanghajska Org. Współpracy), <b>G20</b> jako 'rząd globalizacji'. Bloki handlowe: RCEP, USMCA, IPEF, UE–Mercosur.",real:"Zamiast jednej wielkiej ligi (WTO) — coraz więcej mniejszych klubów 'dla swoich'."}
     ],
     flashcards:[
      {t:"Global governance (globalne zarządzanie)",d:"Koordynacja zasad, norm i działań między państwami, organizacjami, firmami i innymi aktorami, by rozwiązywać problemy przekraczające granice (klimat, handel, zdrowie). Nie ma rządu światowego, ale są globalne reguły."},
      {t:"Usieciowienie global governance",d:"Rezygnacja z hierarchii — więzi wertykalne ustępują horyzontalnym; współpracują autonomiczne podmioty, rośnie rola ciał prywatnych (ISO, ICANN, IASB, FSC) i korporacji."},
      {t:"4 funkcje instytucji globalnych",d:"Stabilność (MFW, Bank Światowy, Bazylea), przewidywalność (WTO, OECD, IFRS), koordynacja (WHO, UNFCCC, G20), rozwiązywanie sporów (WTO DSU, ICSID, MTS w Hadze)."},
      {t:"MFW vs Bank Światowy",d:"MFW = pożyczki stabilizacyjne i nadzór makroekonomiczny (bezpiecznik walutowy/finansowy). Bank Światowy = finansowanie rozwoju."},
      {t:"Paraliż WTO (2019–2023)",d:"USA zablokowały obsadzanie sędziów Organu Apelacyjnego → WTO działa, ale nie może egzekwować odwołań w sporach handlowych. Efekt: osłabienie instytucji."},
      {t:"Plurilateralizm",d:"Wielostronność w węższym gronie — kluby zamiast globalnej organizacji: BRICS, QUAD, RIC, SCO. Także bloki handlowe: RCEP, USMCA, IPEF."},
      {t:"Kryzys instytucji",d:"Trzy objawy: paraliż WTO, unilateralizm państw (działanie w pojedynkę), spadek zaufania do instytucji."}
     ],
     quiz:[
      {q:"Global governance najlepiej opisać jako:",a:["światowy rząd z armią","rządzenie bez rządu — sieć reguł i norm koordynujących państwa, firmy i organizacje","wyłącznie działania ONZ","synonim WTO"],c:1,e:"Nie ma rządu światowego, ale są globalne reguły — koordynacja bez hierarchii."},
      {q:"Na czym polega paraliż WTO (2019–2023)?",a:["WTO została rozwiązana","USA zablokowały obsadzanie sędziów odwoławczych → brak egzekucji odwołań","Chiny wystąpiły z WTO","zniesiono wszystkie cła"],c:1,e:"Organ Apelacyjny bez sędziów — spory się toczą, ale odwołań nie da się rozstrzygnąć."},
      {q:"Która instytucja pełni funkcję STABILNOŚCI (bezpiecznik finansowy)?",a:["WHO","MFW (pożyczki stabilizacyjne, nadzór makro)","UNFCCC","WTO DSU"],c:1,e:"Stabilność: MFW, Bank Światowy, Komitet Bazylejski. WHO = koordynacja zdrowia."},
      {q:"BRICS, QUAD i SCO to przykłady:",a:["korporacji ponadnarodowych","plurilateralizmu — współpracy w węższym gronie zamiast globalnej organizacji","agend ONZ","banków centralnych"],c:1,e:"Plurilateralizm = kluby 'dla swoich' obok uniwersalnej WTO."},
      {q:"'Państwa wracają do gry' oznacza powrót narzędzi takich jak:",a:["tylko obniżki podatków","regulacje, sankcje, subsydia, bariery handlowe, kontrole eksportu","likwidacja ceł","prywatyzacja wszystkiego"],c:1,e:"Odwrót od neoliberalnego 'rynek załatwi wszystko' ku aktywnej roli państwa."}
     ]},
    /* ---------------- L5 ---------------- */
    {id:"l5",title:"Mocarstwa i konkurencyjność",emoji:"⚔️",
     feed:[
      {title:"Walka o to, czyje będą reguły",body:"Nie ma rządu światowego, ale są reglobalne reguły — i trwa walka, <b>kto je ustala</b>. 🇪🇺 <b>UE</b> — wpływ <b>regulacyjny</b>. 🇺🇸 <b>USA</b> — technologiczno-finansowy. 🇨🇳 <b>Chiny</b> — infrastrukturalno-przemysłowy. 🇷🇺 <b>Rosja</b> — surowcowo-geopolityczny.",real:"Zwycięzca standardów (AI, ESG, technologie, handel) zgarnia przewagę konkurencyjną. Kto pisze reguły, ten wygrywa mecz.",mnemo:"UE=regulacje · USA=tech+finanse · Chiny=przemysł · Rosja=surowce."},
      {title:"Efekt brukselski",body:"Zjawisko, w którym <b>regulacje i standardy UE stają się globalnymi normami</b>. Dzięki ogromnemu jednolitemu rynkowi firmy spoza Europy dostosowują produkty do wymogów UE, by móc tu sprzedawać. Przykłady: <b>RODO/GDPR, AI Act, CBAM, ESG</b>.",real:"UE nie narzuca prawa siłą, tylko atrakcyjnością rynku (soft power). Chcesz sprzedawać 450 mln ludziom? Grasz wg zasad Brukseli.",mnemo:"Efekt brukselski = <b>eksport regulacji przez wielkość rynku</b>."},
      {title:"USA — dolar, Big Tech, sankcje",body:"Siła USA: <b>dominacja dolara</b> (efekt dolara — mocny USD czyni świat biedniejszym i droższy import), <b>Big Tech</b> (Google, Apple, Microsoft, Amazon), <b>kontrola technologii</b> (eksport chipów do Chin), <b>sankcje finansowe</b> (SWIFT), chmura.",real:"Dolar to broń. Wyłączenie ze SWIFT boli bardziej niż niejedna sankcja celna."},
      {title:"Chiny i Rosja",body:"🇨🇳 <b>Chiny</b>: Inicjatywa <b>Pasa i Szlaku</b> (2013), dominacja przemysłowa, kontrola <b>surowców krytycznych</b>, skala rynku wewnętrznego.<br>🇷🇺 <b>Rosja</b>: eksport <b>surowców energetycznych</b>, geopolityka, destabilizacja rynków.",real:"Chiny budują świat betonem i fabrykami; Rosja gra gazem i chaosem."},
      {title:"Konkurencyjność państwa",body:"<b>Zdolność gospodarki do tworzenia trwałego wzrostu dobrobytu i przewag międzynarodowych</b> — konkurowania na rynkach przy utrzymaniu wysokiego poziomu życia. Buduje ją: <b>technologia, kapitał ludzki, instytucje, infrastruktura, innowacje, stabilność państwa i prawa</b>.",real:"Konkurencyjność to NIE samo PKB. Coraz bardziej zależy od odporności, technologii i bezpieczeństwa (np. półprzewodniki)."},
      {title:"Polska: hub produkcyjny i pułapka średniego dochodu",body:"Polska (OECD TiVA) = silnie wpięta w globalne łańcuchy jako <b>producent/montażysta</b>, głównie w niemieckim hubie. Dużo <b>zagranicznej</b> wartości dodanej w eksporcie, mało własnej. <b>Pułapka średniego dochodu</b>: po szybkim wzroście na taniej pracy kraj traci impet i nie awansuje do grona bogatych. Nadzieja: <b>konwergencja</b> i innowacyjność.",real:"Jesteśmy montownią Europy. Wyzwanie to AWANS w łańcuchu wartości (własne technologie/marki), nie ucieczka z niego.",mnemo:"Pułapka średniego dochodu = <b>tania praca się wypaliła, a innowacji brak</b>."}
     ],
     flashcards:[
      {t:"Cztery ośrodki władzy globalnej",d:"UE — wpływ regulacyjny; USA — technologiczno-finansowy; Chiny — infrastrukturalno-przemysłowy; Rosja — surowcowo-geopolityczny."},
      {t:"Efekt brukselski",d:"Regulacje i standardy UE stają się globalnymi normami, bo firmy spoza UE dostosowują produkty do wymogów wielkiego rynku wewnętrznego (soft power, nie siła). Przykłady: RODO, AI Act, CBAM, ESG."},
      {t:"Siła USA w gospodarce globalnej",d:"Dominacja dolara (efekt dolara), Big Tech (Google, Apple, Microsoft, Amazon), kontrola eksportu technologii (chipy), sankcje finansowe (SWIFT), chmura."},
      {t:"Inicjatywa Pasa i Szlaku (2013)",d:"Chiński program inwestycji w infrastrukturę (porty, koleje, drogi) łączący Azję, Europę i Afrykę — narzędzie wpływu infrastrukturalno-przemysłowego Chin."},
      {t:"Konkurencyjność państwa",d:"Zdolność gospodarki do trwałego wzrostu dobrobytu i przewag międzynarodowych przy wysokim poziomie życia. Buduje ją: technologia, kapitał ludzki, instytucje, infrastruktura, innowacje, stabilność."},
      {t:"Pozycja Polski w GVC",d:"Ogniwo produkcyjno-montażowe (hub produkcyjny), głównie w niemieckim hubie. Dużo zagranicznej wartości dodanej w eksporcie, rzadko dostarcza kluczowe technologie/marki. Wyzwanie: awans w łańcuchu wartości."},
      {t:"Pułapka średniego dochodu",d:"Kraj po szybkim wzroście (tania praca + import technologii) traci impet i nie awansuje do gospodarek wysokorozwiniętych: wypalenie przewag kosztowych, brak innowacji, niska wydajność."},
      {t:"Konwergencja",d:"Proces, w którym uboższe kraje/regiony rozwijają się szybciej niż bogate, zmniejszając różnice w PKB na mieszkańca i standardzie życia."}
     ],
     quiz:[
      {q:"Efekt brukselski polega na tym, że:",a:["UE narzuca prawo siłą militarną","standardy UE stają się globalne, bo firmy dostosowują się do wielkiego rynku wewnętrznego","Bruksela obniża cła do zera","UE kopiuje regulacje z USA"],c:1,e:"Soft power rynku: RODO, AI Act, CBAM, ESG stają się światowymi normami."},
      {q:"Który ośrodek kojarzymy z 'wpływem regulacyjnym'?",a:["USA","UE","Chiny","Rosja"],c:1,e:"UE = regulacje; USA = tech+finanse; Chiny = przemysł; Rosja = surowce."},
      {q:"Pułapka średniego dochodu to sytuacja, gdy kraj:",a:["ma za wysokie płace od startu","po wzroście na taniej pracy traci impet i nie awansuje do bogatych (brak innowacji)","jest za bogaty, by rosnąć","nie ma dostępu do morza"],c:1,e:"Wypalenie przewag kosztowych + brak inwestycji w innowacje i edukację."},
      {q:"Pozycja Polski w globalnych łańcuchach wartości to głównie:",a:["centrum technologiczne dostarczające kluczowe komponenty","ogniwo produkcyjno-montażowe ('hub produkcyjny'), mocno wpięte w niemiecki hub","kraj poza łańcuchami globalnymi","eksporter wyłącznie surowców"],c:1,e:"Dużo zagranicznej wartości dodanej; wyzwanie = awans w łańcuchu, nie jego opuszczenie."},
      {q:"Konkurencyjność państwa w XXI w. zależy CORAZ BARDZIEJ od:",a:["wyłącznie wielkości PKB","odporności, technologii i bezpieczeństwa (np. półprzewodniki), nie tylko kosztów","liczby ludności","powierzchni kraju"],c:1,e:"Przejście od 'najtaniej' do 'bezpiecznie i odpornie'."}
     ]},
    /* ---------------- L6 ---------------- */
    {id:"l6",title:"Wymiar społeczno-kulturowy",emoji:"🎭",
     feed:[
      {title:"Wymiar społeczny i 'problem szczęścia'",body:"Globalizacja tworzy <b>społeczeństwo informacyjne</b>, w którym rządzi <b>klasa kreatywna</b>, wiedza i kapitał intelektualny. Paradoks Easterlina: wyższy dochód zwiększa satysfakcję, ale <b>po ok. 10 000 USD</b> dodatkowy dochód niewiele już zmienia.",real:"Kasa daje szczęście — do pewnego progu. Potem wykres się wypłaszcza. Wzorce konsumpcji z bogatych krajów rodzą alienację i frustrację."},
      {title:"Jakość życia i wskaźniki",body:"<b>Jakość życia</b> = stopień zaspokojenia potrzeb materialnych i niematerialnych. Mierniki: <b>HDI</b> (ONZ: dochód + długość życia + lata nauki), <b>World Happiness Index</b>, Quality of Life Index (Numbeo). Z HDI narodziła się <b>ekonomia szczęścia</b>.",real:"HDI to 'PKB z duszą' — dorzuca zdrowie i edukację do samych pieniędzy."},
      {title:"Nie ufaj rankingom bezkrytycznie",body:"Problemy wskaźników: 📏 <b>trudność pomiaru</b> (HDI używa średnich lat nauki jako proxy jakości edukacji), 🎯 <b>uprzedzenia i wagi</b> autorów (im złożniejszy indeks, tym więcej arbitralnych decyzji), 🎭 <b>działania 'pod ranking'</b> (reformy poprawiające wynik, ale nie życie ludzi).",real:"Ranking to model, nie prawda objawiona. Rządy potrafią 'grać pod tabelkę' zamiast realnie poprawiać życie."},
      {title:"Migracje i drenaż mózgów",body:"Migracje zarobkowe, studenci, globalny rynek pracy. <b>Drenaż mózgów</b>: najlepiej wykształceni i przedsiębiorczy emigrują do <b>centrów globalizacji</b> — oni zyskują, ale kraj pochodzenia <b>traci kapitał intelektualny</b>. Ryzyka: napięcia społeczne, kryzys tożsamości.",real:"Twój najzdolniejszy znajomy z roku wyjeżdża do Londynu. On wygrywa, Polska traci mózg."},
      {title:"Globalna wioska i kultura",body:"<b>Marshall McLuhan</b>: elektroniczna współzależność czyni świat <b>globalną wioską</b> (natychmiastowa komunikacja, wspólne trendy — niekoniecznie harmonia). Kultura: <b>HOMOGENIZACJA</b> (McDonald's, Netflix) vs <b>HYBRYDYZACJA</b> (K-pop, anime, lokalne wersje globalnych produktów).",real:"Świat = jedna wioska z wi-fi. Ale lokalne tożsamości nie znikają — mieszają się (hybrydyzacja)."},
      {title:"Soft power i antyglobalizm",body:"<b>Soft power</b> — zdolność zdobywania wpływów <b>atrakcyjnością</b> (film, muzyka, kuchnia, moda), nie przymusem. Nowi eksporterzy kultury: USA, <b>Korea Płd.</b>, Japonia, Indie. <b>Antyglobalizm</b> — ruch przeciw dominacji korporacji, nierównościom i narzucaniu reform przez MFW/BŚ/WTO.",real:"K-pop i Hollywood to broń miękka. A social media rozkręciły globalizację kultury szybciej niż handel — kosztem baniek i polaryzacji."}
     ],
     flashcards:[
      {t:"Społeczeństwo informacyjne",d:"Społeczeństwo skutecznie komunikujące się z otoczeniem, w którym wiodącą rolę odgrywa klasa kreatywna, kapitał intelektualny, wiedza i twórczość jako źródło bogactwa."},
      {t:"Problem szczęścia (paradoks Easterlina)",d:"Wyższy dochód zwiększa satysfakcję życiową, ale po przekroczeniu ok. 10 000 USD dodatkowy wzrost dochodu w niewielkim stopniu podnosi satysfakcję społeczeństwa."},
      {t:"HDI (Human Development Index)",d:"Wskaźnik ONZ łączący dochód, długość życia i liczbę lat nauki. Zapoczątkował porównywanie rozwoju społecznego i ekonomię szczęścia; efekt: World Happiness Index."},
      {t:"Ograniczenia rankingów/wskaźników",d:"Trudność pomiaru (miary zastępcze, np. lata nauki jako proxy jakości edukacji), uprzedzenia i arbitralne wagi autorów, działania krajów 'pod ranking' zamiast realnej poprawy życia."},
      {t:"Drenaż mózgów (brain drain)",d:"Emigracja najlepiej wykształconych, zdolnych i przedsiębiorczych do centrów globalizacji. Emigranci zyskują, ale kraj pochodzenia traci kapitał intelektualny."},
      {t:"Globalna wioska (McLuhan)",d:"Elektroniczna współzależność kształtuje świat na podobieństwo jednej wioski: natychmiastowa komunikacja, wspólna przestrzeń medialna, globalne trendy — niekoniecznie harmonia."},
      {t:"Homogenizacja vs hybrydyzacja",d:"Homogenizacja = ujednolicanie kultury (McDonald's, Netflix, TikTok). Hybrydyzacja = mieszanie i lokalne adaptacje globalnych wzorców (K-pop, anime, lokalne wersje produktów)."},
      {t:"Soft power",d:"Zdolność państwa do zdobywania wpływów i sojuszników przez atrakcyjność kulturową, polityczną i ideową (film, muzyka, kuchnia, moda), a nie przymus. Eksporterzy: USA, Korea Płd., Japonia, Indie."},
      {t:"Antyglobalizm",d:"Ruch społeczno-polityczny przeciw globalizacji (zwł. ekonomicznej i korporacyjnej): krytyka dominacji korporacji, nierówności, wyzysku słabszych i reform narzucanych przez MFW, Bank Światowy i WTO."}
     ],
     quiz:[
      {q:"Paradoks Easterlina ('problem szczęścia') mówi, że:",a:["dochód nigdy nie wpływa na szczęście","po ok. 10 000 USD dodatkowy dochód niewiele już podnosi satysfakcję życiową","bogatsi są zawsze nieszczęśliwi","szczęście zależy tylko od PKB"],c:1,e:"Dochód podnosi satysfakcję do progu ~10 000 USD, potem wykres się wypłaszcza."},
      {q:"HDI (ONZ) łączy:",a:["tylko PKB per capita","dochód, długość życia i liczbę lat nauki","emisje CO₂ i inflację","liczbę turystów i eksport"],c:1,e:"HDI = 'PKB z duszą' — dorzuca zdrowie i edukację."},
      {q:"Drenaż mózgów oznacza, że:",a:["kraj zyskuje specjalistów z zagranicy","najzdolniejsi emigrują do centrów globalizacji, a kraj pochodzenia traci kapitał intelektualny","spada liczba studentów","rośnie bezrobocie wśród niewykształconych"],c:1,e:"Emigrant zyskuje, kraj wysyłający traci mózgi."},
      {q:"Homogenizacja i hybrydyzacja kultury to:",a:["dwa słowa na to samo","ujednolicanie (McDonald's/Netflix) vs mieszanie i lokalne adaptacje (K-pop/anime)","nazwy instytucji ONZ","rodzaje ceł"],c:1,e:"Kultura i się ujednolica, i tworzy hybrydy — jednocześnie."},
      {q:"Soft power to:",a:["siła militarna","zdolność zdobywania wpływów atrakcyjnością kultury i idei, nie przymusem","miękka waluta","program pomocy żywnościowej"],c:1,e:"Hollywood, K-pop, kuchnia, moda — wpływ bez przymusu. Eksporterzy: USA, Korea, Japonia, Indie."}
     ]},
    /* ---------------- L7 ---------------- */
    {id:"l7",title:"Ekonomia i regionalizacja",emoji:"🔗",
     feed:[
      {title:"Wymiar ekonomiczny i GVC",body:"<b>Wymiar ekonomiczny</b> = rosnąca integracja gospodarek przez handel, inwestycje zagraniczne, przepływy finansowe i <b>globalne łańcuchy wartości (GVC)</b> — produkcja jednego wyrobu rozproszona po wielu krajach.",real:"Twój telefon to ONZ w kieszeni: projekt w USA, chip z Tajwanu, montaż w Chinach, minerały z Afryki."},
      {title:"Od efektywności do odporności",body:"Globalizacja przechodzi <b>od logiki efektywności do logiki bezpieczeństwa</b>. Nowe priorytety: <b>od just-in-time do just-in-case</b>, od 'najtańszy dostawca' do 'najbardziej niezawodny', od globalnych łańcuchów do <b>regionalnych ekosystemów</b>.",real:"COVID i Ever Given nauczyły firmy: taniej ≠ pewniej. Lepiej mieć bufor niż stać z pustą fabryką.",mnemo:"Nowy paradygmat: <b>Just-in-CASE</b>, nie just-in-time."},
      {title:"Dywersyfikacja — 5 wymiarów",body:"Budowanie odporności = zmniejszanie uzależnienia od jednego kraju/dostawcy. Dywersyfikuj: 🌍 <b>geograficznie</b>, 🏭 <b>dostawców</b> (multi/dual sourcing), 🚢 <b>transport/logistyka</b>, ⚙️ <b>technologie/komponenty</b>, 🛒 <b>klientów i rynki zbytu</b>.",real:"Nie trzymaj wszystkich jajek w jednym chińskim koszyku. Rozłóż ryzyko na kilka."},
      {title:"Cztery '-shoringi'",body:"<b>Offshoring</b> — produkcja do krajów niskokosztowych (stara logika).<br><b>Nearshoring</b> — skracanie dystansu geograficznego.<br><b>Reshoring</b> — powrót produkcji do kraju.<br><b>Friend-shoring</b> — do państw sojuszniczych / stabilnych politycznie.<br>Przykłady: półprzewodniki, farmacja, motoryzacja.",real:"Off = daleko i tanio. Near = bliżej. Re = do domu. Friend = do kumpli. Trend idzie od 'off' ku reszcie.",mnemo:"<b>OFF → NEAR → RE → FRIEND</b>: coraz bliżej i coraz bezpieczniej."},
      {title:"Regionalizacja i bloki handlowe",body:"Gospodarka staje się bardziej <b>regionalna</b>. Kluczowe bloki: <b>UE</b>, <b>ASEAN</b> (Azja Płd.-Wsch.), <b>USMCA</b> (USA-Meksyk-Kanada, zastąpiło NAFTA), <b>Mercosur</b> (Ameryka Płd.), <b>RCEP</b> (Azja-Pacyfik — <b>największa strefa wolnego handlu świata</b>).",real:"Zamiast jednego globalnego rynku — kilka wielkich 'dzielnic'. RCEP to nowy rekordzista.",mnemo:"UE · ASEAN · USMCA · Mercosur · RCEP (największy)."},
      {title:"Deglobalizacja — dlaczego regiony rosną",body:"Napęd deglobalizacji: kryzys 2008, Brexit, pandemia, <b>trumpizm</b> ('amerykanizm, nie globalizm'), wojna w Ukrainie, napięcia USA–Chiny, <b>splinternet</b> (podzielony internet). Regionalizacja rośnie przez: <b>bezpieczeństwo, krótsze łańcuchy, geopolitykę i odporność</b>.",real:"Świat nie tyle się rozłącza, co przełącza na tryb 'regionalny i bezpieczny'. Multipolarność: USA, Chiny, UE, Indie, Global South."}
     ],
     flashcards:[
      {t:"Globalne łańcuchy wartości (GVC)",d:"Rozproszenie produkcji jednego wyrobu po wielu krajach (projekt, komponenty, montaż w różnych miejscach). Rdzeń ekonomicznego wymiaru globalizacji."},
      {t:"Od efektywności do bezpieczeństwa",d:"Motyw przewodni: od just-in-time do just-in-case, od 'najtańszy dostawca' do 'najbardziej niezawodny', od globalnych łańcuchów do regionalnych ekosystemów technologicznych."},
      {t:"Dywersyfikacja łańcuchów — 5 wymiarów",d:"Geograficzna, dostawców (multi/dual sourcing), transportu i logistyki, technologii i komponentów, klientów i rynków zbytu. Cel: mniejsze uzależnienie i odporność na szoki."},
      {t:"Offshoring / Nearshoring / Reshoring / Friend-shoring",d:"Offshoring = produkcja w krajach niskokosztowych; nearshoring = skracanie dystansu; reshoring = powrót do kraju; friend-shoring = do państw sojuszniczych/stabilnych."},
      {t:"RCEP",d:"Regionalne Kompleksowe Partnerstwo Gospodarcze — Azja i Pacyfik (ASEAN + Chiny, Japonia, Korea Płd., Australia, Nowa Zelandia). Największa strefa wolnego handlu na świecie."},
      {t:"USMCA i Mercosur",d:"USMCA = porozumienie USA–Meksyk–Kanada (zastąpiło NAFTA). Mercosur = Wspólny Rynek Południa (Brazylia, Argentyna, Urugwaj, Paragwaj)."},
      {t:"Slowbalisation / deglobalizacja",d:"Spowolnienie i cofanie integracji po 2008: kryzys finansowy, Brexit, pandemia, trumpizm, wojna w Ukrainie, napięcia USA–Chiny, splinternet."},
      {t:"Splinternet",d:"Podzielony, rozfragmentowany internet — efekt regionalizacji i geopolityki (różne regulacje, ekosystemy i ograniczenia w różnych blokach)."}
     ],
     quiz:[
      {q:"'Od just-in-time do just-in-case' opisuje przejście:",a:["od odporności do efektywności","od maksymalnej efektywności do maksymalnej odporności łańcuchów dostaw","od handlu do autarkii","od regionalizacji do globalizacji"],c:1,e:"Nowy paradygmat: bufory i niezawodność ważniejsze niż sama taniość."},
      {q:"Friend-shoring to przenoszenie produkcji:",a:["do najtańszych krajów świata","do państw sojuszniczych / stabilnych politycznie","z powrotem do własnego kraju","na inny kontynent dla niższych kosztów"],c:1,e:"Friend-shoring = 'do kumpli'. Reshoring = do kraju; nearshoring = bliżej; offshoring = tanio."},
      {q:"Która strefa jest największą strefą wolnego handlu na świecie?",a:["UE","USMCA","RCEP","Mercosur"],c:2,e:"RCEP: ASEAN + Chiny, Japonia, Korea Płd., Australia, Nowa Zelandia."},
      {q:"USMCA zastąpiło wcześniejszy układ:",a:["ASEAN","NAFTA","Mercosur","RCEP"],c:1,e:"USMCA (USA–Meksyk–Kanada) weszło w miejsce NAFTA."},
      {q:"Dlaczego rośnie znaczenie regionalizacji?",a:["bo znika bezpieczeństwo jako priorytet","przez bezpieczeństwo, krótsze łańcuchy dostaw, geopolitykę i odporność gospodarki","bo spadły ceny transportu","bo zniesiono wszystkie cła"],c:1,e:"Regiony = krótsze, pewniejsze łańcuchy w niestabilnym, multipolarnym świecie."}
     ]}
  ]
});
