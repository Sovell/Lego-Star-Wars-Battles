import { useEffect, useMemo, useState } from "react";
import { createPersistenceAdapter } from "../../core/persistence/create-persistence-adapter";
import type {
  SavedBattle,
  SavedBattleSummary,
} from "../../core/persistence/save-types";

export function MainMenu({
  onLoadBattle,
  onNewScenario,
  onOpenComposer,
  onOpenRules,
  onResumeBattle,
}: {
  onLoadBattle: (savedBattle: SavedBattle) => void;
  onNewScenario: () => void;
  onOpenComposer: () => void;
  onOpenRules: () => void;
  onResumeBattle?: () => void;
}) {
  const persistence = useMemo(() => createPersistenceAdapter(), []);
  const [savedBattles, setSavedBattles] = useState<SavedBattleSummary[]>([]);
  const [selectedSaveId, setSelectedSaveId] = useState("");
  const [status, setStatus] = useState("");

  useEffect(() => {
    void refreshSaves();
  }, []);

  async function refreshSaves() {
    try {
      const saves = await persistence.listBattles();
      setSavedBattles(saves);
      setSelectedSaveId((current) => current || saves[0]?.id || "");
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się odczytać zapisów.");
    }
  }

  async function handleLoad() {
    if (!selectedSaveId) {
      setStatus("Wybierz zapis gry.");
      return;
    }

    try {
      const savedBattle = await persistence.loadBattle(selectedSaveId);
      if (!savedBattle) {
        setStatus("Wybrany zapis już nie istnieje.");
        await refreshSaves();
        return;
      }
      onLoadBattle(savedBattle);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : "Nie udało się wczytać gry.");
    }
  }

  return (
    <section className="mainMenu">
      <section className="mainMenuHero">
        <p className="eyebrow">LEGO Star Wars Battles</p>
        <h1>Dowodzenie zaczyna się tutaj</h1>
        <p>
          Zbuduj pole walki, wybierz armie i scenariusz, a następnie przejdź do
          właściwego interfejsu bitwy.
        </p>
      </section>

      <section className="mainMenuGrid">
        {onResumeBattle ? (
          <button className="menuCard menuCardResume" onClick={onResumeBattle}>
            <span>W toku</span>
            <strong>Wróć do bieżącej bitwy</strong>
            <small>Rozgrywka pozostaje otwarta w pamięci aplikacji.</small>
          </button>
        ) : null}
        <button className="menuCard menuCardPrimary" onClick={onNewScenario}>
          <span>Nowa rozgrywka</span>
          <strong>Rozegraj nowy scenariusz</strong>
          <small>Mapa → scenariusz → armie → rozmieszczenie → start</small>
        </button>

        <button className="menuCard" onClick={onOpenComposer}>
          <span>Armie</span>
          <strong>Army Composer</strong>
          <small>Zbuduj składy, które później wybierzesz w kreatorze scenariusza.</small>
        </button>

        <button className="menuCard" onClick={onOpenRules}>
          <span>Kompendium</span>
          <strong>Zasady i jednostki</strong>
          <small>Statystyki, zdolności, teren i task force.</small>
        </button>

        <section className="menuLoadCard">
          <div>
            <span>Kontynuuj</span>
            <strong>Wczytaj grę</strong>
          </div>
          <select
            value={selectedSaveId}
            onChange={(event) => setSelectedSaveId(event.target.value)}
          >
            <option value="">Wybierz zapis</option>
            {savedBattles.map((savedBattle) => (
              <option key={savedBattle.id} value={savedBattle.id}>
                {savedBattle.name} | T{savedBattle.turn}
              </option>
            ))}
          </select>
          <button
            className="primaryButton"
            disabled={!selectedSaveId}
            onClick={handleLoad}
          >
            Kontynuuj bitwę
          </button>
          {savedBattles.length === 0 ? (
            <small>Brak lokalnych zapisów.</small>
          ) : null}
          {status ? <p className="errorText">{status}</p> : null}
        </section>
      </section>
    </section>
  );
}
