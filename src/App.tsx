import { useEffect, useMemo, useState } from 'react';
import {
  MAX_PITY,
  MAX_PULLS,
  MAX_RATE,
  MAX_TARGET_COPIES,
  calculateDistribution,
  calculateFirstHitChance,
  clampNumber,
  defaultSettings,
  formatPercent,
  isAtLeastTargetGuaranteed,
  normalizeSettings,
  type Settings,
} from './utils/gachaProbability';

const STORAGE_KEY = 'gacha-probability-tool.settings.v2';

function readStoredSettings(): Settings {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultSettings;
    return { ...defaultSettings, ...JSON.parse(raw) };
  } catch {
    return defaultSettings;
  }
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
          onChange={(event) =>
            onChange(clampNumber(Number(event.target.value), min, max))
          }
        />
        {suffix ? <em>{suffix}</em> : null}
      </div>
    </label>
  );
}

export default function App() {
  const [settings, setSettings] = useState<Settings>(() =>
    readStoredSettings(),
  );

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
  }, [settings]);

  const normalizedSettings = useMemo(
    () => normalizeSettings(settings),
    [settings],
  );

  const totalPulls =
    normalizedSettings.currentPity + normalizedSettings.plannedPulls;
  const cumulativeSettings = useMemo(
    () => ({
      ...normalizedSettings,
      currentPity: 0,
      plannedPulls: totalPulls,
    }),
    [normalizedSettings, totalPulls],
  );
  const distribution = useMemo(
    () => calculateDistribution(cumulativeSettings),
    [cumulativeSettings],
  );

  const goalChance =
    distribution[normalizedSettings.targetCopies]?.probability ?? 0;
  const isGoalGuaranteed = isAtLeastTargetGuaranteed(
    normalizedSettings,
    totalPulls,
  );
  const expectedCopies = distribution.reduce(
    (sum, item) => sum + item.copies * item.probability,
    0,
  );
  const pityProgress =
    normalizedSettings.currentPity % normalizedSettings.hardPity;
  const pityRemaining = normalizedSettings.usePity
    ? normalizedSettings.hardPity - pityProgress
    : null;
  const quickPulls = [10, 20, 30, 50, 80]
    .filter((pulls) => pulls <= normalizedSettings.plannedPulls)
    .map((pulls) => ({
      pulls,
      probability: calculateFirstHitChance(normalizedSettings, pulls),
      isGuaranteed: isAtLeastTargetGuaranteed(
        { ...normalizedSettings, targetCopies: 1 },
        normalizedSettings.currentPity + pulls,
      ),
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
            對照目前已抽與保底狀態，估算累積到指定抽數時抽到目標的機率。設定會自動存在瀏覽器。
          </p>
        </div>

        <div className="layout">
          <section className="panel controls" aria-label="抽卡設定">
            <div className="panelHeader">
              <h2>抽卡設定</h2>
              <button
                type="button"
                onClick={() => setSettings(defaultSettings)}
              >
                重設
              </button>
            </div>

            <div className="grid">
              <NumberField
                label="目標機率"
                suffix="%"
                value={normalizedSettings.baseRate}
                min={0}
                max={MAX_RATE}
                step={0.01}
                onChange={(baseRate) => updateSettings({ baseRate })}
              />
              <NumberField
                label="接下來要抽"
                suffix="抽"
                value={normalizedSettings.plannedPulls}
                min={0}
                max={MAX_PULLS}
                onChange={(plannedPulls) => updateSettings({ plannedPulls })}
              />
              <NumberField
                label="目前已抽"
                suffix="抽"
                value={normalizedSettings.currentPity}
                min={0}
                max={MAX_PULLS}
                onChange={(currentPity) => updateSettings({ currentPity })}
              />
              <NumberField
                label="保底"
                suffix="抽"
                value={normalizedSettings.hardPity}
                min={1}
                max={MAX_PITY}
                onChange={(hardPity) => updateSettings({ hardPity })}
              />
              <NumberField
                label="目標數量"
                suffix="個"
                value={normalizedSettings.targetCopies}
                min={1}
                max={MAX_TARGET_COPIES}
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
              <p className="label">累積達標機率</p>
              <strong>
                {formatPercent(goalChance, 2, {
                  allowExactOne: isGoalGuaranteed,
                  compactUpperBound: true,
                })}
              </strong>
              <p className="muted">
                累積 {totalPulls} 抽內取得至少 {normalizedSettings.targetCopies}{' '}
                個目標
              </p>
            </div>

            <div className="stats">
              <div>
                <span>期望目標數</span>
                <b>{expectedCopies.toFixed(3)}</b>
              </div>
              <div>
                <span>距離保底</span>
                <b>
                  {pityRemaining === null ? '未啟用' : `${pityRemaining} 抽`}
                </b>
              </div>
            </div>
          </section>
        </div>

        <section className="panel distribution" aria-label="機率分布">
          <div className="panelHeader">
            <h2>結果分布</h2>
            <span>累積 {totalPulls} 抽計算</span>
          </div>
          <div className="bars">
            {distribution.map((item) => (
              <div className="barRow" key={item.copies}>
                <span>
                  {item.copies >= normalizedSettings.targetCopies
                    ? '達標'
                    : `${item.copies} 個`}
                </span>
                <div className="barTrack">
                  <div
                    className="barFill"
                    style={{
                      width: `${Math.max(item.probability * 100, 0.8)}%`,
                    }}
                  />
                </div>
                <b>
                  {formatPercent(item.probability, 2, {
                    allowExactOne:
                      item.copies >= normalizedSettings.targetCopies
                        ? isGoalGuaranteed
                        : item.probability === 1,
                  })}
                </b>
              </div>
            ))}
          </div>
        </section>

        {quickPulls.length > 0 ? (
          <section className="quickList" aria-label="快速對照">
            {quickPulls.map((item) => (
              <article key={item.pulls}>
                <span>
                  累積 {normalizedSettings.currentPity + item.pulls} 抽
                </span>
                <b>
                  {formatPercent(item.probability, 2, {
                    allowExactOne: item.isGuaranteed,
                  })}
                </b>
              </article>
            ))}
          </section>
        ) : null}
      </section>
    </main>
  );
}
