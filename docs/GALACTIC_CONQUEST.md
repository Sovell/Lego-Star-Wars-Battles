# Galactic Conquest — fundament trybu strategicznego

## Założenie

Galactic Conquest łączy mapę strategiczną z istniejącym generatorem bitew. Gracz przemieszcza armie między połączonymi planetami, zdobywa prowincje, otrzymuje zasoby i produkuje jednostki. Próba wejścia do wrogiej prowincji tworzy zwykłą bitwę taktyczną na właściwym motywie mapy.

Pierwsza wersja obejmuje dziewięć ciał niebieskich, dla których gra ma już teren: Tatooine, Endor, Hoth, Mustafar, Geonosis, Felucia, Christophsis, Mandalore i Ryloth. Okręt Republiki, okręt Separatystów i stacja badawcza są specjalnymi teatrami wydarzeń, a nie stałymi planetami.

## Prowincje

Każda planeta ma dokładnie trzy aktywne prowincje:

1. jedną stałą, charakterystyczną dla planety, np. Lessu albo główną fabrykę Geonosis;
2. dwie wybierane deterministycznie z puli czterech wariantów na podstawie ziarna kampanii.

Dzięki temu strategiczna tożsamość planety pozostaje czytelna, ale kolejne kampanie mają inne szlaki, zasoby i typy bitew. Prowincja przechowuje kontrolę, dochód, produkcję, poziom umocnień, budynki oraz kolejkę rekrutacji.

Typ prowincji wyznacza domyślny archetyp bitwy:

- stolica lub osada — obrona punktu albo kontrola sektorów;
- przemysł — niszczenie generatorów;
- ośrodek badawczy — kolejne punkty danych;
- dzicz — przetrwanie i ewakuacja;
- prowincja orbitalna — walka o sektory lub specjalne zdarzenie abordażowe.

## Pętla rundy strategicznej

1. Faza dochodu: kontrolowane prowincje dostarczają kredyty i produkcję.
2. Faza budowy: frakcja stawia koszary, fabryki, szpitale i sensory.
3. Faza rekrutacji: gotowe jednostki trafiają do armii w prowincji.
4. Faza ruchu: armie poruszają się do sąsiedniej prowincji lub sąsiedniej planety.
5. Faza bitew: każdy sporny obszar generuje scenariusz taktyczny.
6. Faza kontroli: wynik bitwy zmienia właściciela, straty armii i poziom zniszczeń.
7. Faza wydarzeń: może pojawić się abordaż, blokada, bohater albo misja ratunkowa.

## Połączenie z generatorem bitew

`createProvinceBattleRequest` przekazuje generatorowi:

- motyw mapy planety;
- deterministyczne ziarno bitwy;
- stronę atakującą i właściciela prowincji;
- archetyp scenariusza wynikający z prowincji;
- poziom fortyfikacji.

Następny etap powinien tłumaczyć ten kontrakt na pełny `ScenarioDefinition`, skalować punkty armii według budynków i strat, a po bitwie przyjmować raport zawierający zwycięzcę oraz ocalałe jednostki.

## Proponowany pierwszy grywalny wycinek

- dwie frakcje i po jednej armii startowej;
- trzy planety: Ryloth, Geonosis i Christophsis;
- dochód, ruch, jedna kolejka rekrutacji i przejęcie prowincji;
- ręczne rozegranie wygenerowanej bitwy;
- powrót wyniku do mapy strategicznej;
- zapis całego stanu kampanii.

Po sprawdzeniu tej pętli można rozszerzyć mapę do dziewięciu planet, dodać floty, bohaterów przemieszczających się między armiami, blokady orbitalne i wydarzenia na okrętach.
