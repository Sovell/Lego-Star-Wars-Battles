import type { FactionId } from "../types";
import type { Language } from "../i18n";

type LocalizedText = Record<Language, string>;

export type UnitCardTheme = {
  accent: string;
  accentSoft: string;
  accentStrong: string;
};

export type UnitLore = {
  subtitle: LocalizedText;
  summary: LocalizedText;
  details?: LocalizedText;
};

export type UnitPresentationProfile = {
  theme: UnitCardTheme;
  lore?: UnitLore;
};

const themes = {
  blue: theme("#68b8d4", "rgba(104, 184, 212, 0.13)", "#bcecff"),
  orange: theme("#f58224", "rgba(245, 130, 36, 0.14)", "#ffd3ad"),
  yellow: theme("#f0cf4b", "rgba(240, 207, 75, 0.14)", "#fff0a6"),
  green: theme("#75a96b", "rgba(117, 169, 107, 0.14)", "#c9efc1"),
  lime: theme("#a8cf4a", "rgba(168, 207, 74, 0.14)", "#e3f7aa"),
  purple: theme("#8872ad", "rgba(136, 114, 173, 0.15)", "#ddccff"),
  red: theme("#d93a22", "rgba(217, 58, 34, 0.15)", "#ffc0b5"),
  steel: theme("#7f99a8", "rgba(127, 153, 168, 0.14)", "#d6e8f1"),
  teal: theme("#64a9a4", "rgba(100, 169, 164, 0.14)", "#c8f1ed"),
};

const profiles: Record<string, UnitPresentationProfile> = {
  count_dooku: profile(themes.orange, "Upadły Jedi", "Fallen Jedi",
    "Dawny mistrz Jedi i publiczny przywódca Separatystów, który skrywa tożsamość Lorda Tyranusa. Łączy arystokratyczny spokój z mistrzostwem Makashi i potęgą ciemnej strony.",
    "A former Jedi Master and the public leader of the Separatists who conceals his identity as Darth Tyranus. He combines aristocratic composure with mastery of Makashi and the power of the dark side.",
    "Dooku dowodzi wojną z politycznego cienia, werbuje agentów takich jak Ventress i wydaje rozkazy Grievousowi. Jego wpływ opiera się równie mocno na perswazji i strategii, jak na umiejętnościach pojedynkowych.",
    "Dooku directs the war from the political shadows, recruits agents such as Ventress, and commands Grievous. His influence rests as much on persuasion and strategy as on his dueling skill."),
  general_grievous: profile(themes.lime, "Cybernetyczny watażka", "Cyborg Warlord",
    "Naczelny dowódca armii droidów, który zastąpił znaczną część ciała cybernetyką. Poluje na Jedi, a zdobyte miecze świetlne traktuje jak trofea.",
    "The supreme commander of the droid armies, who replaced much of his body with cybernetics. He hunts Jedi and keeps captured lightsabers as trophies.",
    "Cztery ramiona, błyskawiczne obroty i nieludzka zwinność czynią z niego niszczycielską machinę wojenną. Gdy starcie obraca się przeciw niemu, jego mobilność pozwala mu równie szybko zerwać kontakt.",
    "Four arms, rapid rotations, and inhuman agility make him a devastating war machine. When a battle turns against him, that same mobility lets him disengage with alarming speed."),
  mace_windu: profile(themes.purple, "Obrońca Republiki", "Protector of the Republic",
    "Nieugięty mistrz Jedi, wybitny szermierz i jeden z najważniejszych przywódców Zakonu. Dostrzega punkty przełomowe — chwile, w których jeden ruch może odmienić los bitwy.",
    "A resolute Jedi Master, exceptional duelist, and one of the Order's foremost leaders. He perceives shatterpoints—moments when a single action can change the course of a battle.",
    "Windu ufa niewielu osobom spoza Rady i bez wahania staje przeciw zagrożeniom dla Republiki oraz Jedi. Jego styl Vaapad zamienia presję przeciwnika w bezwzględną ofensywę.",
    "Windu trusts few outside the Council and confronts threats to both the Republic and the Jedi without hesitation. His Vaapad style turns an opponent's pressure into relentless offense."),
  hardcase: profile(themes.blue, "Ciężki strzelec 501.", "501st Heavy Gunner",
    "Żywiołowy żołnierz-klon walczący na Mimbanie, Saleucami i Umbara. Jego ulubioną bronią jest obrotowe działko Z-6, najlepiej wykorzystywane ze stabilnej pozycji.",
    "An exuberant clone trooper who fought on Mimban, Saleucami, and Umbara. His weapon of choice is the Z-6 rotary cannon, most effective from a braced position."),
  magnaguard_squad: profile(themes.purple, "Elitarna ochrona", "Elite Bodyguards",
    "MagnaGuardzi IG-100 chronią najwyższych dowódców Separatystów. Są szybcy, walczą zespołowo i potrafią kontynuować starcie nawet po ciężkich uszkodzeniach.",
    "IG-100 MagnaGuards protect the highest-ranking Separatist leaders. They are fast, fight as a coordinated group, and can continue battling after severe damage."),
  b1_battle_droid_commander_squad: profile(themes.yellow, "Dowódcy linii B1", "B1 Line Commanders",
    "Ulepszone procesory pozwalają dowódcom B1 koordynować zwykłe droidy bojowe. Żółte oznaczenia ułatwiają identyfikację, ale także czynią ich oczywistym celem.",
    "Improved processors allow B1 commanders to coordinate ordinary battle droids. Their yellow markings make them easy to identify—and an obvious target."),
  dwarf_spider_droid: profile(themes.red, "Metalowa maskotka", "Metal Mascot",
    "Niewielki kroczący droid z centralnym działem laserowym, noktowizją i zdolnością poruszania się po trudnych powierzchniach. Sprawdza się w rozpoznaniu i zwalczaniu twardych celów.",
    "A compact walker droid with a central laser cannon, infrared vision, and the ability to traverse difficult surfaces. It excels at reconnaissance and engaging hardened targets."),
  anakin_skywalker: profile(themes.blue, "Wybraniec", "The Chosen One",
    "Śmiały dowódca, znakomity pilot i potężny Jedi, którego emocje są zarówno źródłem siły, jak i największym zagrożeniem.",
    "A bold commander, brilliant pilot, and powerful Jedi whose emotions are both a source of strength and his greatest danger.",
    "Podczas Wojen Klonów Anakin zdobywa bezgraniczne zaufanie swoich żołnierzy. Jednocześnie lęk przed utratą bliskich coraz częściej prowadzi go ku decyzjom, których Zakon nie potrafi zaakceptować.",
    "During the Clone Wars, Anakin earns the absolute trust of his soldiers. At the same time, fear of losing those close to him increasingly drives choices the Order cannot accept."),
  ahsoka_tano: profile(themes.orange, "Padawanka na wojnie", "A Padawan at War",
    "Odważna i impulsywna uczennica Anakina szybko dojrzewa na polach bitew. Z czasem zaczyna samodzielnie oceniać rozkazy i własne miejsce w Zakonie Jedi.",
    "Anakin's brave and impulsive apprentice matures quickly on the battlefield. In time, she begins to judge orders—and her own place in the Jedi Order—for herself."),
  asajj_ventress: profile(themes.blue, "Zabójczyni ciemnej strony", "Dark Side Assassin",
    "Była padawanka i uczennica Dooku, wysyłana przeciw Jedi jako bezwzględna zabójczyni. Zdradzona przez swojego mistrza, szuka nowej drogi między zemstą a niezależnością.",
    "A former Padawan and Dooku's apprentice, sent against the Jedi as a ruthless assassin. Betrayed by her master, she seeks a new path between vengeance and independence."),
  darth_maul: profile(themes.red, "Porzucony uczeń", "Forsaken Apprentice",
    "Maul przeżył pojedynek na Naboo dzięki nienawiści i mocy ciemnej strony. Po odzyskaniu sił buduje przestępcze imperium i przejmuje kontrolę nad Mandalore.",
    "Maul survived his duel on Naboo through hatred and the power of the dark side. After recovering, he builds a criminal empire and seizes control of Mandalore."),
  obi_wan_kenobi: profile(themes.yellow, "Negocjator Jedi", "Jedi Negotiator",
    "Mistrz Anakina, cierpliwy dyplomata i wybitny obrońca. Nawet w czasie wojny szuka pokojowego rozwiązania, zanim sięgnie po miecz.",
    "Anakin's master, a patient diplomat, and an exceptional defender. Even in wartime, he seeks a peaceful solution before drawing his blade."),
  yoda: profile(themes.lime, "Wielki Mistrz Jedi", "Jedi Grand Master",
    "Przywódca Zakonu Jedi i nauczyciel wielu pokoleń. Dostrzega niebezpieczeństwo, że wojna zmieni strażników pokoju w generałów i oddali Jedi od ich prawdziwej roli.",
    "Leader of the Jedi Order and teacher to generations. He recognizes the danger that war will turn peacekeepers into generals and draw the Jedi away from their true purpose."),
  commander_cody: profile(themes.orange, "Dowódca 212. Batalionu", "Leader of the 212th",
    "Doświadczony dowódca-klon i zastępca Obi-Wana. Łączy talent taktyczny z opanowaniem oraz przywództwem sprawdzonym pod ogniem.",
    "An experienced clone commander and Obi-Wan's second-in-command. He combines tactical skill with composure and leadership proven under fire."),
  captain_rex: profile(themes.blue, "Kapitan 501.", "Captain of the 501st",
    "Twardy i doświadczony oficer, który traktuje klony jak braci, a nie zasoby. Wojna zmusza go do rozstrzygania, kiedy obowiązek powinien ustąpić sumieniu.",
    "A tough, experienced officer who sees clones as brothers rather than resources. The war forces him to decide when duty must yield to conscience."),
  arc_trooper: profile(themes.blue, "Zaawansowany komandos zwiadu", "Advanced Recon Commando",
    "Elitarni klonowi oficerowie szkoleni do samodzielnych operacji, infiltracji i rozpoznania. Łączą dyscyplinę z inicjatywą rzadką w szeregach regularnej armii.",
    "Elite clone officers trained for independent operations, infiltration, and reconnaissance. They combine discipline with initiative rarely seen in the regular ranks."),
  clone_trooper_squad: cloneProfile(),
  clone_trooper_battalion: cloneProfile(),
  clone_command_squad: cloneProfile("Dowództwo klonów", "Clone Command"),
  clone_assault_squad: cloneProfile("Klonowi szturmowcy", "Clone Assault"),
  clone_engineers_332nd: cloneProfile("Wsparcie inżynieryjne", "Engineering Support"),
  b1_droid_squad: battleDroidProfile(),
  b1_droid_regiment: battleDroidProfile(),
  super_battle_droid_squad: profile(themes.blue, "Mechaniczna siła", "Mechanical Muscle",
    "B2 to ciężko opancerzone i agresywne wsparcie piechoty Separatystów. Maszerują prosto na przeciwnika, polegając na wytrzymałości i wbudowanej broni.",
    "B2 units are the heavily armored, aggressive muscle of Separatist infantry. They march straight at the enemy, relying on durability and integrated weapons."),
  bx_commando_droid: profile(themes.orange, "Droid infiltracyjny", "Infiltration Droid",
    "Droidy-komandosi BX są szybsze, zwinniejsze i sprytniejsze od B1. Separatyści wykorzystują je w misjach wymagających skrytości, szybkości i precyzyjnego uderzenia.",
    "BX commando droids are faster, more agile, and smarter than B1 units. Separatists reserve them for missions demanding stealth, speed, and precise strikes."),
};

const themeOnly: Record<string, UnitCardTheme> = {
  jedi_task_force: themes.blue,
  laat_patrol: themes.blue,
  aat_battle_tank: themes.orange,
  jango_fett: themes.teal,
  stap_patrol: themes.green,
  at_rt_scout_walker: themes.blue,
};

export function getUnitPresentationProfile(
  templateId: string,
  faction: FactionId,
): UnitPresentationProfile {
  return profiles[templateId] ?? {
    theme: themeOnly[templateId] ?? (faction === "Separatists" ? themes.red : themes.blue),
  };
}

function theme(accent: string, accentSoft: string, accentStrong: string): UnitCardTheme {
  return { accent, accentSoft, accentStrong };
}

function profile(
  themeValue: UnitCardTheme,
  subtitlePl: string,
  subtitleEn: string,
  summaryPl: string,
  summaryEn: string,
  detailsPl?: string,
  detailsEn?: string,
): UnitPresentationProfile {
  return {
    theme: themeValue,
    lore: {
      subtitle: { pl: subtitlePl, en: subtitleEn },
      summary: { pl: summaryPl, en: summaryEn },
      ...(detailsPl && detailsEn
        ? { details: { pl: detailsPl, en: detailsEn } }
        : {}),
    },
  };
}

function cloneProfile(
  subtitlePl = "Żołnierze Wielkiej Armii Republiki",
  subtitleEn = "Grand Army Troopers",
): UnitPresentationProfile {
  return profile(themes.blue, subtitlePl, subtitleEn,
    "Genetycznie identyczni żołnierze wyhodowani na Kamino tworzą trzon obrony Republiki. Wspólne szkolenie daje im wyjątkową dyscyplinę i skuteczność zespołową.",
    "Genetically identical soldiers raised on Kamino form the backbone of the Republic's defense. Shared training gives them exceptional discipline and teamwork.");
}

function battleDroidProfile(): UnitPresentationProfile {
  return profile(themes.green, "Żołnierze Separatystów", "Separatist Soldiers",
    "Proste droidy B1 powstają miliardami w fabrykach Separatystów. Pojedynczo są przeciętne, lecz ich siłą pozostaje liczebność i bezwzględne wykonywanie rozkazów.",
    "Simple B1 droids are manufactured by the billion in Separatist foundries. Individually limited, their strength lies in numbers and relentless obedience.");
}
