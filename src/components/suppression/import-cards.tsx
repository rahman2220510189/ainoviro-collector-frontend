'use client';

import { useRef, useState, type FormEvent } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui';
import {
  IMPORTABLE_REASONS,
  REASON_LABEL,
  useAddSuppression,
  useImportMailerResults,
  useImportSuppressionCsv,
  type CsvImportResult,
  type ImportableReason,
  type MailerImportResult,
} from '@/lib/suppression';

const MAX_FILE_BYTES = 10 * 1024 * 1024;

const inputClass =
  'w-full rounded-md border border-slate-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none';

function Card({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col rounded-lg border border-slate-200 bg-white p-5">
      <h2 className="text-sm font-semibold text-slate-900">{title}</h2>
      <p className="mt-1 text-sm text-slate-500">{description}</p>
      <div className="mt-4 flex-1">{children}</div>
    </section>
  );
}

function ReasonSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: ImportableReason;
  onChange: (r: ImportableReason) => void;
}) {
  return (
    <select
      id={id}
      value={value}
      onChange={(e) => onChange(e.target.value as ImportableReason)}
      className={`${inputClass} bg-white`}
    >
      {IMPORTABLE_REASONS.map((r) => (
        <option key={r} value={r}>
          {REASON_LABEL[r]}
        </option>
      ))}
    </select>
  );
}

/** Reads a chosen CSV file as text (checked for size first). */
async function readCsv(file: File): Promise<string | null> {
  if (file.size > MAX_FILE_BYTES) {
    toast.error('The file is larger than 10 MB. Split it into smaller files.');
    return null;
  }
  return file.text();
}

function Result({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-4 rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-900" role="status">
      {children}
    </div>
  );
}

export function AddEmailCard() {
  const add = useAddSuppression();
  const [email, setEmail] = useState('');
  const [reason, setReason] = useState<ImportableReason>('MANUAL');

  function submit(e: FormEvent) {
    e.preventDefault();
    add.mutate(
      { email: email.trim(), reason },
      {
        onSuccess: (r) => {
          toast.success(
            r.inserted > 0
              ? `${email.trim()} is now blocked.`
              : r.upgraded > 0
                ? `${email.trim()} was already blocked; reason updated.`
                : `${email.trim()} was already blocked.`,
          );
          setEmail('');
        },
      },
    );
  }

  return (
    <Card
      title="Add one address"
      description="Block a single email, e.g. someone who asked by phone."
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="sup-email" className="mb-1 block text-xs font-medium text-slate-500">
            Email
          </label>
          <input
            id="sup-email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@business.cy"
            className={inputClass}
          />
        </div>
        <div>
          <label htmlFor="sup-reason" className="mb-1 block text-xs font-medium text-slate-500">
            Reason
          </label>
          <ReasonSelect id="sup-reason" value={reason} onChange={setReason} />
        </div>
        <Button type="submit" loading={add.isPending} disabled={!email.trim()}>
          Block address
        </Button>
      </form>
    </Card>
  );
}

export function ImportListCard() {
  const importCsv = useImportSuppressionCsv();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [column, setColumn] = useState('email');
  const [reason, setReason] = useState<ImportableReason>('EXISTING_CONTACT');
  const [result, setResult] = useState<CsvImportResult | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const csv = await readCsv(file);
    if (csv === null) return;
    setResult(null);
    importCsv.mutate(
      { csv, filename: file.name, column: column.trim() || 'email', reason },
      {
        onSuccess: (r) => {
          setResult(r);
          setFile(null);
          if (fileRef.current) fileRef.current.value = '';
        },
      },
    );
  }

  return (
    <Card
      title="Import a list"
      description="A CSV of people who must never get our emails: existing contacts or vendors, old unsubscribes."
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="sup-file" className="mb-1 block text-xs font-medium text-slate-500">
            CSV file
          </label>
          <input
            id="sup-file"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label htmlFor="sup-column" className="mb-1 block text-xs font-medium text-slate-500">
              Email column
            </label>
            <input
              id="sup-column"
              value={column}
              onChange={(e) => setColumn(e.target.value)}
              className={inputClass}
            />
          </div>
          <div>
            <label
              htmlFor="sup-list-reason"
              className="mb-1 block text-xs font-medium text-slate-500"
            >
              Reason
            </label>
            <ReasonSelect id="sup-list-reason" value={reason} onChange={setReason} />
          </div>
        </div>
        <Button type="submit" loading={importCsv.isPending} disabled={!file}>
          Import list
        </Button>
      </form>
      {result && (
        <Result>
          <p className="font-medium">
            {result.inserted} added
            {result.upgraded > 0 && `, ${result.upgraded} reason updated`},{' '}
            {result.alreadySuppressed} already blocked.
          </p>
          <p className="mt-0.5 text-emerald-800">
            {result.rows} rows read
            {result.duplicatesInFile > 0 && ` · ${result.duplicatesInFile} duplicates`}
            {result.empty > 0 && ` · ${result.empty} empty`}
            {result.invalid > 0 && ` · ${result.invalid} without an email`}
          </p>
          {result.invalidExamples.length > 0 && (
            <p
              className="mt-1 truncate text-xs text-emerald-800"
              title={result.invalidExamples.join(', ')}
            >
              e.g. {result.invalidExamples.slice(0, 3).join(', ')}
            </p>
          )}
        </Result>
      )}
    </Card>
  );
}

const STATUS_TEXT: Record<string, string> = {
  contacted: 'contacted',
  bounced: 'bounced',
  unsubscribed: 'unsubscribed',
  replied: 'replied',
  onboarded: 'onboarded',
  product_added: 'product added',
};

export function MailerResultsCard() {
  const importResults = useImportMailerResults();
  const fileRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [result, setResult] = useState<MailerImportResult | null>(null);

  async function submit(e: FormEvent) {
    e.preventDefault();
    if (!file) return;
    const csv = await readCsv(file);
    if (csv === null) return;
    setResult(null);
    importResults.mutate(
      { csv, filename: file.name },
      {
        onSuccess: (r) => {
          setResult(r);
          setFile(null);
          if (fileRef.current) fileRef.current.value = '';
        },
      },
    );
  }

  return (
    <Card
      title="Import mailer results"
      description="A CSV from the mailer with columns email,status (and optionally date). Bounces and unsubscribes are blocked; replies and onboardings update the lead."
    >
      <form onSubmit={submit} className="space-y-3">
        <div>
          <label htmlFor="mailer-file" className="mb-1 block text-xs font-medium text-slate-500">
            CSV file
          </label>
          <input
            id="mailer-file"
            ref={fileRef}
            type="file"
            accept=".csv,text/csv"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-md file:border-0 file:bg-slate-100 file:px-3 file:py-1.5 file:text-sm file:font-medium file:text-slate-700 hover:file:bg-slate-200"
          />
        </div>
        <p className="text-xs text-slate-500">
          Statuses: contacted, bounced, unsubscribed, replied, onboarded, product added.
        </p>
        <Button type="submit" loading={importResults.isPending} disabled={!file}>
          Import results
        </Button>
      </form>
      {result && (
        <Result>
          <p className="font-medium">
            {result.leadsUpdated} lead{result.leadsUpdated === 1 ? '' : 's'} updated,{' '}
            {result.suppressed} address{result.suppressed === 1 ? '' : 'es'} blocked.
          </p>
          <p className="mt-0.5 text-emerald-800">
            {Object.entries(result.byStatus)
              .map(([s, n]) => `${n} ${STATUS_TEXT[s] ?? s}`)
              .join(' · ') || 'No known statuses'}
          </p>
          {(result.unknownEmails > 0 ||
            result.invalidRows > 0 ||
            result.unknownStatuses.length > 0) && (
            <p className="mt-1 text-xs text-emerald-800">
              {result.unknownEmails > 0 &&
                `${result.unknownEmails} addresses not collected by this tool. `}
              {result.invalidRows > 0 && `${result.invalidRows} rows without a valid email. `}
              {result.unknownStatuses.length > 0 &&
                `Ignored statuses: ${result.unknownStatuses.join(', ')}.`}
            </p>
          )}
        </Result>
      )}
    </Card>
  );
}
