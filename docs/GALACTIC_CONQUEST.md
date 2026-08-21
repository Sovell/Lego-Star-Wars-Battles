# Galactic Conquest — warstwa kampanii

## Założenie

Galactic Conquest łączy mapę strategiczną z istniejącym generatorem bitew. Gracz przemieszcza armie między połączonymi planetami, zdobywa sektory, otrzymuje zasoby i produkuje jednostki. Próba wejścia do bronionego sektora tworzy zwykłą bitwę taktyczną na właściwym motywie mapy.

Pierwsza pula obejmuje dziewięć światów, dla których gra ma już teren: Tatooine, Endor, Hoth, Mustafar, Geonosis, Felucia, Christophsis, Mandalore i Ryloth. Okręt Republiki, okręt Separatystów i stacja badawcza pozostają specjalnymi teatrami wydarzeń, a nie stałymi planetami.

Katalog zawiera też przygaszone, niedostępne jeszcze lokalizacje: Coruscant, Raxus Secundus, Kamino, Naboo, Kashyyyk i Utapau. Coruscant oraz Raxus Secundus są już oznaczone jako przyszłe stolice Republiki i Separatystów, ale nie trafiają jeszcze do grywalnego stanu kampanii.

## Definicje galaktyki i stan kampanii

Statyczne definicje planet, sektorów oraz hiperlinii są oddzielone od zmiennego `CampaignState`. Pozycja planety służy wyłącznie do renderowania. Ruch strategiczny będzie liczony po jawnej liście `galacticHyperlanes`, w której każda trasa ma własny koszt.

`CampaignUnit` przechowuje tylko trwałą tożsamość i identyfikator szablonu. HP, suppression, pozycja, status aktywacji oraz efekty pozostają wyłącznie w stanie konkretnej bitwy. Granica integracji ma postać:

`CampaignState → BattleRequest → Battle → BattleOutcome → CampaignState`

## Sektory

Każda planeta ma dokładnie trzy aktywne sektory (w starszym module generatora nadal nazwane prowincjami):

1. jeden stały, charakterystyczny dla planety, np. Lessu albo główna fabryka Geonosis;
2. dwa wybierane deterministycznie z puli czterech wariantów na podstawie ziarna kampanii.

Dzięki temu strategiczna tożsamość planety pozostaje czytelna, ale kolejne kampanie mają inne zasoby i typy bitew. `CampaignSectorState` przechowuje kontrolującą frakcję, dowódcę oraz poziom umocnień.

Typ sektora wyznacza domyślny archetyp bitwy:

- stolica lub osada — obrona punktu albo kontrola sektorów;
- przemysł — niszczenie generatorów;
- ośrodek badawczy — kolejne punkty danych;
- dzicz — przetrwanie i ewakuacja;
- sektor orbitalny — walka o sektory lub specjalne zdarzenie abordażowe.

## Zaimplementowany Campaign Core

- kampanie 1v1 oraz 2v2, zawsze z równą liczbą dowódców obu frakcji;
- osobne kredyty i armie każdego gracza oraz frakcyjna kontrola sektorów;
- deterministyczny wybór trzech sektorów każdej z dziewięciu planet;
- jedna startowa armia na dowódcę, bez jakiegokolwiek stanu taktycznego;
- pula nazwanych bohaterów z trzema życiami łącznie, poziomem, XP i terminem dostępności;
- parametry kampanii: 3 punkty ruchu, limit armii 150 pkt. i jeden bohater na armię.
- ruch po jawnych hiperliniach z deterministycznym wyborem najtańszej trasy;
- zatrzymanie na planecie z wrogą armią, bazą albo oboma naraz;
- naprzemienne aktywacje dowódców, jedna aktywacja każdej armii na turę;
- przejście do fazy rozstrzygnięcia po wykorzystaniu armii oraz reset ruchu w następnej turze.
- trzy funkcjonalne role sektorów: desantowy, infrastruktury i dowodzenia;
- strategiczne zajęcie niebronionego sektora oraz konflikt dla armii, bazy i sektora dowodzenia;
- przyczółki pozwalające przegranej armii pozostać na atakowanej planecie;
- odwrót na planetę startową bez przyczółka oraz odwrót pokonanego obrońcy;
- zniszczenie odciętej armii, która nie ma własnego sektora ani sąsiedniej drogi odwrotu;
- blokada sektora dowodzenia stolicy do czasu zdobycia dwóch pozostałych sektorów;
- zakończenie kampanii po przejęciu wszystkich sektorów wrogiej stolicy.
- dochód 2–4 kredyty z każdego kontrolowanego sektora i +2 za pełną planetę;
- stypendium +5 kredytów dla każdego dowódcy frakcji kontrolującej swoją stolicę;
- jedna baza na w pełni kontrolowanej planecie: budowa poziomu 1 za 20 kredytów, poziom 2 za 40 i poziom 3 za 60;
- ukończenie budowy, ulepszeń i rekrutacji na początku następnej tury;
- poziom 1 dla podstawowej piechoty, poziom 2 dla wsparcia, elit, dowódców i bohaterów oraz poziom 3 dla pojazdów i jednostek ciężkich;
- rezerwy planetarne, z których można stworzyć nową armię albo uzupełnić istniejącą;
- kontrola limitu 150 pkt. i maksymalnie jednego nazwanego bohatera w armii.
- deterministyczny `CampaignBattleRequest` zawierający planetę, sektor, motyw, scenariusz, fortyfikacje i powiązania jednostek;
- translacja armii strategicznych do zwykłych `Army`/`UnitInstance` używanych przez obecny silnik;
- automatyczna mapa 8×8 oraz scenariusz odpowiadający archetypowi sektora;
- garnizony baz i sektorów dowodzenia istniejące wyłącznie na czas konkretnej bitwy;
- `CampaignBattleOutcome` usuwający tylko zniszczone jednostki pochodzące z kampanii;
- pełne odtworzenie HP i suppression ocalałych przed następnym starciem;
- utrata jednego z trzech żyć bohatera, jedna pełna tura niedostępności i permanentna eliminacja przy 0 życia;
- zastosowanie wyniku bitwy do kontroli sektora, przyczółka, odwrotu i zwycięstwa w kampanii.

## Docelowa pętla rundy strategicznej

1. Dochód, ukończenie rekrutacji i budów oraz powrót dostępnych bohaterów.
2. Ustalenie inicjatywy.
3. Naprzemienne aktywacje pojedynczych armii wszystkich graczy.
4. Ruch, atak sektora albo fortyfikacja jako jedna aktywacja armii.
5. Rozegranie powstałych bitew i zastosowanie ich trwałych wyników.
6. Kontrola planet oraz sprawdzenie warunku zwycięstwa.

## Połączenie z generatorem bitew

Docelowy `BattleRequest` przekaże generatorowi planetę i sektor, deterministyczne ziarno, armie uczestników, archetyp scenariusza, teren oraz poziom fortyfikacji. Po bitwie `BattleOutcome` zwróci zwycięzcę, zniszczone jednostki i bohaterów oraz wynik celu.

Campaign Core zdecyduje wtedy o przejęciu sektora, odjęciu życia bohaterowi i odwrocie przegranej armii. Ta odpowiedzialność nie trafi do silnika scenariuszy.

## Kolejność dalszego wdrożenia

1. Zapis pełnego `CampaignState` bez zmiany globalnej wersji schematu.
2. Ekran kampanii oraz klockowa mapa PixiJS.
