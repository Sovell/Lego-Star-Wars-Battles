import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type {
  AbilityDefinition,
  ArmyControl,
  BattlefieldObjectType,
  FactionId,
  OrderType,
  TerrainType,
  UnitStatus,
} from "./types";

export type Language = "pl" | "en";

type I18nContextValue = {
  language: Language;
  locale: "pl-PL" | "en-US";
  setLanguage: (language: Language) => void;
  text: (polish: string, english: string) => string;
};

const languageStorageKey = "lswb:language";
const I18nContext = createContext<I18nContextValue | undefined>(undefined);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguage] = useState<Language>(() => {
    try {
      return window.localStorage.getItem(languageStorageKey) === "en" ? "en" : "pl";
    } catch {
      return "pl";
    }
  });

  useEffect(() => {
    document.documentElement.lang = language;
    try {
      window.localStorage.setItem(languageStorageKey, language);
    } catch {
      // Language switching still works when persistent storage is unavailable.
    }
  }, [language]);

  const value = useMemo<I18nContextValue>(() => ({
    language,
    locale: language === "pl" ? "pl-PL" : "en-US",
    setLanguage,
    text: (polish, english) => language === "pl" ? polish : english,
  }), [language]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const value = useContext(I18nContext);
  if (!value) throw new Error("useI18n must be used inside I18nProvider.");
  return value;
}

export function LanguageSwitcher() {
  const { language, setLanguage, text } = useI18n();
  return (
    <div className="languageSwitcher" role="group" aria-label={text("Język aplikacji", "Application language")}>
      <button
        className={language === "pl" ? "active" : ""}
        type="button"
        aria-pressed={language === "pl"}
        onClick={() => setLanguage("pl")}
      >
        PL
      </button>
      <button
        className={language === "en" ? "active" : ""}
        type="button"
        aria-pressed={language === "en"}
        onClick={() => setLanguage("en")}
      >
        EN
      </button>
    </div>
  );
}

type Localized = { pl: string; en: string };

function pick(language: Language, value: Localized | undefined, fallback: string): string {
  return value?.[language] ?? fallback;
}

const scenarioText: Record<string, { name: Localized; description: Localized }> = {
  "christophsis-last-landing": {
    name: { pl: "Christophsis: Ostatnie lądowisko", en: "Christophsis: Last Landing Zone" },
    description: {
      pl: "Utrzymaj lądowisko przez osiem rund, do czasu przybycia kanonierki LAAT, i odeprzyj kolejne fale droidów.",
      en: "Hold the landing zone for eight rounds until the LAAT gunship arrives and repel successive droid waves.",
    },
  },
  "geonosis-heart-of-factory": {
    name: { pl: "Geonosis: Serce fabryki", en: "Geonosis: Heart of the Factory" },
    description: {
      pl: "Przedrzyj się przez fabrykę, zniszcz generator osłon i rdzeń linii produkcyjnej.",
      en: "Fight through the foundry, destroy the shield generator, and disable the production core.",
    },
  },
  "felucia-surrounded": {
    name: { pl: "Felucia: Okrążeni!", en: "Felucia: Surrounded!" },
    description: {
      pl: "Przetrwaj dziesięć rund w grzybowych ostępach, odpierając coraz cięższe fale droidów.",
      en: "Survive ten rounds in the fungal wilds against increasingly heavy droid waves.",
    },
  },
  "mandalore-hunt-in-sundari": {
    name: { pl: "Mandalore: Polowanie w Sundari", en: "Mandalore: Hunt in Sundari" },
    description: {
      pl: "Odszukaj Dartha Maula w sektorach Sundari i pokonaj go, zanim zdoła się wymknąć.",
      en: "Find Darth Maul in the Sundari sectors and defeat him before he can escape.",
    },
  },
  "christophsis-crystal-data": {
    name: { pl: "Christophsis: Kryształowe dane", en: "Christophsis: Crystal Data" },
    description: {
      pl: "Zabezpiecz przekaźnik archiwum, a następnie przebij się do nadajnika ewakuacyjnego.",
      en: "Secure the archive relay, then break through to the extraction transmitter.",
    },
  },
  "separatist-warship-rescue-r2d2": {
    name: { pl: "Okręt Separatystów: Uratuj R2-D2", en: "Separatist Warship: Rescue R2-D2" },
    description: {
      pl: "Przebij się przez pokład więzienny, uwolnij R2-D2 i doprowadź go do śluzy ewakuacyjnej.",
      en: "Fight through the detention deck, free R2-D2, and escort him to the extraction airlock.",
    },
  },
  "rescue-hostages": {
    name: { pl: "Uratuj zakładników", en: "Rescue the Hostages" },
    description: {
      pl: "Uwolnij kolejno dwóch zakładników i zabezpiecz dla nich punkt ewakuacji.",
      en: "Free two hostages in sequence, then secure their extraction point.",
    },
  },
  "survival-test": {
    name: { pl: "Ostatni bastion", en: "Last Stand" },
    description: {
      pl: "Przetrwaj wymaganą liczbę rund. Nie musisz kontrolować konkretnego pola.",
      en: "Survive the required number of rounds. You do not need to control a specific tile.",
    },
  },
  "defend-point": {
    name: { pl: "Broń punktu", en: "Defend the Point" },
    description: {
      pl: "Wyznacz punkt na mapie i utrzymaj go przez pięć kolejnych pełnych rund.",
      en: "Designate a point on the map and hold it for five consecutive full rounds.",
    },
  },
  "protect-generator": {
    name: { pl: "Chroń generator", en: "Protect the Generator" },
    description: {
      pl: "Postaw generator i utrzymaj go przy życiu przez pięć pełnych rund.",
      en: "Place a generator and keep it operational for five full rounds.",
    },
  },
  "control-territory": {
    name: { pl: "Kontrola terytorium", en: "Territory Control" },
    description: {
      pl: "Zajmuj pola i zdobywaj za nie punkty na koniec każdej rundy. Punkty strategiczne ★ są warte 2 pkt. Po wybranej liczbie rund wygrywa armia z większą liczbą punktów.",
      en: "Control tiles and score them at the end of each round. Strategic points ★ are worth 2 VP. After the selected number of rounds, the army with the most points wins.",
    },
  },
  "geonosis-droid-foundry": {
    name: { pl: "Geonosis: Fabryka droidów", en: "Geonosis: Droid Foundry" },
    description: {
      pl: "Przebij się przez skalne gardła i zniszcz dwa generatory fabryki przed upływem dziesiątej rundy.",
      en: "Break through the rocky choke points and destroy two foundry generators before the end of round ten.",
    },
  },
  "christophsis-break-line": {
    name: { pl: "Christophsis: Przełamanie linii", en: "Christophsis: Break the Line" },
    description: {
      pl: "Zajmuj kolejno trzy sektory miasta. Każdy utrzymany odcinek przesuwa linię frontu naprzód.",
      en: "Capture three city sectors in sequence. Each secured section pushes the front line forward.",
    },
  },
  "felucia-ambush": {
    name: { pl: "Felucia: Zasadzka", en: "Felucia: Ambush" },
    description: {
      pl: "Przetrwaj pierwsze uderzenie, a następnie doprowadź co najmniej jedną jednostkę do strefy ewakuacji.",
      en: "Survive the initial assault, then move at least one unit into the extraction zone.",
    },
  },
  "mandalore-battle-for-sectors": {
    name: { pl: "Mandalore: Bitwa o sektory", en: "Mandalore: Battle for the Sectors" },
    description: {
      pl: "Walcz o dzielnice miasta, durastalowe place i punkty strategiczne Sundari.",
      en: "Fight for city districts, durasteel plazas, and Sundari strategic points.",
    },
  },
};

export function localizeScenarioName(language: Language, id: string, fallback: string): string {
  return pick(language, scenarioText[id]?.name, fallback);
}

export function localizeScenarioDescription(language: Language, id: string, fallback: string): string {
  return pick(language, scenarioText[id]?.description, fallback);
}

const themeText: Record<string, { name: Localized; description: Localized }> = {
  "desert-outpost": {
    name: { pl: "Tatooine — Pustynna placówka", en: "Tatooine — Desert Outpost" },
    description: { pl: "Wyschnięte pustkowie z wydmami, skałami i rozsianymi placówkami.", en: "An arid wasteland of dunes, rocks, and scattered outposts." },
  },
  "forest-moon": {
    name: { pl: "Endor — Leśny księżyc", en: "Endor — Forest Moon" },
    description: { pl: "Gęsty leśny księżyc z paprociami, głazami i imperialną infrastrukturą.", en: "A dense forest moon filled with ferns, boulders, and Imperial infrastructure." },
  },
  "ice-front": {
    name: { pl: "Hoth — Lodowy front", en: "Hoth — Ice Front" },
    description: { pl: "Otwarta lodowa równina, zaspy, szczeliny i umocnione pozycje rebelianckie.", en: "An open ice plain with snowdrifts, crevasses, and fortified Rebel positions." },
  },
  "volcanic-foundry": {
    name: { pl: "Mustafar — Wulkaniczna odlewnia", en: "Mustafar — Volcanic Foundry" },
    description: { pl: "Wulkaniczny kompleks przemysłowy przecięty zastygłą lawą i ciężkimi konstrukcjami.", en: "A volcanic industrial complex cut by lava flows and heavy structures." },
  },
  "geonosis-foundry": {
    name: { pl: "Geonosis — Fabryka droidów", en: "Geonosis — Droid Foundry" },
    description: { pl: "Czerwone pustkowie pełne skalnych iglic, kanionów i fabryk droidów.", en: "A red wasteland of rocky spires, canyons, and droid foundries." },
  },
  "felucia-wilds": {
    name: { pl: "Felucia — Grzybowe ostępy", en: "Felucia — Fungal Wilds" },
    description: { pl: "Gęsta, obca dżungla porośnięta olbrzymimi grzybami i jaskrawą roślinnością.", en: "A dense alien jungle of giant fungi and vivid vegetation." },
  },
  "christophsis-crystal-city": {
    name: { pl: "Christophsis — Kryształowe miasto", en: "Christophsis — Crystal City" },
    description: { pl: "Chłodne miasto przecięte kryształowymi formacjami, barykadami i ciężką zabudową.", en: "A cold city divided by crystal formations, barricades, and heavy architecture." },
  },
  "mandalore-city": {
    name: { pl: "Mandalore — Sektory Sundari", en: "Mandalore — Sundari Sectors" },
    description: { pl: "Kanciaste sektory miasta z durastalowymi placami, kopułami i wąskimi liniami natarcia.", en: "Angular city sectors with durasteel plazas, domes, and narrow attack lanes." },
  },
  "separatist-warship": {
    name: { pl: "Statek Separatystów — pokład więzienny", en: "Separatist Warship — Detention Deck" },
    description: { pl: "Ciemne korytarze okrętu, grodzie więzienne, przewody zasilania i chłodne centra dowodzenia.", en: "Dark corridors, detention bulkheads, power conduits, and cold command centers." },
  },
  "republic-warship": {
    name: { pl: "Statek Republiki — pokłady Venatora", en: "Republic Warship — Venator Decks" },
    description: { pl: "Jasne pokłady Venatora, czerwone oznaczenia sektorów, hangary i ufortyfikowane centra łączności.", en: "Bright Venator decks, red sector markings, hangars, and fortified communication centers." },
  },
};

export function localizeThemeName(language: Language, id: string, fallback: string): string {
  return pick(language, themeText[id]?.name, fallback);
}

export function localizeThemeDescription(language: Language, id: string, fallback: string): string {
  return pick(language, themeText[id]?.description, fallback);
}

const terrainText: Record<string, { name: Localized; short: Localized; description: Localized }> = {
  Open: { name: { pl: "Otwarty teren", en: "Open Ground" }, short: { pl: "OTWARTY", en: "OPEN" }, description: { pl: "Bez dodatkowych modyfikatorów.", en: "No additional modifiers." } },
  LightCover: { name: { pl: "Lekka osłona", en: "Light Cover" }, short: { pl: "OSŁONA", en: "COVER" }, description: { pl: "+1 do obrony.", en: "+1 defense." } },
  HeavyCover: { name: { pl: "Ciężka osłona", en: "Heavy Cover" }, short: { pl: "CIĘŻKA", en: "HEAVY" }, description: { pl: "+2 do obrony, koszt ruchu 2.", en: "+2 defense, movement cost 2." } },
  Building: { name: { pl: "Budynek", en: "Building" }, short: { pl: "BUDYNEK", en: "BUILDING" }, description: { pl: "+2 do obrony, koszt ruchu 2; blokuje linię widzenia.", en: "+2 defense, movement cost 2; blocks line of sight." } },
  DifficultTerrain: { name: { pl: "Trudny teren", en: "Difficult Terrain" }, short: { pl: "TRUDNY", en: "DIFFICULT" }, description: { pl: "Koszt ruchu 2.", en: "Movement cost 2." } },
  Impassable: { name: { pl: "Teren niedostępny", en: "Impassable Terrain" }, short: { pl: "NIEDOST.", en: "IMPASS." }, description: { pl: "Nie można na niego wejść; blokuje linię widzenia.", en: "Cannot be entered; blocks line of sight." } },
  Hazardous: { name: { pl: "Teren niebezpieczny", en: "Hazardous Terrain" }, short: { pl: "RYZYKO", en: "HAZARD" }, description: { pl: "Koszt ruchu 2; wejście daje 1 suppression.", en: "Movement cost 2; entering adds 1 suppression." } },
  HighGround: { name: { pl: "Wysoki teren", en: "High Ground" }, short: { pl: "WYSOKI", en: "HIGH" }, description: { pl: "+1 do ataku, koszt ruchu 2.", en: "+1 attack, movement cost 2." } },
};

export function localizeTerrainName(language: Language, type: TerrainType, fallback = type): string {
  return pick(language, terrainText[type]?.name, fallback);
}

export function localizeTerrainShortLabel(language: Language, type: TerrainType, fallback = type): string {
  return pick(language, terrainText[type]?.short, fallback);
}

export function localizeTerrainDescription(language: Language, type: TerrainType, fallback: string): string {
  return pick(language, terrainText[type]?.description, fallback);
}

const unitNamesPl: Record<string, string> = {
  clone_trooper_battalion: "Batalion żołnierzy-klonów",
  jedi_task_force: "Zespół uderzeniowy Jedi",
  laat_patrol: "Patrol LAAT",
  b1_droid_regiment: "Regiment droidów B1",
  dwarf_spider_droid: "Karłowaty droid pająk",
  super_battle_droid_squad: "Oddział superdroidów bojowych B2",
  aat_battle_tank: "Czołg bojowy AAT",
  clone_trooper_squad: "Oddział żołnierzy-klonów",
  clone_command_squad: "Oddział dowodzenia klonów",
  clone_assault_squad: "Szturmowy oddział klonów",
  clone_engineers_332nd: "Inżynierowie klonów / oddział wsparcia 332.",
  b1_droid_squad: "Oddział droidów B1",
  arc_trooper: "Żołnierz ARC",
  commander_cody: "Dowódca Cody",
  captain_rex: "Kapitan Rex",
  bx_commando_droid: "Droid-komandos BX",
  stap_patrol: "Patrol STAP",
  at_rt_scout_walker: "Zwiadowczy walker AT-RT",
  count_dooku: "Hrabia Dooku",
  general_grievous: "Generał Grievous",
  magnaguard_squad: "Oddział MagnaGuard IG-100",
  b1_battle_droid_commander_squad: "Oddział dowódców droidów bojowych B1",
  mace_windu: "Mace Windu",
  hardcase: "Hardcase",
};

export function localizeUnitName(language: Language, id: string, fallback: string): string {
  return language === "pl" ? unitNamesPl[id] ?? fallback : fallback;
}

const weaponNamesPl: Record<string, string> = {
  dc_15_blaster_rifles: "Karabiny blasterowe DC-15",
  lightsabers: "Miecze świetlne",
  laat_laser_cannons: "Działa laserowe",
  e_5_blaster_rifles: "Karabiny blasterowe E-5",
  dwarf_spider_laser_cannon: "Działo laserowe",
  wrist_blaster_array: "Nadgarstkowy zestaw blasterów",
  aat_heavy_cannon: "Ciężkie działo",
  yoda_lightsaber: "Miecz świetlny",
  obi_wan_lightsaber: "Miecz świetlny",
  anakin_lightsaber: "Miecz świetlny",
  clone_squad_blaster_rifles: "Karabiny blasterowe DC-15",
  command_squad_blaster_rifles: "Karabiny blasterowe DC-15",
  assault_blaster_carbines: "Karabinki blasterowe",
  engineer_blaster_rifles: "Karabiny blasterowe DC-15",
  b1_squad_e_5_blaster_rifles: "Karabiny blasterowe E-5",
  ventress_lightsabers: "Dwa miecze świetlne",
  jango_dual_westars: "Dwa blastery WESTAR-34",
  maul_saberstaff: "Dwustronny miecz świetlny",
  ahsoka_twin_lightsabers: "Dwa miecze świetlne",
  arc_blaster_carbine: "Karabinek blasterowy ARC",
  cody_dc_15a_rifle: "Karabin blasterowy DC-15A",
  rex_dual_dc_17: "Dwa blastery DC-17",
  bx_blaster_rifle: "Karabin blasterowy E-5",
  bx_vibrosword: "Wibromiecz",
  stap_twin_blaster_cannons: "Podwójne działa blasterowe",
  at_rt_rotary_blaster: "Obrotowe działo blasterowe",
  dooku_lightsaber: "Miecz świetlny",
  grievous_lightsabers: "Zdobyczne miecze świetlne",
  magnaguard_electrostaffs: "Elektropałki",
  b1_commander_e_5_blaster_rifles: "Karabiny blasterowe E-5",
  mace_windu_lightsaber: "Miecz świetlny",
  hardcase_z_6_rotary_blaster: "Obrotowe działko blasterowe Z-6",
};

export function localizeWeaponName(language: Language, id: string, fallback: string): string {
  return language === "pl" ? weaponNamesPl[id] ?? fallback : fallback;
}

const abilityNamesPl: Record<string, string> = {
  clone_training: "Wyszkolenie klonów", master_tactician: "Mistrz taktyki",
  ataru_momentum: "Pęd Ataru", jar_kai_mastery: "Mistrzostwo Jar'Kai",
  force_prediction: "Przewidywanie Mocy", defensive_mastery: "Mistrzostwo obrony",
  inspiration: "Inspiracja", mass_production: "Produkcja masowa",
  shield_generators: "Generatory osłon", heavy_cannon: "Ciężkie działo",
  reinforced_chassis: "Wzmocnione podwozie", air_support: "Wsparcie powietrzne",
  master_of_the_order: "Mistrz Zakonu", force_push: "Pchnięcie Mocą",
  soresu_master: "Mistrz Soresu", defensive_stance: "Postawa obronna",
  the_chosen_one: "Wybraniec", heroic_charge: "Bohaterska szarża",
  battlefield_coordination: "Koordynacja pola bitwy", assault_training: "Wyszkolenie szturmowe",
  build_cover: "Budowa osłony", repair: "Naprawa", assassin: "Zabójca",
  shadow_strike: "Cios z cienia", bounty_hunter: "Łowca nagród",
  jetpack_reposition: "Manewr plecakiem odrzutowym", wrist_rockets: "Rakiety nadgarstkowe",
  relentless_fury: "Nieustępliwa furia", saberstaff_duelist: "Szermierz z dwustronnym mieczem",
  saber_throw: "Rzut mieczem", calm_leadership: "Spokojne przywództwo",
  hold_the_line: "Utrzymać linię", aggressive_advance: "Agresywne natarcie",
  ruthless_strike: "Bezlitosny cios", marked_target: "Oznaczony cel",
  fear_and_momentum: "Strach i impet",
  makashi_mastery: "Mistrzostwo Makashi", force_lightning: "Błyskawice Mocy",
  jedi_hunter: "Łowca Jedi", cybernetic_warlord: "Cybernetyczny watażka",
  claw_rush: "Szarża na pazurach", electrostaff_guard: "Garda elektropałek",
  jedi_hunter_training: "Szkolenie łowców Jedi", droid_coordination: "Koordynacja droidów",
  vaapad_mastery: "Mistrzostwo Vaapad", z_6_braced_fire: "Stabilny ostrzał Z-6",
};

const abilityDescriptionsEn: Record<string, string> = {
  clone_training: "+1 to attack rolls while the unit has no suppression.",
  master_tactician: "After drawing an army token, the commander can support broader activation choices in future rules.",
  ataru_momentum: "If Ahsoka moved before attacking this turn, she gains +1 attack.",
  jar_kai_mastery: "Ahsoka gains +1 attack when targeting hero units.",
  force_prediction: "Ignore the first point of damage from each attack against this unit.",
  defensive_mastery: "+1 morale during pinning tests.",
  inspiration: "One allied unit within range removes 1 suppression.",
  mass_production: "This unit is inexpensive and can be fielded in large numbers.",
  shield_generators: "Against ranged attacks, reduce up to 3 damage from each attack.",
  heavy_cannon: "+1 damage against vehicles.",
  reinforced_chassis: "Ignore the first point of damage from each attack against this unit.",
  air_support: "May ignore difficult terrain during an Advance order.",
  master_of_the_order: "Allied clone units within range 1 gain +1 attack.",
  force_push: "Deals 4 damage and pushes the target 1 tile if possible.",
  soresu_master: "Once per turn, reduce the first incoming damage by 2.",
  defensive_stance: "Until Obi-Wan's next activation, he takes 50% less damage.",
  the_chosen_one: "After destroying an enemy unit, Anakin may move 1 additional tile.",
  heroic_charge: "Anakin moves up to 2 additional tiles and immediately makes a melee attack.",
  battlefield_coordination: "Allied clone units within range 1 gain +1 attack.",
  assault_training: "If the unit moved before attacking this turn, it gains +1 attack.",
  build_cover: "Creates light cover on an adjacent empty tile.",
  repair: "Prepared for vehicle rules: restores 3 HP to an allied vehicle.",
  assassin: "Ventress deals +2 damage against hero units.",
  shadow_strike: "After attacking, Ventress may move 1 tile away from the target if possible.",
  bounty_hunter: "Jango deals +2 damage against hero units.",
  jetpack_reposition: "Jango may move up to 2 tiles while ignoring terrain cost.",
  wrist_rockets: "Special attack against targets in cover: 3 damage at range 2.",
  relentless_fury: "While Maul is wounded, he gains +1 attack.",
  saberstaff_duelist: "Maul gains +1 attack when targeting hero units.",
  saber_throw: "Maul throws his lightsaber: 4 damage at range 2.",
  calm_leadership: "Clone units in this task force gain +1 defense within range 1 of Yoda.",
  hold_the_line: "Units in this task force gain +1 defense while in cover or on an objective.",
  aggressive_advance: "Once per turn, one clone unit in this task force may gain +1 movement.",
  ruthless_strike: "Once per turn, one droid in this task force gains +1 attack against a damaged target.",
  marked_target: "Once per turn, one droid in Jango's task force gains +1 attack against a hero.",
  fear_and_momentum: "Droids in Maul's task force within range 1 gain +1 attack.",
  makashi_mastery: "Dooku gains +2 attacks when targeting hero units.",
  force_lightning: "Force lightning deals 4 damage to an enemy within range 2.",
  jedi_hunter: "Grievous deals +2 damage against hero units.",
  cybernetic_warlord: "Grievous's reinforced body reduces damage from each attack by 1.",
  claw_rush: "Grievous moves up to 2 additional tiles and immediately makes a melee attack.",
  electrostaff_guard: "Electrostaff defense reduces damage from each attack by 1.",
  jedi_hunter_training: "MagnaGuards gain +1 attack against hero units.",
  droid_coordination: "Allied droids within range 1 gain +1 attack.",
  vaapad_mastery: "Mace Windu gains +2 attacks when targeting hero units.",
  z_6_braced_fire: "Hardcase gains +1 attack if he has not moved this turn.",
};

export function localizeAbilityName(language: Language, ability: Pick<AbilityDefinition, "id" | "name">): string {
  return language === "pl" ? abilityNamesPl[ability.id] ?? ability.name : ability.name;
}

export function localizeAbilityDescription(language: Language, ability: Pick<AbilityDefinition, "id" | "description">): string {
  return language === "en" ? abilityDescriptionsEn[ability.id] ?? ability.description : ability.description;
}

const taskForceNamesPl: Record<string, string> = {
  yoda_task_force: "Zespół uderzeniowy Yody", obi_wan_task_force: "Zespół uderzeniowy Obi-Wana",
  anakin_task_force: "Zespół uderzeniowy Anakina", ventress_task_force: "Zespół uderzeniowy Ventress",
  jango_task_force: "Zespół uderzeniowy Jango Fetta", maul_task_force: "Zespół uderzeniowy Dartha Maula",
};

export function localizeTaskForceName(language: Language, id: string, fallback: string): string {
  return language === "pl" ? taskForceNamesPl[id] ?? fallback : fallback;
}

export function localizeFaction(language: Language, faction: FactionId): string {
  if (language === "en") return faction;
  if (faction === "Republic") return "Republika";
  if (faction === "Separatists") return "Separatyści";
  return faction;
}

export function localizeOrder(language: Language, order: OrderType): string {
  if (language === "en") return order;
  return ({ Move: "Ruch", Advance: "Natarcie", Attack: "Atak", Rally: "Odwrót", Overwatch: "Ogień zaporowy" } as Record<OrderType, string>)[order];
}

export function localizeUnitStatus(language: Language, status: UnitStatus): string {
  if (language === "en") return status;
  return ({ Ready: "Gotowa", Activated: "Aktywowana", Destroyed: "Zniszczona", Pinned: "Przygwożdżona" } as Record<UnitStatus, string>)[status];
}

export function localizeControl(language: Language, control: ArmyControl): string {
  return control === "Human" ? (language === "pl" ? "Gracz" : "Player") : "Bot";
}

export function localizeCategory(language: Language, category: string): string {
  if (language === "en") return category;
  return ({ infantry: "piechota", hero: "bohater", droid: "droid", vehicle: "pojazd", commander: "dowódca" } as Record<string, string>)[category.toLowerCase()] ?? category;
}

export function localizeRole(language: Language, role: string): string {
  if (language === "en") return role;
  return ({
    line: "liniowa",
    commander: "dowódca",
    heavy: "ciężka",
    support: "wsparcie",
    mobile: "mobilna",
    duelist: "szermierz",
    assault: "szturmowa",
    engineer: "inżynieryjna",
    fast: "szybka",
    "fast fire support": "szybkie wsparcie ogniowe",
    "anti-vehicle support": "wsparcie przeciwpancerne",
    "duelist/control": "szermierz / kontrola",
    "assault/jedi hunter": "szturm / łowca Jedi",
    "elite bodyguard": "elitarna ochrona",
    "droid command/support": "dowodzenie droidami / wsparcie",
    "assault/duelist": "szturm / szermierz",
    "heavy gunner": "ciężki strzelec",
  } as Record<string, string>)[role.toLowerCase()] ?? role;
}

export function localizeObjectName(language: Language, type: BattlefieldObjectType, fallback: string): string {
  const values: Record<BattlefieldObjectType, Localized> = {
    DefensePoint: { pl: "Punkt obrony", en: "Defense Point" },
    StrategicPoint: { pl: "Punkt strategiczny ★", en: "Strategic Point ★" },
    Generator: { pl: "Generator", en: "Generator" },
    LightFortification: { pl: "Lekka osłona", en: "Light Fortification" },
    HeavyFortification: { pl: "Ciężka osłona", en: "Heavy Fortification" },
  };
  return pick(language, values[type], fallback);
}

const eventNames: Record<string, Localized> = {
  "geonosis-b1-wave": { pl: "Awaryjna aktywacja linii B1", en: "Emergency B1 Line Activation" },
  "christophsis-defensive-reserve": { pl: "Odwód obrońców", en: "Defender Reserves" },
  "felucia-wave-2": { pl: "Fala droidów I", en: "Droid Wave I" },
  "felucia-wave-4": { pl: "Fala droidów II", en: "Droid Wave II" },
};

export function localizeEventName(language: Language, id: string, fallback: string): string {
  const predefined = eventNames[id];
  if (predefined) return pick(language, predefined, fallback);
  const generatedWave = fallback.match(/^(?:Fala wsparcia|Reinforcement wave) (\d+)$/);
  if (generatedWave) {
    return `${language === "pl" ? "Fala wsparcia" : "Reinforcement wave"} ${generatedWave[1]}`;
  }
  return fallback;
}
