import "server-only";
import { addDays, todayDay } from "@/lib/dates";
import { all, get } from "../db";
import { listDeparturesStaff } from "./programs";
import { expireDueQuotes, listQuotes } from "./quotes";

export function dashboardStats() {
  expireDueQuotes();
  const n = (sql: string, ...p: (string | number)[]) => get<{ n: number }>(sql, ...p)!.n;
  const monthStart = `${todayDay().slice(0, 7)}-01`;
  const quotes = listQuotes();

  const sentThisMonth = quotes.filter((q) => q.sent_at && q.sent_at >= monthStart);
  const decided = quotes.filter((q) => q.status === "accepted" || q.status === "rejected");
  const accepted = quotes.filter((q) => q.status === "accepted");

  return {
    leads: {
      new: n("SELECT COUNT(*) AS n FROM leads WHERE status = 'new'"),
      open: n("SELECT COUNT(*) AS n FROM leads WHERE status IN ('new', 'contacted', 'quoted')"),
      thisMonth: n("SELECT COUNT(*) AS n FROM leads WHERE created_at >= ?", monthStart),
      confirmed: n("SELECT COUNT(*) AS n FROM leads WHERE status = 'confirmed'"),
    },
    programs: {
      published: n("SELECT COUNT(*) AS n FROM programs WHERE status = 'published'"),
      drafts: n("SELECT COUNT(*) AS n FROM programs WHERE status = 'draft'"),
      views: n("SELECT COALESCE(SUM(view_count), 0) AS n FROM programs"),
    },
    quotes: {
      open: quotes.filter((q) => ["sent", "viewed", "changes_requested"].includes(q.status)).length,
      sentThisMonth: sentThisMonth.length,
      acceptanceRate: decided.length ? Math.round((accepted.length / decided.length) * 100) : null,
      awaiting: quotes
        .filter((q) => ["sent", "viewed", "changes_requested"].includes(q.status))
        .sort((a, b) => a.valid_until.localeCompare(b.valid_until))
        .slice(0, 6),
      expiringSoon: quotes.filter((q) => ["sent", "viewed"].includes(q.status) && q.valid_until <= addDays(todayDay(), 3)).length,
    },
    recentLeads: all<{ id: number; ref: string; full_name: string; program_title: string; status: string; created_at: string; adults: number; children: number }>(
      "SELECT id, ref, full_name, program_title, status, created_at, adults, children FROM leads ORDER BY created_at DESC LIMIT 8",
    ),
    topPrograms: all<{ id: number; title_ar: string; view_count: number; leads: number; status: string }>(
      `SELECT p.id, p.title_ar, p.view_count, p.status, (SELECT COUNT(*) FROM leads l WHERE l.program_id = p.id) AS leads
       FROM programs p WHERE p.status != 'archived' ORDER BY p.view_count DESC, leads DESC LIMIT 6`,
    ),
    departures: listDeparturesStaff({ scope: "upcoming" }).slice(0, 6),
  };
}
