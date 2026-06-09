export type FactionId = string;

export type UnitRole = "Commander" | "Line" | "Support" | "Heavy" | "Specialist";

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

export type UnitInstance = {
  id: string;
  templateId: string;
  armyId: string;
  currentHp: number;
  suppression: number;
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

export type Board = {
  width: number;
  height: number;
  tiles: TerrainTile[];
};

export type ActivationToken = {
  id: string;
  armyId: string;
  faction: FactionId;
  used: boolean;
};

export type AbilityTrigger = "Passive" | "OnActivation" | "OnAttack" | "OnDefense" | "EndTurn";

export type AbilityEffect = {
  type: string;
  value?: number;
  target?: string;
};

export type AbilityDefinition = {
  id: string;
  name: string;
  trigger: AbilityTrigger;
  effect: AbilityEffect;
  description: string;
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

export type OrderType = "Advance" | "Attack" | "Rally" | "Overwatch";

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
};
