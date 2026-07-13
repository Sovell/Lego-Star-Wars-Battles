import { abilities, taskForces, unitTemplates } from "../../data";
import { terrainPresets } from "../../core/terrain-presets";
import type { TerrainTile, TerrainType, UnitTemplate } from "../../types";
import { PanelTitle } from "../components/PanelTitle";

const statGlossary = [
  { label: "HP", value: "Hit Points", description: "Wytrzymalosc jednostki. Po spadku do 0 jednostka zostaje zniszczona." },
  { label: "MOV", value: "Movement", description: "Bazowy zasieg ruchu po planszy przed uwzglednieniem kosztu terenu." },
  { label: "MOR", value: "Morale", description: "Prog odpornosci na suppression i przypiecie jednostki." },
  { label: "CMD", value: "Command", description: "Potencjal dowodzenia jednostki; pole przygotowane pod szersze rozkazy." },
  { label: "WPN", value: "Weapons", description: "Liczba profili broni dostepnych dla jednostki." },
  { label: "SUP", value: "Suppression", description: "Presja bojowa. Utrudnia trafianie i bedzie podstawa testow morale." },
  { label: "CD", value: "Cooldown", description: "Liczba tur oczekiwania przed ponownym uzyciem aktywnej zdolnosci." },
  { label: "LOS", value: "Line of Sight", description: "Linia widzenia wymagana do ataku dystansowego." },
];

export function RulesView() {
  const heroTemplates = unitTemplates.filter((template) => template.category === "hero");
  const unitFactions = Array.from(new Set(unitTemplates.map((template) => template.faction)));
  const taskForceBonuses = taskForces
    .map((taskForce) => ({
      taskForce,
      bonus: abilities.find((ability) => ability.id === taskForce.bonusAbility),
    }))
    .filter((entry) => entry.bonus);

  return (
    <section className="rulesLayout">
      <div className="rulesGrid">
        <section className="rulesPanel">
          <PanelTitle title="Skroty" detail="statystyki" />
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
          <PanelTitle title="Teren" detail={`${terrainPresets.length} typow`} />
          <div className="terrainRulesList">
            {terrainPresets.map((terrain) => (
              <article className={`terrainRule ${terrain.terrainType}`} key={terrain.terrainType}>
                <div>
                  <p className="category">{terrain.terrainType}</p>
                  <h3>{getTerrainRuleName(terrain.terrainType)}</h3>
                </div>
                <div className="ruleMetaGrid">
                  <span>Obrona +{terrain.defenseBonus}</span>
                  <span>Atak +{terrain.attackBonus}</span>
                  <span>Ruch x{terrain.movementCost}</span>
                  <span>LOS {terrain.blocksLineOfSight ? "blokuje" : "nie blokuje"}</span>
                </div>
                <p>{getTerrainRuleDescription(terrain)}</p>
              </article>
            ))}
          </div>
        </section>
      </div>

      <section className="rulesPanel">
        <PanelTitle title="Bohaterowie" detail={`${heroTemplates.length} kart`} />
        <div className="heroRulesGrid">
          {heroTemplates.map((template) => {
            const templateAbilities = abilities.filter((ability) => template.abilities.includes(ability.id));

            return (
              <article className="heroRuleCard" key={template.id}>
                <div className="heroRuleHeader">
                  <div>
                    <p className="category">{template.faction} | {template.role}</p>
                    <h3>{template.name}</h3>
                  </div>
                  <strong>{template.cost} pkt</strong>
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
                        <h4>{ability.name}</h4>
                        <span>{formatAbilityMeta(ability)}</span>
                      </div>
                      <p>{ability.description}</p>
                    </article>
                  ))}
                </div>
              </article>
            );
          })}
        </div>
      </section>

      <section className="rulesPanel">
        <PanelTitle title="Karty jednostek" detail={`${unitTemplates.length} kart`} />
        <div className="unitRulesByFaction">
          {unitFactions.map((faction) => (
            <section className="unitRulesFaction" key={faction}>
              <div className="rulesSectionHeader">
                <p className="eyebrow">{faction}</p>
                <h3>{unitTemplates.filter((template) => template.faction === faction).length} jednostek</h3>
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

      <section className="rulesPanel">
        <PanelTitle title="Task Force" detail={`${taskForceBonuses.length} bonusow`} />
        <div className="taskForceRulesGrid">
          {taskForceBonuses.map(({ taskForce, bonus }) => (
            <article className="abilityRule" key={taskForce.id}>
              <div>
                <h4>{taskForce.name}</h4>
                <span>{bonus ? formatAbilityMeta(bonus) : "bonus"}</span>
              </div>
              <p>{bonus?.description}</p>
            </article>
          ))}
        </div>
      </section>
    </section>
  );
}

function UnitRulesCard({ template }: { template: UnitTemplate }) {
  const templateAbilities = abilities.filter((ability) => template.abilities.includes(ability.id));

  return (
    <article className="unitRuleCard">
      <div className="heroRuleHeader">
        <div>
          <p className="category">{template.category} | {template.role}</p>
          <h3>{template.name}</h3>
        </div>
        <strong>{template.cost} pkt</strong>
      </div>
      <div className="ruleMetaGrid">
        <span>HP {template.maxHp}</span>
        <span>MOV {template.movement}</span>
        <span>MOR {template.morale}</span>
        <span>CMD {template.command}</span>
      </div>
      <div className="weaponRulesList">
        {template.weapons.map((weapon) => (
          <article className="weaponRule" key={weapon.id}>
            <strong>{weapon.name}</strong>
            <span>RNG {weapon.range} | ATK {weapon.attacks} | DMG {weapon.damage}</span>
            {weapon.keywords.length ? <small>{weapon.keywords.join(", ")}</small> : null}
          </article>
        ))}
      </div>
      <div className="unitAbilityChips">
        {templateAbilities.length ? (
          templateAbilities.map((ability) => (
            <span title={ability.description} key={ability.id}>
              {ability.name}
            </span>
          ))
        ) : (
          <span>Brak zdolnosci</span>
        )}
      </div>
    </article>
  );
}

function formatAbilityMeta(ability: (typeof abilities)[number]): string {
  const parts = [
    ability.type ?? "passive",
    ability.range ? `range ${ability.range}` : "",
    ability.cooldown ? `CD ${ability.cooldown}` : "",
  ].filter(Boolean);

  return parts.join(" | ");
}

function getTerrainRuleName(terrainType: TerrainType): string {
  switch (terrainType) {
    case "Open":
      return "Otwarty teren";
    case "LightCover":
      return "Lekka oslona";
    case "HeavyCover":
      return "Ciezka oslona";
    case "Building":
      return "Zabudowania";
    case "DifficultTerrain":
      return "Trudny teren";
    default:
      return terrainType;
  }
}

function getTerrainRuleDescription(terrain: TerrainTile): string {
  switch (terrain.terrainType) {
    case "Open":
      return "Standardowe pole bez modyfikatorow. Najlepsze do szybkiego przemieszczania.";
    case "LightCover":
      return "Daje niewielka ochrone przed ostrzalem bez spowalniania ruchu.";
    case "HeavyCover":
      return "Mocna oslona, ale wejscie na pole jest wolniejsze.";
    case "Building":
      return "Mocna oslona i przeszkoda blokujaca linie widzenia.";
    case "DifficultTerrain":
      return "Nie daje oslony, ale spowalnia ruch przez gruzy, przeszkody albo nierowny teren.";
    default:
      return `Pole terenowe: obrona +${terrain.defenseBonus}, koszt ruchu ${terrain.movementCost}.`;
  }
}
