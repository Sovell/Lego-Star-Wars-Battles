export type DiceRoller = () => number;

export function randomD6(): number {
  return Math.ceil(Math.random() * 6);
}

export function createSequenceDiceRoller(rolls: number[]): DiceRoller {
  let index = 0;

  return () => {
    const roll = rolls[index];
    index += 1;

    if (!Number.isInteger(roll) || roll < 1 || roll > 6) {
      throw new Error(`Missing deterministic D6 roll at index ${index - 1}.`);
    }

    return roll;
  };
}
