export type BotDoctrine = {
  id: "aggressive" | "defensive";
  name: string;
  objectivePolicy: "Assault" | "Hold";
  attackBaseScore: number;
  damagePotentialWeight: number;
  lethalBonus: number;
  targetValueWeight: number;
  coverPenaltyWeight: number;
  remainingHpPenaltyWeight: number;
  objectiveAttackBonus: number;
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
  suppressionWeight: 250,
  overwatchScore: 500,
  finishAdvanceScore: 50,
};
