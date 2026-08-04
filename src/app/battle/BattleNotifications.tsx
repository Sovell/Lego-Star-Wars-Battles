import type { AttackResult, ObjectAttackResult } from "../../types";

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
): BattleNotification {
  const title = result.destroyed
    ? `${defenderName} zniszczony`
    : result.damage > 0
      ? `${defenderName} traci ${result.damage} PW`
      : "Atak odparty";
  const retreat = result.retreatedTo
    ? ` Odwrót na ${result.retreatedTo.x},${result.retreatedTo.y}.`
    : "";

  return {
    id,
    tone: result.destroyed ? "danger" : result.damage > 0 ? "success" : "neutral",
    title,
    detail: `${attackerName} · ${result.weaponName}: ${result.hits} traf., ${result.unsavedHits} przeb., ${result.damage} obraż.${retreat}`,
  };
}

export function createObjectAttackNotification(
  id: number,
  result: ObjectAttackResult,
  attackerName: string,
  objectName: string,
): BattleNotification {
  return {
    id,
    tone: result.destroyed ? "danger" : result.damage > 0 ? "success" : "neutral",
    title: result.destroyed
      ? `${objectName} zniszczony`
      : result.damage > 0
        ? `${objectName} traci ${result.damage} PW`
        : "Atak bez skutku",
    detail: `${attackerName} · ${result.weaponName}: ${result.hits} traf., ${result.unsavedHits} przeb., ${result.damage} obraż.`,
  };
}

export function BattleNotifications({
  notifications,
  onDismiss,
}: {
  notifications: BattleNotification[];
  onDismiss: (id: number) => void;
}) {
  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="battleNotifications" aria-live="polite" aria-label="Komunikaty bitwy">
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
            aria-label="Zamknij komunikat"
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
