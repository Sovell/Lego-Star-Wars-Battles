import type {
  BattlefieldObjectType,
  FactionId,
  UnitTemplate,
} from "../types";
import { boardPositionKey } from "./board-view-model";
import { getBoardCellInteraction } from "./board-interaction-model";
import type { BoardRendererProps } from "./board-renderer";

export function DomMapBoard({
  interactionDisabled,
  interactionModel,
  selectedUnitId,
  viewModel,
  onCellClick,
  onSelectedUnitChange,
}: BoardRendererProps) {
  return (
    <section
      aria-disabled={interactionDisabled}
      className={`mapBoard commandMapBoard ${interactionDisabled ? "missionLocked" : ""}`}
      style={{
        gridTemplateColumns: `repeat(${viewModel.width}, minmax(0, 1fr))`,
        gridTemplateRows: `repeat(${viewModel.height}, minmax(0, 1fr))`,
      }}
    >
      {viewModel.positions.map(({ x, y }) => {
        const key = boardPositionKey(x, y);
        const tile = viewModel.tilesByPosition.get(key);
        const battlefieldObject = viewModel.objectsByPosition.get(key);
        const tileUnits = viewModel.unitsByPosition.get(key) ?? [];
        const territoryFaction = viewModel.territoryByPosition.get(key)?.faction;
        const cellInteraction = getBoardCellInteraction(interactionModel, x, y);

        return (
          <button
            aria-label={`Pole ${x}, ${y}: ${getInteractionLabel(cellInteraction)}`}
            className={`mapCell ${tile?.terrainType ?? "Open"} interaction-${cellInteraction} ${
              territoryFaction === "Republic"
                ? "territoryRepublic"
                : territoryFaction === "Separatists"
                  ? "territorySeparatists"
                  : ""
            }`}
            key={`${x}-${y}`}
            onClick={() => onCellClick(x, y)}
          >
            <span className="cellCoords">
              {x},{y}
            </span>
            {tile ? <span className="terrainTag">{tile.terrainType}</span> : null}
            {battlefieldObject ? (
              <span
                className={`battlefieldObject ${battlefieldObject.type} ${
                  battlefieldObject.status.toLowerCase()
                }`}
                title={battlefieldObject.name}
              >
                <strong>{getObjectCode(battlefieldObject.type)}</strong>
                <small>
                  {battlefieldObject.destructible
                    ? `${battlefieldObject.currentHp}/${battlefieldObject.maxHp} HP`
                    : "CEL"}
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
                    title={`${token.name} | ${token.faction ?? "Unknown"}`}
                  >
                    {token.imageUrl ? (
                      <img
                        alt=""
                        aria-hidden="true"
                        className="tokenPortrait"
                        src={token.imageUrl}
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                        }}
                      />
                    ) : null}
                    <span className="tokenHead">
                      <span className="tokenVisor" />
                      <span className="tokenMouth" />
                    </span>
                    <span className="tokenCode">{token.initials}</span>
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

function getInteractionLabel(interaction: ReturnType<typeof getBoardCellInteraction>): string {
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
  const bodyClass = template.keywords.includes("SuperBattleDroid")
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
