import { useEffect, useMemo, useState } from "react";
import { createPersistenceAdapter } from "../../core/persistence/create-persistence-adapter";
import type {
  SavedBattle,
  SavedBattleSummary,
} from "../../core/persistence/save-types";
import { LanguageSwitcher, useI18n } from "../../i18n";

export function MainMenu({
  onLoadBattle,
  onOpenCampaign,
  onNewScenario,
  onOpenComposer,
  onOpenRules,
  onResumeBattle,
  status: externalStatus,
}: {
  onLoadBattle: (savedBattle: SavedBattle) => void;
  onOpenCampaign: () => void;
  onNewScenario: () => void;
  onOpenComposer: () => void;
  onOpenRules: () => void;
  onResumeBattle?: () => void;
  status?: string;
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
    <section className="mainMenu commandDeckHome">
      <LanguageSwitcher />
      <section className="mainMenuHero">
        <div className="mainMenuSignal" aria-hidden="true">
          <span />
          <span />
          <span />
        </div>
        <p className="eyebrow">LEGO Star Wars Battles · Command Deck</p>
        <h1>{text("Dowodzenie zaczyna się tutaj", "Command begins here")}</h1>
        <p>
          {text(
            "Zbuduj pole walki, wybierz armie i scenariusz, a następnie przejdź do właściwego interfejsu bitwy.",
            "Build a battlefield, choose armies and a scenario, then enter the command interface.",
          )}
        </p>
      </section>

      <section className="mainMenuOperations" aria-label={text("Rozpoczęcie operacji", "Start operation")}>
        <div className="mainMenuLaunchBay">
          <div className="menuSectionLabel">
            <span>01</span>
            <div>
              <p className="eyebrow">{text("Operacje", "Operations")}</p>
              <strong>{text("Wybierz punkt wejścia", "Choose an entry point")}</strong>
            </div>
          </div>

          <div className="mainMenuPrimaryActions">
            <button className="menuCard menuCardPrimary" onClick={onNewScenario}>
              <span>{text("Nowa rozgrywka", "New game")}</span>
              <strong>{text("Rozegraj nowy scenariusz", "Play a new scenario")}</strong>
              <small>{text("Mapa → scenariusz → armie → rozmieszczenie → start", "Map → scenario → armies → deployment → start")}</small>
              <b aria-hidden="true">→</b>
            </button>

            {onResumeBattle ? (
              <button className="menuCard menuCardResume" onClick={onResumeBattle}>
                <span>{text("Operacja w toku", "Operation in progress")}</span>
                <strong>{text("Wróć do bieżącej bitwy", "Return to current battle")}</strong>
                <small>{text("Rozgrywka pozostaje otwarta w pamięci aplikacji.", "The battle remains open in application memory.")}</small>
                <b aria-hidden="true">→</b>
              </button>
            ) : null}
          </div>

          <section className="menuLoadCard">
            <div className="menuLoadHeader">
              <div>
                <span>{text("Kontynuuj", "Continue")}</span>
                <strong>{text("Wczytaj zapis operacji", "Load operation save")}</strong>
              </div>
              <small>{savedBattles.length.toString().padStart(2, "0")}</small>
            </div>
            <label htmlFor="battle-save-select">{text("Lokalne zapisy", "Local saves")}</label>
            <select
              id="battle-save-select"
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
            {status || externalStatus ? <p className="errorText" role="status">{status || externalStatus}</p> : null}
          </section>
        </div>

        <aside className="mainMenuUtilityRail">
          <div className="menuSectionLabel">
            <span>02</span>
            <div>
              <p className="eyebrow">{text("Moduły", "Modules")}</p>
              <strong>{text("Zaplecze dowodzenia", "Command support")}</strong>
            </div>
          </div>

          <button className="menuCard menuUtilityCard" onClick={onOpenComposer}>
            <span>{text("Armie", "Armies")}</span>
            <strong>{text("Kreator armii", "Army Composer")}</strong>
            <small>{text("Buduj i przekazuj składy do scenariusza.", "Build and hand rosters to the scenario builder.")}</small>
          </button>

          <button className="menuCard menuUtilityCard" onClick={onOpenRules}>
            <span>{text("Kompendium", "Compendium")}</span>
            <strong>{text("Zasady i jednostki", "Rules and units")}</strong>
            <small>{text("Statystyki, zdolności, teren i zespoły uderzeniowe.", "Stats, abilities, terrain, and task forces.")}</small>
          </button>

          <button className="menuCard menuUtilityCard menuCardCampaign" onClick={onOpenCampaign}>
            <span>{text("Galactic Conquest", "Galactic Conquest")}</span>
            <strong>{text("Kampania galaktyczna", "Galactic campaign")}</strong>
            <small>{text(
              "Poprowadź armie przez hiperlinie i przejmuj sektory.",
              "Lead armies through hyperlanes and capture sectors.",
            )}</small>
          </button>
        </aside>
      </section>
    </section>
  );
}
