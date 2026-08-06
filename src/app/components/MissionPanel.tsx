import type { MissionState, ScenarioDefinition } from "../../core/scenario/scenario-types";
import { areArmiesAllied, getArmyControl } from "../../core/army-relations";
import type { Army, ArmyControl, TeamId } from "../../types";
import { PanelTitle } from "./PanelTitle";
import "./MissionPanel.css";

export function MissionPanel({
  armies,
  canStart,
  gamePhase,
  mission,
  scenario,
  scenarios,
  onScenarioChange,
  onArmyConfigChange,
  onDefenderArmyChange,
  onRoundTargetChange,
  onRestart,
  onStart,
}: {
  armies: Army[];
  canStart: boolean;
  gamePhase: "Preparation" | "Playing";
  mission: MissionState;
  scenario: ScenarioDefinition;
  scenarios: ScenarioDefinition[];
  onScenarioChange: (scenarioId: string) => void;
  onArmyConfigChange: (
    armyId: string,
    patch: Partial<Pick<Army, "teamId" | "control">>,
  ) => void;
  onDefenderArmyChange: (armyId: string) => void;
  onRoundTargetChange: (rounds: number) => void;
  onRestart: () => void;
  onStart: () => void;
}) {
  const requiredRounds = mission.roundTarget ?? scenario.victoryCondition.rounds;
  const defender = armies.find((army) => army.id === mission.defenderArmyId) ?? armies[0];
  const attacker = armies.find((army) => army.id === mission.attackerArmyId)
    ?? armies.find((army) =>
      defender && !areArmiesAllied({ armies }, army.id, defender.id)
    );
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
        <ArmySideConfiguration
          armies={armies}
          defenderArmyId={mission.defenderArmyId}
          deploymentZones={scenario.deploymentZones}
          teamEditingDisabled
          controlEditingDisabled={mission.status !== "Active"}
          onArmyConfigChange={onArmyConfigChange}
        />
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
      <ArmySideConfiguration
        armies={armies}
        defenderArmyId={mission.defenderArmyId}
        deploymentZones={scenario.deploymentZones}
        controlEditingDisabled={false}
        teamEditingDisabled={false}
        onArmyConfigChange={onArmyConfigChange}
      />
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
              Przygotuj 2–4 armie z jednostkami i zaznacz strefę wejścia dla każdej z nich.
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

function ArmySideConfiguration({
  armies,
  defenderArmyId,
  deploymentZones,
  controlEditingDisabled,
  teamEditingDisabled,
  onArmyConfigChange,
}: {
  armies: Army[];
  defenderArmyId?: string;
  deploymentZones: ScenarioDefinition["deploymentZones"];
  controlEditingDisabled: boolean;
  teamEditingDisabled: boolean;
  onArmyConfigChange: (
    armyId: string,
    patch: Partial<Pick<Army, "teamId" | "control">>,
  ) => void;
}) {
  return (
    <div className="missionSideConfig">
      <h3>Drużyny i sterowanie</h3>
      {armies.map((army, index) => {
        const teamId = army.teamId ?? (index === 0 ? 1 : 2);
        const defenderSide = defenderArmyId
          ? areArmiesAllied({ armies }, army.id, defenderArmyId)
          : index === 0;

        return (
          <div className="missionSideRow" key={army.id}>
            <div>
              <strong>{army.playerName}</strong>
              <small>
                {army.faction} · {defenderSide ? "obrona" : "atak"} · strefa:{" "}
                {deploymentZones.find((zone) => zone.armySlot === index)?.cells.length ?? 0} pól
              </small>
            </div>
            <label>
              Drużyna
              <select
                disabled={teamEditingDisabled}
                value={teamId}
                onChange={(event) => onArmyConfigChange(army.id, {
                  teamId: Number(event.target.value) as TeamId,
                })}
              >
                <option value={1}>Team 1</option>
                <option value={2}>Team 2</option>
              </select>
            </label>
            <label>
              Sterowanie
              <select
                disabled={controlEditingDisabled}
                value={getArmyControl(army)}
                onChange={(event) => onArmyConfigChange(army.id, {
                  control: event.target.value as ArmyControl,
                })}
              >
                <option value="Human">Gracz</option>
                <option value="Bot">Bot</option>
              </select>
            </label>
          </div>
        );
      })}
    </div>
  );
}
