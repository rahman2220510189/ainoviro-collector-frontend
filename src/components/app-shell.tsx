'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useLogout, useMe } from '@/lib/auth';
import { QuotaModal } from './quota-modal';
import { Button, LoadingState } from './ui';

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/jobs', label: 'Jobs' },
  { href: '/leads', label: 'Leads' },
  { href: '/exports', label: 'Exports' },
  { href: '/suppression', label: 'Suppression' },
  { href: '/settings', label: 'Settings' },
];

/**
 * Frame of every logged-in page: sidebar, top bar, the quota modal. Pages render only
 * after /auth/me confirmed the session; a 401 sends the browser to /login (api.ts).
 */
export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const me = useMe();
  const logout = useLogout();

  if (me.isPending || me.isError) {
    // isError = 401: api.ts is already redirecting to /login.
    return <LoadingState label={me.isError ? 'Redirecting to login…' : 'Checking your session…'} />;
  }

  return (
    <div className="flex min-h-full">
      <aside className="hidden w-56 shrink-0 flex-col border-r border-slate-200 bg-white md:flex">
        <div className="px-5 py-5">
          <Link href="/leads" className="block">
            <span className="text-base font-semibold tracking-tight text-slate-900">ainoviro</span>
            <span className="block text-xs text-slate-500">Lead Collector</span>
          </Link>
        </div>
        <nav className="flex-1 space-y-0.5 px-3" aria-label="Main">
          {NAV.map((item) => {
            const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={active ? 'page' : undefined}
                className={`block rounded-md px-3 py-2 text-sm font-medium ${
                  active
                    ? 'bg-brand-50 text-brand-700'
                    : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`}
              >
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-slate-200 px-5 py-4 text-xs text-slate-500">
          <p className="truncate" title={me.data.email}>
            {me.data.email}
          </p>
          <Button
            variant="ghost"
            className="-ml-3 mt-1 px-3 py-1 text-xs"
            loading={logout.isPending}
            onClick={() => logout.mutate()}
          >
            Log out
          </Button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Small screens: the same links as a scrollable bar. */}
        <nav
          className="flex gap-1 overflow-x-auto border-b border-slate-200 bg-white px-3 py-2 md:hidden"
          aria-label="Main"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={`shrink-0 rounded-md px-3 py-1.5 text-sm ${
                pathname.startsWith(item.href)
                  ? 'bg-brand-50 font-medium text-brand-700'
                  : 'text-slate-600'
              }`}
            >
              {item.label}
            </Link>
          ))}
        </nav>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-8">{children}</main>
      </div>

      <QuotaModal />
    </div>
  );
}
