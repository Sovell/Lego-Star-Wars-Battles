import type { SavedArmy, SavedBattle, SavedBattleSummary, SavedCampaign } from "./save-types";

export type PersistenceAdapter = {
  saveArmy(savedArmy: SavedArmy): Promise<void>;
  loadArmy(id: string): Promise<SavedArmy | undefined>;
  listArmies(): Promise<SavedArmy[]>;
  deleteArmy(id: string): Promise<void>;
  saveBattle(savedBattle: SavedBattle): Promise<void>;
  loadBattle(id: string): Promise<SavedBattle | undefined>;
  listBattles(): Promise<SavedBattleSummary[]>;
  deleteBattle(id: string): Promise<void>;
  saveCampaign(savedCampaign: SavedCampaign): Promise<void>;
  loadCampaign(id: string): Promise<SavedCampaign | undefined>;
  listCampaigns(): Promise<SavedCampaign[]>;
  deleteCampaign(id: string): Promise<void>;
};
