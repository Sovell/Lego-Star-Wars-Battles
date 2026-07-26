import { useMemo, useState } from "react";
import { abilities, starterArmies, taskForces, unitTemplates } from "./data";
import { PanelTitle } from "./app/components/PanelTitle";
import { RulesView } from "./app/screens/RulesView";
import { MainMenu } from "./app/screens/MainMenu";
import { BattleScreen, type GamePhase } from "./app/screens/BattleScreen";
import {
  createBattle,
  createLog,
  getArmyCost,
  getTemplate,
} from "./core/battle-state";
import { buildActivationBag } from "./core/rules/activation";
import { createBattlefieldObject } from "./core/battlefield-objects";
import { createMissionState } from "./core/scenario/scenario-engine";
import { scenarios, survivalTestScenario } from "./core/scenario/scenarios";
import type { MissionState, ScenarioDefinition } from "./core/scenario/scenario-types";
import type { SavedBattle } from "./core/persistence/save-types";
import type {
  Army,
  Battle,
  BattlefieldObjectType,
  CombatLogEntry,
  FactionId,
  OrderType,
  TerrainTile,
  UnitInstance,
  UnitTemplate,
} from "./types";

type AppView = "home" | "setup" | "battle" | "composer" | "rules";
type AppTitle = Record<AppView, string>;
type DraftCounts = Record<string, number>;
const composerFactions: FactionId[] = ["Republic", "Separatists"];
const appTitles: AppTitle = {
  home: "Menu główne",
  setup: "Kreator scenariusza",
  battle: "Panel dowodzenia",
  composer: "Army Composer",
  rules: "Rules",
};

export function App() {
  const [view, setView] = useState<AppView>("home");
  const [battle, setBattle] = useState<Battle>(() => createBattle());
  const [mission, setMission] = useState<MissionState>(() =>
    createMissionState(survivalTestScenario, starterArmies),
  );
  const [missionArmies, setMissionArmies] = useState<Army[]>(() => structuredClone(starterArmies));
  const [logs, setLogs] = useState<CombatLogEntry[]>([
    createLog(1, "Bitwa gotowa. W worku aktywacji sa tokeny obu armii."),
  ]);
  const [activeArmyId, setActiveArmyId] = useState<string | undefined>();
  const [selectedUnitId, setSelectedUnitId] = useState<string>("");
  const [targetUnitId, setTargetUnitId] = useState<string>("");
  const [selectedWeaponId, setSelectedWeaponId] = useState<string>("");
  const [selectedOrder, setSelectedOrder] = useState<OrderType>("Move");
  const [armyJson, setArmyJson] = useState<string>(() => JSON.stringify(starterArmies, null, 2));
  const [importError, setImportError] = useState<string>("");
  const [debugMode, setDebugMode] = useState<boolean>(false);
  const [attackerBotEnabled, setAttackerBotEnabled] = useState<boolean>(true);
  const [gamePhase, setGamePhase] = useState<GamePhase>("Preparation");
  const activeScenario = scenarios.find((scenario) => scenario.id === mission.scenarioId)
    ?? survivalTestScenario;

  function addLog(message: string) {
    setLogs((current) => [createLog(battle.turn, message), ...current].slice(0, 12));
  }

  function loadArmies(
    armies: Army[],
    logMessage: string,
    scenario: ScenarioDefinition = activeScenario,
    defenderArmyId?: string,
  ) {
    const nextBattle = createBattle(armies);
    setBattle(nextBattle);
    setMission(createMissionState(scenario, nextBattle.armies, defenderArmyId));
    setMissionArmies(structuredClone(armies));
    setActiveArmyId(undefined);
    setSelectedUnitId("");
    setTargetUnitId("");
    setArmyJson(JSON.stringify(armies, null, 2));
    setImportError("");
    setLogs([createLog(1, logMessage)]);
    setGamePhase("Preparation");
  }

  function handleScenarioChange(scenarioId: string) {
    const nextScenario = scenarios.find((scenario) => scenario.id === scenarioId);
    if (!nextScenario) {
      return;
    }

    loadArmies(
      missionArmies,
      `Uruchomiono scenariusz: ${nextScenario.name}.`,
      nextScenario,
      mission.defenderArmyId,
    );
  }

  function handleDefenderArmyChange(defenderArmyId: string) {
    const defender = battle.armies.find((army) => army.id === defenderArmyId);
    const attacker = battle.armies.find((army) => army.id !== defenderArmyId);
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
    setLogs((current) => [
      createLog(
        battle.turn,
        `Role scenariusza: ${defender.faction} broni, ${attacker.faction} atakuje.`,
      ),
      ...current,
    ].slice(0, 12));
  }

  function handleUnitPatch(unitId: string, patch: Partial<UnitInstance>) {
    setBattle((current) => ({
      ...current,
      armies: current.armies.map((army) => ({
        ...army,
        units: army.units.map((unit) => (unit.id === unitId ? { ...unit, ...patch } : unit)),
      })),
    }));
  }

  function handleTerrainPaint(tile: TerrainTile) {
    if (gamePhase !== "Preparation") {
      return;
    }
    setBattle((current) => {
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
    setBattle((current) => {
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
      battle.armies.length < 2 ||
      battle.armies.some((army) => army.units.length === 0)
    ) {
      return;
    }

    const readyArmies = battle.armies.map((army) => ({
      ...army,
      units: army.units.map((unit) => ({
        ...unit,
        currentHp: getTemplate(unit).maxHp,
        suppression: 0,
        abilityCooldowns: {},
        activeEffects: [],
        movedThisTurn: false,
        status: "Ready" as const,
      })),
    }));
    const nextBattle: Battle = {
      ...createBattle(readyArmies),
      board: structuredClone(battle.board),
      activationBag: buildActivationBag(readyArmies),
    };
    const nextMission = {
      ...createMissionState(
        activeScenario,
        nextBattle.armies,
        mission.defenderArmyId,
      ),
      ...(mission.roundTarget ? { roundTarget: mission.roundTarget } : {}),
    };

    setBattle(nextBattle);
    setMission(nextMission);
    setMissionArmies(structuredClone(readyArmies));
    setActiveArmyId(undefined);
    setSelectedUnitId("");
    setTargetUnitId("");
    setSelectedWeaponId("");
    setLogs([createLog(1, `Rozpoczęto scenariusz: ${activeScenario.name}.`)]);
    setGamePhase("Playing");
    setView("battle");
  }

  function handleLoadSavedBattle(savedBattle: SavedBattle) {
    const loadedMission = {
      ...createMissionState(
        scenarios.find((scenario) => scenario.id === savedBattle.mission?.scenarioId)
          ?? survivalTestScenario,
        savedBattle.battle.armies,
        savedBattle.mission?.defenderArmyId,
      ),
      ...savedBattle.mission,
    };
    setBattle(savedBattle.battle);
    setMission(loadedMission);
    setMissionArmies(structuredClone(savedBattle.battle.armies));
    setLogs(savedBattle.logs);
    setActiveArmyId(savedBattle.battle.activeActivation?.armyId);
    setSelectedUnitId("");
    setTargetUnitId("");
    setSelectedWeaponId("");
    setGamePhase("Playing");
    setView("battle");
  }

  return (
    <main className="app">
      {view === "home" ? (
        <MainMenu
          onNewScenario={() => {
            loadArmies(
              starterArmies,
              "Rozpoczęto przygotowanie nowego scenariusza.",
              survivalTestScenario,
            );
            setView("setup");
          }}
          onOpenComposer={() => setView("composer")}
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
            <button onClick={() => setView("composer")}>Army Composer</button>
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
          <strong>{battle.turn}</strong>
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
          attackerBotEnabled={attackerBotEnabled}
          battle={battle}
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
          onAttackerBotEnabledChange={setAttackerBotEnabled}
          onBattleChange={setBattle}
          onGamePhaseChange={setGamePhase}
          onImportError={setImportError}
          onLoadArmies={loadArmies}
          onLogsChange={setLogs}
          onMissionChange={setMission}
          onBattlefieldObjectPlace={handleBattlefieldObjectPlace}
          onDefenderArmyChange={handleDefenderArmyChange}
          onScenarioChange={handleScenarioChange}
          onMissionRestart={() => {
            loadArmies(
              missionArmies,
              "Misja zostala uruchomiona ponownie.",
              activeScenario,
              mission.defenderArmyId,
            );
            setView("setup");
          }}
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
          currentArmies={battle.armies}
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
  const [leftName, setLeftName] = useState(currentArmies[0]?.playerName ?? "Gracz 1");
  const [leftFaction, setLeftFaction] = useState<FactionId>(currentArmies[0]?.faction ?? "Republic");
  const [leftCounts, setLeftCounts] = useState<DraftCounts>(() => countsFromArmy(currentArmies[0]));
  const [rightName, setRightName] = useState(currentArmies[1]?.playerName ?? "Gracz 2");
  const [rightFaction, setRightFaction] = useState<FactionId>(
    currentArmies[1]?.faction ?? "Separatists",
  );
  const [rightCounts, setRightCounts] = useState<DraftCounts>(() => countsFromArmy(currentArmies[1]));

  const armies = useMemo(
    () => [
      buildArmyFromDraft("army_player_1", leftName, leftFaction, leftCounts, 1),
      buildArmyFromDraft("army_player_2", rightName, rightFaction, rightCounts, 2),
    ],
    [leftCounts, leftFaction, leftName, rightCounts, rightFaction, rightName],
  );
  const generatedJson = JSON.stringify(armies, null, 2);

  return (
    <section className="composerLayout">
      <ComposerColumn
        counts={leftCounts}
        faction={leftFaction}
        playerName={leftName}
        sideLabel="Armia A"
        onCountsChange={setLeftCounts}
        onFactionChange={setLeftFaction}
        onPlayerNameChange={setLeftName}
      />
      <ComposerColumn
        counts={rightCounts}
        faction={rightFaction}
        playerName={rightName}
        sideLabel="Armia B"
        onCountsChange={setRightCounts}
        onFactionChange={setRightFaction}
        onPlayerNameChange={setRightName}
      />
      <aside className="composerSummary">
        <PanelTitle title="Gotowa lista" detail={`${getArmyCost(armies[0])} / ${getArmyCost(armies[1])} pkt`} />
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
}: {
  counts: DraftCounts;
  faction: FactionId;
  playerName: string;
  sideLabel: string;
  onCountsChange: (counts: DraftCounts) => void;
  onFactionChange: (faction: FactionId) => void;
  onPlayerNameChange: (name: string) => void;
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
        <strong>{cost} pkt</strong>
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

function buildArmyFromDraft(
  armyId: string,
  playerName: string,
  faction: FactionId,
  counts: DraftCounts,
  sideIndex: number,
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
