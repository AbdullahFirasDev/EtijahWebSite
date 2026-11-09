import {
  DEPARTURE_STATUS_LABELS,
  LEAD_STATUS_LABELS,
  PROGRAM_STATUS_LABELS,
  QUOTE_STATUS_LABELS,
  type DepartureStatus,
  type LeadStatus,
  type ProgramStatus,
  type QuoteStatus,
} from "@/lib/travel-labels";
import { Badge } from "./ui";

const PROGRAM_TONES = { draft: "muted", published: "success", paused: "accent", archived: "neutral" } as const;
const LEAD_TONES = { new: "accent", contacted: "brand", quoted: "brand", confirmed: "success", cancelled: "neutral", lost: "muted" } as const;
const QUOTE_TONES = { draft: "muted", sent: "brand", viewed: "brand", accepted: "success", rejected: "danger", changes_requested: "accent", expired: "neutral" } as const;
const DEPARTURE_TONES = { open: "brand", guaranteed: "success", full: "accent", closed: "neutral", cancelled: "danger" } as const;

export const ProgramStatusBadge = ({ status }: { status: ProgramStatus }) => <Badge tone={PROGRAM_TONES[status]}>{PROGRAM_STATUS_LABELS[status]}</Badge>;
export const LeadStatusBadge = ({ status }: { status: LeadStatus }) => <Badge tone={LEAD_TONES[status]}>{LEAD_STATUS_LABELS[status]}</Badge>;
export const QuoteStatusBadge = ({ status }: { status: QuoteStatus }) => <Badge tone={QUOTE_TONES[status]}>{QUOTE_STATUS_LABELS[status].ar}</Badge>;
export const DepartureStatusBadge = ({ status }: { status: DepartureStatus }) => <Badge tone={DEPARTURE_TONES[status]}>{DEPARTURE_STATUS_LABELS[status].ar}</Badge>;
