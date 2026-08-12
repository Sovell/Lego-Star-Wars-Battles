import { unitTemplates } from "../../data";
import type { ScenarioScheduledEvent } from "../../core/scenario/scenario-types";
import type { Army } from "../../types";
import {
  localizeEventName,
  localizeFaction,
  localizeUnitName,
  useI18n,
  type Language,
} from "../../i18n";
import "./ScenarioEventsPanel.css";

export function ScenarioEventsPanel({
  armies,
  currentRound,
  editable,
  events,
  resolvedEventIds = [],
  onChange,
}: {
  armies: Army[];
  currentRound: number;
  editable: boolean;
  events: ScenarioScheduledEvent[];
  resolvedEventIds?: string[];
  onChange?: (events: ScenarioScheduledEvent[]) => void;
}) {
  const { language, text } = useI18n();
  if (!editable) {
    if (events.length === 0) return null;
    const resolved = new Set(resolvedEventIds);
    const upcoming = events
      .filter((event) => !resolved.has(event.id))
      .sort(compareEvents);

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
                    <small>{formatTrigger(event, language)}</small>
                  </div>
                  <p>
                    {announced
                      ? formatReinforcements(event, armies, language)
                      : text("Szczegóły pozostają ukryte.", "Details remain hidden.")}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="scenarioEventsEmpty">{text("Wszystkie zaplanowane wydarzenia już nastąpiły.", "All scheduled events have already occurred.")}</p>
        )}
        {upcoming.some((event) => event.trigger.round < currentRound) ? (
          <small className="scenarioEventWarning">
            {text("Niewykonane zdarzenie ma termin wcześniejszy niż bieżąca runda.", "An unresolved event was scheduled before the current round.")}
          </small>
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
    const eventIndex = events.length + 1;
    onChange?.([...events, {
      id: crypto.randomUUID(),
      name: `${text("Fala wsparcia", "Reinforcement wave")} ${eventIndex}`,
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
          <small>{text("Fale wsparcia uruchamiane między rundami.", "Reinforcement waves triggered between rounds.")}</small>
        </div>
        <button
          className="secondaryButton"
          disabled={armies.length === 0}
          type="button"
          onClick={addEvent}
        >
          + {text("Dodaj", "Add")}
        </button>
      </div>
      {events.length === 0 ? (
        <p className="scenarioEventsEmpty">{text("Brak zaplanowanych zdarzeń.", "No scheduled events.")}</p>
      ) : (
        <div className="scenarioEventList">
          {[...events].sort(compareEvents).map((event) => {
            const army = armies.find((candidate) => candidate.id === event.effect.armyId);
            const availableTemplates = unitTemplates.filter(
              (template) => template.faction === army?.faction,
            );
            return (
              <details className="scenarioEventCard" key={event.id}>
                <summary>
                  <span>
                    <strong>{localizeEventName(language, event.id, event.name)}</strong>
                    <small>{formatTrigger(event, language)}</small>
                  </span>
                  <span className="scenarioEventBadge">{text("Wsparcie", "Reinforcements")}</span>
                </summary>
                <div className="scenarioEventEditor">
                  <label>
                    {text("Nazwa", "Name")}
                    <input
                      value={event.name}
                      onChange={(change) => updateEvent(event.id, {
                        ...event,
                        name: change.target.value,
                      })}
                    />
                  </label>
                  <div className="scenarioEventFieldGrid">
                    <label>
                      {text("Moment", "Timing")}
                      <select
                        value={event.trigger.type}
                        onChange={(change) => updateEvent(event.id, {
                          ...event,
                          trigger: {
                            ...event.trigger,
                            type: change.target.value as ScenarioScheduledEvent["trigger"]["type"],
                          },
                        })}
                      >
                        <option value="RoundStarted">{text("Początek rundy", "Round start")}</option>
                        <option value="RoundEnded">{text("Koniec rundy", "Round end")}</option>
                      </select>
                    </label>
                    <label>
                      {text("Runda", "Round")}
                      <input
                        min={1}
                        type="number"
                        value={event.trigger.round}
                        onChange={(change) => updateEvent(event.id, {
                          ...event,
                          trigger: {
                            ...event.trigger,
                            round: Math.max(1, Math.floor(Number(change.target.value) || 1)),
                          },
                        })}
                      />
                    </label>
                  </div>
                  <label>
                    {text("Armia", "Army")}
                    <select
                      value={event.effect.armyId}
                      onChange={(change) => {
                        const nextArmy = armies.find((candidate) => candidate.id === change.target.value);
                        const nextTemplates = unitTemplates.filter(
                          (template) => template.faction === nextArmy?.faction,
                        );
                        const legalUnits = event.effect.units.filter((unit) =>
                          nextTemplates.some((template) => template.id === unit.templateId)
                        );
                        updateEvent(event.id, {
                          ...event,
                          effect: {
                            ...event.effect,
                            armyId: change.target.value,
                            units: legalUnits.length > 0
                              ? legalUnits
                              : nextTemplates[0]
                                ? [{ templateId: nextTemplates[0].id, count: 1 }]
                                : [],
                          },
                        });
                      }}
                    >
                      {armies.map((candidate) => (
                        <option key={candidate.id} value={candidate.id}>
                          {candidate.playerName} · {localizeFaction(language, candidate.faction)}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    {text("Zapowiedź", "Visibility")}
                    <select
                      value={event.visibility}
                      onChange={(change) => updateEvent(event.id, {
                        ...event,
                        visibility: change.target.value as ScenarioScheduledEvent["visibility"],
                      })}
                    >
                      <option value="Announced">{text("Widoczna od początku", "Visible from the start")}</option>
                      <option value="Hidden">{text("Ukryta do aktywacji", "Hidden until triggered")}</option>
                    </select>
                  </label>
                  <div className="scenarioEventUnitsHeader">
                    <strong>{text("Jednostki", "Units")}</strong>
                    <button
                      className="secondaryButton"
                      disabled={availableTemplates.length === 0}
                      type="button"
                      onClick={() => availableTemplates[0] && updateEvent(event.id, {
                        ...event,
                        effect: {
                          ...event.effect,
                          units: [
                            ...event.effect.units,
                            { templateId: availableTemplates[0].id, count: 1 },
                          ],
                        },
                      })}
                    >
                      + {text("Jednostka", "Unit")}
                    </button>
                  </div>
                  <div className="scenarioEventUnits">
                    {event.effect.units.map((unit, unitIndex) => (
                      <div className="scenarioEventUnitRow" key={`${unitIndex}-${unit.templateId}`}>
                        <select
                          aria-label={`${text("Jednostka wsparcia", "Reinforcement unit")} ${unitIndex + 1}`}
                          value={unit.templateId}
                          onChange={(change) => updateEvent(event.id, {
                            ...event,
                            effect: {
                              ...event.effect,
                              units: event.effect.units.map((candidate, index) =>
                                index === unitIndex
                                  ? { ...candidate, templateId: change.target.value }
                                  : candidate
                              ),
                            },
                          })}
                        >
                          {availableTemplates.map((template) => (
                            <option key={template.id} value={template.id}>{localizeUnitName(language, template.id, template.name)}</option>
                          ))}
                        </select>
                        <input
                          aria-label={`${text("Liczba jednostek wsparcia", "Reinforcement unit count")} ${unitIndex + 1}`}
                          min={1}
                          type="number"
                          value={unit.count}
                          onChange={(change) => updateEvent(event.id, {
                            ...event,
                            effect: {
                              ...event.effect,
                              units: event.effect.units.map((candidate, index) =>
                                index === unitIndex
                                  ? {
                                      ...candidate,
                                      count: Math.max(1, Math.floor(Number(change.target.value) || 1)),
                                    }
                                  : candidate
                              ),
                            },
                          })}
                        />
                        <button
                          aria-label={`${text("Usuń jednostkę wsparcia", "Remove reinforcement unit")} ${unitIndex + 1}`}
                          className="dangerButton"
                          type="button"
                          onClick={() => updateEvent(event.id, {
                            ...event,
                            effect: {
                              ...event.effect,
                              units: event.effect.units.filter((_, index) => index !== unitIndex),
                            },
                          })}
                        >
                          ×
                        </button>
                      </div>
                    ))}
                    {event.effect.units.length === 0 ? (
                      <small className="scenarioEventWarning">
                        {text("Dodaj przynajmniej jedną jednostkę, aby uruchomić scenariusz.", "Add at least one unit before starting the scenario.")}
                      </small>
                    ) : null}
                  </div>
                  <button
                    className="dangerButton scenarioEventRemove"
                    type="button"
                    onClick={() => onChange?.(events.filter((candidate) => candidate.id !== event.id))}
                  >
                    {text("Usuń zdarzenie", "Delete event")}
                  </button>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </section>
  );
}

function compareEvents(left: ScenarioScheduledEvent, right: ScenarioScheduledEvent): number {
  return left.trigger.round - right.trigger.round ||
    triggerOrder(left) - triggerOrder(right) ||
    left.name.localeCompare(right.name);
}

function triggerOrder(event: ScenarioScheduledEvent): number {
  return event.trigger.type === "RoundStarted" ? 0 : 1;
}

function formatTrigger(event: ScenarioScheduledEvent, language: Language): string {
  if (language === "en") {
    return `${event.trigger.type === "RoundStarted" ? "Start" : "End"} of round ${event.trigger.round}`;
  }
  return `${event.trigger.type === "RoundStarted" ? "Początek" : "Koniec"} rundy ${event.trigger.round}`;
}

function formatReinforcements(event: ScenarioScheduledEvent, armies: Army[], language: Language): string {
  const army = armies.find((candidate) => candidate.id === event.effect.armyId);
  const units = event.effect.units.map((unit) => {
    const template = unitTemplates.find((candidate) => candidate.id === unit.templateId);
    return `${template ? localizeUnitName(language, template.id, template.name) : unit.templateId} ×${unit.count}`;
  }).join(", ");
  return `${army?.playerName ?? (language === "pl" ? "Nieznana armia" : "Unknown army")}: ${units || (language === "pl" ? "brak jednostek" : "no units")}`;
}
