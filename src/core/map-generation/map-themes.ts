import type { TerrainType } from "../../types";
import type { MapTheme, MapThemeId } from "./map-generation-types";

export const desertOutpostTheme: MapTheme = {
  id: "desert-outpost",
  version: 4,
  name: "Tatooine — Desert Outpost",
  description: "Wyschnięte pustkowie z wydmami, skałami i rozsianymi placówkami.",
  presentation: {
    assetSetId: "tatooine-outpost",
    groundTextureId: "tatooine-sand",
    motif: "dunes",
    palette: {
      ground: "#9a673d",
      accent: "#f0c46b",
      shadow: "#281d19",
      terrain: {
        open: "#6f5035",
        lightCover: "#70603b",
        heavyCover: "#594a3f",
        building: "#554a43",
        difficultTerrain: "#8a552f",
        impassable: "#382b26",
        hazardous: "#c05a24",
        highGround: "#a67b49",
      },
    },
  },
  generation: {
    motif: "open-outpost",
    defaultTerrainDensity: 0.34,
    clusterSize: {
      minimum: 2,
      maximum: 5,
    },
    terrainWeights: [
      { terrainType: "DifficultTerrain", weight: 4 },
      { terrainType: "LightCover", weight: 3 },
      { terrainType: "HeavyCover", weight: 2 },
      { terrainType: "Building", weight: 1 },
      { terrainType: "Impassable", weight: 2 },
      { terrainType: "Hazardous", weight: 1 },
      { terrainType: "HighGround", weight: 2 },
    ],
    objectBudget: {
      minimum: 3,
      maximum: 5,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 3 },
        { objectType: "HeavyFortification", weight: 1 },
      ],
    },
  },
};

export const forestMoonTheme: MapTheme = {
  id: "forest-moon",
  version: 3,
  name: "Endor — Forest Moon",
  description: "Gęsty leśny księżyc z paprociami, głazami i imperialną infrastrukturą.",
  presentation: {
    assetSetId: "endor-forest",
    groundTextureId: "endor-underbrush",
    motif: "forest",
    palette: {
      ground: "#31492f",
      accent: "#8fc46b",
      shadow: "#101a14",
      terrain: {
        open: "#35483a",
        lightCover: "#315d38",
        heavyCover: "#263f31",
        building: "#414a43",
        difficultTerrain: "#4f4931",
        impassable: "#17291e",
        hazardous: "#6f6033",
        highGround: "#52734b",
      },
    },
  },
  generation: {
    motif: "forest-lanes",
    defaultTerrainDensity: 0.46,
    clusterSize: { minimum: 3, maximum: 7 },
    terrainWeights: [
      { terrainType: "LightCover", weight: 5 },
      { terrainType: "HeavyCover", weight: 3 },
      { terrainType: "DifficultTerrain", weight: 2 },
      { terrainType: "Building", weight: 1 },
      { terrainType: "Impassable", weight: 1 },
      { terrainType: "Hazardous", weight: 1 },
      { terrainType: "HighGround", weight: 2 },
    ],
    objectBudget: {
      minimum: 2,
      maximum: 4,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 4 },
        { objectType: "HeavyFortification", weight: 1 },
      ],
    },
  },
};

export const iceFrontTheme: MapTheme = {
  id: "ice-front",
  version: 3,
  name: "Hoth — Ice Front",
  description: "Otwarta lodowa równina, zaspy, szczeliny i umocnione pozycje rebelianckie.",
  presentation: {
    assetSetId: "hoth-ice",
    groundTextureId: "hoth-snow",
    motif: "ice",
    palette: {
      ground: "#91afbd",
      accent: "#d9f5ff",
      shadow: "#172631",
      terrain: {
        open: "#819da9",
        lightCover: "#7696a4",
        heavyCover: "#627d8c",
        building: "#536977",
        difficultTerrain: "#6d8795",
        impassable: "#405b6b",
        hazardous: "#4f9ab0",
        highGround: "#abc8d4",
      },
    },
  },
  generation: {
    motif: "ice-fields",
    defaultTerrainDensity: 0.3,
    clusterSize: { minimum: 2, maximum: 6 },
    terrainWeights: [
      { terrainType: "DifficultTerrain", weight: 5 },
      { terrainType: "HeavyCover", weight: 3 },
      { terrainType: "LightCover", weight: 2 },
      { terrainType: "Building", weight: 1 },
      { terrainType: "Impassable", weight: 2 },
      { terrainType: "Hazardous", weight: 2 },
      { terrainType: "HighGround", weight: 2 },
    ],
    objectBudget: {
      minimum: 2,
      maximum: 4,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 2 },
        { objectType: "HeavyFortification", weight: 2 },
      ],
    },
  },
};

export const volcanicFoundryTheme: MapTheme = {
  id: "volcanic-foundry",
  version: 3,
  name: "Mustafar — Volcanic Foundry",
  description: "Wulkaniczny kompleks przemysłowy przecięty zastygłą lawą i ciężkimi konstrukcjami.",
  presentation: {
    assetSetId: "mustafar-foundry",
    groundTextureId: "mustafar-basalt",
    motif: "lava",
    palette: {
      ground: "#4a2923",
      accent: "#ff7a32",
      shadow: "#160e10",
      terrain: {
        open: "#3b2d2d",
        lightCover: "#49362f",
        heavyCover: "#342e32",
        building: "#41383a",
        difficultTerrain: "#6d2d1f",
        impassable: "#21191b",
        hazardous: "#d44c1f",
        highGround: "#744336",
      },
    },
  },
  generation: {
    motif: "lava-channels",
    defaultTerrainDensity: 0.4,
    clusterSize: { minimum: 2, maximum: 5 },
    terrainWeights: [
      { terrainType: "DifficultTerrain", weight: 6 },
      { terrainType: "Building", weight: 2 },
      { terrainType: "HeavyCover", weight: 2 },
      { terrainType: "LightCover", weight: 1 },
      { terrainType: "Impassable", weight: 3 },
      { terrainType: "Hazardous", weight: 5 },
      { terrainType: "HighGround", weight: 2 },
    ],
    objectBudget: {
      minimum: 3,
      maximum: 5,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 2 },
        { objectType: "HeavyFortification", weight: 3 },
      ],
    },
  },
};

export const geonosisFoundryTheme: MapTheme = {
  id: "geonosis-foundry",
  version: 3,
  name: "Geonosis — Droid Foundry",
  description: "Czerwone pustkowie pełne skalnych iglic, kanionów i fabryk droidów.",
  presentation: {
    assetSetId: "geonosis-foundry",
    groundTextureId: "geonosis-dust",
    motif: "spires",
    palette: {
      ground: "#8f4e32",
      accent: "#f3a45f",
      shadow: "#25130f",
      terrain: {
        open: "#75412f",
        lightCover: "#85472e",
        heavyCover: "#623629",
        building: "#4b4340",
        difficultTerrain: "#98452a",
        impassable: "#47251d",
        hazardous: "#c76632",
        highGround: "#b96c42",
      },
    },
  },
  generation: {
    motif: "canyons",
    defaultTerrainDensity: 0.42,
    clusterSize: { minimum: 2, maximum: 6 },
    terrainWeights: [
      { terrainType: "DifficultTerrain", weight: 4 },
      { terrainType: "HeavyCover", weight: 3 },
      { terrainType: "LightCover", weight: 2 },
      { terrainType: "Building", weight: 2 },
      { terrainType: "Impassable", weight: 3 },
      { terrainType: "Hazardous", weight: 2 },
      { terrainType: "HighGround", weight: 3 },
    ],
    objectBudget: {
      minimum: 3,
      maximum: 5,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 2 },
        { objectType: "HeavyFortification", weight: 3 },
      ],
    },
  },
};

export const feluciaWildsTheme: MapTheme = {
  id: "felucia-wilds",
  version: 3,
  name: "Felucia — Fungal Wilds",
  description: "Gęsta, obca dżungla porośnięta olbrzymimi grzybami i jaskrawą roślinnością.",
  presentation: {
    assetSetId: "felucia-fungal",
    groundTextureId: "felucia-spores",
    motif: "fungal",
    palette: {
      ground: "#334b3a",
      accent: "#e17ad8",
      shadow: "#101923",
      terrain: {
        open: "#354c42",
        lightCover: "#426144",
        heavyCover: "#2b4939",
        building: "#4b4853",
        difficultTerrain: "#57416a",
        impassable: "#21352d",
        hazardous: "#92507f",
        highGround: "#677b50",
      },
    },
  },
  generation: {
    motif: "organic-islands",
    defaultTerrainDensity: 0.5,
    clusterSize: { minimum: 3, maximum: 7 },
    terrainWeights: [
      { terrainType: "LightCover", weight: 4 },
      { terrainType: "HeavyCover", weight: 4 },
      { terrainType: "DifficultTerrain", weight: 3 },
      { terrainType: "Building", weight: 1 },
      { terrainType: "Impassable", weight: 2 },
      { terrainType: "Hazardous", weight: 4 },
      { terrainType: "HighGround", weight: 2 },
    ],
    objectBudget: {
      minimum: 2,
      maximum: 4,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 4 },
        { objectType: "HeavyFortification", weight: 1 },
      ],
    },
  },
};

export const christophsisCrystalCityTheme: MapTheme = {
  id: "christophsis-crystal-city",
  version: 3,
  name: "Christophsis — Crystal City",
  description: "Chłodne miasto przecięte kryształowymi formacjami, barykadami i ciężką zabudową.",
  presentation: {
    assetSetId: "christophsis-crystal",
    groundTextureId: "christophsis-glass",
    motif: "crystal",
    palette: {
      ground: "#55738a",
      accent: "#8cecff",
      shadow: "#111c2b",
      terrain: {
        open: "#536f84",
        lightCover: "#4f8293",
        heavyCover: "#3f657d",
        building: "#465767",
        difficultTerrain: "#557b96",
        impassable: "#293f58",
        hazardous: "#467b88",
        highGround: "#70a9bd",
      },
    },
  },
  generation: {
    motif: "urban-grid",
    defaultTerrainDensity: 0.36,
    clusterSize: { minimum: 2, maximum: 5 },
    terrainWeights: [
      { terrainType: "Building", weight: 4 },
      { terrainType: "HeavyCover", weight: 3 },
      { terrainType: "DifficultTerrain", weight: 3 },
      { terrainType: "LightCover", weight: 2 },
      { terrainType: "Impassable", weight: 3 },
      { terrainType: "Hazardous", weight: 1 },
      { terrainType: "HighGround", weight: 3 },
    ],
    objectBudget: {
      minimum: 3,
      maximum: 5,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 2 },
        { objectType: "HeavyFortification", weight: 2 },
      ],
    },
  },
};

export const mandaloreCityTheme: MapTheme = {
  id: "mandalore-city",
  version: 1,
  name: "Mandalore — Sundari Sectors",
  description: "Kanciaste sektory miasta z durastalowymi placami, kopułami i wąskimi liniami natarcia.",
  presentation: {
    assetSetId: "mandalore-city",
    groundTextureId: "mandalore-durasteel",
    motif: "mandalore",
    palette: {
      ground: "#59666d",
      accent: "#62d5ef",
      shadow: "#121a20",
      terrain: {
        open: "#50616a",
        lightCover: "#65747a",
        heavyCover: "#3f4e56",
        building: "#46545c",
        difficultTerrain: "#675d57",
        impassable: "#28343b",
        hazardous: "#a34e35",
        highGround: "#71858e",
      },
    },
  },
  generation: {
    motif: "urban-grid",
    defaultTerrainDensity: 0.39,
    clusterSize: { minimum: 2, maximum: 5 },
    terrainWeights: [
      { terrainType: "Building", weight: 5 },
      { terrainType: "HeavyCover", weight: 4 },
      { terrainType: "HighGround", weight: 3 },
      { terrainType: "LightCover", weight: 2 },
      { terrainType: "DifficultTerrain", weight: 2 },
      { terrainType: "Impassable", weight: 2 },
      { terrainType: "Hazardous", weight: 1 },
    ],
    objectBudget: {
      minimum: 3,
      maximum: 5,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 3 },
        { objectType: "HeavyFortification", weight: 2 },
      ],
    },
  },
};

export const separatistWarshipTheme: MapTheme = {
  id: "separatist-warship",
  version: 1,
  name: "Separatist Warship — Detention Deck",
  description: "Ciemne korytarze okrętu, grodzie więzienne, przewody zasilania i chłodne centra dowodzenia.",
  presentation: {
    assetSetId: "separatist-warship",
    groundTextureId: "separatist-deck",
    motif: "starship",
    palette: {
      ground: "#343a42",
      accent: "#d9894f",
      shadow: "#0c1016",
      terrain: {
        open: "#353c45",
        lightCover: "#4b5158",
        heavyCover: "#2b3038",
        building: "#252a31",
        difficultTerrain: "#4a403b",
        impassable: "#181d23",
        hazardous: "#8e3f2d",
        highGround: "#58616c",
      },
    },
  },
  generation: {
    motif: "urban-grid",
    defaultTerrainDensity: 0.43,
    clusterSize: { minimum: 2, maximum: 5 },
    terrainWeights: [
      { terrainType: "Building", weight: 5 },
      { terrainType: "Impassable", weight: 4 },
      { terrainType: "HeavyCover", weight: 3 },
      { terrainType: "LightCover", weight: 3 },
      { terrainType: "DifficultTerrain", weight: 2 },
      { terrainType: "Hazardous", weight: 2 },
      { terrainType: "HighGround", weight: 2 },
    ],
    objectBudget: {
      minimum: 3,
      maximum: 5,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 3 },
        { objectType: "HeavyFortification", weight: 2 },
      ],
    },
  },
};

export const republicWarshipTheme: MapTheme = {
  id: "republic-warship",
  version: 1,
  name: "Republic Warship — Venator Decks",
  description: "Jasne pokłady Venatora, czerwone oznaczenia sektorów, hangary i ufortyfikowane centra łączności.",
  presentation: {
    assetSetId: "republic-warship",
    groundTextureId: "republic-deck",
    motif: "starship",
    palette: {
      ground: "#78838d",
      accent: "#b64039",
      shadow: "#182027",
      terrain: {
        open: "#687681",
        lightCover: "#7d878e",
        heavyCover: "#515c65",
        building: "#47525b",
        difficultTerrain: "#706866",
        impassable: "#303b44",
        hazardous: "#a54a3d",
        highGround: "#929da4",
      },
    },
  },
  generation: {
    motif: "urban-grid",
    defaultTerrainDensity: 0.39,
    clusterSize: { minimum: 2, maximum: 5 },
    terrainWeights: [
      { terrainType: "Building", weight: 4 },
      { terrainType: "Impassable", weight: 3 },
      { terrainType: "HeavyCover", weight: 3 },
      { terrainType: "LightCover", weight: 4 },
      { terrainType: "DifficultTerrain", weight: 2 },
      { terrainType: "Hazardous", weight: 1 },
      { terrainType: "HighGround", weight: 3 },
    ],
    objectBudget: {
      minimum: 3,
      maximum: 5,
      minimumSpacing: 2,
      objectWeights: [
        { objectType: "LightFortification", weight: 4 },
        { objectType: "HeavyFortification", weight: 2 },
      ],
    },
  },
};

export const mapThemes: readonly MapTheme[] = [
  desertOutpostTheme,
  forestMoonTheme,
  iceFrontTheme,
  volcanicFoundryTheme,
  geonosisFoundryTheme,
  feluciaWildsTheme,
  christophsisCrystalCityTheme,
  mandaloreCityTheme,
  separatistWarshipTheme,
  republicWarshipTheme,
];

export function getMapTheme(themeId: MapThemeId): MapTheme {
  const theme = mapThemes.find(({ id }) => id === themeId);
  if (!theme) {
    throw new Error(`Unknown map theme: ${themeId}.`);
  }
  return theme;
}

export function getMapThemeTerrainColor(
  themeId: MapThemeId,
  terrainType: TerrainType,
): string {
  const terrain = getMapTheme(themeId).presentation.palette.terrain;
  switch (terrainType) {
    case "LightCover": return terrain.lightCover;
    case "HeavyCover": return terrain.heavyCover;
    case "Building": return terrain.building;
    case "DifficultTerrain": return terrain.difficultTerrain;
    case "Impassable": return terrain.impassable;
    case "Hazardous": return terrain.hazardous;
    case "HighGround": return terrain.highGround;
    default: return terrain.open;
  }
}
