# Lego Star Wars Battles — wskazówki dla agentów

## Struktura repozytorium

- `src/app/` — ekrany React, komponenty i style interfejsu.
- `src/app/battle/` — powłoka bitwy i jej panele; układa istniejące dane i akcje.
- `src/battlefield/` — widok pola bitwy, kamera oraz integracja PixiJS.
- `src/core/` — mechanika, reguły, scenariusze, AI i persystencja.
- `src/presentation/` — profile i assety warstwy prezentacji.
- `src/simulation/` — symulacje bez interfejsu.
- `docs/` — dokumentacja produktu i implementacji.

## Komendy

- `npm run dev` — aplikacja webowa w trybie deweloperskim.
- `npm run tauri:dev` — aplikacja desktopowa Tauri.
- `npm test` — pełny zestaw testów Vitest.
- `npm run build` — TypeScript i produkcyjny build Vite.

## Zasady zmian UI

- Zadanie oznaczone jako UI nie upoważnia do zmiany mechaniki, legalnych akcji, danych ani kolejności gry.
- Zachowuj interakcje PixiJS, przepływ stanu oraz istniejące callbacki i ich semantykę.
- Po zmianach sprawdź odpowiednie stany aplikacji wizualnie, w tym klawiaturę i `focus-visible`, oraz uruchom testy i build.
- Wprowadzaj małe, logiczne zmiany, które można niezależnie zweryfikować i zreviewować.
- Nie dodawaj ciężkiego frameworka UI bez wyraźnej, udokumentowanej potrzeby.
- Makiety są kierunkiem wizualnym; interfejs może pokazywać tylko stan i akcje rzeczywiście obsługiwane przez grę.
