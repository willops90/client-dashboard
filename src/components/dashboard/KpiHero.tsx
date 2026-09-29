"use client";

import { useEffect, useRef, useState } from "react";
import { BUILD_PHASE_END_DAY, CYCLE_DAYS, formatDate, formatValue, kpiStatus, latestReading, readingDay } from "@/lib/leap";
import type { Kpi } from "@/lib/types";

type Props = { kpis: Kpi[]; day: number; currentWeek: number; endDate: string; goalNote?: string | null };

export function KpiHero({ kpis, day, currentWeek, endDate, goalNote }: Props) {
  const [selectedId, setSelectedId] = useState(() => (kpis.find((k) => k.is_primary) ?? kpis[0])?.id);
  const kpi = kpis.find((k) => k.id === selectedId) ?? kpis[0];
  if (!kpi) return <p className="empty">No KPIs have been loaded for this cycle yet.</p>;
  const status = kpiStatus(kpi, kpi.readings);

  return (
    <>
      <h1 id="headline">
        <Headline kpi={kpi} currentWeek={currentWeek} endDate={endDate} />
      </h1>
      <div className="hero-row">
        <span className={`pill ${status.key}`} aria-live="polite">
          {status.label}
        </span>
        {kpis.length > 1 && (
          <div className="tabs" role="group" aria-label="Choose a measure">
            {kpis.map((k) => (
              <button key={k.id} type="button" aria-pressed={k.id === kpi.id} onClick={() => setSelectedId(k.id)}>
                {k.name}
              </button>
            ))}
          </div>
        )}
      </div>
      <div className="chart-box">
        <Chart kpi={kpi} day={day} />
        <div className="legend">
          <span>
            <i className="sw" />
            Weekly reading
          </span>
          <span>
            <i className="sw dash" />
            Path to target
          </span>
          {kpi.goals.length > 0 && (
            <span>
              <i className="sw diamond" />
              Monthly goal
            </span>
          )}
          <span>
            <i className="sw band" />
            Days 1 to 60: build the assets
          </span>
          <span>
            <i className="sw band2" />
            Days 60 to 90: review progress
          </span>
        </div>
      </div>
      {kpi.how_measured && <p className="why">{kpi.how_measured}</p>}
      {goalNote && <p className="why goal-note">{goalNote}</p>}
    </>
  );
}

function Headline({ kpi, currentWeek, endDate }: { kpi: Kpi; currentWeek: number; endDate: string }) {
  const last = latestReading(kpi.readings);
  const target = (
    <span className="soft">
      {" "}
      The target is {formatValue(kpi.target_value, kpi.unit)} by {formatDate(endDate)}.
    </span>
  );
  if (!last) {
    return (
      <>
        {kpi.name} starts at {formatValue(kpi.start_value, kpi.unit)}. The first reading comes with Friday's check-in.{target}
      </>
    );
  }
  const when =
    last.week_number === currentWeek ? "this week" : last.week_number === currentWeek - 1 ? "last week" : `in week ${last.week_number}`;
  const moved = last.value === kpi.start_value ? "the same as the start" : `${last.value < kpi.start_value ? "down" : "up"} from ${formatValue(kpi.start_value, kpi.unit)}`;
  return (
    <>
      {kpi.name} came in at {formatValue(last.value, kpi.unit)} {when}, {moved}.{target}
    </>
  );
}

// ---------------------------------------------------------------------------

function niceStep(span: number): number {
  const raw = span / 5;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  for (const m of [1, 2, 2.5, 5, 10]) if (raw <= m * mag) return m * mag;
  return 10 * mag;
}

function axisLabel(v: number, unit: Kpi["unit"]): string {
  if (unit === "%") return `${v}%`;
  if (unit === "$") return v >= 10_000 ? `$${Math.round(v / 1000)}k` : `$${v.toLocaleString("en-AU")}`;
  return v.toLocaleString("en-AU");
}

export function Chart({ kpi, day }: { kpi: Kpi; day: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [W, setW] = useState(960);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([e]) => setW(Math.max(300, Math.round(e.contentRect.width))));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const narrow = W < 560;
  const H = narrow ? 250 : 300;
  const pl = 48, pr = 28, pt = 30, pb = 36, fs = 12.5;

  const values = [kpi.start_value, kpi.target_value, ...kpi.readings.map((r) => r.value), ...kpi.goals.map((g) => g.value)];
  let lo = Math.min(...values), hi = Math.max(...values);
  const pad = (hi - lo) * 0.12 || 1;
  lo -= pad;
  hi += pad;
  if (kpi.unit === "%") [lo, hi] = [Math.max(0, lo), Math.min(100, hi)];
  if (lo < 0 && Math.min(...values) >= 0) lo = 0;
  const step = niceStep(hi - lo);
  lo = Math.floor(lo / step) * step;
  hi = Math.ceil(hi / step) * step;

  const x = (d: number) => pl + (d / CYCLE_DAYS) * (W - pl - pr);
  const y = (v: number) => pt + ((hi - v) / (hi - lo)) * (H - pt - pb);

  const gridValues: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) gridValues.push(Number(v.toFixed(6)));
  const ticks = narrow ? [0, 30, 60, 90] : [0, 15, 30, 45, 60, 75, 90];

  const pts: [number, number, string][] = [
    [0, kpi.start_value, "Start"],
    ...kpi.readings.map((r) => [readingDay(r.week_number), r.value, `Week ${r.week_number}${r.entered_by_advisor ? " (entered by advisor)" : ""}`] as [number, number, string]),
  ];
  let len = 0;
  for (let i = 1; i < pts.length; i++) len += Math.hypot(x(pts[i][0]) - x(pts[i - 1][0]), y(pts[i][1]) - y(pts[i - 1][1]));
  const last = pts[pts.length - 1];
  const showToday = day >= 1 && day <= CYCLE_DAYS;
  const bandTop = pt - 22;
  const bandH = H - pb - bandTop;

  const summary = `${kpi.name}: start ${formatValue(kpi.start_value, kpi.unit)}, target ${formatValue(kpi.target_value, kpi.unit)}. ${
    kpi.readings.length ? kpi.readings.map((r) => `Week ${r.week_number}: ${formatValue(r.value, kpi.unit)}`).join(", ") + "." : "No readings yet."
  }`;

  return (
    <div className="chart" ref={ref} role="img" aria-label={summary}>
      <svg viewBox={`0 0 ${W} ${H}`} xmlns="http://www.w3.org/2000/svg" fontSize={fs} aria-hidden="true">
        <rect className="c-band-a" x={x(0)} y={bandTop} width={x(BUILD_PHASE_END_DAY) - x(0)} height={bandH} />
        <rect className="c-band-p" x={x(BUILD_PHASE_END_DAY)} y={bandTop} width={x(CYCLE_DAYS) - x(BUILD_PHASE_END_DAY)} height={bandH} />
        <text className="c-label-a" x={x(0) + 8} y={pt - 8}>
          {narrow ? "A  Assets" : "A  Create assets"}
        </text>
        <text className="c-label-p" x={x(BUILD_PHASE_END_DAY) + 8} y={pt - 8}>
          {narrow ? "P  Review" : "P  Review progress"}
        </text>
        {gridValues.map((v) => (
          <g key={v}>
            <line className="c-grid" x1={pl} x2={W - pr} y1={y(v)} y2={y(v)} />
            <text className="c-axis" x={pl - 8} y={y(v) + 4} textAnchor="end">
              {axisLabel(v, kpi.unit)}
            </text>
          </g>
        ))}
        {ticks.map((d) => (
          <text key={d} className="c-axis" x={x(d)} y={H - pb + 20} textAnchor="middle">
            Day {d}
          </text>
        ))}
        <line className="c-path" x1={x(0)} y1={y(kpi.start_value)} x2={x(CYCLE_DAYS)} y2={y(kpi.target_value)} />
        {kpi.goals.map((g) => (
          <rect
            key={g.day}
            className="c-goal"
            x={x(g.day) - 5}
            y={y(g.value) - 5}
            width={10}
            height={10}
            transform={`rotate(45 ${x(g.day)} ${y(g.value)})`}
          >
            <title>{`Day ${g.day} goal: ${formatValue(g.value, kpi.unit)}`}</title>
          </rect>
        ))}
        {showToday && (
          <>
            <line className="c-today" x1={x(day)} x2={x(day)} y1={bandTop} y2={H - pb} />
            <text className="c-today-label" x={x(day) + 6} y={H - pb - 8}>
              Today
            </text>
          </>
        )}
        {pts.length > 1 && (
          <polyline
            key={kpi.id}
            className="c-line draw"
            style={{ "--len": Math.ceil(len) } as React.CSSProperties}
            points={pts.map((p) => `${x(p[0])},${y(p[1])}`).join(" ")}
          />
        )}
        {pts.map((p, i) => (
          <circle key={i} className={`c-dot${i === pts.length - 1 ? " last" : ""}`} cx={x(p[0])} cy={y(p[1])} r={i === pts.length - 1 ? 5.5 : 3.5}>
            <title>{`${p[2]}: ${formatValue(p[1], kpi.unit)}`}</title>
          </circle>
        ))}
        {pts.length > 1 && (
          <text
            className="c-value"
            fontSize={fs + 2}
            x={x(last[0]) - 8}
            y={y(last[1]) + (kpi.lower_is_better ? -12 : 20)}
            textAnchor="end"
          >
            {formatValue(last[1], kpi.unit)}
          </text>
        )}
      </svg>
    </div>
  );
}
