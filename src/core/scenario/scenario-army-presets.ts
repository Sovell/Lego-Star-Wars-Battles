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

const campaignPreset = (
  id: string,
  name: LocalizedText,
  description: LocalizedText,
  republicUnits: ScenarioReinforcementUnit[],
  separatistUnits: ScenarioReinforcementUnit[],
): ScenarioArmyPreset => ({
  id: `${id}-roster`,
  name,
  description,
  armies: [republic(republicUnits), separatists(separatistUnits)],
});

const campaignPresetDefinitions: Array<{
  scenarioId: string;
  preset: ScenarioArmyPreset;
}> = [{
  scenarioId: "tatooine-ghost-relay",
  preset: campaignPreset(
    "tatooine-ghost-relay",
    { pl: "Łowcy widmowego sygnału", en: "Ghost Signal Hunters" },
    { pl: "Obi-Wan i Cody prowadzą elitarny zwiad przez pustynię.", en: "Obi-Wan and Cody lead an elite desert reconnaissance force." },
    [
      { templateId: "obi_wan_kenobi", count: 1 },
      { templateId: "commander_cody", count: 1 },
      { templateId: "clone_commando_section", count: 1 },
      { templateId: "clone_medic_squad", count: 1 },
      { templateId: "clone_trooper_squad", count: 1 },
      { templateId: "at_rt_scout_walker", count: 1 },
    ],
    [
      { templateId: "asajj_ventress", count: 1 },
      { templateId: "jango_fett", count: 1 },
      { templateId: "b1_battle_droid_commander_squad", count: 1 },
      { templateId: "b1_recon_squad", count: 1 },
      { templateId: "stap_patrol", count: 1 },
      { templateId: "super_battle_droid_squad", count: 1 },
    ],
  ),
}, {
  scenarioId: "endor-broken-canopy",
  preset: campaignPreset(
    "endor-broken-canopy",
    { pl: "Zwiad zielonego księżyca", en: "Green Moon Recon" },
    { pl: "Yoda i Ahsoka próbują wyprowadzić patrol z leśnej pułapki.", en: "Yoda and Ahsoka try to lead a patrol out of a forest trap." },
    [
      { templateId: "yoda", count: 1 },
      { templateId: "ahsoka_tano", count: 1 },
      { templateId: "clone_command_squad", count: 1 },
      { templateId: "clone_commando_section", count: 1 },
      { templateId: "clone_medic_squad", count: 1 },
      { templateId: "at_rt_scout_walker", count: 1 },
    ],
    [
      { templateId: "general_grievous", count: 1 },
      { templateId: "asajj_ventress", count: 1 },
      { templateId: "b1_battle_droid_commander_squad", count: 1 },
      { templateId: "b1_recon_squad", count: 2 },
      { templateId: "bx_commando_droid", count: 1 },
      { templateId: "dwarf_spider_droid", count: 1 },
    ],
  ),
}, {
  scenarioId: "hoth-white-silence",
  preset: campaignPreset(
    "hoth-white-silence",
    { pl: "Obrońcy białej placówki", en: "White Outpost Defenders" },
    { pl: "Obi-Wan i Cody bronią nadajnika podczas burzy jonowej.", en: "Obi-Wan and Cody defend the transmitter during an ion storm." },
    [
      { templateId: "obi_wan_kenobi", count: 1 },
      { templateId: "commander_cody", count: 1 },
      { templateId: "clone_command_squad", count: 1 },
      { templateId: "clone_trooper_squad", count: 2 },
      { templateId: "clone_medic_squad", count: 1 },
      { templateId: "at_rt_scout_walker", count: 1 },
    ],
    [
      { templateId: "general_grievous", count: 1 },
      { templateId: "count_dooku", count: 1 },
      { templateId: "b1_droid_regiment", count: 1 },
      { templateId: "super_battle_droid_squad", count: 2 },
      { templateId: "dwarf_spider_droid", count: 1 },
    ],
  ),
}, {
  scenarioId: "mustafar-black-furnace",
  preset: campaignPreset(
    "mustafar-black-furnace",
    { pl: "Ostrza nad czarnym piecem", en: "Blades over the Black Furnace" },
    { pl: "Mace i Anakin prowadzą wielki szturm na odlewnię.", en: "Mace and Anakin lead a major assault on the foundry." },
    [
      { templateId: "mace_windu", count: 1 },
      { templateId: "anakin_skywalker", count: 1 },
      { templateId: "clone_trooper_squad", count: 1 },
      { templateId: "clone_commando_section", count: 1 },
      { templateId: "clone_engineers_332nd", count: 1 },
      { templateId: "clone_assault_squad", count: 1 },
    ],
    [
      { templateId: "count_dooku", count: 1 },
      { templateId: "asajj_ventress", count: 1 },
      { templateId: "b1_droid_regiment", count: 1 },
      { templateId: "magnaguard_squad", count: 1 },
      { templateId: "super_battle_droid_squad", count: 1 },
      { templateId: "aat_battle_tank", count: 1 },
    ],
  ),
}, {
  scenarioId: "geonosis-last-template",
  preset: campaignPreset(
    "geonosis-last-template",
    { pl: "Rada na Geonosis", en: "Council on Geonosis" },
    { pl: "Yoda i Mace walczą o bezcenną matrycę taktyczną.", en: "Yoda and Mace fight for a priceless tactical template." },
    [
      { templateId: "yoda", count: 1 },
      { templateId: "mace_windu", count: 1 },
      { templateId: "clone_trooper_squad", count: 1 },
      { templateId: "clone_commando_section", count: 1 },
      { templateId: "clone_assault_squad", count: 1 },
      { templateId: "clone_engineers_332nd", count: 1 },
    ],
    [
      { templateId: "count_dooku", count: 1 },
      { templateId: "jango_fett", count: 1 },
      { templateId: "b1_droid_regiment", count: 1 },
      { templateId: "magnaguard_squad", count: 1 },
      { templateId: "b1_droid_regiment", count: 1 },
      { templateId: "aat_battle_tank", count: 1 },
    ],
  ),
}, {
  scenarioId: "felucia-lost-patrol",
  preset: campaignPreset(
    "felucia-lost-patrol",
    { pl: "Ratownicy 501.", en: "501st Rescue Force" },
    { pl: "Ahsoka i Rex szukają patroli pośród grzybowych ostępów.", en: "Ahsoka and Rex search for patrols in the fungal wilds." },
    [
      { templateId: "ahsoka_tano", count: 1 },
      { templateId: "captain_rex", count: 1 },
      { templateId: "clone_command_squad", count: 1 },
      { templateId: "clone_medic_squad", count: 1 },
      { templateId: "clone_trooper_squad", count: 1 },
      { templateId: "at_rt_scout_walker", count: 1 },
    ],
    [
      { templateId: "general_grievous", count: 1 },
      { templateId: "asajj_ventress", count: 1 },
      { templateId: "bx_commando_droid", count: 1 },
      { templateId: "b1_droid_regiment", count: 2 },
      { templateId: "super_battle_droid_squad", count: 1 },
      { templateId: "dwarf_spider_droid", count: 1 },
    ],
  ),
}, {
  scenarioId: "christophsis-zero-junction",
  preset: campaignPreset(
    "christophsis-zero-junction",
    { pl: "Bohaterowie Kryształowego Miasta", en: "Heroes of the Crystal City" },
    { pl: "Anakin i Obi-Wan prowadzą grupę uderzeniową do Węzła Zero.", en: "Anakin and Obi-Wan lead a strike group to Junction Zero." },
    [
      { templateId: "anakin_skywalker", count: 1 },
      { templateId: "obi_wan_kenobi", count: 1 },
      { templateId: "clone_trooper_squad", count: 1 },
      { templateId: "clone_command_squad", count: 1 },
      { templateId: "clone_commando_section", count: 1 },
      { templateId: "clone_assault_squad", count: 1 },
      { templateId: "laat_patrol", count: 1 },
    ],
    [
      { templateId: "count_dooku", count: 1 },
      { templateId: "general_grievous", count: 1 },
      { templateId: "b1_droid_regiment", count: 1 },
      { templateId: "b1_battle_droid_commander_squad", count: 1 },
      { templateId: "b1_droid_regiment", count: 1 },
      { templateId: "super_battle_droid_squad", count: 1 },
      { templateId: "aat_battle_tank", count: 1 },
    ],
  ),
}, {
  scenarioId: "mandalore-palace-under-siege",
  preset: campaignPreset(
    "mandalore-palace-under-siege",
    { pl: "Obrona pałacu Sundari", en: "Sundari Palace Defense" },
    { pl: "Ahsoka i Rex stają przeciw Maulowi oraz jego łowcom.", en: "Ahsoka and Rex face Maul and his hunters." },
    [
      { templateId: "ahsoka_tano", count: 1 },
      { templateId: "captain_rex", count: 1 },
      { templateId: "clone_trooper_squad", count: 1 },
      { templateId: "clone_commando_section", count: 1 },
      { templateId: "clone_assault_squad", count: 1 },
      { templateId: "clone_medic_squad", count: 1 },
    ],
    [
      { templateId: "darth_maul", count: 1 },
      { templateId: "jango_fett", count: 1 },
      { templateId: "b1_droid_regiment", count: 1 },
      { templateId: "bx_commando_droid", count: 2 },
      { templateId: "magnaguard_squad", count: 1 },
    ],
  ),
}, {
  scenarioId: "ryloth-storm-over-lessu",
  preset: campaignPreset(
    "ryloth-storm-over-lessu",
    { pl: "Szturm na pierścień Lessu", en: "Assault on the Lessu Ring" },
    { pl: "Obi-Wan i Cody prowadzą połączone oddziały przez kaniony.", en: "Obi-Wan and Cody lead combined forces through the canyons." },
    [
      { templateId: "obi_wan_kenobi", count: 1 },
      { templateId: "commander_cody", count: 1 },
      { templateId: "clone_trooper_squad", count: 1 },
      { templateId: "clone_commando_section", count: 1 },
      { templateId: "clone_medic_squad", count: 1 },
      { templateId: "at_rt_scout_walker", count: 1 },
    ],
    [
      { templateId: "general_grievous", count: 1 },
      { templateId: "asajj_ventress", count: 1 },
      { templateId: "b1_battle_droid_commander_squad", count: 1 },
      { templateId: "b1_droid_regiment", count: 1 },
      { templateId: "b1_recon_squad", count: 1 },
      { templateId: "stap_patrol", count: 1 },
      { templateId: "dwarf_spider_droid", count: 1 },
    ],
  ),
}, {
  scenarioId: "research-station-project-echo",
  preset: campaignPreset(
    "research-station-project-echo",
    { pl: "Zespół odzyskiwania Echo", en: "Echo Recovery Team" },
    { pl: "Obi-Wan i Ahsoka oczyszczają laboratoria terminal po terminalu.", en: "Obi-Wan and Ahsoka clear the laboratories terminal by terminal." },
    [
      { templateId: "obi_wan_kenobi", count: 1 },
      { templateId: "ahsoka_tano", count: 1 },
      { templateId: "clone_trooper_squad", count: 1 },
      { templateId: "clone_commando_section", count: 1 },
      { templateId: "clone_medic_squad", count: 1 },
      { templateId: "clone_engineers_332nd", count: 1 },
    ],
    [
      { templateId: "general_grievous", count: 1 },
      { templateId: "asajj_ventress", count: 1 },
      { templateId: "bx_commando_droid", count: 2 },
      { templateId: "b1_battle_droid_commander_squad", count: 1 },
      { templateId: "super_battle_droid_squad", count: 1 },
    ],
  ),
}, {
  scenarioId: "separatist-warship-bridgefall",
  preset: campaignPreset(
    "separatist-warship-bridgefall",
    { pl: "Szturm bohaterów na mostek", en: "Heroes' Bridge Assault" },
    { pl: "Anakin i Obi-Wan prowadzą decydujący abordaż.", en: "Anakin and Obi-Wan lead the decisive boarding action." },
    [
      { templateId: "anakin_skywalker", count: 1 },
      { templateId: "obi_wan_kenobi", count: 1 },
      { templateId: "clone_assault_squad", count: 1 },
      { templateId: "clone_command_squad", count: 1 },
      { templateId: "clone_commando_section", count: 1 },
      { templateId: "clone_engineers_332nd", count: 1 },
    ],
    [
      { templateId: "general_grievous", count: 1 },
      { templateId: "count_dooku", count: 1 },
      { templateId: "b1_droid_regiment", count: 1 },
      { templateId: "magnaguard_squad", count: 1 },
      { templateId: "bx_commando_droid", count: 1 },
      { templateId: "super_battle_droid_squad", count: 1 },
    ],
  ),
}, {
  scenarioId: "republic-warship-deck-seventeen",
  preset: campaignPreset(
    "republic-warship-deck-seventeen",
    { pl: "Bohaterowie pokładu siedemnastego", en: "Heroes of Deck Seventeen" },
    { pl: "Anakin i Obi-Wan bronią serca okrętu.", en: "Anakin and Obi-Wan defend the heart of the ship." },
    [
      { templateId: "anakin_skywalker", count: 1 },
      { templateId: "obi_wan_kenobi", count: 1 },
      { templateId: "clone_trooper_squad", count: 1 },
      { templateId: "clone_assault_squad", count: 1 },
      { templateId: "clone_engineers_332nd", count: 1 },
      { templateId: "clone_medic_squad", count: 1 },
      { templateId: "clone_command_squad", count: 1 },
    ],
    [
      { templateId: "general_grievous", count: 1 },
      { templateId: "count_dooku", count: 1 },
      { templateId: "b1_droid_regiment", count: 1 },
      { templateId: "bx_commando_droid", count: 2 },
      { templateId: "magnaguard_squad", count: 1 },
      { templateId: "super_battle_droid_squad", count: 1 },
    ],
  ),
}];

presets.push(...campaignPresetDefinitions.map(({ preset }) => preset));

const presetByScenarioId = new Map([
  ["christophsis-last-landing", presets[0]],
  ["geonosis-heart-of-factory", presets[1]],
  ["felucia-surrounded", presets[2]],
  ["mandalore-hunt-in-sundari", presets[3]],
  ["christophsis-crystal-data", presets[4]],
  ["separatist-warship-rescue-r2d2", presets[5]],
  ["ryloth-liberation", presets[6]],
  ["republic-research-station-lockdown", presets[7]],
  ...campaignPresetDefinitions.map(({ scenarioId, preset }) => [scenarioId, preset] as const),
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
