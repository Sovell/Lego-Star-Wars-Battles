import { useEffect, useMemo, useState } from "react";
import { createPersistenceAdapter } from "../../core/persistence/create-persistence-adapter";
import type {
  SavedBattle,
  SavedBattleSummary,
} from "../../core/persistence/save-types";
import { LanguageSwitcher, useI18n } from "../../i18n";

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
  const { text } = useI18n();
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
      setStatus(error instanceof Error ? error.message : text("Nie udało się odczytać zapisów.", "Could not read saved games."));
    }
  }

  async function handleLoad() {
    if (!selectedSaveId) {
      setStatus(text("Wybierz zapis gry.", "Select a saved game."));
      return;
    }

    try {
      const savedBattle = await persistence.loadBattle(selectedSaveId);
      if (!savedBattle) {
        setStatus(text("Wybrany zapis już nie istnieje.", "The selected save no longer exists."));
        await refreshSaves();
        return;
      }
      onLoadBattle(savedBattle);
    } catch (error) {
      setStatus(error instanceof Error ? error.message : text("Nie udało się wczytać gry.", "Could not load the game."));
    }
  }

  return (
    <section className="mainMenu">
      <LanguageSwitcher />
      <section className="mainMenuHero">
        <p className="eyebrow">LEGO Star Wars Battles</p>
        <h1>{text("Dowodzenie zaczyna się tutaj", "Command begins here")}</h1>
        <p>
          {text(
            "Zbuduj pole walki, wybierz armie i scenariusz, a następnie przejdź do właściwego interfejsu bitwy.",
            "Build a battlefield, choose armies and a scenario, then enter the command interface.",
          )}
        </p>
      </section>

      <section className="mainMenuGrid">
        {onResumeBattle ? (
          <button className="menuCard menuCardResume" onClick={onResumeBattle}>
            <span>{text("W toku", "In progress")}</span>
            <strong>{text("Wróć do bieżącej bitwy", "Return to current battle")}</strong>
            <small>{text("Rozgrywka pozostaje otwarta w pamięci aplikacji.", "The battle remains open in application memory.")}</small>
          </button>
        ) : null}
        <button className="menuCard menuCardPrimary" onClick={onNewScenario}>
          <span>{text("Nowa rozgrywka", "New game")}</span>
          <strong>{text("Rozegraj nowy scenariusz", "Play a new scenario")}</strong>
          <small>{text("Mapa → scenariusz → armie → rozmieszczenie → start", "Map → scenario → armies → deployment → start")}</small>
        </button>

        <button className="menuCard" onClick={onOpenComposer}>
          <span>{text("Armie", "Armies")}</span>
          <strong>{text("Kreator armii", "Army Composer")}</strong>
          <small>{text("Zbuduj składy, które później wybierzesz w kreatorze scenariusza.", "Build rosters to use later in the scenario builder.")}</small>
        </button>

        <button className="menuCard" onClick={onOpenRules}>
          <span>{text("Kompendium", "Compendium")}</span>
          <strong>{text("Zasady i jednostki", "Rules and units")}</strong>
          <small>{text("Statystyki, zdolności, teren i zespoły uderzeniowe.", "Stats, abilities, terrain, and task forces.")}</small>
        </button>

        <section className="menuLoadCard">
          <div>
            <span>{text("Kontynuuj", "Continue")}</span>
            <strong>{text("Wczytaj grę", "Load game")}</strong>
          </div>
          <select
            value={selectedSaveId}
            onChange={(event) => setSelectedSaveId(event.target.value)}
          >
            <option value="">{text("Wybierz zapis", "Select save")}</option>
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
            {text("Kontynuuj bitwę", "Continue battle")}
          </button>
          {savedBattles.length === 0 ? (
            <small>{text("Brak lokalnych zapisów.", "No local saves.")}</small>
          ) : null}
          {status ? <p className="errorText">{status}</p> : null}
        </section>
      </section>
    </section>
  );
}
