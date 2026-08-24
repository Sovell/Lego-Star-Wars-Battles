import type { CSSProperties } from "react";
import { abilities } from "../../data";
import { getUnitActiveAbilities } from "../../core/rules/active-abilities";
import { getTemplate } from "../../core/battle-state";
import type { AbilityDefinition, Army, Battle, UnitInstance } from "../../types";
import {
  localizeAbilityDescription,
  localizeAbilityName,
  localizeFaction,
  localizeRole,
  localizeUnitName,
  localizeUnitStatus,
  localizeWeaponName,
  useI18n,
} from "../../i18n";
import {
  getUnitInitials,
  getUnitPortraitImageUrl,
} from "../../presentation/unit-presentation";
import { getUnitPresentationProfile } from "../../presentation/unit-profile";
import "../styles/battle-inspector.css";

export function BattleUnitInspector({
  battle,
  debugMode,
  selectedArmy,
  selectedUnit,
  onUnitPatch,
}: {
  battle: Battle;
  debugMode: boolean;
  selectedArmy?: Army;
  selectedUnit?: UnitInstance;
  onUnitPatch: (unitId: string, patch: Partial<UnitInstance>) => void;
}) {
  const { language, text } = useI18n();

  if (!selectedUnit) {
    return (
      <section className="unitInspectorModule unitInspectorEmpty">
        <span>{text("Wybrana jednostka", "Selected unit")}</span>
        <strong>{text("Brak wyboru", "No selection")}</strong>
        <p>{text(
          "Kliknij token na mapie albo wybierz jednostkę w docku rozkazów.",
          "Click a token on the map or choose a unit in the command dock.",
        )}</p>
      </section>
    );
  }

  const template = getTemplate(selectedUnit);
  const presentation = getUnitPresentationProfile(template.id, template.faction);
  const portraitImageUrl = getUnitPortraitImageUrl(template);
  const activeAbilities = getUnitActiveAbilities(battle, selectedUnit);
  const configuredAbilities = abilities.filter((ability) =>
    template.abilities.includes(ability.id)
  );
  const unitAbilities = uniqueAbilities([...configuredAbilities, ...activeAbilities]);
  const themeStyle = {
    "--unit-accent": presentation.theme.accent,
    "--unit-accent-soft": presentation.theme.accentSoft,
    "--unit-accent-strong": presentation.theme.accentStrong,
  } as CSSProperties;
  const positionLabel = selectedUnit.position
    ? `${text("Pole", "Tile")} ${selectedUnit.position.x}, ${selectedUnit.position.y}`
    : text("Rezerwa / posiłki", "Reserve / reinforcements");

  return (
    <section className="unitInspectorModule" style={themeStyle} data-faction={template.faction.toLowerCase()}>
      <header className="unitInspectorIdentity">
        <div className="unitInspectorPortrait">
          {portraitImageUrl ? (
            <img
              key={portraitImageUrl}
              src={portraitImageUrl}
              alt={localizeUnitName(language, template.id, template.name)}
              onLoad={(event) => {
                event.currentTarget.hidden = false;
              }}
              onError={(event) => {
                event.currentTarget.hidden = true;
              }}
            />
          ) : null}
          <span>{getUnitInitials(template)}</span>
        </div>
        <div>
          <span>{selectedArmy?.playerName ?? text("Nieznana armia", "Unknown army")}</span>
          <strong>{localizeUnitName(language, template.id, template.name)}</strong>
          <small>
            {selectedArmy ? localizeFaction(language, selectedArmy.faction) : text("Nieznana", "Unknown")}
            {" · "}{localizeRole(language, template.role)}
          </small>
        </div>
        <span className="unitInspectorStatus" data-status={selectedUnit.status.toLowerCase()}>
          {localizeUnitStatus(language, selectedUnit.status)}
        </span>
      </header>

      <div className="unitInspectorStats" aria-label={text("Statystyki jednostki", "Unit statistics")}>
        <Stat label="HP" value={`${selectedUnit.currentHp}/${template.maxHp}`} />
        <Stat label="SUP" value={String(selectedUnit.suppression)} />
        <Stat label="MOV" value={String(template.movement)} />
        <Stat label="SV" value={template.armorSave ? `${template.armorSave}+` : "—"} />
      </div>

      <div className="unitInspectorPosition">
        <span>{positionLabel}</span>
        {selectedUnit.supportLink ? (
          <small>
            {text("Wsparcie", "Support")}: {selectedUnit.supportLink.role === "provider"
              ? text("udzielane", "provided")
              : text("otrzymywane", "received")}{" · "}
            {selectedUnit.supportLink.mode === "attack" ? text("atak", "attack") : text("obrona", "defense")}
          </small>
        ) : null}
      </div>

      <details className="unitInspectorSection" open>
        <summary>
          <strong>{text("Uzbrojenie", "Weapons")}</strong>
          <small>{template.weapons.length}</small>
        </summary>
        <div className="unitInspectorWeaponList">
          {template.weapons.map((weapon) => (
            <div key={weapon.id}>
              <strong>{localizeWeaponName(language, weapon.id, weapon.name)}</strong>
              <span><b>R</b>{weapon.range}</span>
              <span><b>A</b>{weapon.attacks}</span>
              <span><b>D</b>{weapon.damage}</span>
            </div>
          ))}
        </div>
      </details>

      <details className="unitInspectorSection" open={unitAbilities.length > 0}>
        <summary>
          <strong>{text("Zdolności", "Abilities")}</strong>
          <small>{unitAbilities.length}</small>
        </summary>
        {unitAbilities.length > 0 ? (
          <div className="unitInspectorAbilityList">
            {unitAbilities.map((ability) => {
              const state = getAbilityState(ability, selectedUnit, text);
              return (
                <div key={ability.id} tabIndex={0} title={localizeAbilityDescription(language, ability)}>
                  <span>
                    <strong>{localizeAbilityName(language, ability)}</strong>
                    <small data-tone={state.tone}>{state.label}</small>
                  </span>
                  <p>{localizeAbilityDescription(language, ability)}</p>
                </div>
              );
            })}
          </div>
        ) : (
          <p className="unitInspectorEmptyNote">{text("Brak zdolności jednostki.", "This unit has no abilities.")}</p>
        )}
      </details>

      {presentation.lore ? (
        <details className="unitInspectorSection unitInspectorLore">
          <summary>
            <strong>{text("Profil jednostki", "Unit profile")}</strong>
            <small>{text("info", "info")}</small>
          </summary>
          <strong>{presentation.lore.subtitle[language]}</strong>
          <p>{presentation.lore.summary[language]}</p>
          {presentation.lore.details ? <p>{presentation.lore.details[language]}</p> : null}
        </details>
      ) : null}

      {debugMode ? (
        <button
          className="secondaryButton"
          disabled={!selectedUnit.position}
          onClick={() => onUnitPatch(selectedUnit.id, { position: null })}
        >
          {text("Przenieś do rezerw", "Move to reserves")}
        </button>
      ) : null}
    </section>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <span>
      <small>{label}</small>
      <strong>{value}</strong>
    </span>
  );
}

function uniqueAbilities(items: AbilityDefinition[]): AbilityDefinition[] {
  return [...new Map(items.map((ability) => [ability.id, ability])).values()];
}

function getAbilityState(
  ability: AbilityDefinition,
  unit: UnitInstance,
  text: (pl: string, en: string) => string,
): { label: string; tone: "neutral" | "ready" | "warning" } {
  if (ability.type !== "active") {
    return {
      label: ability.type === "aura" ? text("Aura", "Aura") : text("Pasywna", "Passive"),
      tone: "neutral",
    };
  }

  if (ability.usesPerBattle !== undefined && unit.usedAbilities?.includes(ability.id)) {
    return { label: text("Wykorzystana", "Spent"), tone: "warning" };
  }

  const cooldown = unit.abilityCooldowns?.[ability.id] ?? 0;
  return cooldown > 0
    ? { label: `CD ${cooldown}`, tone: "warning" }
    : { label: text("Gotowa", "Ready"), tone: "ready" };
}
