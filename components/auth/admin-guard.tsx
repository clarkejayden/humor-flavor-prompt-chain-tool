import type { ReactElement } from "react";

import { requireAdminProfile } from "@/lib/supabase/admin";

export interface AdminGuardProps {
  adminContext: Awaited<ReturnType<typeof requireAdminProfile>>;
}

type GuardedComponent<P> = (props: P & AdminGuardProps) => Promise<ReactElement> | ReactElement;

export function withAdminGuard<P extends object>(Component: GuardedComponent<P>) {
  return async function AdminGuardedComponent(props: P) {
    const adminContext = await requireAdminProfile();

    return <Component {...props} adminContext={adminContext} />;
  };
}
