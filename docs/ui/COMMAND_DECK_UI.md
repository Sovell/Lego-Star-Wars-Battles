# Modular Command Deck

## Cel redesignu

„Modular Command Deck” ma nadać interfejsowi charakter taktycznej konsoli dowodzenia: fizycznej jak matowe elementy LEGO i czytelnej jak wojskowe systemy Star Wars. Redesign powinien wzmacniać hierarchię, ergonomię i rozpoznawalność stanu bez zmiany mechaniki gry.

## Rola makiety referencyjnej

Makieta określa kierunek wizualny, gęstość i kompozycję. Nie jest specyfikacją funkcjonalną ani źródłem danych. Element widoczny na makiecie może trafić do aplikacji tylko wtedy, gdy istniejący model gry i ekran już obsługują odpowiadający mu stan lub akcję. Makiety nie wolno używać jako tła, osadzonego obrazu ani gotowej warstwy interfejsu.

## Hierarchia ekranów

1. Menu główne prowadzi do istniejących trybów i zapisów; pozostaje spokojniejszą bramą do systemu.
2. Przygotowanie bitwy eksponuje mapę, narzędzia rozmieszczenia i konfigurację scenariusza.
3. Trwająca bitwa stawia mapę na pierwszym planie, a obok pokazuje bieżący kontekst jednostki, legalne akcje, stan misji i log.
4. Podsumowania, kreatory, kompendium i kampania dziedziczą wspólne tokeny, lecz zachowują własną hierarchię zadań.

Mapa pozostaje centrum ekranu bitwy. Panele otaczające mapę mają ujawniać istniejący kontekst, nie tworzyć nowych etapów sterowania.

## Paleta

- Tło: niemal czarny grafit.
- Powierzchnie: trzy stopnie ciemnego gunmetalu, od zagłębionych pól po podniesione moduły.
- Tekst: chłodna biel dla treści głównej i stalowy szary dla pomocniczej.
- Republika: techniczny błękit/cyjan jako akcent stanu.
- Separatyści: czerwono-pomarańczowy jako akcent stanu.
- Akcja główna: żółty, używany oszczędnie i tylko dla najważniejszej akcji w danym kontekście.
- Semantyka: osobne kolory błędu, ostrzeżenia i sukcesu; akcenty frakcji nie zastępują komunikatów semantycznych.

Kontrast tekstu i stanów interaktywnych musi pozostać czytelny na wszystkich poziomach powierzchni.

## Geometria i materiały

- Dominują proste moduły, cienkie ramki, separatory i płytkie insety.
- Materiał przypomina matowy ABS i lakierowany metal; szkło, rozmycie tła i połysk są wyjątkami.
- Promienie są małe. Ścięte narożniki mogą sygnalizować moduł lub kontrolkę, ale nie mogą pogarszać obszaru kliknięcia ani fokusu.
- Duże, miękko zaokrąglone karty i kapsułki stosujemy tylko tam, gdzie ich znaczenie jest utrwalone przez istniejący interfejs.
- Gradienty są rzadkie, krótkie i funkcjonalne. Głębię budują przede wszystkim różnice powierzchni, insety i twarde cienie.
- Study LEGO pojawiają się wyłącznie jako oszczędne punkty mocowania lub śruby, nigdy jako powtarzalny ornament konkurujący z informacją.

## LEGO a Star Wars

LEGO odpowiada za fizyczność: skalę modułów, matowy ABS, łączenia, study-mocowania i wrażenie składanej konsoli. Star Wars odpowiada za informację: typografię systemową, rytm etykiet, separatory, akcenty frakcji, sygnały stanu i wojskową zwięzłość. Dekoracja LEGO nie może kodować danych, a język informacyjny nie może sugerować nieistniejącej mechaniki.

## Zasady wdrażania

- Najpierw używaj tokenów z `src/app/styles/ui-tokens.css`; lokalne wartości dodawaj tylko dla rzeczywiście lokalnych wyjątków.
- Zachowuj układ, callbacki, stan React i interakcje PixiJS, dopóki etap zadania nie zezwala na ich zmianę.
- Każdy etap kończ testami, buildem i wizualnym sprawdzeniem przygotowania, aktywnej bitwy oraz obsługi klawiatury.
- Nie pobieraj fontów z CDN. Font dołączony do aplikacji musi działać offline w Tauri i mieć zgodną licencję; systemowy fallback jest rozwiązaniem domyślnym.
