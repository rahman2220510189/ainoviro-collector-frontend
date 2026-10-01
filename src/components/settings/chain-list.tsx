'use client';

import { useState, type FormEvent } from 'react';
import { ConfirmDialog } from '@/components/confirm-dialog';
import { Button } from '@/components/ui';
import { useAddChain, useRemoveChain, type ChainEntry } from '@/lib/settings';

const inputClass =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none';

/** Spec §10: chains and franchises are never exported (one head office decides). */
export function ChainList({ chains }: { chains: ChainEntry[] }) {
  const add = useAddChain();
  const remove = useRemoveChain();
  const [name, setName] = useState('');
  const [domain, setDomain] = useState('');
  const [toRemove, setToRemove] = useState<ChainEntry | null>(null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    add.mutate(
      { name: name.trim(), domain: domain.trim() || undefined },
      {
        onSuccess: () => {
          setName('');
          setDomain('');
        },
      },
    );
  };

  return (
    <section className="rounded-lg border border-slate-200 bg-white">
      <div className="border-b border-slate-100 px-5 py-4">
        <h2 className="text-base font-semibold text-slate-900">Chain list</h2>
        <p className="mt-0.5 text-sm text-slate-500">
          Big chains and franchises are held back from exports, because the head office decides, not
          the shop. A name matches every business whose name starts with it (&quot;Zara&quot; also
          matches &quot;Zara Limassol&quot;). Websites used by 3 or more places are found
          automatically.
        </p>
      </div>
      <form
        onSubmit={submit}
        className="grid gap-3 px-5 py-4 sm:grid-cols-[1fr_1fr_auto] sm:items-end"
      >
        <div>
          <label htmlFor="chain-name" className="mb-1 block text-xs font-medium text-slate-500">
            Name
          </label>
          <input
            id="chain-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Zara"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="chain-domain" className="mb-1 block text-xs font-medium text-slate-500">
            Website (optional)
          </label>
          <input
            id="chain-domain"
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="e.g. zara.com"
            className={inputClass}
          />
        </div>
        <Button type="submit" loading={add.isPending} disabled={!name.trim()}>
          Add to list
        </Button>
      </form>
      {chains.length === 0 ? (
        <p className="border-t border-slate-100 px-5 py-4 text-sm text-slate-500">
          The list is empty.
        </p>
      ) : (
        <ul className="divide-y divide-slate-100 border-t border-slate-100">
          {chains.map((c) => (
            <li key={c.id} className="flex items-center justify-between gap-3 px-5 py-2.5 text-sm">
              <span className="min-w-0 truncate">
                <span className="font-medium text-slate-900">{c.name}</span>
                {c.domain && <span className="ml-2 text-slate-500">{c.domain}</span>}
              </span>
              <Button
                variant="ghost"
                className="px-2.5 py-1 text-xs text-red-700 hover:bg-red-50 hover:text-red-800"
                onClick={() => setToRemove(c)}
              >
                Remove
              </Button>
            </li>
          ))}
        </ul>
      )}
      <ConfirmDialog
        open={toRemove !== null}
        title={`Remove ${toRemove?.name ?? ''} from the chain list?`}
        message="Its businesses can then be exported again (unless their website is shared by many places)."
        confirmLabel="Remove"
        danger
        loading={remove.isPending}
        onCancel={() => setToRemove(null)}
        onConfirm={() =>
          toRemove && remove.mutate(toRemove.id, { onSettled: () => setToRemove(null) })
        }
      />
    </section>
  );
}
