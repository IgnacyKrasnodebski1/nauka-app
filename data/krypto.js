/* ============================================================
   PRZEDMIOT: Wprowadzenie do kryptowalut i NFT (blockchain dla banku)
   Źródło: 8 prezentacji dr. hab. Krzysztofa Piecha (Uczelnia Łazarskiego / szkolenie Deutsche Bank)
   ============================================================ */
window.SUBJECTS = window.SUBJECTS || [];
window.SUBJECTS.push({
  id:"krypto",
  name:"Wprowadzenie do krypto i NFT",
  short:"Krypto",
  emoji:"₿",
  tagline:"Blockchain, konsensus, kryptografia, kryptoaktywa, rynek, stablecoiny — z perspektywy banku.",
  accent:"linear-gradient(135deg,#f7931a,#a855f7,#22d3ee)",
  accent2:"#f7931a",
  grading:{pass:50,examMin:20,scale:[[90,"5 / bdb"],[80,"4,5"],[70,"4 / db"],[60,"3,5"],[50,"3 / dst"]],failLabel:"2 — niezaliczone"},
  info:`
    <div class="zbox"><h3>⚠️ Zakres testu</h3>
      <p>Prowadzący (dr hab. K. Piech) napisał wprost: <b>test końcowy obejmuje tylko materiał OMÓWIONY na zajęciach</b> — nie te prezentacje, które zostały udostępnione, ale nieomówione.<br><br>Ta apka pokrywa wszystkie 8 udostępnionych prezek. Skup się na poziomach, które realnie były omawiane — resztę traktuj jako bonus.</p></div>
    <div class="zbox"><h3>Kluczowy kontekst (cz.1)</h3>
      <p>Pytanie przewodnie kursu: <b>„Czy blockchain rozwiązuje realny problem, czy tworzy nowy?”</b><br>Logika: jak działa → jak jest wykorzystywany → jakie generuje ryzyka → co to oznacza dla banku.</p></div>
    <div class="zbox"><h3>Regulacje, które padają najczęściej</h3>
      <p><b>MiCA</b> (ART + EMT), TFR, DAC8, DORA. MiCA dla stablecoinów obowiązuje od <b>30.06.2024</b>, pełna stosowalność od <b>30.12.2024</b>.</p></div>`,
  levels:[
    /* ---------------- L1 ---------------- */
    {id:"k1",title:"Blockchain — podstawy",emoji:"⛓️",
     feed:[
      {title:"Czym jest blockchain",body:"<b>Zdecentralizowany, rozproszony rejestr cyfrowy</b> zapisujący transakcje na wielu komputerach. Cztery filary: <b>decentralizacja</b> (brak jednego właściciela), <b>transparentność</b>, <b>niezmienność</b>, <b>mechanizm konsensusu</b> (PoW/PoS).",real:"Wspólny zeszyt, którego kopię ma każdy i nikt nie może po cichu wymazać wpisu.",mnemo:"<b>DE-TRANS-NIE-KON</b>: Decentralizacja, Transparencja, Niezmienność, Konsensus."},
      {title:"Linia czasu (must-know daty)",body:"<b>2008</b> — biała księga Bitcoina (Satoshi Nakamoto)<br><b>2009</b> — start sieci, Genesis Block<br><b>2013/2015</b> — Ethereum (Buterin), dApps<br><b>2017</b> — ICO<br><b>2020</b> — boom DeFi<br><b>2021</b> — NFT mainstream.",real:"Bitcoin 2008/2009, Ethereum 2015 — te dwie daty musisz znać."},
      {title:"Po co w ogóle Bitcoin? Problem zaufania",body:"Tradycyjny system finansowy opiera się na <b>pośrednikach</b> (banki, izby rozliczeniowe) — koszty i konieczność zaufania instytucjom. <b>Kryzys 2008</b> (upadek Lehman Brothers, bailouty, moral hazard) podkopał to zaufanie → biała księga Bitcoina jako odpowiedź.",real:"Bitcoin = 'nie ufaj bankom, ufaj matematyce'. Powstał wprost z gruzów kryzysu 2008."},
      {title:"Problem podwójnego wydatkowania",body:"Cyfrowy plik łatwo skopiować → jak zapobiec wydaniu tej samej monety dwa razy (<b>double spending</b>)? Tradycyjnie: centralny rejestr (bank). Bitcoin: <b>rozproszony publiczny rejestr</b> + konsensus, bez centralnego organu.",real:"Maila możesz wysłać 1000 razy. Pieniądza nie możesz wydać dwa razy — to rozwiązuje blockchain."}
     ],
     flashcards:[
      {t:"Blockchain",d:"Zdecentralizowany, rozproszony rejestr cyfrowy zapisujący transakcje na wielu węzłach. Filary: decentralizacja, transparentność, niezmienność, konsensus."},
      {t:"Satoshi Nakamoto",d:"Anonimowy twórca Bitcoina. 2008 — biała księga, 2009 — uruchomienie sieci. Tożsamość nieznana."},
      {t:"Double spending",d:"Problem podwójnego wydatkowania — ryzyko wydania tej samej jednostki cyfrowej dwa razy. Bitcoin rozwiązuje go rozproszonym rejestrem + konsensusem zamiast centralnego organu."},
      {t:"Kryzys 2008 a Bitcoin",d:"Upadek Lehman Brothers, bailouty i moral hazard podkopały zaufanie do scentralizowanego systemu. Biała księga Bitcoina (X 2008) to bezpośrednia odpowiedź."},
      {t:"Genesis Block",d:"Pierwszy blok sieci Bitcoin, wydobyty w 2009 r."},
      {t:"Ethereum",d:"Platforma blockchain (Buterin, propozycja 2013, start 2015) umożliwiająca smart kontrakty i zdecentralizowane aplikacje (dApps). Baza dla większości tokenów i DeFi."}
     ],
     quiz:[
      {q:"Cztery kluczowe cechy blockchaina to:",a:["centralizacja, prywatność, zmienność, kontrola","decentralizacja, transparentność, niezmienność, konsensus","szybkość, anonimowość, darmowość, prostota","regulacja, nadzór, gwarancje, ubezpieczenie"],c:1,e:"Decentralizacja, transparentność, niezmienność, mechanizm konsensusu."},
      {q:"W którym roku opublikowano białą księgę Bitcoina?",a:["2008","2013","2015","2020"],c:0,e:"2008 (Satoshi Nakamoto); sieć ruszyła 2009."},
      {q:"Problem 'double spending' to:",a:["podwójne opodatkowanie krypto","ryzyko wydania tej samej jednostki cyfrowej dwa razy","podwójne szyfrowanie danych","dwa portfele na jednym urządzeniu"],c:1,e:"Bitcoin rozwiązuje go rozproszonym rejestrem + konsensusem."},
      {q:"Co było bezpośrednim katalizatorem powstania Bitcoina?",a:["pandemia COVID","kryzys finansowy 2008 i spadek zaufania do banków","wojna w Ukrainie","wprowadzenie MiCA"],c:1,e:"Upadek Lehman Brothers, bailouty, moral hazard → biała księga 2008."}
     ]},
    /* ---------------- L2 ---------------- */
    {id:"k2",title:"Konsensus: PoW i PoS",emoji:"⚙️",
     feed:[
      {title:"Po co konsensus?",body:"W sieci rozproszonej wiele kopii danych, brak centralnego administratora. <b>Mechanizm konsensusu</b> = zbiór reguł, dzięki którym węzły uzgadniają <b>wspólny stan</b>: które transakcje są ważne i która wersja łańcucha obowiązuje.",real:"Bez konsensusu = chaos i sprzeczne wersje historii. To 'sędzia' bez sędziego."},
      {title:"Proof of Work (PoW)",body:"Górnicy <b>rywalizują w rozwiązywaniu zadań obliczeniowych</b> (hashowanie). Kosztowne do wykonania, tanie do weryfikacji. Bezpieczeństwo = wysoki koszt fizyczny ataku (energia, sprzęt). Bitcoin.",real:"Kto włożył najwięcej prądu i sprzętu, dostaje prawo dopisać blok. Atak = spalić fortunę.",mnemo:"<b>PoW = Praca/prąd</b> (Work)."},
      {title:"Proof of Stake (PoS)",body:"Zamiast energii — <b>kapitał (stake)</b>. Walidator blokuje krypto; im większy stake, tym większa szansa walidacji. Nieuczciwość = <b>slashing</b> (utrata części stake). Ethereum 2.0.",real:"Wpłacasz kaucję. Oszukasz — tracisz kaucję. Dużo taniej energetycznie niż PoW.",mnemo:"<b>PoS = Stake/kasa</b> (Stake)."},
      {title:"PoW vs PoS — jeden trade-off",body:"PoW: zasób = energia/sprzęt, koszt ataku = fizyczny, finalność probabilistyczna, ryzyko = mining pools. PoS: zasób = kapitał, koszt ataku = kapitał + slashing, finalność szybsza, ryzyko = koncentracja stake.",real:"To nie 'lepsze–gorsze', tylko dwa różne modele bezpieczeństwa: bezpieczeństwo vs energia vs koncentracja kapitału."}
     ],
     flashcards:[
      {t:"Mechanizm konsensusu",d:"Zbiór reguł pozwalający węzłom zdecentralizowanej sieci uzgodnić wspólny stan: które transakcje są ważne i która wersja łańcucha obowiązuje."},
      {t:"Proof of Work (PoW)",d:"Górnicy rywalizują w hashowaniu (kosztowne obliczenia). Bezpieczeństwo = wysoki koszt fizyczny ataku (energia, sprzęt). Bitcoin. Wada: zużycie energii."},
      {t:"Proof of Stake (PoS)",d:"Walidatorzy blokują kapitał (stake); szansa walidacji rośnie ze stake. Slashing karze nieuczciwych. Ethereum. Zaleta: niskie zużycie energii."},
      {t:"Slashing",d:"Mechanizm kary w PoS — odebranie części stake walidatorowi, który oszukuje lub łamie reguły. Atak = ryzyko utraty własnego kapitału."},
      {t:"Inne mechanizmy konsensusu",d:"DPoS (delegowanie głosów reprezentantom), PoA (walidacja przez autoryzowane węzły o zweryfikowanej tożsamości), BFT (odporność na złośliwych uczestników)."},
      {t:"Mining (kopanie)",d:"Konkurowanie o prawo dodania bloku przez hashowanie nagłówka, aż wynik spełni warunek trudności. Nagroda: nowe monety + opłaty transakcyjne. Łączy emisję, zabezpieczenie i konkurencję o przychód."}
     ],
     quiz:[
      {q:"Na czym opiera się bezpieczeństwo w Proof of Work?",a:["na kapitale zablokowanym w sieci","na wysokim koszcie fizycznym (energia, sprzęt) potrzebnym do ataku","na zaufaniu do banku centralnego","na anonimowości górników"],c:1,e:"PoW: atak wymaga ogromnych zasobów obliczeniowych i energii."},
      {q:"Czym jest slashing w Proof of Stake?",a:["nagrodą za wydobycie bloku","karą — utratą części stake przez nieuczciwego walidatora","opłatą transakcyjną","procesem kopania"],c:1,e:"Slashing zniechęca do oszustwa: oszukasz → tracisz kapitał."},
      {q:"Główna różnica zasobu konkurencji PoW vs PoS:",a:["PoW = kapitał, PoS = energia","PoW = energia/sprzęt, PoS = kapitał/stake","oba używają energii","oba używają kapitału"],c:1,e:"PoW konkuruje energią/sprzętem, PoS kapitałem (stake)."},
      {q:"Który mechanizm zużywa znacznie mniej energii?",a:["Proof of Work","Proof of Stake","oba tyle samo","Proof of Work z ASIC"],c:1,e:"PoS nie wymaga energochłonnego hashowania — stąd Ethereum 2.0 przeszło na PoS."}
     ]},
    /* ---------------- L3 ---------------- */
    {id:"k3",title:"Kryptografia i klucze",emoji:"🔐",
     feed:[
      {title:"Hash i SHA-256",body:"Funkcja hashująca zamienia dane dowolnej długości w skrót stałej długości (SHA-256 = 256 bitów = 64 znaki hex). Cechy: <b>deterministyczna</b>, <b>nieodwracalna</b>, <b>efekt lawiny</b> (mała zmiana → zupełnie inny hash), odporna na kolizje. Nie szyfruje!",real:"Cyfrowy odcisk palca danych. Zmień jedną literę → hash zupełnie inny. MD5/SHA-1 = przestarzałe.",mnemo:"Hash ≠ szyfrowanie. Hash sprawdza integralność, nie da się go 'odszyfrować'."},
      {title:"Klucz prywatny vs publiczny",body:"Kryptografia <b>asymetryczna</b>: klucz <b>prywatny</b> podpisuje (tajny!), klucz <b>publiczny</b> weryfikuje. Publiczny wyprowadza się z prywatnego, ale <b>NIE odwrotnie</b> (problem logarytmu dyskretnego, krzywe eliptyczne secp256k1).",real:"Prywatny = Twój podpis i kontrola środków. Ujawnisz = ktoś wyda Twoje krypto.",mnemo:"Prywatny PODPISUJE, publiczny WERYFIKUJE."},
      {title:"Seed phrase (BIP-39)",body:"Czytelna dla człowieka kopia zapasowa kluczy: <b>12–24 słów</b> (BIP-39). Koduje losową entropię (12 słów = 128 bitów + suma kontrolna, 24 = 256 bitów). Z seeda portfel deterministyczny (BIP-32) wyprowadza całą hierarchię kluczy.",real:"Utrata seed = utrata WSZYSTKICH środków. Przejęcie seed = ktoś przejmuje cały portfel, nie jeden adres."},
      {title:"Portfel NIE przechowuje krypto",body:"Środki są w blockchainie, nie 'w portfelu'. Portfel <b>zarządza kluczami i tworzy podpisy</b>. <b>Hot wallet</b> = online (wygodny, ryzyko ataku), <b>cold wallet</b> = offline (bezpieczniejszy, mniej wygodny).",real:"Portfel to pęk kluczy, nie sejf z monetami. 'Portfel kryptowalut' to językowy skrót myślowy."}
     ],
     flashcards:[
      {t:"Funkcja hashująca",d:"Zamienia dane dowolnej długości w skrót stałej długości. Deterministyczna, nieodwracalna, efekt lawiny, odporna na kolizje. NIE szyfruje — służy do kontroli integralności."},
      {t:"SHA-256",d:"Kryptograficzna funkcja skrótu: 256 bitów = 64 znaki hex. Stosowana w Bitcoinie (nagłówki bloków, adresy). MD5/SHA-1 są przestarzałe — używać SHA-2/SHA-3."},
      {t:"Kryptografia asymetryczna",d:"Para kluczy: prywatny (podpisuje, tajny) i publiczny (weryfikuje). Publiczny wyprowadza się z prywatnego, ale nie odwrotnie (krzywe eliptyczne secp256k1)."},
      {t:"Podpis cyfrowy",d:"Potwierdza, że posiadacz klucza prywatnego autoryzował transakcję. Węzły weryfikują kluczem publicznym. Ujawnienie podpisu nie ujawnia klucza prywatnego. ECDSA / Schnorr."},
      {t:"Seed phrase (BIP-39)",d:"Czytelna kopia zapasowa kluczy: 12–24 słów kodujących losową entropię. Z seeda portfel deterministyczny (BIP-32) wyprowadza całą hierarchię kluczy. Utrata = utrata wszystkiego."},
      {t:"Klucz publiczny vs adres",d:"Klucz publiczny = warstwa kryptograficzna (weryfikacja podpisu). Adres = uproszczona, zakodowana reprezentacja do odbioru środków (w Bitcoinie z hasha klucza publicznego: SHA-256 + RIPEMD-160)."},
      {t:"Hot wallet vs cold wallet",d:"Hot = połączony z internetem (wygodny, większe ryzyko phishingu/malware). Cold = offline (bezpieczniejszy, mniej wygodny). W instytucji liczy się zarządzanie kluczami, nie samo 'cold'."}
     ],
     quiz:[
      {q:"Która cecha NIE opisuje funkcji hashującej?",a:["deterministyczna (ten sam input → ten sam hash)","efekt lawiny","odwracalna (można odzyskać dane z hasha)","odporna na kolizje"],c:2,e:"Hash jest NIEodwracalny — to jego kluczowa właściwość."},
      {q:"Klucz prywatny a publiczny:",a:["publiczny podpisuje, prywatny weryfikuje","prywatny podpisuje (tajny), publiczny weryfikuje","oba są jawne","oba muszą być tajne"],c:1,e:"Prywatny podpisuje i musi być chroniony; publiczny weryfikuje."},
      {q:"Co to seed phrase?",a:["hasło do giełdy","12–24 słów = kopia zapasowa kluczy portfela (BIP-39)","adres do odbioru środków","numer transakcji"],c:1,e:"Z seeda odtwarza się cała hierarchia kluczy. Utrata = utrata środków."},
      {q:"Gdzie naprawdę są Twoje kryptowaluty?",a:["w pliku portfela na dysku","w blockchainie — portfel tylko zarządza kluczami i podpisami","na serwerze giełdy zawsze","w chmurze producenta portfela"],c:1,e:"Portfel przechowuje klucze, nie monety. Środki są w rejestrze."},
      {q:"Ile bitów ma skrót SHA-256?",a:["128","256","512","64"],c:1,e:"256 bitów = 32 bajty = 64 znaki szesnastkowe."}
     ]},
    /* ---------------- L4 ---------------- */
    {id:"k4",title:"Bezpieczeństwo i finalność",emoji:"🛡️",
     feed:[
      {title:"Walidacja ≠ wybór łańcucha",body:"Dwa różne problemy: <b>walidacja</b> ('czy ta transakcja jest poprawna?') i <b>konsensus/wybór łańcucha</b> ('która historia jest oficjalna?'). Transakcja poprawna kryptograficznie może zostać cofnięta przez reorganizację.",real:"Poprawny podpis nie wystarczy — sieć musi jeszcze uzgodnić, która wersja historii wygrywa."},
      {title:"Finalność i potwierdzenia",body:"<b>Finalność</b> = transakcji nie da się już usunąć z historii. Bitcoin: <b>probabilistyczna</b> (im więcej bloków nad transakcją, tym pewniej). Ethereum PoS: finalizacja oparta na stake. Dlatego liczba potwierdzeń ma znaczenie.",real:"'Wysłane' ≠ 'rozliczone'. Bank pyta: kiedy ryzyko cofnięcia jest akceptowalnie niskie?"},
      {title:"Forki, reorg, atak 51%",body:"<b>Fork</b> = rozwidlenie (soft = zgodny wstecznie, hard = niezgodny). <b>Reorganizacja</b> = sieć porzuca jedną wersję bloków na rzecz 'silniejszej'. <b>Atak 51%</b> (dominacja mocy): reorg historii, cenzura, double spending — ale w dużych sieciach ekonomicznie nieopłacalny.",real:"Krótkie forki to normalka, nie błąd. Atak 51% jest realny głównie w MAŁYCH sieciach."},
      {title:"UTXO vs model kontowy + custody",body:"<b>UTXO</b> (Bitcoin): saldo = suma niewydanych wyjść, jak zbiór banknotów. <b>Model kontowy</b> (Ethereum): saldo na koncie, intuicyjny dla bankowców. Custody instytucjonalne: <b>multisig</b> (np. 2 z 3) i <b>MPC</b> (podpis z udziałów bez jednego pełnego klucza).",real:"Dla banku liczy się nie 'przechowanie pliku', tylko KONTROLA nad podpisem (kto może wydać środki)."}
     ],
     flashcards:[
      {t:"Walidacja vs konsensus",d:"Walidacja: 'czy transakcja jest poprawna?'. Konsensus/wybór łańcucha: 'która historia transakcji jest oficjalna?'. To dwa odrębne problemy."},
      {t:"Finalność",d:"Stan, w którym transakcji nie da się już usunąć. Bitcoin = probabilistyczna (rośnie z liczbą potwierdzeń). Ethereum PoS = finalizacja oparta na stake. Finalność ≠ potwierdzenie."},
      {t:"Fork",d:"Rozwidlenie łańcucha. Soft fork = zmiana reguł zgodna wstecznie. Hard fork = niezgodna wstecznie, może trwale rozdzielić sieć. Krótkie forki są naturalne."},
      {t:"Reorganizacja (reorg)",d:"Sieć porzuca lokalnie zaakceptowaną wersję bloków na rzecz 'silniejszej'. Świeże transakcje mogą wypaść z historii — dlatego liczba potwierdzeń ma znaczenie."},
      {t:"Atak 51%",d:"Dominacja mocy/stake pozwala: preferować własny łańcuch, reorganizować historię, cenzurować transakcje, double spending. W dużych sieciach ekonomicznie nieopłacalny; groźniejszy w małych."},
      {t:"UTXO vs model kontowy",d:"UTXO (Bitcoin): saldo = suma niewydanych wyjść (jak banknoty). Account model (Ethereum): saldo i stan konta (intuicyjny dla bankowców, smart kontrakty)."},
      {t:"Multisig",d:"Wielopodpis — polityka wymagająca wielu niezależnych podpisów (np. 2 z 3). Rozdziela władzę, zmniejsza ryzyko pojedynczego punktu kompromitacji ('zasada wielu oczu')."},
      {t:"MPC (Multi-Party Computation)",d:"Podpis powstaje wspólnie z udziałów (shares) bez rekonstrukcji jednego pełnego klucza w jednym miejscu. Ogranicza 'single point of compromise' — kluczowa technologia custody instytucjonalnego."}
     ],
     quiz:[
      {q:"Czym różni się walidacja od konsensusu?",a:["to to samo","walidacja = czy transakcja poprawna; konsensus = która historia jest oficjalna","walidacja dotyczy tylko PoS","konsensus dotyczy tylko portfeli"],c:1,e:"Poprawna transakcja może i tak wypaść przy reorganizacji łańcucha."},
      {q:"Finalność w Bitcoinie ma charakter:",a:["natychmiastowy i absolutny","probabilistyczny — rośnie z liczbą potwierdzeń","gwarantowany przez bank centralny","deterministyczny od pierwszego bloku"],c:1,e:"Im więcej bloków nad transakcją, tym mniejsze ryzyko cofnięcia."},
      {q:"Atak 51% jest najbardziej realny w:",a:["dużych sieciach jak Bitcoin","małych sieciach o niskim hashrate/stake","sieciach PoA","stablecoinach"],c:1,e:"W dużych sieciach koszt ataku rośnie radykalnie; groźny głównie w małych."},
      {q:"Model UTXO (Bitcoin) działa jak:",a:["jedno konto z saldem","zbiór niewydanych wyjść (jak banknoty)","baza danych banku","smart kontrakt"],c:1,e:"UTXO = konsumujesz konkretne wyjścia i tworzysz nowe; Ethereum = model kontowy."},
      {q:"Czym jest MPC w kontekście custody?",a:["rodzajem stablecoina","podpisem tworzonym wspólnie z udziałów, bez jednego pełnego klucza","giełdą zdecentralizowaną","mechanizmem konsensusu"],c:1,e:"MPC ogranicza ryzyko pojedynczego punktu kompromitacji klucza."}
     ]},
    /* ---------------- L5 ---------------- */
    {id:"k5",title:"Kryptoaktywa: coin, token, NFT",emoji:"🪙",
     feed:[
      {title:"Kryptowaluta vs kryptoaktywo",body:"<b>Kryptowaluta</b> = natywny token blockchaina, transfer wartości (BTC, ETH). <b>Kryptoaktywo</b> = szersza kategoria: kryptowaluty + tokeny użytkowe + inwestycyjne + NFT + aktywa tokenizowane.",real:"'Kryptowaluta' to potoczny skrót. Precyzja klasyfikacji = mniej problemów regulacyjnych."},
      {title:"Moneta (coin) vs token",body:"<b>Coin</b> = działa na <b>własnym</b> blockchainie, 'paliwo' sieci (BTC, ETH, SOL). <b>Token</b> = na <b>cudzym</b> blockchainie / w smart kontrakcie (USDT, UNI, LINK). Funkcjonalnie: payment / utility / asset (investment) tokens.",real:"Coin ma własną sieć. Token żyje na cudzej (np. USDT na Ethereum).",mnemo:"<b>Coin = własna sieć, Token = gość na cudzej sieci.</b>"},
      {title:"NFT — czym NIE jest",body:"<b>Non-Fungible Token</b> = unikalny, niezamienny token. <b>NFT ≠ dzieło sztuki</b> — to zapis własności/identyfikator. Zwykle <b>nie daje praw autorskich</b>. Wartość spekulacyjna, zależna od infrastruktury (serwery, metadane).",real:"Kupujesz wpis 'to jest moje', a nie sam obrazek ani prawa do niego."},
      {title:"MiCA — klasyfikacja regulacyjna",body:"Rozporządzenie UE. Trzy kategorie: <b>crypto-assets</b> (ogólna), <b>ART</b> (Asset-Referenced Tokens — odnoszą się do koszyka aktywów/walut), <b>EMT</b> (E-Money Tokens — jedna waluta urzędowa, jak e-pieniądz).",real:"Ekonomicznie token może być 'utility', a regulacyjnie 'security' — przepisy nie nadążają za techem.",mnemo:"<b>ART = koszyk, EMT = jedna waluta (e-money).</b>"}
     ],
     flashcards:[
      {t:"Kryptowaluta vs kryptoaktywo",d:"Kryptowaluta = natywny token blockchaina (transfer wartości, BTC/ETH). Kryptoaktywo = szersza kategoria: + tokeny użytkowe, inwestycyjne, NFT, aktywa tokenizowane."},
      {t:"Coin vs token",d:"Coin działa na własnym blockchainie (BTC, ETH, SOL). Token działa na cudzym blockchainie / w smart kontrakcie (USDT, UNI, LINK)."},
      {t:"Payment / utility / asset tokens",d:"Payment = transfer wartości (kryptowaluty). Utility = dostęp do usługi/platformy. Asset/investment = prawa ekonomiczne (często regulacja rynku kapitałowego). To klasyfikacja ekonomiczna, nie zawsze = regulacyjna."},
      {t:"NFT (Non-Fungible Token)",d:"Unikalny, niezamienny token — zapis własności lub identyfikator. NIE jest dziełem sztuki i zwykle nie daje praw autorskich. Wartość spekulacyjna, zależna od infrastruktury."},
      {t:"Tokenizacja",d:"Cyfrowa reprezentacja aktywa na blockchainie. Niekoniecznie oznacza decentralizację ani brak emitenta (np. tokenizowana obligacja ≠ kryptowaluta). To narzędzie, nie samo aktywo."},
      {t:"MiCA: ART vs EMT",d:"ART (Asset-Referenced Token) = odnosi się do koszyka aktywów/walut/towarów. EMT (E-Money Token) = odnosi się do jednej waluty urzędowej, przypomina pieniądz elektroniczny."}
     ],
     quiz:[
      {q:"Czym różni się coin od tokena?",a:["coin jest droższy","coin działa na własnym blockchainie, token na cudzym","token jest zawsze stabilny","nie ma różnicy"],c:1,e:"Coin = własna sieć (BTC, ETH). Token = na cudzej sieci (USDT na Ethereum)."},
      {q:"NFT to przede wszystkim:",a:["dzieło sztuki","unikalny, niezamienny token = zapis własności/identyfikator","kryptowaluta o stałej wartości","rodzaj stablecoina"],c:1,e:"NFT ≠ dzieło i zwykle nie daje praw autorskich."},
      {q:"W MiCA EMT (E-Money Token) odnosi się do:",a:["koszyka różnych aktywów","jednej waluty urzędowej (jak e-pieniądz)","wyłącznie NFT","tokenów użytkowych"],c:1,e:"EMT = jedna waluta urzędowa. ART = koszyk aktywów/walut."},
      {q:"Token użytkowy (utility) jest:",a:["zawsze zwolniony z regulacji","niekoniecznie zwolniony z regulacji; bywa też faktycznie spekulacyjny","zawsze papierem wartościowym","tym samym co coin"],c:1,e:"Decentralizacja ≠ brak odpowiedzialności; utility ≠ brak regulacji."}
     ]},
    /* ---------------- L6 ---------------- */
    {id:"k6",title:"Rynek kryptoaktywów",emoji:"📈",
     feed:[
      {title:"Skala i koncentracja rynku",body:"Kapitalizacja rzędu <b>~2,7 bln USD</b>, mocno cykliczna. <b>BTC + ETH = 60–70%</b> rynku (efekty sieciowe, infrastruktura). Reszta to 'długi ogon' altcoinów — niższa płynność, wyższe ryzyko.",real:"Kilku gigantów rządzi. Tysiące altcoinów to ryzykowny ogon."},
      {title:"Warstwy i segmenty",body:"<b>Layer 1</b> = podstawowe blockchainy (Bitcoin, Ethereum, Solana). <b>Layer 2</b> = skalowanie (tańsze/szybsze transakcje poza głównym łańcuchem). Dalej: <b>stablecoiny</b>, <b>DeFi</b>, infrastruktura (giełdy, custody, brokerzy).",real:"Layer 1 = autostrada. Layer 2 = obwodnice, żeby odkorkować i potaniać."},
      {title:"CEX vs DEX",body:"<b>CEX</b> (scentralizowana giełda) = pośrednik, depozyt po stronie platformy, wygodna, ale centralny punkt awarii. <b>DEX</b> (zdecentralizowana) = bez pośrednika, self-custody, większa złożoność.",real:"CEX = bank krypto (wygodnie, ale ufasz im). DEX = sam trzymasz klucze (więcej wolności, więcej ryzyka)."},
      {title:"DeFi i custody",body:"<b>DeFi</b> = usługi finansowe bez centralnego pośrednika (lending, trading, staking). Ryzyka: luki w smart kontraktach, płynność, brak nadzoru. <b>Custody</b> (bezpieczne przechowywanie kluczy) = strategiczny punkt wejścia banków.",real:"Dla banku najważniejszy nie sam token, tylko infrastruktura i usługi (custody, rozliczenia)."}
     ],
     flashcards:[
      {t:"Koncentracja rynku krypto",d:"Kapitalizacja ~2,7 bln USD, silnie cykliczna. BTC + ETH stanowią 60–70% rynku. Reszta = 'długi ogon' altcoinów o niższej płynności i wyższym ryzyku."},
      {t:"Layer 1 vs Layer 2",d:"Layer 1 = podstawowy blockchain (Bitcoin, Ethereum, Solana). Layer 2 = rozwiązania skalujące (transakcje poza głównym łańcuchem → tańsze i szybsze)."},
      {t:"CEX vs DEX",d:"CEX = giełda scentralizowana (pośrednik, depozyt po stronie platformy, wygoda, centralny punkt awarii). DEX = zdecentralizowana (bez pośrednika, self-custody, większa złożoność)."},
      {t:"DeFi",d:"Zdecentralizowane finanse — usługi (pożyczki, handel, staking) bez centralnego pośrednika. Ryzyka: luki w smart kontraktach, zmienność płynności, brak nadzoru regulacyjnego."},
      {t:"Custody (krypto)",d:"Bezpieczne przechowywanie kluczy prywatnych i zarządzanie dostępem do aktywów. Strategiczny punkt wejścia banków na rynek krypto — wymaga najwyższych standardów bezpieczeństwa."},
      {t:"Gdzie powstaje wartość na rynku",d:"Infrastruktura (technologia, bezpieczeństwo), płynność (animatorzy rynku, pule), dostęp (portfele, rampy fiat-krypto, edukacja). Często ważniejsze strategicznie niż same aktywa bazowe."}
     ],
     quiz:[
      {q:"Jaki udział w rynku mają łącznie BTC i ETH?",a:["10–20%","30–40%","60–70%","ponad 95%"],c:2,e:"Dwaj liderzy to 60–70% kapitalizacji — silna koncentracja."},
      {q:"Layer 2 służy przede wszystkim do:",a:["tworzenia nowych monet","skalowania — tańszych i szybszych transakcji poza głównym łańcuchem","przechowywania kluczy","regulacji rynku"],c:1,e:"L2 odciąża Layer 1: większa przepustowość, niższe opłaty."},
      {q:"Główna różnica CEX vs DEX:",a:["CEX jest darmowa","CEX = pośrednik i depozyt po stronie platformy; DEX = self-custody bez pośrednika","DEX jest zawsze bezpieczniejsza","nie ma różnicy"],c:1,e:"CEX wygodna ale centralny punkt awarii; DEX = sam trzymasz klucze."},
      {q:"Który obszar jest strategicznym punktem wejścia banków?",a:["kopanie Bitcoina","custody (przechowywanie kluczy/aktywów)","tworzenie memecoinów","spekulacja na NFT"],c:1,e:"Banki zaczynają zwykle od custody, potem trading."}
     ]},
    /* ---------------- L7 ---------------- */
    {id:"k7",title:"Stablecoiny",emoji:"💵",
     feed:[
      {title:"Czym jest stablecoin",body:"Kryptoaktywo zaprojektowane do <b>stabilnej wartości</b> wobec aktywa referencyjnego (np. USD). Stabilność NIE jest cechą blockchaina — wynika z <b>rezerw, mechanizmu wykupu, płynności, zaufania do emitenta i konstrukcji prawnej</b>. Stablecoin ≠ depozyt bankowy.",real:"To 'cyfrowy dolar' prywatnej firmy. Stabilny dopóki ufasz, że odkupią go za 1 USD."},
      {title:"Trzy modele stablecoinów",body:"<b>Fiat-backed</b>: rezerwy w walucie/aktywach płynnych (USDT, USDC) — ryzyko jakości rezerw i wykupu. <b>Crypto-backed</b>: nadzabezpieczenie krypto (DAI) — ryzyko zmienności, likwidacji. <b>Algorithmic</b>: algorytm podaży (TerraUSD) — ryzyko spirali utraty zaufania.",real:"Fiat = realne rezerwy. Crypto = nadmiar zastawu. Algo = obietnica matematyki (najbardziej kruche).",mnemo:"<b>FIAT · CRYPTO · ALGO</b> — od najbezpieczniejszego do najbardziej ryzykownego."},
      {title:"TerraUSD/Luna i 'run'",body:"<b>TerraUSD</b> (algorytmiczny) utracił peg w maju 2022 → spirala sprzedaży i upadek. Mechanizm <b>'runu'</b> jak run bankowy: pogłoska → masowy wykup → wyprzedaż rezerw → utrata pegu → panika. Ale bez publicznych zabezpieczeń (gwarancji depozytów).",real:"'Stable' w nazwie nie gwarantuje stabilności. Algo-stablecoiny potrafią wyparować w dni."},
      {title:"Stablecoiny vs banki + MiCA",body:"Stablecoiny przejmują funkcje banków (płatności, transfery), ale <b>bez gwarancji depozytów, dostępu do banku centralnego, kreacji pieniądza</b>. MiCA dzieli je na <b>ART i EMT</b> (od 30.06.2024 / pełna stosowalność 30.12.2024). Alternatywa banków: <b>tokenizowane depozyty</b>.",real:"~99% stablecoinów w USD = wyzwanie dla suwerenności euro. Banki kontrują tokenizowanymi depozytami."}
     ],
     flashcards:[
      {t:"Stablecoin",d:"Kryptoaktywo o stabilnej wartości wobec aktywa referencyjnego (np. USD). Stabilność wynika z rezerw, wykupu, płynności, zaufania i konstrukcji prawnej — nie z technologii. ≠ depozyt bankowy."},
      {t:"Fiat-backed stablecoin",d:"Zabezpieczony rezerwami w walucie fiat/aktywach płynnych (USDT, USDC). Główne ryzyko: jakość i płynność rezerw, realność wykupu, wiarygodność emitenta."},
      {t:"Crypto-backed stablecoin",d:"Oparty na nadzabezpieczeniu kryptoaktywami (DAI), bo są zmienne. Ryzyko: gwałtowny spadek zabezpieczenia, kaskadowe likwidacje, błędy smart kontraktów."},
      {t:"Algorithmic stablecoin",d:"Stabilizacja przez algorytm podaży/arbitraż (TerraUSD). Brak pełnych rezerw — peg zależy od ciągłego zaufania. Najbardziej podatny na nagłe załamania."},
      {t:"TerraUSD / Luna (2022)",d:"Algorytmiczny stablecoin, który utracił peg w maju 2022 → spirala sprzedaży i upadek. Ilustracja kruchości stabilności algorytmicznej i ryzyka nazwy 'stable' bez pokrycia."},
      {t:"Run na stablecoin",d:"Jak run bankowy: pogłoska → masowy wykup → wyprzedaż rezerw → utrata pegu → panika. Ale bez publicznych zabezpieczeń (gwarancji depozytów, dostępu do banku centralnego)."},
      {t:"Stablecoin vs tokenizowany depozyt",d:"Stablecoin = emitowany przez podmiot prywatny, poza systemem depozytowym. Tokenizowany depozyt = cyfrowa reprezentacja depozytu, zobowiązanie banku wobec klienta, w ramach systemu bankowego i regulacji."}
     ],
     quiz:[
      {q:"Z czego wynika stabilność stablecoina?",a:["z samej technologii blockchain","z rezerw, mechanizmu wykupu, płynności, zaufania i konstrukcji prawnej","z mocy obliczeniowej sieci","z liczby użytkowników"],c:1,e:"Stabilność to mechanizmy finansowo-prawne, nie cecha blockchaina."},
      {q:"Który model stablecoina jest najbardziej podatny na nagłe załamanie?",a:["fiat-backed (USDC)","crypto-backed (DAI)","algorytmiczny (TerraUSD)","tokenizowany depozyt"],c:2,e:"Algo opiera się na zaufaniu i arbitrażu bez pełnych rezerw — patrz TerraUSD 2022."},
      {q:"Czego stablecoiny NIE oferują w przeciwieństwie do banków?",a:["płatności","transferów transgranicznych","gwarancji depozytów i dostępu do banku centralnego","przechowywania wartości"],c:2,e:"Brak ochrony depozytów, dostępu do banku centralnego i kreacji pieniądza."},
      {q:"MiCA dzieli stablecoiny na:",a:["BTC i ETH","ART i EMT","CEX i DEX","PoW i PoS"],c:1,e:"ART (koszyk aktywów) i EMT (jedna waluta urzędowa, e-money)."},
      {q:"Mechanizm 'runu' na stablecoin przypomina:",a:["atak 51%","run bankowy — masowy wykup i wyprzedaż rezerw","mining","slashing"],c:1,e:"Pogłoska → masowy wykup → wyprzedaż rezerw → utrata pegu → panika."}
     ]}
  ]
});
