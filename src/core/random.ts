export type DiceRoller = () => number;

export type RandomSource = () => number;

export const systemRandom: RandomSource = () => Math.random();

export function randomD6(): number {
  return createD6Roller(systemRandom)();
}

export function createD6Roller(randomSource: RandomSource): DiceRoller {
  return () => Math.floor(readRandomValue(randomSource) * 6) + 1;
}

export function randomIndex(length: number, randomSource: RandomSource = systemRandom): number {
  if (!Number.isInteger(length) || length <= 0) {
    throw new Error(`Cannot choose a random index from a collection of length ${length}.`);
  }

  return Math.floor(readRandomValue(randomSource) * length);
}

export function createSeededRandomSource(seed: number): RandomSource {
  if (!Number.isInteger(seed)) {
    throw new Error("Random seed must be an integer.");
  }

  let state = seed >>> 0;

  return () => {
    state = (Math.imul(state, 1664525) + 1013904223) >>> 0;
    return state / 0x100000000;
  };
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

function readRandomValue(randomSource: RandomSource): number {
  const value = randomSource();

  if (!Number.isFinite(value) || value < 0 || value >= 1) {
    throw new Error(`Random source returned ${value}; expected a value from 0 (inclusive) to 1 (exclusive).`);
  }

  return value;
}
