import { unitTemplates } from "../../data";
import type { ScenarioScheduledEvent } from "../../core/scenario/scenario-types";
import type { Army } from "../../types";
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
  if (!editable) {
    if (events.length === 0) return null;
    const resolved = new Set(resolvedEventIds);
    const upcoming = events
      .filter((event) => !resolved.has(event.id))
      .sort(compareEvents);

    return (
      <section className="scenarioEventsPanel scenarioEventsTimeline">
        <div className="scenarioEventsHeader">
          <h3>Nadchodzące wydarzenia</h3>
          <span>{upcoming.length}</span>
        </div>
        {upcoming.length > 0 ? (
          <div className="scenarioEventList">
            {upcoming.slice(0, 3).map((event) => {
              const announced = event.visibility === "Announced";
              return (
                <article className="scenarioEventCard upcoming" key={event.id}>
                  <div>
                    <strong>{announced ? event.name : "Nieznane zdarzenie"}</strong>
                    <small>{formatTrigger(event)}</small>
                  </div>
                  <p>
                    {announced
                      ? formatReinforcements(event, armies)
                      : "Szczegóły pozostają ukryte."}
                  </p>
                </article>
              );
            })}
          </div>
        ) : (
          <p className="scenarioEventsEmpty">Wszystkie zaplanowane wydarzenia już nastąpiły.</p>
        )}
        {upcoming.some((event) => event.trigger.round < currentRound) ? (
          <small className="scenarioEventWarning">
            Niewykonane zdarzenie ma termin wcześniejszy niż bieżąca runda.
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
      name: `Fala wsparcia ${eventIndex}`,
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
          <h3>Zdarzenia misji</h3>
          <small>Fale wsparcia uruchamiane między rundami.</small>
        </div>
        <button
          className="secondaryButton"
          disabled={armies.length === 0}
          type="button"
          onClick={addEvent}
        >
          + Dodaj
        </button>
      </div>
      {events.length === 0 ? (
        <p className="scenarioEventsEmpty">Brak zaplanowanych zdarzeń.</p>
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
                    <strong>{event.name}</strong>
                    <small>{formatTrigger(event)}</small>
                  </span>
                  <span className="scenarioEventBadge">Wsparcie</span>
                </summary>
                <div className="scenarioEventEditor">
                  <label>
                    Nazwa
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
                      Moment
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
                        <option value="RoundStarted">Początek rundy</option>
                        <option value="RoundEnded">Koniec rundy</option>
                      </select>
                    </label>
                    <label>
                      Runda
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
                    Armia
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
                          {candidate.playerName} · {candidate.faction}
                        </option>
                      ))}
                    </select>
                  </label>
                  <label>
                    Zapowiedź
                    <select
                      value={event.visibility}
                      onChange={(change) => updateEvent(event.id, {
                        ...event,
                        visibility: change.target.value as ScenarioScheduledEvent["visibility"],
                      })}
                    >
                      <option value="Announced">Widoczna od początku</option>
                      <option value="Hidden">Ukryta do aktywacji</option>
                    </select>
                  </label>
                  <div className="scenarioEventUnitsHeader">
                    <strong>Jednostki</strong>
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
                      + Jednostka
                    </button>
                  </div>
                  <div className="scenarioEventUnits">
                    {event.effect.units.map((unit, unitIndex) => (
                      <div className="scenarioEventUnitRow" key={`${unitIndex}-${unit.templateId}`}>
                        <select
                          aria-label={`Jednostka wsparcia ${unitIndex + 1}`}
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
                            <option key={template.id} value={template.id}>{template.name}</option>
                          ))}
                        </select>
                        <input
                          aria-label={`Liczba jednostek wsparcia ${unitIndex + 1}`}
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
                          aria-label={`Usuń jednostkę wsparcia ${unitIndex + 1}`}
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
                        Dodaj przynajmniej jedną jednostkę, aby uruchomić scenariusz.
                      </small>
                    ) : null}
                  </div>
                  <button
                    className="dangerButton scenarioEventRemove"
                    type="button"
                    onClick={() => onChange?.(events.filter((candidate) => candidate.id !== event.id))}
                  >
                    Usuń zdarzenie
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

function formatTrigger(event: ScenarioScheduledEvent): string {
  return `${event.trigger.type === "RoundStarted" ? "Początek" : "Koniec"} rundy ${event.trigger.round}`;
}

function formatReinforcements(event: ScenarioScheduledEvent, armies: Army[]): string {
  const army = armies.find((candidate) => candidate.id === event.effect.armyId);
  const units = event.effect.units.map((unit) => {
    const template = unitTemplates.find((candidate) => candidate.id === unit.templateId);
    return `${template?.name ?? unit.templateId} ×${unit.count}`;
  }).join(", ");
  return `${army?.playerName ?? "Nieznana armia"}: ${units || "brak jednostek"}`;
}
