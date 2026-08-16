# LEGO Star Wars Battles — krótka instrukcja gracza

> Instrukcja dotyczy obecnej wersji rozwojowej gry. Interfejs można przełączyć między językiem polskim i angielskim.

## 1. Cel gry

Dowodzisz jedną lub kilkoma armiami na polu bitwy. Dokładny cel zależy od wybranej misji lub scenariusza: może nim być przetrwanie określonej liczby rund, obrona punktu, zniszczenie generatorów, kontrola terytorium albo uratowanie zakładników.

Aktualny cel, limit rund, wynik oraz uczestników zawsze znajdziesz w panelu **Przebieg bitwy** po prawej stronie.

## 2. Rozpoczęcie gry

W menu wybierz **Rozegraj nowy scenariusz**. Następnie zdecyduj, z którego trybu chcesz skorzystać:

- **Rozegraj misję** — gotowa mapa, wydarzenia fabularne i ustawienia. W części misji możesz zachować własne armie albo wczytać rekomendowany skład.
- **Stwórz scenariusz** — sam wybierasz zasady, motyw mapy, jej rozmiar, armie i wydarzenia.

Przy własnym scenariuszu możesz:

1. Wybrać mapę standardową **8 × 8** lub podwójną **16 × 16**.
2. Wybrać motyw pola bitwy i wygenerować mapę. Ten sam seed zawsze odtworzy ten sam układ.
3. Skonfigurować od 2 do 4 armii.
4. Przypisać każdej armii **Team 1** albo **Team 2** oraz sterowanie **Gracz** lub **Bot**.
5. Ustawić strefy wejścia, teren, obiekty i początkowe pozycje jednostek.

Jeden bohater może wystąpić tylko raz w całej bitwie — również wtedy, gdy dwie armie należą do tej samej drużyny.

Po przygotowaniu ustawień wybierz **Rozegraj misję** albo **Rozegraj scenariusz**. Gra automatycznie utworzy zapis początkowy.

## 3. Rozmieszczenie i rezerwy

Jednostki ustawione przed rozpoczęciem bitwy zaczynają na mapie. Jednostki pozostawione poza mapą trafiają do **rezerwy**.

Aby wprowadzić jednostkę z rezerwy podczas bitwy:

1. Wylosuj rozkaz dla jej armii.
2. Wybierz jednostkę z listy.
3. Wybierz **Ruch** albo **Natarcie** i kliknij **Wskaż wejście**.
4. Kliknij podświetlone, wolne pole w strefie wejścia tej armii.

Wprowadzenie jednostki z rezerwy zużywa jej aktywację. Jeśli wszystkie pola wejścia są zajęte, musisz najpierw zwolnić jedno z nich.

## 4. Runda i aktywacje

Na początku rundy worek aktywacji zawiera rozkazy wszystkich żywych jednostek, ale maksymalnie **8 rozkazów na każdą armię**.

Przebieg aktywacji:

1. Kliknij **Losuj rozkaz**.
2. Gra losuje armię, która otrzymuje aktywację.
3. Wybierz gotową jednostkę należącą do tej armii.
4. Wydaj jej jeden rozkaz lub użyj aktywnej zdolności.
5. Losuj kolejny rozkaz. Po wykorzystaniu całego worka zakończ rundę.

Jeżeli armia ma więcej niż 8 jednostek, część z nich nie otrzyma rozkazu w danej rundzie. Bot wykonuje swoją aktywację automatycznie.

## 5. Dostępne rozkazy

- **Ruch** — przemieść jednostkę w granicach jej MOV. Po ruchu aktywacja się kończy.
- **Natarcie** — przemieść jednostkę, a następnie zaatakuj. Jeżeli nie chcesz lub nie możesz atakować, wybierz **Zakończ Natarcie**.
- **Atak** — pozostań na miejscu, wybierz broń i legalny cel, a następnie kliknij **Atakuj**.
- **Odwrót (Rally)** — usuń do 2 punktów SUP i zakończ aktywację. To jedyny rozkaz dostępny jednostce przygwożdżonej.
- **Ogień zaporowy (Overwatch)** — utrzymaj pozycję i zakończ aktywację; pozwala bezpiecznie wykorzystać rozkaz, gdy jednostka nie ma dobrego celu lub ruchu.
- **Zdolność** — rozwiń sekcję zdolności, wybierz umiejętność oraz wymagany cel. Skrót **CD** oznacza liczbę rund do ponownego użycia.

Po pokonaniu przeciwnika podczas Natarcia możesz otrzymać możliwość zajęcia zwolnionego przez niego pola.

## 6. Atak i suppression

Profil broni ma trzy podstawowe wartości:

- **R / RNG** — zasięg,
- **A / ATK** — liczba kości ataku,
- **D / DMG** — obrażenia za nieobronione trafienie.

Atak wymaga odpowiedniego zasięgu i linii widzenia. Osłona celu utrudnia trafienie, a wysoki teren pomaga atakującemu. Rzut pancerza **SV** może anulować trafienie.

Skuteczny ostrzał może dodać jednostce **SUP**. Suppression utrudnia trafianie, a po osiągnięciu wartości morale **MOR** jednostka zostaje **przygwożdżona**. Przygwożdżona jednostka nie może nacierać ani atakować — musi wykonać Odwrót (Rally).

## 7. Teren — szybka ściąga

| Typ terenu | Efekt |
|---|---|
| Otwarty | Bez dodatkowych modyfikatorów |
| Lekka osłona | +1 do obrony |
| Ciężka osłona | +2 do obrony, koszt ruchu 2 |
| Budynek | +2 do obrony, koszt ruchu 2, blokuje linię widzenia |
| Trudny | Koszt ruchu 2 |
| Niedostępny | Nie można wejść, blokuje linię widzenia |
| Niebezpieczny | Koszt ruchu 2, wejście daje 1 SUP |
| Wysoki | +1 do ataku, koszt ruchu 2 |

Pełne statystyki jednostek, broni, zdolności i terenu znajdziesz w menu **Zasady i jednostki**. Opis pasywnej zdolności na karcie jednostki pojawia się po najechaniu na jej nazwę.

## 8. Obsługa mapy i paneli

- Kliknij token, aby wybrać jednostkę i otworzyć jej kartę po lewej stronie.
- Użyj kółka myszy, aby przybliżać mapę pod kursorem.
- Przytrzymaj środkowy przycisk myszy, aby przesuwać mapę.
- Zielone podświetlenie oznacza legalne pola ruchu lub wejścia.
- Panel **Dzienniki i jednostki** pokazuje historię zdarzeń oraz stan wszystkich oddziałów.

## 9. Zapisy gry

- Przy starcie misji lub scenariusza powstaje automatyczny zapis początkowy.
- W trakcie bitwy rozwiń **Zapis bitwy**, nadaj zapisowi nazwę i wybierz **Zapisz bitwę**.
- Zapis można wczytać zarówno podczas gry, jak i z menu głównego.
- Aplikacja próbuje również przywrócić przerwaną, niezapisaną sesję.

Zapisy są przechowywane lokalnie na danym komputerze i w danej przeglądarce. Wersja internetowa nie synchronizuje ich jeszcze między urządzeniami.

## 10. Gdy nie możesz wykonać ruchu

Najczęstsze przyczyny zablokowanej akcji:

- wylosowany rozkaz należy do innej armii,
- wybrana jednostka była już aktywowana,
- jednostka jest przygwożdżona i może wykonać wyłącznie Odwrót,
- pole jest zajęte, niedostępne albo znajduje się poza zasięgiem ruchu,
- rezerwa próbuje wejść poza własną strefą,
- cel znajduje się poza zasięgiem broni lub bez linii widzenia,
- rozpoczęte Natarcie nie zostało jeszcze zakończone.

W takiej sytuacji zajrzyj do dziennika bitwy — pojawi się tam dokładna przyczyna odrzucenia akcji.

---

**Najkrótsza wersja:** wybierz misję, przygotuj armie, uruchom bitwę, losuj rozkazy i wykonuj nimi akcje jednostek właściwej armii. Cel misji jest zawsze widoczny po prawej stronie.
