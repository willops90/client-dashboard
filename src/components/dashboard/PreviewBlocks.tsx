"use client";

import { useId, useState } from "react";
import type { PreviewBlock } from "@/lib/plan";

/** Renders an asset preview from its data blocks. The same components serve every client. */
export function PreviewBlocks({ blocks }: { blocks: PreviewBlock[] }) {
  return (
    <div className="pv">
      {blocks.map((b, i) => (
        <div key={i} className="pv-block">
          <Block block={b} />
        </div>
      ))}
    </div>
  );
}

function Block({ block: b }: { block: PreviewBlock }) {
  switch (b.type) {
    case "text":
      return <p className="pv-text">{b.text}</p>;
    case "table":
      return (
        <>
          {b.title && <h4>{b.title}</h4>}
          <Table columns={b.columns} rows={b.rows} footer={b.footer} />
          {b.note && <p className="hint">{b.note}</p>}
        </>
      );
    case "flow":
      return (
        <>
          {b.title && <h4>{b.title}</h4>}
          <Flow links={b.links} />
        </>
      );
    case "doc":
      return (
        <article className="pv-doc">
          <h4>{b.title}</h4>
          {b.meta && (
            <dl className="pv-meta">
              {b.meta.map((m) => (
                <div key={m.label}>
                  <dt>{m.label}</dt>
                  <dd>{m.value}</dd>
                </div>
              ))}
            </dl>
          )}
          {b.sections.map((s) => (
            <section key={s.heading}>
              <h5>{s.heading}</h5>
              {s.text && <p>{s.text}</p>}
              {s.steps && (
                <ol>
                  {s.steps.map((step) => (
                    <li key={step}>{step}</li>
                  ))}
                </ol>
              )}
              {s.table && <Table {...s.table} />}
            </section>
          ))}
        </article>
      );
    case "matrix":
      return <Matrix block={b} />;
    case "seats":
      return <Seats block={b} />;
  }
}

function Table({ columns, rows, footer }: { columns: string[]; rows: string[][]; footer?: string[] }) {
  return (
    <div className="scroll" tabIndex={0} role="region" aria-label="Table">
      <table className="pv-table">
        <thead>
          <tr>
            {columns.map((c) => (
              <th key={c}>{c}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((r, i) => (
            <tr key={i}>
              {r.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          ))}
        </tbody>
        {footer && (
          <tfoot>
            <tr>
              {footer.map((cell, j) => (
                <td key={j}>{cell}</td>
              ))}
            </tr>
          </tfoot>
        )}
      </table>
    </div>
  );
}

/** Task → person map, drawn like a Lucid diagram: tasks on the left, owners on the right. */
function Flow({ links }: { links: { from: string; to: string; weight?: number }[] }) {
  const tasks = [...new Set(links.map((l) => l.from))];
  const people = [...new Set(links.map((l) => l.to))];
  const W = 560, rowH = 40, nodeW = 190, top = 10;
  const H = top * 2 + Math.max(tasks.length, people.length) * rowH;
  const yTask = (i: number) => top + i * rowH + rowH / 2;
  const peopleGap = (H - top * 2) / people.length;
  const yPerson = (i: number) => top + i * peopleGap + peopleGap / 2;
  const maxW = Math.max(...links.map((l) => l.weight ?? 1));
  const summary = links.map((l) => `${l.from} to ${l.to}${l.weight ? ` (${l.weight} hrs)` : ""}`).join("; ");

  return (
    <div className="scroll" tabIndex={0} role="region" aria-label="Task to person map">
      <svg className="pv-flow" viewBox={`0 0 ${W} ${H}`} role="img" aria-label={summary}>
        {links.map((l, i) => {
          const y1 = yTask(tasks.indexOf(l.from));
          const y2 = yPerson(people.indexOf(l.to));
          const x1 = nodeW, x2 = W - nodeW + 40;
          const mid = (x1 + x2) / 2;
          return (
            <path
              key={i}
              className="pv-link"
              d={`M${x1},${y1} C${mid},${y1} ${mid},${y2} ${x2},${y2}`}
              strokeWidth={1.5 + ((l.weight ?? 1) / maxW) * 5}
            />
          );
        })}
        {tasks.map((t, i) => (
          <g key={t}>
            <rect className="pv-node" x={4} y={yTask(i) - 14} width={nodeW - 4} height={28} rx={6} />
            <text className="pv-node-text" x={14} y={yTask(i) + 4}>
              {t}
              {(() => {
                const w = links.find((l) => l.from === t)?.weight;
                return w ? ` · ${w}h` : "";
              })()}
            </text>
          </g>
        ))}
        {people.map((p, i) => (
          <g key={p}>
            <rect className="pv-node person" x={W - nodeW + 40} y={yPerson(i) - 14} width={nodeW - 44} height={28} rx={14} />
            <text className="pv-node-text strong" x={W - nodeW + 54} y={yPerson(i) + 4}>
              {p}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
}

function Matrix({ block: b }: { block: Extract<PreviewBlock, { type: "matrix" }> }) {
  const codes = Object.keys(b.key);
  const cls = (c: string) => `mx mx-${codes.indexOf(c)}`;
  return (
    <>
      {b.title && <h4>{b.title}</h4>}
      <div className="mx-key">
        {codes.map((c) => (
          <span key={c}>
            <span className={cls(c)}>{c}</span> {b.key[c]}
          </span>
        ))}
      </div>
      <div className="scroll" tabIndex={0} role="region" aria-label="Decision rights">
        <table className="pv-table pv-matrix">
          <thead>
            <tr>
              <th>Decision</th>
              {b.people.map((p) => (
                <th key={p}>{p}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {b.rows.map((r) => (
              <tr key={r.decision}>
                <td>{r.decision}</td>
                {r.cells.map((c, j) => (
                  <td key={j}>
                    {c ? (
                      <span className={cls(c)} title={b.key[c]}>
                        {c}
                        <span className="sr-only"> {b.key[c]}</span>
                      </span>
                    ) : (
                      <span className="none" aria-label="Not involved">
                        –
                      </span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

function Seats({ block: b }: { block: Extract<PreviewBlock, { type: "seats" }> }) {
  const [selected, setSelected] = useState(b.seats[0].title);
  const panelId = useId();
  const depth = (title: string, guard = 0): number => {
    const s = b.seats.find((x) => x.title === title);
    return s?.reports_to && guard < 10 ? depth(s.reports_to, guard + 1) + 1 : 0;
  };
  const levels: (typeof b.seats)[] = [];
  b.seats.forEach((s) => (levels[depth(s.title)] ??= []).push(s));
  const seat = b.seats.find((s) => s.title === selected)!;

  return (
    <>
      {b.title && <h4>{b.title}</h4>}
      <div className="seats">
        {levels.map((row, i) => (
          <div key={i} className="seat-row">
            {row.map((s) => (
              <button
                key={s.title}
                type="button"
                className="seat"
                aria-pressed={s.title === selected}
                aria-controls={panelId}
                onClick={() => setSelected(s.title)}
              >
                <span className="seat-title">{s.title}</span>
                <span className="seat-person">{s.person}</span>
              </button>
            ))}
          </div>
        ))}
      </div>
      <div id={panelId} className="seat-detail" aria-live="polite">
        <h5>
          {seat.title} <span className="hint">· {seat.person}</span>
        </h5>
        <div className="seat-cols">
          <div>
            <p className="hint">Accountable for</p>
            <ul>
              {seat.outcomes.map((o) => (
                <li key={o}>{o}</li>
              ))}
            </ul>
          </div>
          <div>
            <p className="hint">Measured by</p>
            <ul>
              {seat.kpis.map((k) => (
                <li key={k}>{k}</li>
              ))}
            </ul>
          </div>
        </div>
      </div>
    </>
  );
}
