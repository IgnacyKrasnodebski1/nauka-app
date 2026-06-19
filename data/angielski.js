/* ============================================================
   PRZEDMIOT: Angielski biznesowy B2+ — Business Partner B2 (Pearson)
   ZAKRES: UNIT 3 (Finance) + UNIT 4 (Digital business)
   Słownictwo i gramatyka SPRAWDZONE 1:1 ze zdjęciami stron podręcznika (ramki Vocabulary/Grammar/Functional language).
   Gramatyka z kanału: tryby warunkowe (Unit 4.2) + alternatywy do "if". Prowadzący: Przemysław Cygan.
   ============================================================ */
window.SUBJECTS = window.SUBJECTS || [];
window.SUBJECTS.push({
  id:"angielski",
  name:"Angielski B2+ (Unit 3 & 4)",
  short:"English",
  emoji:"🇬🇧",
  tagline:"Business Partner B2 — Unit 3 Finance + Unit 4 Digital Business + tryby warunkowe. Słówka 1:1 z książki.",
  accent:"linear-gradient(135deg,#1e3a8a,#3b82f6,#06b6d4)",
  accent2:"#3b82f6",
  lang:true,
  grading:{pass:50,examMin:20,scale:[[90,"5 / bdb"],[80,"4,5"],[70,"4 / db"],[60,"3,5"],[50,"3 / dst"]],failLabel:"2 — niezaliczone"},
  info:`
    <div class="zbox"><h3>📕 Zakres</h3>
      <p>Tylko <b>Unit 3 — Finance</b> i <b>Unit 4 — Digital business</b> z <b>Business Partner B2</b> (Pearson). Słownictwo i gramatyka wzięte <b>dokładnie z Twoich zdjęć stron</b> (ramki Vocabulary / Grammar / Functional language). Prowadzący: Przemysław Cygan.</p></div>
    <div class="zbox"><h3>🔑 Gramatyka (priorytet)</h3>
      <p>Tryby warunkowe: zero / first / second + first vs second + alternatywy do „if” (Unit 4.2). Z Unitu 3: certainty & probability + position of adverbs (3.2) i articles a/an/the/ø (3.5).</p></div>
    <div class="zbox"><h3>💰 Unit 3 — Finance</h3>
      <p>3.1 finanse i kryzysy · 3.2 catching up with rivals (certainty/probability) · 3.3 managing bad news · 3.4 telephoning to clarify · 3.5 annual report summary (articles).</p></div>
    <div class="zbox"><h3>💻 Unit 4 — Digital business</h3>
      <p>4.1 digital disruptors (tech + word building) · 4.2 conditionals + linkers · 4.3 handling difficult communicators · 4.4 negotiating strategies · 4.5 short business proposal.</p></div>
    <div class="zbox"><h3>📝 Homework (deadline 20.06)</h3>
      <p>Przeczytać teksty + odpowiedzieć na pytania oraz napisać jedną odpowiedź „Over to you” na <b>150–180 słów</b>. Wysłać przez Teams.</p></div>`,
  levels:[
    /* ===================== CONDITIONALS (Unit 4.2) ===================== */
    {id:"a1",title:"Zero conditional",emoji:"0️⃣",
     feed:[
      {title:"Zero conditional = fakty i prawdy ogólne",body:"Schemat: <b>If + present, … present.</b> Coś <b>zawsze prawdziwego</b>.<br><i>If the food <b>is</b> out of date, I <b>don't eat</b> it.</i>",mnemo:"Zero = zero wątpliwości. <b>if ≈ when</b>."},
      {title:"Przecinek",body:"If na początku → przecinek: <i>If you are talking, I can't concentrate.</i> · Main clause pierwsze → bez przecinka.",real:"Ta sama zasada w zero/first/second."}
     ],
     flashcards:[
      {t:"Zero conditional — schemat",d:"If + present, … present. Prawdy ogólne / fakty."},
      {t:"If you heat ice, it melts.",d:"Jeśli podgrzejesz lód, topnieje. (zero)"},
      {t:"if = when (zero cond.)",d:"Można zamienić 'if' na 'when'."},
      {t:"Przecinek",d:"If na początku → przecinek; main clause na początku → bez."}
     ],
     quiz:[
      {q:"„If you heat water to 100°C, it ___.”",a:["will boil","boils","would boil","boiled"],c:1,e:"Zero: if + present, present → boils."},
      {q:"Zero conditional dotyczy:",a:["hipotezy","prawdy ogólnej / faktu","planu na jutro","przeszłości"],c:1,e:"Coś zawsze prawdziwego."},
      {q:"'if' w zero conditional ≈",a:["when","unless","would","will"],c:0,e:"If ≈ when."},
      {q:"Poprawny przecinek:",a:["I don't drive, if I drink.","If I drink I don't drive.","If I drink, I don't drive.","none"],c:2,e:"If pierwszy → przecinek."}
     ]},
    {id:"a2",title:"First conditional",emoji:"1️⃣",
     feed:[
      {title:"First conditional = realna przyszłość",body:"Schemat: <b>If + present, … will/imperative/modal.</b> Coś <b>prawdopodobnego</b>.<br><i>If you <b>study</b>, you <b>will pass</b>.</i>",mnemo:"Warunek present, skutek <b>will</b> + bezokolicznik."},
      {title:"NIE 'will' po if",body:"<s>If you will study…</s> ❌ → <i>If you study…</i> ✅",real:"Will tylko w części głównej."}
     ],
     flashcards:[
      {t:"First conditional — schemat",d:"If + present, … will/imperative/modal. Realna przyszłość."},
      {t:"If you study, you will pass.",d:"Jeśli będziesz się uczyć, zdasz."},
      {t:"Po 'if' NIE ma 'will'",d:"If you study (✓), nie 'If you will study' (✗)."},
      {t:"'ll / won't",d:"will → 'll; will not → won't."}
     ],
     quiz:[
      {q:"„If it ___ tomorrow, we'll stay home.”",a:["will rain","rains","would rain","rained"],c:1,e:"If + present (rains)."},
      {q:"Które POPRAWNE?",a:["If you will help me, I finish faster.","If you help me, I'll finish faster.","If you help me, I finish faster.","If you helped me, I'll finish faster."],c:1,e:"If + present, will + bezokolicznik."},
      {q:"First conditional opisuje:",a:["nierealne marzenia","realną przyszłość","prawdy ogólne","przeszłość"],c:1,e:"Coś realnie możliwego."},
      {q:"„Jeśli skończysz raport, wyślij mi go.”",a:["If you will finish it, send it.","If you finish the report, send it to me.","If you finished it, send it.","none"],c:1,e:"First + tryb rozkazujący."}
     ]},
    {id:"a3",title:"Second conditional",emoji:"2️⃣",
     feed:[
      {title:"Second conditional = nierealne / hipotetyczne",body:"Schemat: <b>If + past, … would/could/might + bezokolicznik.</b><br><i>If I <b>won</b> the lottery, I <b>would buy</b> a yacht.</i>",mnemo:"Past w 'if', <b>would/could/might</b> w głównej."},
      {title:"'If I were you…'",body:"<b>were</b> dla wszystkich osób: <i>If I <b>were</b> you, I would talk to the boss.</i>",real:"Gotowy zwrot na radę."}
     ],
     flashcards:[
      {t:"Second conditional — schemat",d:"If + past, … would/could/might + bezokolicznik. Nierealne/hipotetyczne."},
      {t:"If I won the lottery, I would buy a yacht.",d:"Gdybym wygrał, kupiłbym jacht."},
      {t:"If I were you, I would…",d:"Na Twoim miejscu bym… ('were' dla każdej osoby)"},
      {t:"would / could / might",d:"would = bym; could = mógłbym; might = może."}
     ],
     quiz:[
      {q:"„If I ___ rich, I would travel the world.”",a:["am","will be","were","be"],c:2,e:"if + past (were), would."},
      {q:"„Gdybym miał czas, pomógłbym ci.”",a:["If I have time, I will help.","If I had time, I would help.","If I had time, I will help.","none"],c:1,e:"if + past, would."},
      {q:"Second conditional = sytuacje:",a:["realne","nierealne / hipotetyczne","zawsze prawdziwe","przeszłe"],c:1,e:"Hipotetyczne/nierealne."},
      {q:"„Na Twoim miejscu bym odszedł”",a:["If I am you, I will leave.","If I was you, I leave.","If I were you, I would leave.","none"],c:2,e:"If I were you, I would + bezokolicznik."}
     ]},
    {id:"a4",title:"First vs Second",emoji:"⚔️",
     feed:[
      {title:"Możliwe vs nierealne",body:"<b>First</b> = możliwe: <i>If I study, I will pass.</i><br><b>Second</b> = nierealne: <i>If I studied medicine, I would become a doctor.</i>",mnemo:"First → present+will. Second → past+would."},
      {title:"Inny dystans",body:"<i>If I have time, I'll call.</i> (realnie) vs <i>If I had time, I'd call.</i> (raczej nie mam).",real:"Wybór pokazuje prawdopodobieństwo."}
     ],
     flashcards:[
      {t:"First = ?",d:"Możliwe/prawdopodobne. If + present, will."},
      {t:"Second = ?",d:"Nierealne/hipotetyczne. If + past, would."},
      {t:"If I have time, I'll call.",d:"Realnie (first)."},
      {t:"If I had time, I'd call.",d:"Raczej nie mam czasu (second)."}
     ],
     quiz:[
      {q:"„Jeśli dostanę podwyżkę (realne), kupię auto.”",a:["If I get a raise, I'll buy a car.","If I got a raise, I'd buy a car.","If I get a raise, I bought a car.","none"],c:0,e:"Realne → first."},
      {q:"„Gdybym był prezesem (nierealne)…”",a:["If I am CEO, I'll…","If I were CEO, I would…","If I was CEO, I change…","none"],c:1,e:"Nierealne → second."},
      {q:"First vs second:",a:["bez różnicy","first=możliwe; second=nierealne","first=przeszłość","first=pytania"],c:1,e:"First realne, second nierealne."},
      {q:"Które = małe prawdopodobieństwo?",a:["If I finish early, I'll join you.","If I finished early, I'd join you.","If I finish early, I join you.","none"],c:1,e:"Second = niskie prawdopodobieństwo."}
     ]},
    {id:"a5",title:"Alternatywy do „if”",emoji:"🔀",
     feed:[
      {title:"unless / in case",body:"<b>unless</b> = if not (chyba że): <i>I won't go <b>unless</b> you go too.</i><br><b>in case</b> = na wypadek gdyby: <i>Take an umbrella <b>in case</b> it rains.</i>",mnemo:"unless = chyba że; in case = na wszelki wypadek (NIE 'jeśli')."},
      {title:"as long as / provided / even if",body:"<b>as long as / provided (that) / providing (that) / on condition that</b> = pod warunkiem że (= only if).<br><b>even if</b> = nawet jeśli. <b>whether or not</b> = niezależnie czy.",real:"provided/providing that = mocniejsze 'only if'."},
      {title:"suppose / supposing",body:"<b>suppose / supposing (that)</b> = załóżmy, że / a gdyby tak.",real:"Często z second conditional."}
     ],
     flashcards:[
      {t:"unless",d:"jeśli nie / chyba że (= if not)."},{t:"in case",d:"na wypadek gdyby (zapobiegawczo)."},
      {t:"as long as / provided (that)",d:"pod warunkiem że (= only if)."},{t:"even if",d:"nawet jeśli."},
      {t:"whether or not",d:"niezależnie czy."},{t:"suppose / supposing",d:"załóżmy, że / a gdyby."}
     ],
     quiz:[
      {q:"„___ you hurry, you'll miss the bus.” (jeśli się nie pospieszysz)",a:["Unless","As long as","Even if","In case"],c:0,e:"unless = if not."},
      {q:"„Weź gotówkę ___ karta nie zadziała.”",a:["unless","in case","provided that","even if"],c:1,e:"in case = na wypadek gdyby."},
      {q:"„Pożyczę ci to, ___ oddasz jutro.”",a:["unless","even if","as long as","whether or not"],c:2,e:"as long as / provided that."},
      {q:"„unless” znaczy:",a:["jeśli","jeśli nie / chyba że","na wypadek gdyby","nawet jeśli"],c:1,e:"unless = if not."}
     ]},
    /* ===================== UNIT 3 — FINANCE 💰 (słówka z książki) ===================== */
    {id:"a6",title:"💰 U3.1: Finanse i kryzysy",emoji:"📉",
     feed:[
      {title:"Vocabulary box (3.1, ćw. 5)",body:"Dokładne słówka z ramki: <b>bankruptcy</b> – bankructwo · <b>credit crunch</b> – kryzys kredytowy · <b>depression</b> – wielki kryzys/depresja · <b>investment</b> – inwestycja · <b>loan</b> – pożyczka · <b>losses</b> – straty · <b>mortgage</b> – kredyt hipoteczny · <b>recession</b> – recesja · <b>savings</b> – oszczędności · <b>stock market</b> – giełda",mnemo:"To są dokładnie słowa z ramki Vocabulary 3.1 — kluczowe na test."},
      {title:"Czasowniki finansowe (3.1)",body:"<b>to go bankrupt</b> – zbankrutować · <b>to bail (sb) out</b> – ratować dofinansowaniem · <b>to recover</b> – wyjść z kryzysu · <b>to invest</b> – inwestować · <b>shares / bonds</b> – akcje / obligacje · <b>interest rates</b> – stopy procentowe · <b>debt</b> – dług · <b>profit</b> – zysk",real:"Wall Street Crash 1929, Black Monday 1987, kryzys 2008 — pojawiają się w tekście/wideo 3.1."}
     ],
     flashcards:[
      {t:"bankruptcy",d:"bankructwo (to go bankrupt = zbankrutować)"},{t:"credit crunch",d:"kryzys kredytowy (banki przestają pożyczać)"},
      {t:"depression",d:"depresja / wielki kryzys gospodarczy"},{t:"investment",d:"inwestycja"},{t:"loan",d:"pożyczka, kredyt"},
      {t:"losses",d:"straty"},{t:"mortgage",d:"kredyt hipoteczny"},{t:"recession",d:"recesja"},{t:"savings",d:"oszczędności"},
      {t:"stock market",d:"giełda papierów wartościowych"},{t:"to bail (sb) out",d:"ratować dofinansowaniem (np. bank)"},
      {t:"to recover",d:"wyjść z kryzysu / odbić się"},{t:"interest rates",d:"stopy procentowe"},{t:"shares / bonds",d:"akcje / obligacje"}
     ],
     quiz:[
      {q:"„credit crunch” to:",a:["wzrost oszczędności","kryzys kredytowy (banki przestają pożyczać)","spłata kredytu","wysoki zysk"],c:1,e:"credit crunch = nagłe ograniczenie dostępu do kredytu."},
      {q:"„mortgage” to:",a:["pożyczka studencka","kredyt hipoteczny","giełda","strata"],c:1,e:"mortgage = kredyt na mieszkanie/dom."},
      {q:"„to go bankrupt” znaczy:",a:["zbankrutować","zainwestować","oszczędzać","odbić się"],c:0,e:"go bankrupt = zbankrutować."},
      {q:"„stock market” to:",a:["sklep","giełda","magazyn","bank centralny"],c:1,e:"stock market = giełda."},
      {q:"„savings” to:",a:["straty","długi","oszczędności","podatki"],c:2,e:"savings = oszczędności."}
     ]},
    {id:"a7",title:"💰 U3.2: Certainty & probability + articles",emoji:"🎯",
     feed:[
      {title:"Catching up with rivals (3.2 słówka)",body:"<b>to boost</b> – zwiększyć/podbić · <b>bottom line</b> – wynik finansowy (zysk/strata) · <b>to make up ground</b> – nadrobić zaległości · <b>to make your mark</b> – zaznaczyć swoją obecność · <b>profitability</b> – rentowność · <b>revenue</b> – przychód · <b>targets</b> – cele",mnemo:"bottom line = ostateczny wynik finansowy firmy."},
      {title:"Expressing certainty & probability (Grammar 3.2)",body:"Pewne: <b>will / won't</b>, <b>is bound to / is certain to</b>.<br>Prawdopodobne: <b>is likely to</b>, <b>will probably</b>.<br>Możliwe: <b>may / might / could</b>.<br>Mało prawdopodobne: <b>is unlikely to</b>, <b>probably won't</b>.",mnemo:"Skala: will / bound to → likely to → may/might/could → unlikely to → won't."},
      {title:"Position of adverbs + Articles (3.5)",body:"Przysłówki <b>definitely/probably/certainly</b>: PO 'will/be', PRZED zwykłym czasownikiem (<i>They will <b>definitely</b> win</i>).<br><b>Articles:</b> a/an (pierwszy raz, zawód) · the (konkretny/jedyny) · ø (ogólnie, l.mn./niepoliczalne).",real:"Grammar 3.5 = articles a/an, the, no article."}
     ],
     flashcards:[
      {t:"to boost",d:"zwiększyć, podbić (np. sprzedaż)"},{t:"bottom line",d:"wynik finansowy (zysk lub strata)"},
      {t:"to make up ground",d:"nadrobić zaległości / dogonić"},{t:"to make your mark",d:"zaznaczyć swoją obecność, zostawić ślad"},
      {t:"profitability",d:"rentowność"},{t:"revenue",d:"przychód"},
      {t:"is bound to / is certain to",d:"na pewno coś zrobi (wysoka pewność)"},{t:"is likely to",d:"prawdopodobnie (= will probably)"},
      {t:"may / might / could",d:"może (możliwość)"},{t:"is unlikely to",d:"mało prawdopodobne, że"},
      {t:"a / an / the / ø",d:"a/an = pierwszy raz/zawód; the = konkretny/jedyny; ø = ogólnie (l.mn./niepoliczalne)"}
     ],
     quiz:[
      {q:"„bottom line” w biznesie to:",a:["ostatnie zdanie maila","wynik finansowy (zysk/strata)","podpis","termin"],c:1,e:"bottom line = ostateczny wynik finansowy."},
      {q:"„Sprzedaż prawdopodobnie wzrośnie.”",a:["Sales are bound to rise.","Sales are likely to rise.","Sales won't rise.","Sales are unlikely to rise."],c:1,e:"is likely to = prawdopodobnie."},
      {q:"Najwyższa pewność:",a:["might","could","is bound to","is unlikely to"],c:2,e:"is bound to / is certain to."},
      {q:"Poprawna pozycja przysłówka:",a:["They definitely will win.","They will definitely win.","Definitely they will win.","They will win definitely."],c:1,e:"Po 'will': will definitely win."},
      {q:"„She's ___ accountant.”",a:["a","an","the","ø"],c:1,e:"Zawód + samogłoska → 'an accountant'."}
     ]},
    {id:"a8",title:"💰 U3.3–3.4: Złe wieści i telefon",emoji:"📞",
     feed:[
      {title:"Managing & responding to bad news (3.3)",body:"Przekazywanie: <i>I'm afraid… / Unfortunately… / I'm sorry to say…</i><br>Balans (+ i −): <i>The good news is… , however… / On the plus side…</i><br>Reakcja: <i>I see. / That's a shame. / Let's see what we can do.</i>",mnemo:"Złe wieści 'kanapką': pozytyw → zła wiadomość → plan."},
      {title:"Telephoning to clarify — słówka (3.4)",body:"Z ramki ćw. 3: <b>average</b> – średnia · <b>column</b> – kolumna · <b>gross</b> – brutto · <b>margin</b> – marża · <b>net</b> – netto · <b>quarter</b> – kwartał · <b>row</b> – wiersz. Plus: <b>bottom line</b>, <b>ROI</b> (return on investment), <b>product categories</b>.",real:"gross = brutto, net = netto; quarter = kwartał; margin = marża."},
      {title:"Asking for clarification & paraphrasing (3.4)",body:"<i>Sorry, could you repeat that? / Could you go over that again?</i><br>Parafraza: <i>So what you're saying is… / If I understand correctly… / Do you mean…? / Just to confirm…</i>",real:"Parafraza = powtórz własnymi słowami, by potwierdzić zrozumienie."}
     ],
     flashcards:[
      {t:"I'm afraid… / Unfortunately…",d:"wstęp do złej wiadomości"},{t:"That's a shame.",d:"Szkoda. (reakcja na złą wieść)"},
      {t:"On the plus side…",d:"Z drugiej strony / plusem jest…"},
      {t:"gross",d:"brutto"},{t:"net",d:"netto"},{t:"margin",d:"marża"},{t:"quarter",d:"kwartał"},
      {t:"average",d:"średnia"},{t:"column / row",d:"kolumna / wiersz (w tabeli)"},{t:"ROI (return on investment)",d:"zwrot z inwestycji"},
      {t:"So what you're saying is…",d:"Czyli mówisz, że… (parafraza)"},{t:"Could you go over that again?",d:"Mógłbyś to jeszcze raz wyjaśnić?"}
     ],
     quiz:[
      {q:"„gross” vs „net”:",a:["gross = netto, net = brutto","gross = brutto, net = netto","to to samo","gross = marża"],c:1,e:"gross = brutto (przed odliczeniami), net = netto."},
      {q:"„quarter” (w finansach) to:",a:["ćwiartka pizzy","kwartał","moneta 25 centów","czwarte piętro"],c:1,e:"quarter = kwartał (3 miesiące)."},
      {q:"Uprzejmy wstęp do złej wiadomości:",a:["Great news!","I'm afraid…","No problem!","Of course!"],c:1,e:"I'm afraid / Unfortunately."},
      {q:"Parafraza przez telefon:",a:["Goodbye.","So what you're saying is…","Hold on.","I'll call back."],c:1,e:"Parafraza = powtórzenie własnymi słowami."},
      {q:"„margin” to:",a:["margines strony","marża","kwartał","wiersz"],c:1,e:"Tu: marża (profit margin)."}
     ]},
    /* ===================== UNIT 4 — DIGITAL BUSINESS 💻 (słówka z książki) ===================== */
    {id:"a9",title:"💻 U4.1: Digital business + word building",emoji:"💻",
     feed:[
      {title:"Vocabulary box (4.1, ćw. 5)",body:"Dokładne słówka z ramki: <b>cloud</b> – chmura (przechowywanie w sieci) · <b>conversion</b> – konwersja (sprzedaż vs odwiedziny strony) · <b>(data) dump</b> – zrzut danych · <b>(data) mining</b> – eksploracja danych · <b>platform</b> – platforma · <b>tool</b> – narzędzie.<br>+ <b>DMP</b> = Digital Marketing Platform.",mnemo:"To słowa z ramki Vocabulary 4.1 — kluczowe na test."},
      {title:"Disruptors (4.1 lead-in)",body:"<b>disrupt</b> – zrewolucjonizować/wywrócić rynek · <b>disruption</b> – przełom/zaburzenie · <b>disruptive</b> – przełomowy.<br>Disruptive technology = technologia wywracająca rynek (Uber, Netflix).",real:"'disrupt' = wywrócić rynek do góry nogami."},
      {title:"Word building — verbs/nouns/adjectives (4.1)",body:"<b>anticipate → anticipation</b> · <b>convert → conversion / converted</b> · <b>disrupt → disruption / disruptive</b> · <b>personalize → personalization / personal</b> · <b>visualize → visualization / visual</b> · <b>analyse → analysis / analyst / analytical</b>",mnemo:"Akcent przesuwa się: INnovate → innoVAtion. Częste w ćwiczeniu word building."}
     ],
     flashcards:[
      {t:"cloud",d:"chmura (przechowywanie danych w internecie)"},{t:"conversion",d:"konwersja (% sprzedaży względem odwiedzin)"},
      {t:"(data) dump",d:"zrzut danych"},{t:"(data) mining",d:"eksploracja/analiza dużych zbiorów danych"},
      {t:"platform",d:"platforma (np. oprogramowanie do zadań)"},{t:"tool",d:"narzędzie"},
      {t:"disrupt",d:"zrewolucjonizować / wywrócić rynek"},{t:"disruption",d:"przełom, zaburzenie rynku"},{t:"disruptive",d:"przełomowy (disruptive technology)"},
      {t:"anticipate → anticipation",d:"przewidywać → przewidywanie (word building)"},{t:"convert → conversion",d:"konwertować → konwersja"},
      {t:"visualize → visualization",d:"wizualizować → wizualizacja"},{t:"DMP",d:"Digital Marketing Platform"}
     ],
     quiz:[
      {q:"„(data) mining” to:",a:["kopanie kryptowalut","eksploracja/analiza dużych zbiorów danych","usuwanie danych","kopia zapasowa"],c:1,e:"data mining = analiza dużych ilości danych w poszukiwaniu wzorców."},
      {q:"„cloud” (w IT) to:",a:["chmura — przechowywanie danych w internecie","prognoza pogody","awaria serwera","wirus"],c:0,e:"cloud = przechowywanie/oprogramowanie w sieci, nie na własnym komputerze."},
      {q:"„disruptive technology” to technologia:",a:["przestarzała","wywracająca rynek do góry nogami","tania","zepsuta"],c:1,e:"disruptive = przełomowa, zmienia reguły rynku."},
      {q:"Rzeczownik od „convert”:",a:["converting","conversion","converted","conversation"],c:1,e:"convert → conversion."},
      {q:"„conversion” (marketing) to:",a:["zamiana waluty","stosunek sprzedaży do odwiedzin strony","awaria","rejestracja"],c:1,e:"conversion (rate) = ile odwiedzin zamienia się w sprzedaż."}
     ]},
    {id:"a10",title:"💻 U4.3–4.4: Trudni rozmówcy i negocjacje",emoji:"🤝",
     feed:[
      {title:"Style komunikacji (4.3 lead-in)",body:"Typy trudnych rozmówców: <b>Dominator</b> (zagaduje wszystkich) · <b>Non-responder</b> (milczy) · <b>Contradictor</b> (ze wszystkim się nie zgadza) · <b>Joker</b> (ciągle żartuje) · <b>Analyser</b> (wchodzi w detale) · <b>Technology-reliant</b> (wpatrzony w telefon).",mnemo:"Dwa podejścia: <b>Accept & adapt</b> (dostosuj się) vs <b>Intervene & control</b> (przejmij stery)."},
      {title:"Keeping a meeting on track (4.3)",body:"Kategorie zwrotów: przypomnienie agendy, opanowanie gadułów (managing dominant speakers), zarządzanie wejściami w słowo, odłożenie dyskusji, spowolnienie, dopchnięcie do konkretu.<br><i>Can I stop you for a second? / Let's come back to that later. / Can we get back to the main topic?</i>",real:"keep a meeting on track = pilnować, by spotkanie nie zeszło z tematu."},
      {title:"Negotiating: positional vs principled (4.4)",body:"<b>Positional negotiation</b> – bronisz konkretnej pozycji, próbujesz wymóc swoje.<br><b>Principled negotiation</b> – skupiasz się na <b>interesach i potrzebach obu stron</b>, szukasz wyniku win-win i dobrej relacji.<br>Reaching agreement: <i>First, let's look at the facts. / How could you imagine this working? / I think the best thing would be to… / That sounds reasonable.</i>",real:"Principled negotiation = rozwiązuj problem, nie walcz z osobą."}
     ],
     flashcards:[
      {t:"Dominator",d:"rozmówca, który zagaduje i dominuje spotkanie"},{t:"Non-responder",d:"rozmówca milczący, nie reaguje"},
      {t:"Contradictor",d:"rozmówca, który ze wszystkim się nie zgadza"},{t:"Analyser",d:"rozmówca wchodzący w nadmierne detale"},
      {t:"Accept & adapt / Intervene & control",d:"dwa podejścia do trudnych rozmówców: dostosuj się / przejmij stery"},
      {t:"keep a meeting on track",d:"pilnować, by spotkanie nie zeszło z tematu"},{t:"Can I stop you for a second?",d:"Mogę ci na chwilę przerwać?"},
      {t:"positional negotiation",d:"negocjacje z obroną własnej pozycji (wymuszasz swoje)"},
      {t:"principled negotiation",d:"negocjacje oparte na interesach obu stron, cel: win-win i dobra relacja"},
      {t:"That sounds reasonable.",d:"To brzmi rozsądnie. (zgoda w negocjacji)"}
     ],
     quiz:[
      {q:"„Principled negotiation” skupia się na:",a:["obronie własnej pozycji za wszelką cenę","interesach i potrzebach obu stron (win-win)","jak najszybszym zakończeniu","unikaniu rozmowy"],c:1,e:"principled = interesy obu stron, win-win i relacja."},
      {q:"„Dominator” na spotkaniu to ktoś, kto:",a:["milczy","zagaduje i dominuje rozmowę","ciągle żartuje","wchodzi w detale"],c:1,e:"Dominator = przejmuje całą rozmowę."},
      {q:"„keep a meeting on track” znaczy:",a:["odwołać spotkanie","pilnować, by nie zeszło z tematu","skrócić spotkanie","nagrać spotkanie"],c:1,e:"on track = w temacie / na właściwym torze."},
      {q:"Zwrot 'Can I stop you for a second?' służy do:",a:["zakończenia spotkania","uprzejmego wejścia w słowo / opanowania gaduły","zgody","prośby o kawę"],c:1,e:"Managing dominant speakers / interruptions."},
      {q:"„positional negotiation” to:",a:["szukanie win-win","obrona konkretnej pozycji i wymuszanie swego","brak negocjacji","negocjacje mailowe"],c:1,e:"positional = trzymasz się swojej pozycji."}
     ]},
    {id:"a11",title:"💻 U4.2/4.5: Linkers + business proposal",emoji:"🔗",
     feed:[
      {title:"Linkers (4.2)",body:"<b>Dodawanie:</b> moreover, in addition, furthermore.<br><b>Kontrast:</b> however, although, whereas, despite/in spite of.<br><b>Przyczyna:</b> because, since, as, due to.<br><b>Skutek:</b> therefore, so, as a result, consequently.<br><b>Cel:</b> to, in order to, so that.",mnemo:"however/although = kontrast; therefore/so = skutek; in order to = cel."},
      {title:"Short business proposal — struktura (4.5)",body:"Sekcje z książki: <b>Introduction / Purpose statement</b> (<i>I am writing to propose that…</i>) → <b>Brief summary of problem</b> (<i>Recently, there have been… an increase in…</i>) → <b>Solution</b> (<i>The best… is…</i>) → <b>Plan, costs and schedule</b> (<i>Despite the high cost, we would be able to…</i>) → <b>Conclusion</b> (<i>I therefore recommend that we purchase…</i>).",mnemo:"Cel → problem → rozwiązanie → koszty/plan → rekomendacja."},
      {title:"Noun phrases zamiast verb phrases (4.5)",body:"Styl formalny lubi rzeczowniki: „we <b>implemented</b> the system” → „<b>the implementation of</b> the system”. „costs <b>increased</b>” → „<b>the increase in</b> costs”. „we <b>reduced</b> waiting times” → „<b>the reduction of</b> waiting times”.",real:"Grammar 4.5 = noun phrases to replace verb phrases."}
     ],
     flashcards:[
      {t:"however / although / whereas",d:"jednak / chociaż / podczas gdy (kontrast)"},{t:"therefore / as a result",d:"dlatego / w rezultacie (skutek)"},
      {t:"due to / because of",d:"z powodu (przyczyna)"},{t:"in order to / so that",d:"aby / żeby (cel)"},{t:"moreover / in addition",d:"ponadto (dodawanie)"},
      {t:"I am writing to propose that…",d:"Piszę, aby zaproponować… (otwarcie proposal)"},{t:"I therefore recommend that…",d:"Dlatego rekomenduję, aby… (zakończenie)"},
      {t:"Despite the high cost, …",d:"Mimo wysokiego kosztu… (sekcja koszty)"},
      {t:"noun phrase zamiast verb",d:"'we increased sales' → 'the increase in sales' (styl formalny)"}
     ],
     quiz:[
      {q:"Linker KONTRASTU:",a:["therefore","however","because","in addition"],c:1,e:"however/although/whereas = kontrast."},
      {q:"„___ the high cost, we bought it.” (mimo)",a:["Because of","Despite","Therefore","Moreover"],c:1,e:"Despite/In spite of + rzeczownik = mimo."},
      {q:"Linker SKUTKU:",a:["although","whereas","as a result","in order to"],c:2,e:"as a result / therefore / so."},
      {q:"Formalniej (noun phrase): „We reduced costs” →",a:["We are reducing costs","The reduction of costs","Costs reduce","Reduce the costs"],c:1,e:"Verb → noun phrase: the reduction of costs."},
      {q:"Otwarcie business proposal:",a:["Once upon a time…","I am writing to propose that…","See you soon,","By the way…"],c:1,e:"Purpose statement: 'I am writing to propose that…'."}
     ]}
  ]
});
