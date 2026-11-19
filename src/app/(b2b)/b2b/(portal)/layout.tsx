import { redirect } from "next/navigation";
import type { ReactNode } from "react";
import { PortalShell } from "@/components/b2b/PortalShell";
import { requireCompanyPage } from "@/server/auth/session";
import { portalCompany } from "@/server/repo/b2b";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const user = await requireCompanyPage();
  const company = await portalCompany(user.companyId);
  if (!company) redirect("/b2b/login/");
  return (
    <PortalShell company={company} user={{ name: user.name, permissions: user.permissions }}>
      {children}
    </PortalShell>
  );
}
