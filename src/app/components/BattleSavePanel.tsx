import { useEffect, useMemo, useState } from "react";
import { createPersistenceAdapter } from "../../core/persistence/create-persistence-adapter";
import { createSavedBattle, type SavedBattleSummary } from "../../core/persistence/save-types";
import type { MissionState } from "../../core/scenario/scenario-types";
import type { Battle, CombatLogEntry } from "../../types";

export function BattleSavePanel({
  battle,
  logs,
  mission,
  onBattleLoad,
}: {
  battle: Battle;
  logs: CombatLogEntry[];
  mission: MissionState;
  onBattleLoad: (battle: Battle, logs: CombatLogEntry[], mission?: MissionState) => void;
}) {
  const [saveName, setSaveName] = useState<string>("Bitwa treningowa");
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
      setSaveStatus(error instanceof Error ? error.message : "Nie udalo sie odczytac zapisow.");
    }
  }

  async function handleSaveBattle() {
    const trimmedName = saveName.trim();
    if (!trimmedName) {
      setSaveStatus("Podaj nazwe zapisu.");
      return;
    }

    const savedBattle = createSavedBattle({
      id: battle.id,
      name: trimmedName,
      battle,
      logs,
      mission,
    });

    try {
      await persistence.saveBattle(savedBattle);
      setSaveStatus(`Zapisano: ${trimmedName}.`);
      await refreshSavedBattles();
      setSelectedSaveId(savedBattle.id);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Nie udalo sie zapisac bitwy.");
    }
  }

  async function handleLoadSavedBattle() {
    if (!selectedSaveId) {
      setSaveStatus("Wybierz zapis do wczytania.");
      return;
    }

    try {
      const savedBattle = await persistence.loadBattle(selectedSaveId);
      if (!savedBattle) {
        setSaveStatus("Ten zapis nie istnieje.");
        await refreshSavedBattles();
        return;
      }

      onBattleLoad(savedBattle.battle, savedBattle.logs, savedBattle.mission);
      setSaveName(savedBattle.name);
      setSaveStatus(`Wczytano: ${savedBattle.name}.`);
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Nie udalo sie wczytac bitwy.");
    }
  }

  async function handleDeleteSavedBattle() {
    if (!selectedSaveId) {
      setSaveStatus("Wybierz zapis do usuniecia.");
      return;
    }

    try {
      await persistence.deleteBattle(selectedSaveId);
      setSaveStatus("Usunieto zapis bitwy.");
      setSelectedSaveId("");
      await refreshSavedBattles();
    } catch (error) {
      setSaveStatus(error instanceof Error ? error.message : "Nie udalo sie usunac zapisu.");
    }
  }

  return (
    <details className="savePanel">
      <summary className="savePanelSummary">
        <strong>Zapis bitwy</strong>
        <small>{savedBattles.length} lokalnie</small>
      </summary>
      <div className="savePanelBody">
        <input
          value={saveName}
          onChange={(event) => setSaveName(event.target.value)}
          placeholder="Nazwa zapisu"
        />
        <button className="primaryButton" onClick={handleSaveBattle}>
          Zapisz bitwę
        </button>
        <select
          value={selectedSaveId}
          onChange={(event) => setSelectedSaveId(event.target.value)}
        >
          <option value="">Wybierz zapis</option>
          {savedBattles.map((savedBattle) => (
            <option key={savedBattle.id} value={savedBattle.id}>
              {savedBattle.name} | T{savedBattle.turn} | {formatDateTime(savedBattle.updatedAt)}
            </option>
          ))}
        </select>
        <div className="saveActions">
          <button className="secondaryButton" disabled={!selectedSaveId} onClick={handleLoadSavedBattle}>
            Wczytaj
          </button>
          <button className="dangerButton" disabled={!selectedSaveId} onClick={handleDeleteSavedBattle}>
            Usuń
          </button>
        </div>
        {saveStatus ? <p className="saveStatus">{saveStatus}</p> : null}
      </div>
    </details>
  );
}

function formatDateTime(value: string): string {
  return new Intl.DateTimeFormat("pl-PL", {
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    month: "2-digit",
  }).format(new Date(value));
}
