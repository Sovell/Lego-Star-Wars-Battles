import type {
  BattlefieldObjectType,
  FactionId,
  UnitTemplate,
} from "../types";
import type { CSSProperties } from "react";
import { getMapTheme } from "../core/map-generation";
import {
  getMapObjectAssetUrl,
  getMapTerrainDecorationUrl,
} from "../presentation/map-theme-assets";
import { boardPositionKey } from "./board-view-model";
import { getBoardCellInteraction } from "./board-interaction-model";
import type { BoardRendererProps } from "./board-renderer";
import { localizeFaction, localizeObjectName, localizeTerrainName, localizeUnitStatus } from "../i18n";

export function DomMapBoard({
  deploymentZoneCells,
  interactionDisabled,
  interactionModel,
  language,
  mapThemeId,
  scenarioZoneCells,
  selectedUnitId,
  viewModel,
  onCellClick,
  onSelectedUnitChange,
}: BoardRendererProps) {
  const theme = getMapTheme(mapThemeId);
  const themeStyle = {
    "--map-open": theme.presentation.palette.terrain.open,
    "--map-light-cover": theme.presentation.palette.terrain.lightCover,
    "--map-heavy-cover": theme.presentation.palette.terrain.heavyCover,
    "--map-building": theme.presentation.palette.terrain.building,
    "--map-difficult": theme.presentation.palette.terrain.difficultTerrain,
    "--map-impassable": theme.presentation.palette.terrain.impassable,
    "--map-hazardous": theme.presentation.palette.terrain.hazardous,
    "--map-high-ground": theme.presentation.palette.terrain.highGround,
    "--map-theme-shadow": theme.presentation.palette.shadow,
    gridTemplateColumns: `repeat(${viewModel.width}, minmax(0, 1fr))`,
    gridTemplateRows: `repeat(${viewModel.height}, minmax(0, 1fr))`,
  } as CSSProperties;

  return (
    <section
      aria-disabled={interactionDisabled}
      className={`mapBoard commandMapBoard ${interactionDisabled ? "missionLocked" : ""}`}
      data-map-theme={mapThemeId}
      style={themeStyle}
    >
      {viewModel.positions.map(({ x, y }) => {
        const key = boardPositionKey(x, y);
        const tile = viewModel.tilesByPosition.get(key);
        const battlefieldObject = viewModel.objectsByPosition.get(key);
        const tileUnits = viewModel.unitsByPosition.get(key) ?? [];
        const territoryFaction = viewModel.territoryByPosition.get(key)?.faction;
        const cellInteraction = getBoardCellInteraction(interactionModel, x, y);
        const terrainDecorationUrl = getMapTerrainDecorationUrl(
          mapThemeId,
          tile?.terrainType ?? "Open",
          x,
          y,
        );
        const battlefieldObjectAssetUrl = battlefieldObject
          ? getMapObjectAssetUrl(mapThemeId, battlefieldObject.type, battlefieldObject.visualId)
          : undefined;

        return (
          <button
            aria-label={`${language === "pl" ? "Pole" : "Tile"} ${x}, ${y}: ${getInteractionLabel(cellInteraction, language)}`}
            className={`mapCell ${tile?.terrainType ?? "Open"} interaction-${cellInteraction} ${
              deploymentZoneCells?.has(key) ? "deploymentZoneCell" : ""
            } ${
              scenarioZoneCells?.has(key) ? "scenarioZoneCell" : ""
            } ${
              territoryFaction === "Republic"
                ? "territoryRepublic"
                : territoryFaction === "Separatists"
                  ? "territorySeparatists"
                  : ""
            }`}
            key={`${x}-${y}`}
            onClick={() => onCellClick(x, y)}
          >
            {terrainDecorationUrl ? (
              <img
                alt=""
                aria-hidden="true"
                className="terrainDecoration"
                src={terrainDecorationUrl}
              />
            ) : null}
            {battlefieldObjectAssetUrl ? (
              <img
                alt=""
                aria-hidden="true"
                className="battlefieldObjectArt"
                src={battlefieldObjectAssetUrl}
              />
            ) : null}
            <span className="cellCoords">
              {x},{y}
            </span>
            {tile ? <span className="terrainTag">{localizeTerrainName(language, tile.terrainType)}</span> : null}
            {battlefieldObject ? (
              <span
                className={`battlefieldObject ${battlefieldObject.type} ${
                  battlefieldObject.status.toLowerCase()
                }`}
                title={localizeObjectName(language, battlefieldObject.type, battlefieldObject.name)}
              >
                <strong>{getObjectCode(battlefieldObject.type)}</strong>
                <small>
                  {battlefieldObject.destructible
                    ? `${battlefieldObject.currentHp}/${battlefieldObject.maxHp} HP`
                    : language === "pl" ? "CEL" : "TARGET"}
                </small>
              </span>
            ) : null}
            <div className="mapUnitStack">
              {tileUnits.map((token) => {
                return (
                  <span
                    className={`mapUnit ${getTokenClass(token.template, token.faction)} ${
                      token.unitId === selectedUnitId ? "selected" : ""
                    }`}
                    key={token.unitId}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectedUnitChange(token.unitId);
                    }}
                    title={`${token.name} | ${token.faction ? localizeFaction(language, token.faction) : language === "pl" ? "Nieznana" : "Unknown"} | HP ${token.currentHp}/${token.maxHp} | ${localizeUnitStatus(language, token.status)}`}
                  >
                    {token.imageUrl ? (
                      <img
                        alt=""
                        aria-hidden="true"
                        className="tokenPortrait"
                        src={token.imageUrl}
                        onError={(event) => {
                          const image = event.currentTarget;
                          if (token.fallbackImageUrl && image.dataset.fallback !== "true") {
                            image.dataset.fallback = "true";
                            image.src = token.fallbackImageUrl;
                            return;
                          }
                          image.hidden = true;
                        }}
                      />
                    ) : null}
                    <span className="tokenHead">
                      <span className="tokenVisor" />
                      <span className="tokenMouth" />
                    </span>
                    <span className="tokenCode">{token.initials}</span>
                    <span
                      aria-hidden="true"
                      className={`tokenStatusBadge status-${token.status.toLowerCase()}`}
                    >
                      {getStatusCode(token.status)}
                    </span>
                    <span
                      aria-label={`HP ${token.currentHp} ${language === "pl" ? "z" : "of"} ${token.maxHp}`}
                      className="tokenHealthTrack"
                      role="meter"
                    >
                      <span
                        className={`tokenHealthFill health-${token.healthState}`}
                        style={{ width: `${Math.max(0, Math.min(1, token.healthRatio)) * 100}%` }}
                      />
                    </span>
                  </span>
                );
              })}
            </div>
          </button>
        );
      })}
    </section>
  );
}

function getStatusCode(status: "Ready" | "Activated" | "Destroyed" | "Pinned"): string {
  switch (status) {
    case "Ready": return "R";
    case "Activated": return "A";
    case "Destroyed": return "X";
    case "Pinned": return "P";
  }
}

function getInteractionLabel(interaction: ReturnType<typeof getBoardCellInteraction>, language: "pl" | "en"): string {
  if (language === "en") {
    switch (interaction) {
      case "legal": return "legal move";
      case "reserve": return "legal reserve entry";
      case "target": return "legal target";
      case "invalid": return "invalid tile";
      case "selected": return "selected tile";
      default: return "board tile";
    }
  }
  switch (interaction) {
    case "legal": return "legalny ruch";
    case "reserve": return "legalne wejście z rezerwy";
    case "target": return "legalny cel";
    case "invalid": return "pole niedozwolone";
    case "selected": return "pole wybrane";
    default: return "pole planszy";
  }
}

function getObjectCode(type: BattlefieldObjectType): string {
  switch (type) {
    case "DefensePoint": return "P";
    case "StrategicPoint": return "★";
    case "Generator": return "G";
    case "LightFortification": return "L";
    case "HeavyFortification": return "H";
  }
}

function getTokenClass(template: UnitTemplate, faction?: FactionId): string {
  const factionClass =
    faction === "Republic"
      ? "tokenRepublic"
      : faction === "Separatists"
        ? "tokenSeparatists"
        : "tokenNeutral";
  const bodyClass = template.keywords.includes("SpiderDroid")
    ? "tokenVehicle"
    : template.keywords.includes("SuperBattleDroid")
    ? "tokenSuperBattleDroid"
    : template.abilities.includes("shield_generators") || template.keywords.includes("Shielded")
      ? "tokenDroideka"
    : template.keywords.includes("Droid")
      ? "tokenDroid"
      : template.keywords.includes("Vehicle")
        ? "tokenVehicle"
        : "tokenHelmet";

  return `${factionClass} ${bodyClass} tokenRole${template.role}`;
}
