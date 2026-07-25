import type { MissionState, ScenarioDefinition } from "../../core/scenario/scenario-types";
import type { Army } from "../../types";
import { PanelTitle } from "./PanelTitle";
import "./MissionPanel.css";

export function MissionPanel({
  armies,
  attackerBotEnabled,
  canStart,
  gamePhase,
  mission,
  scenario,
  scenarios,
  onScenarioChange,
  onAttackerBotEnabledChange,
  onDefenderArmyChange,
  onRoundTargetChange,
  onRestart,
  onStart,
}: {
  armies: Army[];
  attackerBotEnabled: boolean;
  canStart: boolean;
  gamePhase: "Preparation" | "Playing";
  mission: MissionState;
  scenario: ScenarioDefinition;
  scenarios: ScenarioDefinition[];
  onScenarioChange: (scenarioId: string) => void;
  onAttackerBotEnabledChange: (enabled: boolean) => void;
  onDefenderArmyChange: (armyId: string) => void;
  onRoundTargetChange: (rounds: number) => void;
  onRestart: () => void;
  onStart: () => void;
}) {
  const requiredRounds = mission.roundTarget ?? scenario.victoryCondition.rounds;
  const defender = armies.find((army) => army.id === mission.defenderArmyId) ?? armies[0];
  const attacker = armies.find((army) => army.id === mission.attackerArmyId)
    ?? armies.find((army) => army.id !== defender?.id);
  const statusLabel = mission.status === "Active"
    ? gamePhase === "Preparation" ? "przygotowanie" : "w toku"
    : mission.status === "Victory"
      ? "zwyciestwo"
      : "porazka";

  if (gamePhase === "Playing") {
    return (
      <section className={`missionPanel missionInPlay ${mission.status.toLowerCase()}`}>
        <PanelTitle title={scenario.name} detail={statusLabel} />
        <p>{scenario.description}</p>
        <div className="missionProgressHeader">
          <span>Rundy</span>
          <strong>{mission.roundsCompleted}/{requiredRounds}</strong>
        </div>
        <progress max={requiredRounds} value={mission.roundsCompleted} />
        {scenario.victoryCondition.type === "ControlTerritory" ? (
          <div className="territoryScoreboard">
            {armies.map((army) => (
              <span key={army.id}>
                {army.faction}
                <strong>{mission.territoryScores?.[army.id] ?? 0} pkt</strong>
              </span>
            ))}
          </div>
        ) : null}
        <div className="missionCombatants">
          <span>Obrońca: <strong>{defender?.faction ?? "Brak"}</strong></span>
          <span>Atakujący: <strong>{attacker?.faction ?? "Brak"}</strong></span>
        </div>
        <label className="missionBotToggle">
          <input
            checked={attackerBotEnabled}
            disabled={!attacker || mission.status !== "Active"}
            type="checkbox"
            onChange={(event) => onAttackerBotEnabledChange(event.target.checked)}
          />
          <span>
            <strong>Bot armii atakującej</strong>
            <small>{attackerBotEnabled ? "Aktywny" : "Wyłączony"}</small>
          </span>
        </label>
        <button className="secondaryButton" onClick={onRestart}>
          Zakończ i przejdź do kreatora
        </button>
      </section>
    );
  }

  return (
    <section className={`missionPanel ${mission.status.toLowerCase()}`}>
      <PanelTitle title="Misja" detail={statusLabel} />
      <label className="missionSelector">
        Tryb scenariusza
        <select
          disabled={gamePhase !== "Preparation"}
          value={scenario.id}
          onChange={(event) => onScenarioChange(event.target.value)}
        >
          {scenarios.map((option) => (
            <option key={option.id} value={option.id}>{option.name}</option>
          ))}
        </select>
      </label>
      <div className="missionRoles">
        <label className="missionSelector">
          Frakcja broniąca
          <select
            disabled={gamePhase !== "Preparation"}
            value={defender?.id ?? ""}
            onChange={(event) => onDefenderArmyChange(event.target.value)}
          >
            {armies.map((army) => (
              <option key={army.id} value={army.id}>
                {army.faction} — {army.playerName}
              </option>
            ))}
          </select>
        </label>
        <div className="missionRoleReadout">
          <span>Frakcja atakująca</span>
          <strong>{attacker ? `${attacker.faction} — ${attacker.playerName}` : "Brak"}</strong>
        </div>
      </div>
      <label className="missionBotToggle">
        <input
          checked={attackerBotEnabled}
          disabled={mission.status !== "Active" || !attacker}
          type="checkbox"
          onChange={(event) => onAttackerBotEnabledChange(event.target.checked)}
        />
        <span>
          <strong>Bot armii atakujacej</strong>
          <small>
            Po wylosowaniu jej tokenu bot automatycznie wybierze ruch albo atak.
          </small>
        </span>
      </label>
      <h3>{scenario.name}</h3>
      <p>{scenario.description}</p>
      <label className="missionSelector">
        Wymagane rundy
        <input
          type="number"
          min="1"
          disabled={gamePhase !== "Preparation"}
          value={requiredRounds}
          onChange={(event) => onRoundTargetChange(Number(event.target.value))}
        />
        <small>Bez górnego limitu rund.</small>
      </label>
      <div className="missionProgressHeader">
        <span>Ukonczone rundy</span>
        <strong>{mission.roundsCompleted}/{requiredRounds}</strong>
      </div>
      <progress max={requiredRounds} value={mission.roundsCompleted} />
      {scenario.victoryCondition.type === "ControlTerritory" ? (
        <div className="territoryScoreboard">
          {armies.map((army) => (
            <span key={army.id}>
              {army.faction}
              <strong>{mission.territoryScores?.[army.id] ?? 0} pkt</strong>
            </span>
          ))}
        </div>
      ) : null}
      {mission.status === "Victory" ? (
        <p className="missionOutcome">Cel wykonany. Misja zakonczona zwyciestwem.</p>
      ) : null}
      {mission.status === "Defeat" ? (
        <p className="missionOutcome">Warunek porażki został spełniony. Misja przegrana.</p>
      ) : null}
      {gamePhase === "Preparation" ? (
        <>
          <button
            className="primaryButton missionStartButton"
            disabled={!canStart}
            onClick={onStart}
          >
            Rozegraj scenariusz
          </button>
          {!canStart ? (
            <small className="missionStartHint">
              Wczytaj co najmniej dwie armie zawierające jednostki.
            </small>
          ) : null}
        </>
      ) : (
        <button className="secondaryButton" onClick={onRestart}>
          Zakończ i przygotuj nową rozgrywkę
        </button>
      )}
    </section>
  );
}
