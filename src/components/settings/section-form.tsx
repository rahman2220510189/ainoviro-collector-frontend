'use client';

import { useMemo, useState } from 'react';
import { ApiError } from '@/lib/api';
import {
  getPath,
  setPath,
  useSaveSection,
  type SectionView,
  type SettingsSection,
} from '@/lib/settings';
import { Button } from '@/components/ui';

/**
 * One editable value. Stored values keep their backend unit; "percent" shows 0.8 as 80
 * and "seconds" shows 1500 ms as 1.5, so nobody has to think in fractions or milliseconds.
 */
export interface Field {
  path: string;
  label: string;
  help?: string;
  type: 'number' | 'percent' | 'seconds' | 'boolean';
  min?: number;
  max?: number;
  step?: number;
  unit?: string;
}

export interface FieldGroup {
  title?: string;
  /** Shown folded until opened (rarely changed values). */
  advanced?: boolean;
  fields: Field[];
}

const toShown = (f: Field, v: unknown): string | boolean => {
  if (f.type === 'boolean') return v === true;
  if (typeof v !== 'number') return '';
  if (f.type === 'percent') return String(Math.round(v * 1000) / 10);
  if (f.type === 'seconds') return String(v / 1000);
  return String(v);
};

const fromShown = (f: Field, s: string | boolean): unknown => {
  if (f.type === 'boolean') return s === true;
  const n = Number(s);
  if (s === '' || Number.isNaN(n)) return s; // the backend explains what is wrong
  if (f.type === 'percent') return n / 100;
  if (f.type === 'seconds') return Math.round(n * 1000);
  return n;
};

function FieldInput({
  field,
  value,
  defaultValue,
  error,
  onChange,
}: {
  field: Field;
  value: unknown;
  defaultValue: unknown;
  error?: string;
  onChange: (v: unknown) => void;
}) {
  const id = `f-${field.path}`;
  const shownDefault = toShown(field, defaultValue);
  const isDefault = JSON.stringify(value) === JSON.stringify(defaultValue);

  if (field.type === 'boolean') {
    return (
      <label htmlFor={id} className="flex cursor-pointer items-start gap-2.5 py-1.5 text-sm">
        <input
          id={id}
          type="checkbox"
          checked={value === true}
          onChange={(e) => onChange(e.target.checked)}
          className="mt-0.5 h-4 w-4 rounded border-slate-300 accent-brand-600"
        />
        <span>
          <span className="block font-medium text-slate-900">{field.label}</span>
          {field.help && <span className="block text-xs text-slate-500">{field.help}</span>}
        </span>
      </label>
    );
  }

  return (
    <div className="grid gap-1 py-1.5 sm:grid-cols-[minmax(0,1fr)_11rem] sm:items-start sm:gap-4">
      <label htmlFor={id} className="text-sm">
        <span className="block font-medium text-slate-900">{field.label}</span>
        {field.help && <span className="block text-xs text-slate-500">{field.help}</span>}
      </label>
      <div>
        <div className="flex items-center gap-2">
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={field.min}
            max={field.max}
            step={field.step ?? (field.type === 'number' ? 1 : 'any')}
            value={toShown(field, value) as string}
            onChange={(e) => onChange(fromShown(field, e.target.value))}
            aria-invalid={error ? true : undefined}
            className={`w-28 rounded-md border px-2.5 py-1.5 text-sm tabular-nums focus:outline-none ${
              error
                ? 'border-red-400 focus:border-red-500'
                : 'border-slate-300 focus:border-brand-500'
            }`}
          />
          {field.unit && <span className="text-xs text-slate-500">{field.unit}</span>}
        </div>
        {error ? (
          <p className="mt-1 text-xs text-red-700">
            {field.min !== undefined && field.max !== undefined
              ? `Allowed: ${field.min} to ${field.max}${field.unit ? ` ${field.unit}` : ''}`
              : error}
          </p>
        ) : (
          !isDefault && (
            <p className="mt-1 text-xs text-slate-400">Default: {String(shownDefault)}</p>
          )
        )}
      </div>
    </div>
  );
}

/**
 * A settings card: fields, Save (only when something changed) and Back to defaults.
 * The parent gives it key={view.updatedAt}, so a save starts a fresh draft from the server.
 */
export function SectionForm({
  section,
  view,
  groups,
  title,
  description,
  footer,
  confirmSave,
}: {
  section: SettingsSection;
  view: SectionView;
  groups: FieldGroup[];
  title: string;
  description: string;
  footer?: (draft: Record<string, unknown>) => React.ReactNode;
  /** Returns a question to confirm before saving, or null to save straight away. */
  confirmSave?: (draft: Record<string, unknown>, saved: Record<string, unknown>) => string | null;
}) {
  const save = useSaveSection();
  const [draft, setDraft] = useState(view.values);
  const [openAdvanced, setOpenAdvanced] = useState(false);

  const dirty = JSON.stringify(draft) !== JSON.stringify(view.values);
  const atDefaults = JSON.stringify(draft) === JSON.stringify(view.defaults);

  const errors = useMemo(() => {
    const out: Record<string, string> = {};
    const err = save.error;
    if (err instanceof ApiError && err.code === 'INVALID_SETTINGS') {
      const issues = (err.details as { issues?: { path: string; message: string }[] })?.issues;
      for (const i of issues ?? []) out[i.path] = i.message;
    }
    return out;
  }, [save.error]);

  const submit = () => {
    const question = confirmSave?.(draft, view.values);
    if (question && !window.confirm(question)) return;
    save.mutate({ section, values: draft });
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">{title}</h2>
        <p className="mt-0.5 text-sm text-slate-500">{description}</p>
      </div>
      <div className="space-y-4 px-5 py-4">
        {groups.map((g, gi) => {
          if (g.advanced && !openAdvanced) return null;
          return (
            <div key={gi}>
              {g.title && (
                <h3 className="mb-1 text-xs font-semibold uppercase tracking-wide text-slate-500">
                  {g.title}
                </h3>
              )}
              <div className="divide-y divide-slate-50">
                {g.fields.map((f) => (
                  <FieldInput
                    key={f.path}
                    field={f}
                    value={getPath(draft, f.path)}
                    defaultValue={getPath(view.defaults, f.path)}
                    error={errors[f.path]}
                    onChange={(v) => setDraft((d) => setPath(d, f.path, v))}
                  />
                ))}
              </div>
            </div>
          );
        })}
        {groups.some((g) => g.advanced) && (
          <button
            type="button"
            onClick={() => setOpenAdvanced((o) => !o)}
            className="text-xs font-medium text-brand-700 hover:underline"
          >
            {openAdvanced ? 'Hide advanced' : 'Show advanced'}
          </button>
        )}
        {footer?.(draft)}
        {save.isError &&
          !(save.error instanceof ApiError && save.error.code === 'INVALID_SETTINGS') && (
            <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
              {save.error.message}
            </p>
          )}
        {Object.keys(errors).length > 0 && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-800">
            Some values are not allowed; see the red fields.
          </p>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-100 px-5 py-3">
        <span className="text-xs text-slate-400">
          {view.updatedAt
            ? `Last changed ${new Date(view.updatedAt).toLocaleString('en-GB')}`
            : 'Using the defaults'}
        </span>
        <div className="flex gap-2">
          <Button
            variant="ghost"
            disabled={atDefaults}
            onClick={() => setDraft(view.defaults)}
            title="Fill in the default values (then Save)"
          >
            Back to defaults
          </Button>
          {dirty && (
            <Button variant="secondary" onClick={() => setDraft(view.values)}>
              Discard
            </Button>
          )}
          <Button disabled={!dirty} loading={save.isPending} onClick={submit}>
            Save
          </Button>
        </div>
      </div>
    </section>
  );
}
