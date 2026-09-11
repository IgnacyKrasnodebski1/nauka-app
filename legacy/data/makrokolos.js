/* ============================================================
   PRZEDMIOT: Makroekonomia — kolos (5 pytań)
   Na bazie realnego kolosa (grupy a1–a5). Te same TYPY pytań, inne liczby.
   Każdy poziom = jeden typ: metoda + przeliczony przykład + warianty liczbowe do drylu.
   ============================================================ */
window.SUBJECTS = window.SUBJECTS || [];
window.SUBJECTS.push({
  id:"makrokolos",
  name:"Makroekonomia — kolos (5 pytań)",
  short:"Makro-kolos",
  emoji:"🧮",
  tagline:"5 typów pytań z kolosa: realne PKB, inflacja, aktywność zawodowa, model Solowa, krzyż keynesowski.",
  accent:"linear-gradient(135deg,#0ea5e9,#1ed760,#0ea5e9)",
  accent2:"#1ed760",
  grading:{pass:50,examMin:15,scale:[[90,"5"],[80,"4,5"],[70,"4"],[60,"3,5"],[50,"3"]],failLabel:"2 — niezaliczone"},
  info:`
    <div class="zbox"><h3>🎯 Po co to</h3>
      <p>Na kolosie pojawią się <b>dokładnie te 5 pytań</b> — tylko z innymi liczbami. Tu masz <b>metodę na każde</b> + przeliczony oryginał + warianty z innymi danymi. Ogarnij metodę, a podstawisz dowolne liczby.</p></div>
    <div class="zbox"><h3>⚡ Najczęstsze pułapki</h3>
      <p>• <b>Realne PKB</b> liczysz cenami <b>roku bazowego</b> (nie bieżącego!).<br>• <b>Inflację</b> za kilka lat <b>mnożysz</b> (1+i), a nie dodajesz.<br>• <b>Aktywność zawodowa</b> = pracujący <b>+</b> bezrobotni, podzielone przez dorosłych.<br>• W <b>Solowie</b> przy k poniżej k* nachylenie produkcji jest <b>większe</b> (malejąca produktywność kapitału).</p></div>`,
  levels:[
    /* ---------------- Q1: Realne PKB ---------------- */
    {id:"q1",title:"Q1: Realne PKB + stopa wzrostu",emoji:"📊",
     feed:[
      {title:"Wzór (zapamiętaj)",body:"<b>Realne PKB (rok t)</b> = Σ (ilość z roku t × cena z roku <b>bazowego</b>).<br><b>Stopa wzrostu realnego PKB</b> = (realne PKB_t − realne PKB_t−1) / realne PKB_t−1 × 100%.",mnemo:"Realne = ILOŚCI bieżące × CENY bazowe. Nominalne = ilości × ceny bieżące."},
      {title:"Twój przykład (jabłka + ziemniaki)",body:"Rok bazowy 2020: cena jabłka 5, cena ziemniaka 2.<br><b>Realne PKB 2022</b> = 200·5 + 150·2 = 1000 + 300 = <b>1300 €</b><br><b>Realne PKB 2021</b> = 150·5 + 75·2 = 750 + 150 = 900 €<br><b>Wzrost 2022</b> = (1300 − 900)/900 = <b>44%</b>",real:"Odpowiedź: 1300 € i 44%. (Uwaga: nominalne PKB 2022 = 200·7+150·4 = 2000 — to pułapka, nie używaj cen 2022!)"},
      {title:"Schemat krok po kroku",body:"1) Weź <b>ceny z roku bazowego</b>.<br>2) Pomnóż przez <b>ilości z roku, którego szukasz</b>.<br>3) Zsumuj wszystkie dobra → realne PKB.<br>4) Wzrost = (nowe − stare)/stare × 100%.",real:"Liczysz dwa lata (bieżący i poprzedni), żeby policzyć wzrost."}
     ],
     flashcards:[
      {t:"Realne PKB — wzór",d:"Σ (ilości z danego roku × ceny roku BAZOWEGO)."},
      {t:"Nominalne PKB — wzór",d:"Σ (ilości × ceny z TEGO SAMEGO, bieżącego roku)."},
      {t:"Stopa wzrostu realnego PKB",d:"(realne PKB_t − realne PKB_t−1) / realne PKB_t−1 × 100%."},
      {t:"Rok bazowy",d:"Rok, którego ceny przyjmujemy do liczenia PKB realnego (tu: 2020)."},
      {t:"Realne PKB 2022 (przykład)",d:"200·5 + 150·2 = 1300 € (ceny 2020)."}
     ],
     quiz:[
      {q:"[oryginał] Realne PKB w 2022 (ceny bazowe 2020: jabłko 5, ziemniak 2; ilości 2022: 200 i 150):",a:["800 €","1300 €","2000 €","1700 €"],c:1,e:"200·5 + 150·2 = 1000+300 = 1300 €. (2000 = nominalne, pułapka.)"},
      {q:"[oryginał] Stopa wzrostu realnego PKB w 2022 (realne: 2021=900, 2022=1300):",a:["44%","52%","20%","14%"],c:0,e:"(1300−900)/900 = 0,444 ≈ 44%."},
      {q:"Realne PKB liczymy:",a:["cenami roku bieżącego","cenami roku bazowego × ilości bieżące","tylko ilościami","średnią cen"],c:1,e:"Realne = ilości bieżące × ceny bazowe (eliminujemy wpływ inflacji)."},
      {q:"Wariant: ceny bazowe X=10, Y=5; ilości 2022: X=30, Y=20. Realne PKB 2022 =",a:["350","400","700","600"],c:1,e:"30·10 + 20·5 = 300+100 = 400."},
      {q:"Wariant wzrostu: realne PKB 2021=250, 2022=400. Stopa wzrostu =",a:["37,5%","60%","150%","40%"],c:1,e:"(400−250)/250 = 0,6 = 60%."}
     ]},
    /* ---------------- Q2: Inflacja skumulowana ---------------- */
    {id:"q2",title:"Q2: Inflacja — cena po latach",emoji:"💸",
     feed:[
      {title:"Wzór (zapamiętaj)",body:"<b>Cena końcowa</b> = cena początkowa × (1+i₁) × (1+i₂) × (1+i₃) × …<br>gdzie i to inflacja w danym roku (jako ułamek: 7% = 0,07).",mnemo:"Inflację z kolejnych lat MNOŻYSZ, nie dodajesz. Dodanie (7+13+9=29%) = błąd!"},
      {title:"Twój przykład",body:"Inflacja: 7% (2020), 13% (2021), 9% (2022). Towar 1 zł na początku 2020.<br>1 × 1,07 × 1,13 × 1,09 =<br>1,07 × 1,13 = 1,2091 → × 1,09 = <b>1,32 zł</b>",real:"Odpowiedź: 1,32 zł. (Dodanie procentów dałoby 1,29 zł — to zła odpowiedź-pułapka.)"},
      {title:"Czemu mnożymy?",body:"Każdego roku ceny rosną od <b>nowego, wyższego</b> poziomu (procent składany). Dlatego (1+i) mnożymy przez siebie, tak jak odsetki składane w banku.",real:"To ten sam mechanizm co 'procent składany'."}
     ],
     flashcards:[
      {t:"Cena po inflacji — wzór",d:"P_końcowa = P_początkowa × (1+i₁)(1+i₂)(1+i₃)…"},
      {t:"7% jako ułamek",d:"0,07 → mnożnik (1+0,07) = 1,07."},
      {t:"Częsty błąd",d:"Dodawanie procentów (7+13+9). Trzeba MNOŻYĆ mnożniki, bo to procent składany."},
      {t:"Przykład",d:"1 zł × 1,07 × 1,13 × 1,09 = 1,32 zł."}
     ],
     quiz:[
      {q:"[oryginał] Towar 1 zł; inflacja 7%, 13%, 9%. Cena po 3 latach:",a:["1,29 zł","1,32 zł","1,45 zł","1,21 zł"],c:1,e:"1·1,07·1,13·1,09 = 1,32 zł. (1,29 = błędne dodanie procentów.)"},
      {q:"Inflację za kilka lat liczymy:",a:["dodając procenty","mnożąc (1+i) kolejnych lat","biorąc średnią","odejmując"],c:1,e:"Procent składany → mnożymy mnożniki (1+i)."},
      {q:"Wariant: 1 zł, inflacja 10% i 20%. Cena końcowa:",a:["1,30 zł","1,32 zł","1,28 zł","1,02 zł"],c:1,e:"1·1,1·1,2 = 1,32 zł (a nie 1,30 z dodawania)."},
      {q:"Wariant: 100 zł, inflacja 5% przez 2 lata z rzędu:",a:["110 zł","110,25 zł","105 zł","125 zł"],c:1,e:"100·1,05·1,05 = 110,25 zł."}
     ]},
    /* ---------------- Q3: Aktywność zawodowa ---------------- */
    {id:"q3",title:"Q3: Wskaźnik aktywności zawodowej",emoji:"👷",
     feed:[
      {title:"Wzór (zapamiętaj)",body:"<b>Wskaźnik aktywności zawodowej</b> = (pracujący + bezrobotni) / liczba dorosłych (w wieku produkcyjnym).<br>Aktywni zawodowo = <b>pracujący + bezrobotni</b> (czyli siła robocza).",mnemo:"Aktywni = ci, co pracują LUB szukają pracy. Dzielisz przez wszystkich dorosłych."},
      {title:"Twój przykład",body:"Pracujący = 10, bezrobotni = 2, dorośli = 20.<br>Wskaźnik = (10 + 2) / 20 = 12/20 = <b>0,6</b>",real:"Odpowiedź: 0,6 (czyli 60% dorosłych jest aktywnych zawodowo)."},
      {title:"Nie pomyl z innymi (mogą być w dystraktorach)",body:"<b>Stopa bezrobocia</b> = bezrobotni / (pracujący+bezrobotni) = 2/12 = 16,7%.<br><b>Wskaźnik zatrudnienia</b> = pracujący / dorośli = 10/20 = 0,5.",real:"Aktywności zawodowej = siła robocza / dorośli. Zatrudnienia = pracujący / dorośli."}
     ],
     flashcards:[
      {t:"Wskaźnik aktywności zawodowej",d:"(pracujący + bezrobotni) / liczba dorosłych."},
      {t:"Aktywni zawodowo (siła robocza)",d:"pracujący + bezrobotni (szukający pracy)."},
      {t:"Stopa bezrobocia",d:"bezrobotni / (pracujący + bezrobotni)."},
      {t:"Wskaźnik zatrudnienia",d:"pracujący / liczba dorosłych."},
      {t:"Przykład",d:"(10+2)/20 = 0,6."}
     ],
     quiz:[
      {q:"[oryginał] Pracujący 10, bezrobotni 2, dorośli 20. Wskaźnik aktywności zawodowej:",a:["1,1","0,8","0,6","0,5"],c:2,e:"(10+2)/20 = 0,6."},
      {q:"Aktywni zawodowo to:",a:["tylko pracujący","pracujący + bezrobotni","wszyscy dorośli","tylko bezrobotni"],c:1,e:"Siła robocza = pracujący + bezrobotni."},
      {q:"Wariant: pracujący 30, bezrobotni 10, dorośli 50. Wskaźnik aktywności:",a:["0,6","0,8","0,4","1,0"],c:1,e:"(30+10)/50 = 0,8."},
      {q:"Z tych danych (10, 2, 20) stopa bezrobocia =",a:["10%","16,7%","20%","60%"],c:1,e:"bezrobotni/siła robocza = 2/12 = 16,7%."},
      {q:"Z tych danych wskaźnik zatrudnienia =",a:["0,5","0,6","0,2","1,0"],c:0,e:"pracujący/dorośli = 10/20 = 0,5."}
     ]},
    /* ---------------- Q4: Model Solowa ---------------- */
    {id:"q4",title:"Q4: Model Solowa (k₁ < k*)",emoji:"📈",
     feed:[
      {title:"Co pokazuje wykres",body:"Krzywe: produkcja <b>y = f(k)</b> (wygięta, malejące przyrosty), inwestycje <b>i = s·f(k)</b>, deprecjacja <b>δ·k</b> (linia prosta). Równowaga (stan ustalony) <b>k*</b> tam, gdzie <b>i = δ·k</b>.",mnemo:"k* = punkt, gdzie inwestycje = ubytek kapitału (starzenie)."},
      {title:"Gdy gospodarka jest w k₁ (na lewo od k*)",body:"Wtedy <b>i₁ > δ·k₁</b> → inwestycje generują więcej kapitału niż ubywa ze starzenia → <b>kapitał rośnie</b>, a z nim <b>produkcja</b>. Gospodarka <b>zbiega do k*</b>.<br>Nachylenie krzywej produkcji (krańcowa produktywność kapitału) jest <b>większe w k₁ niż w k*</b> (bo przyrosty maleją wraz ze wzrostem k).",real:"Poniżej k* → kapitał i produkcja rosną, dążą do równowagi; nachylenie f(k) większe niż w k*."},
      {title:"Poprawna odpowiedź (oryginał)",body:"„Nakłady na inwestycje generują kapitał w takiej wielkości, która <b>pozwala na przyrost produkcji</b>. Kapitału <b>przybywa szybciej niż ubywa</b> z powodu starzenia; nachylenie krzywej produkcji Y jest <b>większe w punkcie k₁ niż w punkcie równowagi</b>, do którego zbiega gospodarka.”",real:"Lustrzanie: gdyby k₂ > k*, to δ·k > i → kapitał MALEJE, też wraca do k*."}
     ],
     flashcards:[
      {t:"Stan ustalony k* (Solow)",d:"Punkt, w którym inwestycje = deprecjacja: s·f(k*) = δ·k*. Kapitał się nie zmienia."},
      {t:"k poniżej k* (np. k₁)",d:"i > δ·k → kapitał i produkcja rosną, gospodarka zbiega do k*."},
      {t:"k powyżej k* (np. k₂)",d:"δ·k > i → kapitału ubywa, gospodarka spada z powrotem do k*."},
      {t:"Nachylenie f(k) w k₁ vs k*",d:"Większe w k₁ (malejąca krańcowa produktywność kapitału — krzywa się wypłaszcza)."},
      {t:"δ·k",d:"Deprecjacja — ubytek kapitału z powodu zużycia/starzenia (linia prosta)."}
     ],
     quiz:[
      {q:"[oryginał] Gospodarka w k₁ (na lewo od k*). Co się dzieje?",a:["produkcja jest w całości konsumowana, kapitał nie przyrasta","inwestycje > deprecjacja → kapitał i produkcja rosną, zbiega do k*; nachylenie f(k) większe w k₁ niż w równowadze","kapitału ubywa, produkcja spada","gospodarka nie może zbiegać do równowagi"],c:1,e:"k₁<k* → i>δk → kapitał rośnie; nachylenie f(k) większe niż w k*."},
      {q:"Stan ustalony k* to punkt, gdzie:",a:["produkcja = 0","inwestycje = deprecjacja (s·f(k)=δ·k)","kapitał jest największy","konsumpcja = 0"],c:1,e:"i = δ·k → kapitał się nie zmienia."},
      {q:"W punkcie k poniżej k* nachylenie krzywej produkcji jest:",a:["mniejsze niż w k*","większe niż w k*","takie samo","zerowe"],c:1,e:"Malejąca produktywność kapitału: im mniejsze k, tym stromiej."},
      {q:"Gdyby gospodarka była w k₂ > k*, to:",a:["kapitał rośnie dalej","kapitału ubywa (δ·k > i) i wraca do k*","nic się nie dzieje","produkcja spada do zera"],c:1,e:"Powyżej k* deprecjacja przewyższa inwestycje → powrót do k*."}
     ]},
    /* ---------------- Q5: Krzyż keynesowski → rynek pieniądza ---------------- */
    {id:"q5",title:"Q5: Krzyż keynesowski → pieniądz",emoji:"💱",
     feed:[
      {title:"Łańcuch przyczynowy",body:"Na krzyżu keynesowskim (wydatki E w funkcji produkcji Y) krzywa produkcji <b>się obniża</b> → nowy, <b>niższy punkt równowagi Y</b>.<br>Niższe Y → mniej transakcji → <b>maleje popyt na pieniądz</b> (zapotrzebowanie transakcyjne).",mnemo:"Mniej produkcji → mniej transakcji → mniej potrzeba pieniądza."},
      {title:"Co na rynku pieniądza",body:"Popyt na pieniądz maleje → krzywa <b>Dm przesuwa się w LEWO</b>.<br>Podaż pieniądza <b>Ms stała</b> (pionowa).<br>Efekt: <b>spada cena pieniądza</b> (stopa procentowa).",real:"Odpowiedź: maleje zapotrzebowanie; Dm w lewo; przy stałym Ms → spadek ceny pieniądza."},
      {title:"Lustrzanie (gdyby Y rosło)",body:"Gdyby produkcja <b>rosła</b>: popyt na pieniądz rośnie → Dm w <b>prawo</b> → przy stałym Ms <b>cena pieniądza rośnie</b>. (Odwrotny scenariusz — uważaj na dystraktory.)",real:"Klucz: spadek Y ⇒ Dm w lewo ⇒ niższa cena pieniądza (stopa %)."}
     ],
     flashcards:[
      {t:"Cena pieniądza",d:"Stopa procentowa — 'koszt' pieniądza na rynku pieniężnym."},
      {t:"Spadek produkcji Y → popyt na pieniądz",d:"Maleje (mniej transakcji) → krzywa Dm przesuwa się w LEWO."},
      {t:"Podaż pieniądza Ms",d:"Zwykle stała (pionowa) — kontrolowana przez bank centralny."},
      {t:"Dm w lewo przy stałym Ms",d:"→ spadek ceny pieniądza (stopy procentowej)."},
      {t:"Wzrost Y (odwrotnie)",d:"Popyt rośnie → Dm w prawo → wzrost ceny pieniądza."}
     ],
     quiz:[
      {q:"[oryginał] Krzywa produkcji się obniża (nowy, niższy punkt równowagi). Co na rynku pieniądza?",a:["maleje popyt; Dm w prawo; spadek ceny pieniądza","maleje popyt; przy stałym Ms Dm w lewo → spadek ceny pieniądza","rośnie popyt; Dm w prawo → wzrost ceny","maleje popyt; Dm w prawo → brak zmiany ceny"],c:1,e:"Niższe Y → mniejszy popyt na pieniądz → Dm w lewo → spadek ceny pieniądza (stopy %)."},
      {q:"Spadek produkcji Y wpływa na popyt na pieniądz:",a:["rośnie","maleje","bez zmian","najpierw rośnie, potem maleje"],c:1,e:"Mniej transakcji → mniejszy popyt transakcyjny na pieniądz."},
      {q:"Maleje popyt na pieniądz — krzywa Dm przesuwa się:",a:["w prawo","w lewo","w górę","nie rusza się"],c:1,e:"Spadek popytu → przesunięcie krzywej popytu w lewo."},
      {q:"Dm w lewo, Ms stałe → cena pieniądza (stopa %):",a:["rośnie","spada","bez zmian","podwaja się"],c:1,e:"Mniejszy popyt przy stałej podaży → niższa cena (stopa %)."},
      {q:"Odwrotnie: gdyby Y rosło, to:",a:["Dm w lewo, cena spada","Dm w prawo, cena rośnie","Ms w prawo","brak wpływu"],c:1,e:"Wzrost Y → wzrost popytu → Dm w prawo → wzrost ceny pieniądza."}
     ]}
  ]
});
