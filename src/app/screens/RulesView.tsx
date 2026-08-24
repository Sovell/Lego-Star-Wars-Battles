import type { CSSProperties } from "react";
import { abilities, taskForces, unitTemplates } from "../../data";
import { terrainPresets } from "../../core/terrain-presets";
import { getTerrainDefinition, hasTerrainTrait } from "../../core/terrain-definitions";
import type { TerrainTile, TerrainType, UnitTemplate } from "../../types";
import { getUnitPresentationProfile } from "../../presentation/unit-profile";
import { PanelTitle } from "../components/PanelTitle";
import {
  localizeAbilityDescription,
  localizeAbilityName,
  localizeCategory,
  localizeFaction,
  localizeRole,
  localizeTaskForceName,
  localizeTerrainDescription,
  localizeTerrainName,
  localizeUnitName,
  localizeWeaponName,
  useI18n,
  type Language,
} from "../../i18n";

export function RulesView() {
  const { language, text } = useI18n();
  const statGlossary = [
    { label: "HP", value: text("Punkty wytrzymałości", "Hit Points"), description: text("Wytrzymałość jednostki. Po spadku do 0 jednostka zostaje zniszczona.", "A unit's durability. At 0 HP the unit is destroyed.") },
    { label: "MOV", value: text("Ruch", "Movement"), description: text("Bazowy zasięg ruchu przed uwzględnieniem kosztu terenu.", "Base movement range before terrain cost is applied.") },
    { label: "MOR", value: text("Morale", "Morale"), description: text("Próg odporności na suppression i przygwożdżenie jednostki.", "Resistance threshold against suppression and pinning.") },
    { label: "CMD", value: text("Dowodzenie", "Command"), description: text("Potencjał dowodzenia jednostki, przygotowany pod szersze reguły rozkazów.", "The unit's command potential, prepared for broader order rules.") },
    { label: "WPN", value: text("Uzbrojenie", "Weapons"), description: text("Liczba profili broni dostępnych dla jednostki.", "Number of weapon profiles available to the unit.") },
    { label: "SUP", value: text("Przygwożdżenie", "Suppression"), description: text("Presja bojowa utrudniająca trafianie i wpływająca na morale.", "Combat pressure that hinders attacks and affects morale.") },
    { label: "CD", value: text("Czas odnowienia", "Cooldown"), description: text("Liczba tur oczekiwania przed ponownym użyciem aktywnej zdolności.", "Turns to wait before an active ability can be used again.") },
    { label: "LOS", value: text("Linia widzenia", "Line of Sight"), description: text("Linia widzenia wymagana do ataku dystansowego.", "Visibility line required for a ranged attack.") },
  ];
  const heroTemplates = unitTemplates.filter((template) => template.category === "hero");
  const unitFactions = Array.from(new Set(unitTemplates.map((template) => template.faction)));
  const taskForceBonuses = taskForces
    .map((taskForce) => ({
      taskForce,
      bonus: abilities.find((ability) => ability.id === taskForce.bonusAbility),
    }))
    .filter((entry) => entry.bonus);

  return (
    <section className="rulesDatapad">
      <aside className="rulesIndex" aria-label={text("Indeks kompendium", "Compendium index")}>
        <div className="rulesIndexHeader">
          <span aria-hidden="true">DB-01</span>
          <div>
            <p className="eyebrow">{text("Indeks danych", "Data index")}</p>
            <strong>{text("Biblioteka polowa", "Field library")}</strong>
          </div>
        </div>
        <nav>
          <a href="#rules-reference">01 · {text("Statystyki i teren", "Stats and terrain")}</a>
          <a href="#rules-heroes">02 · {text("Bohaterowie", "Heroes")}</a>
          <a href="#rules-units">03 · {text("Karty jednostek", "Unit cards")}</a>
          <a href="#rules-task-forces">04 · {text("Zespoły uderzeniowe", "Task forces")}</a>
        </nav>
        <p>{text(
          "Treść datapadu pochodzi bezpośrednio z danych używanych przez grę.",
          "Datapad content comes directly from the data used by the game.",
        )}</p>
      </aside>

      <div className="rulesLayout">
        <section className="rulesGrid" id="rules-reference">
        <section className="rulesPanel">
          <PanelTitle title={text("Skróty", "Abbreviations")} detail={text("statystyki", "stats")} />
          <div className="glossaryList">
            {statGlossary.map((item) => (
              <article className="glossaryItem" key={item.label}>
                <strong>{item.label}</strong>
                <div>
                  <h3>{item.value}</h3>
                  <p>{item.description}</p>
                </div>
              </article>
            ))}
          </div>
        </section>

        <section className="rulesPanel">
          <PanelTitle title={text("Teren", "Terrain")} detail={`${terrainPresets.length} ${text("typów", "types")}`} />
          <div className="terrainRulesList">
            {terrainPresets.map((terrain) => (
              <article className={`terrainRule ${terrain.terrainType}`} key={terrain.terrainType}>
                <div>
                  <p className="category">{terrain.terrainType}</p>
                  <h3>{getTerrainRuleName(terrain.terrainType, language)}</h3>
                </div>
                <div className="ruleMetaGrid">
                  <span>{text("Obrona", "Defense")} +{terrain.defenseBonus}</span>
                  <span>{text("Atak", "Attack")} +{terrain.attackBonus}</span>
                  <span>{text("Ruch", "Move")} {hasTerrainTrait(terrain, "Impassable") ? text("niedostępny", "unavailable") : `x${terrain.movementCost}`}</span>
                  <span>LOS {terrain.blocksLineOfSight ? text("blokuje", "blocked") : text("nie blokuje", "clear")}</span>
                </div>
                <p>{getTerrainRuleDescription(terrain, language)}</p>
              </article>
            ))}
          </div>
        </section>
        </section>

      <section className="rulesPanel" id="rules-heroes">
        <PanelTitle title={text("Bohaterowie", "Heroes")} detail={`${heroTemplates.length} ${text("kart", "cards")}`} />
        <div className="heroRulesGrid">
          {heroTemplates.map((template) => {
            const templateAbilities = abilities.filter((ability) => template.abilities.includes(ability.id));

            return (
              <article className="heroRuleCard" key={template.id}>
                <div className="heroRuleHeader">
                  <div>
                    <p className="category">{localizeFaction(language, template.faction)} | {localizeRole(language, template.role)}</p>
                    <h3>{localizeUnitName(language, template.id, template.name)}</h3>
                  </div>
                  <strong>{template.cost} {text("pkt", "pts")}</strong>
                </div>
                <div className="ruleMetaGrid">
                  <span>HP {template.maxHp}</span>
                  <span>MOV {template.movement}</span>
                  <span>MOR {template.morale}</span>
                  <span>CMD {template.command}</span>
                </div>
                <div className="abilityRulesList">
                  {templateAbilities.map((ability) => (
                    <article className="abilityRule" key={ability.id}>
                      <div>
                        <h4>{localizeAbilityName(language, ability)}</h4>
                        <span>{formatAbilityMeta(ability, language)}</span>
                      </div>
                      <p>{localizeAbilityDescription(language, ability)}</p>
                    </article>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rulesPanel" id="rules-units">
        <PanelTitle title={text("Karty jednostek", "Unit cards")} detail={`${unitTemplates.length} ${text("kart", "cards")}`} />
        <div className="unitRulesByFaction">
          {unitFactions.map((faction) => (
            <section className="unitRulesFaction" key={faction}>
              <div className="rulesSectionHeader">
                <p className="eyebrow">{localizeFaction(language, faction)}</p>
                <h3>{unitTemplates.filter((template) => template.faction === faction).length} {text("jednostek", "units")}</h3>
              </div>
              <div className="unitRulesGrid">
                {unitTemplates
                  .filter((template) => template.faction === faction)
                  .map((template) => (
                    <UnitRulesCard key={template.id} template={template} />
                  ))}
              </div>
            </section>
          ))}
        </div>
      </section>

      <section className="rulesPanel" id="rules-task-forces">
        <PanelTitle title={text("Zespoły uderzeniowe", "Task Forces")} detail={`${taskForceBonuses.length} ${text("premii", "bonuses")}`} />
        <div className="taskForceRulesGrid">
          {taskForceBonuses.map(({ taskForce, bonus }) => (
            <article className="abilityRule" key={taskForce.id}>
              <div>
                <h4>{localizeTaskForceName(language, taskForce.id, taskForce.name)}</h4>
                <span>{bonus ? formatAbilityMeta(bonus, language) : text("premia", "bonus")}</span>
              </div>
              <p>{bonus ? localizeAbilityDescription(language, bonus) : null}</p>
            </article>
          ))}
        </div>
      </section>
      </div>
    </section>
  );
}

function UnitRulesCard({ template }: { template: UnitTemplate }) {
  const { language, text } = useI18n();
  const templateAbilities = abilities.filter((ability) => template.abilities.includes(ability.id));
  const presentation = getUnitPresentationProfile(template.id, template.faction);
  const themeStyle = {
    "--unit-accent": presentation.theme.accent,
    "--unit-accent-soft": presentation.theme.accentSoft,
    "--unit-accent-strong": presentation.theme.accentStrong,
  } as CSSProperties;

  return (
    <article className="unitRuleCard" style={themeStyle}>
      <div className="heroRuleHeader">
        <div>
          <p className="category">{localizeCategory(language, template.category)} | {localizeRole(language, template.role)}</p>
          <h3>{localizeUnitName(language, template.id, template.name)}</h3>
        </div>
        <strong>{template.cost} {text("pkt", "pts")}</strong>
      </div>
      {presentation.lore ? (
        <section className="unitLore unitRuleLore">
          <strong>{presentation.lore.subtitle[language]}</strong>
          <p>{presentation.lore.summary[language]}</p>
          {presentation.lore.details ? (
            <details>
              <summary>{text("Więcej lore", "More lore")}</summary>
              <p>{presentation.lore.details[language]}</p>
            </details>
          ) : null}
        </section>
      ) : null}
      <div className="ruleMetaGrid">
        <span>HP {template.maxHp}</span>
        <span>MOV {template.movement}</span>
        <span>MOR {template.morale}</span>
        <span>CMD {template.command}</span>
      </div>
      <div className="weaponRulesList">
        {template.weapons.map((weapon) => (
          <article className="weaponRule" key={weapon.id}>
            <strong>{localizeWeaponName(language, weapon.id, weapon.name)}</strong>
            <span>RNG {weapon.range} | ATK {weapon.attacks} | DMG {weapon.damage}</span>
            {weapon.keywords.length ? <small>{weapon.keywords.join(", ")}</small> : null}
          </article>
        ))}
      </div>
      <div className="unitAbilityChips">
        {templateAbilities.length ? (
          templateAbilities.map((ability) => (
            <span title={localizeAbilityDescription(language, ability)} key={ability.id}>
              {localizeAbilityName(language, ability)}
            </span>
          ))
        ) : (
          <span>{text("Brak zdolności", "No abilities")}</span>
        )}
      </div>
    </article>
  );
}

function formatAbilityMeta(ability: (typeof abilities)[number], language: Language): string {
  const parts = [
    ability.discipline === "command" ? (language === "pl" ? "dowódcza" : "command") : "",
    ability.type ? (language === "pl" ? ({ passive: "pasywna", active: "aktywna", aura: "aura" } as const)[ability.type] : ability.type) : (language === "pl" ? "pasywna" : "passive"),
    ability.range ? `${language === "pl" ? "zasięg" : "range"} ${ability.range}` : "",
    ability.cooldown ? `CD ${ability.cooldown}` : "",
    ability.usesPerBattle ? `${ability.usesPerBattle}× ${language === "pl" ? "na bitwę" : "per battle"}` : "",
  ].filter(Boolean);

  return parts.join(" | ");
}

function getTerrainRuleName(terrainType: TerrainType, language: Language): string {
  return localizeTerrainName(language, terrainType, getTerrainDefinition(terrainType)?.name ?? terrainType);
}

function getTerrainRuleDescription(terrain: TerrainTile, language: Language): string {
  const fallback = getTerrainDefinition(terrain.terrainType)?.description ??
    (language === "pl"
      ? `Pole terenowe: obrona +${terrain.defenseBonus}, koszt ruchu ${terrain.movementCost}.`
      : `Terrain tile: defense +${terrain.defenseBonus}, movement cost ${terrain.movementCost}.`);
  return localizeTerrainDescription(language, terrain.terrainType, fallback);
}
