import type { ReactNode } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { countNewLeads } from "@/server/repo/leads";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaffPage();
  return (
    <StaffShell user={{ name: staff.name, role: staff.role }} newLeads={can(staff.role, "leads.view") ? countNewLeads() : 0}>
      {children}
    </StaffShell>
  );
}
