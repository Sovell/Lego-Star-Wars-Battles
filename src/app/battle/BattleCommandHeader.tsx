import type { ReactNode } from "react";

export type BattleCommandProgress = {
  current: number;
  label: string;
  total: number;
};

export function BattleCommandHeader({
  actions,
  activeDetail,
  activeLabel,
  activeName,
  activeTone = "neutral",
  objective,
  objectiveLabel,
  phase,
  phaseLabel,
  progress,
  title,
  turn,
  turnLabel,
}: {
  actions?: ReactNode;
  activeDetail: string;
  activeLabel: string;
  activeName: string;
  activeTone?: "neutral" | "republic" | "separatists";
  objective: string;
  objectiveLabel: string;
  phase: string;
  phaseLabel: string;
  progress?: BattleCommandProgress;
  title: string;
  turn: number;
  turnLabel: string;
}) {
  const progressValue = progress
    ? Math.max(0, Math.min(progress.current, progress.total))
    : 0;

  return (
    <header className="battleCommandHeader">
      <div className="battleCommandIdentity">
        <span>LEGO Star Wars Battles</span>
        <strong>{title}</strong>
      </div>
      <div className="battleCommandTurn">
        <span>{turnLabel}</span>
        <strong>{String(turn).padStart(2, "0")}</strong>
      </div>
      <div className="battleCommandPhase">
        <span>{phaseLabel}</span>
        <strong>{phase}</strong>
      </div>
      <div className="battleCommandForce" data-tone={activeTone}>
        <span>{activeLabel}</span>
        <strong>{activeName}</strong>
        <small>{activeDetail}</small>
      </div>
      <div className="battleCommandObjective">
        <span>{objectiveLabel}</span>
        <strong>{objective}</strong>
        {progress ? (
          <div className="battleCommandProgress">
            <progress
              aria-label={progress.label}
              max={Math.max(1, progress.total)}
              value={progressValue}
            />
            <small>{progress.label} {progressValue}/{progress.total}</small>
          </div>
        ) : null}
      </div>
      {actions ? <div className="battleCommandActions">{actions}</div> : null}
    </header>
  );
}
