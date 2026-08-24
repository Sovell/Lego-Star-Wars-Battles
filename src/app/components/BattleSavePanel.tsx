import { useEffect, useMemo, useState } from "react";
import { createPersistenceAdapter } from "../../core/persistence/create-persistence-adapter";
import { createSavedBattle, type SavedBattleSummary } from "../../core/persistence/save-types";
import type { MissionState } from "../../core/scenario/scenario-types";
import type { Battle, CombatLogEntry } from "../../types";
import { useI18n } from "../../i18n";

export function BattleSavePanel({
  battle,
  defaultOpen = false,
  initialBattle,
  logs,
  mission,
  onBattleLoad,
}: {
  battle: Battle;
  defaultOpen?: boolean;
  initialBattle?: Battle;
  logs: CombatLogEntry[];
  mission: MissionState;
  onBattleLoad: (
    battle: Battle,
    logs: CombatLogEntry[],
    mission?: MissionState,
    initialBattle?: Battle,
  ) => void;
}) {
  const { locale, text } = useI18n();
  const [saveName, setSaveName] = useState<string>(() => text("Bitwa treningowa", "Training battle"));
  const [saveStatus, setSaveStatus] = useState<string>("");
  const [savedBattles, setSavedBattles] = useState<SavedBattleSummary[]>([]);
  const [selectedSaveId, setSelectedSaveId] = useState<string>("");
  const persistence = useMemo(() => createPersistenceAdapter(), []);

  useEffect(() => {
    void refreshSavedBattles();
  }, []);

  async function refreshSavedBattles() {
    try {
      const summaries = await persistence.listBattles();
      setSavedBattles(summaries);
      setSelectedSaveId((current) => current || summaries[0]?.id || "");
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : text("Nie udało się odczytać zapisów.", "Could not read saved games."));
    }
  }

  async function handleSaveBattle() {
    const trimmedName = saveName.trim();
    if (!trimmedName) {
      setSaveStatus(text("Podaj nazwę zapisu.", "Enter a save name."));
      return;
    }

    const savedBattle = createSavedBattle({
      id: battle.id,
      name: trimmedName,
      battle,
      initialBattle,
      logs,
      mission,
    });

    try {
      await persistence.saveBattle(savedBattle);
      setSaveStatus(`${text("Zapisano", "Saved")}: ${trimmedName}.`);
      await refreshSavedBattles();
      setSelectedSaveId(savedBattle.id);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : text("Nie udało się zapisać bitwy.", "Could not save the battle."));
    }
  }

  async function handleLoadSavedBattle() {
    if (!selectedSaveId) {
      setSaveStatus(text("Wybierz zapis do wczytania.", "Select a save to load."));
      return;
    }

    try {
      const savedBattle = await persistence.loadBattle(selectedSaveId);
      if (!savedBattle) {
        setSaveStatus(text("Ten zapis nie istnieje.", "This save does not exist."));
        await refreshSavedBattles();
        return;
      }

      onBattleLoad(
        savedBattle.battle,
        savedBattle.logs,
        savedBattle.mission,
        savedBattle.initialBattle,
      );
      setSaveName(savedBattle.name);
      setSaveStatus(`${text("Wczytano", "Loaded")}: ${savedBattle.name}.`);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : text("Nie udało się wczytać bitwy.", "Could not load the battle."));
    }
  }

  async function handleDeleteSavedBattle() {
    if (!selectedSaveId) {
      setSaveStatus(text("Wybierz zapis do usunięcia.", "Select a save to delete."));
      return;
    }

    try {
      await persistence.deleteBattle(selectedSaveId);
      setSaveStatus(text("Usunięto zapis bitwy.", "Battle save deleted."));
      setSelectedSaveId("");
      await refreshSavedBattles();
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : text("Nie udało się usunąć zapisu.", "Could not delete the save."));
    }
  }

  return (
    <details className="savePanel" open={defaultOpen || undefined}>
      <summary className="savePanelSummary">
        <strong>{text("Zapis bitwy", "Battle save")}</strong>
        <small>{savedBattles.length} {text("lokalnie", "local")}</small>
      </summary>
      <div className="savePanelBody">
        <input
          aria-label={text("Nazwa zapisu", "Save name")}
          value={saveName}
          onChange={(event) => setSaveName(event.target.value)}
          placeholder={text("Nazwa zapisu", "Save name")}
        />
        <button className="primaryButton" onClick={handleSaveBattle}>
          {text("Zapisz bitwę", "Save battle")}
        </button>
        <select
          aria-label={text("Zapis do wczytania", "Save to load")}
          value={selectedSaveId}
          onChange={(event) => setSelectedSaveId(event.target.value)}
        >
          <option value="">{text("Wybierz zapis", "Select save")}</option>
          {savedBattles.map((savedBattle) => (
            <option key={savedBattle.id} value={savedBattle.id}>
              {savedBattle.name} | T{savedBattle.turn} | {formatDateTime(savedBattle.updatedAt, locale)}
            </option>
          ))}
        </select>
        <div className="saveActions">
          <button className="secondaryButton" disabled={!selectedSaveId} onClick={handleLoadSavedBattle}>
            {text("Wczytaj", "Load")}
          </button>
          <button className="dangerButton" disabled={!selectedSaveId} onClick={handleDeleteSavedBattle}>
            {text("Usuń", "Delete")}
          </button>
        </div>
        {saveStatus ? <p className="saveStatus">{saveStatus}</p> : null}
      </div>
    </details>
  );
}

function formatDateTime(value: string, locale: string): string {
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}
