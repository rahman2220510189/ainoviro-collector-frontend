import { AppShell } from '@/components/app-shell';

/** Every page in this folder needs a logged-in admin. */
export default function AppLayout({ children }: { children: React.ReactNode }) {
  return <AppShell>{children}</AppShell>;
}
