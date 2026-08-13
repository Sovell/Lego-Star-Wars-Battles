import type {
  MissionState,
  ScenarioDefinition,
  ScenarioScheduledEvent,
} from "../../core/scenario/scenario-types";
import { areArmiesAllied, getArmyControl } from "../../core/army-relations";
import type { Army, ArmyControl, TeamId } from "../../types";
import type { ScenarioMapGenerationState, ScenarioMapScale } from "../scenario-draft";
import { MapGeneratorPanel } from "./MapGeneratorPanel";
import { PanelTitle } from "./PanelTitle";
import { ScenarioEventsPanel } from "./ScenarioEventsPanel";
import {
  localizeControl,
  localizeFaction,
  localizeScenarioDescription,
  localizeScenarioName,
  localizeThemeName,
  useI18n,
} from "../../i18n";
import { getMapTheme } from "../../core/map-generation/map-themes";
import { getScenarioArmyPreset } from "../../core/scenario/scenario-army-presets";
import "./MissionPanel.css";

export function MissionPanel({
  activationCounts,
  armies,
  canStart,
  startError,
  gamePhase,
  currentRound,
  mission,
  scenario,
  scenarios,
  mapGeneration,
  mapBoardHeight,
  mapBoardWidth,
  mapHasManualChanges,
  onGenerateMap,
  onMapGenerationSettingsChange,
  onMapSizeChange,
  onScenarioChange,
  onArmyConfigChange,
  onLoadRecommendedArmies,
  onDefenderArmyChange,
  onRoundTargetChange,
  onStageRoundTargetsChange,
  onScheduledEventsChange,
  onRestart,
  onStart,
}: {
  activationCounts?: Record<string, { remaining: number; total: number }>;
  armies: Army[];
  canStart: boolean;
  startError?: string;
  gamePhase: "Preparation" | "Playing";
  currentRound: number;
  mission: MissionState;
  scenario: ScenarioDefinition;
  scenarios: ScenarioDefinition[];
  mapGeneration: ScenarioMapGenerationState;
  mapBoardHeight: number;
  mapBoardWidth: number;
  mapHasManualChanges: boolean;
  onGenerateMap: (useNextSeed: boolean) => void;
  onMapGenerationSettingsChange: (
    patch: Partial<Pick<ScenarioMapGenerationState, "themeId" | "seed">>,
  ) => void;
  onMapSizeChange: (scale: ScenarioMapScale) => void;
  onScenarioChange: (scenarioId: string) => void;
  onArmyConfigChange: (
    armyId: string,
    patch: Partial<Pick<Army, "teamId" | "control">>,
  ) => void;
  onLoadRecommendedArmies: () => void;
  onDefenderArmyChange: (armyId: string) => void;
  onRoundTargetChange: (rounds: number) => void;
  onStageRoundTargetsChange: (rounds: number[]) => void;
  onScheduledEventsChange: (events: ScenarioScheduledEvent[]) => void;
  onRestart: () => void;
  onStart: () => void;
}) {
  const { language, text } = useI18n();
  const requiredRounds = mission.roundTarget ?? (
    "rounds" in scenario.victoryCondition
      ? scenario.victoryCondition.rounds
      : scenario.victoryCondition.roundLimit
  );
  const progressiveCondition = scenario.victoryCondition.type === "ProgressiveControl" ||
    scenario.victoryCondition.type === "RescueAndExtract"
    ? scenario.victoryCondition
    : undefined;
  const progressiveStageCount = progressiveCondition
    ? progressiveCondition.type === "ProgressiveControl"
      ? progressiveCondition.count
      : progressiveCondition.hostageCount + 1
    : 0;
  const defender = armies.find((army) => army.id === mission.defenderArmyId) ?? armies[0];
  const attacker = armies.find((army) => army.id === mission.attackerArmyId)
    ?? armies.find((army) =>
      defender && !areArmiesAllied({ armies }, army.id, defender.id)
    );
  const statusLabel = mission.status === "Active"
    ? gamePhase === "Preparation" ? text("przygotowanie", "setup") : text("w toku", "in progress")
    : mission.status === "Victory"
      ? text("zwycięstwo", "victory")
      : text("porażka", "defeat");
  const scenarioName = localizeScenarioName(language, scenario.id, scenario.name);
  const scenarioDescription = localizeScenarioDescription(language, scenario.id, scenario.description);
  const activeObjectiveName = mission.activeObjectiveName ?? scenarioName;
  const activeObjectiveDescription = mission.activeObjectiveDescription ?? scenarioDescription;
  const narrativeMission = scenario.experience === "NarrativeMission";
  const armyPreset = getScenarioArmyPreset(scenario.id);
  const visibleScenarioOptions = scenarios.filter((option) =>
    (option.experience === "NarrativeMission") === narrativeMission
  );

  if (gamePhase === "Playing") {
    return (
      <section className={`missionPanel missionInPlay ${mission.status.toLowerCase()}`}>
        <PanelTitle title={activeObjectiveName} detail={statusLabel} />
        <p>{activeObjectiveDescription}</p>
        <div className="missionProgressHeader">
          <span>{text("Rundy", "Rounds")}</span>
          <strong>{mission.roundsCompleted}/{requiredRounds}</strong>
        </div>
        <progress max={requiredRounds} value={mission.roundsCompleted} />
        {scenario.victoryCondition.type === "DefendPoint" ? (
          <div className="missionProgressHeader">
            <span>{text("Limit bitwy", "Battle limit")}</span>
            <strong>{Math.min(currentRound, scenario.victoryCondition.roundLimit)}/{scenario.victoryCondition.roundLimit}</strong>
          </div>
        ) : null}
        <MissionDirectorStatus mission={mission} scenario={scenario} />
        {scenario.victoryCondition.type === "DestroyObjects" ? (
          <div className="missionProgressHeader">
            <span>{text("Zniszczone cele", "Destroyed targets")}</span>
            <strong>{mission.destroyedObjectiveIds?.length ?? 0}/{scenario.victoryCondition.count}</strong>
          </div>
        ) : null}
        {scenario.victoryCondition.type === "ProgressiveControl" ||
        scenario.victoryCondition.type === "RescueAndExtract" ? (
          <div className="missionProgressHeader">
            <span>{scenario.victoryCondition.type === "RescueAndExtract"
              ? text("Etapy ratunku", "Rescue stages")
              : text("Przełamane sektory", "Captured sectors")}</span>
            <strong>{mission.objectiveStage ?? 0}/{scenario.victoryCondition.type === "RescueAndExtract"
              ? scenario.victoryCondition.hostageCount + 1
              : scenario.victoryCondition.count}</strong>
          </div>
        ) : null}
        {scenario.victoryCondition.type === "ControlTerritory" ? (
          <div className="territoryScoreboard">
            {armies.map((army) => (
              <span key={army.id}>
                {localizeFaction(language, army.faction)}
                <strong>{mission.territoryScores?.[army.id] ?? 0} {text("pkt", "VP")}</strong>
              </span>
            ))}
          </div>
        ) : null}
        <ScenarioEventsPanel
          armies={armies}
          currentRound={currentRound}
          editable={false}
          events={mission.scheduledEvents ?? scenario.scheduledEvents ?? []}
          resolvedEventIds={mission.resolvedEventIds}
          zones={scenario.zones}
        />
        <div className="missionCombatants">
          <span>{text("Obrońca", "Defender")}: <strong>{defender ? localizeFaction(language, defender.faction) : text("Brak", "None")}</strong></span>
          <span>{text("Atakujący", "Attacker")}: <strong>{attacker ? localizeFaction(language, attacker.faction) : text("Brak", "None")}</strong></span>
        </div>
        <ArmySideConfiguration
          activationCounts={activationCounts}
          armies={armies}
          defenderArmyId={mission.defenderArmyId}
          deploymentZones={scenario.deploymentZones}
          teamEditingDisabled
          controlEditingDisabled={mission.status !== "Active"}
          onArmyConfigChange={onArmyConfigChange}
        />
        <button className="secondaryButton" onClick={onRestart}>
          {text("Zakończ i przejdź do kreatora", "End and return to builder")}
        </button>
      </section>
    );
  }

  return (
    <section className={`missionPanel ${mission.status.toLowerCase()}`}>
      <PanelTitle title={text("Misja", "Mission")} detail={statusLabel} />
      <div className="scenarioExperiencePicker" role="group" aria-label={text("Tryb przygotowania", "Setup mode")}>
        <button
          className={narrativeMission ? "active" : ""}
          type="button"
          onClick={() => {
            const firstMission = scenarios.find((option) => option.experience === "NarrativeMission");
            if (firstMission && !narrativeMission) onScenarioChange(firstMission.id);
          }}
        >
          <strong>{text("Rozegraj misję", "Play a mission")}</strong>
          <span>{text("Gotowa mapa i wydarzenia", "Authored map and events")}</span>
        </button>
        <button
          className={!narrativeMission ? "active" : ""}
          type="button"
          onClick={() => {
            const firstTemplate = scenarios.find((option) => option.experience !== "NarrativeMission");
            if (firstTemplate && narrativeMission) onScenarioChange(firstTemplate.id);
          }}
        >
          <strong>{text("Stwórz scenariusz", "Create a scenario")}</strong>
          <span>{text("Generator i edycja mapy", "Map generator and editing")}</span>
        </button>
      </div>
      <label className="missionSelector">
        {narrativeMission ? text("Gotowa misja", "Authored mission") : text("Szablon zasad", "Rules template")}
        <select
          disabled={gamePhase !== "Preparation"}
          value={scenario.id}
          onChange={(event) => onScenarioChange(event.target.value)}
        >
          {visibleScenarioOptions.map((option) => (
            <option key={option.id} value={option.id}>{localizeScenarioName(language, option.id, option.name)}</option>
          ))}
        </select>
      </label>
      {narrativeMission && scenario.mapPreset ? (
        <section className="missionMapPreset">
          <div>
            <span>{text("Mapa misji", "Mission map")}</span>
            <strong>{localizeThemeName(
              language,
              scenario.mapPreset.themeId,
              getMapTheme(scenario.mapPreset.themeId).name,
            )}</strong>
          </div>
          <span className="missionMapLock">{text("Zablokowana", "Locked")}</span>
          <small>
            {scenario.mapPreset.width}×{scenario.mapPreset.height} · seed {scenario.mapPreset.seed}. {text(
              "Mapa, obiekty i strefy są częścią misji i nie mogą być generowane ani edytowane.",
              "The map, objects, and zones are part of the mission and cannot be generated or edited.",
            )}
          </small>
        </section>
      ) : (
        <MapGeneratorPanel
          boardHeight={mapBoardHeight}
          boardWidth={mapBoardWidth}
          canGenerate={armies.length >= 2 && armies.length <= 4}
          hasManualMap={mapHasManualChanges}
          settings={mapGeneration}
          onGenerate={onGenerateMap}
          onSettingsChange={onMapGenerationSettingsChange}
          onSizeChange={onMapSizeChange}
        />
      )}
      {armyPreset ? (
        <section className="missionArmySetup">
          <div className="missionArmySetupHeader">
            <div>
              <span>{text("Skład armii", "Army composition")}</span>
              <strong>{armyPreset.name[language]}</strong>
            </div>
            <span className="missionArmyCurrent">{text("Obecne aktywne", "Current active")}</span>
          </div>
          <p>{armyPreset.description[language]}</p>
          <div className="missionArmyOptions">
            <div className="missionArmyOption active">
              <strong>{text("Użyj wczytanych armii", "Use loaded armies")}</strong>
              <small>{text(
                "Zachowuje Twój własny skład i poziom trudności.",
                "Keeps your custom roster and difficulty.",
              )}</small>
            </div>
            <button className="missionArmyOption" type="button" onClick={onLoadRecommendedArmies}>
              <strong>{text("Wczytaj rekomendowane", "Load recommended")}</strong>
              <small>{text(
                "Zastępuje wszystkie armie gotowym składem misji.",
                "Replaces all armies with the mission roster.",
              )}</small>
            </button>
          </div>
          <small className="missionArmyRule">{text(
            "Bohater może wystąpić tylko raz w całej bitwie, także w armii sojusznika.",
            "A hero may appear only once in the entire battle, including allied armies.",
          )}</small>
        </section>
      ) : null}
      <div className="missionRoles">
        <label className="missionSelector">
          {text("Frakcja broniąca", "Defending faction")}
          <select
            disabled={gamePhase !== "Preparation" || narrativeMission}
            value={defender?.id ?? ""}
            onChange={(event) => onDefenderArmyChange(event.target.value)}
          >
            {armies.map((army) => (
              <option key={army.id} value={army.id}>
                {localizeFaction(language, army.faction)} — {army.playerName}
              </option>
            ))}
          </select>
        </label>
        <div className="missionRoleReadout">
          <span>{text("Frakcja atakująca", "Attacking faction")}</span>
          <strong>{attacker ? `${localizeFaction(language, attacker.faction)} — ${attacker.playerName}` : text("Brak", "None")}</strong>
        </div>
      </div>
      <ArmySideConfiguration
        armies={armies}
        defenderArmyId={mission.defenderArmyId}
        deploymentZones={scenario.deploymentZones}
        controlEditingDisabled={false}
        teamEditingDisabled={narrativeMission}
        onArmyConfigChange={onArmyConfigChange}
      />
      <ScenarioEventsPanel
        armies={armies}
        currentRound={currentRound}
        editable={!narrativeMission}
        events={mission.scheduledEvents ?? scenario.scheduledEvents ?? []}
        zones={scenario.zones}
        onChange={onScheduledEventsChange}
      />
      <h3>{scenarioName}</h3>
      <p>{scenarioDescription}</p>
      <MissionDirectorStatus mission={mission} scenario={scenario} />
      <label className="missionSelector">
        {text("Wymagane rundy", "Required rounds")}
        <input
          type="number"
          min="1"
          disabled={gamePhase !== "Preparation" || narrativeMission}
          value={requiredRounds}
          onChange={(event) => onRoundTargetChange(Number(event.target.value))}
        />
        <small>{text("Wartość określa wymagany czas albo limit misji.", "This value sets the required duration or mission limit.")}</small>
      </label>
      {progressiveCondition ? (
        <section className="stageRoundSettings">
          <div>
            <strong>{text("Limity etapów", "Stage limits")}</strong>
            <small>{text("Ile pełnych rund można poświęcić na każdy kolejny sektor.", "How many full rounds may be spent on each consecutive sector.")}</small>
          </div>
          <div className="stageRoundGrid">
            {Array.from({ length: progressiveStageCount }, (_, stage) => {
              const defaults = progressiveCondition.stageRoundLimits ?? [];
              const values = mission.stageRoundTargets ?? defaults;
              return (
                <label key={stage}>
                  {text("Sektor", "Sector")} {stage + 1}
                  <input
                    disabled={gamePhase !== "Preparation" || narrativeMission}
                    min={1}
                    type="number"
                    value={values[stage] ?? requiredRounds}
                    onChange={(event) => {
                      const next = Array.from(
                        { length: progressiveStageCount },
                        (_, index) => values[index] ?? requiredRounds,
                      );
                      next[stage] = Math.max(1, Math.floor(Number(event.target.value) || 1));
                      onStageRoundTargetsChange(next);
                    }}
                  />
                </label>
              );
            })}
          </div>
        </section>
      ) : null}
      <div className="missionProgressHeader">
        <span>{text("Ukończone rundy", "Completed rounds")}</span>
        <strong>{mission.roundsCompleted}/{requiredRounds}</strong>
      </div>
      <progress max={requiredRounds} value={mission.roundsCompleted} />
      {scenario.victoryCondition.type === "ControlTerritory" ? (
        <div className="territoryScoreboard">
          {armies.map((army) => (
            <span key={army.id}>
              {localizeFaction(language, army.faction)}
              <strong>{mission.territoryScores?.[army.id] ?? 0} {text("pkt", "VP")}</strong>
            </span>
          ))}
        </div>
      ) : null}
      {mission.status === "Victory" ? (
        <p className="missionOutcome">{text("Cel wykonany. Misja zakończona zwycięstwem.", "Objective complete. Mission victory.")}</p>
      ) : null}
      {mission.status === "Defeat" ? (
        <p className="missionOutcome">{text("Warunek porażki został spełniony. Misja przegrana.", "A defeat condition has been met. Mission failed.")}</p>
      ) : null}
      {gamePhase === "Preparation" ? (
        <>
          <button
            className="primaryButton missionStartButton"
            disabled={!canStart}
            onClick={onStart}
          >
            {narrativeMission ? text("Rozegraj misję", "Play mission") : text("Rozegraj scenariusz", "Play scenario")}
          </button>
          {!canStart ? (
            <small className={`missionStartHint ${startError ? "error" : ""}`}>
              {startError ?? text("Przygotuj 2–4 armie, strefy wejścia i kompletne zdarzenia misji.", "Prepare 2–4 armies, deployment zones, and complete mission events.")}
            </small>
          ) : null}
        </>
      ) : (
        <button className="secondaryButton" onClick={onRestart}>
          {text("Zakończ i przygotuj nową rozgrywkę", "End and prepare a new game")}
        </button>
      )}
    </section>
  );
}

function MissionDirectorStatus({
  mission,
  scenario,
}: {
  mission: MissionState;
  scenario: ScenarioDefinition;
}) {
  const { text } = useI18n();
  const definition = scenario.missionDirector;
  if (!definition) return null;
  const state = mission.directorState;
  const phase = state?.phase === "Opening"
    ? text("Otwarcie", "Opening")
    : state?.phase === "Escalation"
      ? text("Eskalacja", "Escalation")
      : state?.phase === "Crisis"
        ? text("Kryzys", "Crisis")
        : state?.phase === "Finale"
          ? text("Finał", "Finale")
          : text("Oczekiwanie", "Standby");

  return (
    <section className="missionDirectorStatus">
      <div>
        <span>Mission Director</span>
        <strong>{phase}</strong>
      </div>
      <small>
        {text("Fale adaptacyjne", "Adaptive waves")}: {state?.wavesDeployed ?? 0}/{definition.escalation?.maxWaves ?? 0}
        {" · "}
        {text("Wsparcie", "Support")}: {state?.supportUses ?? 0}/{definition.emergencySupport?.maxUses ?? 0}
      </small>
      <small>{text(
        "Tempo i posiłki reagują na siłę obu drużyn.",
        "Pacing and reinforcements react to both teams' strength.",
      )}</small>
    </section>
  );
}

function ArmySideConfiguration({
  activationCounts,
  armies,
  defenderArmyId,
  deploymentZones,
  controlEditingDisabled,
  teamEditingDisabled,
  onArmyConfigChange,
}: {
  activationCounts?: Record<string, { remaining: number; total: number }>;
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
  const { language, text } = useI18n();
  return (
    <div className="missionSideConfig">
      <h3>{text("Drużyny i sterowanie", "Teams and control")}</h3>
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
                {localizeFaction(language, army.faction)} · {defenderSide ? text("obrona", "defense") : text("atak", "attack")} · {text("strefa", "zone")}: {" "}
                {deploymentZones.find((zone) => zone.armySlot === index)?.cells.length ?? 0} {text("pól", "tiles")}
              </small>
              {activationCounts?.[army.id] ? (
                <small>
                  {text("Rozkazy", "Orders")}: {activationCounts[army.id].remaining}/{activationCounts[army.id].total}
                  {" · "}{text("rezerwa", "reserve")}: {army.units.filter((unit) =>
                    unit.status !== "Destroyed" && !unit.position
                  ).length}
                </small>
              ) : null}
            </div>
            <label>
              {text("Drużyna", "Team")}
              <select
                disabled={teamEditingDisabled}
                value={teamId}
                onChange={(event) => onArmyConfigChange(army.id, {
                  teamId: Number(event.target.value) as TeamId,
                })}
              >
                <option value={1}>{text("Drużyna 1", "Team 1")}</option>
                <option value={2}>{text("Drużyna 2", "Team 2")}</option>
              </select>
            </label>
            <label>
              {text("Sterowanie", "Control")}
              <select
                disabled={controlEditingDisabled}
                value={getArmyControl(army)}
                onChange={(event) => onArmyConfigChange(army.id, {
                  control: event.target.value as ArmyControl,
                })}
              >
                <option value="Human">{localizeControl(language, "Human")}</option>
                <option value="Bot">{localizeControl(language, "Bot")}</option>
              </select>
            </label>
          </div>
        );
      })}
    </div>
  );
}
