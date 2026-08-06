export type BotDoctrine = {
  id: "aggressive" | "defensive";
  name: string;
  damagePotentialWeight: number;
  lethalBonus: number;
  targetValueWeight: number;
  coverPenaltyWeight: number;
  remainingHpPenaltyWeight: number;
  objectiveAttackBonus: number;
  abilityBaseScore: number;
  abilityEffectWeight: number;
  movementProgressWeight: number;
  remainingDistancePenaltyWeight: number;
  terrainDefenseWeight: number;
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
  damagePotentialWeight: 50,
  lethalBonus: 10_000,
  targetValueWeight: 1,
  coverPenaltyWeight: 25,
  remainingHpPenaltyWeight: 1,
  objectiveAttackBonus: 100_000,
  abilityBaseScore: 20_000,
  abilityEffectWeight: 500,
  movementProgressWeight: 1_000,
  remainingDistancePenaltyWeight: 1,
  terrainDefenseWeight: 10,
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
  damagePotentialWeight: 100,
  lethalBonus: 10_000,
  targetValueWeight: 0,
  coverPenaltyWeight: 0,
  remainingHpPenaltyWeight: 1,
  objectiveAttackBonus: 0,
  abilityBaseScore: 10_000,
  abilityEffectWeight: 300,
  movementProgressWeight: 400,
  remainingDistancePenaltyWeight: 25,
  terrainDefenseWeight: 500,
  deploymentDistancePenaltyWeight: 25,
  rallyBaseScore: 1_500,
  suppressionWeight: 250,
  overwatchScore: 500,
  finishAdvanceScore: 50,
};
