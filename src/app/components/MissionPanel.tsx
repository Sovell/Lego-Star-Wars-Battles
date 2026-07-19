import type { MissionState, ScenarioDefinition } from "../../core/scenario/scenario-types";
import { PanelTitle } from "./PanelTitle";
import "./MissionPanel.css";

export function MissionPanel({
  mission,
  scenario,
  scenarios,
  onScenarioChange,
  onRoundTargetChange,
  onRestart,
}: {
  mission: MissionState;
  scenario: ScenarioDefinition;
  scenarios: ScenarioDefinition[];
  onScenarioChange: (scenarioId: string) => void;
  onRoundTargetChange: (rounds: number) => void;
  onRestart: () => void;
}) {
  const requiredRounds = mission.roundTarget ?? scenario.victoryCondition.rounds;
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
      <h3>{scenario.name}</h3>
      <p>{scenario.description}</p>
      <label className="missionSelector">
        Wymagane rundy
        <input
          type="number"
          min="1"
          max="10"
          disabled={mission.status !== "Active"}
          value={requiredRounds}
          onChange={(event) => onRoundTargetChange(Number(event.target.value))}
        />
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
