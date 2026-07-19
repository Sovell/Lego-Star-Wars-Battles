import type { MissionState, ScenarioDefinition } from "../../core/scenario/scenario-types";
import type { Army } from "../../types";
import { PanelTitle } from "./PanelTitle";
import "./MissionPanel.css";

export function MissionPanel({
  armies,
  mission,
  scenario,
  scenarios,
  onScenarioChange,
  onDefenderArmyChange,
  onRoundTargetChange,
  onRestart,
}: {
  armies: Army[];
  mission: MissionState;
  scenario: ScenarioDefinition;
  scenarios: ScenarioDefinition[];
  onScenarioChange: (scenarioId: string) => void;
  onDefenderArmyChange: (armyId: string) => void;
  onRoundTargetChange: (rounds: number) => void;
  onRestart: () => void;
}) {
  const requiredRounds = mission.roundTarget ?? scenario.victoryCondition.rounds;
  const defender = armies.find((army) => army.id === mission.defenderArmyId) ?? armies[0];
  const attacker = armies.find((army) => army.id === mission.attackerArmyId)
    ?? armies.find((army) => army.id !== defender?.id);
  const statusLabel = mission.status === "Active"
    ? "w toku"
    : mission.status === "Victory"
      ? "zwyciestwo"
      : "porazka";

  return (
    <section className={`missionPanel ${mission.status.toLowerCase()}`}>
      <PanelTitle title="Misja" detail={statusLabel} />
      <label className="missionSelector">
        Tryb scenariusza
        <select
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
            disabled={mission.status !== "Active"}
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
      <h3>{scenario.name}</h3>
      <p>{scenario.description}</p>
      <label className="missionSelector">
        Wymagane rundy
        <input
          type="number"
          min="1"
          disabled={mission.status !== "Active"}
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
      {mission.status === "Victory" ? (
        <p className="missionOutcome">Cel wykonany. Misja zakonczona zwyciestwem.</p>
      ) : null}
      {mission.status === "Defeat" ? (
        <p className="missionOutcome">Obroncy zostali wyeliminowani. Misja przegrana.</p>
      ) : null}
      <button className="secondaryButton" onClick={onRestart}>
        Uruchom misje ponownie
      </button>
    </section>
  );
}
