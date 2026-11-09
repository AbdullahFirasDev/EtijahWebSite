import "server-only";
import type { Locale } from "@/content/site";
import type { LeadStatus } from "@/lib/travel-labels";
import { all, get, now, run, tx } from "../db";
import { audit, nextRef } from "../security";

export interface LeadRow {
  id: number;
  ref: string;
  program_id: number | null;
  departure_id: number | null;
  program_title: string;
  departure_label: string | null;
  preferred_date: string | null;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  room_type: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  locale: Locale;
  status: LeadStatus;
  assigned_to: number | null;
  source: string;
  created_at: string;
  updated_at: string;
}

export interface NewLead {
  program_id: number;
  departure_id: number | null;
  program_title: string;
  departure_label: string | null;
  preferred_date: string | null;
  adults: number;
  children: number;
  infants: number;
  rooms: number;
  room_type: string | null;
  full_name: string;
  phone: string;
  email: string | null;
  notes: string | null;
  locale: Locale;
  ip_hash: string;
  user_agent: string;
}

export function createLead(input: NewLead): { id: number; ref: string } {
  const t = now();
  return tx(() => {
    const ref = nextRef("REQ");
    const id = run(
      `INSERT INTO leads (ref, program_id, departure_id, program_title, departure_label, preferred_date, adults, children, infants, rooms, room_type,
         full_name, phone, email, notes, locale, ip_hash, user_agent, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      ref, input.program_id, input.departure_id, input.program_title, input.departure_label, input.preferred_date, input.adults, input.children,
      input.infants, input.rooms, input.room_type, input.full_name, input.phone, input.email, input.notes, input.locale, input.ip_hash, input.user_agent, t, t,
    ).id;
    run("INSERT INTO lead_events (lead_id, kind, body, to_status, created_at) VALUES (?, 'created', ?, 'new', ?)", id, "طلب جديد من الموقع", t);
    return { id, ref };
  });
}

export function listLeads(opts: { status?: string; q?: string; programId?: number; limit?: number } = {}) {
  const where: string[] = [];
  const params: (string | number)[] = [];
  if (opts.status === "open") where.push("l.status IN ('new', 'contacted', 'quoted')");
  else if (opts.status) {
    where.push("l.status = ?");
    params.push(opts.status);
  }
  if (opts.programId) {
    where.push("l.program_id = ?");
    params.push(opts.programId);
  }
  if (opts.q) {
    where.push("(l.ref LIKE ? OR l.full_name LIKE ? OR l.phone LIKE ? OR l.program_title LIKE ?)");
    params.push(...Array(4).fill(`%${opts.q}%`));
  }
  params.push(opts.limit ?? 300);
  return all<LeadRow & { assignee: string | null; program_slug: string | null }>(
    `SELECT l.*, u.name AS assignee, p.slug AS program_slug FROM leads l
     LEFT JOIN staff_users u ON u.id = l.assigned_to LEFT JOIN programs p ON p.id = l.program_id
     ${where.length ? `WHERE ${where.join(" AND ")}` : ""}
     ORDER BY CASE l.status WHEN 'new' THEN 0 ELSE 1 END, l.created_at DESC LIMIT ?`,
    ...params,
  );
}

export function getLead(id: number) {
  const lead = get<LeadRow & { assignee: string | null; program_slug: string | null; program_status: string | null }>(
    `SELECT l.*, u.name AS assignee, p.slug AS program_slug, p.status AS program_status FROM leads l
     LEFT JOIN staff_users u ON u.id = l.assigned_to LEFT JOIN programs p ON p.id = l.program_id WHERE l.id = ?`,
    id,
  );
  if (!lead) return null;
  const events = all<{ id: number; kind: string; body: string | null; from_status: string | null; to_status: string | null; created_at: string; user_name: string | null }>(
    `SELECT e.id, e.kind, e.body, e.from_status, e.to_status, e.created_at, u.name AS user_name FROM lead_events e
     LEFT JOIN staff_users u ON u.id = e.user_id WHERE e.lead_id = ? ORDER BY e.created_at DESC, e.id DESC`,
    id,
  );
  return { lead, events };
}

export function updateLead(id: number, change: { status?: LeadStatus; note?: string | null; assigned_to?: number | null }, userId: number) {
  const t = now();
  tx(() => {
    const lead = get<LeadRow>("SELECT * FROM leads WHERE id = ?", id);
    if (!lead) throw new Error("not found");
    if (change.status && change.status !== lead.status) {
      run("UPDATE leads SET status = ?, updated_at = ? WHERE id = ?", change.status, t, id);
      run(
        "INSERT INTO lead_events (lead_id, user_id, kind, from_status, to_status, body, created_at) VALUES (?, ?, 'status', ?, ?, ?, ?)",
        id, userId, lead.status, change.status, change.note ?? null, t,
      );
    } else if (change.note) {
      run("INSERT INTO lead_events (lead_id, user_id, kind, body, created_at) VALUES (?, ?, 'note', ?, ?)", id, userId, change.note, t);
      run("UPDATE leads SET updated_at = ? WHERE id = ?", t, id);
    }
    if (change.assigned_to !== undefined && change.assigned_to !== lead.assigned_to) {
      run("UPDATE leads SET assigned_to = ?, updated_at = ? WHERE id = ?", change.assigned_to, t, id);
      const name = change.assigned_to ? get<{ name: string }>("SELECT name FROM staff_users WHERE id = ?", change.assigned_to)?.name : null;
      run("INSERT INTO lead_events (lead_id, user_id, kind, body, created_at) VALUES (?, ?, 'assigned', ?, ?)", id, userId, name ? `أُسند إلى ${name}` : "أُلغي الإسناد", t);
    }
    audit(userId, "update", "lead", id, change);
  });
}

export function logLeadContact(id: number, userId: number, channel: string) {
  run("INSERT INTO lead_events (lead_id, user_id, kind, body, created_at) VALUES (?, ?, 'contact', ?, ?)", id, userId, channel, now());
}

export const countNewLeads = () => get<{ n: number }>("SELECT COUNT(*) AS n FROM leads WHERE status = 'new'")!.n;
