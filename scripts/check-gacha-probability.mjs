import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import ts from 'typescript';

const sourcePath = new URL('../src/utils/gachaProbability.ts', import.meta.url);
const source = await readFile(sourcePath, 'utf8');
const transpiled = ts.transpileModule(source, {
  compilerOptions: {
    module: ts.ModuleKind.ES2022,
    target: ts.ScriptTarget.ES2022,
  },
}).outputText;
const moduleUrl = `data:text/javascript;base64,${Buffer.from(transpiled).toString('base64')}`;
const { calculateDistribution, formatPercent, isAtLeastTargetGuaranteed } =
  await import(moduleUrl);

function chanceAt(settings, copies) {
  return calculateDistribution(settings)[copies]?.probability ?? 0;
}

const noPityNearGuaranteed = {
  baseRate: 0.7,
  plannedPulls: 100020,
  currentPity: 0,
  hardPity: 200,
  targetCopies: 2,
  usePity: false,
};

assert.notEqual(chanceAt(noPityNearGuaranteed, 2), 1);
assert.notEqual(
  formatPercent(chanceAt(noPityNearGuaranteed, 2), 2, {
    allowExactOne: isAtLeastTargetGuaranteed(noPityNearGuaranteed, 100020),
  }),
  '100%',
);

for (let targetCopies = 1; targetCopies <= 5; targetCopies += 1) {
  const guaranteedByPity = {
    baseRate: 0.7,
    plannedPulls: 1020,
    currentPity: 0,
    hardPity: 200,
    targetCopies,
    usePity: true,
  };

  assert.equal(isAtLeastTargetGuaranteed(guaranteedByPity, 1020), true);
  assert.equal(chanceAt(guaranteedByPity, targetCopies), 1);
}

const notGuaranteedByPity = {
  baseRate: 0.7,
  plannedPulls: 1020,
  currentPity: 0,
  hardPity: 200,
  targetCopies: 6,
  usePity: true,
};

assert.equal(isAtLeastTargetGuaranteed(notGuaranteedByPity, 1020), false);
assert.notEqual(chanceAt(notGuaranteedByPity, 6), 1);

const zeroRateNoPity = {
  baseRate: 0,
  plannedPulls: 100,
  currentPity: 0,
  hardPity: 200,
  targetCopies: 2,
  usePity: false,
};

assert.equal(chanceAt(zeroRateNoPity, 0), 1);
assert.equal(chanceAt(zeroRateNoPity, 1), 0);
assert.equal(chanceAt(zeroRateNoPity, 2), 0);

const fullRateNoPity = {
  baseRate: 100,
  plannedPulls: 5,
  currentPity: 0,
  hardPity: 200,
  targetCopies: 5,
  usePity: false,
};

assert.equal(isAtLeastTargetGuaranteed(fullRateNoPity, 5), true);
assert.equal(chanceAt(fullRateNoPity, 5), 1);

console.log('Gacha probability checks passed.');
