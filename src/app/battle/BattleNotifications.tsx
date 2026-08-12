import type { AttackResult, ObjectAttackResult } from "../../types";
import { useI18n, type Language } from "../../i18n";

export type BattleNotification = {
  id: number;
  tone: "neutral" | "success" | "danger";
  title: string;
  detail: string;
};

export function createUnitAttackNotification(
  id: number,
  result: AttackResult,
  attackerName: string,
  defenderName: string,
  language: Language = "pl",
): BattleNotification {
  const title = result.destroyed
    ? `${defenderName} ${language === "pl" ? "zniszczony" : "destroyed"}`
    : result.damage > 0
      ? `${defenderName} ${language === "pl" ? "traci" : "loses"} ${result.damage} ${language === "pl" ? "PW" : "HP"}`
      : language === "pl" ? "Atak odparty" : "Attack repelled";
  const retreat = result.retreatedTo
    ? ` ${language === "pl" ? "Odwrót na" : "Retreat to"} ${result.retreatedTo.x},${result.retreatedTo.y}.`
    : "";

  return {
    id,
    tone: result.destroyed ? "danger" : result.damage > 0 ? "success" : "neutral",
    title,
    detail: language === "pl"
      ? `${attackerName} · ${result.weaponName}: ${result.hits} traf., ${result.unsavedHits} przeb., ${result.damage} obraż.${retreat}`
      : `${attackerName} · ${result.weaponName}: ${result.hits} hits, ${result.unsavedHits} unsaved, ${result.damage} damage.${retreat}`,
  };
}

export function createObjectAttackNotification(
  id: number,
  result: ObjectAttackResult,
  attackerName: string,
  objectName: string,
  language: Language = "pl",
): BattleNotification {
  return {
    id,
    tone: result.destroyed ? "danger" : result.damage > 0 ? "success" : "neutral",
    title: result.destroyed
      ? `${objectName} ${language === "pl" ? "zniszczony" : "destroyed"}`
      : result.damage > 0
        ? `${objectName} ${language === "pl" ? "traci" : "loses"} ${result.damage} ${language === "pl" ? "PW" : "HP"}`
        : language === "pl" ? "Atak bez skutku" : "Attack ineffective",
    detail: language === "pl"
      ? `${attackerName} · ${result.weaponName}: ${result.hits} traf., ${result.unsavedHits} przeb., ${result.damage} obraż.`
      : `${attackerName} · ${result.weaponName}: ${result.hits} hits, ${result.unsavedHits} unsaved, ${result.damage} damage.`,
  };
}

export function BattleNotifications({
  notifications,
  onDismiss,
}: {
  notifications: BattleNotification[];
  onDismiss: (id: number) => void;
}) {
  const { text } = useI18n();
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="battleNotifications" aria-live="polite" aria-label={text("Komunikaty bitwy", "Battle notifications")}>
      {notifications.map((notification) => (
        <article
          className={`battleNotification ${notification.tone}`}
          key={notification.id}
        >
          <span className="battleNotificationMarker" aria-hidden="true" />
          <div>
            <strong>{notification.title}</strong>
            <small>{notification.detail}</small>
          </div>
          <button
            aria-label={text("Zamknij komunikat", "Dismiss notification")}
            onClick={() => onDismiss(notification.id)}
            type="button"
          >
            ×
          </button>
        </article>
      ))}
    </div>
  );
}
