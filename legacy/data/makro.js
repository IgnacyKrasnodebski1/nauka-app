/* ============================================================
   PRZEDMIOT: Polityka makroekonomiczna dla zrównoważonego rozwoju
   Źródło: 7 prezentacji dr. Witolda Siekierzyńskiego (Uczelnia Łazarskiego)
   + 43 pytania testowe z prezentacji zespołowych (~40% testu)
   ============================================================ */
window.SUBJECTS = window.SUBJECTS || [];
window.SUBJECTS.push({
  id:"makro",
  name:"Polityka makroekonomiczna",
  short:"Makro",
  emoji:"📊",
  tagline:"Zrównoważony rozwój, doktryny, fiskalna, ESG, praca, innowacje + behawioralka.",
  accent:"linear-gradient(135deg,#ff2d95,#a855f7,#22d3ee)",
  accent2:"#22d3ee",
  grading:{pass:50,examMin:20,scale:[[98,"5,5"],[90,"5"],[80,"4,5"],[70,"4"],[60,"3,5"],[50,"3"]],failLabel:"2 — niezaliczone"},
  info:`
    <div class="zbox"><h3>Jak liczy się ocena</h3>
      <p>🧪 <b>Sprawdzian końcowy = 60% oceny</b> (test, min. <b>50%</b> zalicza)<br>
      🎤 <b>Prezentacja zespołowa = 40% oceny</b><br>
      📌 Dozwolone łącznie <b>2 nieobecności</b> na warsztatach.</p></div>
    <div class="zbox"><h3>⚡ Najważniejszy cheat</h3>
      <p>4 pytania testowe z ostatniego slajdu KAŻDEJ prezentacji zespołowej (wszystkich grup, <b>łącznie z Twoją</b>) to <b>~40% pytań na teście</b>. Wszystkie wrzucone do poziomu <b>🎤 Pytania grup</b> i do quizu.</p></div>
    <div class="zbox"><h3>Siatka ocen (test)</h3>
      <table class="gradetbl">
        <tr><td>50–59%</td><td>3</td></tr><tr><td>60–69%</td><td>3,5</td></tr><tr><td>70–79%</td><td>4</td></tr>
        <tr><td>80–89%</td><td>4,5</td></tr><tr><td>90–97%</td><td>5</td></tr><tr><td>98–100%</td><td>5,5</td></tr></table></div>`,
  levels:[
    /* ---------------- L1 ---------------- */
    {id:"l1",title:"Podstawy",emoji:"🧩",
     feed:[
      {title:"Makro vs społeczna — o co biega",body:"<b>Polityka makroekonomiczna</b> = zarządzanie całą gospodarką państwa (alokacja zasobów, dług = wiarygodność fiskalna, stopy = polityka pieniężna).<br><br><b>Polityka społeczna</b> = państwo kształtuje warunki życia i łagodzi nierówności. Pomoc + inwestycja w kapitał ludzki (zdrowie, edukacja).",real:"Makro = pilnowanie kasy państwa. Społeczna = pilnowanie ludzi."},
      {title:"Kwestia społeczna to nie jeden problem",body:"<b>Kwestia społeczna</b> = wspólne podłoże problemów (bezrobocie, kryzys mieszkaniowy, ubóstwo). Systemowa sprzeczność w strukturze społeczeństwa (Rysz-Kowalczyk).",real:"Nie 'jeden ma pecha', tylko 'system tak ustawiony, że produkuje te problemy'."},
      {title:"Zrównoważony rozwój = 3 sfery",body:"Równowaga: 💰 <b>ekonomicznej</b>, 👥 <b>społecznej</b>, 🌍 <b>ekologicznej</b>. Rozwój, który nie zagraża przyszłym pokoleniom.",real:"3 nogi stołka — wywal jedną i rozwój się wywraca. Motyw całego kursu.",mnemo:"<b>EKO-SPO-EKO</b>: Ekonomia, Społeczeństwo, Ekologia."},
      {title:"Polityka społeczna ma pipeline",body:"<b>Diagnoza → Analiza przyczyn → Propozycje → Decyzja → Legislacja → Wdrożenie → Ewaluacja.</b> Na końcu: zadziałało? Co poprawić?",real:"Jak roadmapa produktu: od 'co zepsute' do 'czy nasza łatka pomogła'."},
      {title:"4 narzędzia polityki społecznej",body:"💸 <b>Ekonomiczne</b> (podatki, zasiłki, dotacje)<br>⚖️ <b>Prawne</b> (Kodeks pracy, ustawy)<br>📢 <b>Informacyjne</b> (kampanie, poradnictwo)<br>👷 <b>Kadrowe</b> (pracownicy socjalni, urzędnicy)",mnemo:"<b>KASA · PRAWO · GADANIE · LUDZIE</b> = cztery dźwignie państwa."},
      {title:"Ludzie NIE są homo economicus",body:"Realny człowiek ≠ kalkulator. Działa na <b>racjonalności ograniczonej</b>, <b>heurystykach</b>, <b>status quo bias</b> ('zawsze tak robiliśmy') i normach.",real:"Behawioralka wraca w KAŻDEJ części kursu — ogarnij raz, masz darmowe punkty wszędzie."}
     ],
     flashcards:[
      {t:"Polityka makroekonomiczna",d:"Zarządzanie gospodarką państwa jako całością: alokacja zasobów, wiarygodność fiskalna (dług), polityka pieniężna (stopy)."},
      {t:"Polityka społeczna",d:"Działalność państwa kształtująca warunki życia i łagodząca nierówności. Pomoc + inwestycja w kapitał ludzki. Opiera się na wiedzy i wartościach (aksjologii)."},
      {t:"Kwestia społeczna",d:"Wspólne podłoże różnych problemów (bezrobocie, ubóstwo, mieszkania). Systemowa sprzeczność w strukturze społeczeństwa (Rysz-Kowalczyk)."},
      {t:"Zrównoważony rozwój",d:"Równowaga 3 sfer: ekonomicznej, społecznej i ekologicznej. Rozwój niezagrażający przyszłym pokoleniom."},
      {t:"4 instrumenty polityki społecznej",d:"<b>Ekonomiczne</b> (podatki, zasiłki), <b>prawne</b> (ustawy), <b>informacyjne</b> (kampanie), <b>kadrowe</b> (pracownicy socjalni). Mnemo: KASA, PRAWO, GADANIE, LUDZIE."},
      {t:"Racjonalność ograniczona",d:"Bounded rationality — człowiek nie jest idealnym kalkulatorem; decyduje na podstawie heurystyk i skrótów myślowych."},
      {t:"Status quo bias",d:"Skłonność do trzymania się obecnego stanu — 'zawsze tak robiliśmy'. Opór przed zmianą."}
     ],
     quiz:[
      {q:"Czym różni się polityka makroekonomiczna od społecznej?",a:["Makro = zarządzanie całą gospodarką; społeczna = warunki życia i nierówności","Makro = tylko podatki; społeczna = tylko emerytury","To dokładnie to samo","Makro dotyczy gmin, społeczna państwa"],c:0,e:"Makro = gospodarka jako całość (dług, stopy). Społeczna = warunki życia i nierówności."},
      {q:"Ile rodzajów instrumentów ma polityka społeczna?",a:["3: prawne, kadrowe, militarne","4: ekonomiczne, prawne, informacyjne, kadrowe","2: podatki i zasiłki","5: w tym cyfrowe"],c:1,e:"Cztery: KASA, PRAWO, GADANIE, LUDZIE."},
      {q:"Co znaczy, że człowiek nie jest 'homo economicus'?",a:["Że nie zna ekonomii","Że działa na heurystykach i biasach, nie jak idealny kalkulator","Że zawsze decyduje racjonalnie","Że nie płaci podatków"],c:1,e:"Racjonalność ograniczona, heurystyki, status quo bias, normy."},
      {q:"Trzy sfery zrównoważonego rozwoju to:",a:["polityczna, militarna, kulturowa","ekonomiczna, społeczna, ekologiczna","lokalna, krajowa, globalna","prawna, fiskalna, monetarna"],c:1,e:"Równowaga 3 sfer — rozwój niezagrażający przyszłym pokoleniom."}
     ]},
    /* ---------------- L2 ---------------- */
    {id:"l2",title:"Doktryny",emoji:"🏛️",
     feed:[
      {title:"Ordoliberalizm = liberalizm uporządkowany",body:"Szkoła fryburska (Eucken, Böhm). Państwo świadomie tworzy <b>ramy</b> dla wolnego rynku, bo rynek sam się niszczy (monopole). Państwo = <b>strażnik ładu</b>, ustala reguły gry.",real:"Państwo = sędzia na meczu, nie zawodnik. Nie strzela goli, pilnuje zasad."},
      {title:"SGR: 'Dobrobyt przez konkurencję'",body:"<b>Społeczna Gospodarka Rynkowa</b> (Erhard) = praktyczne wdrożenie ordoliberalizmu. Fundament: <b>subsydiarność</b> — państwo pomaga TYLKO gdy jednostka/rodzina nie da rady.",real:"Pomoc tak, rozpieszczanie nie. Najpierw ty/rodzina, na końcu państwo."},
      {title:"Welfare state — i jego haczyk",body:"<b>Państwo opiekuńcze</b> = aktywny protektor, szeroka redystrybucja, 'solidarność transferowa'. Krytyka ordo: <b>moral hazard</b>, zabija bodźce; 'państwo podatków' → 'państwo długu' (Streeck).",real:"Dużo dawania = ludzie przywykają, kasa się kończy → kredyt na koszt wnuków."}
     ],
     flashcards:[
      {t:"Ordoliberalizm",d:"'Liberalizm uporządkowany' (szkoła fryburska: Eucken, Böhm). Państwo tworzy ramy (ład) dla wolnego rynku, bo rynek sam się niszczy. Państwo = strażnik ładu."},
      {t:"Społeczna Gospodarka Rynkowa (SGR)",d:"Wdrożenie ordoliberalizmu (Erhard). 'Dobrobyt przez konkurencję'. Łączy wolność rynku z równością społeczną. Fundament: subsydiarność."},
      {t:"Zasada subsydiarności",d:"Pomocniczość — państwo pomaga tylko tam, gdzie jednostka lub mniejsza wspólnota (rodzina) absolutnie nie da rady sama."},
      {t:"Państwo opiekuńcze (welfare state)",d:"Aktywny gracz i protektor, szeroka redystrybucja, 'solidarność transferowa'. Krytyka: moral hazard, dezaktywizacja, ryzyko 'państwa długu'."},
      {t:"Moral hazard",d:"Pokusa nadużycia — kto czerpie zyski, ten musi ponosić ryzyko strat. Ratowanie źle zarządzanych firm z kasy podatników niszczy tę zasadę."},
      {t:"7 zasad konstytuujących (Eucken)",d:"Fundamenty ładu: system cen, stabilność pieniądza, otwarte rynki, własność prywatna, swoboda umów, odpowiedzialność materialna, konstancja (stałość) polityki. Mnemo: Ceny, Pieniądz, Rynki, Własność, Umowy, Odpowiedzialność, Stałość."},
      {t:"4 zasady regulujące (Eucken)",d:"Wyjątki gdy państwo MUSI interweniować (zgodnie z rynkiem): polityka antymonopolowa, korekta różnic dochodowych, internalizacja efektów zewnętrznych, interwencje na rynku pracy."}
     ],
     quiz:[
      {q:"Jaka jest rola państwa w ordoliberalizmie?",a:["Bezpośredni gracz rynkowy","Strażnik ładu — ustala reguły, nie gra sam","Państwo powinno zniknąć","Właściciel wszystkich firm"],c:1,e:"Strażnik ładu — bo rynek sam ma skłonność do samozniszczenia (monopole)."},
      {q:"Hasło Społecznej Gospodarki Rynkowej (Erhard):",a:["'Równość przez redystrybucję'","'Dobrobyt przez konkurencję'","'Państwo ponad wszystko'","'Wolny rynek bez granic'"],c:1,e:"SGR = wdrożenie ordoliberalizmu, fundament: subsydiarność."},
      {q:"Co krytycy SGR zarzucają państwu opiekuńczemu?",a:["Że jest za tanie","Że generuje moral hazard i może stać się 'państwem długu'","Że za mało redystrybuuje","Że nie istnieje"],c:1,e:"Moral hazard, dezaktywizacja, ewolucja w 'państwo długu' (Streeck)."},
      {q:"Ile zasad konstytuujących wymienił Eucken?",a:["3","5","7","10"],c:2,e:"Siedem fundamentów ładu konkurencyjnego."}
     ]},
    /* ---------------- L3 ---------------- */
    {id:"l3",title:"Polityka fiskalna",emoji:"💰",
     feed:[
      {title:"Magiczny Czworokąt (Kaldor 1967)",body:"4 klasyczne cele makro: 📈 wzrost PKB, 👔 pełne zatrudnienie, 💵 stabilność cen (~2–2,5%), ⚖️ równowaga bilansu płatniczego. W XXI w. + ekologia i spójność społeczna.",real:"'Magiczny' bo trudno mieć wszystkie 4 naraz — pociągniesz jeden, drugi spada.",mnemo:"<b>WZROST · PRACA · CENY · BILANS</b>."},
      {title:"Deficit bias — czemu politycy lubią dług",body:"System demokratyczny ma wbudowaną <b>skłonność do deficytu</b>. Wydatki/niższe podatki = głosy TERAZ, koszty (dług) na przyszłe pokolenia. Skutek: rynki żądają wyższych odsetek.",real:"Politycy = present bias na sterydach. Cukierek dziś, rachunek nienarodzonym."},
      {title:"Trójkąt wiarygodności fiskalnej",body:"📏 <b>Reguły fiskalne</b> (limity) + 🏛️ <b>niezależne instytucje</b> (Rady Fiskalne) + 🔍 <b>przejrzystość budżetu</b>.<br>UE: Pakt Stabilności = deficyt max <b>3% PKB</b>, dług max <b>60% PKB</b>.",real:"3% i 60% — znaj na pamięć, padają na teście jak nic."},
      {title:"Wypychanie długu poza budżet",body:"Polska klasyka: wydatki przez <b>BGK</b> (Fundusz COVID, Krajowy Fundusz Drogowy) i <b>PFR</b> (Tarcza). Emisja obligacji POZA deficytem, ale dolicza się do długu sektora. Fundusz COVID > 180 mld zł.",real:"Budżet wygląda chudo, realny dług grubszy. Rynki i tak to widzą."}
     ],
     flashcards:[
      {t:"Magiczny Czworokąt (Kaldor 1967)",d:"4 cele makro: wzrost PKB, pełne zatrudnienie, stabilność cen (~2–2,5%), równowaga bilansu płatniczego. 'Magiczny' bo trudno mieć wszystkie naraz."},
      {t:"Deficit bias",d:"Systemowa skłonność polityków do generowania deficytu — wydatki/niższe podatki dają głosy teraz, koszty (dług) spadają na przyszłe pokolenia."},
      {t:"Wiarygodność fiskalna",d:"Zdolność państwa do przekonania rynków, że spłaci długi bez hiperinflacji. Trójkąt: reguły + niezależne instytucje + przejrzystość budżetu."},
      {t:"Pakt Stabilności i Wzrostu UE",d:"Limity: deficyt max 3% PKB, dług max 60% PKB."},
      {t:"Dyskrecjonalna vs reguły fiskalne",d:"Dyskrecjonalna = decyzje 'z bieżącej ręki' (elastyczna, ryzyko deficit bias; tarcze COVID). Reguły = sztywne formalne zasady (wiarygodna; reguła wydatkowa)."}
     ],
     quiz:[
      {q:"Limity Paktu Stabilności i Wzrostu UE to:",a:["deficyt 5% PKB, dług 80% PKB","deficyt 3% PKB, dług 60% PKB","deficyt 2% PKB, dług 50% PKB","brak limitów"],c:1,e:"Deficyt max 3% PKB, dług max 60% PKB."},
      {q:"Czym jest 'deficit bias'?",a:["Błąd księgowy","Systemowa skłonność polityków do deficytu (głosy teraz, dług na przyszłość)","Zakaz zadłużania państwa","Nadwyżka budżetowa"],c:1,e:"Wydatki dają głosy natychmiast, koszty długu spadają na przyszłe pokolenia."},
      {q:"Trójkąt wiarygodności fiskalnej to:",a:["podatki, wydatki, dług","reguły fiskalne, niezależne instytucje, przejrzystość budżetu","ZUS, NBP, GUS","deficyt, inflacja, bezrobocie"],c:1,e:"Reguły + Rady Fiskalne + przejrzystość."},
      {q:"Magiczny Czworokąt celów makro (Kaldor) NIE obejmuje:",a:["wzrostu PKB","pełnego zatrudnienia","stabilności cen","maksymalizacji eksportu zbrojeniowego"],c:3,e:"4 cele: wzrost, zatrudnienie, stabilne ceny, równowaga bilansu płatniczego."}
     ]},
    /* ---------------- L4 ---------------- */
    {id:"l4",title:"Polska: demografia i mieszkania",emoji:"🇵🇱",
     feed:[
      {title:"Od Kuroniówki do 800+",body:"Ewolucja po 1989: od <b>osłon socjalnych</b> (Kuroniówka) do <b>aktywnej polityki</b> i 500+/800+.<br>Dwa systemy: <b>ubezpieczeniowy</b> (składkowy — ZUS) i <b>zaopatrzeniowy</b> (podatkowy — zasiłki, pomoc społeczna).",real:"Składkowy = płacisz składki, dostajesz później. Zaopatrzeniowy = z budżetu dla potrzebujących."},
      {title:"Czemu 800+ NIE podniosło dzietności",body:"Cel: więcej dzieci + mniej ubóstwa. Efekt: <b>ubóstwo dziecięce ↓ mocno</b>, dzietność ledwo drgnęła. Behawioralka: loss aversion, reference point, mental accounting, dezaktywizacja kobiet.",real:"Forsa pomogła portfelom, nie zmieniła decyzji 'czy mieć dziecko'."},
      {title:"TFR 1,16 — Polska się nie odtwarza",body:"<b>TFR</b> = przeciętna liczba dzieci na kobietę. PL ≈ <b>1,16</b> (2023), 2024 ~1,1. Próg zastępowalności pokoleń = <b>2,1</b>. Starzenie się, rosnące wydatki na emerytury i zdrowie.",real:"1,16 i 2,1 — zapamiętaj. Bomba demograficzna pod systemem emerytalnym."},
      {title:"Kwestia mieszkaniowa (cz.3 + grupa OJ)",body:"Programy dopłat (np. <b>Bezpieczny Kredyt 2%</b>) często <b>podbijają ceny</b> zamiast rozwiązać problem. Rola budownictwa społecznego: <b>TBS</b> (Towarzystwa Budownictwa Społecznego) i <b>SIM</b> (Społeczne Inicjatywy Mieszkaniowe). Wzór: Wiener Wohnen (Wiedeń).",real:"Mieszkanie = towar czy prawo? Sam rynek nie da mieszkań dla wszystkich — stąd najem społeczny."}
     ],
     flashcards:[
      {t:"Ryzyko socjalne",d:"Zdarzenie losowe (choroba, starość) powodujące utratę dochodu lub wzrost potrzeb, wymagające zabezpieczenia społecznego (Samoraj-Charitonow)."},
      {t:"Ubezpieczeniowy vs zaopatrzeniowy",d:"Ubezpieczeniowy = składkowy (emerytury, ZUS). Zaopatrzeniowy = podatkowy (zasiłki rodzinne, pomoc społeczna)."},
      {t:"Dlaczego 500+/800+ nie podniosło dzietności",d:"Mocno zredukowało ubóstwo dziecięce, ale dzietność ledwo drgnęła. Mechanizmy: loss aversion, reference point, mental accounting, dezaktywizacja."},
      {t:"TFR (współczynnik dzietności)",d:"Przeciętna liczba dzieci na kobietę przy obecnych wzorcach. PL ≈ 1,16; próg zastępowalności pokoleń = 2,1."},
      {t:"Mediana wieku",d:"Wiek dzielący populację na dwie równe części (młodszą i starszą). Rośnie = społeczeństwo się starzeje."},
      {t:"TBS i SIM",d:"Formy najmu społecznego o umiarkowanym czynszu. TBS = starszy model; SIM (Społeczne Inicjatywy Mieszkaniowe) = nowszy, przy wsparciu państwa i samorządów, dla średnich dochodów."}
     ],
     quiz:[
      {q:"Dlaczego 800+ NIE podniosło znacząco dzietności?",a:["Był za mały finansowo","Zadziałały mechanizmy behawioralne — zredukował ubóstwo, ale nie zmienił decyzji o dzieciach","Nikt o nim nie wiedział","Bo go odebrano"],c:1,e:"Ubóstwo dziecięce ↓, dzietność ledwo drgnęła. Loss aversion, reference point, dezaktywizacja."},
      {q:"TFR w Polsce wynosi ok.:",a:["2,1","1,16","3,0","0,5"],c:1,e:"≈1,16 (2023). Próg zastępowalności pokoleń to 2,1."},
      {q:"Ubezpieczeniowy vs zaopatrzeniowy system zabezpieczenia:",a:["Ubezpieczeniowy = składkowy (ZUS); zaopatrzeniowy = podatkowy (zasiłki, pomoc społeczna)","Oba składkowe","Ubezpieczeniowy dla bogatych","Nie ma różnicy"],c:0,e:"Składkowy = emerytury z ZUS. Zaopatrzeniowy = z podatków."},
      {q:"Jaki jest cel społecznych form najmu (TBS, SIM)?",a:["Budowa premium w centrach","Zapewnienie dostępnych mieszkań osobom o średnich i niższych dochodach","Zwiększenie zysków deweloperów","Likwidacja rynku najmu"],c:1,e:"TBS i SIM = najem o umiarkowanym czynszu dla średnich/niższych dochodów."}
     ]},
    /* ---------------- L5 ---------------- */
    {id:"l5",title:"Modele welfare + Zielony Ład",emoji:"🌍",
     feed:[
      {title:"4 modele welfare (Esping-Andersen)",body:"❄️ <b>Nordycki</b> — wysokie podatki, uniwersalne usługi, max dekomodyfikacja (Szwecja)<br>🏭 <b>Konserwatywny</b> — ubezpieczenia wg statusu, rola rodziny (Niemcy)<br>🦅 <b>Liberalny</b> — niskie podatki, pomoc tylko biednym (USA, UK)<br>👨‍👩‍👧 <b>Śródziemnomorski</b> (Ferrara 1996) — rodzina jako siatka (Włochy)",mnemo:"<b>NORD · KONSERWA · LIBERAŁ · POŁUDNIE</b>."},
      {title:"Celtycki Tygrys — wzlot i upadek Irlandii",body:"Pakt społeczny od 1987 (umiar płacowy za niższe podatki) + <b>FDI</b> (niski CIT, angielski, UE) → Big Tech. PKB ~9,4%/rok. Ale krach 2008–2013 (PKB −14%).",real:"Model liberalny. Wzrost na jednej nodze (kapitał zagraniczny + nieruchomości) = kruchy."},
      {title:"European Green Deal",body:"Strategia UE: <b>neutralność klimatyczna do 2050</b> + oddzielenie wzrostu od zużycia zasobów. Rozwija SGR w <b>S-EGR</b> (Społeczno-Ekologiczną). Traktat z Lizbony (2009) = 3 filary: gospodarczy, społeczny, ekologiczny.",real:"SGR dostał trzecią nogę — eko."},
      {title:"Czemu wiesz że eko, a nie robisz",body:"Bariery: present bias, status quo bias, information overload, psychological distance. Narzędzia: <b>default options</b> (OZE domyślnie → 80–95% nie zmienia), <b>social comparison</b>, <b>loss framing</b> ('tracisz 500 zł' > 'zaoszczędzisz').",real:"Nudge > kazanie. Ustaw dobry default, większość przy nim zostanie."}
     ],
     flashcards:[
      {t:"Typologia Esping-Andersena",d:"3 reżimy: socjaldemokratyczny (nordycki), konserwatywny (korporatystyczny), liberalny. Ferrara (1996) dodał 4. — śródziemnomorski."},
      {t:"Model nordycki",d:"Wysokie progresywne podatki, uniwersalne usługi, najwyższa dekomodyfikacja, egalitaryzm. Szwecja, Dania, Norwegia, Finlandia."},
      {t:"Model konserwatywny/korporatystyczny",d:"Ubezpieczenia wg statusu zawodowego, silna rola rodziny, korporatyzm. Niemcy, Francja, Austria."},
      {t:"Model liberalny",d:"Niskie podatki/wydatki, testy dochodowe, welfare stigma, rynek prywatny, niska dekomodyfikacja. USA, UK, Kanada, Irlandia."},
      {t:"Model śródziemnomorski (Ferrara 1996)",d:"Słabe, fragmentaryczne zabezpieczenia, rodzina jako bufor, insiderzy vs outsiderzy. Włochy, Hiszpania, Grecja, Portugalia."},
      {t:"Dekomodyfikacja",d:"Stopień, w jakim obywatel może 'wyjść z rynku pracy' bez utraty dochodu i statusu. Najwyższa w modelu nordyckim."},
      {t:"Celtycki Tygrys",d:"Boom Irlandii (~1995–2008) na pakcie społecznym i FDI (niski CIT). Krach 2008–2013. Model liberalny."},
      {t:"Europejski Zielony Ład",d:"Strategia UE: neutralność klimatyczna do 2050 + oddzielenie wzrostu od zużycia zasobów. Po wojnie w Ukrainie + bezpieczeństwo energetyczne (REPowerEU)."},
      {t:"S-EGR",d:"Społeczno-Ekologiczna Gospodarka Rynkowa — rozwinięcie SGR o filar ekologiczny (internalizacja kosztów CO₂)."},
      {t:"Traktat z Lizbony",d:"Reforma traktatów UE (podpisany 2007, obowiązuje od 2009). Ustanowił 3 filary: gospodarczy, społeczny, ekologiczny."},
      {t:"Default options (nudge)",d:"Opcja domyślna (np. OZE opt-out zamiast opt-in). 80–95% klientów nie zmienia domyślnego wyboru."}
     ],
     quiz:[
      {q:"Który kraj reprezentuje model nordycki?",a:["USA","Szwecja","Włochy","Niemcy"],c:1,e:"Nordycki = wysokie podatki, uniwersalne usługi, max dekomodyfikacja."},
      {q:"Co to dekomodyfikacja?",a:["Prywatyzacja usług","Stopień, w jakim można 'wyjść z rynku pracy' bez utraty dochodu","Podatek od towarów","Likwidacja rynku"],c:1,e:"Najwyższa w modelu nordyckim."},
      {q:"Kto dodał model śródziemnomorski do typologii?",a:["Keynes","Ferrara (1996)","Hayek","Mazzucato"],c:1,e:"Esping-Andersen miał 3 modele; Ferrara (1996) dodał 4."},
      {q:"Główny cel Europejskiego Zielonego Ładu:",a:["neutralność klimatyczna do 2050","wzrost PKB o 10%","likwidacja UE","powrót do węgla"],c:0,e:"Neutralność do 2050 + oddzielenie wzrostu od zużycia zasobów."},
      {q:"Celtycki Tygrys — kluczowa lekcja?",a:["Wysokie podatki gwarantują wzrost","Model oparty na FDI i bańce nieruchomości okazał się kruchy (krach 2008)","Państwo opiekuńcze zawsze wygrywa","FDI nie ma znaczenia"],c:1,e:"Boom na FDI, krach 2008–2013. Model liberalny."}
     ]},
    /* ---------------- L6 ---------------- */
    {id:"l6",title:"ESG + Ekonomia Obwarzanka",emoji:"🍩",
     feed:[
      {title:"Keynes vs Hayek o Zielonym Ładzie",body:"🟥 <b>Keynes</b> — regulacje, zakazy, dotacje do OZE. Państwo = sterownik. Ryzyko: nieefektywność, lobby.<br>🟦 <b>Hayek</b> — ceny i handel emisjami, podatek węglowy. Ryzyko: za wolno.<br>UE = <b>HYBRYDA</b>: zakaz aut spalinowych + EU ETS.",real:"Nie 'albo-albo'. UE bierze najlepsze z obu — zakazy PLUS cena CO₂."},
      {title:"ESG = 3 litery oceny firmy",body:"<b>E</b>nvironmental · <b>S</b>ocial · <b>G</b>overnance. Ocena pozafinansowa. 'Zielone finanse', raportowanie wg <b>CSRD</b>. Globalny język: <b>Agenda 2030 ONZ — 17 celów (SDGs)</b>.",real:"ESG = 'jak firma wpływa na świat poza zarabianiem'. Gen Z coraz częściej na to patrzy.",mnemo:"<b>E-S-G</b>: Earth (środowisko), Society (ludzie), Governance (zarządzanie)."},
      {title:"Greenwashing = ESG na ściemę",body:"Firmy zmieniają się przez: reputację, uwagę inwestorów (social signalling), herding ('wszyscy już to robią'), wyprzedzanie regulacji. ALE <b>greenwashing</b> = zarządzanie wrażeniem (zielony kolor, ładne foto, ogólniki).",real:"Certyfikat poświadcza zgodność tylko w momencie certyfikacji. Zielony ≠ realnie eko."},
      {title:"Ekonomia Obwarzanka (Raworth)",body:"Rozwój między 🍩 <b>'podłogą' społeczną</b> (potrzeby ludzi) a <b>'sufitem' ekologicznym</b> (granice planety). 'Beyond GDP' — PKB to środek, nie cel. <b>Amsterdam</b> jako pierwsze miasto przyjął model.",real:"Nie za mało (ludzie cierpią), nie za dużo (planeta cierpi). Życie w pierścieniu."}
     ],
     flashcards:[
      {t:"Keynes vs Hayek (Zielony Ład)",d:"Keynes = interwencja (regulacje, dotacje, państwo sterownik). Hayek = rynek (handel emisjami, cena węgla). UE = hybryda obu."},
      {t:"ESG",d:"Kryteria oceny pozafinansowej firm: Environmental (środowisko), Social (odpowiedzialność), Governance (ład korporacyjny)."},
      {t:"Agenda 2030 / SDGs",d:"17 Celów Zrównoważonego Rozwoju ONZ jako globalny język (koniec ubóstwa, czysta energia, działania klimatyczne, mniej nierówności...)."},
      {t:"Greenwashing",d:"Zarządzanie wrażeniem — pozorowanie ekologiczności (zielony kolor, foto, ogólniki). Gra na heurystykach konsumenta."},
      {t:"Ekonomia Obwarzanka (Raworth)",d:"Rozwój między 'podłogą' społeczną (potrzeby) a 'sufitem' ekologicznym (granice planety). Beyond GDP."},
      {t:"Beyond GDP",d:"Odejście od fetyszyzacji PKB na rzecz mierników dobrobytu (HDI, GPI). PKB jest środkiem, nie celem."},
      {t:"Amsterdam jako obwarzanek",d:"Pierwsze miasto, które oficjalnie przyjęło model Raworth (po pandemii). Cele: −50% surowców do 2030, 100% cyrkularności do 2050."},
      {t:"5 faz akceptacji regulacji przez biznes",d:"Od zaprzeczania do akceptacji — firmy przechodzą przez fazy oporu wobec nowej regulacji (zaprzeczanie → opór → targowanie → adaptacja → akceptacja), zanim ją wdrożą."},
      {t:"Model COM-B",d:"Rama zmiany zachowań (Michie i in. 2011): zachowanie (Behaviour) wynika z Capability (możliwości), Opportunity (okazji) i Motivation (motywacji). Podstawa interwencji behawioralnych."}
     ],
     quiz:[
      {q:"Co oznacza skrót ESG?",a:["Economy, Society, Growth","Environmental, Social, Governance","Energy, Sustainability, Green","European Standard Group"],c:1,e:"Environmental, Social, Governance — ocena pozafinansowa firm."},
      {q:"Jak UE łączy Keynesa i Hayeka w klimacie?",a:["Tylko regulacje","Hybryda: regulacje (zakaz aut spalinowych) + rynki (EU ETS)","Tylko rynek","Rezygnuje z obu"],c:1,e:"Twarde zakazy + bodźce rynkowe (handel emisjami)."},
      {q:"Ekonomia Obwarzanka zakłada rozwój:",a:["maksymalizujący PKB za wszelką cenę","między 'podłogą' społeczną a 'sufitem' ekologicznym","bez żadnych granic","tylko ekologiczny, bez ludzi"],c:1,e:"Beyond GDP — PKB to środek, nie cel."},
      {q:"Greenwashing to:",a:["realna transformacja ekologiczna","pozorowanie ekologiczności bez realnej treści","mycie paneli słonecznych","certyfikat ISO"],c:1,e:"Gra na heurystykach: zielony kolor, foto, ogólniki."},
      {q:"Model COM-B tłumaczy zachowanie przez:",a:["Capital, Output, Money, Balance","Capability, Opportunity, Motivation → Behaviour","Cost, Margin, Benefit","Control, Order, Market"],c:1,e:"Zachowanie = możliwości + okazja + motywacja (Michie i in.)."}
     ]},
    /* ---------------- L7 ---------------- */
    {id:"l7",title:"Zrównoważony rozwój a praca",emoji:"👷",
     feed:[
      {title:"Flexicurity i godna praca",body:"<b>Godna praca</b> — w warunkach wolności, równości, bezpieczeństwa, godności.<br><b>Flexicurity</b> = <b>elastyczność</b> dla firm (łatwiej zwolnić) + <b>bezpieczeństwo</b> dla ludzi (zasiłki, przekwalifikowanie).<br><b>Mitbestimmung</b> = współdecydowanie pracowników.",real:"Etat = stabilność ale sztywno. Gig (Uber, Glovo) = elastycznie ale prekaryzacja. Flexicurity godzi oba."},
      {title:"Czemu tkwisz w złej robocie",body:"<b>Status quo bias</b> ('lepsze znane piekło'), <b>loss aversion</b> (nowa praca musi być 2–3× lepsza), <b>scarcity mindset</b> (brak kasy/czasu zabija planowanie), <b>sunk cost</b> ('przepracowałem tu 10 lat').",real:"Te same biasy co w grindach. Mózg nie cierpi zmian, nawet dobrych."},
      {title:"Turkusowe organizacje (Laloux)",body:"Od hierarchii ('zasób ludzki') do turkusu: 🔄 <b>samoorganizacja</b> (brak szefów), 🧘 <b>pełnia</b> (podmiotowość), 🎯 <b>cel ewolucyjny</b> (zysk = skutek uboczny). Case: <b>Buurtzorg</b> — pielęgniarki bez menedżerów.",real:"Firma bez szefów, a działa. Buurtzorg robi to naprawdę: wyższa satysfakcja, niższe koszty."}
     ],
     flashcards:[
      {t:"Godna praca (decent work)",d:"Praca produktywna w warunkach wolności, równości, bezpieczeństwa i godności ludzkiej."},
      {t:"Mitbestimmung",d:"Współdecydowanie — instytucjonalny udział pracowników w zarządzaniu firmą (rady zakładowe, rady nadzorcze)."},
      {t:"Flexicurity",d:"Równowaga: elastyczność zatrudnienia dla firm (łatwiej zwolnić) + bezpieczeństwo socjalne dla pracowników (zasiłki, przekwalifikowanie)."},
      {t:"Tradycyjne vs atypowe zatrudnienie",d:"Etat = stabilność, ochrona, ale sztywność. Atypowe (B2B, gig, Uber/Glovo) = elastyczność i wyższe stawki, ale prekaryzacja i brak zabezpieczeń."},
      {t:"Bariery mobilności zawodowej",d:"Status quo bias, loss aversion (nowa praca musi być 2–3× lepsza), scarcity mindset, sunk cost fallacy, normy/tożsamość."},
      {t:"Turkusowe organizacje (Laloux)",d:"Firmy bez hierarchii: samoorganizacja, pełnia (podmiotowość), cel ewolucyjny (zysk = skutek uboczny). Case: Buurtzorg (Holandia)."},
      {t:"Endowment effect",d:"Efekt posiadania — cenimy to, co mamy, wyżej niż gdybyśmy mieli to dopiero kupić. Utrudnia współdzielenie i gospodarkę cyrkularną."}
     ],
     quiz:[
      {q:"Czym jest flexicurity?",a:["Elastyczność dla firm + bezpieczeństwo socjalne dla pracowników","Tylko ochrona przed zwolnieniem","System bez zasiłków","Zakaz umów cywilnych"],c:0,e:"Balans elastyczności i bezpieczeństwa (zasiłki, przekwalifikowanie)."},
      {q:"Dlaczego ludzie tkwią w złej pracy (behawioralnie)?",a:["Bo lubią cierpieć","Status quo bias, loss aversion, scarcity mindset, sunk cost","Bo prawo zabrania zmiany","Bo nie ma ofert"],c:1,e:"'Lepsze znane piekło niż nieznany raj'."},
      {q:"Turkusowe organizacje opierają się na:",a:["sztywnej hierarchii","samoorganizacji, pełni i celu ewolucyjnym","maksymalizacji zysku za wszelką cenę","jednym wszechmocnym szefie"],c:1,e:"Brak szefów, podmiotowość, zysk = skutek uboczny. Case: Buurtzorg."},
      {q:"Atypowe formy zatrudnienia (gig, B2B) cechuje:",a:["pełna ochrona i ubezpieczenia","elastyczność i wyższe stawki, ale prekaryzacja","wyłącznie stabilność","spadek udziału na rynku"],c:1,e:"Uber, Glovo — rosnący udział, brak zabezpieczeń."}
     ]},
    /* ---------------- L8 ---------------- */
    {id:"l8",title:"Innowacje + Przyszłość",emoji:"🤖",
     feed:[
      {title:"Państwo przedsiębiorcze (Mazzucato)",body:"Mit: innowacje robi tylko biznes. Real: <b>państwo kreuje rynki</b> i bierze największe ryzyko (badania podstawowe), a korporacje <b>prywatyzują zyski</b>.",real:"Podatnik finansuje ryzyko, kasę zgarnia firma. Postulat: państwo powinno mieć zwrot (udziały, tantiemy)."},
      {title:"Kto NAPRAWDĘ wynalazł iPhone'a",body:"Apple genialnie ZINTEGROWAŁ, ale rdzeń to granty publiczne/wojskowe: 🌐 Internet (ARPANET/DARPA), 📍 GPS (marynarka USA), 👆 ekran dotykowy (NSF+CIA), 🗣️ Siri (DARPA).",real:"'Wolnorynkowa innowacja' stała na publicznych pieniądzach. Plot twist stulecia."},
      {title:"Polska jako państwo przedsiębiorcze",body:"Instytucje: <b>NCBiR</b> (projekty B+R nauka↔przemysł), <b>Sieć Łukasiewicz</b> (37 instytutów, polski Fraunhofer), <b>NCN</b> (badania podstawowe, polski NSF), Fundusz Polskich Technologii Krytycznych. Słabość: wydatki B+R poniżej średniej UE, brak mechanizmów zwrotu.",real:"Mamy instytucje, ale finansujemy ryzyko i rzadko odzyskujemy zyski (brak equity/royalties)."},
      {title:"Paradoks AI — 'zerwana drabina'",body:"AI ogarnia zadania juniorów (kod, research, copy). 🪜 bariera wejścia (junior 'za drogi' vs AI), 👴 Senior Shortage 2040 (bez juniora nie ma seniora), 🎓 erozja mentoringu.",real:"Wytnij dolny szczebel drabiny — nikt nie wejdzie na górę. Ryzyko 'straconego pokolenia'."},
      {title:"Zombie-idee i wojna kognitywna",body:"<b>Zombie-idee</b> (Krugman) — poglądy szkodliwe, ale wciąż żywe (confirmation bias, groupthink). <b>Wojna kognitywna</b> — social media promują skrajne emocje, farmy trolli, bańki → niszczą zaufanie do instytucji. <b>Techno-feudalizm</b> = Big Tech silniejszy niż rządy.",real:"Bez zaufania społecznego nie zrobisz trudnych reform (np. transformacji energetycznej)."}
     ],
     flashcards:[
      {t:"Państwo przedsiębiorcze (Mazzucato)",d:"Państwo nie tylko 'naprawia rynki', ale aktywnie kreuje rynki i bierze największe ryzyko (badania podstawowe). Korporacje prywatyzują zyski."},
      {t:"Przemysł 4.0",d:"Czwarta Rewolucja Przemysłowa — integracja świata fizycznego, cyfrowego i biologicznego. Kluczowe: AI, IoT, biotechnologie."},
      {t:"Potrójna Helisa (Triple Helix)",d:"System innowacji = współpraca 3 sektorów: Nauka (uczelnie, B+R), Biznes (komercjalizacja), Państwo (granty, regulacje)."},
      {t:"Efekty sieciowe",d:"W gospodarce cyfrowej usługa zyskuje, im więcej osób z niej korzysta → 'zwycięzca bierze wszystko' → monopole naturalne (GAFAM)."},
      {t:"Uspołecznienie ryzyka, prywatyzacja zysków",d:"Podatnicy finansują ryzykowne badania (Internet, GPS), zyski z komercjalizacji trafiają do prywatnych firm. Mazzucato: państwo powinno mieć zwrot."},
      {t:"Polskie instytucje innowacji",d:"NCBiR (B+R nauka↔przemysł), Sieć Łukasiewicz (37 instytutów, polski Fraunhofer), NCN (badania podstawowe, polski NSF), Fundusz Polskich Technologii Krytycznych."},
      {t:"Paradoks AI / 'zerwana drabina'",d:"AI automatyzuje zadania juniorów → bariera wejścia, Senior Shortage 2040, erozja mentoringu, ryzyko 'straconego pokolenia'."},
      {t:"Zombie-idee (Krugman)",d:"Poglądy ekonomiczne (np. skrajny neoliberalizm), które mimo dowodów na szkodliwość wciąż funkcjonują w polityce."},
      {t:"Neoliberalizm vs Nowy Pragmatyzm/SGR",d:"Neoliberalizm: 'małe państwo', deregulacja, nierówności OK, środowisko = efekt zewnętrzny. Nowy Pragmatyzm/SGR: państwo = strażnik ładu, regulacja dla równowagi, redukcja nierówności, środowisko = filar równorzędny."},
      {t:"Techno-feudalizm",d:"Ryzyko gospodarki, w której globalne platformy cyfrowe (Big Tech) mają większą władzę nad życiem obywateli niż demokratyczne rządy."},
      {t:"Wojna kognitywna",d:"Social media promują skrajne emocje (engagement bait), farmy trolli, bańki informacyjne → niszczą zaufanie do instytucji państwa."}
     ],
     quiz:[
      {q:"Główna teza Mazzucato o 'państwie przedsiębiorczym':",a:["Państwo tylko psuje gospodarkę","Państwo kreuje rynki i bierze ryzyko, a korporacje prywatyzują zyski","Innowacje robi wyłącznie biznes","Państwo nie powinno finansować badań"],c:1,e:"Uspołecznienie ryzyka + prywatyzacja zysków. Postulat: państwo powinno mieć zwrot."},
      {q:"Które technologie iPhone'a powstały z grantów publicznych?",a:["żadne","Internet (DARPA), GPS (marynarka), ekran dotykowy (NSF/CIA), Siri (DARPA)","tylko aparat","tylko bateria"],c:1,e:"Apple je zintegrował, ale rdzeń z badań publicznych/wojskowych."},
      {q:"Model Potrójnej Helisy łączy:",a:["rząd, wojsko, kościół","Naukę, Biznes i Państwo","banki, giełdę, ubezpieczycieli","UE, ONZ, NATO"],c:1,e:"Nauka (B+R) + Biznes (komercjalizacja) + Państwo (finansowanie ryzyka)."},
      {q:"Paradoks AI ('zerwana drabina') polega na tym, że:",a:["AI tworzy nieograniczone miejsca pracy","automatyzacja zadań juniorów blokuje wejście i grozi brakiem seniorów","AI zastępuje tylko seniorów","nie ma problemu"],c:1,e:"Bez etapu juniora nie wyhodujesz seniora."},
      {q:"Polski odpowiednik instytutów Fraunhofera to:",a:["NBP","Sieć Badawcza Łukasiewicz","ZUS","GUS"],c:1,e:"Sieć Łukasiewicz — 37 instytutów B+R współpracujących z przemysłem (od 2019)."}
     ]},
    /* ---------------- L9 BOSS: pytania grup ---------------- */
    {id:"grupy",title:"🎤 BOSS: Pytania grup",emoji:"🏆",
     feed:[
      {title:"To jest ~40% Twojego testu",body:"4 pytania testowe z ostatniego slajdu KAŻDEJ prezentacji zespołowej (12 grup) → prowadzący bierze z nich <b>~40% pytań</b> na kolos. Tu masz <b>43 pytania z 11 grup</b> z poprawnymi odpowiedziami.",real:"Najwyższy priorytet przed kolosem. Jak to ogarniesz, prawie połowa testu z głowy."}
     ],
     flashcards:[],
     quiz:[
      {q:"[Renko] Czym charakteryzuje się „problem wspólnego zasobu” w budżecie?",a:["Grupy interesu dążą do wydania środków na własne cele, a koszty płacą wszyscy podatnicy","Państwo gromadzi nadwyżki na wspólnym koncie inwestycyjnym","Wszystkie podatki od firm trafiają do jednego ministerstwa"],c:0,e:"Common-pool: każdy chce wydać wspólną kasę na swoje, koszt rozkłada się na wszystkich."},
      {q:"[Renko] Jak według badań zmienia się budżet w roku wyborczym?",a:["Politycy maksymalnie tną wydatki","Rząd przesuwa środki na widoczne inwestycje i transfery socjalne","Budżet jest całkowicie zamrażany"],c:1,e:"Polityczny cykl koniunkturalny — przed wyborami wydatki tam, gdzie widać."},
      {q:"[Renko] Główny punkt reformy reguł fiskalnych UE z 2024?",a:["Powrót do sztywnej zasady 1/20","Bezwzględny zakaz deficytu","Analiza indywidualnej ścieżki „wydatków netto” i trwałości długu"],c:2,e:"Koniec 1/20 — indywidualne 4-letnie plany i kontrola wydatków netto."},
      {q:"[Renko] Kiedy w pełni rusza Polska Rada Fiskalna?",a:["1 stycznia 2024","1 stycznia 2025","1 stycznia 2026"],c:2,e:"Od 1 stycznia 2026 — jeden z ostatnich krajów UE bez tego organu."},
      {q:"[Stanley] „Niewidzialna ręka” Adama Smitha oznacza:",a:["Regulację państwową","Samoregulację rynku przez popyt i podaż","Centralne planowanie","Podatki progresywne"],c:1,e:"Rynek sam się reguluje grą popytu i podaży."},
      {q:"[Stanley] Czym ordoliberalizm różni się od neoliberalizmu?",a:["Rynek potrzebuje ram prawnych i ochrony konkurencji","Promuje minimalną rolę państwa","Interwencja tylko w kryzysie","Całkowicie ufa cenom"],c:0,e:"Ordo = rynek MUSI mieć ramy i ochronę konkurencji."},
      {q:"[Stanley] Który przykład ilustruje politykę neoliberalną?",a:["Reforma walutowa i antymonopol w powojennych Niemczech","Program „Right to Buy” Thatcher w UK","SGR w Niemczech","Fundusz odbudowy UE"],c:1,e:"Thatcheryzm (Right to Buy) = klasyka neoliberalnej prywatyzacji."},
      {q:"[Stanley] Skutki kryzysu 2008 w kontekście neoliberalizmu?",a:["Zwiększenie kontroli nad konkurencją","Podważenie deregulacji i krytyka braku nadzoru finansowego","Wysoka inflacja w Europie","Odejście od rynku"],c:1,e:"2008 obnażył skutki zbyt daleko posuniętej deregulacji."},
      {q:"[OJ] Dlaczego problem mieszkaniowy to problem społeczny?",a:["Dotyczy tylko firm budowlanych","Wpływa na warunki życia, stabilność i decyzje życiowe ludzi","Odnosi się tylko do estetyki osiedli"],c:1,e:"Mieszkanie wpływa na rodzinę, pracę, usamodzielnienie."},
      {q:"[OJ] Co pokazuje, że sam rynek nie zaspokaja potrzeb mieszkaniowych?",a:["Powstają mieszkania głównie dla osób o wyższych dochodach/zdolności kredytowej","Każdy może mieć problemy","Ceny stale spadają"],c:0,e:"Oferta prywatna celuje w lepiej zarabiających."},
      {q:"[OJ] Jaki jest cel społecznych form najmu (TBS, SIM)?",a:["Budowa premium w centrach","Dostępne mieszkania dla średnich i niższych dochodów","Zwiększenie zysków inwestorów"],c:1,e:"TBS/SIM = najem o umiarkowanym czynszu."},
      {q:"[OJ] Dlaczego państwo/samorząd ma rolę w mieszkaniówce?",a:["Mogą kierować działania na potrzeby społeczne, nie tylko zysk","Budują szybciej niż prywatni","Zastępują rynek prywatny"],c:0,e:"Państwo patrzy szerzej: stabilność i długoterminowe bezpieczeństwo."},
      {q:"[Goat] Termin na wydanie przez Radę Fiskalną opinii o budżecie?",a:["30 dni","14 dni","7 dni"],c:1,e:"14 dni — Rada ma działać szybko."},
      {q:"[Goat] Minimalne doświadczenie kandydata na członka RF?",a:["5 lat","10 lat","15 lat"],c:1,e:"10–15 lat doświadczenia, minimum = 10."},
      {q:"[Goat] Na czym polega zasada „zastosuj lub wyjaśnij”?",a:["Rząd musi przyjąć każdą poprawkę Rady","Minister Finansów musi publicznie uzasadnić niezastosowanie się do opinii","Rada ma prawo weta"],c:1,e:"Rada nie ma weta — rząd musi w 2 miesiące uzasadnić odrzucenie."},
      {q:"[Goat] Maks. okres spłaty pożyczki FIZB/SAFE (projekt 2026)?",a:["45 lat","25 lat","10 lat"],c:0,e:"Unijny SAFE oferuje bardzo długie maturity — do 45 lat."},
      {q:"[JKP] Cel sprawiedliwej transformacji w odchodzeniu od węgla?",a:["Natychmiastowe zamknięcie elektrowni bez względu na koszty","Modernizacja gospodarki ze wsparciem dla pracowników i regionów","Rezygnacja z jądrowej na rzecz tylko OZE","Utrzymanie wydobycia węgla"],c:1,e:"„Sprawiedliwa” = nikt nie zostaje z tyłu (Just Transition Fund)."},
      {q:"[JKP] Sytuacja energetyczna Polski wobec Zielonego Ładu?",a:["Lider transformacji w UE","Zwolniona z celów ze względu na węgiel","Transformacja zakończona sukcesem","Polska nadal opiera energię elektryczną głównie na węglu"],c:3,e:"Polska wciąż stoi węglem — stąd skala wyzwania."},
      {q:"[JKP] Które źródła zwiększą bezpieczeństwo energetyczne Polski?",a:["Ropa i gaz łupkowy","OZE i energetyka jądrowa","Tylko węgiel","Drewno i torf"],c:1,e:"OZE + atom = dywersyfikacja, uniezależnienie od paliw kopalnych."},
      {q:"[JKP] Główne wyzwanie Zielonego Ładu w Polsce?",a:["Zwiększenie wydobycia węgla","Budowa kopalń","Przejście z węgla na OZE","Ograniczenie internetu na wsi"],c:2,e:"Odejście od węgla na rzecz odnawialnych."},
      {q:"[Mind] Co oznacza skrót ESG?",a:["Environmental, Social, Governance","Economic, Sustainability, Growth","Energy, Society, Globalization","Ekologia, Społeczeństwo, Giełda"],c:0,e:"Environmental, Social, Governance."},
      {q:"[Mind] Który element należy do obszaru „E”?",a:["Warunki pracy","Zarządzanie firmą","Emisja CO₂","Relacje ze społecznością"],c:2,e:"E = środowisko (emisje). Warunki pracy = S, zarządzanie = G."},
      {q:"[Mind] Czym jest greenwashing?",a:["Realne działania na rzecz środowiska","Wprowadzanie w błąd co do działań ekologicznych","Raportowanie finansowe","Inwestowanie w OZE"],c:1,e:"Udawanie eko bez realnej treści."},
      {q:"[Mind] Cel raportowania niefinansowego?",a:["Zwiększenie sprzedaży","Pozytywny marketing","Informacje dla inwestorów o wpływie firmy i ryzykach","Zastąpienie raportów finansowych"],c:2,e:"CSRD informuje inwestorów o wpływie i ryzykach ESG."},
      {q:"[Zadymiarze] CMU Rate dla Polski w 2023?",a:["18,4%","9,2%","30,6%"],c:1,e:"9,2% (Eurostat) — poniżej średniej UE (~11,8%)."},
      {q:"[Zadymiarze] Co oznacza zasada R3 w hierarchii 9R GOZ?",a:["Recykling","Reuse — ponowne użycie","Refuse — odmowa zakupu"],c:1,e:"R3 = Reuse, wyżej niż recykling (R8)."},
      {q:"[Zadymiarze] Od kiedy w Polsce system kaucyjny?",a:["1.01.2024","1.10.2025","1.07.2026"],c:1,e:"Przesunięty z lipca 2025 na 1 października 2025."},
      {q:"[Zadymiarze] Dokument UE: 25% surowców z recyklingu do 2030?",a:["Critical Raw Materials Act","European Green Deal","Pakiet GOZ 2020"],c:0,e:"CRMA (Rozporządzenie UE 2024/1252)."},
      {q:"[EM] Najbardziej znany przykład modelu flexicurity?",a:["Polska","Dania","Niemcy","Hiszpania"],c:1,e:"Dania = wzorcowy model flexicurity."},
      {q:"[EM] Co zyskuje pracownik dzięki flexicurity?",a:["Wakacje za granicą","Premię na święta","Większe bezpieczeństwo socjalne","Samochód służbowy"],c:2,e:"Security = zasiłki, przekwalifikowanie, bezpieczeństwo."},
      {q:"[EM] Co NIE należy do filarów flexicurity UE?",a:["Aktywna polityka rynku pracy","Uczenie się przez całe życie","Sztywna ochrona jednego miejsca pracy niezależnie od sytuacji","Nowoczesny system zabezpieczenia"],c:2,e:"Sztywna ochrona to przeciwieństwo flexicurity."},
      {q:"[EM] Które działanie wpisuje się we flexicurity?",a:["Rozwój aktywnej polityki rynku pracy i szkoleń","Usunięcie regulacji czasu pracy","Ograniczenie kursów","Ułatwienie zwalniania bez wsparcia"],c:0,e:"Aktywna polityka rynku pracy + szkolenia = serce flexicurity."},
      {q:"[Szefy] Status prawny kierowców Ubera/Glovo w PL?",a:["Wolontariusze","Formalnie przedsiębiorcy (samozatrudnienie)","Urzędnicy państwowi","Pracownicy na umowę o pracę"],c:1,e:"Formalnie samozatrudnieni — stąd brak ochrony jak na etacie."},
      {q:"[Szefy] Konsekwencja braku umowy o pracę dla gig workerów?",a:["Gwarancja stałego wynagrodzenia","Finansowanie paliwa przez platformę","Brak płatnych urlopów, odpraw i zwolnień chorobowych","Zwolnienie z ryzyka ekonomicznego"],c:2,e:"Bez umowy o pracę = bez urlopu płatnego, odpraw, L4."},
      {q:"[Szefy] Algorytmy jako „czarna skrzynka” oznaczają:",a:["Brak transparentności — nie wiadomo jak zapadają decyzje o zleceniach","Urządzenie rejestrujące wypadki","System szyfrowania danych klientów","Schowek na paczki"],c:0,e:"Nieprzejrzysty algorytm decydujący o pracy bez wyjaśnień."},
      {q:"[Alfa] Czym jest państwo przedsiębiorcze?",a:["Państwo prowadzące sklepy","Państwo wspierające innowacje i badania","Państwo bez podatków","Państwo bez firm prywatnych"],c:1,e:"Mazzucato: państwo finansuje innowacje i ryzykowne badania."},
      {q:"[Alfa] Kto finansuje wiele badań naukowych?",a:["Państwo","Tylko uczniowie","Tylko sportowcy","Tylko artyści"],c:0,e:"Badania podstawowe najczęściej finansuje państwo."},
      {q:"[Alfa] Która technologia rozwijana dzięki wsparciu państwa?",a:["Internet","Rower","Zeszyt","Ołówek"],c:0,e:"Internet (ARPANET) z badań DARPA."},
      {q:"[Alfa] Czy prywatne firmy zawsze inwestują w ryzykowne badania?",a:["Tak, zawsze","Nie, często unikają ryzyka","Nigdy nie inwestują","Tylko w weekendy"],c:1,e:"Firmy często unikają ryzyka — stąd wkracza państwo."},
      {q:"[Golden Oldies] Co oznacza skrót CETA?",a:["Central European Trade Agreement","Comprehensive Economic and Trade Agreement","Canadian External Tariff Act","Common European Trade Alliance"],c:1,e:"CETA = umowa handlowa UE–Kanada (od 2017)."},
      {q:"[Golden Oldies] Dlaczego zawieszono negocjacje TTIP?",a:["Kanada odmówiła","WTO zablokowała","Zmiana administracji USA 2016 i sprzeciw społeczny","UE wycofała się po Brexicie"],c:2,e:"TTIP (UE–USA) padło na zmianie administracji USA + oporze społecznym."},
      {q:"[Golden Oldies] Czym jest mechanizm ISDS?",a:["Fundusz wsparcia rolników","Stały sąd z publicznymi sędziami","Arbitraż — inwestor może pozwać państwo z pominięciem sądów krajowych","Procedura ratyfikacji umów"],c:2,e:"ISDS = arbitraż inwestor–państwo. ICS to jego reforma."},
      {q:"[Golden Oldies] Główne zagrożenie umowy UE–Mercosur dla rolników?",a:["Zakaz eksportu do Ameryki Płd.","Konkurencja tańszych produktów rolnych wg niższych standardów","Obowiązek norm południowoamerykańskich w UE","Wzrost cen nawozów"],c:1,e:"Tańsza żywność z Mercosuru (niższe standardy) = presja na rolników."}
     ]}
  ]
});
