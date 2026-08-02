import { useMemo, useState } from "react";
import { abilities } from "../../data";
import { BattleSavePanel } from "../components/BattleSavePanel";
import { MissionPanel } from "../components/MissionPanel";
import { PanelTitle } from "../components/PanelTitle";
import { BattleActionBar } from "../battle/BattleActionBar";
import { BattleInspector } from "../battle/BattleInspector";
import { BattleLogDrawer, type BattleDrawerTab } from "../battle/BattleLogDrawer";
import { BattleShell } from "../battle/BattleShell";
import { SetupToolRail, type SetupToolMode } from "../battle/SetupToolRail";
import { createInitialBattleSnapshot } from "../scenario-draft";
import type { GamePhase } from "../types/game-phase";
import { chooseAttackerBotAction } from "../../core/ai/attacker-bot";
import { getArmyCost, getTemplate, getVictoryState } from "../../core/battle-state";
import type { BattleAction } from "../../core/battle-actions";
import {
  battlefieldObjectPresets,
} from "../../core/battlefield-objects";
import { getUnitActiveAbilities } from "../../core/rules/active-abilities";
import {
  canEndTurn,
  getRemainingActivationCount,
} from "../../core/rules/activation";
import { isPositionFree } from "../../core/rules/occupancy";
import { createMissionState } from "../../core/scenario/scenario-engine";
import { applyMissionAction } from "../../core/scenario/mission-session";
import type { MissionState, ScenarioDefinition } from "../../core/scenario/scenario-types";
import { terrainPresets } from "../../core/terrain-presets";
import type {
  Army,
  Battle,
  BattlefieldObjectType,
  CombatLogEntry,
  OrderType,
  TerrainTile,
  TerrainType,
  UnitInstance,
} from "../../types";
import { BattlefieldView } from "../../battlefield/BattlefieldView";
import { getUnitInitials } from "../../presentation/unit-presentation";

type PendingAdvance = {
  attackerId: string;
  attackerName: string;
  defenderName: string;
  targetPosition: {
    x: number;
    y: number;
  };
};

const orders: OrderType[] = ["Move", "Advance", "Attack", "Rally", "Overwatch"];

export function BattleScreen({
  activeArmyId,
  armyJson,
  attackerBotEnabled,
  battle,
  initialBattle,
  gamePhase,
  debugMode,
  importError,
  logs,
  mission,
  scenario,
  scenarioOptions,
  selectedOrder,
  selectedUnitId,
  selectedWeaponId,
  targetUnitId,
  onActiveArmyChange,
  onAddLog,
  onArmyJsonChange,
  onAttackerBotEnabledChange,
  onBattleChange,
  onInitialBattleChange,
  onGamePhaseChange,
  onImportError,
  onLoadArmies,
  onLogsChange,
  onBattlefieldObjectPlace,
  onDefenderArmyChange,
  onMissionChange,
  onMissionRestart,
  onStartScenario,
  onScenarioChange,
  onOrderChange,
  onSelectedUnitChange,
  onSelectedWeaponChange,
  onTargetUnitChange,
  onTerrainPaint,
  onUnitPatch,
}: {
  activeArmyId?: string;
  armyJson: string;
  attackerBotEnabled: boolean;
  battle: Battle;
  initialBattle?: Battle;
  gamePhase: GamePhase;
  debugMode: boolean;
  importError: string;
  logs: CombatLogEntry[];
  mission: MissionState;
  scenario: ScenarioDefinition;
  scenarioOptions: ScenarioDefinition[];
  selectedOrder: OrderType;
  selectedUnitId: string;
  selectedWeaponId: string;
  targetUnitId: string;
  onActiveArmyChange: (armyId: string | undefined) => void;
  onAddLog: (message: string) => void;
  onArmyJsonChange: (json: string) => void;
  onAttackerBotEnabledChange: (enabled: boolean) => void;
  onBattleChange: (battle: Battle) => void;
  onInitialBattleChange: (battle: Battle) => void;
  onGamePhaseChange: (phase: GamePhase) => void;
  onImportError: (error: string) => void;
  onLoadArmies: (armies: Army[], logMessage: string) => void;
  onLogsChange: (logs: CombatLogEntry[]) => void;
  onBattlefieldObjectPlace: (
    type: BattlefieldObjectType | undefined,
    position: { x: number; y: number },
  ) => void;
  onDefenderArmyChange: (armyId: string) => void;
  onMissionChange: (mission: MissionState) => void;
  onMissionRestart: () => void;
  onStartScenario: () => void;
  onScenarioChange: (scenarioId: string) => void;
  onOrderChange: (order: OrderType) => void;
  onSelectedUnitChange: (unitId: string) => void;
  onSelectedWeaponChange: (weaponId: string) => void;
  onTargetUnitChange: (unitId: string) => void;
  onTerrainPaint: (tile: TerrainTile) => void;
  onUnitPatch: (unitId: string, patch: Partial<UnitInstance>) => void;
}) {
  const [pendingAdvance, setPendingAdvance] = useState<PendingAdvance | null>(null);
  const [selectedAbilityId, setSelectedAbilityId] = useState("");
  const [abilityTargetUnitId, setAbilityTargetUnitId] = useState("");
  const [abilityTargetPosition, setAbilityTargetPosition] = useState<{ x: number; y: number }>();
  const [selectingAbilityPosition, setSelectingAbilityPosition] = useState(false);
  const [selectingMovePosition, setSelectingMovePosition] = useState(false);
  const [intelTab, setIntelTab] = useState<BattleDrawerTab>("logs");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [mapMode, setMapMode] = useState<SetupToolMode>("units");
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainType>("LightCover");
  const [selectedObjectType, setSelectedObjectType] = useState<
    BattlefieldObjectType | "Remove"
  >("DefensePoint");
  const allUnits = useMemo(() => battle.armies.flatMap((army) => army.units), [battle.armies]);
  const selectedUnit = allUnits.find((unit) => unit.id === selectedUnitId);
  const selectedTemplate = selectedUnit ? getTemplate(selectedUnit) : undefined;
  const selectedArmy = selectedUnit
    ? battle.armies.find((army) => army.id === selectedUnit.armyId)
    : undefined;
  const selectedTerrainPreset =
    terrainPresets.find((terrain) => terrain.terrainType === selectedTerrain) ?? terrainPresets[0];
  const availableWeapons = selectedTemplate?.weapons ?? [];
  const activeAbilities = selectedUnit
    ? getUnitActiveAbilities(battle, selectedUnit)
    : [];
  const selectedAbility = activeAbilities.find((ability) => ability.id === selectedAbilityId)
    ?? activeAbilities[0];
  const activeWeaponId = availableWeapons.some((weapon) => weapon.id === selectedWeaponId)
    ? selectedWeaponId
    : availableWeapons[0]?.id || "";
  const availableTargets = allUnits.filter(
    (unit) => unit.armyId !== selectedUnit?.armyId && unit.status !== "Destroyed",
  );
  const availableObjectTargets = (battle.board.objects ?? []).filter(
    (object) => object.destructible && object.status === "Active",
  );
  const remainingActivations = getRemainingActivationCount(battle);
  const livingUnits = allUnits.filter((unit) => unit.status !== "Destroyed").length;
  const turnCanEnd = canEndTurn(battle);
  const missionActive = mission.status === "Active" && gamePhase === "Playing";
  const preparationActive = gamePhase === "Preparation";
  const canStartScenario =
    battle.armies.length >= 2 &&
    battle.armies.every((army) => army.units.length > 0);

  function executeMissionAction(action: BattleAction) {
    const result = applyMissionAction(
      { battle, mission },
      scenario,
      action,
    );

    onBattleChange(result.battle);
    onMissionChange(result.mission);
    result.missionEvents.forEach((event) => onAddLog(event.message));
    return result;
  }

  function handleCellClick(x: number, y: number) {
    if (selectingAbilityPosition) {
      setAbilityTargetPosition({ x, y });
      setSelectingAbilityPosition(false);
      return;
    }

    if (mapMode === "terrain") {
      if (!preparationActive) return;
      onTerrainPaint({ ...selectedTerrainPreset, x, y });
      return;
    }

    if (mapMode === "objects") {
      if (!preparationActive) return;
      onBattlefieldObjectPlace(
        selectedObjectType === "Remove" ? undefined : selectedObjectType,
        { x, y },
      );
      return;
    }

    if (!selectedUnit || selectedUnit.status === "Destroyed") {
      return;
    }

    if (preparationActive) {
      if (!isPositionFree(battle, { x, y }, selectedUnit.id)) {
        onAddLog(`Pole ${x}, ${y} jest już zajęte.`);
        return;
      }
      onUnitPatch(selectedUnit.id, { position: { x, y } });
      return;
    }

    if (!missionActive) {
      return;
    }

    if (selectedOrder !== "Move" && selectedOrder !== "Advance") {
      onAddLog("Aby poruszyć jednostkę, wybierz rozkaz Move albo Advance.");
      return;
    }

    const result = executeMissionAction(
      selectedUnit.position
        ? {
            type: selectedOrder === "Advance" ? "AdvanceUnit" : "MoveUnit",
            unitId: selectedUnit.id,
            targetPosition: { x, y },
          }
        : {
            type: "DeployUnit",
            unitId: selectedUnit.id,
            targetPosition: { x, y },
          },
    );
    const actionSucceeded = result.battle !== battle;
    setSelectingMovePosition(!actionSucceeded);
    if (!actionSucceeded) {
      setIntelTab("logs");
      setDrawerOpen(true);
    }
    onActiveArmyChange(result.battle.activeActivation?.armyId);
    onAddLog(result.log);
  }

  function handleDrawActivation() {
    setPendingAdvance(null);
    const drawResult = applyMissionAction(
      { battle, mission },
      scenario,
      { type: "DrawActivation" },
    );
    let finalBattle = drawResult.battle;
    let finalMission = drawResult.mission;

    onAddLog(
      drawResult.events.some((event) => event.type === "ActivationDrawn")
        ? drawResult.log
        : "Worek aktywacji jest pusty. Czas zakonczyc ture.",
    );
    drawResult.missionEvents.forEach((event) => onAddLog(event.message));

    if (
      attackerBotEnabled &&
      mission.attackerArmyId &&
      drawResult.battle.activeActivation?.armyId === mission.attackerArmyId
    ) {
      for (let botStep = 0; botStep < 2 && finalBattle.activeActivation; botStep += 1) {
        const decision = chooseAttackerBotAction(
          finalBattle,
          scenario,
          mission.attackerArmyId,
          finalMission,
        );

        if (!decision) {
          onAddLog("Bot atakujacy nie znalazl legalnej akcji. Token pozostaje aktywny.");
          break;
        }

        onAddLog(`Bot atakujacy: ${decision.reason}`);
        const botResult = applyMissionAction(
          { battle: finalBattle, mission: finalMission },
          scenario,
          decision.action,
        );
        finalBattle = botResult.battle;
        finalMission = botResult.mission;
        onAddLog(botResult.log);
        botResult.missionEvents.forEach((event) => onAddLog(event.message));
      }
    }

    onBattleChange(finalBattle);
    onMissionChange(finalMission);
    onActiveArmyChange(finalBattle.activeActivation?.armyId);
  }

  function handleOrder() {
    setPendingAdvance(null);

    if (
      selectedOrder === "Move" ||
      (selectedOrder === "Advance" &&
        !selectedUnit?.activeEffects?.includes("advance_pending"))
    ) {
      setSelectingMovePosition(true);
      onAddLog(
        selectedOrder === "Advance"
          ? "Wskaż na mapie pole ruchu dla rozkazu Advance."
          : "Wskaż na mapie pole docelowe dla rozkazu Move.",
      );
      return;
    }

    if (selectedOrder === "Attack") {
      onAddLog("Wybierz broń i cel, a następnie użyj przycisku Atakuj.");
      return;
    }

    const result = executeMissionAction({
      type: "ApplyOrder",
      unitId: selectedUnitId,
      order: selectedOrder,
    });
    onActiveArmyChange(result.battle.activeActivation?.armyId);
    onAddLog(result.log);
  }

  function handleUseAbility() {
    if (!selectedUnit || !selectedAbility) {
      return;
    }
    const result = executeMissionAction({
      type: "UseAbility",
      unitId: selectedUnit.id,
      abilityId: selectedAbility.id,
      ...(abilityTargetUnitId ? { targetUnitId: abilityTargetUnitId } : {}),
      ...(abilityTargetPosition ? { targetPosition: abilityTargetPosition } : {}),
    });
    onActiveArmyChange(result.battle.activeActivation?.armyId);
    onAddLog(result.log);
    setAbilityTargetPosition(undefined);
    setSelectingAbilityPosition(false);
  }

  function handleAttack() {
    const objectId = targetUnitId.startsWith("object:")
      ? targetUnitId.slice("object:".length)
      : undefined;
    const result = executeMissionAction(objectId
      ? {
          type: "AttackObject",
          attackerId: selectedUnitId,
          objectId,
          weaponId: activeWeaponId,
        }
      : {
          type: "Attack",
          attackerId: selectedUnitId,
          defenderId: targetUnitId,
          weaponId: activeWeaponId,
        });
    onActiveArmyChange(result.battle.activeActivation?.armyId);
    onAddLog(result.log);

    if (
      result.mission.status === "Active" &&
      result.attackResult?.destroyed &&
      result.attackResult.defenderPosition
    ) {
      const attacker = allUnits.find((unit) => unit.id === result.attackResult?.attackerId);
      const defender = allUnits.find((unit) => unit.id === result.attackResult?.defenderId);

      if (attacker && defender) {
        setPendingAdvance({
          attackerId: attacker.id,
          attackerName: getTemplate(attacker).name,
          defenderName: getTemplate(defender).name,
          targetPosition: result.attackResult.defenderPosition,
        });
      }
    } else {
      setPendingAdvance(null);
    }

    if (result.battle.phase === "Finished") {
      onAddLog(getVictoryLog(result.battle));
    }
  }

  function handleEndTurn() {
    setPendingAdvance(null);
    const result = executeMissionAction({ type: "EndTurn" });
    onActiveArmyChange(result.battle.activeActivation?.armyId);
    onAddLog(result.log);
    if (result.battle.phase === "Finished") {
      onAddLog(getVictoryLog(result.battle));
    }
  }

  function handleLoadArmies() {
    try {
      setPendingAdvance(null);
      const parsed = JSON.parse(armyJson) as Army[];
      if (!Array.isArray(parsed) || parsed.length < 2) {
        throw new Error("JSON musi zawierac tablice co najmniej dwoch armii.");
      }

      onLoadArmies(parsed, "Wczytano armie i przebudowano worek aktywacji.");
    } catch (error) {
      onImportError(error instanceof Error ? error.message : "Nie udalo sie wczytac armii.");
    }
  }

  function handleAdvanceAfterCombat() {
    if (!missionActive || !pendingAdvance) {
      return;
    }

    onUnitPatch(pendingAdvance.attackerId, { position: pendingAdvance.targetPosition });
    onAddLog(
      `${pendingAdvance.attackerName} zajmuje pozycje po ${pendingAdvance.defenderName}: ${pendingAdvance.targetPosition.x}, ${pendingAdvance.targetPosition.y}.`,
    );
    setPendingAdvance(null);
  }

  function handleHoldAfterCombat() {
    if (!missionActive || !pendingAdvance) {
      return;
    }

    onAddLog(`${pendingAdvance.attackerName} zostaje na swojej pozycji po starciu.`);
    setPendingAdvance(null);
  }

  function handleBattleLoad(
    loadedBattle: Battle,
    loadedLogs: CombatLogEntry[],
    loadedMission?: MissionState,
    loadedInitialBattle?: Battle,
  ) {
    setPendingAdvance(null);
    const missionWithRoles = {
      ...createMissionState(scenario, loadedBattle.armies, loadedMission?.defenderArmyId),
      ...loadedMission,
    };
    onBattleChange(structuredClone(loadedBattle));
    onInitialBattleChange(
      loadedInitialBattle
        ? structuredClone(loadedInitialBattle)
        : createInitialBattleSnapshot(loadedBattle),
    );
    onMissionChange(missionWithRoles);
    onLogsChange(loadedLogs);
    onActiveArmyChange(loadedBattle.activeActivation?.armyId);
    onSelectedUnitChange("");
    onTargetUnitChange("");
    onSelectedWeaponChange("");
    onGamePhaseChange("Playing");
  }

  return (
    <BattleShell
      phase={gamePhase}
      setupTools={preparationActive ? (
        <SetupToolRail mode={mapMode} onModeChange={setMapMode}>
          {mapMode === "units" ? (
            <select
              value={selectedUnitId}
              onChange={(event) => onSelectedUnitChange(event.target.value)}
            >
              <option value="">Wybierz oddział</option>
              {allUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {getTemplate(unit).name} -{" "}
                  {unit.position ? `${unit.position.x},${unit.position.y}` : "rezerwa"}
                </option>
              ))}
            </select>
          ) : mapMode === "terrain" ? (
            <>
              <select
                value={selectedTerrain}
                onChange={(event) => setSelectedTerrain(event.target.value)}
              >
                {terrainPresets.map((terrain) => (
                  <option key={terrain.terrainType} value={terrain.terrainType}>
                    {terrain.terrainType}
                  </option>
                ))}
              </select>
              <div className="mapReadout">
                <strong>{selectedTerrainPreset.terrainType}</strong>
                <span>Obrona: +{selectedTerrainPreset.defenseBonus}</span>
                <span>Atak: +{selectedTerrainPreset.attackBonus}</span>
                <span>Koszt ruchu: {selectedTerrainPreset.movementCost}</span>
                <span>
                  Blokuje LOS: {selectedTerrainPreset.blocksLineOfSight ? "tak" : "nie"}
                </span>
              </div>
            </>
          ) : (
            <>
              <select
                value={selectedObjectType}
                onChange={(event) =>
                  setSelectedObjectType(
                    event.target.value as BattlefieldObjectType | "Remove",
                  )
                }
              >
                {battlefieldObjectPresets.map((object) => (
                  <option key={object.type} value={object.type}>
                    {object.name}{object.destructible ? ` | HP ${object.maxHp}` : ""}
                  </option>
                ))}
                <option value="Remove">Usuń obiekt z pola</option>
              </select>
              <div className="mapReadout">
                <strong>Obiekty pola bitwy</strong>
                <span>Kliknij pole, aby postawić lub usunąć wybrany obiekt.</span>
                <span>Osłony dodają obronę jednostkom na tym samym polu.</span>
              </div>
            </>
          )}
        </SetupToolRail>
      ) : undefined}
      inspector={(
        <BattleInspector phase={gamePhase}>
          <MissionPanel
            armies={battle.armies}
            attackerBotEnabled={attackerBotEnabled}
            canStart={canStartScenario}
            gamePhase={gamePhase}
            mission={mission}
            scenario={scenario}
            scenarios={scenarioOptions}
            onScenarioChange={onScenarioChange}
            onAttackerBotEnabledChange={onAttackerBotEnabledChange}
            onDefenderArmyChange={onDefenderArmyChange}
            onRoundTargetChange={(rounds) =>
              onMissionChange({
                ...mission,
                roundTarget: Math.max(1, Math.floor(rounds || 1)),
                roundsCompleted: 0,
              })
            }
            onRestart={onMissionRestart}
            onStart={onStartScenario}
          />

          {preparationActive && mapMode === "units" ? (
            <UnitDetails
              debugMode={false}
              selectedArmy={selectedArmy}
              selectedUnit={selectedUnit}
              onUnitPatch={onUnitPatch}
            />
          ) : null}

          {!preparationActive ? (
            <>
              <div className="playingSideSummary">
                <PanelTitle title="Rozgrywka" detail={`Tura ${battle.turn}`} />
                <span>{scenario.name}</span>
                <span>Aktywacje: {remainingActivations}/{livingUnits}</span>
                <span>
                  {activeArmyId
                    ? `Aktywna: ${
                        battle.armies.find((army) => army.id === activeArmyId)?.playerName
                      }`
                    : "Oczekiwanie na losowanie"}
                </span>
              </div>
              <UnitDetails
                debugMode={false}
                selectedArmy={selectedArmy}
                selectedUnit={selectedUnit}
                onUnitPatch={onUnitPatch}
              />
              <BattleSavePanel
                battle={battle}
                initialBattle={initialBattle}
                logs={logs}
                mission={mission}
                onBattleLoad={handleBattleLoad}
              />
            </>
          ) : null}

          {preparationActive ? (
            <details className="jsonDetails">
              <summary>Import armii JSON</summary>
              <textarea
                className="armyInput jsonInput"
                value={armyJson}
                spellCheck={false}
                wrap="off"
                onChange={(event) => onArmyJsonChange(event.target.value)}
              />
              {importError ? <p className="errorText">{importError}</p> : null}
              <button className="secondaryButton" onClick={handleLoadArmies}>
                Wczytaj armie
              </button>
            </details>
          ) : null}
        </BattleInspector>
      )}
      actionBar={missionActive ? (
        <BattleActionBar>
          <section className="battleHud">
            <div className="hudActivation">
              <button
                className="primaryButton"
                disabled={Boolean(battle.activeActivation) || remainingActivations === 0}
                onClick={handleDrawActivation}
              >
                Losuj aktywację
              </button>
              <span>
                {activeArmyId
                  ? battle.armies.find((army) => army.id === activeArmyId)?.playerName
                  : `${remainingActivations} pozostało`}
              </span>
            </div>

            <label>
              Jednostka
              <select
                value={selectedUnitId}
                onChange={(event) => onSelectedUnitChange(event.target.value)}
              >
                <option value="">Kliknij jednostkę lub wybierz</option>
                {allUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {getTemplate(unit).name} | {unit.status}
                  </option>
                ))}
              </select>
            </label>

            <label>
              Rozkaz
              <select
                value={selectedOrder}
                onChange={(event) => onOrderChange(event.target.value as OrderType)}
              >
                {orders.map((order) => (
                  <option key={order} value={order}>{order}</option>
                ))}
              </select>
            </label>
            <button
              className="secondaryButton"
              disabled={!selectedUnitId || !activeArmyId}
              onClick={handleOrder}
            >
              {!selectedUnit?.position &&
              (selectedOrder === "Move" || selectedOrder === "Advance")
                ? selectingMovePosition
                  ? "Kliknij pole wejścia…"
                  : "Wskaż wejście"
                : selectingMovePosition &&
              (selectedOrder === "Move" || selectedOrder === "Advance")
                ? "Kliknij pole…"
                : selectedOrder === "Move"
                  ? "Wskaż pole"
                : selectedOrder === "Advance" &&
                    selectedUnit?.activeEffects?.includes("advance_pending")
                  ? "Zakończ Advance"
                  : selectedOrder === "Advance"
                    ? "Wskaż pole"
                    : selectedOrder === "Attack"
                      ? "Wybierz cel"
                      : "Wykonaj"}
            </button>

            <label>
              Broń
              <select
                value={activeWeaponId}
                disabled={!selectedUnitId}
                onChange={(event) => onSelectedWeaponChange(event.target.value)}
              >
                <option value="">Wybierz broń</option>
                {availableWeapons.map((weapon) => (
                  <option key={weapon.id} value={weapon.id}>
                    {weapon.name} | R{weapon.range} A{weapon.attacks}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Cel
              <select
                value={targetUnitId}
                onChange={(event) => onTargetUnitChange(event.target.value)}
              >
                <option value="">Wybierz cel</option>
                {availableTargets.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {getTemplate(unit).name}
                  </option>
                ))}
                {availableObjectTargets.map((object) => (
                  <option key={object.id} value={`object:${object.id}`}>
                    {object.name} | {object.currentHp} HP
                  </option>
                ))}
              </select>
            </label>
            <button
              className="dangerButton"
              disabled={!selectedUnitId || !targetUnitId || !activeArmyId || !activeWeaponId}
              onClick={handleAttack}
            >
              Atakuj
            </button>

            <details className="hudAbility">
              <summary>Zdolność{selectedAbility ? `: ${selectedAbility.name}` : ""}</summary>
              {activeAbilities.length > 0 ? (
                <div className="hudAbilityControls">
                  <select
                    value={selectedAbility?.id ?? ""}
                    onChange={(event) => {
                      setSelectedAbilityId(event.target.value);
                      setAbilityTargetPosition(undefined);
                    }}
                  >
                    {activeAbilities.map((ability) => (
                      <option key={ability.id} value={ability.id}>
                        {ability.name} | CD{" "}
                        {selectedUnit?.abilityCooldowns?.[ability.id] ?? 0}
                      </option>
                    ))}
                  </select>
                  <select
                    value={abilityTargetUnitId}
                    onChange={(event) => setAbilityTargetUnitId(event.target.value)}
                  >
                    <option value="">Brak celu jednostkowego</option>
                    {allUnits
                      .filter(
                        (unit) =>
                          unit.id !== selectedUnitId && unit.status !== "Destroyed",
                      )
                      .map((unit) => (
                        <option key={unit.id} value={unit.id}>
                          {getTemplate(unit).name}
                        </option>
                      ))}
                  </select>
                  <button
                    className="secondaryButton"
                    onClick={() => setSelectingAbilityPosition((current) => !current)}
                  >
                    {selectingAbilityPosition
                      ? "Kliknij pole"
                      : abilityTargetPosition
                        ? `${abilityTargetPosition.x}, ${abilityTargetPosition.y}`
                        : "Cel pola"}
                  </button>
                  <button
                    className="primaryButton"
                    disabled={
                      !activeArmyId ||
                      !selectedAbility ||
                      (selectedUnit?.abilityCooldowns?.[selectedAbility.id] ?? 0) > 0
                    }
                    onClick={handleUseAbility}
                  >
                    Użyj
                  </button>
                </div>
              ) : (
                <p>Brak aktywnych zdolności.</p>
              )}
            </details>

            <button
              className="secondaryButton"
              disabled={!turnCanEnd}
              onClick={handleEndTurn}
            >
              {remainingActivations > 0
                ? `${remainingActivations} aktywacji`
                : "Koniec tury"}
            </button>
          </section>
        </BattleActionBar>
      ) : undefined}
      battlefield={(
        <BattlefieldView
          battle={battle}
          enableRendererSwitch={debugMode}
          interactionDisabled={gamePhase === "Playing" && !missionActive}
          mission={mission}
          selectedUnitId={selectedUnitId}
          onCellClick={handleCellClick}
          onSelectedUnitChange={onSelectedUnitChange}
        />
      )}
      overlay={(
        <>
          {pendingAdvance ? (
            <div className="decisionPanel compactDecision">
              <p>
                {pendingAdvance.attackerName} pokonał {pendingAdvance.defenderName}.
              </p>
              <div className="decisionActions">
                <button className="primaryButton" onClick={handleAdvanceAfterCombat}>
                  Zajmij pozycję
                </button>
                <button className="secondaryButton" onClick={handleHoldAfterCombat}>
                  Zostań
                </button>
              </div>
            </div>
          ) : null}
          {mission.status !== "Active" ? (
            <MissionSummary mission={mission} scenario={scenario} />
          ) : battle.phase === "Finished" ? (
            <BattleSummary battle={battle} />
          ) : null}
        </>
      )}
      drawer={(
        <BattleLogDrawer
          activeTab={intelTab}
          open={drawerOpen}
          onOpenChange={setDrawerOpen}
          onTabChange={setIntelTab}
          armies={(
            <div className="armiesGrid intelContent">
              {battle.armies.map((army) => (
                <ArmyColumn
                  key={army.id}
                  army={army}
                  debugMode={debugMode && preparationActive}
                  selectedUnitId={selectedUnitId}
                  onSelect={onSelectedUnitChange}
                  onPatch={onUnitPatch}
                />
              ))}
            </div>
          )}
          logs={(
            <div className="logs intelContent">
              {logs.map((entry) => (
                <div className="logEntry" key={entry.id}>
                  <span>T{entry.turn}</span>
                  <p>{entry.message}</p>
                </div>
              ))}
            </div>
          )}
        />
      )}
    />
  );
}

function MissionSummary({
  mission,
  scenario,
}: {
  mission: MissionState;
  scenario: ScenarioDefinition;
}) {
  const outcomeMessage = mission.status === "Victory"
    ? "Cel scenariusza zostal wykonany."
    : "Warunek porazki scenariusza zostal spelniony.";

  return (
    <section className="battleSummary">
      <PanelTitle
        title="Podsumowanie misji"
        detail={mission.status === "Victory" ? "Zwyciestwo" : "Porazka"}
      />
      <p className="tokenReadout">
        {outcomeMessage} Ukonczono {mission.roundsCompleted} z{" "}
        {mission.roundTarget ?? scenario.victoryCondition.rounds} rund.
      </p>
    </section>
  );
}

function BattleSummary({ battle }: { battle: Battle }) {
  const victory = getVictoryState(battle);
  const winner = battle.armies.find((army) => army.id === victory.winnerArmyId);

  return (
    <section className="battleSummary">
      <PanelTitle
        title="Podsumowanie bitwy"
        detail={winner ? `Zwyciezca: ${winner.playerName}` : "Brak zwyciezcy"}
      />
      <div className="summaryGrid">
        {battle.armies.map((army) => {
          const survivingUnits = army.units.filter((unit) => unit.status !== "Destroyed");
          const destroyedUnits = army.units.filter((unit) => unit.status === "Destroyed");
          const remainingHp = survivingUnits.reduce((total, unit) => total + unit.currentHp, 0);
          const suppression = survivingUnits.reduce((total, unit) => total + unit.suppression, 0);

          return (
            <article
              className={army.id === victory.winnerArmyId ? "summaryArmy winner" : "summaryArmy"}
              key={army.id}
            >
              <div className="summaryArmyHeader">
                <div>
                  <p className="eyebrow">{army.faction}</p>
                  <h3>{army.playerName}</h3>
                </div>
                <strong>{army.id === victory.winnerArmyId ? "Victory" : "Defeated"}</strong>
              </div>
              <div className="summaryStats">
                <span>Ocalałe: {survivingUnits.length}</span>
                <span>Straty: {destroyedUnits.length}</span>
                <span>HP: {remainingHp}</span>
                <span>Suppression: {suppression}</span>
              </div>
              <div className="summaryUnits">
                {army.units.map((unit) => (
                  <div className="summaryUnit" key={unit.id}>
                    <span>{getTemplate(unit).name}</span>
                    <small>
                      {unit.status} | HP {unit.currentHp}/{getTemplate(unit).maxHp} | SUP{" "}
                      {unit.suppression}
                    </small>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </section>
  );
}

function UnitDetails({
  debugMode,
  selectedArmy,
  selectedUnit,
  onUnitPatch,
}: {
  debugMode: boolean;
  selectedArmy?: Army;
  selectedUnit?: UnitInstance;
  onUnitPatch: (unitId: string, patch: Partial<UnitInstance>) => void;
}) {
  if (!selectedUnit) {
    return (
      <div className="mapReadout">
        <span>Wybierz oddzial z listy albo kliknij token na mapie.</span>
      </div>
    );
  }

  const template = getTemplate(selectedUnit);

  return (
    <div className="mapReadout unitDetailPanel">
      <div className="unitPortrait">
        {template.imageUrl ? (
          <img
            key={template.imageUrl}
            src={template.imageUrl}
            alt={template.name}
            onLoad={(event) => {
              event.currentTarget.hidden = false;
            }}
            onError={(event) => {
              event.currentTarget.hidden = true;
            }}
          />
        ) : null}
        <div className="unitPortraitFallback">{getUnitInitials(template)}</div>
      </div>
      <div className="unitDetailHeader">
        <strong>{template.name}</strong>
        <span>{selectedArmy?.faction ?? "Unknown"} | {template.role}</span>
      </div>
      <div className="unitDetailStats">
        <span>HP {selectedUnit.currentHp}/{template.maxHp}</span>
        <span>SUP {selectedUnit.suppression}</span>
        <span>MOV {template.movement}</span>
        <span>SV {template.armorSave ? `${template.armorSave}+` : "-"}</span>
      </div>
      <span>Stan: {selectedUnit.position ? "na mapie" : "rezerwa / posilki"}</span>
      <span>
        Pole:{" "}
        {selectedUnit.position
          ? `${selectedUnit.position.x}, ${selectedUnit.position.y}`
          : "poza mapa"}
      </span>
      <div className="unitWeaponList">
        {template.weapons.map((weapon) => (
          <span key={weapon.id}>
            {weapon.name} | R{weapon.range} A{weapon.attacks} D{weapon.damage}
          </span>
        ))}
      </div>
      {debugMode ? (
        <>
          <button
            className="secondaryButton"
            disabled={!selectedUnit.position}
            onClick={() => onUnitPatch(selectedUnit.id, { position: null })}
          >
            Przenies do rezerw
          </button>
        </>
      ) : null}
    </div>
  );
}

function ArmyColumn({
  army,
  debugMode,
  selectedUnitId,
  onSelect,
  onPatch,
}: {
  army: Army;
  debugMode: boolean;
  selectedUnitId: string;
  onSelect: (unitId: string) => void;
  onPatch: (unitId: string, patch: Partial<UnitInstance>) => void;
}) {
  return (
    <section className={`armyColumn ${army.faction.toLowerCase().replaceAll(" ", "-")}`}>
      <div className="armyHeader">
        <div>
          <p className="eyebrow">{army.faction}</p>
          <h2>{army.playerName}</h2>
        </div>
        <strong>{getArmyCost(army)} pkt</strong>
      </div>

      <div className="unitList">
        {army.units.map((unit) => (
          <UnitCard
            key={unit.id}
            debugMode={debugMode}
            unit={unit}
            selected={unit.id === selectedUnitId}
            onSelect={() => onSelect(unit.id)}
            onPatch={onPatch}
          />
        ))}
      </div>
    </section>
  );
}

function UnitCard({
  debugMode,
  unit,
  selected,
  onSelect,
  onPatch,
}: {
  debugMode: boolean;
  unit: UnitInstance;
  selected: boolean;
  onSelect: () => void;
  onPatch: (unitId: string, patch: Partial<UnitInstance>) => void;
}) {
  const template = getTemplate(unit);
  const unitAbilities = abilities.filter((ability) => template.abilities.includes(ability.id));

  return (
    <article className={`unitCard ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="unitTopline">
        <div>
          <p className="category">{template.category} | {template.role}</p>
          <h3>{template.name}</h3>
        </div>
        <span className={`status ${unit.status.toLowerCase()}`}>{unit.status}</span>
      </div>

      <div className="statGrid">
        <Stat label="MOV" value={template.movement} />
        <Stat label="HP" value={template.maxHp} />
        <Stat label="MOR" value={template.morale} />
        <Stat label="CMD" value={template.command} />
        <Stat label="WPN" value={template.weapons.length} />
      </div>

      {debugMode ? (
        <div className="trackRow">
          <label>
            HP
            <input
              type="number"
              min="0"
              max={template.maxHp}
              value={unit.currentHp}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onPatch(unit.id, { currentHp: Number(event.target.value) })}
            />
          </label>
          <label>
            Suppression
            <input
              type="number"
              min="0"
              value={unit.suppression}
              onClick={(event) => event.stopPropagation()}
              onChange={(event) => onPatch(unit.id, { suppression: Number(event.target.value) })}
            />
          </label>
        </div>
      ) : (
        <div className="readOnlyTracks">
          <span>HP {unit.currentHp}/{template.maxHp}</span>
          <span>Suppression {unit.suppression}</span>
        </div>
      )}

      <div className="abilityList">
        {template.weapons.map((weapon) => (
          <span
            title={`Range ${weapon.range}, attacks ${weapon.attacks}, damage ${weapon.damage}`}
            key={weapon.id}
          >
            {weapon.name}
          </span>
        ))}
        {unitAbilities.map((ability) => (
          <span title={ability.description} key={ability.id}>
            {ability.name}
            {ability.type === "active" && ability.cooldown ? ` CD${ability.cooldown}` : ""}
          </span>
        ))}
      </div>
    </article>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function getVictoryLog(battle: Battle): string {
  const victory = getVictoryState(battle);
  const winner = battle.armies.find((army) => army.id === victory.winnerArmyId);

  return winner
    ? `Bitwa zakonczona. Zwycieza ${winner.playerName} (${winner.faction}).`
    : "Bitwa zakonczona. Na polu walki nie zostala zadna armia.";
}
