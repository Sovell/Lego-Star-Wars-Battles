import { useEffect, useMemo, useState } from "react";
import { abilities, taskForces, unitTemplates } from "./data";
import { createNewGameBattle } from "./app/new-game-state";
import {
  alignDeploymentZones,
  createInitialBattleSnapshot,
  createPreparationBattle,
  createScenarioDraft,
  prepareComposerDraft,
  remapDeploymentZonesByArmy,
  restartDraftFromBattle,
  startBattleFromDraft,
} from "./app/scenario-draft";
import { PanelTitle } from "./app/components/PanelTitle";
import { RulesView } from "./app/screens/RulesView";
import { MainMenu } from "./app/screens/MainMenu";
import { BattleScreen } from "./app/screens/BattleScreen";
import type { GamePhase } from "./app/types/game-phase";
import {
  areArmiesEnemies,
  withDefaultArmyConfiguration,
} from "./core/army-relations";
import {
  createLog,
  getArmyCost,
  getTemplate,
} from "./core/battle-state";
import { createBattlefieldObject } from "./core/battlefield-objects";
import { createMissionState } from "./core/scenario/scenario-engine";
import { scenarios, survivalTestScenario } from "./core/scenario/scenarios";
import type { MissionState, ScenarioDefinition } from "./core/scenario/scenario-types";
import type { SavedBattle } from "./core/persistence/save-types";
import {
  clearActiveSessionRecovery,
  loadActiveSessionRecovery,
  saveActiveSessionRecovery,
  type RecoverableAppView,
} from "./app/active-session-recovery";
import type {
  Army,
  ArmyControl,
  Battle,
  BattlefieldObjectType,
  CombatLogEntry,
  FactionId,
  OrderType,
  TerrainTile,
  TeamId,
  UnitInstance,
  UnitTemplate,
} from "./types";

type AppView = RecoverableAppView;
type AppTitle = Record<AppView, string>;
type DraftCounts = Record<string, number>;
type ComposerArmyDraft = {
  id: string;
  playerName: string;
  faction: FactionId;
  counts: DraftCounts;
  teamId: TeamId;
  control: ArmyControl;
};
const minimumArmyCount = 2;
const maximumArmyCount = 4;
const composerFactions: FactionId[] = ["Republic", "Separatists"];
const appTitles: AppTitle = {
  home: "Menu główne",
  setup: "Kreator scenariusza",
  battle: "Panel dowodzenia",
  composer: "Army Composer",
  rules: "Rules",
};

export function App() {
  const [recoveredSession] = useState(() => loadActiveSessionRecovery());
  const [view, setView] = useState<AppView>(() => recoveredSession?.view ?? "home");
  const [battle, setBattle] = useState<Battle>(() =>
    recoveredSession?.battle ?? createNewGameBattle()
  );
  const [battleStartSnapshot, setBattleStartSnapshot] = useState<Battle | undefined>(
    () => recoveredSession?.battleStartSnapshot,
  );
  const [scenarioDraft, setScenarioDraft] = useState(() =>
    recoveredSession?.scenarioDraft ?? createScenarioDraft(survivalTestScenario.id),
  );
  const [mission, setMission] = useState<MissionState>(() =>
    recoveredSession?.mission ?? createMissionState(survivalTestScenario, []),
  );
  const [logs, setLogs] = useState<CombatLogEntry[]>(() =>
    recoveredSession?.logs ?? [createLog(1, "Nowa rozgrywka jest gotowa do przygotowania.")]
  );
  const [activeArmyId, setActiveArmyId] = useState<string | undefined>(
    () => recoveredSession?.activeArmyId,
  );
  const [selectedUnitId, setSelectedUnitId] = useState<string>(
    () => recoveredSession?.selectedUnitId ?? "",
  );
  const [targetUnitId, setTargetUnitId] = useState<string>(
    () => recoveredSession?.targetUnitId ?? "",
  );
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>(
    () => recoveredSession?.selectedWeaponId ?? "",
  );
  const [selectedOrder, setSelectedOrder] = useState<OrderType>(
    () => recoveredSession?.selectedOrder ?? "Move",
  );
  const [armyJson, setArmyJson] = useState<string>(
    () => recoveredSession?.armyJson ?? "[]",
  );
  const [importError, setImportError] = useState<string>("");
  const [debugMode, setDebugMode] = useState<boolean>(() => recoveredSession?.debugMode ?? false);
  const [gamePhase, setGamePhase] = useState<GamePhase>(
    () => recoveredSession?.gamePhase ?? "Preparation",
  );
  const baseScenario = scenarios.find((scenario) => scenario.id === mission.scenarioId)
    ?? survivalTestScenario;
  const configuredDeploymentZones = gamePhase === "Preparation"
    ? scenarioDraft.deploymentZones
    : mission.deploymentZones;
  const activeScenario: ScenarioDefinition = {
    ...baseScenario,
    deploymentZones: configuredDeploymentZones?.length
      ? configuredDeploymentZones
      : baseScenario.deploymentZones,
  };
  const preparationBattle = useMemo(
    () => createPreparationBattle(scenarioDraft),
    [scenarioDraft],
  );
  const visibleBattle = gamePhase === "Preparation" ? preparationBattle : battle;

  useEffect(() => {
    if (gamePhase !== "Playing") {
      clearActiveSessionRecovery();
      return;
    }
    saveActiveSessionRecovery({
      view,
      gamePhase,
      battle,
      battleStartSnapshot,
      scenarioDraft,
      mission,
      logs,
      activeArmyId,
      selectedUnitId,
      targetUnitId,
      selectedWeaponId,
      selectedOrder,
      armyJson,
      debugMode,
    });
  }, [
    activeArmyId,
    armyJson,
    battle,
    battleStartSnapshot,
    debugMode,
    gamePhase,
    logs,
    mission,
    scenarioDraft,
    selectedOrder,
    selectedUnitId,
    selectedWeaponId,
    targetUnitId,
    view,
  ]);

  function addLog(message: string) {
    setLogs((current) => {
      const latest = current[0];
      if (latest?.turn === visibleBattle.turn && latest.message === message) {
        return current;
      }

      return [createLog(visibleBattle.turn, message), ...current].slice(0, 12);
    });
  }

  function loadArmies(
    armies: Army[],
    logMessage: string,
    scenario: ScenarioDefinition = activeScenario,
    defenderArmyId?: string,
  ) {
    const nextArmies = withDefaultArmyConfiguration(
      structuredClone(armies),
      defenderArmyId,
    );
    const roundTarget = scenario.id === scenarioDraft.scenarioId
      ? scenarioDraft.roundTarget
      : undefined;
    const keepsCurrentScenario = scenario.id === scenarioDraft.scenarioId;
    const deploymentZones = keepsCurrentScenario && scenarioDraft.armies.length > 0
      ? remapDeploymentZonesByArmy(
          scenarioDraft.deploymentZones.length
            ? scenarioDraft.deploymentZones
            : scenario.deploymentZones,
          scenarioDraft.armies,
          nextArmies,
        )
      : alignDeploymentZones(scenario.deploymentZones, nextArmies.length);
    const nextMission = {
      ...createMissionState(scenario, nextArmies, defenderArmyId),
      deploymentZones,
      ...(roundTarget ? { roundTarget } : {}),
    };
    const nextDraft = {
      ...scenarioDraft,
      armies: nextArmies,
      scenarioId: scenario.id,
      defenderArmyId: nextMission.defenderArmyId,
      deploymentZones,
      roundTarget,
    };
    setScenarioDraft(nextDraft);
    setMission(nextMission);
    setActiveArmyId(undefined);
    setSelectedUnitId("");
    setTargetUnitId("");
    setArmyJson(JSON.stringify(nextArmies, null, 2));
    setImportError("");
    setLogs([createLog(1, logMessage)]);
    setGamePhase("Preparation");
  }

  function prepareNewScenario() {
    const nextDraft = createScenarioDraft(survivalTestScenario.id);
    setScenarioDraft(nextDraft);
    setBattle(createNewGameBattle());
    setBattleStartSnapshot(undefined);
    setMission(createMissionState(survivalTestScenario, []));
    setActiveArmyId(undefined);
    setSelectedUnitId("");
    setTargetUnitId("");
    setSelectedWeaponId("");
    setSelectedOrder("Move");
    setArmyJson("[]");
    setImportError("");
    setLogs([createLog(1, "Rozpoczęto przygotowanie pustego scenariusza.")]);
    setGamePhase("Preparation");
    setView("setup");
  }

  function handleScenarioChange(scenarioId: string) {
    const nextScenario = scenarios.find((scenario) => scenario.id === scenarioId);
    if (!nextScenario) {
      return;
    }

    loadArmies(
      scenarioDraft.armies,
      `Uruchomiono scenariusz: ${nextScenario.name}.`,
      nextScenario,
      mission.defenderArmyId,
    );
  }

  function handleDefenderArmyChange(defenderArmyId: string) {
    const defender = scenarioDraft.armies.find((army) => army.id === defenderArmyId);
    const attacker = scenarioDraft.armies.find((army) =>
      areArmiesEnemies({ armies: scenarioDraft.armies }, army.id, defenderArmyId)
    );
    if (!defender || !attacker) {
      return;
    }

    setMission((current) => ({
      ...current,
      status: "Active",
      roundsCompleted: 0,
      defenderArmyId: defender.id,
      attackerArmyId: attacker.id,
    }));
    setScenarioDraft((current) => ({
      ...current,
      defenderArmyId,
    }));
    setLogs((current) => [
      createLog(
        visibleBattle.turn,
        `Role scenariusza: ${defender.faction} broni, ${attacker.faction} atakuje.`,
      ),
      ...current,
    ].slice(0, 12));
  }

  function handleUnitPatch(unitId: string, patch: Partial<UnitInstance>) {
    if (gamePhase === "Preparation") {
      setScenarioDraft((current) => ({
        ...current,
        armies: current.armies.map((army) => ({
          ...army,
          units: army.units.map((unit) =>
            unit.id === unitId ? { ...unit, ...patch } : unit
          ),
        })),
      }));
      return;
    }

    setBattle((current) => ({
      ...current,
      armies: current.armies.map((army) => ({
        ...army,
        units: army.units.map((unit) => (unit.id === unitId ? { ...unit, ...patch } : unit)),
      })),
    }));
  }

  function handleArmyConfigChange(
    armyId: string,
    patch: Partial<Pick<Army, "teamId" | "control">>,
  ) {
    const updateArmies = (armies: Army[]) => armies.map((army) =>
      army.id === armyId ? { ...army, ...patch } : army
    );

    if (gamePhase === "Preparation") {
      setScenarioDraft((current) => ({
        ...current,
        armies: updateArmies(current.armies),
      }));
      setMission((current) => {
        const nextArmies = updateArmies(scenarioDraft.armies);
        const attackerArmyId = current.defenderArmyId
          ? nextArmies.find((army) =>
              areArmiesEnemies({ armies: nextArmies }, army.id, current.defenderArmyId!)
            )?.id
          : undefined;
        return { ...current, attackerArmyId };
      });
      return;
    }

    setBattle((current) => ({
      ...current,
      armies: updateArmies(current.armies),
    }));
  }

  function handleTerrainPaint(tile: TerrainTile) {
    if (gamePhase !== "Preparation") {
      return;
    }
    setScenarioDraft((current) => {
      const otherTiles = current.board.tiles.filter(
        (existingTile) => existingTile.x !== tile.x || existingTile.y !== tile.y,
      );

      return {
        ...current,
        board: {
          ...current.board,
          tiles: tile.terrainType === "Open" ? otherTiles : [...otherTiles, tile],
        },
      };
    });
  }

  function handleBattlefieldObjectPlace(
    type: BattlefieldObjectType | undefined,
    position: { x: number; y: number },
  ) {
    if (gamePhase !== "Preparation") {
      return;
    }
    setScenarioDraft((current) => {
      const objects = current.board.objects ?? [];
      const remaining = objects.filter((object) => {
        const occupiesPosition =
          object.position.x === position.x && object.position.y === position.y;
        const isUniqueReplacement =
          type !== undefined &&
          (type === "DefensePoint" || type === "Generator") &&
          object.type === type;
        return !occupiesPosition && !isUniqueReplacement;
      });

      return {
        ...current,
        board: {
          ...current.board,
          objects: type ? [...remaining, createBattlefieldObject(type, position)] : remaining,
        },
      };
    });
  }

  function handleStartScenario() {
    if (
      scenarioDraft.armies.length < 2 ||
      scenarioDraft.armies.length > maximumArmyCount ||
      alignDeploymentZones(
        scenarioDraft.deploymentZones,
        scenarioDraft.armies.length,
      ).some((zone) => zone.cells.length === 0) ||
      scenarioDraft.armies.some((army) => army.units.length === 0)
    ) {
      return;
    }

    const nextBattle = startBattleFromDraft(scenarioDraft);
    const nextMission = {
      ...createMissionState(
        activeScenario,
        nextBattle.armies,
        scenarioDraft.defenderArmyId,
      ),
      deploymentZones: structuredClone(activeScenario.deploymentZones),
      ...(scenarioDraft.roundTarget ? { roundTarget: scenarioDraft.roundTarget } : {}),
    };

    setBattle(nextBattle);
    setBattleStartSnapshot(structuredClone(nextBattle));
    setMission(nextMission);
    setActiveArmyId(undefined);
    setSelectedUnitId("");
    setTargetUnitId("");
    setSelectedWeaponId("");
    setLogs([createLog(1, `Rozpoczęto scenariusz: ${activeScenario.name}.`)]);
    setGamePhase("Playing");
    setView("battle");
  }

  function handleLoadSavedBattle(savedBattle: SavedBattle) {
    const loadedScenario = scenarios.find(
      (scenario) => scenario.id === savedBattle.mission?.scenarioId,
    ) ?? survivalTestScenario;
    const loadedBattle = {
      ...savedBattle.battle,
      armies: withDefaultArmyConfiguration(
        savedBattle.battle.armies,
        savedBattle.mission?.defenderArmyId,
      ),
    };
    const loadedMission = {
      ...createMissionState(
        loadedScenario,
        loadedBattle.armies,
        savedBattle.mission?.defenderArmyId,
      ),
      ...savedBattle.mission,
      deploymentZones: alignDeploymentZones(
        savedBattle.mission?.deploymentZones ?? loadedScenario.deploymentZones,
        loadedBattle.armies.length,
      ),
    };
    setBattle(loadedBattle);
    const initialBattle = savedBattle.initialBattle
      ? {
          ...structuredClone(savedBattle.initialBattle),
          armies: withDefaultArmyConfiguration(
            savedBattle.initialBattle.armies,
            loadedMission.defenderArmyId,
          ),
        }
      : createInitialBattleSnapshot(loadedBattle);
    setBattleStartSnapshot(initialBattle);
    setScenarioDraft(restartDraftFromBattle(
      initialBattle,
      loadedMission.scenarioId,
      loadedMission.defenderArmyId,
      loadedMission.roundTarget,
      loadedMission.deploymentZones,
    ));
    setMission(loadedMission);
    setLogs(savedBattle.logs);
    setActiveArmyId(loadedBattle.activeActivation?.armyId);
    setSelectedUnitId("");
    setTargetUnitId("");
    setSelectedWeaponId("");
    setGamePhase("Playing");
    setView("battle");
  }

  function handleMissionChange(nextMission: MissionState) {
    setMission(nextMission);
    if (gamePhase === "Preparation") {
      setScenarioDraft((current) => ({
        ...current,
        scenarioId: nextMission.scenarioId,
        defenderArmyId: nextMission.defenderArmyId,
        deploymentZones: nextMission.deploymentZones ?? current.deploymentZones,
        roundTarget: nextMission.roundTarget,
      }));
    }
  }

  function handleDeploymentZonesChange(
    deploymentZones: ScenarioDefinition["deploymentZones"],
  ) {
    setScenarioDraft((current) => ({
      ...current,
      deploymentZones: structuredClone(deploymentZones),
    }));
    setMission((current) => ({
      ...current,
      deploymentZones: structuredClone(deploymentZones),
    }));
  }

  function handleMissionRestart() {
    const initialBattle = battleStartSnapshot ?? createInitialBattleSnapshot(battle);
    const nextDraft = restartDraftFromBattle(
      initialBattle,
      activeScenario.id,
      mission.defenderArmyId,
      mission.roundTarget,
      mission.deploymentZones,
    );
    setScenarioDraft(nextDraft);
    setBattle(structuredClone(initialBattle));
    setMission({
      ...createMissionState(activeScenario, nextDraft.armies, nextDraft.defenderArmyId),
      deploymentZones: structuredClone(nextDraft.deploymentZones),
      ...(nextDraft.roundTarget ? { roundTarget: nextDraft.roundTarget } : {}),
    });
    setActiveArmyId(undefined);
    setSelectedUnitId("");
    setTargetUnitId("");
    setSelectedWeaponId("");
    setArmyJson(JSON.stringify(nextDraft.armies, null, 2));
    setLogs([createLog(1, "Misja została przywrócona do stanu początkowego.")]);
    setGamePhase("Preparation");
    setView("setup");
  }

  function openComposer(origin: "menu" | "setup") {
    const nextDraft = prepareComposerDraft(
      origin,
      scenarioDraft,
      survivalTestScenario.id,
    );
    setScenarioDraft(nextDraft);
    if (origin === "menu") {
      setBattle(createNewGameBattle());
      setBattleStartSnapshot(undefined);
      setMission(createMissionState(survivalTestScenario, []));
      setActiveArmyId(undefined);
      setSelectedUnitId("");
      setTargetUnitId("");
      setSelectedWeaponId("");
      setSelectedOrder("Move");
      setArmyJson("[]");
      setImportError("");
      setLogs([createLog(1, "Rozpoczęto tworzenie armii dla nowego scenariusza.")]);
      setGamePhase("Preparation");
    }
    setView("composer");
  }

  return (
    <main className={`app ${view === "setup" || view === "battle" ? "battleApp" : ""}`}>
      {view === "home" ? (
        <MainMenu
          onNewScenario={prepareNewScenario}
          onOpenComposer={() => openComposer("menu")}
          onOpenRules={() => setView("rules")}
          onResumeBattle={
            gamePhase === "Playing" ? () => setView("battle") : undefined
          }
          onLoadBattle={handleLoadSavedBattle}
        />
      ) : (
        <>
      <section className="commandStrip">
        <div>
          <p className="eyebrow">LEGO Star Wars Battles</p>
          <h1>{appTitles[view]}</h1>
        </div>
        <nav className="viewTabs" aria-label="Widoki aplikacji">
          <button onClick={() => setView("home")}>
            Menu
          </button>
          {view === "setup" ? (
            <button onClick={() => openComposer("setup")}>Army Composer</button>
          ) : null}
          {view === "composer" ? (
            <button onClick={() => setView("setup")}>Kreator scenariusza</button>
          ) : null}
        </nav>
        {view === "setup" ? <label className="debugToggle">
          <input
            checked={debugMode}
            type="checkbox"
            onChange={(event) => setDebugMode(event.target.checked)}
          />
          Debug
        </label> : null}
        {view === "setup" || view === "battle" ? <div className="turnCounter">
          <span>Tura</span>
          <strong>{visibleBattle.turn}</strong>
        </div> : null}
        {view === "setup" || view === "battle" ? <div className="phasePill">
          {gamePhase === "Preparation"
            ? "Preparation"
            : mission.status === "Active"
              ? battle.phase
              : `Mission ${mission.status}`}
        </div> : null}
      </section>

      {view === "setup" || view === "battle" ? (
        <BattleScreen
          activeArmyId={activeArmyId}
          armyJson={armyJson}
          battle={visibleBattle}
          initialBattle={battleStartSnapshot}
          gamePhase={gamePhase}
          debugMode={debugMode}
          importError={importError}
          logs={logs}
          mission={mission}
          scenario={activeScenario}
          scenarioOptions={scenarios}
          selectedOrder={selectedOrder}
          selectedUnitId={selectedUnitId}
          selectedWeaponId={selectedWeaponId}
          targetUnitId={targetUnitId}
          onActiveArmyChange={setActiveArmyId}
          onAddLog={addLog}
          onArmyJsonChange={setArmyJson}
          onArmyConfigChange={handleArmyConfigChange}
          onBattleChange={setBattle}
          onInitialBattleChange={setBattleStartSnapshot}
          onGamePhaseChange={setGamePhase}
          onImportError={setImportError}
          onLoadArmies={loadArmies}
          onLogsChange={setLogs}
          onMissionChange={handleMissionChange}
          onBattlefieldObjectPlace={handleBattlefieldObjectPlace}
          onDeploymentZonesChange={handleDeploymentZonesChange}
          onDefenderArmyChange={handleDefenderArmyChange}
          onScenarioChange={handleScenarioChange}
          onMissionRestart={handleMissionRestart}
          onStartScenario={handleStartScenario}
          onOrderChange={setSelectedOrder}
          onSelectedUnitChange={setSelectedUnitId}
          onSelectedWeaponChange={setSelectedWeaponId}
          onTargetUnitChange={setTargetUnitId}
          onTerrainPaint={handleTerrainPaint}
          onUnitPatch={handleUnitPatch}
        />
      ) : null}

      {view === "composer" ? (
        <ArmyComposerView
          currentArmies={scenarioDraft.armies}
          onLoadArmies={(armies) => {
            loadArmies(armies, "Armie z Army Composera zostały wczytane do kreatora.");
            setView("setup");
          }}
        />
      ) : null}

      {view === "rules" ? <RulesView /> : null}
        </>
      )}
    </main>
  );
}

function ArmyComposerView({
  currentArmies,
  onLoadArmies,
}: {
  currentArmies: Army[];
  onLoadArmies: (armies: Army[]) => void;
}) {
  const [drafts, setDrafts] = useState<ComposerArmyDraft[]>(() =>
    createComposerArmyDrafts(currentArmies)
  );

  const armies = useMemo(
    () => drafts.map((draft, index) => buildArmyFromDraft(
      draft.id,
      draft.playerName,
      draft.faction,
      draft.counts,
      index + 1,
      draft.teamId,
      draft.control,
    )),
    [drafts],
  );
  const generatedJson = JSON.stringify(armies, null, 2);

  function patchDraft(index: number, patch: Partial<ComposerArmyDraft>) {
    setDrafts((current) => current.map((draft, draftIndex) =>
      draftIndex === index ? { ...draft, ...patch } : draft
    ));
  }

  function addArmy() {
    setDrafts((current) => current.length >= maximumArmyCount
      ? current
      : [...current, createEmptyComposerArmyDraft(
          current.length,
          nextAvailableArmyId(current),
        )]
    );
  }

  function removeArmy(index: number) {
    setDrafts((current) => current.length <= minimumArmyCount
      ? current
      : current.filter((_, draftIndex) => draftIndex !== index)
    );
  }

  return (
    <section className="composerLayout">
      <div className="composerArmyArea">
        <div className="composerArmyToolbar">
          <div>
            <p className="eyebrow">Uczestnicy</p>
            <strong>{armies.length}/{maximumArmyCount} armii</strong>
          </div>
          <button
            className="secondaryButton"
            disabled={drafts.length >= maximumArmyCount}
            onClick={addArmy}
          >
            Dodaj armię
          </button>
        </div>
        <div className="composerArmyGrid">
          {drafts.map((draft, index) => (
            <ComposerColumn
              counts={draft.counts}
              faction={draft.faction}
              key={draft.id}
              playerName={draft.playerName}
              sideLabel={`Armia ${String.fromCharCode(65 + index)}`}
              onCountsChange={(counts) => patchDraft(index, { counts })}
              onFactionChange={(faction) => patchDraft(index, { faction, counts: {} })}
              onPlayerNameChange={(playerName) => patchDraft(index, { playerName })}
              onRemove={drafts.length > minimumArmyCount ? () => removeArmy(index) : undefined}
            />
          ))}
        </div>
      </div>
      <aside className="composerSummary">
        <PanelTitle
          title="Gotowa lista"
          detail={`${armies.length} armie · ${armies.reduce((total, army) => total + getArmyCost(army), 0)} pkt`}
        />
        <ArmyPreview armies={armies} />
        <details className="jsonDetails">
          <summary>Eksport JSON</summary>
          <textarea
            className="armyInput jsonInput composerJson"
            value={generatedJson}
            readOnly
            spellCheck={false}
            wrap="off"
          />
        </details>
        <button className="primaryButton" onClick={() => onLoadArmies(armies)}>
          Użyj armii w scenariuszu
        </button>
      </aside>
    </section>
  );
}

function ComposerColumn({
  counts,
  faction,
  playerName,
  sideLabel,
  onCountsChange,
  onFactionChange,
  onPlayerNameChange,
  onRemove,
}: {
  counts: DraftCounts;
  faction: FactionId;
  playerName: string;
  sideLabel: string;
  onCountsChange: (counts: DraftCounts) => void;
  onFactionChange: (faction: FactionId) => void;
  onPlayerNameChange: (name: string) => void;
  onRemove?: () => void;
}) {
  const templates = unitTemplates.filter((template) => template.faction === faction);
  const factionTaskForces = taskForces.filter((taskForce) => taskForce.faction === faction);
  const cost =
    templates.reduce((total, template) => total + (counts[template.id] ?? 0) * template.cost, 0) +
    factionTaskForces.reduce((total, taskForce) => total + (counts[taskForce.id] ?? 0) * taskForce.cost, 0);

  function setCount(templateId: string, count: number) {
    onCountsChange({
      ...counts,
      [templateId]: Math.max(0, count),
    });
  }

  return (
    <section className="composerColumn">
      <div className="armyHeader">
        <div>
          <p className="eyebrow">{sideLabel}</p>
          <h2>{playerName}</h2>
        </div>
        <div className="composerArmyHeaderActions">
          <strong>{cost} pkt</strong>
          {onRemove ? (
            <button className="dangerButton" onClick={onRemove}>Usuń</button>
          ) : null}
        </div>
      </div>
      <div className="composerControls">
        <label>
          Gracz
          <input value={playerName} onChange={(event) => onPlayerNameChange(event.target.value)} />
        </label>
        <label>
          Frakcja
          <select value={faction} onChange={(event) => onFactionChange(event.target.value)}>
            {composerFactions.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </label>
      </div>
      <div className="templateList">
        {factionTaskForces.map((taskForce) => {
          const bonus = abilities.find((ability) => ability.id === taskForce.bonusAbility);
          const unitNames = taskForce.unitIds
            .map((templateId) => unitTemplates.find((template) => template.id === templateId)?.name)
            .filter(Boolean)
            .join(" + ");

          return (
            <article className="templateRow taskForceRow" key={taskForce.id}>
              <div>
                <p className="category">TASK FORCE</p>
                <h3>{taskForce.name}</h3>
                <p className="templateMeta">
                  {taskForce.cost} pkt | {unitNames}
                </p>
                {bonus ? <p className="templateMeta">Bonus: {bonus.name}</p> : null}
              </div>
              <div className="stepper">
                <button onClick={() => setCount(taskForce.id, (counts[taskForce.id] ?? 0) - 1)}>-</button>
                <input
                  min="0"
                  type="number"
                  value={counts[taskForce.id] ?? 0}
                  onChange={(event) => setCount(taskForce.id, Number(event.target.value))}
                />
                <button onClick={() => setCount(taskForce.id, (counts[taskForce.id] ?? 0) + 1)}>+</button>
              </div>
            </article>
          );
        })}
        {templates.map((template) => (
          <article className="templateRow" key={template.id}>
            <div>
              <p className="category">{template.category} | {template.role}</p>
              <h3>{template.name}</h3>
              <p className="templateMeta">
                {template.cost} pkt | HP {template.maxHp} | MOV {template.movement} | MOR {template.morale}
              </p>
            </div>
            <div className="stepper">
              <button onClick={() => setCount(template.id, (counts[template.id] ?? 0) - 1)}>-</button>
              <input
                min="0"
                type="number"
                value={counts[template.id] ?? 0}
                onChange={(event) => setCount(template.id, Number(event.target.value))}
              />
              <button onClick={() => setCount(template.id, (counts[template.id] ?? 0) + 1)}>+</button>
            </div>
          </article>
        ))}
      </div>
    </section>
  );
}

function ArmyPreview({ armies }: { armies: Army[] }) {
  return (
    <div className="armyPreviewList">
      {armies.map((army) => (
        <section className="armyPreview" key={army.id}>
          <div className="armyPreviewHeader">
            <div>
              <p className="eyebrow">{army.faction}</p>
              <h3>{army.playerName}</h3>
            </div>
            <strong>{getArmyCost(army)} pkt</strong>
          </div>
          {army.units.length > 0 ? (
            <div className="armyPreviewUnits">
              {army.units.map((unit) => {
                const template = getTemplate(unit);

                return (
                  <div className="armyPreviewUnit" key={unit.id}>
                    <span>{template.name}</span>
                    <small>
                      {template.role} | HP {template.maxHp} | MOV {template.movement}
                    </small>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="emptyPreview">Brak jednostek.</p>
          )}
        </section>
      ))}
    </div>
  );
}

function countsFromArmy(army?: Army): DraftCounts {
  if (!army) {
    return {};
  }

  const taskForceSelectionIds = new Set(army.taskForces?.map((selection) => selection.id) ?? []);
  const counts = army.units.reduce<DraftCounts>((draftCounts, unit) => {
    if (!unit.sourceTaskForceId || !taskForceSelectionIds.has(unit.sourceTaskForceId)) {
      draftCounts[unit.templateId] = (draftCounts[unit.templateId] ?? 0) + 1;
    }

    return draftCounts;
  }, {});

  for (const selection of army.taskForces ?? []) {
    counts[selection.taskForceId] = (counts[selection.taskForceId] ?? 0) + 1;
  }

  return counts;
}

function createComposerArmyDrafts(currentArmies: Army[]): ComposerArmyDraft[] {
  const drafts = currentArmies.slice(0, maximumArmyCount).map((army, index) => ({
    id: army.id,
    playerName: army.playerName,
    faction: army.faction,
    counts: countsFromArmy(army),
    teamId: army.teamId ?? (index % 2 === 0 ? 1 : 2),
    control: army.control ?? (index === 0 ? "Human" : "Bot"),
  } satisfies ComposerArmyDraft));

  while (drafts.length < minimumArmyCount) {
    drafts.push(createEmptyComposerArmyDraft(
      drafts.length,
      nextAvailableArmyId(drafts),
    ));
  }
  return drafts;
}

function createEmptyComposerArmyDraft(
  index: number,
  id = `army_player_${index + 1}`,
): ComposerArmyDraft {
  return {
    id,
    playerName: `Gracz ${index + 1}`,
    faction: index % 2 === 0 ? "Republic" : "Separatists",
    counts: {},
    teamId: index % 2 === 0 ? 1 : 2,
    control: index === 0 ? "Human" : "Bot",
  };
}

function nextAvailableArmyId(drafts: Array<Pick<ComposerArmyDraft, "id">>): string {
  for (let index = 1; index <= maximumArmyCount; index += 1) {
    const id = `army_player_${index}`;
    if (!drafts.some((draft) => draft.id === id)) return id;
  }
  return `army_player_${crypto.randomUUID()}`;
}

function buildArmyFromDraft(
  armyId: string,
  playerName: string,
  faction: FactionId,
  counts: DraftCounts,
  sideIndex: number,
  teamId: TeamId,
  control: ArmyControl,
): Army {
  let unitIndex = 1;
  const taskForceSelections = taskForces
    .filter((taskForce) => taskForce.faction === faction)
    .flatMap((taskForce) =>
      Array.from({ length: counts[taskForce.id] ?? 0 }, (_, taskForceIndex) => ({
        id: `${armyId}_${taskForce.id}_${taskForceIndex + 1}`,
        taskForceId: taskForce.id,
      })),
    );
  const taskForceUnits = taskForceSelections.flatMap((selection) => {
    const taskForce = taskForces.find((candidate) => candidate.id === selection.taskForceId);

    return (taskForce?.unitIds ?? []).map((templateId) => {
      const template = unitTemplates.find((candidate) => candidate.id === templateId);
      if (!template) {
        throw new Error(`Missing task force template: ${templateId}`);
      }

      const unit = createUnitInstance(armyId, template, unitIndex, selection.id);
      unitIndex += 1;
      return unit;
    });
  });
  const standaloneUnits = unitTemplates
    .filter((template) => template.faction === faction)
    .flatMap((template) =>
      Array.from({ length: counts[template.id] ?? 0 }, () => {
        const unit = createUnitInstance(armyId, template, unitIndex);
        unitIndex += 1;
        return unit;
      }),
    );

  return {
    id: armyId,
    playerName: playerName.trim() || `Gracz ${sideIndex}`,
    faction,
    teamId,
    control,
    taskForces: taskForceSelections,
    units: [...taskForceUnits, ...standaloneUnits],
  };
}

function createUnitInstance(
  armyId: string,
  template: UnitTemplate,
  unitIndex: number,
  sourceTaskForceId?: string,
): UnitInstance {
  return {
    id: `${armyId}_${template.id}_${unitIndex}`,
    templateId: template.id,
    armyId,
    sourceTaskForceId,
    currentHp: template.maxHp,
    suppression: 0,
    abilityCooldowns: {},
    activeEffects: [],
    movedThisTurn: false,
    position: null,
    status: "Ready",
    hidden: false,
  };
}
