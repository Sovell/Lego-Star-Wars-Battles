import type { MissionState, ScenarioDefinition } from "../../core/scenario/scenario-types";
import { PanelTitle } from "./PanelTitle";
import "./MissionPanel.css";

export function MissionPanel({
  mission,
  scenario,
  onRestart,
}: {
  mission: MissionState;
  scenario: ScenarioDefinition;
  onRestart: () => void;
}) {
  const requiredRounds = scenario.victoryCondition.rounds;
  const statusLabel = mission.status === "Active"
    ? "w toku"
    : mission.status === "Victory"
      ? "zwyciestwo"
      : "porazka";

  return (
    <section className={`missionPanel ${mission.status.toLowerCase()}`}>
      <PanelTitle title="Misja" detail={statusLabel} />
      <h3>{scenario.name}</h3>
      <p>{scenario.description}</p>
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
