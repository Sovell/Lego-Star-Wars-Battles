import { unitTemplates } from "../../data";
import { createBattlefieldObject } from "../../core/battlefield-objects";
import type {
  ScenarioEventEffect,
  ScenarioEventTrigger,
  ScenarioScheduledEvent,
  ScenarioZone,
} from "../../core/scenario/scenario-types";
import type { Army, BattlefieldObjectType } from "../../types";
import {
  localizeEventName,
  localizeFaction,
  localizeUnitName,
  useI18n,
  type Language,
} from "../../i18n";
import "./ScenarioEventsPanel.css";

const objectTypes: BattlefieldObjectType[] = [
  "DefensePoint",
  "StrategicPoint",
  "Generator",
  "LightFortification",
  "HeavyFortification",
];

const profileIds = ["aggressive", "defensive", "objective", "swarm", "hunter"] as const;

export function ScenarioEventsPanel({
  armies,
  currentRound,
  editable,
  events,
  zones = [],
  resolvedEventIds = [],
  onChange,
}: {
  armies: Army[];
  currentRound: number;
  editable: boolean;
  events: ScenarioScheduledEvent[];
  zones?: ScenarioZone[];
  resolvedEventIds?: string[];
  onChange?: (events: ScenarioScheduledEvent[]) => void;
}) {
  const { language, text } = useI18n();
  if (!editable) {
    if (events.length === 0) return null;
    const resolved = new Set(resolvedEventIds);
    const upcoming = events.filter((event) => !resolved.has(event.id)).sort(compareEvents);
    return (
      <section className="scenarioEventsPanel scenarioEventsTimeline">
        <div className="scenarioEventsHeader">
          <h3>{text("Nadchodzące wydarzenia", "Upcoming events")}</h3>
          <span>{upcoming.length}</span>
        </div>
        {upcoming.length > 0 ? (
          <div className="scenarioEventList">
            {upcoming.slice(0, 3).map((event) => {
              const announced = event.visibility === "Announced";
              return (
                <article className="scenarioEventCard upcoming" key={event.id}>
                  <div>
                    <strong>{announced ? localizeEventName(language, event.id, event.name) : text("Nieznane zdarzenie", "Unknown event")}</strong>
                    <small>{formatTrigger(event.trigger, language)}</small>
                  </div>
                  <p>{announced ? formatEffect(event.effect, armies, language) : text("Szczegóły pozostają ukryte.", "Details remain hidden.")}</p>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="scenarioEventsEmpty">{text("Wszystkie wydarzenia już nastąpiły.", "All events have already occurred.")}</p>
        )}
        {upcoming.some((event) => isRoundTrigger(event.trigger) && event.trigger.round < currentRound) ? (
          <small className="scenarioEventWarning">{text("Niewykonane wydarzenie ma termin wcześniejszy niż bieżąca runda.", "An unresolved event was scheduled before the current round.")}</small>
        ) : null}
      </section>
    );
  }

  function updateEvent(eventId: string, nextEvent: ScenarioScheduledEvent): void {
    onChange?.(events.map((event) => event.id === eventId ? nextEvent : event));
  }

  function addEvent(): void {
    const army = armies[0];
    if (!army) return;
    const template = unitTemplates.find((candidate) => candidate.faction === army.faction);
    onChange?.([...events, {
      id: crypto.randomUUID(),
      name: `${text("Nowe wydarzenie", "New event")} ${events.length + 1}`,
      trigger: { type: "RoundStarted", round: 2 },
      effect: {
        type: "DeployReinforcements",
        armyId: army.id,
        units: template ? [{ templateId: template.id, count: 1 }] : [],
      },
      visibility: "Announced",
    }]);
  }

  return (
    <section className="scenarioEventsPanel">
      <div className="scenarioEventsHeader">
        <div>
          <h3>{text("Zdarzenia misji", "Mission events")}</h3>
          <small>{text("Połącz wyzwalacz ze zmianą sytuacji na polu bitwy.", "Connect a trigger to a battlefield effect.")}</small>
        </div>
        <button className="secondaryButton" disabled={armies.length === 0} type="button" onClick={addEvent}>
          + {text("Dodaj", "Add")}
        </button>
      </div>
      {events.length === 0 ? (
        <p className="scenarioEventsEmpty">{text("Brak zaplanowanych zdarzeń.", "No scheduled events.")}</p>
      ) : (
        <div className="scenarioEventList">
          {[...events].sort(compareEvents).map((event) => (
            <details className="scenarioEventCard" key={event.id}>
              <summary>
                <span>
                  <strong>{localizeEventName(language, event.id, event.name)}</strong>
                  <small>{formatTrigger(event.trigger, language)}</small>
                </span>
                <span className="scenarioEventBadge">{effectLabel(event.effect, language)}</span>
              </summary>
              <div className="scenarioEventEditor">
                <label>
                  {text("Nazwa", "Name")}
                  <input value={event.name} onChange={(change) => updateEvent(event.id, { ...event, name: change.target.value })} />
                </label>
                <div className="scenarioEventFieldGrid">
                  <label>
                    {text("Wyzwalacz", "Trigger")}
                    <select
                      value={event.trigger.type}
                      onChange={(change) => updateEvent(event.id, {
                        ...event,
                        trigger: createDefaultTrigger(change.target.value as ScenarioEventTrigger["type"], armies, zones),
                      })}
                    >
                      <option value="RoundStarted">{text("Początek rundy", "Round start")}</option>
                      <option value="RoundEnded">{text("Koniec rundy", "Round end")}</option>
                      <option value="UnitDestroyed">{text("Zniszczenie jednostki", "Unit destroyed")}</option>
                      <option value="ObjectDestroyed">{text("Zniszczenie obiektu", "Object destroyed")}</option>
                      <option value="UnitEnteredZone">{text("Wejście do strefy", "Unit entered zone")}</option>
                      <option value="TerritoryCaptured">{text("Przejęcie terytorium", "Territory captured")}</option>
                      <option value="ArmyStrengthBelow">{text("Spadek siły armii", "Army strength below")}</option>
                    </select>
                  </label>
                  <label>
                    {text("Efekt", "Effect")}
                    <select
                      value={event.effect.type}
                      onChange={(change) => updateEvent(event.id, {
                        ...event,
                        effect: createDefaultEffect(change.target.value as ScenarioEventEffect["type"], armies, zones),
                      })}
                    >
                      <option value="DeployReinforcements">{text("Posiłki", "Reinforcements")}</option>
                      <option value="SpawnUnits">{text("Pojawienie jednostek", "Spawn units")}</option>
                      <option value="ChangeObjective">{text("Zmiana celu", "Change objective")}</option>
                      <option value="PlaceObject">{text("Postawienie obiektu", "Place object")}</option>
                      <option value="ChangeAIProfile">{text("Zmiana profilu AI", "Change AI profile")}</option>
                      <option value="ShowMessage">{text("Komunikat fabularny", "Story message")}</option>
                      <option value="Victory">{text("Zwycięstwo", "Victory")}</option>
                      <option value="Defeat">{text("Porażka", "Defeat")}</option>
                    </select>
                  </label>
                </div>
                <TriggerEditor trigger={event.trigger} armies={armies} zones={zones} onChange={(trigger) => updateEvent(event.id, { ...event, trigger })} />
                <EffectEditor effect={event.effect} armies={armies} zones={zones} onChange={(effect) => updateEvent(event.id, { ...event, effect })} />
                <label>
                  {text("Zapowiedź", "Visibility")}
                  <select value={event.visibility} onChange={(change) => updateEvent(event.id, { ...event, visibility: change.target.value as ScenarioScheduledEvent["visibility"] })}>
                    <option value="Announced">{text("Widoczna od początku", "Visible from the start")}</option>
                    <option value="Hidden">{text("Ukryta do aktywacji", "Hidden until triggered")}</option>
                  </select>
                </label>
                <button className="dangerButton scenarioEventRemove" type="button" onClick={() => onChange?.(events.filter((candidate) => candidate.id !== event.id))}>
                  {text("Usuń zdarzenie", "Delete event")}
                </button>
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}

function TriggerEditor({ trigger, armies, zones, onChange }: {
  trigger: ScenarioEventTrigger;
  armies: Army[];
  zones: ScenarioZone[];
  onChange: (trigger: ScenarioEventTrigger) => void;
}) {
  const { text } = useI18n();
  if (isRoundTrigger(trigger)) return (
    <label>{text("Runda", "Round")}<input min={1} type="number" value={trigger.round} onChange={(event) => onChange({ ...trigger, round: positiveInteger(event.target.value) })} /></label>
  );
  if (trigger.type === "ObjectDestroyed") return (
    <label>{text("Typ obiektu", "Object type")}<select value={trigger.objectType ?? "Generator"} onChange={(event) => onChange({ type: "ObjectDestroyed", objectType: event.target.value as BattlefieldObjectType })}>{objectTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
  );
  if (trigger.type === "UnitEnteredZone") return (
    <div className="scenarioEventFieldGrid">
      <ZoneSelect zones={zones} value={trigger.zoneId} onChange={(zoneId) => onChange({ ...trigger, zoneId })} />
      <ArmySelect armies={armies} optional value={trigger.armyId} onChange={(armyId) => onChange({ ...trigger, armyId: armyId || undefined })} />
    </div>
  );
  if (trigger.type === "ArmyStrengthBelow") return (
    <div className="scenarioEventFieldGrid">
      <ArmySelect armies={armies} value={trigger.armyId} onChange={(armyId) => onChange({ ...trigger, armyId })} />
      <label>{text("Próg siły (%)", "Strength threshold (%)")}<input min={0} max={100} type="number" value={trigger.percentage} onChange={(event) => onChange({ ...trigger, percentage: percentage(event.target.value) })} /></label>
    </div>
  );
  return (
    <ArmySelect armies={armies} optional value={trigger.armyId} onChange={(armyId) => onChange({ ...trigger, armyId: armyId || undefined })} />
  );
}

function EffectEditor({ effect, armies, zones, onChange }: {
  effect: ScenarioEventEffect;
  armies: Army[];
  zones: ScenarioZone[];
  onChange: (effect: ScenarioEventEffect) => void;
}) {
  const { text } = useI18n();
  if (effect.type === "DeployReinforcements" || effect.type === "SpawnUnits") {
    return <UnitWaveEditor effect={effect} armies={armies} zones={zones} onChange={onChange} />;
  }
  if (effect.type === "ChangeAIProfile") return (
    <div className="scenarioEventFieldGrid">
      <ArmySelect armies={armies} value={effect.armyId} onChange={(armyId) => onChange({ ...effect, armyId })} />
      <label>{text("Profil AI", "AI profile")}<select value={effect.profile} onChange={(event) => onChange({ ...effect, profile: event.target.value as typeof effect.profile })}>{profileIds.map((profile) => <option key={profile} value={profile}>{profile}</option>)}</select></label>
    </div>
  );
  if (effect.type === "ChangeObjective") return (
    <><label>{text("Nowy cel", "New objective")}<input value={effect.name} onChange={(event) => onChange({ ...effect, name: event.target.value })} /></label><label>{text("Opis celu", "Objective description")}<textarea value={effect.description} onChange={(event) => onChange({ ...effect, description: event.target.value })} /></label></>
  );
  if (effect.type === "PlaceObject") return (
    <div className="scenarioEventFieldGrid">
      <label>{text("Typ obiektu", "Object type")}<select value={effect.object.type} onChange={(event) => onChange({ type: "PlaceObject", object: { ...createBattlefieldObject(event.target.value as BattlefieldObjectType, effect.object.position), id: effect.object.id } })}>{objectTypes.map((type) => <option key={type}>{type}</option>)}</select></label>
      <label>{text("Nazwa obiektu", "Object name")}<input value={effect.object.name} onChange={(event) => onChange({ ...effect, object: { ...effect.object, name: event.target.value } })} /></label>
      <label>X<input min={0} type="number" value={effect.object.position.x} onChange={(event) => onChange({ ...effect, object: { ...effect.object, position: { ...effect.object.position, x: nonNegativeInteger(event.target.value) } } })} /></label>
      <label>Y<input min={0} type="number" value={effect.object.position.y} onChange={(event) => onChange({ ...effect, object: { ...effect.object, position: { ...effect.object.position, y: nonNegativeInteger(event.target.value) } } })} /></label>
    </div>
  );
  return (
    <label>{effect.type === "ShowMessage" ? text("Treść komunikatu", "Message") : text("Komunikat końcowy", "Completion message")}<textarea value={effect.message} onChange={(event) => onChange({ ...effect, message: event.target.value })} /></label>
  );
}

function UnitWaveEditor({ effect, armies, zones, onChange }: {
  effect: Extract<ScenarioEventEffect, { type: "DeployReinforcements" | "SpawnUnits" }>;
  armies: Army[];
  zones: ScenarioZone[];
  onChange: (effect: ScenarioEventEffect) => void;
}) {
  const { language, text } = useI18n();
  const army = armies.find((candidate) => candidate.id === effect.armyId) ?? armies[0];
  const templates = unitTemplates.filter((template) => template.faction === army?.faction);
  const updateArmy = (armyId: string) => {
    const nextArmy = armies.find((candidate) => candidate.id === armyId);
    const nextTemplates = unitTemplates.filter((template) => template.faction === nextArmy?.faction);
    const units = effect.units.filter((unit) => nextTemplates.some((template) => template.id === unit.templateId));
    onChange({ ...effect, armyId, units: units.length ? units : nextTemplates[0] ? [{ templateId: nextTemplates[0].id, count: 1 }] : [] });
  };
  return <>
    <div className="scenarioEventFieldGrid">
      <ArmySelect armies={armies} value={effect.armyId} onChange={updateArmy} />
      {effect.type === "SpawnUnits" ? <ZoneSelect zones={zones} optional value={effect.zoneId} onChange={(zoneId) => onChange({ ...effect, zoneId: zoneId || undefined })} /> : null}
    </div>
    <div className="scenarioEventUnitsHeader"><strong>{text("Jednostki", "Units")}</strong><button className="secondaryButton" disabled={!templates[0]} type="button" onClick={() => templates[0] && onChange({ ...effect, units: [...effect.units, { templateId: templates[0].id, count: 1 }] })}>+ {text("Jednostka", "Unit")}</button></div>
    <div className="scenarioEventUnits">
      {effect.units.map((unit, index) => <div className="scenarioEventUnitRow" key={`${index}-${unit.templateId}`}>
        <select aria-label={`${text("Typ jednostki", "Unit type")} ${index + 1}`} value={unit.templateId} onChange={(event) => onChange({ ...effect, units: effect.units.map((candidate, unitIndex) => unitIndex === index ? { ...candidate, templateId: event.target.value } : candidate) })}>{templates.map((template) => <option key={template.id} value={template.id}>{localizeUnitName(language, template.id, template.name)}</option>)}</select>
        <input aria-label={`${text("Liczba jednostek", "Unit count")} ${index + 1}`} min={1} type="number" value={unit.count} onChange={(event) => onChange({ ...effect, units: effect.units.map((candidate, unitIndex) => unitIndex === index ? { ...candidate, count: positiveInteger(event.target.value) } : candidate) })} />
        <button aria-label={`${text("Usuń jednostkę", "Remove unit")} ${index + 1}`} className="dangerButton" type="button" onClick={() => onChange({ ...effect, units: effect.units.filter((_, unitIndex) => unitIndex !== index) })}>×</button>
      </div>)}
    </div>
  </>;
}

function ArmySelect({ armies, value, optional = false, onChange }: { armies: Army[]; value?: string; optional?: boolean; onChange: (armyId: string) => void }) {
  const { language, text } = useI18n();
  return <label>{text("Armia", "Army")}<select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>{optional ? <option value="">{text("Dowolna", "Any")}</option> : null}{armies.map((army) => <option key={army.id} value={army.id}>{army.playerName} · {localizeFaction(language, army.faction)}</option>)}</select></label>;
}

function ZoneSelect({ zones, value, optional = false, onChange }: { zones: ScenarioZone[]; value?: string; optional?: boolean; onChange: (zoneId: string) => void }) {
  const { text } = useI18n();
  return <label>{text("Strefa", "Zone")}<select value={value ?? ""} onChange={(event) => onChange(event.target.value)}>{optional ? <option value="">{text("Bezpośrednio do rezerwy", "Directly to reserve")}</option> : null}{zones.map((zone) => <option key={zone.id} value={zone.id}>{zone.id}</option>)}</select></label>;
}

function createDefaultTrigger(type: ScenarioEventTrigger["type"], armies: Army[], zones: ScenarioZone[]): ScenarioEventTrigger {
  if (type === "RoundStarted" || type === "RoundEnded") return { type, round: 2 };
  if (type === "UnitDestroyed") return { type };
  if (type === "ObjectDestroyed") return { type, objectType: "Generator" };
  if (type === "UnitEnteredZone") return { type, zoneId: zones[0]?.id ?? "" };
  if (type === "TerritoryCaptured") return { type };
  return { type, armyId: armies[0]?.id ?? "", percentage: 50 };
}

function createDefaultEffect(type: ScenarioEventEffect["type"], armies: Army[], zones: ScenarioZone[]): ScenarioEventEffect {
  const army = armies[0];
  const template = unitTemplates.find((candidate) => candidate.faction === army?.faction);
  const units = template ? [{ templateId: template.id, count: 1 }] : [];
  if (type === "DeployReinforcements") return { type, armyId: army?.id ?? "", units };
  if (type === "SpawnUnits") return { type, armyId: army?.id ?? "", units, zoneId: zones[0]?.id };
  if (type === "ChangeObjective") return { type, name: "Nowy cel", description: "Wykonaj nowy cel misji." };
  if (type === "PlaceObject") return { type, object: { ...createBattlefieldObject("Generator", { x: 0, y: 0 }), id: crypto.randomUUID() } };
  if (type === "ChangeAIProfile") return { type, armyId: army?.id ?? "", profile: "objective" };
  if (type === "ShowMessage") return { type, message: "Nowe wydarzenie na polu bitwy." };
  if (type === "Victory") return { type, message: "Cel misji został wykonany." };
  return { type, message: "Misja zakończyła się niepowodzeniem." };
}

function compareEvents(left: ScenarioScheduledEvent, right: ScenarioScheduledEvent): number {
  return triggerRound(left.trigger) - triggerRound(right.trigger) || triggerOrder(left.trigger) - triggerOrder(right.trigger) || left.name.localeCompare(right.name);
}

function triggerRound(trigger: ScenarioEventTrigger): number { return isRoundTrigger(trigger) ? trigger.round : Number.MAX_SAFE_INTEGER; }
function triggerOrder(trigger: ScenarioEventTrigger): number { return ["RoundStarted", "RoundEnded", "UnitDestroyed", "ObjectDestroyed", "UnitEnteredZone", "TerritoryCaptured", "ArmyStrengthBelow"].indexOf(trigger.type); }
function isRoundTrigger(trigger: ScenarioEventTrigger): trigger is Extract<ScenarioEventTrigger, { type: "RoundStarted" | "RoundEnded" }> { return trigger.type === "RoundStarted" || trigger.type === "RoundEnded"; }

function formatTrigger(trigger: ScenarioEventTrigger, language: Language): string {
  if (trigger.type === "RoundStarted" || trigger.type === "RoundEnded") return language === "en" ? `${trigger.type === "RoundStarted" ? "Start" : "End"} of round ${trigger.round}` : `${trigger.type === "RoundStarted" ? "Początek" : "Koniec"} rundy ${trigger.round}`;
  const labels = language === "en"
    ? { UnitDestroyed: "Unit destroyed", ObjectDestroyed: "Object destroyed", UnitEnteredZone: "Unit enters zone", TerritoryCaptured: "Territory captured", ArmyStrengthBelow: "Army strength threshold" }
    : { UnitDestroyed: "Zniszczenie jednostki", ObjectDestroyed: "Zniszczenie obiektu", UnitEnteredZone: "Wejście do strefy", TerritoryCaptured: "Przejęcie terytorium", ArmyStrengthBelow: "Spadek siły armii" };
  return labels[trigger.type];
}

function formatEffect(effect: ScenarioEventEffect, armies: Army[], language: Language): string {
  if (effect.type === "DeployReinforcements" || effect.type === "SpawnUnits") {
    const army = armies.find((candidate) => candidate.id === effect.armyId);
    const units = effect.units.map((unit) => `${unitTemplates.find((candidate) => candidate.id === unit.templateId)?.name ?? unit.templateId} ×${unit.count}`).join(", ");
    return `${army?.playerName ?? (language === "pl" ? "Nieznana armia" : "Unknown army")}: ${units}`;
  }
  if (effect.type === "ChangeAIProfile") return `${effect.armyId}: ${effect.profile}`;
  if (effect.type === "ChangeObjective") return effect.name;
  if (effect.type === "PlaceObject") return effect.object.name;
  return effect.message;
}

function effectLabel(effect: ScenarioEventEffect, language: Language): string {
  const labels = language === "en"
    ? { DeployReinforcements: "Reinforcements", SpawnUnits: "Spawn", ChangeObjective: "Objective", PlaceObject: "Object", ChangeAIProfile: "AI profile", ShowMessage: "Message", Victory: "Victory", Defeat: "Defeat" }
    : { DeployReinforcements: "Posiłki", SpawnUnits: "Jednostki", ChangeObjective: "Cel", PlaceObject: "Obiekt", ChangeAIProfile: "Profil AI", ShowMessage: "Komunikat", Victory: "Zwycięstwo", Defeat: "Porażka" };
  return labels[effect.type];
}

function positiveInteger(value: string): number { return Math.max(1, Math.floor(Number(value) || 1)); }
function nonNegativeInteger(value: string): number { return Math.max(0, Math.floor(Number(value) || 0)); }
function percentage(value: string): number { return Math.min(100, Math.max(0, Number(value) || 0)); }
