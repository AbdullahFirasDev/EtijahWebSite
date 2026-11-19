import type { ReactNode } from "react";
import { StaffShell } from "@/components/staff/StaffShell";
import { can } from "@/lib/permissions";
import { requireStaffPage } from "@/server/auth/session";
import { countOpenB2bRequests } from "@/server/repo/b2b";
import { countNewLeads } from "@/server/repo/leads";

export const dynamic = "force-dynamic";

export default async function PortalLayout({ children }: { children: ReactNode }) {
  const staff = await requireStaffPage("portal.view");
  const [leads, b2b] = await Promise.all([can(staff.role, "leads.view") ? countNewLeads() : 0, can(staff.role, "quotes.manage") ? countOpenB2bRequests() : 0]);
  return (
    <StaffShell user={{ name: staff.name, role: staff.role }} badges={{ leads, b2b }}>
      {children}
    </StaffShell>
  );
}
