"use client";

import { useState } from "react";
import { formatDate, formatValue, kpiStatus, latestReading } from "@/lib/leap";
import { MILESTONE_STATUS, type Kpi, type Milestone } from "@/lib/types";
import { Chart } from "@/components/dashboard/KpiHero";

type Props = { kpis: Kpi[]; milestones: Milestone[]; day: number; endDate: string; goalNote: string | null };

/** The KPI tiles double as the chart's tabs: the number first, the chart on demand. */
export function KpiTiles({ kpis, milestones, day, endDate, goalNote }: Props) {
  const [selected, setSelected] = useState(() => (kpis.find((k) => k.is_primary) ?? kpis[0])?.id);
  const kpi = kpis.find((k) => k.id === selected) ?? kpis[0];
  const by = formatDate(endDate, { day: "numeric", month: "short" });

  return (
    <>
      <div className="v2-tiles" role="group" aria-label="KPIs. Choose one to chart it.">
        {kpis.map((k) => {
          const last = latestReading(k.readings);
          const st = kpiStatus(k, k.readings);
          return (
            <button key={k.id} type="button" className="v2-tile" aria-pressed={k.id === kpi?.id} onClick={() => setSelected(k.id)}>
              <span className="v2-tile-name">
                {k.name}
                {k.is_primary && <span className="badge teal">Primary</span>}
              </span>
              <span className="v2-tile-value">{last ? formatValue(last.value, k.unit) : "–"}</span>
              <span className="v2-tile-target">
                → {formatValue(k.target_value, k.unit)} by {by}
              </span>
              <span className={`pill ${st.key}`}>{st.label}</span>
            </button>
          );
        })}
        {milestones.map((m) => {
          const st = MILESTONE_STATUS[m.status ?? "not_started"];
          return (
            <div key={m.name} className="v2-tile static">
              <span className="v2-tile-name">{m.name}</span>
              <span className="v2-tile-value word">{st.label}</span>
              <span className="v2-tile-target">
                → {m.target ?? "Passed"} by {by}
              </span>
              <span className={`pill ${st.key}`}>Pass/fail</span>
            </div>
          );
        })}
      </div>
      {kpi && (
        <div className="chart-box v2-chart">
          <p className="v2-chart-title">{kpi.name}, week by week</p>
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
            <span>
              <i className="sw diamond" />
              Monthly goal
            </span>
          </div>
          {(kpi.how_measured || goalNote) && <p className="why">{kpi.is_primary && goalNote ? goalNote : kpi.how_measured}</p>}
        </div>
      )}
    </>
  );
}
