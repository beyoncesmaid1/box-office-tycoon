export type Seed = string | number;

export interface RandomSource {
  next(): number;
}

function hashSeed(seed: Seed): number {
  if (typeof seed === "number" && Number.isFinite(seed)) return seed >>> 0;
  let hash = 2166136261;
  for (const character of String(seed)) {
    hash ^= character.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

export function createSeededRng(seed: Seed): RandomSource {
  let state = hashSeed(seed) || 0x6d2b79f5;
  return {
    next() {
      state += 0x6d2b79f5;
      let value = state;
      value = Math.imul(value ^ (value >>> 15), value | 1);
      value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
      return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296;
    },
  };
}

export const systemRng: RandomSource = { next: () => Math.random() };

export function uniform(rng: RandomSource, minimum = 0, maximum = 1): number {
  return minimum + (maximum - minimum) * rng.next();
}

export function normal(rng: RandomSource, mean = 0, standardDeviation = 1): number {
  const first = Math.max(Number.EPSILON, rng.next());
  const second = rng.next();
  return mean + standardDeviation * Math.sqrt(-2 * Math.log(first)) * Math.cos(2 * Math.PI * second);
}

export function chance(rng: RandomSource, probability: number): boolean {
  return rng.next() < Math.max(0, Math.min(1, probability));
}

export function correlatedNormals(rng: RandomSource, correlation: number): readonly [number, number] {
  const shared = normal(rng);
  const firstIndependent = normal(rng);
  const secondIndependent = normal(rng);
  const boundedCorrelation = Math.max(0, Math.min(0.99, correlation));
  const sharedWeight = Math.sqrt(boundedCorrelation);
  const independentWeight = Math.sqrt(1 - boundedCorrelation);
  return [
    sharedWeight * shared + independentWeight * firstIndependent,
    sharedWeight * shared + independentWeight * secondIndependent,
  ];
}
