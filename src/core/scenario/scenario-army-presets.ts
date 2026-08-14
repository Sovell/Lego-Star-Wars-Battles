import { unitTemplates } from "../../data";
import type { Army, ArmyControl, FactionId, TeamId, UnitInstance } from "../../types";
import { getDuplicateHeroTemplateIds } from "../army-roster";
import type { ScenarioReinforcementUnit } from "./scenario-types";

type LocalizedText = { pl: string; en: string };

export type ScenarioArmyPresetArmy = {
  id: string;
  playerName: LocalizedText;
  faction: FactionId;
  teamId: TeamId;
  control: ArmyControl;
  units: ScenarioReinforcementUnit[];
};

export type ScenarioArmyPreset = {
  id: string;
  name: LocalizedText;
  description: LocalizedText;
  armies: ScenarioArmyPresetArmy[];
};

const presetTemplateById = new Map(
  unitTemplates.map((template) => [template.id, template]),
);

const republic = (
  units: ScenarioReinforcementUnit[],
  playerName: LocalizedText = { pl: "Gracz Republiki", en: "Republic Player" },
): ScenarioArmyPresetArmy => ({
  id: "army_republic",
  playerName,
  faction: "Republic",
  teamId: 1,
  control: "Human",
  units,
});

const separatists = (
  units: ScenarioReinforcementUnit[],
  playerName: LocalizedText = { pl: "Armia Separatystów", en: "Separatist Army" },
): ScenarioArmyPresetArmy => ({
  id: "army_separatists",
  playerName,
  faction: "Separatists",
  teamId: 2,
  control: "Bot",
  units,
});

const presets: ScenarioArmyPreset[] = [
  {
    id: "christophsis-last-landing-roster",
    name: { pl: "Obrońcy lądowiska", en: "Landing Zone Defenders" },
    description: {
      pl: "Mobilny oddział Anakina przeciw licznej kolumnie droidów.",
      en: "Anakin's mobile force against a numerous droid column.",
    },
    armies: [
      republic([
        { templateId: "anakin_skywalker", count: 1 },
        { templateId: "clone_trooper_squad", count: 2 },
        { templateId: "clone_command_squad", count: 1 },
        { templateId: "clone_assault_squad", count: 1 },
        { templateId: "at_rt_scout_walker", count: 1 },
      ]),
      separatists([
        { templateId: "b1_droid_regiment", count: 2 },
        { templateId: "b1_battle_droid_commander_squad", count: 1 },
        { templateId: "super_battle_droid_squad", count: 2 },
        { templateId: "dwarf_spider_droid", count: 1 },
      ]),
    ],
  },
  {
    id: "geonosis-heart-of-factory-roster",
    name: { pl: "Grupa szturmowa Windu", en: "Windu Strike Force" },
    description: {
      pl: "Elitarny zespół do przełamania obrony fabryki droidów.",
      en: "An elite force built to breach the droid foundry defenses.",
    },
    armies: [
      republic([
        { templateId: "mace_windu", count: 1 },
        { templateId: "clone_assault_squad", count: 2 },
        { templateId: "clone_command_squad", count: 1 },
        { templateId: "clone_engineers_332nd", count: 1 },
        { templateId: "at_rt_scout_walker", count: 1 },
      ]),
      separatists([
        { templateId: "count_dooku", count: 1 },
        { templateId: "magnaguard_squad", count: 1 },
        { templateId: "b1_droid_regiment", count: 2 },
        { templateId: "super_battle_droid_squad", count: 1 },
        { templateId: "dwarf_spider_droid", count: 1 },
      ]),
    ],
  },
  {
    id: "felucia-surrounded-roster",
    name: { pl: "Okrążona 501.", en: "Encircled 501st" },
    description: {
      pl: "Ahsoka i Rex utrzymują oddział przy życiu do nadejścia wsparcia.",
      en: "Ahsoka and Rex keep their force alive until support arrives.",
    },
    armies: [
      republic([
        { templateId: "ahsoka_tano", count: 1 },
        { templateId: "captain_rex", count: 1 },
        { templateId: "clone_trooper_squad", count: 2 },
        { templateId: "clone_assault_squad", count: 1 },
        { templateId: "at_rt_scout_walker", count: 1 },
      ]),
      separatists([
        { templateId: "general_grievous", count: 1 },
        { templateId: "magnaguard_squad", count: 1 },
        { templateId: "b1_droid_regiment", count: 2 },
        { templateId: "super_battle_droid_squad", count: 1 },
        { templateId: "dwarf_spider_droid", count: 1 },
      ]),
    ],
  },
  {
    id: "mandalore-hunt-in-sundari-roster",
    name: { pl: "Pościg w Sundari", en: "Sundari Pursuit" },
    description: {
      pl: "Ahsoka i Rex ścigają Maula, który pojawia się jako zdarzenie misji.",
      en: "Ahsoka and Rex hunt Maul, who enters through a mission event.",
    },
    armies: [
      republic([
        { templateId: "ahsoka_tano", count: 1 },
        { templateId: "captain_rex", count: 1 },
        { templateId: "clone_trooper_squad", count: 2 },
        { templateId: "clone_assault_squad", count: 1 },
        { templateId: "clone_command_squad", count: 1 },
      ]),
      separatists([
        { templateId: "bx_commando_droid", count: 2 },
        { templateId: "b1_battle_droid_commander_squad", count: 1 },
        { templateId: "magnaguard_squad", count: 1 },
        { templateId: "b1_droid_regiment", count: 2 },
      ]),
    ],
  },
  {
    id: "christophsis-crystal-data-roster",
    name: { pl: "Zespół odzyskiwania danych", en: "Data Recovery Team" },
    description: {
      pl: "Szybka grupa Republiki osłaniana przez cięższe jednostki droidów.",
      en: "A fast Republic team opposed by heavier droid formations.",
    },
    armies: [
      republic([
        { templateId: "anakin_skywalker", count: 1 },
        { templateId: "captain_rex", count: 1 },
        { templateId: "clone_trooper_squad", count: 1 },
        { templateId: "clone_command_squad", count: 1 },
        { templateId: "clone_engineers_332nd", count: 1 },
        { templateId: "laat_patrol", count: 1 },
      ]),
      separatists([
        { templateId: "general_grievous", count: 1 },
        { templateId: "b1_battle_droid_commander_squad", count: 1 },
        { templateId: "b1_droid_regiment", count: 2 },
        { templateId: "super_battle_droid_squad", count: 1 },
        { templateId: "dwarf_spider_droid", count: 1 },
      ]),
    ],
  },
  {
    id: "separatist-warship-rescue-r2d2-roster",
    name: { pl: "Oddział ratunkowy R2-D2", en: "R2-D2 Rescue Team" },
    description: {
      pl: "Mobilny oddział Obi-Wana przedziera się przez pokład więzienny okrętu Separatystów.",
      en: "Obi-Wan's mobile force fights through a Separatist detention deck.",
    },
    armies: [
      republic([
        { templateId: "obi_wan_kenobi", count: 1 },
        { templateId: "captain_rex", count: 1 },
        { templateId: "clone_trooper_squad", count: 2 },
        { templateId: "clone_command_squad", count: 1 },
        { templateId: "clone_engineers_332nd", count: 1 },
      ]),
      separatists([
        { templateId: "general_grievous", count: 1 },
        { templateId: "magnaguard_squad", count: 1 },
        { templateId: "bx_commando_droid", count: 2 },
        { templateId: "b1_battle_droid_commander_squad", count: 1 },
        { templateId: "b1_droid_regiment", count: 1 },
      ]),
    ],
  },
  {
    id: "ryloth-liberation-roster",
    name: { pl: "Brygada wyzwolenia Ryloth", en: "Ryloth Liberation Brigade" },
    description: {
      pl: "Komandosi i zwiad Republiki przeciw mobilnej blokadzie Separatystów.",
      en: "Republic commandos and scouts against a mobile Separatist blockade.",
    },
    armies: [
      republic([
        { templateId: "commander_cody", count: 1 },
        { templateId: "clone_commando_section", count: 1 },
        { templateId: "clone_medic_squad", count: 1 },
        { templateId: "clone_trooper_squad", count: 2 },
        { templateId: "at_rt_scout_walker", count: 1 },
      ]),
      separatists([
        { templateId: "b1_battle_droid_commander_squad", count: 1 },
        { templateId: "b1_droid_regiment", count: 2 },
        { templateId: "b1_recon_squad", count: 1 },
        { templateId: "stap_patrol", count: 1 },
        { templateId: "dwarf_spider_droid", count: 1 },
      ]),
    ],
  },
  {
    id: "republic-research-station-lockdown-roster",
    name: { pl: "Załoga stacji badawczej", en: "Research Station Garrison" },
    description: {
      pl: "Obrońcy i medycy Republiki odpierają abordaż ciężkich droidów.",
      en: "Republic defenders and medics repel a heavy droid boarding force.",
    },
    armies: [
      republic([
        { templateId: "obi_wan_kenobi", count: 1 },
        { templateId: "clone_command_squad", count: 1 },
        { templateId: "clone_trooper_squad", count: 2 },
        { templateId: "clone_medic_squad", count: 1 },
        { templateId: "clone_engineers_332nd", count: 1 },
      ]),
      separatists([
        { templateId: "general_grievous", count: 1 },
        { templateId: "b1_battle_droid_commander_squad", count: 1 },
        { templateId: "b1_droid_squad", count: 2 },
        { templateId: "super_battle_droid_squad", count: 1 },
        { templateId: "bx_commando_droid", count: 1 },
      ]),
    ],
  },
];

const presetByScenarioId = new Map([
  ["christophsis-last-landing", presets[0]],
  ["geonosis-heart-of-factory", presets[1]],
  ["felucia-surrounded", presets[2]],
  ["mandalore-hunt-in-sundari", presets[3]],
  ["christophsis-crystal-data", presets[4]],
  ["separatist-warship-rescue-r2d2", presets[5]],
  ["ryloth-liberation", presets[6]],
  ["republic-research-station-lockdown", presets[7]],
]);

export function getScenarioArmyPreset(scenarioId: string): ScenarioArmyPreset | undefined {
  return presetByScenarioId.get(scenarioId);
}

export function buildScenarioPresetArmies(
  preset: ScenarioArmyPreset,
  language: "pl" | "en",
): Army[] {
  const armies = preset.armies.map((presetArmy) => {
    let unitIndex = 0;
    const units = presetArmy.units.flatMap(({ templateId, count }) => {
      const template = presetTemplateById.get(templateId);
      if (!template || template.faction !== presetArmy.faction) {
        throw new Error(`Invalid unit ${templateId} in army preset ${preset.id}.`);
      }

      return Array.from({ length: Math.max(0, Math.floor(count)) }, () => {
        unitIndex += 1;
        return createPresetUnit(presetArmy.id, template.id, template.maxHp, unitIndex);
      });
    });

    return {
      id: presetArmy.id,
      playerName: presetArmy.playerName[language],
      faction: presetArmy.faction,
      teamId: presetArmy.teamId,
      control: presetArmy.control,
      units,
    };
  });

  const duplicateHeroes = getDuplicateHeroTemplateIds(armies);
  if (duplicateHeroes.length > 0) {
    throw new Error(`Army preset ${preset.id} duplicates heroes: ${duplicateHeroes.join(", ")}.`);
  }

  return armies;
}

function createPresetUnit(
  armyId: string,
  templateId: string,
  maxHp: number,
  index: number,
): UnitInstance {
  return {
    id: `${armyId}_preset_${templateId}_${index}`,
    templateId,
    armyId,
    currentHp: maxHp,
    suppression: 0,
    abilityCooldowns: {},
    activeEffects: [],
    movedThisTurn: false,
    position: null,
    status: "Ready",
    hidden: false,
  };
}
