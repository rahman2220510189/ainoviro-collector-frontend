'use client';

import { useState } from 'react';

export interface Column {
  /** Short label under the axis, e.g. "2 Oct". */
  label: string;
  value: number;
  /** Lines shown in the hover tooltip (first line in bold). */
  tooltip: string[];
}

/** Rounds the top of the scale up to a clean number (1, 2, 5 x 10^n). */
function niceMax(max: number): number {
  if (max <= 4) return Math.max(max, 1);
  const exp = 10 ** Math.floor(Math.log10(max));
  const f = max / exp;
  return (f <= 1 ? 1 : f <= 2 ? 2 : f <= 5 ? 5 : 10) * exp;
}

/**
 * One-series column chart in plain HTML: thin columns (max 24px) with a 4px rounded
 * top, two hairline gridlines, labels on the first, middle and last column, and a
 * tooltip on hover or keyboard focus. Every value is also in the table under the chart.
 */
export function ColumnChart({
  columns,
  title,
  height = 160,
}: {
  columns: Column[];
  title: string;
  height?: number;
}) {
  const [active, setActive] = useState<number | null>(null);
  const top = niceMax(Math.max(0, ...columns.map((c) => c.value)));
  const showLabel = (i: number) =>
    columns.length <= 8 ||
    i === 0 ||
    i === columns.length - 1 ||
    i === Math.floor(columns.length / 2);
  const current = active === null ? null : columns[active];

  return (
    <figure aria-label={title}>
      <div className="flex gap-2">
        {/* y axis: 0, half, top */}
        <div
          className="flex flex-col justify-between text-right text-[11px] tabular-nums text-slate-400"
          style={{ height }}
          aria-hidden
        >
          <span>{top.toLocaleString('en')}</span>
          <span>{(top / 2).toLocaleString('en')}</span>
          <span>0</span>
        </div>
        <div className="relative min-w-0 flex-1">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-slate-100" />
          <div
            className="pointer-events-none absolute inset-x-0 border-t border-slate-100"
            style={{ top: height / 2 }}
          />
          <div
            className="relative flex items-end gap-[2px] border-b border-slate-200"
            style={{ height }}
            onMouseLeave={() => setActive(null)}
          >
            {columns.map((c, i) => (
              <button
                key={`${c.label}-${i}`}
                type="button"
                aria-label={c.tooltip.join(', ')}
                onMouseEnter={() => setActive(i)}
                onFocus={() => setActive(i)}
                onBlur={() => setActive(null)}
                className="group flex h-full min-w-0 flex-1 items-end justify-center focus:outline-none"
              >
                <span
                  className={`block w-full max-w-6 rounded-t-[4px] ${
                    active === i ? 'bg-brand-700' : 'bg-brand-600'
                  } ${c.value === 0 ? 'opacity-0' : ''}`}
                  style={{ height: `${(c.value / top) * 100}%`, minHeight: c.value > 0 ? 2 : 0 }}
                />
              </button>
            ))}
          </div>
          {current && active !== null && (
            <div
              role="status"
              className="pointer-events-none absolute z-10 -translate-x-1/2 whitespace-nowrap rounded-md bg-slate-900 px-2.5 py-1.5 text-xs text-white shadow-lg"
              style={{
                left: `${((active + 0.5) / columns.length) * 100}%`,
                top: Math.max(0, height - (current.value / top) * height - 52),
              }}
            >
              {current.tooltip.map((line, i) => (
                <div key={line} className={i === 0 ? 'font-semibold' : 'text-slate-300'}>
                  {line}
                </div>
              ))}
            </div>
          )}
          <div className="mt-1 flex gap-[2px] text-[11px] text-slate-400" aria-hidden>
            {columns.map((c, i) => (
              <span
                key={`${c.label}-${i}`}
                className="flex min-w-0 flex-1 justify-center whitespace-nowrap"
              >
                {showLabel(i) ? c.label : ''}
              </span>
            ))}
          </div>
        </div>
      </div>
    </figure>
  );
}

/** Horizontal bars with the name on the left and the value at the bar's end. */
export function BarList({
  rows,
  emptyText,
}: {
  rows: { label: string; value: number; note?: string; href?: string }[];
  emptyText: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));
  if (rows.length === 0) return <p className="text-sm text-slate-500">{emptyText}</p>;
  return (
    <ul className="space-y-2">
      {rows.map((r) => (
        <li
          key={r.label}
          className="grid grid-cols-[minmax(0,9rem)_1fr] items-center gap-3 text-sm"
        >
          <span className="truncate text-slate-700" title={r.label}>
            {r.href ? (
              <a href={r.href} className="hover:underline">
                {r.label}
              </a>
            ) : (
              r.label
            )}
          </span>
          <span className="flex min-w-0 items-center gap-2">
            <span
              className="block h-3 rounded-r-[4px] bg-brand-600"
              // 75% at most, so the value always fits after the longest bar.
              style={{ width: `${Math.max((r.value / max) * 75, r.value > 0 ? 1 : 0)}%` }}
            />
            <span className="whitespace-nowrap text-xs tabular-nums text-slate-600">
              {r.value.toLocaleString('en')}
              {r.note && <span className="text-slate-400"> · {r.note}</span>}
            </span>
          </span>
        </li>
      ))}
    </ul>
  );
}
