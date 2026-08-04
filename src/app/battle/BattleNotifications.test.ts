import { describe, expect, it } from "vitest";
import type { AttackResult, ObjectAttackResult } from "../../types";
import {
  createObjectAttackNotification,
  createUnitAttackNotification,
} from "./BattleNotifications";

const attackResult: AttackResult = {
  attackerId: "attacker",
  defenderId: "defender",
  defenderPosition: { x: 2, y: 3 },
  weaponName: "Karabin blasterowy",
  hitRolls: [6, 4, 1],
  armorRolls: [2, 6],
  hits: 2,
  unsavedHits: 1,
  damage: 1,
  suppression: 1,
  destroyed: false,
};

describe("battle notifications", () => {
  it("summarizes a damaging unit attack", () => {
    const notification = createUnitAttackNotification(
      1,
      attackResult,
      "Clone Troopers",
      "B1 Droids",
    );

    expect(notification).toMatchObject({
      id: 1,
      tone: "success",
      title: "B1 Droids traci 1 PW",
    });
    expect(notification.detail).toContain("2 traf., 1 przeb., 1 obraż.");
  });

  it("distinguishes attacks that deal no damage", () => {
    const notification = createUnitAttackNotification(
      2,
      { ...attackResult, damage: 0, unsavedHits: 0 },
      "Clone Troopers",
      "B1 Droids",
    );

    expect(notification).toMatchObject({ tone: "neutral", title: "Atak odparty" });
  });

  it("marks destroyed battlefield objects as dangerous outcomes", () => {
    const objectResult: ObjectAttackResult = {
      attackerId: "attacker",
      objectId: "generator",
      objectType: "Generator",
      objectPosition: { x: 4, y: 4 },
      weaponName: "Działo laserowe",
      hitRolls: [6],
      armorRolls: [],
      hits: 1,
      unsavedHits: 1,
      damage: 3,
      destroyed: true,
    };

    expect(createObjectAttackNotification(3, objectResult, "AT-TE", "Generator"))
      .toMatchObject({
        tone: "danger",
        title: "Generator zniszczony",
      });
  });
});
