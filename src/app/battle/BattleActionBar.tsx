import type { ReactNode } from "react";
import { useI18n } from "../../i18n";

export function BattleActionBar({ children }: { children: ReactNode }) {
  const { text } = useI18n();
  return (
    <section className="battleActionBar" aria-label={text("Rozkazy aktywnej jednostki", "Active unit orders")}>
      <div className="battleActionBarContent">{children}</div>
    </section>
  );
}
