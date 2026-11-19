import type { Locale } from "@/content/site";

type L = Record<Locale, string>;

export const BOARDS = ["RO", "BB", "HB", "FB", "AI"] as const;
export type Board = (typeof BOARDS)[number];
export const BOARD_LABELS: Record<Board, L> = {
  RO: { ar: "بدون وجبات", en: "Room only" },
  BB: { ar: "إفطار", en: "Bed & breakfast" },
  HB: { ar: "نصف إقامة (إفطار وعشاء)", en: "Half board" },
  FB: { ar: "إقامة كاملة (3 وجبات)", en: "Full board" },
  AI: { ar: "شامل كلياً", en: "All inclusive" },
};

/**
 * fixed  — a public program organised in advance, with set departure/return dates and seats.
 * custom — no fixed date: the traveler describes the trip and staff build a tailored quote.
 */
export const PROGRAM_TYPES = ["fixed", "custom"] as const;
export type ProgramType = (typeof PROGRAM_TYPES)[number];
export const TYPE_LABELS: Record<ProgramType, L> = {
  fixed: { ar: "برنامج عام", en: "Scheduled trip" },
  custom: { ar: "برنامج خاص", en: "Tailor-made trip" },
};
export const TYPE_HINTS: Record<ProgramType, string> = {
  fixed: "برنامج تنظمه الشركة مسبقاً بتاريخ سفر وعودة محددين وعدد مقاعد، مع خيارات فنادق وأسعار نهائية.",
  custom: "بدون تاريخ ثابت: المسافر يحدد رغبته وموعده عبر نموذج الطلب، والموظف يبني له عرض سعر مخصصاً.",
};

export const VISIBILITIES = ["public", "unlisted"] as const;
export type Visibility = (typeof VISIBILITIES)[number];
export const VISIBILITY_LABELS: Record<Visibility, string> = {
  public: "عام: يظهر في قائمة البرامج بالموقع",
  unlisted: "مخفي: يُفتح بالرابط المستقل فقط",
};

export const PROGRAM_STATUSES = ["draft", "published", "paused", "archived"] as const;
export type ProgramStatus = (typeof PROGRAM_STATUSES)[number];
export const PROGRAM_STATUS_LABELS: Record<ProgramStatus, string> = {
  draft: "مسودة",
  published: "منشور",
  paused: "موقوف مؤقتاً",
  archived: "مؤرشف",
};

export const DEPARTURE_STATUSES = ["open", "guaranteed", "full", "closed", "cancelled"] as const;
export type DepartureStatus = (typeof DEPARTURE_STATUSES)[number];
export const DEPARTURE_STATUS_LABELS: Record<DepartureStatus, L> = {
  open: { ar: "متاح للحجز", en: "Open" },
  guaranteed: { ar: "مؤكد الانطلاق", en: "Guaranteed departure" },
  full: { ar: "مكتمل", en: "Sold out" },
  closed: { ar: "الحجز مغلق", en: "Booking closed" },
  cancelled: { ar: "ملغى", en: "Cancelled" },
};

export const LEAD_KINDS = ["program", "custom"] as const;
export type LeadKind = (typeof LEAD_KINDS)[number];
export const LEAD_KIND_LABELS: Record<LeadKind, string> = { program: "حجز برنامج عام", custom: "طلب برنامج خاص" };

export const LEAD_STATUSES = ["new", "contacted", "quoted", "confirmed", "cancelled", "lost"] as const;
export type LeadStatus = (typeof LEAD_STATUSES)[number];
export const LEAD_STATUS_LABELS: Record<LeadStatus, string> = {
  new: "جديد",
  contacted: "تم التواصل",
  quoted: "أُرسل السعر",
  confirmed: "مؤكد",
  cancelled: "ملغى",
  lost: "لم يكتمل",
};

export const ROOM_TYPES = ["double", "twin", "triple", "single", "family"] as const;
export type RoomType = (typeof ROOM_TYPES)[number];
export const ROOM_TYPE_LABELS: Record<RoomType, L> = {
  double: { ar: "مزدوجة", en: "Double" },
  twin: { ar: "سريران منفصلان", en: "Twin" },
  triple: { ar: "ثلاثية", en: "Triple" },
  single: { ar: "مفردة", en: "Single" },
  family: { ar: "عائلية", en: "Family" },
};

export const QUOTE_STATUSES = ["draft", "sent", "viewed", "accepted", "rejected", "changes_requested", "expired"] as const;
export type QuoteStatus = (typeof QUOTE_STATUSES)[number];
export const QUOTE_STATUS_LABELS: Record<QuoteStatus, L> = {
  draft: { ar: "مسودة", en: "Draft" },
  sent: { ar: "مُرسل", en: "Sent" },
  viewed: { ar: "تمت مشاهدته", en: "Viewed" },
  accepted: { ar: "مقبول", en: "Accepted" },
  rejected: { ar: "مرفوض", en: "Declined" },
  changes_requested: { ar: "طُلب تعديله", en: "Changes requested" },
  expired: { ar: "منتهي الصلاحية", en: "Expired" },
};

export const ITEM_UNITS = ["person", "child", "room", "group", "night", "unit"] as const;
export const UNIT_LABELS: Record<(typeof ITEM_UNITS)[number], L> = {
  person: { ar: "للشخص", en: "per person" },
  child: { ar: "للطفل", en: "per child" },
  room: { ar: "للغرفة", en: "per room" },
  group: { ar: "للمجموعة", en: "per group" },
  night: { ar: "لليلة", en: "per night" },
  unit: { ar: "للوحدة", en: "per unit" },
};

export const PRICING_MODE_LABELS = {
  per_person: { ar: "للشخص", en: "per person" },
  per_room: { ar: "للغرفة", en: "per room" },
  per_group: { ar: "للمجموعة كاملة", en: "for the whole group" },
} as const;

/** Lucide icon keys offered for services (see components/travel/ServiceIcon.tsx). */
export const SERVICE_ICONS = ["plane", "hotel", "meals", "transfer", "tours", "guide", "visa", "insurance", "ticket", "ship", "train", "camera", "sim", "check"] as const;
export type ServiceIcon = (typeof SERVICE_ICONS)[number];

export const RATE_BASIS_LABELS = {
  per_person: { ar: "للشخص", en: "per person" },
  per_room: { ar: "للغرفة", en: "per room" },
} as const;

export const pick = (locale: Locale, ar: string | null | undefined, en: string | null | undefined) =>
  (locale === "en" ? en || ar : ar || en) ?? "";
