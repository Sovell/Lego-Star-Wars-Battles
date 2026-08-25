import { getArmyCost, getTemplate } from "../../core/battle-state";
import type { Army } from "../../types";
import {
  localizeFaction,
  localizeRole,
  localizeUnitName,
  localizeUnitStatus,
  useI18n,
} from "../../i18n";
import {
  getUnitInitials,
  getUnitPortraitImageUrl,
} from "../../presentation/unit-presentation";
import "../styles/battle-armies-panel.css";

export function BattleArmiesPanel({
  armies,
  selectedUnitId,
  onUnitSelect,
}: {
  armies: Army[];
  selectedUnitId: string;
  onUnitSelect: (unitId: string) => void;
}) {
  const { language, text } = useI18n();

  return (
    <div className="battleArmiesPanel">
      {armies.map((army) => {
        const activated = army.units.filter((unit) => unit.status === "Activated").length;
        const destroyed = army.units.filter((unit) => unit.status === "Destroyed").length;
        const ready = army.units.filter((unit) => unit.status === "Ready").length;

        return (
          <section
            className="battleArmyModule"
            data-faction={army.faction.toLowerCase()}
            key={army.id}
          >
            <header className="battleArmyModuleHeader">
              <div>
                <span>{localizeFaction(language, army.faction)}</span>
                <strong>{army.playerName}</strong>
              </div>
              <small>{getArmyCost(army)} {text("pkt", "pts")}</small>
            </header>

            <div className="battleArmySummary" aria-label={text("Podsumowanie statusów", "Status summary")}>
              <span data-status="ready">{text("Gotowe", "Ready")} <b>{ready}</b></span>
              <span data-status="activated">{text("Aktywowane", "Activated")} <b>{activated}</b></span>
              <span data-status="destroyed">{text("Straty", "Eliminated")} <b>{destroyed}</b></span>
            </div>

            <div className="battleArmyUnitList">
              {army.units.map((unit) => {
                const template = getTemplate(unit);
                const portraitImageUrl = getUnitPortraitImageUrl(template);
                const unitName = localizeUnitName(language, template.id, template.name);
                const position = unit.position
                  ? `${text("Pole", "Tile")} ${unit.position.x}, ${unit.position.y}`
                  : text("Rezerwa", "Reserve");

                return (
                  <button
                    aria-pressed={unit.id === selectedUnitId}
                    className="battleArmyUnit"
                    data-status={unit.status.toLowerCase()}
                    key={unit.id}
                    onClick={() => onUnitSelect(unit.id)}
                    type="button"
                  >
                    <span className="battleArmyUnitPortrait" aria-hidden="true">
                      {portraitImageUrl ? (
                        <img
                          alt=""
                          src={portraitImageUrl}
                          onLoad={(event) => {
                            event.currentTarget.hidden = false;
                          }}
                          onError={(event) => {
                            event.currentTarget.hidden = true;
                          }}
                        />
                      ) : null}
                      <b>{getUnitInitials(template)}</b>
                    </span>
                    <span className="battleArmyUnitIdentity">
                      <strong>{unitName}</strong>
                      <small>{localizeRole(language, template.role)} · {position}</small>
                    </span>
                    <span className="battleArmyUnitStatus">
                      {localizeUnitStatus(language, unit.status)}
                    </span>
                    <span className="battleArmyUnitTracks">
                      <small>HP <b>{unit.currentHp}/{template.maxHp}</b></small>
                      <small>SUP <b>{unit.suppression}</b></small>
                    </span>
                  </button>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
