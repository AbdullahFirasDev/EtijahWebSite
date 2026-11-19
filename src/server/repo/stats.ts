import "server-only";
import { addDays, todayDay } from "@/lib/dates";
import { col } from "../db";
import { listDeparturesStaff } from "./programs";
import { expireDueQuotes } from "./quotes";

export async function dashboardStats() {
  await expireDueQuotes();
  const monthStart = `${todayDay().slice(0, 7)}-01`;
  const [leads, programs, quotes, b2b] = await Promise.all([col("leads"), col("programs"), col("quotes"), col("b2b_requests")]);
  const open = ["sent", "viewed", "changes_requested"];

  const [newLeads, openLeads, monthLeads, confirmed, customNew, published, drafts, views, openQuotes, sentThisMonth, accepted, decided, awaiting, expiringSoon, recentLeads, topPrograms, departures, b2bNew] =
    await Promise.all([
      leads.countDocuments({ status: "new" }),
      leads.countDocuments({ status: { $in: ["new", "contacted", "quoted"] } }),
      leads.countDocuments({ created_at: { $gte: monthStart } }),
      leads.countDocuments({ status: "confirmed" }),
      leads.countDocuments({ status: "new", kind: "custom" }),
      programs.countDocuments({ status: "published" }),
      programs.countDocuments({ status: "draft" }),
      programs.aggregate<{ n: number }>([{ $group: { _id: null, n: { $sum: "$view_count" } } }]).toArray(),
      quotes.countDocuments({ status: { $in: open } }),
      quotes.countDocuments({ sent_at: { $gte: monthStart } }),
      quotes.countDocuments({ status: "accepted" }),
      quotes.countDocuments({ status: { $in: ["accepted", "rejected"] } }),
      quotes
        .find({ status: { $in: open } }, { projection: { ref: 1, title: 1, status: 1, valid_until: 1, company_id: 1, client: 1, audience: 1 } })
        .sort({ valid_until: 1 })
        .limit(6)
        .toArray(),
      quotes.countDocuments({ status: { $in: ["sent", "viewed"] }, valid_until: { $lte: addDays(todayDay(), 3) } }),
      leads.find({}, { projection: { ref: 1, full_name: 1, program_title: 1, status: 1, created_at: 1, adults: 1, children: 1, kind: 1 } }).sort({ created_at: -1 }).limit(8).toArray(),
      programs.find({ status: { $ne: "archived" } }, { projection: { title_ar: 1, view_count: 1, status: 1 } }).sort({ view_count: -1 }).limit(6).toArray(),
      listDeparturesStaff({ scope: "upcoming" }),
      b2b.countDocuments({ status: "new" }),
    ]);

  const leadCounts = new Map(
    (await leads.aggregate<{ _id: number; n: number }>([{ $match: { program_id: { $in: topPrograms.map((p) => p._id) } } }, { $group: { _id: "$program_id", n: { $sum: 1 } } }]).toArray()).map((r) => [r._id, r.n]),
  );
  const companyNames = new Map(
    (await (await col<{ _id: number; name: string }>("companies")).find({ _id: { $in: awaiting.map((q) => q.company_id).filter((x): x is number => !!x) } }).toArray()).map((c) => [c._id, c.name]),
  );

  return {
    leads: { new: newLeads, open: openLeads, thisMonth: monthLeads, confirmed, customNew },
    programs: { published, drafts, views: views[0]?.n ?? 0 },
    quotes: {
      open: openQuotes,
      sentThisMonth,
      acceptanceRate: decided ? Math.round((accepted / decided) * 100) : null,
      awaiting: awaiting.map((q) => ({
        id: q._id as number,
        ref: q.ref as string,
        title: q.title as string,
        status: q.status as string,
        valid_until: q.valid_until as string,
        company_name: q.audience === "company" ? (companyNames.get(q.company_id as number) ?? "—") : ((q.client as { name?: string } | null)?.name ?? "—"),
      })),
      expiringSoon,
    },
    b2bNew,
    recentLeads: recentLeads.map((l) => ({
      id: l._id as number,
      ref: l.ref as string,
      full_name: l.full_name as string,
      program_title: l.program_title as string,
      status: l.status as string,
      created_at: l.created_at as string,
      adults: l.adults as number,
      children: l.children as number,
      kind: l.kind as string,
    })),
    topPrograms: topPrograms.map((p) => ({ id: p._id as number, title_ar: p.title_ar as string, view_count: p.view_count as number, status: p.status as string, leads: leadCounts.get(p._id as number) ?? 0 })),
    departures: departures.slice(0, 6),
  };
}
