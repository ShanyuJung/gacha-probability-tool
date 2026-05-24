export type Settings = {
  baseRate: number;
  plannedPulls: number;
  currentPity: number;
  hardPity: number;
  targetCopies: number;
  usePity: boolean;
};

export type DistributionPoint = {
  copies: number;
  probability: number;
};

export const MAX_PULLS = 100000;
export const MAX_PITY = 100000;
export const MAX_TOTAL_PULLS = MAX_PULLS + MAX_PITY;
export const MAX_TARGET_COPIES = 20;
export const MAX_RATE = 100;

export const defaultSettings: Settings = {
  baseRate: 0.7,
  plannedPulls: 10,
  currentPity: 20,
  hardPity: 200,
  targetCopies: 1,
  usePity: true,
};

export function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

export function normalizeSettings(settings: Settings): Settings {
  return {
    ...settings,
    baseRate: clampNumber(settings.baseRate, 0, MAX_RATE),
    plannedPulls: Math.floor(clampNumber(settings.plannedPulls, 0, MAX_PULLS)),
    currentPity: Math.floor(clampNumber(settings.currentPity, 0, MAX_PULLS)),
    hardPity: Math.floor(clampNumber(settings.hardPity, 1, MAX_PITY)),
    targetCopies: Math.floor(
      clampNumber(settings.targetCopies, 1, MAX_TARGET_COPIES),
    ),
  };
}

export function formatPercent(
  value: number,
  digits = 2,
  options: { allowExactOne?: boolean; compactUpperBound?: boolean } = {},
) {
  const boundedValue = clampNumber(value, 0, 1);
  const percent = boundedValue * 100;
  const smallestDisplayStep = 10 ** -digits;

  if (options.allowExactOne) {
    return '100%';
  }

  if (boundedValue > 0 && percent < smallestDisplayStep) {
    return `<${smallestDisplayStep.toFixed(digits)}%`;
  }

  if (
    (!options.allowExactOne && boundedValue >= 1) ||
    (boundedValue < 1 && 100 - percent < smallestDisplayStep)
  ) {
    if (options.compactUpperBound) {
      return '>99%';
    }

    return `>${(100 - smallestDisplayStep).toFixed(digits)}%`;
  }

  return `${percent.toFixed(digits)}%`;
}

function createBuckets(targetCopies: number): DistributionPoint[] {
  return Array.from({ length: targetCopies + 1 }, (_, copies) => ({
    copies,
    probability: 0,
  }));
}

function calculateNoPityDistribution(
  pullCount: number,
  targetCopies: number,
  baseChance: number,
): DistributionPoint[] {
  const buckets = createBuckets(targetCopies);

  if (pullCount === 0 || baseChance === 0) {
    buckets[0].probability = 1;
    return buckets;
  }

  if (baseChance === 1) {
    buckets[Math.min(pullCount, targetCopies)].probability = 1;
    return buckets;
  }

  const failChance = 1 - baseChance;
  let exactProbability = failChance ** pullCount;
  let accumulatedProbability = exactProbability;
  buckets[0].probability = exactProbability;

  for (let copies = 1; copies < targetCopies; copies += 1) {
    exactProbability *=
      ((pullCount - copies + 1) / copies) * (baseChance / failChance);
    buckets[copies].probability = exactProbability;
    accumulatedProbability += exactProbability;
  }

  buckets[targetCopies].probability = Math.min(
    Math.max(1 - accumulatedProbability, 0),
    1 - Number.EPSILON,
  );
  return buckets;
}

function calculatePityDistribution(
  pullCount: number,
  targetCopies: number,
  baseChance: number,
  hardPity: number,
): DistributionPoint[] {
  const buckets = createBuckets(targetCopies);

  if (pullCount === 0) {
    buckets[0].probability = 1;
    return buckets;
  }

  if (Math.floor(pullCount / hardPity) >= targetCopies) {
    buckets[targetCopies].probability = 1;
    return buckets;
  }

  if (baseChance === 0) {
    for (let copies = 0; copies < targetCopies; copies += 1) {
      buckets[copies].probability =
        Math.floor(pullCount / hardPity) === copies ? 1 : 0;
    }
    buckets[targetCopies].probability =
      Math.floor(pullCount / hardPity) >= targetCopies ? 1 : 0;
    return buckets;
  }

  if (baseChance === 1) {
    buckets[Math.min(pullCount, targetCopies)].probability = 1;
    return buckets;
  }

  const failChance = 1 - baseChance;
  const pityFailWeight = failChance ** (hardPity - 1);
  const cumulativeHitChances = [1];
  let previous = new Float64Array(pullCount + 1);
  previous[0] = 1;

  for (let copies = 1; copies <= targetCopies; copies += 1) {
    const next = new Float64Array(pullCount + 1);
    let geometricWindow = 0;
    let cumulativeChance = 0;

    for (let pull = 1; pull <= pullCount; pull += 1) {
      geometricWindow =
        failChance * geometricWindow + baseChance * previous[pull - 1];

      if (pull - hardPity >= 0) {
        geometricWindow -=
          baseChance * pityFailWeight * previous[pull - hardPity];
        next[pull] =
          geometricWindow + pityFailWeight * previous[pull - hardPity];
      } else {
        next[pull] = geometricWindow;
      }

      cumulativeChance += next[pull];
    }

    cumulativeHitChances[copies] = Math.min(Math.max(cumulativeChance, 0), 1);
    previous = next;
  }

  for (let copies = 0; copies < targetCopies; copies += 1) {
    buckets[copies].probability = Math.max(
      cumulativeHitChances[copies] - cumulativeHitChances[copies + 1],
      0,
    );
  }
  buckets[targetCopies].probability = cumulativeHitChances[targetCopies];

  return buckets;
}

export function calculateDistribution(settings: Settings): DistributionPoint[] {
  const targetCopies = Math.floor(
    clampNumber(settings.targetCopies, 1, MAX_TARGET_COPIES),
  );
  const plannedPulls = Math.floor(
    clampNumber(settings.plannedPulls, 0, MAX_TOTAL_PULLS),
  );
  const hardPity = Math.floor(clampNumber(settings.hardPity, 1, MAX_PITY));
  const baseChance = clampNumber(settings.baseRate / 100, 0, 1);

  if (!settings.usePity) {
    return calculateNoPityDistribution(plannedPulls, targetCopies, baseChance);
  }

  return calculatePityDistribution(
    plannedPulls,
    targetCopies,
    baseChance,
    hardPity,
  );
}

export function calculateFirstHitChance(settings: Settings, pullCount: number) {
  const totalPulls = settings.currentPity + pullCount;
  const distribution = calculateDistribution({
    ...settings,
    currentPity: 0,
    plannedPulls: totalPulls,
    targetCopies: 1,
  });

  return distribution[1]?.probability ?? 0;
}

export function isAtLeastTargetGuaranteed(
  settings: Settings,
  pullCount: number,
) {
  if (pullCount < settings.targetCopies) return false;
  if (settings.baseRate >= MAX_RATE) return true;
  if (!settings.usePity) return false;

  return Math.floor(pullCount / settings.hardPity) >= settings.targetCopies;
}
