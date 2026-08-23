import { unitTemplates } from "../../data";
import {
  getCampaignArmyPointCost,
  getCampaignPlanetController,
  getRequiredBaseLevel,
  type CampaignArmy,
  type CampaignBaseState,
  type CampaignPlayer,
  type CampaignPlanetState,
  type CampaignState,
} from "../../core/campaign";

export type CampaignEconomyDetails = {
  economyOpen: boolean;
  player?: CampaignPlayer;
  controlledPlanets: CampaignPlanetState[];
  bases: CampaignBaseState[];
  constructionQueue: CampaignState["constructionQueue"];
  recruitmentQueue: CampaignState["recruitmentQueue"];
  recruitmentOptions: CampaignRecruitmentOption[];
};

export type CampaignRecruitmentOption = {
  templateId: string;
  name: string;
  cost: number;
  requiredBaseLevel: 1 | 2 | 3;
  isHero: boolean;
  heroAvailable: boolean;
};

export type CampaignReserveDeploymentPreview = {
  reserves: CampaignState["reserves"];
  heroes: CampaignState["heroes"];
  armies: CampaignArmy[];
  pointCost: number;
  pointLimit: number;
  heroCount: number;
  heroLimit: number;
  canDeploy: boolean;
};

/**
 * Builds the economy view from campaign state only. All mutations remain in
 * campaign-economy.ts, so this model can safely be used to disable UI controls.
 */
export function getCampaignEconomyDetails(
  state: CampaignState,
  playerId: string,
): CampaignEconomyDetails {
  const player = state.players.find(({ id }) => id === playerId);
  if (!player) {
    return {
      economyOpen: false,
      controlledPlanets: [],
      bases: [],
      constructionQueue: [],
      recruitmentQueue: [],
      recruitmentOptions: [],
    };
  }

  const controlledPlanets = state.planets.filter((planet) =>
    getCampaignPlanetController(state, planet.planetId) === player.factionId &&
    planet.sectors.some((sector) =>
      sector.role === "Command" && sector.controllerPlayerId === playerId
    )
  );
  const factionHeroes = new Map(state.heroes.map((hero) => [hero.heroId, hero]));

  return {
    economyOpen: state.phase === "Income" && state.incomeCollectedForTurn === state.turn,
    player,
    controlledPlanets,
    bases: state.bases.filter(({ ownerPlayerId }) => ownerPlayerId === playerId),
    constructionQueue: state.constructionQueue.filter(({ ownerPlayerId }) => ownerPlayerId === playerId),
    recruitmentQueue: state.recruitmentQueue.filter(({ ownerPlayerId }) => ownerPlayerId === playerId),
    recruitmentOptions: unitTemplates
      .filter(({ faction }) => faction === player.factionId)
      .map((template): CampaignRecruitmentOption => {
        const hero = factionHeroes.get(template.id);
        return {
          templateId: template.id,
          name: template.name,
          cost: template.cost,
          requiredBaseLevel: getRequiredBaseLevel(template.id),
          isHero: Boolean(hero),
          heroAvailable: !hero || (hero.status === "Available" && hero.availableFromTurn <= state.turn),
        };
      })
      .sort((left, right) => left.requiredBaseLevel - right.requiredBaseLevel || left.name.localeCompare(right.name)),
  };
}

export function getCampaignReserveDeploymentPreview(
  state: CampaignState,
  playerId: string,
  planetId: string,
  unitIds: readonly string[],
  heroIds: readonly string[],
  armyId?: string,
): CampaignReserveDeploymentPreview {
  const selectedUnitIds = new Set(unitIds);
  const selectedHeroIds = new Set(heroIds);
  const reserves = state.reserves.filter((reserve) =>
    reserve.ownerPlayerId === playerId && reserve.planetId === planetId
  );
  const heroes = state.heroes.filter((hero) =>
    hero.status === "Reserve" && hero.ownerPlayerId === playerId && hero.reservePlanetId === planetId
  );
  const armies = state.armies.filter((army) =>
    army.ownerPlayerId === playerId && army.planetId === planetId
  );
  const targetArmy = armyId ? armies.find(({ id }) => id === armyId) : undefined;
  const requestedArmyMissing = Boolean(armyId && !targetArmy);
  const selectedReserves = reserves.filter(({ id }) => selectedUnitIds.has(id));
  const selectedHeroes = heroes.filter(({ heroId }) => selectedHeroIds.has(heroId));
  const combinedUnits = [...(targetArmy?.units ?? []), ...selectedReserves];
  const combinedHeroIds = [...(targetArmy?.heroIds ?? []), ...selectedHeroes.map(({ heroId }) => heroId)];
  const pointCost = getCampaignArmyPointCost(combinedUnits, combinedHeroIds);
  const hasBase = state.bases.some((base) =>
    base.ownerPlayerId === playerId && base.planetId === planetId
  );

  return {
    reserves,
    heroes,
    armies,
    pointCost,
    pointLimit: state.rules.armyPointLimit,
    heroCount: combinedHeroIds.length,
    heroLimit: state.rules.maxHeroesPerArmy,
    canDeploy: !requestedArmyMissing && hasBase && (selectedReserves.length > 0 || selectedHeroes.length > 0) &&
      pointCost <= state.rules.armyPointLimit && combinedHeroIds.length <= state.rules.maxHeroesPerArmy,
  };
}
