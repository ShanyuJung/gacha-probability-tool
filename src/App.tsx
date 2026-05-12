import { useEffect, useMemo, useState } from 'react';

type Settings = {
  baseRate: number;
  plannedPulls: number;
  currentPity: number;
  hardPity: number;
  targetCopies: number;
  usePity: boolean;
};

type DistributionPoint = {
  copies: number;
  probability: number;
};

const STORAGE_KEY = 'gacha-probability-tool.settings.v2';

const defaultSettings: Settings = {
  baseRate: 0.7,
  plannedPulls: 10,
  currentPity: 20,
  hardPity: 200,
  targetCopies: 1,
  usePity: true,
};

function clampNumber(value: number, min: number, max: number) {
  if (Number.isNaN(value)) return min;
  return Math.min(Math.max(value, min), max);
}

function formatPercent(value: number, digits = 2) {
  return `${(value * 100).toFixed(digits)}%`;
}

function readStoredSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
}

function calculateDistribution(settings: Settings): DistributionPoint[] {
  const targetCopies = Math.floor(clampNumber(settings.targetCopies, 1, 20));
  const plannedPulls = Math.floor(clampNumber(settings.plannedPulls, 0, 1000));
  const hardPity = Math.floor(clampNumber(settings.hardPity, 1, 1000));
  const startPity = Math.floor(clampNumber(settings.currentPity, 0, hardPity - 1));
  const baseChance = clampNumber(settings.baseRate / 100, 0, 1);
  const states = new Map<string, number>();

  states.set(`0:${startPity}`, 1);

  for (let pull = 0; pull < plannedPulls; pull += 1) {
    const nextStates = new Map<string, number>();

    states.forEach((probability, key) => {
      const [copiesRaw, pityRaw] = key.split(':').map(Number);
      const copies = copiesRaw;
      const pity = pityRaw;
      const nextPityCount = pity + 1;
      const successChance =
        settings.usePity && nextPityCount >= hardPity ? 1 : baseChance;
      const failChance = 1 - successChance;
      const successCopies = Math.min(copies + 1, targetCopies);
      const successKey = `${successCopies}:0`;

      nextStates.set(
        successKey,
        (nextStates.get(successKey) ?? 0) + probability * successChance,
      );

      if (failChance > 0) {
        const failKey = `${copies}:${Math.min(nextPityCount, hardPity - 1)}`;
        nextStates.set(
          failKey,
          (nextStates.get(failKey) ?? 0) + probability * failChance,
        );
      }
    });

    states.clear();
    nextStates.forEach((probability, key) => states.set(key, probability));
  }

  const buckets = Array.from({ length: targetCopies + 1 }, (_, copies) => ({
    copies,
    probability: 0,
  }));

  states.forEach((probability, key) => {
    const copies = Number(key.split(':')[0]);
    buckets[copies].probability += probability;
  });

  return buckets;
}

function calculateFirstHitChance(settings: Settings, pullCount: number) {
  const distribution = calculateDistribution({
    ...settings,
    plannedPulls: pullCount,
    targetCopies: 1,
  });

  return distribution[1]?.probability ?? 0;
}

function NumberField({
  label,
  suffix,
  value,
  min,
  max,
  step = 1,
  onChange,
}: {
  label: string;
  suffix?: string;
  value: number;
  min: number;
  max: number;
  step?: number;
  onChange: (value: number) => void;
}) {
  return (
    <label className="field">
      <span>{label}</span>
      <div className="inputWrap">
        <input
          type="number"
          min={min}
          max={max}
          step={step}
          value={value}
          onChange={(event) => onChange(Number(event.target.value))}
        />
        {suffix ? <em>{suffix}</em> : null}
      </div>
    </label>
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() => readStoredSettings());

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const normalizedSettings = useMemo(
    () => ({
      ...settings,
      baseRate: clampNumber(settings.baseRate, 0, 100),
      plannedPulls: Math.floor(clampNumber(settings.plannedPulls, 0, 1000)),
      currentPity: Math.floor(
        clampNumber(settings.currentPity, 0, Math.max(settings.hardPity - 1, 0)),
      ),
      hardPity: Math.floor(clampNumber(settings.hardPity, 1, 1000)),
      targetCopies: Math.floor(clampNumber(settings.targetCopies, 1, 20)),
    }),
    [settings],
  );

  const distribution = useMemo(
    () => calculateDistribution(normalizedSettings),
    [normalizedSettings],
  );

  const goalChance = distribution[normalizedSettings.targetCopies]?.probability ?? 0;
  const expectedCopies = distribution.reduce(
    (sum, item) => sum + item.copies * item.probability,
    0,
  );
  const pityRemaining = normalizedSettings.usePity
    ? Math.max(normalizedSettings.hardPity - normalizedSettings.currentPity, 0)
    : null;
  const quickPulls = [10, 20, 30, 50, 80]
    .filter((pulls) => pulls <= normalizedSettings.plannedPulls)
    .map((pulls) => ({
      pulls,
      probability: calculateFirstHitChance(normalizedSettings, pulls),
    }));

  function updateSettings(patch: Partial<Settings>) {
    setSettings((current) => ({ ...current, ...patch }));
  }

  return (
    <main className="app">
      <section className="workspace">
        <div className="intro">
          <p className="eyebrow">AI Agent 測試小工具</p>
          <h1>抽抽小精靈</h1>
          <p>
            對照目前墊抽與保底狀態，估算接下來抽到目標的機率。設定會自動存在瀏覽器。
          </p>
        </div>

        <div className="layout">
          <section className="panel controls" aria-label="抽卡設定">
            <div className="panelHeader">
              <h2>抽卡設定</h2>
              <button type="button" onClick={() => setSettings(defaultSettings)}>
                重設
              </button>
            </div>

            <div className="grid">
              <NumberField
                label="目標機率"
                suffix="%"
                value={settings.baseRate}
                min={0}
                max={100}
                step={0.01}
                onChange={(baseRate) => updateSettings({ baseRate })}
              />
              <NumberField
                label="接下來要抽"
                suffix="抽"
                value={settings.plannedPulls}
                min={0}
                max={1000}
                onChange={(plannedPulls) => updateSettings({ plannedPulls })}
              />
              <NumberField
                label="目前已抽"
                suffix="抽"
                value={settings.currentPity}
                min={0}
                max={999}
                onChange={(currentPity) => updateSettings({ currentPity })}
              />
              <NumberField
                label="保底"
                suffix="抽"
                value={settings.hardPity}
                min={1}
                max={1000}
                onChange={(hardPity) => updateSettings({ hardPity })}
              />
              <NumberField
                label="目標數量"
                suffix="個"
                value={settings.targetCopies}
                min={1}
                max={20}
                onChange={(targetCopies) => updateSettings({ targetCopies })}
              />
            </div>

            <label className="switch">
              <input
                type="checkbox"
                checked={settings.usePity}
                onChange={(event) =>
                  updateSettings({ usePity: event.target.checked })
                }
              />
              <span>啟用保底計算</span>
            </label>
          </section>

          <section className="panel result" aria-label="計算結果">
            <div>
              <p className="label">達成目標機率</p>
              <strong>{formatPercent(goalChance)}</strong>
              <p className="muted">
                {normalizedSettings.plannedPulls} 抽內取得至少{' '}
                {normalizedSettings.targetCopies} 個目標
              </p>
            </div>

            <div className="stats">
              <div>
                <span>期望目標數</span>
                <b>{expectedCopies.toFixed(3)}</b>
              </div>
              <div>
                <span>距離保底</span>
                <b>{pityRemaining === null ? '未啟用' : `${pityRemaining} 抽`}</b>
              </div>
            </div>
          </section>
        </div>

        <section className="panel distribution" aria-label="機率分布">
          <div className="panelHeader">
            <h2>結果分布</h2>
            <span>{normalizedSettings.plannedPulls} 抽模擬計算</span>
          </div>
          <div className="bars">
            {distribution.map((item) => (
              <div className="barRow" key={item.copies}>
                <span>{item.copies >= normalizedSettings.targetCopies ? '達標' : `${item.copies} 個`}</span>
                <div className="barTrack">
                  <div
                    className="barFill"
                    style={{ width: `${Math.max(item.probability * 100, 0.8)}%` }}
                  />
                </div>
                <b>{formatPercent(item.probability)}</b>
              </div>
            ))}
          </div>
        </section>

        {quickPulls.length > 0 ? (
          <section className="quickList" aria-label="快速對照">
            {quickPulls.map((item) => (
              <article key={item.pulls}>
                <span>{item.pulls} 抽內</span>
                <b>{formatPercent(item.probability)}</b>
              </article>
            ))}
          </section>
        ) : null}
      </section>
    </main>
  );
}
