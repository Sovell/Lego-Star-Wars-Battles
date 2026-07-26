import type { ReactNode } from "react";

export function BattleActionBar({ children }: { children: ReactNode }) {
  return (
    <section className="battleActionBar" aria-label="Rozkazy aktywnej jednostki">
      <div className="battleActionBarContent">{children}</div>
    </section>
  );
}
