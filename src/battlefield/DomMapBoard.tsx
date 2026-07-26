import { getTemplate } from "../core/battle-state";
import type { MissionState } from "../core/scenario/scenario-types";
import type {
  Battle,
  BattlefieldObjectType,
  FactionId,
  UnitTemplate,
} from "../types";

export function DomMapBoard({
  battle,
  interactionDisabled,
  mission,
  selectedUnitId,
  onCellClick,
  onSelectedUnitChange,
}: {
  battle: Battle;
  interactionDisabled: boolean;
  mission: MissionState;
  selectedUnitId: string;
  onCellClick: (x: number, y: number) => void;
  onSelectedUnitChange: (unitId: string) => void;
}) {
  const units = battle.armies.flatMap((army) => army.units);

  return (
    <section
      aria-disabled={interactionDisabled}
      className={`mapBoard commandMapBoard ${interactionDisabled ? "missionLocked" : ""}`}
      style={{ gridTemplateColumns: `repeat(${battle.board.width}, minmax(64px, 1fr))` }}
    >
      {Array.from({ length: battle.board.width * battle.board.height }, (_, index) => {
        const x = index % battle.board.width;
        const y = Math.floor(index / battle.board.width);
        const tile = battle.board.tiles.find((terrain) => terrain.x === x && terrain.y === y);
        const battlefieldObject = (battle.board.objects ?? []).find(
          (object) => object.position.x === x && object.position.y === y,
        );
        const tileUnits = units.filter((unit) => unit.position?.x === x && unit.position.y === y);
        const territoryArmyId = mission.territoryOwners?.[`${x},${y}`];
        const territoryFaction = battle.armies.find(
          (army) => army.id === territoryArmyId,
        )?.faction;

        return (
          <button
            className={`mapCell ${tile?.terrainType ?? "Open"} ${
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
              {tileUnits.map((unit) => {
                const template = getTemplate(unit);
                const army = battle.armies.find((candidate) => candidate.id === unit.armyId);
                const tokenImageUrl = getTokenImageUrl(template);

                return (
                  <span
                    className={`mapUnit ${getTokenClass(template, army?.faction)} ${
                      unit.id === selectedUnitId ? "selected" : ""
                    }`}
                    key={unit.id}
                    onClick={(event) => {
                      event.stopPropagation();
                      onSelectedUnitChange(unit.id);
                    }}
                    title={`${template.name} | ${army?.faction ?? "Unknown"}`}
                  >
                    {tokenImageUrl ? (
                      <img
                        alt=""
                        aria-hidden="true"
                        className="tokenPortrait"
                        src={tokenImageUrl}
                        onError={(event) => {
                          event.currentTarget.hidden = true;
                        }}
                      />
                    ) : null}
                    <span className="tokenHead">
                      <span className="tokenVisor" />
                      <span className="tokenMouth" />
                    </span>
                    <span className="tokenCode">{getUnitInitials(template)}</span>
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

export function getUnitInitials(template: UnitTemplate): string {
  return template.name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 3)
    .toUpperCase();
}

function getTokenImageUrl(template: UnitTemplate): string | undefined {
  const photoPrefix = "/unit-images/photos/";

  return template.imageUrl?.startsWith(photoPrefix)
    ? template.imageUrl.replace(photoPrefix, "/unit-images/tokens/")
    : undefined;
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
