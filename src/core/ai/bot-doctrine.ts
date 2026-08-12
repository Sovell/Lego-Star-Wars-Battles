export type BotDoctrine = {
  id: BotProfileId;
  name: string;
  objectivePolicy: "Assault" | "Hold";
  attackBaseScore: number;
  damagePotentialWeight: number;
  lethalBonus: number;
  targetValueWeight: number;
  coverPenaltyWeight: number;
  remainingHpPenaltyWeight: number;
  objectiveAttackBonus: number;
  objectiveDefenseThreatWeight: number;
  objectiveImmediateThreatBonus: number;
  abilityBaseScore: number;
  abilityEffectWeight: number;
  movementBaseScore: number;
  movementProgressWeight: number;
  remainingDistancePenaltyWeight: number;
  terrainDefenseWeight: number;
  advanceActionBonus: number;
  deploymentBaseScore: number;
  deploymentDistancePenaltyWeight: number;
  rallyBaseScore: number;
  suppressionWeight: number;
  overwatchScore: number;
  finishAdvanceScore: number;
};

export type BotProfileId =
  | "aggressive"
  | "defensive"
  | "objective"
  | "swarm"
  | "hunter";

/** Pushes units toward damage, eliminations and scenario targets. */
export const aggressiveBotDoctrine: BotDoctrine = {
  id: "aggressive",
  name: "Agresywne natarcie",
  objectivePolicy: "Assault",
  attackBaseScore: 40_000,
  damagePotentialWeight: 50,
  lethalBonus: 10_000,
  targetValueWeight: 1,
  coverPenaltyWeight: 25,
  remainingHpPenaltyWeight: 1,
  objectiveAttackBonus: 100_000,
  objectiveDefenseThreatWeight: 0,
  objectiveImmediateThreatBonus: 0,
  abilityBaseScore: 50_000,
  abilityEffectWeight: 500,
  movementBaseScore: 20_000,
  movementProgressWeight: 1_000,
  remainingDistancePenaltyWeight: 1,
  terrainDefenseWeight: 10,
  advanceActionBonus: 500,
  deploymentBaseScore: 30_000,
  deploymentDistancePenaltyWeight: 1,
  rallyBaseScore: 1_000,
  suppressionWeight: 100,
  overwatchScore: 100,
  finishAdvanceScore: 50,
};

/** Favors protected positions and stabilizing the defensive line. */
export const defensiveBotDoctrine: BotDoctrine = {
  id: "defensive",
  name: "Obrona pozycyjna",
  objectivePolicy: "Hold",
  attackBaseScore: 50_000,
  damagePotentialWeight: 100,
  lethalBonus: 10_000,
  targetValueWeight: 0,
  coverPenaltyWeight: 0,
  remainingHpPenaltyWeight: 1,
  objectiveAttackBonus: 0,
  objectiveDefenseThreatWeight: 3_000,
  objectiveImmediateThreatBonus: 30_000,
  abilityBaseScore: 45_000,
  abilityEffectWeight: 300,
  movementBaseScore: 20_000,
  movementProgressWeight: 400,
  remainingDistancePenaltyWeight: 25,
  terrainDefenseWeight: 500,
  advanceActionBonus: 500,
  deploymentBaseScore: 30_000,
  deploymentDistancePenaltyWeight: 25,
  rallyBaseScore: 1_500,
  suppressionWeight: 10_000,
  overwatchScore: 500,
  finishAdvanceScore: 50,
};

/** Sacrifices incidental damage in order to complete the current mission goal. */
export const objectiveBotDoctrine: BotDoctrine = {
  ...aggressiveBotDoctrine,
  id: "objective",
  name: "Priorytet misji",
  objectiveAttackBonus: 180_000,
  movementBaseScore: 45_000,
  movementProgressWeight: 2_500,
  remainingDistancePenaltyWeight: 50,
  deploymentBaseScore: 55_000,
  deploymentDistancePenaltyWeight: 75,
  lethalBonus: 4_000,
  targetValueWeight: 0,
};

/** Gets reserves onto the board quickly and keeps a broad advance moving. */
export const swarmBotDoctrine: BotDoctrine = {
  ...aggressiveBotDoctrine,
  id: "swarm",
  name: "Natarcie rojem",
  attackBaseScore: 32_000,
  abilityBaseScore: 34_000,
  movementBaseScore: 30_000,
  movementProgressWeight: 1_400,
  advanceActionBonus: 1_500,
  deploymentBaseScore: 70_000,
  deploymentDistancePenaltyWeight: 10,
  targetValueWeight: 0,
  terrainDefenseWeight: 0,
  overwatchScore: 25,
};

/** Pursues valuable and vulnerable enemy units instead of static objectives. */
export const hunterBotDoctrine: BotDoctrine = {
  ...aggressiveBotDoctrine,
  id: "hunter",
  name: "Łowca celów",
  objectiveAttackBonus: 5_000,
  attackBaseScore: 55_000,
  damagePotentialWeight: 80,
  lethalBonus: 18_000,
  targetValueWeight: 750,
  remainingHpPenaltyWeight: 8,
  abilityBaseScore: 60_000,
  abilityEffectWeight: 650,
};

export const botDoctrines: Readonly<Record<BotProfileId, BotDoctrine>> = {
  aggressive: aggressiveBotDoctrine,
  defensive: defensiveBotDoctrine,
  objective: objectiveBotDoctrine,
  swarm: swarmBotDoctrine,
  hunter: hunterBotDoctrine,
};

export function getBotDoctrine(profile: BotProfileId): BotDoctrine {
  return botDoctrines[profile];
}
