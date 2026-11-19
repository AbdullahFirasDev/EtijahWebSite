// Role-based permissions for the staff portal. Shared by server checks (the security
// boundary) and the UI (which only hides what a role cannot use).

export const ROLES = ["admin", "tourism_manager", "sales", "accountant", "content"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  tourism_manager: "مدير السياحة",
  sales: "موظف مبيعات",
  accountant: "محاسب / مسؤول العمولات",
  content: "مدير المحتوى",
};

export const ROLE_HINTS: Record<Role, string> = {
  admin: "صلاحيات كاملة، بما فيها المستخدمون والإعدادات والحذف.",
  tourism_manager: "الفنادق وأسعارها، الوجهات، البرامج والكروبات وأسعارها ونشرها، وطلبات المسافرين.",
  sales: "طلبات المسافرين، الشركات وحساباتها، وعروض الأسعار. يطّلع على الفنادق والبرامج دون تعديلها.",
  accountant: "شركات الطيران، عمولات الشركات وعمولات الاتجاه، سجلات الإصدار والتسديد، والتقارير المالية.",
  content: "صور ونصوص البرامج والوجهات والخدمات ونشرها، دون تعديل الأسعار.",
};

export const PERMISSIONS = [
  "portal.view",
  // Tourism programs
  "programs.view",
  "programs.edit",
  "programs.pricing",
  "programs.publish",
  "programs.delete",
  "pricing.override",
  "destinations.edit",
  "services.edit",
  "media.upload",
  // Hotels library
  "hotels.view",
  "hotels.edit",
  "hotels.rates",
  "hotels.costs",
  // Traveler requests
  "leads.view",
  "leads.manage",
  // B2B
  "b2b.view",
  "b2b.manage",
  "b2b.users",
  "b2b.delete",
  "quotes.manage",
  // Airlines & commissions
  "airlines.view",
  "airlines.edit",
  "commissions.manage",
  "tickets.view",
  "tickets.manage",
  "reports.finance",
  // Administration
  "users.manage",
  "settings.manage",
  "audit.view",
] as const;
export type Permission = (typeof PERMISSIONS)[number];

const MATRIX: Record<Role, readonly Permission[]> = {
  admin: PERMISSIONS,
  tourism_manager: [
    "portal.view",
    "programs.view",
    "programs.edit",
    "programs.pricing",
    "programs.publish",
    "programs.delete",
    "pricing.override",
    "destinations.edit",
    "services.edit",
    "media.upload",
    "hotels.view",
    "hotels.edit",
    "hotels.rates",
    "hotels.costs",
    "leads.view",
    "leads.manage",
    "airlines.view",
  ],
  sales: [
    "portal.view",
    "programs.view",
    "media.upload",
    "hotels.view",
    "hotels.costs",
    "leads.view",
    "leads.manage",
    "b2b.view",
    "b2b.manage",
    "b2b.users",
    "quotes.manage",
    "airlines.view",
  ],
  accountant: [
    "portal.view",
    "programs.view",
    "hotels.view",
    "b2b.view",
    "airlines.view",
    "airlines.edit",
    "commissions.manage",
    "tickets.view",
    "tickets.manage",
    "reports.finance",
  ],
  content: ["portal.view", "programs.view", "programs.edit", "programs.publish", "destinations.edit", "services.edit", "media.upload", "hotels.view", "leads.view"],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && (MATRIX[role] ?? []).includes(permission);
}

export const isRole = (value: unknown): value is Role => typeof value === "string" && (ROLES as readonly string[]).includes(value);

// ------------------------------------------------------------------ B2B company users
/** What the administration allows each company user to do in the partner portal. */
export const COMPANY_PERMISSIONS = ["hotels.view", "requests.create", "quotes.view", "quotes.respond"] as const;
export type CompanyPermission = (typeof COMPANY_PERMISSIONS)[number];
export const COMPANY_PERMISSION_LABELS: Record<CompanyPermission, string> = {
  "hotels.view": "تصفح الفنادق والأسعار المخصصة للشركة",
  "requests.create": "إرسال طلبات برامج وعروض أسعار",
  "quotes.view": "مشاهدة عروض الأسعار الخاصة بالشركة",
  "quotes.respond": "قبول العروض أو طلب تعديلها",
};
