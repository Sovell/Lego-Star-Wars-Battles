import { useRef } from "react";
import { createInitialBattleSnapshot, createScenarioDraft, type ScenarioDraft } from "../scenario-draft";
import {
  resolveActiveCampaignBattle,
  restoreActiveCampaignBattle,
  type ActiveCampaignBattle,
} from "./campaign-battle-session";
import { createLog } from "../../core/battle-state";
import type { PersistenceAdapter } from "../../core/persistence/storage-adapter";
import { createSavedBattle, type SavedBattle, type SavedCampaign } from "../../core/persistence/save-types";
import { createMissionState } from "../../core/scenario/scenario-engine";
import type { MissionState } from "../../core/scenario/scenario-types";
import type { Battle, CombatLogEntry } from "../../types";

type Localize = (pl: string, en: string) => string;

type CampaignBattleSessionOptions = {
  activeCampaignBattle?: ActiveCampaignBattle;
  battleStartSnapshot?: Battle;
  logs: CombatLogEntry[];
  persistence: PersistenceAdapter;
  savedCampaign?: SavedCampaign;
  setActiveCampaignBattle: (active: ActiveCampaignBattle | undefined) => void;
  setBattle: (battle: Battle) => void;
  setBattleStartSnapshot: (battle: Battle | undefined) => void;
  setCampaignBattleReport: (message: string | undefined) => void;
  setGamePhase: (phase: "Preparation" | "Playing") => void;
  setLogs: (logs: CombatLogEntry[]) => void;
  setMenuStatus: (message: string | undefined) => void;
  setMission: (mission: MissionState) => void;
  setSavedCampaign: (campaign: SavedCampaign | undefined) => void;
  setScenarioDraft: (draft: ScenarioDraft) => void;
  setSelectedUnitId: (id: string) => void;
  setTargetUnitId: (id: string) => void;
  setSelectedWeaponId: (id: string) => void;
  setActiveArmyId: (id: string | undefined) => void;
  setView: (view: "campaign" | "setup" | "battle") => void;
  text: Localize;
};

/** Keeps the campaign-to-tactical-battle lifecycle out of the app shell. */
export function useCampaignBattleSession(options: CampaignBattleSessionOptions) {
  const resolutionInProgress = useRef<string | undefined>(undefined);

  async function openCampaignBattle(saved: SavedCampaign, savedBattle?: SavedBattle): Promise<void> {
    try {
      const active = restoreActiveCampaignBattle(saved, savedBattle);
      const persistedBattle = savedBattle ?? await options.persistence.loadBattle(active.battleId);
      const loadedBattle = persistedBattle?.battle ?? active.battlePackage.battle;
      const loadedMission = persistedBattle?.mission ?? createMissionState(
        active.battlePackage.scenario,
        loadedBattle.armies,
        active.battlePackage.request.battleDefenderArmyId,
      );
      const initialBattle = persistedBattle?.initialBattle ?? createInitialBattleSnapshot(loadedBattle);
      options.setSavedCampaign(saved);
      options.setActiveCampaignBattle(active);
      options.setMenuStatus(undefined);
      options.setScenarioDraft(createScenarioDraft(active.battlePackage.scenario.id, {
        armies: structuredClone(loadedBattle.armies),
        board: structuredClone(loadedBattle.board),
        defenderArmyId: active.battlePackage.request.battleDefenderArmyId,
        deploymentZones: structuredClone(active.battlePackage.deploymentZones),
        scheduledEvents: structuredClone(active.battlePackage.scenario.scheduledEvents ?? []),
        mapGeneration: {
          themeId: active.battlePackage.request.themeId,
          seed: active.battlePackage.request.scenarioSeed,
        },
      }));
      options.setBattle(structuredClone(loadedBattle));
      options.setBattleStartSnapshot(structuredClone(initialBattle));
      options.setMission(loadedMission);
      options.setLogs(persistedBattle?.logs ?? [createLog(1, options.text(
        "Utworzono bitwę kampanijną.",
        "Campaign battle created.",
      ))]);
      options.setActiveArmyId(loadedBattle.activeActivation?.armyId);
      options.setSelectedUnitId("");
      options.setTargetUnitId("");
      options.setSelectedWeaponId("");
      options.setGamePhase(persistedBattle ? "Playing" : "Preparation");
      options.setView(persistedBattle ? "battle" : "setup");
    } catch (error) {
      const message = error instanceof Error ? error.message : options.text(
        "Nie udało się przygotować bitwy kampanijnej.",
        "Could not prepare the campaign battle.",
      );
      options.setCampaignBattleReport(message);
      options.setMenuStatus(message);
    }
  }

  async function resolveCampaignBattle(finalBattle: Battle, finalMission: MissionState): Promise<void> {
    const active = options.activeCampaignBattle;
    const savedCampaign = options.savedCampaign;
    if (!active || !savedCampaign || finalBattle.id !== active.battleId) return;
    if (resolutionInProgress.current === active.battleId) return;
    resolutionInProgress.current = active.battleId;
    try {
      const resolved = resolveActiveCampaignBattle(savedCampaign, active, finalBattle, finalMission);
      const finalSave = createSavedBattle({
        id: active.battleId,
        name: `Campaign battle — ${active.battlePackage.request.planetId}`,
        battle: structuredClone(finalBattle),
        initialBattle: options.battleStartSnapshot ? structuredClone(options.battleStartSnapshot) : undefined,
        logs: structuredClone(options.logs),
        mission: structuredClone(finalMission),
        campaignId: savedCampaign.id,
        scenarioId: active.battlePackage.scenario.id,
      });
      await options.persistence.saveBattle(finalSave);
      await options.persistence.saveCampaign(resolved.savedCampaign);
      options.setSavedCampaign(resolved.savedCampaign);
      options.setCampaignBattleReport(formatCampaignBattleReport(resolved, options.text));
      options.setActiveCampaignBattle(undefined);
      options.setView("campaign");
    } catch (error) {
      options.setCampaignBattleReport(error instanceof Error ? error.message : options.text(
        "Nie udało się rozliczyć bitwy kampanijnej.",
        "Could not resolve the campaign battle.",
      ));
      options.setView("campaign");
    } finally {
      resolutionInProgress.current = undefined;
    }
  }

  return { openCampaignBattle, resolveCampaignBattle };
}

function formatCampaignBattleReport(
  result: ReturnType<typeof resolveActiveCampaignBattle>,
  text: Localize,
): string {
  const { resolution } = result;
  const losses = resolution.outcome.destroyedCampaignUnitIds.length;
  const heroesReturning = resolution.heroesAwaitingReturn.length;
  const heroesLost = resolution.heroesLostPermanently.length;
  const retreats = resolution.retreatedArmyIds.length;
  const eliminated = resolution.eliminatedArmyIds.length;
  const strategicResult = resolution.capturedSector
    ? text("Sektor zdobyty.", "Sector captured.")
    : text("Sektor obroniony.", "Sector defended.");
  const campaignResult = resolution.state.phase === "Finished"
    ? text(` Kampania zakończona: zwycięża ${result.winnerFactionId}.`, ` Campaign finished: ${result.winnerFactionId} wins.`)
    : resolution.state.phase === "Resolution"
      ? text(" Wszystkie aktywacje wykonane — można zakończyć turę.", " All activations are complete — the turn can end.")
      : text(" Inicjatywa wraca na mapę kampanii.", " Initiative returns to the campaign map.");
  return text(
    `Wynik bitwy: ${result.winnerFactionId}. ${strategicResult} Straty: ${losses} jednostek, ${heroesReturning} bohaterów niedostępnych, ${heroesLost} bohaterów utraconych na stałe, odwroty: ${retreats}, eliminacje armii: ${eliminated}.${campaignResult}`,
    `Battle result: ${result.winnerFactionId}. ${strategicResult} Losses: ${losses} units, ${heroesReturning} heroes unavailable, ${heroesLost} heroes permanently lost, retreats: ${retreats}, armies eliminated: ${eliminated}.${campaignResult}`,
  );
}
