import type { ReactNode } from "react";
import "../styles/battle-command-dock.css";

export type BattleCommandDockTone = "neutral" | "republic" | "separatists";

export type BattleDockCommand = {
  id: string;
  label: string;
  selected: boolean;
  disabled?: boolean;
  tone?: "default" | "danger";
  onSelect: () => void;
};

export type BattleDockAction = {
  label: string;
  detail?: string;
  disabled?: boolean;
  tone?: "primary" | "danger" | "secondary";
  onClick: () => void;
};

export function BattleCommandDock({
  activation,
  activeArmy,
  activeArmyTone = "neutral",
  activeUnit,
  activeUnitDetail,
  unitControl,
  commands,
  contextLabel,
  contextStatus,
  context,
  endTurn,
}: {
  activation: BattleDockAction;
  activeArmy: string;
  activeArmyTone?: BattleCommandDockTone;
  activeUnit: string;
  activeUnitDetail: string;
  unitControl: ReactNode;
  commands: BattleDockCommand[];
  contextLabel: string;
  contextStatus: string;
  context: ReactNode;
  endTurn: BattleDockAction;
}) {
  return (
    <section className="battleCommandDock" aria-label={contextLabel}>
      <div className="battleDockContextRow">
        <div className="battleDockActivation">
          <DockActionButton action={activation} />
          {activation.detail ? <small>{activation.detail}</small> : null}
        </div>

        <div className="battleDockUnit" data-tone={activeArmyTone}>
          <span>{activeArmy}</span>
          <strong>{activeUnit}</strong>
          <small>{activeUnitDetail}</small>
          {unitControl}
        </div>

        <div className="battleDockContext">
          <div className="battleDockContextHeader">
            <span>{contextLabel}</span>
            <strong aria-live="polite">{contextStatus}</strong>
          </div>
          <div className="battleDockContextControls">{context}</div>
        </div>
      </div>

      <div className="battleDockCommandRow" role="group" aria-label={contextLabel}>
        <div className="battleDockCommands">
          {commands.map((command) => (
            <button
              key={command.id}
              type="button"
              className="battleDockCommand"
              data-tone={command.tone ?? "default"}
              aria-pressed={command.selected}
              disabled={command.disabled}
              onClick={command.onSelect}
            >
              {command.label}
            </button>
          ))}
        </div>
        <DockActionButton action={endTurn} className="battleDockEndTurn" />
      </div>
    </section>
  );
}

function DockActionButton({
  action,
  className = "",
}: {
  action: BattleDockAction;
  className?: string;
}) {
  return (
    <button
      type="button"
      className={`battleDockAction ${className}`.trim()}
      data-tone={action.tone ?? "secondary"}
      disabled={action.disabled}
      onClick={action.onClick}
    >
      {action.label}
    </button>
  );
}
