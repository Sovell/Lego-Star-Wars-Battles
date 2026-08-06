export type FactionId = string;

export type UnitRole = string;

export type UnitCategory = "infantry" | "hero" | "droid" | "vehicle" | "commander" | string;

export type WeaponKeyword =
  | "AntiVehicle"
  | "Blast"
  | "Deflect"
  | "Ion"
  | "Pierce"
  | "RapidFire"
  | "Shielded"
  | string;

export type WeaponProfile = {
  id: string;
  name: string;
  range: number;
  attacks: number;
  damage: number;
  keywords: WeaponKeyword[];
};

export type UnitTemplate = {
  id: string;
  name: string;
  faction: FactionId;
  category: UnitCategory;
  imageUrl?: string;
  role: UnitRole;
  keywords: string[];
  weapons: WeaponProfile[];
  maxHp: number;
  armorSave?: number;
  movement: number;
  morale: number;
  command: number;
  abilities: string[];
  cost: number;
};

export type UnitStatus = "Ready" | "Activated" | "Destroyed" | "Pinned";

export type TeamId = 1 | 2;

export type ArmyControl = "Human" | "Bot";

export type UnitInstance = {
  id: string;
  templateId: string;
  armyId: string;
  sourceTaskForceId?: string;
  currentHp: number;
  suppression: number;
  abilityCooldowns?: Record<string, number>;
  activeEffects?: string[];
  movedThisTurn?: boolean;
  position: {
    x: number;
    y: number;
  } | null;
  status: UnitStatus;
  hidden: boolean;
};

export type Army = {
  id: string;
  playerName: string;
  faction: FactionId;
  teamId?: TeamId;
  control?: ArmyControl;
  taskForces?: ArmyTaskForceSelection[];
  units: UnitInstance[];
};

export type TerrainType =
  | "Open"
  | "LightCover"
  | "HeavyCover"
  | "Building"
  | "DifficultTerrain"
  | string;

export type TerrainTile = {
  x: number;
  y: number;
  terrainType: TerrainType;
  defenseBonus: number;
  attackBonus: number;
  movementCost: number;
  blocksLineOfSight: boolean;
};

export type BattlefieldObjectType =
  | "DefensePoint"
  | "StrategicPoint"
  | "Generator"
  | "LightFortification"
  | "HeavyFortification";

export type BattlefieldObject = {
  id: string;
  type: BattlefieldObjectType;
  name: string;
  position: { x: number; y: number };
  maxHp: number;
  currentHp: number;
  armorSave?: number;
  defenseBonus: number;
  destructible: boolean;
  blocksLineOfSight: boolean;
  status: "Active" | "Destroyed";
};

export type Board = {
  width: number;
  height: number;
  tiles: TerrainTile[];
  objects?: BattlefieldObject[];
};

export type ActivationToken = {
  id: string;
  armyId: string;
  faction: FactionId;
  used: boolean;
};

export type AbilityTrigger = "Passive" | "OnActivation" | "OnAttack" | "OnDefense" | "EndTurn";

export type AbilityType = "passive" | "active" | "aura";

export type AbilityEffect = {
  type: string;
  value?: number;
  target?: string;
};

export type AbilityDefinition = {
  id: string;
  name: string;
  type?: AbilityType;
  trigger: AbilityTrigger;
  range?: number;
  cooldown?: number;
  effect: AbilityEffect;
  description: string;
};

export type TaskForceDefinition = {
  id: string;
  name: string;
  faction: FactionId;
  heroId: string;
  unitIds: string[];
  cost: number;
  bonusAbility: string;
};

export type ArmyTaskForceSelection = {
  id: string;
  taskForceId: string;
};

export type BattlePhase = "Setup" | "Activation" | "EndTurn" | "Finished";

export type Battle = {
  id: string;
  turn: number;
  armies: Army[];
  board: Board;
  activationBag: ActivationToken[];
  activeActivation?: ActivationToken;
  phase: BattlePhase;
};

export type OrderType = "Move" | "Advance" | "Attack" | "Rally" | "Overwatch";

export type CombatLogEntry = {
  id: string;
  turn: number;
  message: string;
};

export type AttackResult = {
  attackerId: string;
  defenderId: string;
  defenderPosition: {
    x: number;
    y: number;
  } | null;
  weaponName: string;
  hitRolls: number[];
  armorRolls: number[];
  hits: number;
  unsavedHits: number;
  damage: number;
  suppression: number;
  destroyed: boolean;
  moraleRolls?: [number, number];
  retreatedTo?: {
    x: number;
    y: number;
  };
};

export type ObjectAttackResult = {
  attackerId: string;
  objectId: string;
  objectType: BattlefieldObjectType;
  objectPosition: { x: number; y: number };
  weaponName: string;
  hitRolls: number[];
  armorRolls: number[];
  hits: number;
  unsavedHits: number;
  damage: number;
  destroyed: boolean;
};
