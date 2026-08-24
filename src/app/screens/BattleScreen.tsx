import { useEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { abilities, unitTemplates } from "../../data";
import { BattleSavePanel } from "../components/BattleSavePanel";
import { MissionPanel } from "../components/MissionPanel";
import { PanelTitle } from "../components/PanelTitle";
import { BattleActionBar } from "../battle/BattleActionBar";
import { BattleCommandDock } from "../battle/BattleCommandDock";
import {
  BattleCommandHeader,
  type BattleCommandProgress,
} from "../battle/BattleCommandHeader";
import { BattleInspector } from "../battle/BattleInspector";
import { BattleUnitInspector } from "../battle/BattleUnitInspector";
import { BattleLogDrawer, type BattleDrawerTab } from "../battle/BattleLogDrawer";
import {
  BattleNotifications,
  createObjectAttackNotification,
  createUnitAttackNotification,
  type BattleNotification,
} from "../battle/BattleNotifications";
import { BattleShell } from "../battle/BattleShell";
import { SetupToolRail, type SetupToolMode } from "../battle/SetupToolRail";
import {
  alignDeploymentZones,
  createInitialBattleSnapshot,
  toggleDeploymentZoneCell,
  type ScenarioMapGenerationState,
  type ScenarioMapScale,
} from "../scenario-draft";
import type { GamePhase } from "../types/game-phase";
import { runBotTurn } from "../../core/ai/bot-turn-runner";
import { getDuplicateHeroTemplateIds } from "../../core/army-roster";
import { getArmyControl } from "../../core/army-relations";
import { getArmyCost, getTemplate, getVictoryState } from "../../core/battle-state";
import type { BattleAction } from "../../core/battle-actions";
import { getLegalAbilityActions } from "../../core/legal-actions/get-legal-ability-actions";
import { getLegalAttackActions } from "../../core/legal-actions/get-legal-attack-actions";
import { getLegalOrderActions } from "../../core/legal-actions/get-legal-order-actions";
import {
  battlefieldObjectPresets,
} from "../../core/battlefield-objects";
import { getUnitActiveAbilities } from "../../core/rules/active-abilities";
import {
  canEndTurn,
  getArmyActivationCounts,
  getRemainingActivationCount,
  getTurnActivationCount,
} from "../../core/rules/activation";
import { isPositionFree } from "../../core/rules/occupancy";
import { createMissionState } from "../../core/scenario/scenario-engine";
import { validateMissionDirector } from "../../core/scenario/mission-director";
import { applyMissionAction } from "../../core/scenario/mission-session";
import { validateScheduledScenarioEvents } from "../../core/scenario/scheduled-events";
import type { MissionState, ScenarioDefinition } from "../../core/scenario/scenario-types";
import { terrainPresets } from "../../core/terrain-presets";
import { getTerrainDefinition, hasTerrainTrait } from "../../core/terrain-definitions";
import type {
  Army,
  AttackResult,
  Battle,
  BattlefieldObjectType,
  CombatLogEntry,
  OrderType,
  ObjectAttackResult,
  TerrainTile,
  TerrainType,
  UnitInstance,
} from "../../types";
import { BattlefieldView } from "../../battlefield/BattlefieldView";
import {
  createBattlefieldVisualEvent,
  type BattlefieldVisualEvent,
} from "../../battlefield/battlefield-visual-events";
import {
  getUnitArmyLabel,
  getUnitInitials,
  getUnitPortraitImageUrl,
} from "../../presentation/unit-presentation";
import { getUnitPresentationProfile } from "../../presentation/unit-profile";
import {
  localizeAbilityName,
  localizeAbilityDescription,
  localizeCategory,
  localizeFaction,
  localizeObjectName,
  localizeOrder,
  localizeRole,
  localizeScenarioName,
  localizeTerrainName,
  localizeUnitName,
  localizeUnitStatus,
  localizeWeaponName,
  useI18n,
} from "../../i18n";

type PendingAdvance = {
  attackerId: string;
  attackerName: string;
  defenderName: string;
  targetPosition: {
    x: number;
    y: number;
  };
};

type BattleDockMode = OrderType | "Ability";

const orders: OrderType[] = ["Move", "Advance", "Attack", "Rally", "Overwatch"];

export function BattleScreen({
  activeArmyId,
  armyJson,
  battle,
  commandActions,
  initialBattle,
  gamePhase,
  debugMode,
  importError,
  logs,
  mission,
  mapGeneration,
  mapHasManualChanges,
  scenario,
  scenarioOptions,
  selectedOrder,
  selectedUnitId,
  selectedWeaponId,
  targetUnitId,
  readOnlyMap = false,
  onActiveArmyChange,
  onAddLog,
  onArmyJsonChange,
  onArmyConfigChange,
  onBattleChange,
  onCampaignBattleComplete,
  onInitialBattleChange,
  onGamePhaseChange,
  onImportError,
  onLoadArmies,
  onLoadRecommendedArmies,
  onLogsChange,
  onGenerateMap,
  onMapGenerationSettingsChange,
  onMapSizeChange,
  onBattlefieldObjectPlace,
  onDeploymentZonesChange,
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
  battle: Battle;
  commandActions?: ReactNode;
  initialBattle?: Battle;
  gamePhase: GamePhase;
  debugMode: boolean;
  importError: string;
  logs: CombatLogEntry[];
  mission: MissionState;
  mapGeneration: ScenarioMapGenerationState;
  mapHasManualChanges: boolean;
  scenario: ScenarioDefinition;
  scenarioOptions: ScenarioDefinition[];
  selectedOrder: OrderType;
  selectedUnitId: string;
  selectedWeaponId: string;
  targetUnitId: string;
  readOnlyMap?: boolean;
  onActiveArmyChange: (armyId: string | undefined) => void;
  onAddLog: (message: string) => void;
  onArmyJsonChange: (json: string) => void;
  onArmyConfigChange: (
    armyId: string,
    patch: Partial<Pick<Army, "teamId" | "control">>,
  ) => void;
  onBattleChange: (battle: Battle) => void;
  onCampaignBattleComplete?: (battle: Battle, mission: MissionState) => void;
  onInitialBattleChange: (battle: Battle) => void;
  onGamePhaseChange: (phase: GamePhase) => void;
  onImportError: (error: string) => void;
  onLoadArmies: (armies: Army[], logMessage: string) => void;
  onLoadRecommendedArmies: () => void;
  onLogsChange: (logs: CombatLogEntry[]) => void;
  onGenerateMap: (useNextSeed: boolean) => void;
  onMapGenerationSettingsChange: (
    patch: Partial<Pick<ScenarioMapGenerationState, "themeId" | "seed">>,
  ) => void;
  onMapSizeChange: (scale: ScenarioMapScale) => void;
  onBattlefieldObjectPlace: (
    type: BattlefieldObjectType | undefined,
    position: { x: number; y: number },
  ) => void;
  onDeploymentZonesChange: (zones: ScenarioDefinition["deploymentZones"]) => void;
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
  const { language, text } = useI18n();
  const [pendingAdvance, setPendingAdvance] = useState<PendingAdvance | null>(null);
  const [selectedAbilityId, setSelectedAbilityId] = useState("");
  const [abilityTargetUnitId, setAbilityTargetUnitId] = useState("");
  const [abilityTargetPosition, setAbilityTargetPosition] = useState<{ x: number; y: number }>();
  const [selectingAbilityPosition, setSelectingAbilityPosition] = useState(false);
  const [selectingMovePosition, setSelectingMovePosition] = useState(false);
  const [dockMode, setDockMode] = useState<BattleDockMode>(selectedOrder);
  const [intelTab, setIntelTab] = useState<BattleDrawerTab>("logs");
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [notifications, setNotifications] = useState<BattleNotification[]>([]);
  const notificationId = useRef(0);
  const [battlefieldVisualEvent, setBattlefieldVisualEvent] = useState<BattlefieldVisualEvent>();
  const battlefieldVisualEventId = useRef(0);
  const [mapMode, setMapMode] = useState<SetupToolMode>("units");
  const [selectedDeploymentArmyId, setSelectedDeploymentArmyId] = useState(
    battle.armies[0]?.id ?? "",
  );
  const [selectedTerrain, setSelectedTerrain] = useState<TerrainType>("LightCover");
  const [selectedObjectType, setSelectedObjectType] = useState<
    BattlefieldObjectType | "Remove"
  >("DefensePoint");
  const completedCampaignBattleId = useRef<string | undefined>(undefined);

  const allUnits = useMemo(() => battle.armies.flatMap((army) => army.units), [battle.armies]);
  const selectedUnit = allUnits.find((unit) => unit.id === selectedUnitId);
  const selectedTemplate = selectedUnit ? getTemplate(selectedUnit) : undefined;
  const selectedArmy = selectedUnit
    ? battle.armies.find((army) => army.id === selectedUnit.armyId)
    : undefined;
  const legalOrderActions = useMemo(
    () => selectedUnit ? getLegalOrderActions(battle, selectedUnit.id) : [],
    [battle, selectedUnit],
  );
  const selectedLegalOrderAction = legalOrderActions.find(
    (action) => action.order === selectedOrder,
  );
  const orderRequiresImmediateAction =
    selectedOrder === "Rally" ||
    selectedOrder === "Overwatch" ||
    (selectedOrder === "Advance" &&
      Boolean(selectedUnit?.activeEffects?.includes("advance_pending")));
  const selectedTerrainPreset =
    terrainPresets.find((terrain) => terrain.terrainType === selectedTerrain) ?? terrainPresets[0];
  const availableWeapons = selectedTemplate?.weapons ?? [];
  const activeAbilities = selectedUnit
    ? getUnitActiveAbilities(battle, selectedUnit)
    : [];
  const selectedAbility = activeAbilities.find((ability) => ability.id === selectedAbilityId)
    ?? activeAbilities[0];
  const legalAbilityActions = useMemo(
    () => selectedUnit && selectedAbility
      ? getLegalAbilityActions(battle, selectedUnit.id, selectedAbility.id)
      : [],
    [battle, selectedAbility, selectedUnit],
  );
  const legalAbilityTargetIds = new Set(
    legalAbilityActions.flatMap((action) =>
      action.targetUnitId ? [action.targetUnitId] : []
    ),
  );
  const availableAbilityTargets = allUnits.filter((unit) =>
    legalAbilityTargetIds.has(unit.id)
  );
  const abilityNeedsPosition = legalAbilityActions.some((action) => action.targetPosition);
  const selectedLegalAbilityAction = legalAbilityActions.find((action) =>
    (action.targetUnitId ?? "") === abilityTargetUnitId &&
    positionsEqual(action.targetPosition, abilityTargetPosition)
  );
  const activeWeaponId = availableWeapons.some((weapon) => weapon.id === selectedWeaponId)
    ? selectedWeaponId
    : availableWeapons[0]?.id || "";
  const legalAttackActions = useMemo(
    () => selectedUnit
      ? getLegalAttackActions(battle, selectedUnit.id)
        .filter((action) => action.weaponId === activeWeaponId)
      : [],
    [activeWeaponId, battle, selectedUnit],
  );
  const legalTargetIds = new Set(
    legalAttackActions.map((action) =>
      action.type === "Attack" ? action.defenderId : `object:${action.objectId}`
    ),
  );
  const availableTargets = allUnits.filter(
    (unit) => legalTargetIds.has(unit.id),
  );
  const availableObjectTargets = (battle.board.objects ?? []).filter(
    (object) => legalTargetIds.has(`object:${object.id}`),
  );
  const targetIsLegal = legalTargetIds.has(targetUnitId);
  const remainingActivations = getRemainingActivationCount(battle);
  const turnActivationCount = getTurnActivationCount(battle);
  const activationCounts = Object.fromEntries(
    battle.armies.map((army) => [army.id, getArmyActivationCounts(battle, army.id)]),
  );
  const turnCanEnd = canEndTurn(battle);
  const missionActive = mission.status === "Active" && gamePhase === "Playing";
  const preparationActive = gamePhase === "Preparation";
  const commandArmy = battle.armies.find(
    (army) => army.id === (battle.activeActivation?.armyId ?? activeArmyId),
  );
  const commandArmyLivingUnits = commandArmy?.units.filter(
    (unit) => unit.status !== "Destroyed",
  ).length ?? 0;
  const totalLivingUnits = allUnits.filter((unit) => unit.status !== "Destroyed").length;
  const commandProgress = getBattleCommandProgress(
    mission,
    scenario,
    text("Rundy", "Rounds"),
    text("Cele", "Targets"),
    text("Etapy", "Stages"),
  );
  const commandPhase = preparationActive
    ? text("Przygotowanie", "Preparation")
    : mission.status !== "Active"
      ? mission.status === "Victory"
        ? text("Zwycięstwo", "Victory")
        : text("Porażka", "Defeat")
      : battle.phase === "Activation"
        ? text("Aktywacja", "Activation")
        : battle.phase === "EndTurn"
          ? text("Koniec tury", "End turn")
          : battle.phase === "Finished"
            ? text("Zakończona", "Finished")
            : text("Przygotowanie", "Setup");
  const commandForceName = preparationActive
    ? `${battle.armies.length} ${text("armie", "armies")}`
    : commandArmy
      ? commandArmy.playerName
      : remainingActivations > 0
        ? text("Oczekiwanie na losowanie", "Waiting for draw")
        : text("Wszystkie rozkazy wykorzystane", "All orders used");
  const commandForceDetail = preparationActive
    ? `${totalLivingUnits} ${text("jednostek", "units")} · ${battle.board.width} × ${battle.board.height}`
    : commandArmy
      ? `${localizeFaction(language, commandArmy.faction)} · ${commandArmyLivingUnits}/${commandArmy.units.length} ${text("jednostek", "units")}`
      : `${remainingActivations}/${turnActivationCount} ${text("rozkazów", "orders")}`;
  const commandForceTone = commandArmy?.faction === "Republic"
    ? "republic"
    : commandArmy?.faction === "Separatists"
      ? "separatists"
      : "neutral";
  const selectedUnitName = selectedUnit
    ? localizeUnitName(language, getTemplate(selectedUnit).id, getTemplate(selectedUnit).name)
    : text("Brak wybranej jednostki", "No unit selected");
  const selectedUnitDetail = selectedUnit
    ? `${getUnitArmyLabel(selectedUnit, battle.armies, language)} · ${localizeUnitStatus(language, selectedUnit.status)}${
        selectedUnit.position ? "" : ` · ${text("rezerwa", "reserve")}`
      }`
    : text("Wybierz jednostkę z listy lub na mapie", "Choose a unit from the list or map");
  const mapEditingLocked = Boolean(scenario.mapPreset) || readOnlyMap;
  const selectedDeploymentArmySlot = battle.armies.findIndex(
    (army) => army.id === selectedDeploymentArmyId,
  );
  const selectedDeploymentZone = scenario.deploymentZones.find(
    (zone) => zone.armySlot === selectedDeploymentArmySlot,
  );
  const duplicateHeroIds = getDuplicateHeroTemplateIds(battle.armies);
  const rosterStartError = duplicateHeroIds.length > 0
    ? text(
        `Ten sam bohater nie może wystąpić więcej niż raz: ${duplicateHeroIds.map((templateId) => {
          const template = unitTemplates.find((candidate) => candidate.id === templateId);
          return template ? localizeUnitName(language, template.id, template.name) : templateId;
        }).join(", ")}.`,
        `The same hero cannot appear more than once: ${duplicateHeroIds.map((templateId) => {
          const template = unitTemplates.find((candidate) => candidate.id === templateId);
          return template ? localizeUnitName(language, template.id, template.name) : templateId;
        }).join(", ")}.`,
      )
    : undefined;
  const canStartScenario =
    battle.armies.length >= 2 &&
    battle.armies.length <= 4 &&
    battle.armies.every((_, armySlot) =>
      Boolean(scenario.deploymentZones.find(
        (zone) => zone.armySlot === armySlot && zone.cells.length > 0,
      ))
    ) &&
    battle.armies.every((army) => army.units.length > 0) &&
    duplicateHeroIds.length === 0 &&
    validateScheduledScenarioEvents(
      scenario.scheduledEvents ?? [],
      battle.armies,
    ) && validateMissionDirector(scenario.missionDirector, battle.armies);

  useEffect(() => {
    if (!battle.armies.some((army) => army.id === selectedDeploymentArmyId)) {
      setSelectedDeploymentArmyId(battle.armies[0]?.id ?? "");
    }
  }, [battle.armies, selectedDeploymentArmyId]);

  useEffect(() => {
    if (!onCampaignBattleComplete || gamePhase !== "Playing") return;
    if (mission.status === "Active" && battle.phase !== "Finished") return;
    const completionId = `${battle.id}:${battle.phase}:${mission.status}`;
    if (completedCampaignBattleId.current === completionId) return;
    completedCampaignBattleId.current = completionId;
    onCampaignBattleComplete(battle, mission);
  }, [battle, gamePhase, mission, onCampaignBattleComplete]);

  useEffect(() => {
    if (mapEditingLocked && mapMode !== "units") setMapMode("units");
  }, [mapEditingLocked, mapMode]);

  useEffect(() => {
    if (notifications.length === 0) {
      return;
    }

    const timeout = window.setTimeout(() => {
      setNotifications((current) => current.slice(1));
    }, 5500);

    return () => window.clearTimeout(timeout);
  }, [notifications]);

  function showCombatNotification(
    result: {
      attackResult?: AttackResult;
      objectAttackResult?: ObjectAttackResult;
    },
    sourceBattle: Battle,
  ) {
    const attackResult = result.attackResult;
    const objectAttackResult = result.objectAttackResult;
    if (!attackResult && !objectAttackResult) {
      return;
    }

    notificationId.current += 1;
    const units = sourceBattle.armies.flatMap((army) => army.units);
    const attackerId = attackResult?.attackerId ?? objectAttackResult!.attackerId;
    const attacker = units.find((unit) => unit.id === attackerId);
    const attackerName = attacker
      ? localizeUnitName(language, getTemplate(attacker).id, getTemplate(attacker).name)
      : text("Atakujący", "Attacker");
    const defender = attackResult
      ? units.find((unit) => unit.id === attackResult.defenderId)
      : undefined;
    const resultNotification = attackResult
      ? createUnitAttackNotification(
          notificationId.current,
          attackResult,
          attackerName,
          defender ? localizeUnitName(language, getTemplate(defender).id, getTemplate(defender).name) : text("Cel", "Target"),
          language,
        )
      : createObjectAttackNotification(
          notificationId.current,
          objectAttackResult!,
          attackerName,
          sourceBattle.board.objects?.find(
            (object) => object.id === objectAttackResult!.objectId,
          )?.name ?? text("Obiekt", "Object"),
          language,
        );

    setNotifications((current) => [...current, resultNotification].slice(-2));
  }

  function showBattlefieldVisualEvent(
    result: {
      attackResult?: AttackResult;
      objectAttackResult?: ObjectAttackResult;
    },
    sourceBattle: Battle,
  ) {
    battlefieldVisualEventId.current += 1;
    const event = createBattlefieldVisualEvent(
      battlefieldVisualEventId.current,
      sourceBattle,
      result,
    );
    if (event) setBattlefieldVisualEvent(event);
  }

  function executeMissionAction(action: BattleAction) {
    const result = applyMissionAction(
      { battle, mission },
      scenario,
      action,
    );

    showCombatNotification(result, battle);
    showBattlefieldVisualEvent(result, battle);
    onBattleChange(result.battle);
    onMissionChange(result.mission);
    result.missionEvents.forEach((event) => onAddLog(event.message));
    return result;
  }

  function resolveActiveBotActivation(
    sourceBattle: Battle,
    sourceMission: MissionState,
  ) {
    const botArmy = sourceBattle.armies.find(
      (army) => army.id === sourceBattle.activeActivation?.armyId,
    );
    if (!botArmy || getArmyControl(botArmy) !== "Bot") {
      return { battle: sourceBattle, mission: sourceMission };
    }

    const botActivation = runBotTurn({
      session: { battle: sourceBattle, mission: sourceMission },
      scenario,
      armyId: botArmy.id,
      profile: sourceMission.botProfiles?.[botArmy.id],
    });
    const botLabel = `Bot ${botArmy.playerName}`;

    botActivation.steps.forEach(({ decision, battleBeforeAction, result }) => {
      onAddLog(`${botLabel}: ${decision.reason}`);
      showCombatNotification(result, battleBeforeAction);
      showBattlefieldVisualEvent(result, battleBeforeAction);
      onAddLog(result.log);
      result.missionEvents.forEach((event) => onAddLog(event.message));
    });

    if (botActivation.stopReason === "no-legal-action") {
      onAddLog(language === "pl" ? `${botLabel} nie znalazł legalnej akcji. Aktywacja została bezpiecznie pominięta.` : `${botLabel} found no legal action. The activation was safely passed.`);
    } else if (botActivation.stopReason === "action-rejected") {
      onAddLog(
        language === "pl" ? `${botLabel} nie wykonał odrzuconej akcji. Aktywacja została bezpiecznie pominięta.` : `${botLabel} submitted a rejected action. The activation was safely passed.`,
      );
    } else if (botActivation.stopReason === "step-limit") {
      onAddLog(language === "pl" ? `${botLabel} nie zakończył aktywacji w limicie bezpieczeństwa. Aktywacja została pominięta.` : `${botLabel} did not finish activation within the safety limit. The activation was passed.`);
    }

    return { battle: botActivation.battle, mission: botActivation.mission };
  }

  useEffect(() => {
    if (!missionActive) return;
    const activeArmy = battle.armies.find(
      (army) => army.id === battle.activeActivation?.armyId,
    );
    if (!activeArmy || getArmyControl(activeArmy) !== "Bot") return;

    setSelectingMovePosition(false);
    setSelectingAbilityPosition(false);
    const resolved = resolveActiveBotActivation(battle, mission);
    if (resolved.battle === battle && resolved.mission === mission) return;
    onBattleChange(resolved.battle);
    onMissionChange(resolved.mission);
    onActiveArmyChange(resolved.battle.activeActivation?.armyId);
  }, [battle, mission, missionActive]);

  function handleCellClick(x: number, y: number) {
    if (selectingAbilityPosition) {
      setAbilityTargetPosition({ x, y });
      setSelectingAbilityPosition(false);
      return;
    }

    if (mapMode === "deployment") {
      if (mapEditingLocked) return;
      if (!preparationActive || selectedDeploymentArmySlot < 0) return;
      onDeploymentZonesChange(toggleDeploymentZoneCell(
        scenario.deploymentZones,
        battle.armies.length,
        selectedDeploymentArmySlot,
        { x, y },
      ));
      return;
    }

    if (mapMode === "terrain") {
      if (mapEditingLocked) return;
      if (!preparationActive) return;
      onTerrainPaint({ ...selectedTerrainPreset, x, y });
      return;
    }

    if (mapMode === "objects") {
      if (mapEditingLocked) return;
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
        onAddLog(language === "pl" ? `Pole ${x}, ${y} jest już zajęte.` : `Tile ${x}, ${y} is already occupied.`);
        return;
      }
      onUnitPatch(selectedUnit.id, { position: { x, y } });
      return;
    }

    if (!missionActive) {
      return;
    }

    if (selectedOrder !== "Move" && selectedOrder !== "Advance") {
      onAddLog(text("Aby poruszyć jednostkę, wybierz rozkaz Ruch albo Natarcie.", "Choose Move or Advance to move the unit."));
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
    setSelectingMovePosition(false);
    setSelectingAbilityPosition(false);
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
        : text("Worek aktywacji jest pusty. Czas zakończyć turę.", "The activation bag is empty. It is time to end the turn."),
    );
    drawResult.missionEvents.forEach((event) => onAddLog(event.message));

    const botResolution = resolveActiveBotActivation(finalBattle, finalMission);
    finalBattle = botResolution.battle;
    finalMission = botResolution.mission;

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
          ? text("Wskaż na mapie pole ruchu dla rozkazu Natarcie.", "Select a movement tile for the Advance order.")
          : text("Wskaż na mapie pole docelowe dla rozkazu Ruch.", "Select a destination tile for the Move order."),
      );
      return;
    }

    if (selectedOrder === "Attack") {
      onAddLog(text("Wybierz broń i cel, a następnie użyj przycisku Atakuj.", "Select a weapon and target, then press Attack."));
      return;
    }

    if (!selectedLegalOrderAction) {
      onAddLog(text("Ten rozkaz nie jest legalny dla wybranej jednostki.", "This order is not legal for the selected unit."));
      setIntelTab("logs");
      setDrawerOpen(true);
      return;
    }
    const result = executeMissionAction(selectedLegalOrderAction);
    onActiveArmyChange(result.battle.activeActivation?.armyId);
    onAddLog(result.log);
  }

  function handleUseAbility() {
    if (!selectedUnit || !selectedAbility || !selectedLegalAbilityAction) {
      onAddLog(text("Wybierz legalny cel zdolności.", "Select a legal ability target."));
      return;
    }
    const result = executeMissionAction(selectedLegalAbilityAction);
    onActiveArmyChange(result.battle.activeActivation?.armyId);
    onAddLog(result.log);
    setAbilityTargetPosition(undefined);
    setSelectingAbilityPosition(false);
  }

  function handleAttack() {
    const legalAttack = legalAttackActions.find((action) =>
      action.type === "Attack"
        ? action.defenderId === targetUnitId
        : `object:${action.objectId}` === targetUnitId
    );
    if (!legalAttack) {
      onAddLog(text("Wybrany cel nie jest legalny dla tej jednostki i broni.", "The selected target is not legal for this unit and weapon."));
      return;
    }
    const result = executeMissionAction(legalAttack);
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
          attackerName: localizeUnitName(language, getTemplate(attacker).id, getTemplate(attacker).name),
          defenderName: localizeUnitName(language, getTemplate(defender).id, getTemplate(defender).name),
          targetPosition: result.attackResult.defenderPosition,
        });
      }
    } else {
      setPendingAdvance(null);
    }

    if (result.battle.phase === "Finished") {
      onAddLog(getVictoryLog(result.battle, language));
    }
  }

  function handleEndTurn() {
    setPendingAdvance(null);
    const result = executeMissionAction({ type: "EndTurn" });
    onActiveArmyChange(result.battle.activeActivation?.armyId);
    onAddLog(result.log);
    if (result.battle.phase === "Finished") {
      onAddLog(getVictoryLog(result.battle, language));
    }
  }

  function handleLoadArmies() {
    try {
      setPendingAdvance(null);
      const parsed = JSON.parse(armyJson) as Army[];
      if (!Array.isArray(parsed) || parsed.length < 2 || parsed.length > 4) {
        throw new Error(text("JSON musi zawierać od dwóch do czterech armii.", "JSON must contain between two and four armies."));
      }

      onLoadArmies(parsed, text("Wczytano armie i przebudowano worek aktywacji.", "Armies loaded and the activation bag rebuilt."));
    } catch (error) {
      onImportError(error instanceof Error ? error.message : text("Nie udało się wczytać armii.", "Could not load armies."));
    }
  }

  function handleAdvanceAfterCombat() {
    if (!missionActive || !pendingAdvance) {
      return;
    }

    onUnitPatch(pendingAdvance.attackerId, { position: pendingAdvance.targetPosition });
    onAddLog(
      language === "pl"
        ? `${pendingAdvance.attackerName} zajmuje pozycję po ${pendingAdvance.defenderName}: ${pendingAdvance.targetPosition.x}, ${pendingAdvance.targetPosition.y}.`
        : `${pendingAdvance.attackerName} takes the position after defeating ${pendingAdvance.defenderName}: ${pendingAdvance.targetPosition.x}, ${pendingAdvance.targetPosition.y}.`,
    );
    setPendingAdvance(null);
  }

  function handleHoldAfterCombat() {
    if (!missionActive || !pendingAdvance) {
      return;
    }

    onAddLog(language === "pl" ? `${pendingAdvance.attackerName} zostaje na swojej pozycji po starciu.` : `${pendingAdvance.attackerName} holds position after combat.`);
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
      deploymentZones: alignDeploymentZones(
        loadedMission?.deploymentZones ?? scenario.deploymentZones,
        loadedBattle.armies.length,
      ),
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

  function handleDockOrderSelect(order: OrderType) {
    onOrderChange(order);
    setDockMode(order);
    setSelectingMovePosition(false);
    setSelectingAbilityPosition(false);
  }

  function handleDockAbilitySelect() {
    setDockMode("Ability");
    setSelectingMovePosition(false);
  }

  const dockControlsDisabled = !selectedUnitId || !activeArmyId;
  const dockContextLabel = dockMode === "Ability"
    ? text("Zdolność aktywna", "Active ability")
    : localizeOrder(language, dockMode);
  const dockContextStatus = !battle.activeActivation
    ? remainingActivations > 0
      ? text("Oczekiwanie na losowanie aktywacji", "Waiting for activation draw")
      : text("Brak aktywacji — zakończ turę", "No activations — end the turn")
    : !selectedUnit
      ? text("Wybierz aktywną jednostkę", "Select the active unit")
      : dockMode === "Ability"
        ? activeAbilities.length === 0
          ? text("Brak aktywnych zdolności", "No active abilities")
          : legalAbilityActions.length === 0
            ? text("Zdolność jest teraz niedostępna", "Ability is currently unavailable")
            : selectingAbilityPosition
              ? text("Oczekiwanie na kliknięcie mapy", "Waiting for map click")
              : selectedLegalAbilityAction
                ? text("Cel legalny — gotowe do użycia", "Legal target — ready to use")
                : text("Wybierz wymagany cel", "Choose the required target")
        : dockMode === "Attack"
          ? availableWeapons.length === 0
            ? text("Jednostka nie ma dostępnej broni", "Unit has no available weapon")
            : legalAttackActions.length === 0
              ? text("Brak legalnych celów dla tej broni", "No legal targets for this weapon")
              : targetIsLegal
                ? text("Cel legalny — atak gotowy", "Legal target — attack ready")
                : text("Wybierz legalny cel", "Choose a legal target")
          : selectingMovePosition && (dockMode === "Move" || dockMode === "Advance")
            ? text("Oczekiwanie na kliknięcie mapy", "Waiting for map click")
            : orderRequiresImmediateAction && !selectedLegalOrderAction
              ? text("Rozkaz jest teraz niedostępny", "Order is currently unavailable")
              : dockMode === "Move" || dockMode === "Advance"
                ? selectedUnit.position
                  ? text("Wskaż pole ruchu na mapie", "Choose a movement tile on the map")
                  : text("Jednostka w rezerwie — wskaż pole wejścia", "Unit in reserve — choose an entry tile")
                : text("Rozkaz gotowy do wykonania", "Order ready to execute");

  return (
    <BattleShell
      phase={gamePhase}
      header={(
        <BattleCommandHeader
          actions={commandActions}
          activeDetail={commandForceDetail}
          activeLabel={preparationActive
            ? text("Siły", "Forces")
            : commandArmy
              ? text("Aktywna armia", "Active army")
              : text("Aktywacja", "Activation")}
          activeName={commandForceName}
          activeTone={commandForceTone}
          objective={mission.activeObjectiveName ?? localizeScenarioName(language, scenario.id, scenario.name)}
          objectiveLabel={text("Cel", "Objective")}
          phase={commandPhase}
          phaseLabel={text("Faza", "Phase")}
          progress={commandProgress}
          title={preparationActive
            ? text("Kreator scenariusza", "Scenario Builder")
            : text("Panel dowodzenia", "Command Panel")}
          turn={battle.turn}
          turnLabel={text("Tura", "Turn")}
        />
      )}
      setupTools={preparationActive ? (
        <SetupToolRail
          mapEditingLocked={mapEditingLocked}
          mode={mapMode}
          onModeChange={setMapMode}
        >
          {mapMode === "units" ? (
            <select
              value={selectedUnitId}
              onChange={(event) => onSelectedUnitChange(event.target.value)}
            >
              <option value="">{text("Wybierz oddział", "Select unit")}</option>
              {allUnits.map((unit) => (
                <option key={unit.id} value={unit.id}>
                  {localizeUnitName(language, getTemplate(unit).id, getTemplate(unit).name)} | {getUnitArmyLabel(unit, battle.armies, language)} |{" "}
                  {unit.position ? `${unit.position.x},${unit.position.y}` : text("rezerwa", "reserve")}
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
                    {localizeTerrainName(language, terrain.terrainType, getTerrainDefinition(terrain.terrainType)?.name ?? terrain.terrainType)}
                  </option>
                ))}
              </select>
              <div className="mapReadout">
                <strong>{localizeTerrainName(language, selectedTerrainPreset.terrainType, getTerrainDefinition(selectedTerrainPreset.terrainType)?.name ?? selectedTerrainPreset.terrainType)}</strong>
                <span>{text("Obrona", "Defense")}: +{selectedTerrainPreset.defenseBonus}</span>
                <span>{text("Atak", "Attack")}: +{selectedTerrainPreset.attackBonus}</span>
                <span>
                  {text("Koszt ruchu", "Movement cost")}: {hasTerrainTrait(selectedTerrainPreset, "Impassable")
                    ? text("niedostępny", "unavailable")
                    : selectedTerrainPreset.movementCost}
                </span>
                <span>
                  {text("Blokuje LOS", "Blocks LOS")}: {selectedTerrainPreset.blocksLineOfSight ? text("tak", "yes") : text("nie", "no")}
                </span>
                {selectedTerrainPreset.traits?.length ? (
                  <span>{text("Klasy", "Traits")}: {selectedTerrainPreset.traits.join(", ")}</span>
                ) : null}
              </div>
            </>
          ) : mapMode === "objects" ? (
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
                    {localizeObjectName(language, object.type, object.name)}{object.destructible ? ` | HP ${object.maxHp}` : ""}
                  </option>
                ))}
                <option value="Remove">{text("Usuń obiekt z pola", "Remove object from tile")}</option>
              </select>
              <div className="mapReadout">
                <strong>{text("Obiekty pola bitwy", "Battlefield objects")}</strong>
                <span>{text("Kliknij pole, aby postawić lub usunąć wybrany obiekt.", "Click a tile to place or remove the selected object.")}</span>
                <span>{text("Osłony zwiększają obronę jednostek na tym samym polu.", "Fortifications improve the defense of units on the same tile.")}</span>
              </div>
            </>
          ) : (
            <>
              <select
                value={selectedDeploymentArmyId}
                onChange={(event) => setSelectedDeploymentArmyId(event.target.value)}
              >
                {battle.armies.map((army, armySlot) => (
                  <option key={army.id} value={army.id}>
                    {text("Armia", "Army")} {String.fromCharCode(65 + armySlot)} · {army.playerName}
                  </option>
                ))}
              </select>
              <div className="mapReadout deploymentZoneReadout">
                <strong>{text("Strefa wejścia", "Entry zone")}</strong>
                <span>
                  {text("Zaznaczone pola", "Selected tiles")}: {selectedDeploymentZone?.cells.length ?? 0}
                </span>
                <span>{text("Kliknij pole, aby je dodać lub usunąć.", "Click a tile to add or remove it.")}</span>
                <span>{text("Jedno pole może należeć tylko do jednej armii.", "A tile may belong to only one army.")}</span>
              </div>
              <button
                className="secondaryButton"
                disabled={!selectedDeploymentZone?.cells.length}
                onClick={() => onDeploymentZonesChange(
                  scenario.deploymentZones.map((zone) =>
                    zone.armySlot === selectedDeploymentArmySlot
                      ? { ...zone, cells: [] }
                      : zone
                  ),
                )}
              >
                {text("Wyczyść strefę", "Clear zone")}
              </button>
            </>
          )}
        </SetupToolRail>
      ) : undefined}
      inspector={(
        <BattleInspector
          phase={gamePhase}
          tone={selectedArmy?.faction === "Republic"
            ? "republic"
            : selectedArmy?.faction === "Separatists"
              ? "separatists"
              : "neutral"}
        >
          {!preparationActive ? (
            <BattleUnitInspector
              battle={battle}
              debugMode={false}
              selectedArmy={selectedArmy}
              selectedUnit={selectedUnit}
              onUnitPatch={onUnitPatch}
            />
          ) : null}
          <MissionPanel
            activationCounts={preparationActive ? undefined : activationCounts}
            armies={battle.armies}
            canStart={canStartScenario}
            startError={rosterStartError}
            currentRound={battle.turn}
            gamePhase={gamePhase}
            mapBoardHeight={battle.board.height}
            mapBoardWidth={battle.board.width}
            mapGeneration={mapGeneration}
            mapHasManualChanges={mapHasManualChanges}
            mission={mission}
            scenario={scenario}
            scenarios={scenarioOptions}
            onScenarioChange={onScenarioChange}
            onGenerateMap={onGenerateMap}
            onMapGenerationSettingsChange={onMapGenerationSettingsChange}
            onMapSizeChange={onMapSizeChange}
            onArmyConfigChange={onArmyConfigChange}
            onLoadRecommendedArmies={onLoadRecommendedArmies}
            onDefenderArmyChange={onDefenderArmyChange}
            onRoundTargetChange={(rounds) =>
              onMissionChange({
                ...mission,
                roundTarget: Math.max(1, Math.floor(rounds || 1)),
                objectiveStage: mission.objectiveStage === undefined ? undefined : 0,
                stageStartedRound: mission.stageStartedRound === undefined ? undefined : 0,
                roundsCompleted: 0,
              })
            }
            onStageRoundTargetsChange={(stageRoundTargets) =>
              onMissionChange({
                ...mission,
                stageRoundTargets,
                objectiveStage: 0,
                stageStartedRound: 0,
                roundsCompleted: 0,
              })
            }
            onScheduledEventsChange={(scheduledEvents) =>
              onMissionChange({
                ...mission,
                scheduledEvents,
                resolvedEventIds: [],
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

          {preparationActive ? (
            <details className="jsonDetails">
              <summary>{text("Import armii JSON", "Import army JSON")}</summary>
              <textarea
                className="armyInput jsonInput"
                value={armyJson}
                spellCheck={false}
                wrap="off"
                onChange={(event) => onArmyJsonChange(event.target.value)}
              />
              {importError ? <p className="errorText">{importError}</p> : null}
              <button className="secondaryButton" onClick={handleLoadArmies}>
                {text("Wczytaj armie", "Load armies")}
              </button>
            </details>
          ) : null}
        </BattleInspector>
      )}
      actionBar={missionActive ? (
        <BattleActionBar>
          <BattleCommandDock
            activation={{
              label: text("Losuj rozkaz", "Draw order"),
              detail: `${remainingActivations} ${text("pozostało", "remaining")}`,
              disabled: Boolean(battle.activeActivation) || remainingActivations === 0,
              tone: "primary",
              onClick: handleDrawActivation,
            }}
            activeArmy={commandArmy?.playerName ?? text("Oczekiwanie na aktywację", "Waiting for activation")}
            activeArmyTone={commandForceTone}
            activeUnit={selectedUnitName}
            activeUnitDetail={selectedUnitDetail}
            unitControl={(
              <select
                aria-label={text("Aktywna jednostka", "Active unit")}
                value={selectedUnitId}
                onChange={(event) => onSelectedUnitChange(event.target.value)}
              >
                <option value="">{text("Wybierz jednostkę", "Select unit")}</option>
                {allUnits.map((unit) => (
                  <option key={unit.id} value={unit.id}>
                    {localizeUnitName(language, getTemplate(unit).id, getTemplate(unit).name)} | {getUnitArmyLabel(unit, battle.armies, language)} | {localizeUnitStatus(language, unit.status)}
                  </option>
                ))}
              </select>
            )}
            commands={[
              ...orders.map((order) => ({
                id: order,
                label: localizeOrder(language, order),
                selected: dockMode === order,
                disabled: dockControlsDisabled,
                tone: order === "Attack" ? "danger" as const : "default" as const,
                onSelect: () => handleDockOrderSelect(order),
              })),
              {
                id: "Ability",
                label: text("Zdolność", "Ability"),
                selected: dockMode === "Ability",
                disabled: dockControlsDisabled,
                onSelect: handleDockAbilitySelect,
              },
            ]}
            contextLabel={dockContextLabel}
            contextStatus={dockContextStatus}
            context={dockMode === "Attack" ? (
              <>
                <label className="battleDockField">
                  {text("Broń", "Weapon")}
                  <select
                    value={activeWeaponId}
                    disabled={!selectedUnitId || availableWeapons.length === 0}
                    onChange={(event) => onSelectedWeaponChange(event.target.value)}
                  >
                    <option value="">{text("Brak dostępnej broni", "No available weapon")}</option>
                    {availableWeapons.map((weapon) => (
                      <option key={weapon.id} value={weapon.id}>
                        {localizeWeaponName(language, weapon.id, weapon.name)} | R{weapon.range} A{weapon.attacks}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="battleDockField">
                  {text("Cel", "Target")}
                  <select
                    value={targetUnitId}
                    disabled={!activeWeaponId || legalAttackActions.length === 0}
                    onChange={(event) => onTargetUnitChange(event.target.value)}
                  >
                    <option value="">{text("Wybierz legalny cel", "Choose a legal target")}</option>
                    {availableTargets.map((unit) => (
                      <option key={unit.id} value={unit.id}>
                        {localizeUnitName(language, getTemplate(unit).id, getTemplate(unit).name)}
                      </option>
                    ))}
                    {availableObjectTargets.map((object) => (
                      <option key={object.id} value={`object:${object.id}`}>
                        {localizeObjectName(language, object.type, object.name)} | {object.currentHp} HP
                      </option>
                    ))}
                  </select>
                </label>
                <button
                  type="button"
                  className="battleDockAction"
                  data-tone="danger"
                  disabled={!selectedUnitId || !activeArmyId || !activeWeaponId || !targetIsLegal}
                  onClick={handleAttack}
                >
                  {text("Atakuj", "Attack")}
                </button>
              </>
            ) : dockMode === "Ability" ? (
              activeAbilities.length > 0 ? (
                <>
                  <label className="battleDockField">
                    {text("Zdolność", "Ability")}
                    <select
                      value={selectedAbility?.id ?? ""}
                      onChange={(event) => {
                        setSelectedAbilityId(event.target.value);
                        setAbilityTargetUnitId("");
                        setAbilityTargetPosition(undefined);
                        setSelectingAbilityPosition(false);
                      }}
                    >
                      {activeAbilities.map((ability) => (
                        <option key={ability.id} value={ability.id}>
                          {ability.discipline === "command" ? `[${text("DOWÓDCZA", "COMMAND")}] ` : ""}
                          {localizeAbilityName(language, ability)} | {ability.usesPerBattle
                            ? (selectedUnit?.usedAbilities?.includes(ability.id)
                                ? text("WYKORZYSTANA", "SPENT")
                                : text("raz na bitwę", "once per battle"))
                            : `CD ${selectedUnit?.abilityCooldowns?.[ability.id] ?? 0}`}
                        </option>
                      ))}
                    </select>
                  </label>
                  {availableAbilityTargets.length > 0 ? (
                    <label className="battleDockField">
                      {text("Cel jednostkowy", "Unit target")}
                      <select
                        value={abilityTargetUnitId}
                        onChange={(event) => setAbilityTargetUnitId(event.target.value)}
                      >
                        <option value="">{text("Wybierz cel", "Select target")}</option>
                        {availableAbilityTargets.map((unit) => (
                          <option key={unit.id} value={unit.id}>
                            {localizeUnitName(language, getTemplate(unit).id, getTemplate(unit).name)}
                          </option>
                        ))}
                      </select>
                    </label>
                  ) : null}
                  {abilityNeedsPosition ? (
                    <button
                      type="button"
                      className="battleDockAction"
                      data-tone="secondary"
                      onClick={() => setSelectingAbilityPosition((current) => !current)}
                    >
                      {selectingAbilityPosition
                        ? text("Anuluj wskazywanie", "Cancel targeting")
                        : abilityTargetPosition
                          ? `${text("Pole", "Tile")} ${abilityTargetPosition.x}, ${abilityTargetPosition.y}`
                          : text("Wskaż pole", "Select tile")}
                    </button>
                  ) : null}
                  <button
                    type="button"
                    className="battleDockAction"
                    data-tone="primary"
                    disabled={!activeArmyId || !selectedAbility || !selectedLegalAbilityAction}
                    onClick={handleUseAbility}
                  >
                    {text("Użyj", "Use")}
                  </button>
                </>
              ) : (
                <p className="battleDockHint">{text("Wybrana jednostka nie ma aktywnych zdolności.", "The selected unit has no active abilities.")}</p>
              )
            ) : (
              <button
                type="button"
                className="battleDockAction"
                data-tone={selectingMovePosition ? "secondary" : "primary"}
                disabled={
                  dockControlsDisabled ||
                  (orderRequiresImmediateAction && !selectedLegalOrderAction)
                }
                onClick={selectingMovePosition
                  ? () => setSelectingMovePosition(false)
                  : handleOrder}
              >
                {selectingMovePosition && (dockMode === "Move" || dockMode === "Advance")
                  ? text("Anuluj wskazywanie", "Cancel targeting")
                  : selectedUnit && !selectedUnit.position && (dockMode === "Move" || dockMode === "Advance")
                    ? text("Wskaż wejście", "Select entry")
                    : dockMode === "Advance" && selectedUnit?.activeEffects?.includes("advance_pending")
                      ? text("Zakończ Natarcie", "Finish Advance")
                      : dockMode === "Move" || dockMode === "Advance"
                        ? text("Wskaż pole", "Select tile")
                        : text("Wykonaj rozkaz", "Execute order")}
              </button>
            )}
            endTurn={{
              label: remainingActivations > 0
                ? `${remainingActivations} ${text("rozkazów", "orders")}`
                : text("Koniec tury", "End turn"),
              disabled: !turnCanEnd,
              tone: turnCanEnd ? "primary" : "secondary",
              onClick: handleEndTurn,
            }}
          />
        </BattleActionBar>
      ) : undefined}
      battlefield={(
        <BattlefieldView
          abilityTargetPosition={abilityTargetPosition}
          abilityTargetUnitId={abilityTargetUnitId}
          battle={battle}
          deploymentZoneCells={
            preparationActive && mapMode === "deployment"
              ? selectedDeploymentZone?.cells
              : undefined
          }
          enableRendererSwitch={debugMode}
          interactionDisabled={gamePhase === "Playing" && !missionActive}
          mapThemeId={mapGeneration.themeId}
          mission={mission}
          missionActive={missionActive}
          scenario={scenario}
          selectedAbility={selectedAbility}
          selectedOrder={selectedOrder}
          selectedUnitId={selectedUnitId}
          selectedWeaponId={activeWeaponId}
          visualEvent={battlefieldVisualEvent}
          selectingAbilityPosition={selectingAbilityPosition}
          selectingMovePosition={selectingMovePosition}
          targetUnitId={targetUnitId}
          onCellClick={handleCellClick}
          onSelectedUnitChange={onSelectedUnitChange}
        />
      )}
      overlay={(
        <>
          {pendingAdvance ? (
            <div className="decisionPanel compactDecision">
              <p>
                {language === "pl"
                  ? `${pendingAdvance.attackerName} pokonał ${pendingAdvance.defenderName}.`
                  : `${pendingAdvance.attackerName} defeated ${pendingAdvance.defenderName}.`}
              </p>
              <div className="decisionActions">
                <button className="primaryButton" onClick={handleAdvanceAfterCombat}>
                  {text("Zajmij pozycję", "Take position")}
                </button>
                <button className="secondaryButton" onClick={handleHoldAfterCombat}>
                  {text("Zostań", "Hold")}
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
      notifications={(
        <BattleNotifications
          notifications={notifications}
          onDismiss={(id) => setNotifications((current) =>
            current.filter((notification) => notification.id !== id)
          )}
        />
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
          save={!preparationActive ? (
            <BattleSavePanel
              battle={battle}
              defaultOpen
              initialBattle={initialBattle}
              logs={logs}
              mission={mission}
              onBattleLoad={handleBattleLoad}
            />
          ) : undefined}
        />
      )}
    />
  );
}

function getBattleCommandProgress(
  mission: MissionState,
  scenario: ScenarioDefinition,
  roundsLabel: string,
  targetsLabel: string,
  stagesLabel: string,
): BattleCommandProgress | undefined {
  const condition = scenario.victoryCondition;

  if (condition.type === "DestroyObjects") {
    return {
      current: mission.destroyedObjectiveIds?.length ?? 0,
      label: targetsLabel,
      total: condition.count,
    };
  }

  if (condition.type === "ProgressiveControl") {
    return {
      current: mission.objectiveStage ?? 0,
      label: stagesLabel,
      total: condition.count,
    };
  }

  if (condition.type === "RescueAndExtract") {
    return {
      current: mission.objectiveStage ?? 0,
      label: stagesLabel,
      total: condition.hostageCount + 1,
    };
  }

  const total = mission.roundTarget ?? (
    "rounds" in condition ? condition.rounds : condition.roundLimit
  );
  return total > 0
    ? { current: mission.roundsCompleted, label: roundsLabel, total }
    : undefined;
}

function MissionSummary({
  mission,
  scenario,
}: {
  mission: MissionState;
  scenario: ScenarioDefinition;
}) {
  const { text } = useI18n();
  const outcomeMessage = mission.status === "Victory"
    ? text("Cel scenariusza został wykonany.", "The scenario objective has been completed.")
    : text("Warunek porażki scenariusza został spełniony.", "A scenario defeat condition has been met.");

  return (
    <section className="battleSummary">
      <PanelTitle
        title={text("Podsumowanie misji", "Mission summary")}
        detail={mission.status === "Victory" ? text("Zwycięstwo", "Victory") : text("Porażka", "Defeat")}
      />
      <p className="tokenReadout">
        {outcomeMessage} {text("Ukończono", "Completed")} {mission.roundsCompleted} {text("z", "of")}{" "}
        {mission.roundTarget ?? (
          "rounds" in scenario.victoryCondition
            ? scenario.victoryCondition.rounds
            : scenario.victoryCondition.roundLimit
        )} {text("rund.", "rounds.")}
      </p>
    </section>
  );
}

function BattleSummary({ battle }: { battle: Battle }) {
  const { language, text } = useI18n();
  const victory = getVictoryState(battle);
  const winner = battle.armies.find((army) => army.id === victory.winnerArmyId);

  return (
    <section className="battleSummary">
      <PanelTitle
        title={text("Podsumowanie bitwy", "Battle summary")}
        detail={winner ? `${text("Zwycięzca", "Winner")}: ${winner.playerName}` : text("Brak zwycięzcy", "No winner")}
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
                  <p className="eyebrow">{localizeFaction(language, army.faction)}</p>
                  <h3>{army.playerName}</h3>
                </div>
                <strong>{army.id === victory.winnerArmyId ? text("Zwycięstwo", "Victory") : text("Pokonana", "Defeated")}</strong>
              </div>
              <div className="summaryStats">
                <span>{text("Ocalałe", "Surviving")}: {survivingUnits.length}</span>
                <span>{text("Straty", "Losses")}: {destroyedUnits.length}</span>
                <span>HP: {remainingHp}</span>
                <span>{text("Przygwożdżenie", "Suppression")}: {suppression}</span>
              </div>
              <div className="summaryUnits">
                {army.units.map((unit) => (
                  <div className="summaryUnit" key={unit.id}>
                    <span>{localizeUnitName(language, getTemplate(unit).id, getTemplate(unit).name)}</span>
                    <small>
                      {localizeUnitStatus(language, unit.status)} | HP {unit.currentHp}/{getTemplate(unit).maxHp} | SUP{" "}
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
  const { language, text } = useI18n();
  if (!selectedUnit) {
    return (
      <div className="mapReadout">
        <span>{text("Wybierz oddział z listy albo kliknij token na mapie.", "Select a unit from the list or click a token on the map.")}</span>
      </div>
    );
  }

  const template = getTemplate(selectedUnit);
  const passiveAbilities = abilities.filter((ability) =>
    template.abilities.includes(ability.id) && ability.type !== "active"
  );
  const presentation = getUnitPresentationProfile(template.id, template.faction);
  const portraitImageUrl = getUnitPortraitImageUrl(template);
  const themeStyle = {
    "--unit-accent": presentation.theme.accent,
    "--unit-accent-soft": presentation.theme.accentSoft,
    "--unit-accent-strong": presentation.theme.accentStrong,
  } as CSSProperties;

  return (
    <div className="mapReadout unitDetailPanel" style={themeStyle}>
      <div className="unitPortrait">
        {portraitImageUrl ? (
          <img
            key={portraitImageUrl}
            src={portraitImageUrl}
            alt={localizeUnitName(language, template.id, template.name)}
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
        <strong>{localizeUnitName(language, template.id, template.name)}</strong>
        <span>{selectedArmy ? localizeFaction(language, selectedArmy.faction) : text("Nieznana", "Unknown")} | {localizeRole(language, template.role)}</span>
      </div>
      {presentation.lore ? (
        <section className="unitLore">
          <strong>{presentation.lore.subtitle[language]}</strong>
          <p>{presentation.lore.summary[language]}</p>
          {presentation.lore.details ? (
            <details>
              <summary>{text("Więcej lore", "More lore")}</summary>
              <p>{presentation.lore.details[language]}</p>
            </details>
          ) : null}
        </section>
      ) : null}
      <div className="unitDetailStats">
        <span>HP {selectedUnit.currentHp}/{template.maxHp}</span>
        <span>SUP {selectedUnit.suppression}</span>
        <span>MOV {template.movement}</span>
        <span>SV {template.armorSave ? `${template.armorSave}+` : "-"}</span>
      </div>
      <span>{text("Stan", "Status")}: {selectedUnit.position ? text("na mapie", "on map") : text("rezerwa / posiłki", "reserve / reinforcements")}</span>
      <span>
        {text("Pole", "Tile")}:{" "}
        {selectedUnit.position
          ? `${selectedUnit.position.x}, ${selectedUnit.position.y}`
          : text("poza mapą", "off map")}
      </span>
      {selectedUnit.supportLink ? (
        <span>
          {text("Para wsparcia", "Support pair")}: {selectedUnit.supportLink.role === "provider"
            ? text("udziela wsparcia", "providing support")
            : text("otrzymuje wsparcie", "receiving support")} ({selectedUnit.supportLink.mode === "attack"
              ? text("atak", "attack")
              : text("obrona", "defense")})
        </span>
      ) : null}
      <div className="unitWeaponList">
        {template.weapons.map((weapon) => (
          <span key={weapon.id}>
            {localizeWeaponName(language, weapon.id, weapon.name)} | R{weapon.range} A{weapon.attacks} D{weapon.damage}
          </span>
        ))}
      </div>
      {passiveAbilities.length > 0 ? (
        <section className="unitPassiveAbilities">
          <strong>{text("Efekty pasywne", "Passive effects")}</strong>
          <div>
            {passiveAbilities.map((ability) => {
              const abilityName = localizeAbilityName(language, ability);
              const abilityDescription = localizeAbilityDescription(language, ability);
              return (
                <span
                  aria-label={`${abilityName}. ${abilityDescription}`}
                  key={ability.id}
                  tabIndex={0}
                  title={abilityDescription}
                >
                  {abilityName}
                  {ability.type === "aura" ? <small>{text("Aura", "Aura")}</small> : null}
                </span>
              );
            })}
          </div>
          <small>{text(
            "Najedź na nazwę, aby zobaczyć opis.",
            "Hover over a name to see its description.",
          )}</small>
        </section>
      ) : null}
      {debugMode ? (
        <>
          <button
            className="secondaryButton"
            disabled={!selectedUnit.position}
            onClick={() => onUnitPatch(selectedUnit.id, { position: null })}
          >
            {text("Przenieś do rezerw", "Move to reserves")}
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
  const { language, text } = useI18n();
  return (
    <section className={`armyColumn ${army.faction.toLowerCase().replaceAll(" ", "-")}`}>
      <div className="armyHeader">
        <div>
          <p className="eyebrow">{localizeFaction(language, army.faction)}</p>
          <h2>{army.playerName}</h2>
        </div>
        <strong>{getArmyCost(army)} {text("pkt", "pts")}</strong>
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
  const { language, text } = useI18n();
  const template = getTemplate(unit);
  const unitAbilities = abilities.filter((ability) => template.abilities.includes(ability.id));

  return (
    <article className={`unitCard ${selected ? "selected" : ""}`} onClick={onSelect}>
      <div className="unitTopline">
        <div>
          <p className="category">{localizeCategory(language, template.category)} | {localizeRole(language, template.role)}</p>
          <h3>{localizeUnitName(language, template.id, template.name)}</h3>
        </div>
        <span className={`status ${unit.status.toLowerCase()}`}>{localizeUnitStatus(language, unit.status)}</span>
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
            {text("Przygwożdżenie", "Suppression")}
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
          <span>{text("Przygwożdżenie", "Suppression")} {unit.suppression}</span>
        </div>
      )}

      <div className="abilityList">
        {template.weapons.map((weapon) => (
          <span
            title={`${text("Zasięg", "Range")} ${weapon.range}, ${text("ataki", "attacks")} ${weapon.attacks}, ${text("obrażenia", "damage")} ${weapon.damage}`}
            key={weapon.id}
          >
            {localizeWeaponName(language, weapon.id, weapon.name)}
          </span>
        ))}
        {unitAbilities.map((ability) => (
          <span title={localizeAbilityDescription(language, ability)} key={ability.id}>
            {localizeAbilityName(language, ability)}
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

function positionsEqual(
  left?: { x: number; y: number },
  right?: { x: number; y: number },
): boolean {
  if (!left || !right) return left === right;
  return left.x === right.x && left.y === right.y;
}

function getVictoryLog(battle: Battle, language: "pl" | "en"): string {
  const victory = getVictoryState(battle);
  const winner = battle.armies.find((army) => army.id === victory.winnerArmyId);

  if (language === "en") {
    return winner
      ? `Battle finished. ${winner.playerName} (${winner.faction}) wins.`
      : "Battle finished. No army remains on the battlefield.";
  }
  return winner
    ? `Bitwa zakończona. Zwycięża ${winner.playerName} (${localizeFaction(language, winner.faction)}).`
    : "Bitwa zakończona. Na polu walki nie została żadna armia.";
}
