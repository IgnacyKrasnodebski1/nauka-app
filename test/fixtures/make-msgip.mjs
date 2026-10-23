#!/usr/bin/env node
/* ============================================================ CRAMFOX — fixture'y przedmiotu MSGiP (docs/design-centrum.md §3)
   Generuje tematy w formacie backendu (TopicContent) z polem keyPoints (docs/plan-media.md §1.1):
     topic-msgip.json    materiał 01 „Wykład 1–2: pojęcia i podmioty MSGiP” — 4 poziomy, 46 fiszek, 36 pytań, 14 zadań, 13 kluczowych punktów
     topic-msgip-2.json  materiał 02 „Wykład 3: teorie integracji” — 4 poziomy, 36 fiszek, 24 pytania, 4 zadania, 8 punktów
     topic-msgip-3.json  materiał 03 „Prezentacja: polityka handlowa UE” — 3 poziomy, 30 fiszek, 18 pytań, 3 zadania, 6 punktów
     topic-kp-edge.json  przypadki brzegowe keyPoints (XSS, emoji, złe i zdublowane odwołania, punkt z 2 elementami, niepokryte pytania)
     topic-kp-few.json   keyPoints, z których zostają < 3 poprawne punkty → cały temat na punktach zastępczych (jeden na poziom)
   Treść 01 jest pisana ręcznie (pytania z makiet: rolka 2, pauza podcastu, egzamin ustny), 02 i 03 — z tabel pojęć (pytania z szablonu).
   Niezmienniki 1.1 sprawdza ten skrypt (każde pytanie i fiszka w dokładnie jednym punkcie, zadanie w najwyżej jednym, ≥ 3 elementy, ≥ 2 z SRS).
   Użycie (z katalogu repo albo test/): node test/fixtures/make-msgip.mjs   (nadpisuje pliki; wynik deterministyczny) */
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';

const HERE=path.dirname(fileURLToPath(import.meta.url));
const GRADING={pass:50,examMin:20,scale:[[90,'5'],[80,'4,5'],[70,'4'],[60,'3,5'],[50,'3']],failLabel:'2'};
const INFO='<div class="zbox"><h3>Zasady zaliczenia</h3><p>Egzamin pisemny, zaliczenie od <b>50%</b>. Skala ocen: 2, 3, 3,5, 4, 4,5, 5.</p></div>';

/* ---------- materiał 01 (ręcznie) ---------- */
// f: [tytuł, treść HTML] · c: [pojęcie, definicja, punkt] · q: [pytanie, odpowiedzi, poprawna, wyjaśnienie, punkt, strona] · t: [zadanie, punkt]
const M1={name:'Wykład 1–2: pojęcia i podmioty MSGiP',short:'Wykład 1–2',levels:[
 {id:'l1',title:'Czym są MSGiP: MSG a MSP',
  f:[['Dwa skróty, jeden przedmiot','<b>MSG</b> to międzynarodowe stosunki gospodarcze: wymiana towarów, usług, kapitału, technologii i pracy ponad granicami. <b>MSP</b> to międzynarodowe stosunki polityczne: władza, bezpieczeństwo i dyplomacja.'],
     ['MSG a MSP: gdzie granica','Gospodarka i polityka się przenikają. <b>Sankcje</b> to polityka, która działa przez gospodarkę, a umowa handlowa bywa decyzją polityczną.'],
     ['Kto gra na scenie międzynarodowej','Uczestnicy to <b>państwa</b>, <b>organizacje międzyrządowe</b>, <b>korporacje transnarodowe</b>, <b>organizacje pozarządowe</b>, a czasem pojedyncze osoby.'],
     ['MSGiP wśród nauk społecznych','MSGiP łączą <b>ekonomię</b>, <b>nauki o polityce</b>, <b>prawo międzynarodowe</b>, historię i socjologię. Jedno zjawisko oglądamy z kilku stron.'],
     ['Trzy poziomy analizy','Na stosunki międzynarodowe patrzymy z poziomu <b>jednostki</b>, <b>państwa</b> albo całego <b>systemu międzynarodowego</b>.']],
  c:[['MSG','Międzynarodowe stosunki gospodarcze: wymiana towarów, usług, kapitału, technologii i pracy ponad granicami państw.',1],
     ['MSP','Międzynarodowe stosunki polityczne: relacje władzy, bezpieczeństwa i dyplomacji między uczestnikami życia międzynarodowego.',1],
     ['Sankcje gospodarcze','Narzędzie polityki zagranicznej działające przez gospodarkę: ograniczenie handlu lub finansów, żeby wymusić zmianę polityki.',1],
     ['Geoekonomia','Używanie narzędzi gospodarczych do osiągania celów politycznych państwa.',1],
     ['Współzależność','Stan, w którym decyzja jednego państwa odbija się na gospodarkach i polityce innych.',1],
     ['Interdyscyplinarność MSGiP','MSGiP łączą ekonomię, nauki o polityce, prawo międzynarodowe, historię i socjologię.',2],
     ['Ekonomia polityczna międzynarodowa','Nurt badający, jak polityka wpływa na gospodarkę światową i odwrotnie.',2],
     ['Poziomy analizy','Jednostka, państwo i system międzynarodowy: trzy perspektywy patrzenia na stosunki międzynarodowe.',2],
     ['System międzynarodowy','Całość uczestników stosunków międzynarodowych i powiązań między nimi.',2],
     ['Prawo międzynarodowe publiczne','Normy regulujące stosunki między państwami i organizacjami międzynarodowymi.',2]],
  q:[['Czym zajmują się międzynarodowe stosunki gospodarcze (MSG)?',['Wymianą towarów, usług, kapitału i technologii między państwami','Wyłącznie wojną i pokojem','Tylko polityką pieniężną jednego państwa','Organizacją wyborów w państwach'],0,'MSG to wymiana gospodarcza ponad granicami: towary, usługi, kapitał, technologie i praca.',1,2],
     ['Czym różnią się MSG od MSP?',['MSG dotyczą wymiany gospodarczej, MSP relacji władzy i bezpieczeństwa','To dwie nazwy tego samego','MSG dotyczą tylko Europy, MSP reszty świata','MSP badają wyłącznie handel'],0,'MSG to gospodarka ponad granicami, MSP to władza, bezpieczeństwo i dyplomacja. Przenikają się, ale patrzą na co innego.',1,2],
     ['Sankcje gospodarcze to przykład…',['użycia gospodarki jako narzędzia polityki','pomocy rozwojowej','wolnego handlu','integracji regionalnej'],0,'Sankcje to cel polityczny osiągany środkami gospodarczymi.',1,3],
     ['Co oznacza współzależność w stosunkach międzynarodowych?',['Decyzje jednego państwa odbijają się na innych','Każde państwo jest samowystarczalne','Państwa nie handlują ze sobą','Tylko mocarstwa wpływają na gospodarkę'],0,'Współzależność: gospodarki i polityki państw są tak splecione, że decyzja jednego kraju dotyka innych.',1,4],
     ['Które dziedziny łączą MSGiP?',['Ekonomię, nauki o polityce, prawo i historię','Tylko matematykę','Wyłącznie geografię fizyczną','Tylko ekonomię'],0,'MSGiP są interdyscyplinarne: ekonomia, nauki o polityce, prawo międzynarodowe, historia i socjologia.',2,5],
     ['Ekonomia polityczna międzynarodowa bada…',['wzajemny wpływ polityki i gospodarki światowej','wyłącznie kursy walut','historię starożytną','prawo cywilne'],0,'To nurt na styku ekonomii i polityki: jak władza kształtuje gospodarkę świata i odwrotnie.',2,5],
     ['Ile poziomów analizy wyróżnia się w stosunkach międzynarodowych?',['Trzy: jednostka, państwo, system','Dwa: rząd i opozycja','Pięć, po jednym na kontynent','Jeden: państwo'],0,'Jednostka, państwo i system międzynarodowy.',2,6],
     ['System międzynarodowy to…',['całość uczestników i powiązań między nimi','rząd światowy','to samo co ONZ','suma budżetów państw'],0,'System międzynarodowy to wszyscy uczestnicy i relacje między nimi, nie żadna jedna instytucja.',2,6]],
  t:[[{type:'sort',title:'MSG czy MSP?',buckets:[{name:'MSG',items:['umowa handlowa','inwestycja zagraniczna']},{name:'MSP',items:['sojusz wojskowy','wizyta dyplomatyczna']}],e:'Handel i inwestycje to gospodarka (MSG), sojusze i dyplomacja to polityka (MSP).'},1],
     [{type:'tf',statements:[{s:'MSGiP korzystają z ekonomii, nauk o polityce i prawa międzynarodowego.',v:true,e:'To nauka interdyscyplinarna.'},{s:'Poziomy analizy to jednostka, państwo i system międzynarodowy.',v:true,e:'Trzy perspektywy.'},{s:'System międzynarodowy to inna nazwa ONZ.',v:false,e:'System to wszyscy uczestnicy i powiązania, nie jedna organizacja.'}],e:'MSGiP łączą kilka nauk i trzy poziomy patrzenia.'},2],
     [{type:'match',title:'Nauka i to, co wnosi do MSGiP',pairs:[['Ekonomia','handel, kapitał, waluty'],['Nauki o polityce','władza i bezpieczeństwo'],['Prawo międzynarodowe','normy między państwami'],['Historia','skąd wziął się dzisiejszy porządek']],e:'Każda nauka oświetla inną stronę tego samego zjawiska.'},2]]},
 {id:'l2',title:'Globalizacja, handel i kryzysy',
  f:[['Globalizacja: więcej niż handel','<b>Globalizacja</b> to narastanie powiązań gospodarczych, politycznych i kulturowych między państwami i społeczeństwami. Handel to tylko jedna z jej warstw.'],
     ['Co napędza globalizację','Tańszy transport, <b>rewolucja informacyjna</b> i <b>liberalizacja handlu</b> obniżyły koszty kontaktu i wymiany.'],
     ['Handel międzynarodowy','Kraje specjalizują się według <b>przewagi komparatywnej</b> (Ricardo). <b>Bilans handlowy</b> to eksport minus import towarów.'],
     ['Inwestycje zagraniczne','<b>BIZ</b> daje trwałą kontrolę nad firmą za granicą. <b>Inwestycje portfelowe</b> to zakup akcji i obligacji bez kontroli.'],
     ['Kryzysy w gospodarce światowej','<b>Kryzys bilansu płatniczego</b>: kraj nie ma czym zapłacić za import ani za długi. Kryzys potrafi się rozlać na inne kraje (<b>efekt zarażania</b>).'],
     ['Kto gasi pożar','W kryzysie płatniczym państwo idzie po pożyczkę do <b>MFW</b>. W zamian MFW oczekuje reform (<b>warunkowość</b>).']],
  c:[['Globalizacja','Narastanie powiązań gospodarczych, politycznych i kulturowych między państwami i społeczeństwami.',3],
     ['Liberalizacja handlu','Znoszenie ceł i barier, które utrudniają wymianę między państwami.',3],
     ['Rewolucja informacyjna','Rozwój technologii komunikacyjnych, który obniżył koszty kontaktu i przyspieszył globalizację.',3],
     ['Antyglobalizm','Ruch krytykujący skutki globalizacji: nierówności, utratę miejsc pracy, wpływ korporacji.',3],
     ['Przewaga komparatywna','Kraj opłaca się specjalizować w tym, co wytwarza relatywnie taniej niż inni (Ricardo).',4],
     ['Bilans handlowy','Różnica między wartością eksportu a importu towarów.',4],
     ['BIZ','Bezpośrednie inwestycje zagraniczne: zakup lub budowa firmy za granicą z trwałą kontrolą nad nią.',4],
     ['Inwestycje portfelowe','Zakup zagranicznych akcji lub obligacji bez przejmowania kontroli nad firmą.',4],
     ['Kryzys bilansu płatniczego','Sytuacja, gdy kraj nie ma czym zapłacić za import ani obsłużyć długów zagranicznych.',5],
     ['Efekt zarażania','Rozlewanie się kryzysu z jednego kraju na inne przez handel i rynki finansowe.',5],
     ['Pożyczkodawca ostatniej instancji','Instytucja, która pożycza, gdy nikt inny nie chce; na poziomie świata tę rolę pełni MFW.',5],
     ['Warunkowość','Pożyczka w zamian za reformy, np. cięcie deficytu; typowa dla programów MFW.',5]],
  q:[['Globalizacja to przede wszystkim…',['narastanie powiązań między państwami w wielu dziedzinach','tylko handel towarami','zamykanie granic','likwidacja państw'],0,'Globalizacja obejmuje gospodarkę, politykę i kulturę.',3,7],
     ['Co przyspieszyło globalizację pod koniec XX wieku?',['Technologie komunikacyjne i liberalizacja handlu','Wzrost ceł','Zakaz inwestycji zagranicznych','Powrót do handlu wymiennego'],0,'Tańszy kontakt i niższe bariery handlowe.',3,7],
     ['Globalizacja to tylko handel — prawda?',['Nie, obejmuje też politykę, kulturę i finanse','Tak, wyłącznie handel','Tak, tylko handel ropą','Nie, dotyczy tylko kultury'],0,'Handel to jedna warstwa; są też przepływy kapitału, idei i decyzje polityczne.',3,8],
     ['Przewaga komparatywna oznacza, że kraj…',['specjalizuje się w tym, co wytwarza relatywnie taniej','produkuje wszystko sam','nie eksportuje','ma najwięcej surowców'],0,'Ricardo: liczy się koszt względny, nie bezwzględny.',4,8],
     ['Firma z Niemiec buduje fabrykę w Polsce i nią zarządza. To…',['bezpośrednia inwestycja zagraniczna','inwestycja portfelowa','pomoc rozwojowa','cło'],0,'Trwała kontrola nad firmą za granicą to BIZ.',4,9],
     ['Bilans handlowy to różnica między…',['eksportem a importem towarów','długiem a PKB','podatkami a wydatkami','inflacją a bezrobociem'],0,'Eksport minus import towarów.',4,9],
     ['Kraj ma kryzys bilansu płatniczego. Do kogo zwraca się po pożyczkę ratunkową?',['WTO','MFW','ONZ'],1,'Pożyczki w kryzysie płatniczym to rola MFW. WTO pilnuje zasad handlu, ONZ — pokoju.',5,10],
     ['Efekt zarażania w kryzysie to…',['rozlewanie się kryzysu na inne kraje','szczepienia w czasie kryzysu','wzrost eksportu','spadek inflacji'],0,'Kryzys przechodzi przez handel i rynki finansowe na kolejne kraje.',5,10],
     ['Czego MFW zwykle oczekuje w zamian za pożyczkę?',['Reform, np. ograniczenia deficytu','Oddania terytorium','Niczego','Wystąpienia z ONZ'],0,'To warunkowość: pieniądze w zamian za program reform.',5,10]],
  t:[[{type:'tf',statements:[{s:'Globalizacja obejmuje też kulturę i politykę.',v:true,e:'Nie tylko handel.'},{s:'Liberalizacja handlu to podnoszenie ceł.',v:false,e:'To znoszenie ceł i barier.'},{s:'Rewolucja informacyjna przyspieszyła globalizację.',v:true,e:'Kontakt stał się tani i szybki.'}],e:'Globalizacja ma wiele warstw i kilka sił napędowych.'},3],
     [{type:'match',title:'Pojęcie i jego sens',pairs:[['Przewaga komparatywna','specjalizacja w tym, co relatywnie tańsze'],['Bilans handlowy','eksport minus import'],['BIZ','trwała kontrola nad firmą za granicą'],['Inwestycja portfelowa','akcje i obligacje bez kontroli']],e:'Handel i kapitał to dwie drogi powiązań między gospodarkami.'},4],
     [{type:'chain',title:'Jak przebiega kryzys płatniczy?',steps:['Kraj traci dopływ waluty z eksportu','Brakuje pieniędzy na import i spłatę długów','Rynki odmawiają nowych pożyczek','Państwo prosi MFW o pożyczkę','MFW pożycza w zamian za reformy'],given:[0,4],bank:['WTO nakłada sankcje','Bank Światowy buduje drogi'],e:'MFW wchodzi, gdy rynki już nie pożyczają, i stawia warunki.'},5],
     [{type:'fill',text:'Kraj specjalizuje się według przewagi {0}, a różnica eksportu i importu to bilans {1}.',blanks:['komparatywnej','handlowy'],bank:['absolutnej','płatniczy','fiskalnej','budżetowy'],e:'Przewaga komparatywna (Ricardo) i bilans handlowy.'},4]]},
 {id:'l3',title:'Państwa i organizacje międzynarodowe',
  f:[['Państwo: nadal główny gracz','Państwo to <b>terytorium</b>, <b>ludność</b> i <b>suwerenna władza</b>. Mimo globalizacji to państwa zawierają umowy i tworzą organizacje.'],
     ['MFW i Bank Światowy: kto co robi','Oba powstały w <b>Bretton Woods</b> w 1944 r. <b>MFW</b> pilnuje stabilności finansowej i pożycza w kryzysie płatniczym. <b>Bank Światowy</b> finansuje rozwój: drogi, szkoły, szpitale.'],
     ['ONZ','<b>ONZ</b> powstała w 1945 r., żeby utrzymać pokój. <b>Rada Bezpieczeństwa</b> (5 stałych członków z wetem) może nakładać sankcje. W <b>Zgromadzeniu Ogólnym</b> każde państwo ma jeden głos.'],
     ['WTO','<b>WTO</b> działa od 1995 r. (wcześniej <b>GATT</b>). Ustala zasady handlu i rozstrzyga spory. Ważna zasada: <b>klauzula największego uprzywilejowania</b>.'],
     ['Organizacje międzyrządowe','Członkami organizacji międzyrządowych są państwa. To one przekazują organizacji zadania i pieniądze.'],
     ['Jak organizacje zmieniają państwa','Organizacje ustalają reguły, które państwa przyjmują: zasady handlu WTO, warunki pożyczek MFW, rezolucje ONZ.']],
  c:[['Państwo','Terytorium, ludność i suwerenna władza: trzy elementy państwa w prawie międzynarodowym.',6],
     ['Suwerenność','Niezależność władzy państwa od innych państw i najwyższa władza na jego terytorium.',6],
     ['Państwo narodowe','Państwo, którego granice pokrywają się mniej więcej z zasięgiem jednego narodu.',6],
     ['ONZ','Organizacja Narodów Zjednoczonych, założona w 1945 r.; jej głównym celem jest utrzymanie pokoju i bezpieczeństwa.',7],
     ['Rada Bezpieczeństwa ONZ','Organ ONZ z 5 stałymi członkami z prawem weta; decyduje o sankcjach i misjach pokojowych.',7],
     ['Zgromadzenie Ogólne ONZ','Organ, w którym każde państwo członkowskie ma jeden głos.',7],
     ['WTO','Światowa Organizacja Handlu (od 1995 r.): ustala zasady handlu i rozstrzyga spory handlowe.',8],
     ['Klauzula największego uprzywilejowania','Zasada WTO: korzyść handlową daną jednemu członkowi trzeba dać wszystkim.',8],
     ['GATT','Układ ogólny w sprawie taryf celnych i handlu z 1947 r., poprzednik WTO.',8],
     ['MFW','Międzynarodowy Fundusz Walutowy: pilnuje stabilności finansowej i pożycza państwom w kryzysie płatniczym.',9],
     ['Bretton Woods','Konferencja z 1944 r., na której powstały MFW i Bank Światowy.',9],
     ['Kwota w MFW','Wpłata państwa członkowskiego; od niej zależą głosy i dostęp do pożyczek. Z kwot MFW ma pieniądze.',9],
     ['Bank Światowy','Finansuje rozwój: drogi, szkoły i szpitale w krajach rozwijających się.',10],
     ['Pomoc rozwojowa','Długoterminowe wsparcie krajów biedniejszych, np. pożyczki Banku Światowego na infrastrukturę.',10]],
  q:[['Jakie trzy elementy tworzą państwo w prawie międzynarodowym?',['Terytorium, ludność, suwerenna władza','Armia, flaga, hymn','Waluta, bank, giełda','Konstytucja, sąd, parlament'],0,'Klasyczna definicja: terytorium, ludność i suwerenna władza.',6,11],
     ['Suwerenność oznacza, że…',['władza państwa nie podlega innym państwom','państwo nie ma granic','państwo należy do ONZ','państwo nie ma długów'],0,'Suwerenność: niezależność na zewnątrz i najwyższa władza wewnątrz.',6,11],
     ['Kiedy powstała ONZ?',['W 1945 r.','W 1919 r.','W 1989 r.','W 1995 r.'],0,'ONZ powstała po II wojnie światowej, w 1945 r.',7,12],
     ['Który organ ONZ może nałożyć wiążące sankcje?',['Rada Bezpieczeństwa','Zgromadzenie Ogólne','Sekretariat','UNESCO'],0,'Wiążące decyzje o sankcjach podejmuje Rada Bezpieczeństwa.',7,12],
     ['Czym zajmuje się WTO?',['Zasadami handlu i sporami handlowymi','Pożyczkami w kryzysie','Misjami pokojowymi','Ochroną zabytków'],0,'WTO to reguły handlu i rozstrzyganie sporów.',8,13],
     ['Klauzula największego uprzywilejowania mówi, że…',['korzyść dla jednego członka trzeba dać wszystkim','najbogatszy kraj ma pierwszeństwo','cła są zakazane','można dyskryminować partnerów'],0,'To zasada niedyskryminacji w WTO.',8,13],
     ['Kraj ma kryzys płatniczy. Do kogo idzie po pożyczkę?',['Do Banku Światowego','Do MFW','Do WTO','Do ONZ'],1,'MFW ratuje w kryzysie płatniczym. Bank Światowy finansuje rozwój: drogi, szkoły.',9,11],
     ['Skąd MFW ma pieniądze na pożyczki?',['Z kwot wpłacanych przez państwa członkowskie','Z podatku od korporacji','Z zysków WTO','Z ceł'],0,'Państwa wpłacają kwoty; od nich zależą też głosy.',9,11],
     ['Na jakiej konferencji powstały MFW i Bank Światowy?',['Bretton Woods, 1944','Jałta, 1945','Maastricht, 1992','Wersal, 1919'],0,'Bretton Woods, lipiec 1944 r.',9,11],
     ['Kto finansuje budowę dróg i szkół w krajach rozwijających się?',['Bank Światowy','MFW','WTO','Rada Bezpieczeństwa'],0,'Rozwój i infrastruktura to rola Banku Światowego.',10,14],
     ['Pomoc rozwojowa Banku Światowego to…',['długoterminowe wsparcie infrastruktury i usług','krótkie pożyczki w kryzysie walutowym','sankcje handlowe','misje pokojowe'],0,'Bank Światowy działa długoterminowo, MFW — w kryzysie.',10,14]],
  t:[[{type:'match',title:'Organizacja i jej rola',pairs:[['ONZ','pokój i bezpieczeństwo'],['WTO','zasady handlu'],['MFW','pożyczki w kryzysie płatniczym'],['Bank Światowy','finansowanie rozwoju']],e:'Każda organizacja ma swoje zadanie — to częsta pułapka na sprawdzianie.'},10],
     [{type:'sort',title:'MFW czy Bank Światowy?',buckets:[{name:'MFW',items:['pożyczka w kryzysie płatniczym','kwoty członkowskie']},{name:'Bank Światowy',items:['budowa dróg','szkoły i szpitale']}],e:'MFW gasi kryzysy, Bank Światowy finansuje rozwój.'},9],
     [{type:'tf',statements:[{s:'Rada Bezpieczeństwa ma 5 stałych członków z prawem weta.',v:true,e:'USA, Chiny, Rosja, Wielka Brytania, Francja.'},{s:'W Zgromadzeniu Ogólnym głos zależy od liczby ludności.',v:false,e:'Każde państwo ma jeden głos.'},{s:'ONZ powstała w 1945 r.',v:true,e:'Po II wojnie światowej.'}],e:'ONZ: Rada Bezpieczeństwa decyduje, Zgromadzenie Ogólne debatuje.'},7],
     [{type:'fill',text:'Państwo to terytorium, {0} i suwerenna {1}.',blanks:['ludność','władza'],bank:['armia','waluta','flaga','gospodarka'],e:'Trzy elementy państwa.'},6]]},
 {id:'l4',title:'Korporacje, UE i NGO',
  f:[['Korporacje transnarodowe','<b>Korporacja transnarodowa</b> ma siedzibę w jednym kraju, a oddziały i produkcję w wielu innych. Największe mają przychody wyższe niż PKB wielu państw.'],
     ['Korporacja kontra państwo','Korporacje wpływają na politykę przez inwestycje, miejsca pracy i <b>lobbing</b>. Dlatego są podmiotem MSGiP, choć nie mają suwerenności.'],
     ['Unia Europejska jako podmiot','<b>UE</b> to 27 państw, wspólny rynek i instytucje ponad państwami. To przykład <b>integracji ponadnarodowej</b>.'],
     ['NGO','<b>Organizacje pozarządowe</b> działają niezależnie od państw i nie dla zysku. Wpływają na politykę przez <b>rzecznictwo</b>.']],
  c:[['Korporacja transnarodowa','Firma z siedzibą w jednym kraju, a oddziałami i produkcją w wielu innych.',11],
     ['Przychody korporacji a PKB','Największe korporacje mają przychody większe niż PKB wielu państw.',11],
     ['Łańcuch dostaw','Sieć firm i krajów, przez które przechodzi produkt od surowca do klienta.',11],
     ['Lobbing','Wpływanie na decyzje polityczne w interesie firmy lub grupy.',11],
     ['Unia Europejska','Związek 27 państw ze wspólnym rynkiem i instytucjami ponad państwami.',12],
     ['Integracja ponadnarodowa','Przekazanie części kompetencji państw wspólnym instytucjom, jak w UE.',12],
     ['Komisja Europejska','Organ wykonawczy UE: proponuje prawo i pilnuje traktatów.',12],
     ['NGO','Organizacja pozarządowa: działa niezależnie od państw i nie dla zysku, np. Amnesty International.',13],
     ['Rzecznictwo','Działania NGO, które mają zmienić prawo lub politykę.',13],
     ['Organizacja międzyrządowa','Organizacja, której członkami są państwa, np. ONZ czy WTO; przeciwieństwo NGO.',13]],
  q:[['Korporacja transnarodowa to firma, która…',['działa i produkuje w wielu krajach','należy do ONZ','działa tylko w jednym mieście','jest organizacją pozarządową'],0,'Siedziba w jednym kraju, działalność w wielu.',11,18],
     ['Czy korporacja jest podmiotem MSGiP?',['Tak, wpływa na gospodarkę i politykę wielu państw','Nie, tylko państwa są podmiotami','Tylko w Europie','Tylko gdy jest państwowa'],0,'Korporacje nie mają suwerenności, ale realnie kształtują stosunki międzynarodowe.',11,18],
     ['Lobbing to…',['wpływanie na decyzje polityczne w czyimś interesie','rodzaj podatku','pożyczka MFW','głosowanie w ONZ'],0,'Lobbing to jeden ze sposobów wpływu korporacji na państwa.',11,19],
     ['Ile państw liczy Unia Europejska?',['27','12','15','30'],0,'Od wyjścia Wielkiej Brytanii w 2020 r. — 27.',12,20],
     ['Integracja ponadnarodowa polega na…',['przekazaniu części kompetencji wspólnym instytucjom','likwidacji państw','zamknięciu granic','zakazie handlu'],0,'Państwa dzielą się częścią władzy ze wspólnymi instytucjami.',12,20],
     ['Który organ UE proponuje nowe prawo?',['Komisja Europejska','Rada Bezpieczeństwa','MFW','WTO'],0,'Inicjatywa ustawodawcza należy do Komisji Europejskiej.',12,21],
     ['Organizacja pozarządowa (NGO) to…',['organizacja niezależna od państw, działająca nie dla zysku','agenda rządowa','korporacja','organizacja międzyrządowa'],0,'NGO: niezależna, non-profit.',13,22],
     ['Czym NGO różni się od organizacji międzyrządowej?',['Członkami NGO nie są państwa','NGO zawsze jest firmą','NGO ma armię','Nie ma różnicy'],0,'Organizacje międzyrządowe zrzeszają państwa, NGO — ludzi i stowarzyszenia.',13,22]],
  t:[[{type:'sort',title:'Kto jest członkiem?',buckets:[{name:'Państwa',items:['ONZ','WTO']},{name:'Nie państwa',items:['Amnesty International','Lekarze bez Granic']}],e:'Organizacje międzyrządowe zrzeszają państwa, NGO — nie.'},13],
     [{type:'tf',statements:[{s:'Korporacja transnarodowa ma produkcję w wielu krajach.',v:true,e:'Na tym polega jej transnarodowość.'},{s:'Korporacje nie mają żadnego wpływu na politykę.',v:false,e:'Wpływają przez inwestycje i lobbing.'},{s:'Przychody dużej korporacji mogą przewyższać PKB państwa.',v:true,e:'To częsty argument w MSGiP.'}],e:'Korporacje to podmioty niepaństwowe o realnej sile.'},11],
     [{type:'match',title:'Instytucje UE',pairs:[['Komisja Europejska','proponuje prawo'],['Parlament Europejski','wybierany przez obywateli'],['Rada UE','rządy państw członkowskich']],e:'Trzy główne instytucje stanowienia prawa w UE.'},12]]}]};

const POINTS_1={1:['MSG a MSP: czym się różnią','MSG a MSP','Gospodarka i polityka ponad granicami: dwa spojrzenia na te same relacje.'],
  2:['MSGiP na tle nauk społecznych','MSGiP a nauki społeczne','Interdyscyplinarność i poziomy analizy.'],
  3:['Globalizacja: więcej niż handel','Globalizacja','Czym jest globalizacja i co ją napędza.'],
  4:['Handel i inwestycje zagraniczne','Handel i inwestycje','Przewaga komparatywna, bilans handlowy, BIZ.'],
  5:['Zarządzanie kryzysami w gospodarce światowej','Zarządzanie kryzysami','Kryzys płatniczy, efekt zarażania i pożyczki ratunkowe.'],
  6:['Państwo narodowe i suwerenność','Państwo narodowe','Elementy państwa i suwerenność.'],
  7:['ONZ: pokój i bezpieczeństwo','ONZ','Rada Bezpieczeństwa i Zgromadzenie Ogólne.'],
  8:['WTO: zasady handlu światowego','WTO','Reguły handlu, spory i klauzula największego uprzywilejowania.'],
  9:['MFW: rola Międzynarodowego Funduszu Walutowego','MFW','Pożyczki w kryzysie płatniczym, kwoty i warunkowość.'],
  10:['Bank Światowy: finansowanie rozwoju','Bank Światowy','Drogi, szkoły i szpitale w krajach rozwijających się.'],
  11:['Korporacje transnarodowe jako podmioty','Korporacje transnarodowe','Siła ekonomiczna i wpływ na politykę.'],
  12:['Unia Europejska jako podmiot','Unia Europejska','Integracja ponadnarodowa i instytucje UE.'],
  13:['NGO: organizacje pozarządowe','NGO','Organizacje niezależne od państw i rzecznictwo.']};

/* ---------- materiały 02 i 03 (z tabel pojęć) ---------- */
// punkt: [tytuł, krótko, [[pojęcie, definicja], …]] · poziom: [tytuł, [punkty]]
const M2={name:'Wykład 3: teorie integracji',short:'Wykład 3',levels:[
 ['Funkcjonalizm i neofunkcjonalizm',[
  ['Funkcjonalizm: współpraca w konkretnych dziedzinach','Funkcjonalizm',[['Funkcjonalizm','Teoria integracji: współpraca w konkretnych dziedzinach technicznych zbliża państwa i buduje pokój.'],['David Mitrany','Twórca funkcjonalizmu, autor „A Working Peace System” z 1943 r.'],['Forma idzie za funkcją','Hasło funkcjonalizmu: instytucje powstają tam, gdzie jest konkretne zadanie.'],['Organizacja funkcjonalna','Instytucja do jednego zadania, np. poczty czy kolei, działająca ponad granicami.'],['Depolityzacja','Przeniesienie sporów z polityki do technicznej współpracy ekspertów.']]],
  ['Neofunkcjonalizm Ernsta Haasa','Neofunkcjonalizm',[['Neofunkcjonalizm','Teoria Ernsta Haasa: integracja w jednym sektorze pociąga kolejne i wzmacnia instytucje ponadnarodowe.'],['Ernst Haas','Twórca neofunkcjonalizmu, badał Europejską Wspólnotę Węgla i Stali.'],['EWWiS','Europejska Wspólnota Węgla i Stali z 1951 r., pierwszy krok integracji europejskiej.'],['Elity ponadnarodowe','Urzędnicy i grupy interesu, które według Haasa popychają integrację naprzód.']]]]],
 ['Spillover i międzyrządowość',[
  ['Efekt spillover: integracja się rozlewa','Efekt spillover',[['Spillover','Efekt rozlania: integracja jednego sektora wymusza integrację sąsiednich.'],['Spillover funkcjonalny','Wspólny rynek wymaga wspólnych norm, więc integracja przechodzi na kolejne dziedziny.'],['Spillover polityczny','Elity przenoszą lojalność i oczekiwania na wspólne instytucje.'],['Spillback','Cofanie się integracji, gdy państwa odbierają kompetencje wspólnym instytucjom.'],['Kryzys pustego krzesła','Bojkot Francji w 1965 r., przykład zahamowania integracji.']]],
  ['Międzyrządowość: rządy trzymają ster','Międzyrządowość',[['Międzyrządowość','Teoria: integracją sterują rządy państw, a wspólne instytucje są ich narzędziem.'],['Stanley Hoffmann','Krytyk neofunkcjonalizmu, jeden z twórców podejścia międzyrządowego.'],['Liberalna międzyrządowość','Teoria Andrew Moravcsika: preferencje krajowe plus negocjacje rządów.'],['Jednomyślność','Zasada głosowania, w której każde państwo może zablokować decyzję.']]]]],
 ['Etapy integracji i unia celna',[
  ['Etapy integracji gospodarczej','Etapy integracji',[['Strefa wolnego handlu','Brak ceł między członkami, ale każdy ma własne cła wobec reszty świata.'],['Etapy integracji Balassy','Strefa wolnego handlu, unia celna, wspólny rynek, unia gospodarcza, unia polityczna.'],['Bela Balassa','Ekonomista, który opisał kolejne etapy integracji gospodarczej.'],['Unia gospodarcza i walutowa','Etap ze wspólną walutą i koordynacją polityki gospodarczej.'],['Integracja negatywna','Usuwanie barier, np. ceł, bez tworzenia wspólnych polityk.']]],
  ['Unia celna i jej skutki','Unia celna',[['Unia celna','Brak ceł wewnątrz i wspólna taryfa celna wobec państw trzecich.'],['Wspólna taryfa celna','Jednakowe cła wszystkich członków unii celnej na towary spoza niej.'],['Efekt kreacji handlu','Unia celna zastępuje droższą produkcję krajową tańszym importem od partnerów.'],['Efekt przesunięcia handlu','Import przesuwa się od tańszych dostawców spoza unii do droższych partnerów.']]]]],
 ['Wspólny rynek i federalizm',[
  ['Wspólny rynek i cztery swobody','Wspólny rynek',[['Wspólny rynek','Unia celna plus swobodny przepływ pracy i kapitału.'],['Cztery swobody','Swobodny przepływ towarów, usług, osób i kapitału.'],['Jednolity Akt Europejski','Traktat z 1986 r., który przyspieszył budowę rynku wewnętrznego.'],['Rynek wewnętrzny','Obszar bez granic wewnętrznych z czterema swobodami, w UE od 1993 r.'],['Zasada wzajemnego uznawania','Towar legalny w jednym państwie można sprzedawać w innych.']]],
  ['Federalizm: Europa jako państwo związkowe','Federalizm',[['Federalizm','Wizja integracji jako budowy państwa związkowego z rządem ponad państwami.'],['Altiero Spinelli','Autor Manifestu z Ventotene, zwolennik federacji europejskiej.'],['Manifest z Ventotene','Tekst z 1941 r. postulujący zjednoczoną, federalną Europę.'],['Subsydiarność','Decyzje zapadają na najniższym poziomie, który sobie z nimi radzi.']]]]]]};
const M3={name:'Prezentacja: polityka handlowa UE',short:'Prezentacja',levels:[
 ['Wspólna polityka handlowa',[
  ['Wspólna polityka handlowa UE','Polityka handlowa',[['Wspólna polityka handlowa','Polityka UE wobec handlu z państwami trzecimi; wyłączna kompetencja Unii.'],['Kompetencja wyłączna','Dziedzina, w której tylko UE może stanowić prawo.'],['Art. 207 TFUE','Przepis traktatu, który określa zasady wspólnej polityki handlowej.'],['Komisarz ds. handlu','Członek Komisji, który negocjuje umowy handlowe w imieniu UE.'],['Państwo trzecie','Państwo spoza Unii Europejskiej.']]],
  ['Instrumenty ochrony handlu','Ochrona handlu',[['Cło antydumpingowe','Dodatkowe cło na towar sprzedawany poniżej normalnej wartości.'],['Dumping','Sprzedaż za granicą po cenie niższej niż na rynku krajowym lub poniżej kosztów.'],['Cło wyrównawcze','Cło nakładane, gdy eksport z innego kraju jest subsydiowany.'],['Środki ochronne','Czasowe ograniczenia importu przy jego nagłym wzroście.'],['Subsydium','Dopłata państwa do produkcji lub eksportu.']]]]],
 ['Umowy handlowe UE',[
  ['Umowy o wolnym handlu','Umowy o wolnym handlu',[['CETA','Umowa handlowa UE z Kanadą.'],['Umowa o wolnym handlu','Umowa znosząca większość ceł między stronami.'],['Mercosur','Wspólny rynek Ameryki Południowej, z którym UE negocjuje umowę.'],['Reguły pochodzenia','Zasady, które ustalają, z jakiego kraju pochodzi towar.'],['Umowa o partnerstwie gospodarczym','Umowa UE z krajami Afryki, Karaibów i Pacyfiku.']]],
  ['Jak UE zawiera umowy','Procedura umów',[['Mandat negocjacyjny','Upoważnienie Rady UE dla Komisji do negocjacji umowy.'],['Rada UE','Instytucja rządów państw członkowskich, która zatwierdza umowy.'],['Zgoda Parlamentu Europejskiego','Warunek zawarcia umowy handlowej przez UE.'],['Umowa mieszana','Umowa obejmująca też kompetencje państw, więc ratyfikują ją także parlamenty krajowe.'],['Ratyfikacja','Ostateczne zatwierdzenie umowy międzynarodowej.']]]]],
 ['UE w handlu światowym',[
  ['UE w WTO','UE w WTO',[['UE w WTO','Unia występuje w WTO jako jeden członek obok państw członkowskich.'],['Spór handlowy','Konflikt o zasady handlu rozstrzygany w WTO.'],['Organ Rozstrzygania Sporów','Organ WTO, który rozstrzyga spory między członkami.'],['Organ Apelacyjny','Druga instancja sporów WTO; od 2019 r. nie działa.'],['Odwet handlowy','Cła nałożone za zgodą WTO po wygranym sporze.']]],
  ['Handel a wartości','Handel a wartości',[['Rozdział o zrównoważonym rozwoju','Część umowy handlowej o prawach pracowniczych i środowisku.'],['GSP','System preferencji: niższe cła dla krajów rozwijających się.'],['Everything but Arms','Bezcłowy dostęp do rynku UE dla krajów najsłabiej rozwiniętych, oprócz broni.'],['CBAM','Graniczny podatek węglowy: opłata za emisje CO₂ zawarte w imporcie niektórych towarów.'],['Kontrola eksportu','Ograniczenia eksportu towarów podwójnego zastosowania.']]]]]]};

/* ---------- budowa ---------- */
const lc=s=>s.charAt(0).toLowerCase()+s.slice(1);
function topic1(){
  const pts={};const add=(p,kind,level,index)=>{(pts[p]=pts[p]||{levels:new Set(),items:[]}).levels.add(level);pts[p].items.push({kind,level,index});};
  const levels=M1.levels.map(L=>{
    L.c.forEach((c,i)=>add(c[2],'flashcard',L.id,i));
    L.q.forEach((q,i)=>add(q[4],'quiz',L.id,i));
    L.t.forEach((t,i)=>add(t[1],'task',L.id,i));
    return {id:L.id,title:L.title,emoji:'📘',
      feed:L.f.map(([title,body])=>({title,body})),
      flashcards:L.c.map(([t,d])=>({t,d})),
      quiz:L.q.map(([q,a,c,e,,page])=>({q,a,c,e,src:{page,quote:e}})),
      tasks:L.t.map(t=>t[0])};});
  const keyPoints=Object.keys(POINTS_1).map(Number).map(n=>{const [title,short,summary]=POINTS_1[n],P=pts[n];
    const ord={flashcard:0,quiz:1,task:2};
    return {id:'p'+n,title,short,summary,levels:[...P.levels],items:P.items.sort((a,b)=>a.level.localeCompare(b.level)||ord[a.kind]-ord[b.kind]||a.index-b.index)};});
  return {name:M1.name,short:M1.short,emoji:'🌍',tagline:'Pojęcia i podmioty: MSG a MSP, globalizacja, państwa, organizacje, korporacje, UE i NGO.',
    accent:'#FF2E93',accent2:'#FF2E93',grading:GRADING,info:INFO,levels,keyPoints};
}
function topicFromTable(M,lid){
  const keyPoints=[];let pn=0;
  const levels=M.levels.map(([title,points],li)=>{
    const id=lid+(li+1),fc=[],quiz=[],feed=[],tasks=[];
    points.forEach(([ptitle,short,terms])=>{
      pn++;const items=[];
      feed.push({title:ptitle,body:terms.map(([t,d])=>`<b>${t}</b> — ${lc(d)}`).join('<br><br>')});
      terms.forEach(([t,d])=>{items.push({kind:'flashcard',level:id,index:fc.length});fc.push({t,d});});
      terms.slice(0,3).forEach(([t,d],k)=>{ // pytanie z szablonu: definicja → pojęcie (dystraktory z tego samego poziomu i punktu obok)
        const others=points.flatMap(p=>p[2].map(x=>x[0])).filter(x=>x!==t);
        const wrong=[others[(k*2)%others.length],others[(k*2+3)%others.length],others[(k*2+6)%others.length]].filter((x,i,a)=>a.indexOf(x)===i&&x!==t).slice(0,3);
        while(wrong.length<3)wrong.push(['Żadne z powyższych','Nie wiadomo','Inne pojęcie'][wrong.length]);
        const c=(pn+k)%4;const a=wrong.slice();a.splice(c,0,t);
        items.push({kind:'quiz',level:id,index:quiz.length});
        quiz.push({q:`Które pojęcie pasuje do opisu: „${d}”`,a,c,e:`To ${t}: ${lc(d)}`});});
      keyPoints.push({id:'p'+pn,title:ptitle,short,summary:terms.map(x=>x[0]).slice(0,3).join(', '),levels:[id],items});});
    const all=points.flatMap(p=>p[2]);
    tasks.push({type:'tf',statements:[{s:`${all[0][0]}: ${lc(all[0][1])}`,v:true,e:'Zgadza się z wykładem.'},{s:`${all[1][0]}: ${lc(all[all.length-1][1])}`,v:false,e:`To opis pojęcia „${all[all.length-1][0]}”.`},{s:`${all[2][0]}: ${lc(all[2][1])}`,v:true,e:'Zgadza się z wykładem.'}],e:'Pojęcia z tej lekcji w pigułce.'});
    keyPoints[keyPoints.length-points.length].items.push({kind:'task',level:id,index:0});
    return {id,title,emoji:'📘',feed,flashcards:fc,quiz,tasks};});
  return {name:M.name,short:M.short,emoji:'📘',tagline:'',accent:'#FF2E93',accent2:'#FF2E93',grading:GRADING,info:'',levels,keyPoints};
}
/* przypadki brzegowe keyPoints (keypoints.mjs): oczekiwania opisane przy każdym punkcie */
function kpEdge(){
  const lv=(id,n)=>({id,title:'Poziom '+id.toUpperCase(),emoji:'🧪',feed:[{title:'Część 1',body:'Treść części 1.'}],
    flashcards:Array.from({length:n},(_,i)=>({t:'Pojęcie '+id+'.'+i,d:'Definicja '+id+'.'+i})),
    quiz:Array.from({length:n},(_,i)=>({q:'Pytanie '+id+'.'+i+'?',a:['Tak','Nie','Może'],c:0,e:'Bo tak.'})),tasks:[{type:'tf',statements:[{s:'Zdanie',v:true}]}]});
  const it=(kind,level,index)=>({kind,level,index});
  return {name:'Punkty — przypadki brzegowe',short:'Punkty',tagline:'',grading:GRADING,levels:[lv('a1',6),lv('a2',6)],keyPoints:[
    // 1: XSS i emoji w tytułach — ma zostać zwykłym tekstem (plain), bez emoji
    {id:'p1',title:'Punkt <img src=x onerror="window.__pwned=1"> pierwszy 🔥',short:'<b>XSS</b> 🔥',summary:'<script>window.__pwned=1</script>Opis',levels:['a1'],items:[it('flashcard','a1',0),it('flashcard','a1',1),it('quiz','a1',0),it('quiz','a1',1)]},
    // 2: złe odwołania (nieznany poziom, indeks poza zakresem, ujemny) odpadają; zostają 3 poprawne
    {id:'p2',title:'Punkt ze złymi odwołaniami',short:'Złe odwołania',levels:['a1','zz'],items:[it('flashcard','zz',0),it('quiz','a1',99),it('quiz','a1',-1),it('flashcard','a1',2),it('quiz','a1',2),it('quiz','a1',3)]},
    // 3: duplikat odwołania z punktu 1 (pierwszy punkt wygrywa) + 1 własny element → < 3 elementy → scalony z następnym punktem
    {id:'p3',title:'Punkt z duplikatem',short:'Duplikat',levels:['a1'],items:[it('flashcard','a1',0),it('flashcard','a1',3)]},
    // 4: zwykły punkt w a1
    {id:'p4',title:'Punkt czwarty',short:'Czwarty',levels:['a1'],items:[it('flashcard','a1',4),it('quiz','a1',4),it('task','a1',0)]},
    // 5: punkt w a2 (fiszki 0–3, pytania 0–1); pytania a2 2–5 i fiszki a2 4–5 niepokryte → punkt zastępczy „La2”
    {id:'p5',title:'Punkt piąty',short:'Piąty',levels:['a2'],items:[it('flashcard','a2',0),it('flashcard','a2',1),it('flashcard','a2',2),it('flashcard','a2',3),it('quiz','a2',0),it('quiz','a2',1)]},
    // 6: same zadania (0 elementów z SRS) → scalony
    {id:'p6',title:'Punkt z samym zadaniem',short:'Zadanie',levels:['a2'],items:[it('task','a2',0)]},
    // 7: nieznany rodzaj elementu i śmieci → odpadają
    {id:'p7',title:'',short:'',levels:[],items:[{kind:'video',level:'a2',index:0},'x',null]}]};
}
function kpFew(){ // jeden poziom: 1 poprawny punkt + punkt zastępczy na niepokryte elementy = 2 < 3 → cały temat na punktach zastępczych (przy każdym odczytaniu reguły z §1.2)
  const t=kpEdge();t.name='Punkty — za mało poprawnych';t.short='Za mało';t.levels=t.levels.slice(0,1);
  t.keyPoints=[{id:'p1',title:'Jedyny dobry punkt',short:'Dobry',levels:['a1'],items:[{kind:'flashcard',level:'a1',index:0},{kind:'flashcard',level:'a1',index:1},{kind:'quiz',level:'a1',index:0}]},
    {id:'p2',title:'Zły punkt (nieznany poziom)',short:'Zły',levels:['zz'],items:[{kind:'quiz',level:'zz',index:0},{kind:'quiz',level:'zz',index:1},{kind:'quiz',level:'zz',index:2}]},
    {id:'p3',title:'Za mały punkt',short:'Mały',levels:['a1'],items:[{kind:'flashcard',level:'a1',index:2},{kind:'quiz',level:'a1',index:1}]}];
  return t;
}

/* ---------- niezmienniki 1.1 ---------- */
function verify(name,t,o={}){
  const err=[];const seen=new Set();
  t.keyPoints.forEach(p=>{let srs=0;
    if(p.items.length<3)err.push(`${p.id}: < 3 elementy`);
    if([...p.short].length>24)err.push(`${p.id}: short > 24 znaki`);
    p.items.forEach(x=>{const L=t.levels.find(l=>l.id===x.level);const arr=L&&(x.kind==='quiz'?L.quiz:x.kind==='flashcard'?L.flashcards:L.tasks);
      if(!arr||!arr[x.index])err.push(`${p.id}: brak ${x.kind} ${x.level}#${x.index}`);
      const k=x.kind+':'+x.level+':'+x.index;if(seen.has(k))err.push(`${p.id}: duplikat ${k}`);seen.add(k);if(x.kind!=='task')srs++;});
    if(srs<2)err.push(`${p.id}: < 2 elementy z SRS`);});
  t.levels.forEach(L=>{L.quiz.forEach((q,i)=>{if(!seen.has('quiz:'+L.id+':'+i))err.push(`pytanie ${L.id}#${i} bez punktu`);if(!(Number.isInteger(q.c)&&q.c>=0&&q.c<q.a.length)||!q.e)err.push(`pytanie ${L.id}#${i}: zły c/e`);});
    L.flashcards.forEach((c,i)=>{if(!seen.has('flashcard:'+L.id+':'+i))err.push(`fiszka ${L.id}#${i} bez punktu`);});});
  const n=k=>t.levels.reduce((a,L)=>a+L[k].length,0);
  if(o.counts){const c=[n('flashcards'),n('quiz'),n('tasks'),t.keyPoints.length,t.levels.map(L=>L.feed.length).join('/')];if(JSON.stringify(c)!==JSON.stringify(o.counts))err.push('liczby '+JSON.stringify(c)+' ≠ '+JSON.stringify(o.counts));}
  if(err.length){console.error(name+':\n  '+err.join('\n  '));process.exitCode=1;}
  else console.log(`${name}: ok — ${n('flashcards')} fiszek, ${n('quiz')} pytań, ${n('tasks')} zadań, ${t.keyPoints.length} punktów`);
}
const out=(f,v)=>fs.writeFileSync(path.join(HERE,f),JSON.stringify(v,null,2)+'\n');
const t1=topic1(),t2=topicFromTable(M2,'w'),t3=topicFromTable(M3,'p');
verify('topic-msgip',t1,{counts:[46,36,14,13,'5/6/6/4']});
verify('topic-msgip-2',t2,{counts:[36,24,4,8,'2/2/2/2']});
verify('topic-msgip-3',t3,{counts:[30,18,3,6,'2/2/2']});
out('topic-msgip.json',t1);out('topic-msgip-2.json',t2);out('topic-msgip-3.json',t3);
out('topic-kp-edge.json',kpEdge());out('topic-kp-few.json',kpFew());
