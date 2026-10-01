'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense, useState, type FormEvent } from 'react';
import { ApiError } from '@/lib/api';
import { useLogin } from '@/lib/auth';
import { Button } from '@/components/ui';

/** Only same-site paths are allowed after login (no open redirect to another site). */
function safeNext(next: string | null): string {
  return next && next.startsWith('/') && !next.startsWith('//') ? next : '/leads';
}

function LoginForm() {
  const router = useRouter();
  const params = useSearchParams();
  const login = useLogin();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const error =
    login.error instanceof ApiError
      ? login.error.status === 429
        ? 'Too many attempts. Please wait 15 minutes and try again.'
        : login.error.message
      : login.error
        ? 'Login failed. Please try again.'
        : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    login.mutate(
      { email: email.trim(), password },
      { onSuccess: () => router.replace(safeNext(params.get('next'))) },
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      <div>
        <label htmlFor="email" className="block text-sm font-medium text-slate-700">
          Email
        </label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      <div>
        <label htmlFor="password" className="block text-sm font-medium text-slate-700">
          Password
        </label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          className="mt-1 block w-full rounded-md border border-slate-300 px-3 py-2 text-sm shadow-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500"
        />
      </div>
      {error && (
        <p role="alert" className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </p>
      )}
      <Button
        type="submit"
        className="w-full"
        loading={login.isPending}
        disabled={!email || !password}
      >
        Log in
      </Button>
    </form>
  );
}

export default function LoginPage() {
  return (
    <div className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm">
        <div className="mb-8 text-center">
          <p className="text-lg font-semibold tracking-tight text-slate-900">ainoviro</p>
          <p className="text-sm text-slate-500">Lead Collector · internal</p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-6 shadow-sm">
          <Suspense>
            <LoginForm />
          </Suspense>
        </div>
      </div>
    </div>
  );
}
