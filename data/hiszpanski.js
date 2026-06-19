/* ============================================================
   PRZEDMIOT: Język hiszpański (A1) — pod egzamin końcowy 21.06
   Zakres wprost od prowadzącej. Nacisk na NOWY materiał (🆕), reszta = powtórka.
   ============================================================ */
window.SUBJECTS = window.SUBJECTS || [];
window.SUBJECTS.push({
  id:"hiszpanski",
  name:"Hiszpański (egzamin 21.06)",
  short:"Español",
  emoji:"🇪🇸",
  tagline:"A1 pod egzamin: powtórka z kolokwiów + nowy materiał (sklepy, pogoda, gerundio, droga, podróże).",
  accent:"linear-gradient(135deg,#c60b1e,#ffc400,#c60b1e)",
  accent2:"#ffc400",
  lang:true,
  grading:{pass:50,examMin:20,scale:[[90,"5 / bdb"],[80,"4,5"],[70,"4 / db"],[60,"3,5"],[50,"3 / dst"]],failLabel:"2 — niezaliczone"},
  info:`
    <div class="zbox"><h3>🗓️ Egzamin 21.06</h3>
      <p>Skupiamy się głównie na <b>nowym materiale</b> (poziomy z 🆕), ale pojawią się też najważniejsze rzeczy z wcześniejszych zajęć i kolokwiów.</p></div>
    <div class="zbox"><h3>🆕 Nowy materiał (priorytet)</h3>
      <p>Sklepy (rodzaje + dialog ze sprzedawcą) · Pogoda, miesiące i pory roku · <b>Muy/mucho</b> · <b>Estar + gerundio</b> i kontrast presente vs gerundio · Pytanie/podawanie drogi · <b>Ir a + bezokolicznik</b> · Podróże (hotel/lotnisko).</p></div>
    <div class="zbox"><h3>🔁 Powtórka z kolokwiów</h3>
      <p>Przedstawianie się · Liczby · Odmiana czasowników (regularne + nieregularne) · Czasowniki typu <i>gustar</i> · Dialogi (restauracja) · Słownictwo: aktywności/rutyna + hobby, jedzenie, ubrania · Określenia miejsca i częstotliwości · Dzień i godzina · Tworzenie pytań · ser/estar/haber.</p></div>`,
  levels:[
    /* ===================== POWTÓRKA ===================== */
    {id:"e1",title:"Przedstawianie się",emoji:"👋",
     feed:[
      {title:"Powitania i pożegnania",body:"<b>Hola</b> – cześć · <b>Buenos días</b> – dzień dobry (rano) · <b>Buenas tardes</b> – dzień dobry (popołudnie) · <b>Buenas noches</b> – dobry wieczór/dobranoc · <b>Adiós</b> – do widzenia · <b>Hasta luego</b> – do zobaczenia · <b>Hasta mañana</b> – do jutra",mnemo:"<b>Días</b> = rano (do ~14), <b>tardes</b> = popołudnie, <b>noches</b> = wieczór."},
      {title:"Jak się przedstawić",body:"<b>Me llamo…</b> – nazywam się…<br><b>¿Cómo te llamas?</b> – jak się nazywasz?<br><b>Soy de Polonia</b> – jestem z Polski<br><b>¿De dónde eres?</b> – skąd jesteś?<br><b>Tengo 20 años</b> – mam 20 lat<br><b>Mucho gusto / Encantado/a</b> – miło mi",real:"Wiek przez TENER, nie ser: 'tengo 20 años' (dosł. mam 20 lat)."}
     ],
     flashcards:[
      {t:"Hola",d:"cześć"},{t:"Buenos días",d:"dzień dobry (rano)"},{t:"Buenas tardes",d:"dzień dobry (po południu)"},
      {t:"Buenas noches",d:"dobry wieczór / dobranoc"},{t:"Adiós",d:"do widzenia"},{t:"Hasta luego",d:"do zobaczenia"},
      {t:"Me llamo…",d:"nazywam się…"},{t:"¿Cómo te llamas?",d:"jak się nazywasz?"},{t:"¿De dónde eres?",d:"skąd jesteś?"},
      {t:"Soy de…",d:"jestem z… (pochodzenie)"},{t:"Encantado / Encantada",d:"miło mi (m./ż.)"},{t:"¿Cómo estás?",d:"jak się masz?"}
     ],
     quiz:[
      {q:"Jak powiesz „nazywam się Ana”?",a:["Me llamo Ana","Soy de Ana","Tengo Ana","Me gusta Ana"],c:0,e:"Me llamo + imię. 'Soy Ana' też jest OK."},
      {q:"„Buenas noches” oznacza:",a:["dzień dobry rano","dobry wieczór / dobranoc","do jutra","smacznego"],c:1,e:"Noches = wieczór/noc."},
      {q:"Jak zapytasz „skąd jesteś?”",a:["¿Cómo te llamas?","¿Cuántos años tienes?","¿De dónde eres?","¿Qué hora es?"],c:2,e:"De dónde eres = skąd jesteś."},
      {q:"„Mam 20 lat” to po hiszpańsku:",a:["Soy 20 años","Tengo 20 años","Estoy 20 años","Hay 20 años"],c:1,e:"Wiek przez TENER: tengo … años."}
     ]},
    {id:"e2",title:"Liczby",emoji:"🔢",
     feed:[
      {title:"Liczby 0–20",body:"0 cero, 1 uno, 2 dos, 3 tres, 4 cuatro, 5 cinco, 6 seis, 7 siete, 8 ocho, 9 nueve, 10 diez, 11 once, 12 doce, 13 trece, 14 catorce, 15 quince, 16 dieciséis, 17 diecisiete, 18 dieciocho, 19 diecinueve, 20 veinte.",mnemo:"16–19 = 'diez y…' sklejone: dieci+séis, dieci+siete…"},
      {title:"Dziesiątki i setka",body:"30 treinta, 40 cuarenta, 50 cincuenta, 60 sesenta, 70 setenta, 80 ochenta, 90 noventa, 100 cien.<br>21–29: <b>veinti…</b> (veintiuno, veintidós). 31+: <b>treinta y uno</b>, cuarenta y dos…",real:"Od 31 w górę dajesz 'y': cuarenta y tres = 43. Tylko 20-tki sklejasz: veintitrés."}
     ],
     flashcards:[
      {t:"cinco",d:"5"},{t:"ocho",d:"8"},{t:"once",d:"11"},{t:"quince",d:"15"},{t:"diecisiete",d:"17"},{t:"veinte",d:"20"},
      {t:"treinta",d:"30"},{t:"cuarenta",d:"40"},{t:"cincuenta",d:"50"},{t:"setenta",d:"70"},{t:"noventa",d:"90"},{t:"cien",d:"100"}
     ],
     quiz:[
      {q:"Ile to „cuarenta y siete”?",a:["47","57","74","27"],c:0,e:"cuarenta (40) y siete (7) = 47."},
      {q:"Jak zapiszesz 15?",a:["cincuenta","quince","cinco","quinientos"],c:1,e:"quince = 15. cincuenta = 50."},
      {q:"„70” to:",a:["sesenta","setenta","siete","setecientos"],c:1,e:"setenta = 70, sesenta = 60."},
      {q:"23 po hiszpańsku:",a:["veintitrés","treinta y dos","dos y tres","veinte tres"],c:0,e:"20-tki sklejone: veintitrés."}
     ]},
    {id:"e3",title:"Czasowniki: odmiana",emoji:"🔧",
     feed:[
      {title:"Regularne: -ar / -er / -ir",body:"<b>hablar</b> (mówić): hablo, hablas, habla, hablamos, habláis, hablan<br><b>comer</b> (jeść): como, comes, come, comemos, coméis, comen<br><b>vivir</b> (mieszkać): vivo, vives, vive, vivimos, vivís, viven",mnemo:"Końcówki yo/tú/él: <b>-o, -as/-es, -a/-e</b>. -er i -ir różnią się tylko w 'nosotros/vosotros'."},
      {title:"Nieregularne must-know",body:"<b>ser</b>: soy, eres, es, somos, sois, son<br><b>estar</b>: estoy, estás, está, estamos, estáis, están<br><b>tener</b>: tengo, tienes, tiene, tenemos, tenéis, tienen<br><b>ir</b>: voy, vas, va, vamos, vais, van<br><b>hacer</b>: hago, haces, hace…",real:"Te cztery (ser, estar, tener, ir) wracają wszędzie. Naucz się ich na blachę."}
     ],
     flashcards:[
      {t:"hablar → yo",d:"hablo (mówię)"},{t:"comer → yo",d:"como (jem)"},{t:"vivir → nosotros",d:"vivimos (mieszkamy)"},
      {t:"ser → yo",d:"soy (jestem - cecha)"},{t:"estar → yo",d:"estoy (jestem - stan/miejsce)"},{t:"tener → yo",d:"tengo (mam)"},
      {t:"ir → yo",d:"voy (idę/jadę)"},{t:"hacer → yo",d:"hago (robię)"},{t:"tener → tú",d:"tienes (masz)"},
      {t:"ir → nosotros",d:"vamos (idziemy)"}
     ],
     quiz:[
      {q:"Forma „yo” od czasownika comer:",a:["como","comо","comes","como"],c:0,e:"comer → yo como."},
      {q:"„tú” od tener:",a:["tengo","tienes","tiene","tienen"],c:1,e:"tener → tú tienes."},
      {q:"Końcówki regularne dla 'nosotros':",a:["-amos / -emos / -imos","-o / -es / -e","-an / -en","-áis / -éis"],c:0,e:"hablamos, comemos, vivimos."},
      {q:"„voy” to forma czasownika:",a:["ver","ir","venir","dar"],c:1,e:"ir → yo voy (idę/jadę)."}
     ]},
    {id:"e4",title:"Gustar i podobne",emoji:"❤️",
     feed:[
      {title:"Jak działa GUSTAR",body:"Gustar = 'podobać się' (dosł. coś mi się podoba). Zaimki: <b>me, te, le, nos, os, les</b>.<br><b>Me gusta el café</b> – lubię kawę (l.poj. / bezokolicznik)<br><b>Me gustan los gatos</b> – lubię koty (l.mnoga)<br><b>Me gusta bailar</b> – lubię tańczyć",mnemo:"<b>gusta</b> + jedna rzecz/czasownik, <b>gustan</b> + wiele rzeczy. Czasownik zgadza się z RZECZĄ, nie z osobą."},
      {title:"Wzmacnianie i inne",body:"<b>Me encanta</b> – uwielbiam (mocniej niż gusta)<br><b>No me gusta nada</b> – w ogóle nie lubię<br><b>A mí también</b> – mnie też (zgoda) / <b>A mí tampoco</b> – mnie też nie<br>Podobnie odmieniają się: <b>encantar, interesar, doler</b> (boleć).",real:"'¿Te gusta?' – lubisz to? Odp.: 'Sí, me gusta mucho' albo 'No, no me gusta'."}
     ],
     flashcards:[
      {t:"Me gusta…",d:"lubię… (l.poj./czasownik)"},{t:"Me gustan…",d:"lubię… (l.mnoga)"},{t:"Me encanta",d:"uwielbiam"},
      {t:"¿Te gusta?",d:"lubisz to?"},{t:"No me gusta nada",d:"w ogóle nie lubię"},{t:"A mí también",d:"mnie też"},
      {t:"A mí tampoco",d:"mnie też nie"},{t:"le gusta",d:"jemu/jej się podoba"},{t:"nos gusta",d:"nam się podoba"}
     ],
     quiz:[
      {q:"„Lubię koty” (los gatos) to:",a:["Me gusta los gatos","Me gustan los gatos","Me gustas los gatos","Gusto los gatos"],c:1,e:"L.mnoga → gustan."},
      {q:"„Lubię tańczyć” (bailar):",a:["Me gustan bailar","Me gusta bailar","Bailo gusta","Me gusto bailar"],c:1,e:"Bezokolicznik → gusta (l.poj.)."},
      {q:"Czasownik w gustar zgadza się z:",a:["osobą mówiącą","rzeczą, która się podoba","czasem","rodzajem gramatycznym osoby"],c:1,e:"gusta/gustan zależy od rzeczy, nie od 'ja/ty'."},
      {q:"„Mnie też nie” (zgoda do przeczenia):",a:["A mí también","A mí tampoco","Yo también","Me gusta"],c:1,e:"tampoco = przy przeczeniu; también = przy twierdzeniu."}
     ]},
    {id:"e5",title:"Słownictwo: jedzenie, ubrania, aktywności",emoji:"🍽️",
     feed:[
      {title:"Jedzenie (la comida)",body:"el pan – chleb · la fruta – owoce · la carne – mięso · el pescado – ryba · la verdura – warzywa · el agua – woda · el café – kawa · la leche – mleko · el queso – ser · el pollo – kurczak · el arroz – ryż · el huevo – jajko",mnemo:"Restauracja: <b>de primero</b> (przystawka), <b>de segundo</b> (danie gł.), <b>de postre</b> (deser), <b>la cuenta</b> (rachunek)."},
      {title:"Ubrania (la ropa)",body:"la camiseta – koszulka · la camisa – koszula · el pantalón – spodnie · los zapatos – buty · el vestido – sukienka · la falda – spódnica · la chaqueta – kurtka/marynarka · el abrigo – płaszcz · los calcetines – skarpetki · el jersey – sweter"},
      {title:"Aktywności: rutyna + hobby",body:"<b>Rutyna (zwrotne):</b> levantarse (wstawać) – me levanto, ducharse (brać prysznic), vestirse (ubierać się), desayunar (jeść śniadanie), acostarse (kłaść się) – me acuesto.<br><b>Hobby:</b> leer (czytać), ver la tele, escuchar música, jugar al fútbol, salir con amigos, hacer deporte.",real:"Zwrotne: zaimek PRZED czasownikiem: me levanto, te duchas, se acuesta."}
     ],
     flashcards:[
      {t:"el pan",d:"chleb"},{t:"la carne",d:"mięso"},{t:"el pescado",d:"ryba"},{t:"la verdura",d:"warzywa"},{t:"el queso",d:"ser"},
      {t:"la camiseta",d:"koszulka"},{t:"los zapatos",d:"buty"},{t:"el pantalón",d:"spodnie"},{t:"el vestido",d:"sukienka"},{t:"la chaqueta",d:"kurtka/marynarka"},
      {t:"levantarse",d:"wstawać (me levanto)"},{t:"ducharse",d:"brać prysznic"},{t:"desayunar",d:"jeść śniadanie"},{t:"la cuenta",d:"rachunek (w restauracji)"}
     ],
     quiz:[
      {q:"„el pescado” to:",a:["mięso","ryba","ser","chleb"],c:1,e:"pescado = ryba; carne = mięso."},
      {q:"Które słowo to ubranie?",a:["el arroz","la falda","la leche","el huevo"],c:1,e:"la falda = spódnica."},
      {q:"„me levanto” znaczy:",a:["myję się","wstaję","kładę się","ubieram się"],c:1,e:"levantarse = wstawać."},
      {q:"W restauracji „la cuenta” to:",a:["karta dań","kelner","rachunek","deser"],c:2,e:"la cuenta = rachunek. la carta = menu."}
     ]},
    {id:"e6",title:"Miejsce, częstotliwość, czas",emoji:"📍",
     feed:[
      {title:"Określenia miejsca",body:"en – w/na · <b>encima de / sobre</b> – na · <b>debajo de</b> – pod · <b>enfrente de</b> – naprzeciwko · <b>al lado de</b> – obok · <b>a la derecha</b> – po prawej · <b>a la izquierda</b> – po lewej · <b>entre</b> – między · <b>detrás de</b> – za · <b>delante de</b> – przed",mnemo:"derecha = prawo (jak 'direct'), izquierda = lewo."},
      {title:"Częstotliwość",body:"<b>siempre</b> – zawsze · <b>a menudo</b> – często · <b>a veces</b> – czasami · <b>raramente / casi nunca</b> – rzadko · <b>nunca</b> – nigdy · <b>todos los días</b> – codziennie",real:"'Nunca' przed czasownikiem = bez 'no': Nunca como carne. Po czasowniku trzeba 'no': No como carne nunca."},
      {title:"Dzień i godzina",body:"Dni: lunes, martes, miércoles, jueves, viernes, sábado, domingo.<br><b>¿Qué hora es?</b> – Es la una / Son las dos. <b>y media</b> (:30), <b>y cuarto</b> (:15), <b>menos cuarto</b> (za 15).",mnemo:"Tylko 1:00 = 'ES la una'. Reszta = 'SON las…'."}
     ],
     flashcards:[
      {t:"a la derecha",d:"po prawej"},{t:"a la izquierda",d:"po lewej"},{t:"al lado de",d:"obok"},{t:"enfrente de",d:"naprzeciwko"},
      {t:"debajo de",d:"pod"},{t:"encima de",d:"na (czymś)"},{t:"siempre",d:"zawsze"},{t:"a veces",d:"czasami"},{t:"nunca",d:"nigdy"},
      {t:"todos los días",d:"codziennie"},{t:"¿Qué hora es?",d:"która godzina?"},{t:"y media",d:"wpół (np. 2:30)"}
     ],
     quiz:[
      {q:"„po lewej” to:",a:["a la derecha","a la izquierda","enfrente","al lado"],c:1,e:"izquierda = lewo."},
      {q:"„nunca” znaczy:",a:["zawsze","czasami","nigdy","często"],c:2,e:"nunca = nigdy."},
      {q:"Jak powiesz „jest 1:00”?",a:["Son la una","Es la una","Son las una","Es las dos"],c:1,e:"Tylko godzina 1 = ES la una."},
      {q:"„debajo de la mesa” to:",a:["na stole","pod stołem","obok stołu","za stołem"],c:1,e:"debajo de = pod."}
     ]},
    {id:"e7",title:"Pytania + ser/estar/haber",emoji:"❓",
     feed:[
      {title:"Pytajniki (interrogativos)",body:"<b>¿Qué?</b> – co? · <b>¿Quién?</b> – kto? · <b>¿Dónde?</b> – gdzie? · <b>¿Cuándo?</b> – kiedy? · <b>¿Cómo?</b> – jak? · <b>¿Por qué?</b> – dlaczego? · <b>¿Cuánto/a/os/as?</b> – ile? · <b>¿Cuál?</b> – który?",mnemo:"Wszystkie pytajniki mają akcent (¿qué? vs que). I podwójny znak: ¿…?"},
      {title:"SER vs ESTAR vs HAY",body:"<b>SER</b> – cecha stała: <i>Soy polaco. Es grande.</i><br><b>ESTAR</b> – stan/miejsce: <i>Estoy cansado. El banco está aquí.</i><br><b>HAY</b> (haber) – jest/są (istnienie, nieokreślone): <i>Hay un banco. ¿Hay una parada?</i>",real:"Pytania: ¿Dónde ESTÁ el supermercado? (gdzie jest – konkretny) vs ¿HAY un supermercado por aquí? (czy jest jakiś)."}
     ],
     flashcards:[
      {t:"¿Qué?",d:"co?"},{t:"¿Dónde?",d:"gdzie?"},{t:"¿Cuándo?",d:"kiedy?"},{t:"¿Cómo?",d:"jak?"},{t:"¿Por qué?",d:"dlaczego?"},
      {t:"¿Cuánto cuesta?",d:"ile kosztuje?"},{t:"ser",d:"być (cecha stała)"},{t:"estar",d:"być (stan / miejsce)"},
      {t:"hay",d:"jest / są (istnienie, nieokreślone)"},{t:"¿Dónde está…?",d:"gdzie jest…? (konkretny)"},{t:"¿Hay…?",d:"czy jest jakiś…?"}
     ],
     quiz:[
      {q:"„Gdzie jest dworzec?” (konkretny):",a:["¿Dónde hay la estación?","¿Dónde está la estación?","¿Dónde es la estación?","¿Qué la estación?"],c:1,e:"Konkretne miejsce → ESTAR: ¿Dónde está…?"},
      {q:"„Czy jest tu jakiś przystanek?”",a:["¿Hay una parada por aquí?","¿Está una parada?","¿Es una parada?","¿Dónde la parada?"],c:0,e:"Istnienie nieokreślone → HAY."},
      {q:"„Jestem zmęczony” (stan):",a:["Soy cansado","Estoy cansado","Hay cansado","Tengo cansado"],c:1,e:"Stan chwilowy → ESTAR."},
      {q:"Który to pytajnik „ile”?",a:["¿Cuándo?","¿Cuánto?","¿Cómo?","¿Cuál?"],c:1,e:"cuánto = ile; cuándo = kiedy."}
     ]},
    /* ===================== NOWY MATERIAŁ 🆕 ===================== */
    {id:"n1",title:"🆕 Sklepy + dialog",emoji:"🛒",
     feed:[
      {title:"Rodzaje sklepów (słówka prowadzącej)",body:"<b>la panadería</b> – piekarnia (pan) · <b>la carnicería</b> – mięsny (ternera, carne) · <b>la pescadería</b> – rybny (salmón) · <b>la frutería</b> – owoce/warzywa (naranjas) · <b>la pastelería</b> – cukiernia (tarta, pastel) · <b>la farmacia</b> – apteka (aspirinas) · <b>la papelería</b> – sklep papierniczy (bolígrafo) · <b>la óptica</b> – optyk (gafas) · <b>la joyería</b> – jubiler (anillo) · <b>la zapatería</b> – obuwniczy (botas) · <b>el estanco</b> – kiosk z tytoniem i znaczkami (sellos) · <b>el supermercado</b> – supermarket · <b>la tienda de ropa</b> – sklep odzieżowy (blusa)",mnemo:"Końcówka <b>-ería</b> = sklep z czymś: pan→panadería, carne→carnicería, zapato→zapatería. Wyjątki: la óptica, el estanco, el supermercado."},
      {title:"Co gdzie kupisz (dopasowania z zajęć)",body:"sellos (znaczki) → <b>estanco</b> · gafas (okulary) → <b>óptica</b> · anillo (pierścionek) → <b>joyería</b> · tarta (tort) → <b>pastelería</b> · bolígrafo (długopis) → <b>papelería</b> · aspirinas → <b>farmacia</b> · salmón → <b>pescadería</b> · ternera (wołowina) → <b>carnicería</b> · naranjas → <b>frutería</b> · botas → <b>zapatería</b>",real:"Pułapki egzaminacyjne: <b>estanco</b> = tu kupisz znaczki (sellos), <b>óptica</b> = okulary, <b>joyería</b> = biżuteria. Te trzy lubią się pojawiać."},
      {title:"Dialog ze sprzedawcą",body:"<b>¿Qué desea?</b> – czego pan/pani sobie życzy?<br><b>Quería…</b> – chciał(a)bym…<br><b>¿Cuánto cuesta? / ¿Cuánto es?</b> – ile kosztuje?<br><b>¿Algo más?</b> – coś jeszcze?<br><b>Nada más, gracias</b> – nic więcej, dziękuję<br><b>En total son 10 euros</b> – razem 10 euro · <b>Aquí tiene</b> – proszę bardzo"}
     ],
     flashcards:[
      {t:"la panadería",d:"piekarnia (pan)"},{t:"la carnicería",d:"sklep mięsny (carne, ternera)"},{t:"la pescadería",d:"sklep rybny (salmón)"},
      {t:"la frutería",d:"warzywniak / owoce (naranjas)"},{t:"la pastelería",d:"cukiernia (tarta, pastel)"},{t:"la farmacia",d:"apteka (aspirinas)"},
      {t:"la papelería",d:"sklep papierniczy (bolígrafo)"},{t:"la óptica",d:"optyk (gafas / okulary)"},{t:"la joyería",d:"jubiler (anillo / pierścionek)"},
      {t:"la zapatería",d:"sklep obuwniczy (botas)"},{t:"el estanco",d:"kiosk z tytoniem i znaczkami (sellos)"},{t:"el supermercado",d:"supermarket"},
      {t:"la tienda de ropa",d:"sklep odzieżowy (blusa)"},{t:"¿Cuánto cuesta?",d:"ile kosztuje?"},{t:"¿Qué desea?",d:"czego pan/pani sobie życzy?"},
      {t:"¿Algo más?",d:"coś jeszcze?"},{t:"Aquí tiene",d:"proszę bardzo (podając)"}
     ],
     quiz:[
      {q:"Gdzie kupisz znaczki (sellos)?",a:["la papelería","el estanco","la farmacia","la óptica"],c:1,e:"Sellos → el estanco (kiosk z tytoniem i znaczkami)."},
      {q:"Gafas (okulary) kupisz w:",a:["la óptica","la joyería","la papelería","la pescadería"],c:0,e:"Gafas → la óptica."},
      {q:"Gdzie kupisz tort (tarta)?",a:["la panadería","la pastelería","la frutería","la carnicería"],c:1,e:"Tarta/pastel → la pastelería. Pan → panadería."},
      {q:"Anillo (pierścionek) kupisz w:",a:["la zapatería","la joyería","el estanco","la tienda de ropa"],c:1,e:"Anillo → la joyería (jubiler)."},
      {q:"„Salmón” (łosoś) kupisz w:",a:["la carnicería","la pescadería","la frutería","la pastelería"],c:1,e:"Ryby → la pescadería; mięso → carnicería."},
      {q:"Sprzedawca pyta „¿Algo más?” — znaczy:",a:["ile płacę?","coś jeszcze?","gdzie kasa?","masz kartę?"],c:1,e:"Algo más = coś jeszcze?"},
      {q:"Jak zapytasz o cenę?",a:["¿Qué desea?","¿Cuánto cuesta?","¿Algo más?","¿Dónde está?"],c:1,e:"¿Cuánto cuesta? / ¿Cuánto es?"}
     ]},
    {id:"n2",title:"🆕 Pogoda, miesiące, pory roku",emoji:"🌤️",
     feed:[
      {title:"Pogoda (el tiempo)",body:"<b>Hace sol</b> – jest słonecznie · <b>Hace calor</b> – jest gorąco · <b>Hace frío</b> – jest zimno · <b>Hace viento</b> – jest wietrznie · <b>Hace buen/mal tiempo</b> – ładna/brzydka pogoda · <b>Llueve</b> – pada deszcz (llover) · <b>Nieva</b> – pada śnieg (nevar) · <b>Está nublado</b> – jest pochmurno",mnemo:"Pogoda głównie przez <b>HACE</b> (hace sol/frío/calor). Ale: llueve, nieva, está nublado — bez 'hace'."},
      {title:"Pory roku i miesiące",body:"<b>Pory roku:</b> la primavera (wiosna), el verano (lato), el otoño (jesień), el invierno (zima).<br><b>Miesiące:</b> enero, febrero, marzo, abril, mayo, junio, julio, agosto, septiembre, octubre, noviembre, diciembre.",real:"Miesiące i dni piszemy <b>małą literą</b>: 'en junio', 'el lunes'."},
      {title:"Kultura: kwiecień w Hiszpanii 🇪🇸",body:"Z materiału „El abril en España”:<br>🐎 <b>La Feria de Abril</b> – święto w <b>Sewilli</b>: casetas (namioty), muzyka i taniec <b>sevillanas</b>, jedzenie/picie, corrida de toros.<br>📚🌹 <b>Sant Jordi</b> (23 kwietnia, Barcelona) – „najpiękniejszy dzień”: ludzie <b>dają sobie książki i róże</b> (libros y rosas).",real:"Skojarz: Feria de Abril = Sevilla + sevillanas; Sant Jordi = Barcelona + książki i róże (23.04)."}
     ],
     flashcards:[
      {t:"Hace sol",d:"jest słonecznie"},{t:"Hace calor",d:"jest gorąco"},{t:"Hace frío",d:"jest zimno"},{t:"Hace viento",d:"jest wietrznie"},
      {t:"Llueve",d:"pada deszcz"},{t:"Nieva",d:"pada śnieg"},{t:"Está nublado",d:"jest pochmurno"},
      {t:"la primavera",d:"wiosna"},{t:"el verano",d:"lato"},{t:"el otoño",d:"jesień"},{t:"el invierno",d:"zima"},
      {t:"julio",d:"lipiec"},{t:"diciembre",d:"grudzień"}
     ],
     quiz:[
      {q:"Jak powiesz „jest zimno”?",a:["Hace calor","Hace frío","Hace sol","Llueve"],c:1,e:"Hace frío = zimno; calor = gorąco."},
      {q:"„pada deszcz” to:",a:["Nieva","Llueve","Está nublado","Hace viento"],c:1,e:"Llueve (llover). Nieva = pada śnieg."},
      {q:"Lato po hiszpańsku:",a:["el invierno","el otoño","el verano","la primavera"],c:2,e:"verano = lato; invierno = zima."},
      {q:"Pogodę najczęściej tworzymy czasownikiem:",a:["ser","hacer (hace…)","tener","ir"],c:1,e:"Hace sol/calor/frío/viento."}
     ]},
    {id:"n3",title:"🆕 Muy vs Mucho",emoji:"⚖️",
     feed:[
      {title:"MUY — bardzo (przy cechach)",body:"<b>muy</b> + przymiotnik / przysłówek. Nie odmienia się.<br><i>muy grande</i> – bardzo duży · <i>muy bien</i> – bardzo dobrze · <i>muy cansado</i> – bardzo zmęczony · <i>muy rápido</i> – bardzo szybko",mnemo:"<b>muy</b> stoi przy 'jaki/jak' (przymiotnik/przysłówek). Krótkie słowo = krótkie towarzystwo."},
      {title:"MUCHO — dużo (przy rzeczach/czynnościach)",body:"<b>mucho</b> + rzeczownik (odmienia się przez rodzaj/liczbę): mucho dinero, mucha gente, muchos libros, muchas casas.<br><b>mucho</b> po czasowniku (nie odmienia się): <i>como mucho</i> – dużo jem · <i>trabaja mucho</i> – dużo pracuje.",real:"Test: 'bardzo' → MUY. 'dużo' → MUCHO. Nigdy 'muy mucho'."}
     ],
     flashcards:[
      {t:"muy",d:"bardzo (+ przymiotnik/przysłówek)"},{t:"mucho",d:"dużo (+ rzeczownik / po czasowniku)"},
      {t:"muy grande",d:"bardzo duży"},{t:"muy bien",d:"bardzo dobrze"},{t:"mucho dinero",d:"dużo pieniędzy"},
      {t:"mucha gente",d:"dużo ludzi"},{t:"muchos libros",d:"dużo książek"},{t:"Trabaja mucho",d:"dużo pracuje"}
     ],
     quiz:[
      {q:"„bardzo zmęczony” to:",a:["mucho cansado","muy cansado","mucha cansado","muy mucho cansado"],c:1,e:"bardzo + przymiotnik → MUY."},
      {q:"„dużo ludzi” (la gente):",a:["muy gente","mucho gente","mucha gente","muchas gente"],c:2,e:"gente jest ż.l.poj. → mucha gente."},
      {q:"Wstaw: „Como ___” (dużo jem):",a:["muy","mucho","mucha","muchos"],c:1,e:"Po czasowniku → mucho (bez odmiany)."},
      {q:"Która forma jest BŁĘDNA?",a:["muy rápido","muchos libros","muy mucho","mucha agua"],c:2,e:"'muy mucho' nie istnieje."}
     ]},
    {id:"n4",title:"🆕 Estar + gerundio",emoji:"🔄",
     feed:[
      {title:"Gerundio — jak go tworzyć",body:"Czasowniki <b>-ar</b> → <b>-ando</b>: hablar → hablando.<br><b>-er / -ir</b> → <b>-iendo</b>: comer → comiendo, vivir → viviendo.<br>Nieregularne: leer → le<b>y</b>endo, dormir → d<b>u</b>rmiendo, pedir → p<b>i</b>diendo, oír → oyendo.",mnemo:"-AR → -ANDO, -ER/-IR → -IENDO. (A do A, reszta do I.)"},
      {title:"Estar + gerundio = dzieje się TERAZ",body:"<b>estar</b> (odmienione) + gerundio = czynność w trakcie, w tym momencie.<br><i>Estoy comiendo</i> – właśnie jem · <i>¿Qué estás haciendo?</i> – co (teraz) robisz? · <i>Está lloviendo</i> – właśnie pada",real:"To hiszpański 'present continuous' (jak ang. I am eating)."},
      {title:"Presente vs gerundio — kontrast",body:"<b>Presente</b> = ogólnie / rutyna / zawsze: <i>Como a las dos</i> (jadam o 14), <i>Estudio español</i> (uczę się hiszpańskiego – ogólnie).<br><b>Estar + gerundio</b> = właśnie teraz: <i>Estoy comiendo</i> (jem w tej chwili), <i>Estoy estudiando</i> (uczę się w tym momencie).",real:"Słowa-klucze dla gerundio: ahora, en este momento. Dla presente: normalmente, todos los días, siempre."}
     ],
     flashcards:[
      {t:"hablando",d:"mówiąc (hablar → -ando)"},{t:"comiendo",d:"jedząc (comer → -iendo)"},{t:"viviendo",d:"mieszkając (vivir → -iendo)"},
      {t:"leyendo",d:"czytając (leer — nieregularne)"},{t:"durmiendo",d:"śpiąc (dormir — nieregularne)"},
      {t:"Estoy comiendo",d:"właśnie jem"},{t:"¿Qué estás haciendo?",d:"co (teraz) robisz?"},{t:"Está lloviendo",d:"właśnie pada"},
      {t:"estar + gerundio",d:"czynność w trakcie (teraz)"}
     ],
     quiz:[
      {q:"Gerundio od „comer” to:",a:["comando","comiendo","comando","comido"],c:1,e:"-er → -iendo: comiendo."},
      {q:"„Właśnie pada” to:",a:["Llueve ahora","Está lloviendo","Estoy lloviendo","Hace lluvia"],c:1,e:"estar + gerundio: está lloviendo."},
      {q:"Gerundio od „hablar”:",a:["hablando","hablendo","hablado","habliendo"],c:0,e:"-ar → -ando: hablando."},
      {q:"„Normalmente como a las dos” używa presente, bo:",a:["czynność trwa teraz","to rutyna/ogólnie","to przyszłość","to rozkaz"],c:1,e:"Rutyna/ogólnie → presente. Teraz → estar+gerundio."},
      {q:"Gerundio od „leer” (nieregularne):",a:["leiendo","leyendo","leendo","leyando"],c:1,e:"leer → leyendo (i→y między samogłoskami)."},
      {q:"[z quizu] „Ahora mismo ___ Matemáticas porque mañana tengo examen.”",a:["estudio","estoy estudiando","voy a estudiar","estudiando"],c:1,e:"'Ahora mismo' = teraz → estar+gerundio: estoy estudiando."},
      {q:"[z quizu] „El próximo sábado ___ al cine.”",a:["estamos yendo","vamos","estamos ir","yendo"],c:1,e:"Plan na przyszłość, nie czynność w trakcie → presente: vamos. (NIE 'estamos yendo'.)"},
      {q:"[z quizu] „Su primo es músico. ___ el violín.”",a:["Está tocando","Toca","Tocando","Va a tocar"],c:1,e:"Cecha/ogólnie (jest muzykiem) → presente: Toca."},
      {q:"[z quizu] „Marco ___ la televisión en este momento.”",a:["ve","está viendo","va a ver","viendo"],c:1,e:"'En este momento' → estar+gerundio: está viendo."},
      {q:"[z quizu] „No puedes gritar, el niño ___.”",a:["duerme","está durmiendo","va a dormir","durmiendo"],c:1,e:"Dzieje się teraz → está durmiendo (dormir → durmiendo)."},
      {q:"[z quizu] „¿Puede repetir? Es que no ___ bien.” (słyszeć)",a:["estoy oyendo","oigo","voy a oír","oyendo"],c:1,e:"Czasowniki percepcji (oír, ver) zwykle w presente: no oigo bien — mimo że 'teraz'."},
      {q:"Reguła z zajęć: presente używamy do…, a estar+gerundio do…",a:["…czynności teraz / …rutyny","…rutyny i prawd ogólnych / …czynności w trakcie mówienia","obu tak samo","tylko w pytaniach"],c:1,e:"Presente = czynności habitualne i prawdy ogólne; estar+gerundio = czynność w momencie mówienia."}
     ]},
    {id:"n5",title:"🆕 Pytanie i podawanie drogi",emoji:"🧭",
     feed:[
      {title:"Jak zapytać o drogę",body:"<b>¿Cómo llego a…?</b> – jak dojdę do…?<br><b>¿Dónde está…?</b> – gdzie jest…?<br><b>¿Hay un/una … por aquí?</b> – czy jest tu jakiś…?<br><b>¿Está lejos / cerca?</b> – czy to daleko / blisko?",real:"Perdone/Disculpe (przepraszam) na start, gdy zaczepiasz kogoś o drogę."},
      {title:"Wskazówki (las direcciones)",body:"<b>Sigue todo recto</b> – idź prosto · <b>Gira a la derecha</b> – skręć w prawo · <b>Gira a la izquierda</b> – skręć w lewo · <b>Cruza la calle</b> – przejdź przez ulicę · <b>la primera/segunda calle</b> – pierwsza/druga ulica · <b>Está al final de la calle</b> – na końcu ulicy",mnemo:"recto = prosto, gira = skręć, cruza = przejdź. derecha=prawo / izquierda=lewo."}
     ],
     flashcards:[
      {t:"¿Cómo llego a…?",d:"jak dojdę do…?"},{t:"todo recto",d:"prosto"},{t:"Sigue recto",d:"idź prosto"},
      {t:"Gira a la derecha",d:"skręć w prawo"},{t:"Gira a la izquierda",d:"skręć w lewo"},{t:"Cruza la calle",d:"przejdź przez ulicę"},
      {t:"¿Está lejos?",d:"czy to daleko?"},{t:"cerca",d:"blisko"},{t:"la primera calle",d:"pierwsza ulica"},{t:"Perdone / Disculpe",d:"przepraszam (zaczepiając)"}
     ],
     quiz:[
      {q:"„skręć w lewo” to:",a:["gira a la derecha","sigue recto","gira a la izquierda","cruza la calle"],c:2,e:"izquierda = lewo."},
      {q:"„Jak dojdę do dworca?”",a:["¿Cómo llego a la estación?","¿Cuánto cuesta la estación?","¿Qué hora es?","¿De dónde eres?"],c:0,e:"¿Cómo llego a…? = jak dojdę do…?"},
      {q:"„todo recto” znaczy:",a:["w prawo","prosto","w lewo","zawróć"],c:1,e:"recto = prosto."},
      {q:"„¿Está cerca?” pyta o to, czy coś jest:",a:["daleko","drogie","blisko","otwarte"],c:2,e:"cerca = blisko; lejos = daleko."}
     ]},
    {id:"n6",title:"🆕 Ir a + bezokolicznik",emoji:"⏩",
     feed:[
      {title:"Bliska przyszłość: IR A + infinitivo",body:"<b>ir</b> (odmienione) + <b>a</b> + bezokolicznik = zamiar / najbliższa przyszłość ('zamierzam / będę').<br>voy a, vas a, va a, vamos a, vais a, van a + czasownik.<br><i>Voy a comer</i> – zamierzam zjeść · <i>Vamos a viajar</i> – będziemy podróżować · <i>¿Qué vas a hacer?</i> – co będziesz robić?",mnemo:"Schemat na blachę: <b>[forma ir] + a + bezokolicznik</b>. Zawsze jest 'a'!"},
      {title:"Z określeniami czasu",body:"<b>mañana</b> – jutro · <b>esta tarde</b> – dziś po południu · <b>este fin de semana</b> – w ten weekend · <b>el año que viene</b> – w przyszłym roku.<br><i>Mañana voy a estudiar.</i> · <i>Este verano vamos a viajar a España.</i>",real:"To najprostszy sposób mówienia o przyszłości na A1 — nie musisz znać czasu przyszłego (futuro)."}
     ],
     flashcards:[
      {t:"ir a + bezokolicznik",d:"zamierzać / bliska przyszłość"},{t:"Voy a comer",d:"zamierzam zjeść"},{t:"¿Qué vas a hacer?",d:"co będziesz robić?"},
      {t:"Vamos a viajar",d:"będziemy podróżować"},{t:"mañana",d:"jutro"},{t:"esta tarde",d:"dziś po południu"},
      {t:"este fin de semana",d:"w ten weekend"},{t:"el año que viene",d:"w przyszłym roku"}
     ],
     quiz:[
      {q:"„Zamierzam zjeść” to:",a:["Voy comer","Voy a comer","Voy a como","Como a ir"],c:1,e:"ir + A + bezokolicznik: voy a comer."},
      {q:"Czego ZAWSZE potrzeba w tej konstrukcji?",a:["przyimka 'a'","rodzajnika","zaimka zwrotnego","przeczenia"],c:0,e:"[ir] + a + bezokolicznik — 'a' jest obowiązkowe."},
      {q:"„Co będziesz robić jutro?”",a:["¿Qué haces mañana a?","¿Qué vas a hacer mañana?","¿Qué vas hacer?","¿Qué ir a hacer?"],c:1,e:"¿Qué vas a hacer? + mañana."},
      {q:"„Będziemy podróżować” (nosotros):",a:["Van a viajar","Vamos a viajar","Vais a viajar","Voy a viajar"],c:1,e:"nosotros → vamos a viajar."}
     ]},
    {id:"n7",title:"🆕 Podróże (hotel / lotnisko)",emoji:"✈️",
     feed:[
      {title:"Słownictwo podróżne",body:"el aeropuerto – lotnisko · el vuelo – lot · la maleta – walizka · el billete – bilet · el pasaporte – paszport · la estación – dworzec · el tren – pociąg · el hotel – hotel · la habitación – pokój · la llave – klucz · la reserva – rezerwacja",mnemo:"billete = bilet (podobne!), maleta = walizka, llave = klucz."},
      {title:"Dialogi: hotel i lotnisko",body:"<b>Hotel:</b> Tengo una reserva – mam rezerwację · Quería una habitación doble/individual – pokój 2-os./1-os. · ¿A qué hora es el desayuno? – o której śniadanie?<br><b>Lotnisko:</b> ¿Dónde está la puerta de embarque? – gdzie jest bramka? · facturar el equipaje – nadać bagaż · El vuelo sale a las… – lot odlatuje o…",real:"habitación doble = dwuosobowy, individual = jednoosobowy. 'una reserva a nombre de…' = rezerwacja na nazwisko…"}
     ],
     flashcards:[
      {t:"el aeropuerto",d:"lotnisko"},{t:"el vuelo",d:"lot"},{t:"la maleta",d:"walizka"},{t:"el billete",d:"bilet"},
      {t:"el pasaporte",d:"paszport"},{t:"la habitación",d:"pokój"},{t:"la reserva",d:"rezerwacja"},{t:"la llave",d:"klucz"},
      {t:"habitación doble",d:"pokój dwuosobowy"},{t:"habitación individual",d:"pokój jednoosobowy"},{t:"¿A qué hora es el desayuno?",d:"o której śniadanie?"}
     ],
     quiz:[
      {q:"„walizka” to:",a:["el billete","la maleta","la llave","el vuelo"],c:1,e:"maleta = walizka; billete = bilet."},
      {q:"W hotelu poprosisz o pokój 1-osobowy:",a:["habitación doble","habitación individual","habitación grande","habitación libre"],c:1,e:"individual = jednoosobowy; doble = dwuosobowy."},
      {q:"„Mam rezerwację” to:",a:["Quería una habitación","Tengo una reserva","¿A qué hora?","Voy a viajar"],c:1,e:"Tengo una reserva (a nombre de…)."},
      {q:"„el vuelo” znaczy:",a:["dworzec","lot","paszport","klucz"],c:1,e:"vuelo = lot (samolotem)."}
     ]}
  ]
});
