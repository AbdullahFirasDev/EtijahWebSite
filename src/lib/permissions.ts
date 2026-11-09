// Role-based permissions for the staff portal. Shared by server checks (the security
// boundary) and the UI (which only hides what a role cannot use).

export const ROLES = ["admin", "sales", "content"] as const;
export type Role = (typeof ROLES)[number];

export const ROLE_LABELS: Record<Role, string> = {
  admin: "مدير النظام",
  sales: "موظف مبيعات",
  content: "محرر المحتوى",
};

export const ROLE_HINTS: Record<Role, string> = {
  admin: "صلاحيات كاملة، بما فيها المستخدمون والإعدادات والحذف.",
  sales: "طلبات المسافرين، الشركات، وعروض الأسعار. يطّلع على البرامج دون تعديلها.",
  content: "البرامج والكروبات والفنادق والوجهات والخدمات ونشرها. يطّلع على الطلبات فقط.",
};

export type Permission =
  | "catalog.view"
  | "catalog.edit"
  | "catalog.publish"
  | "catalog.delete"
  | "hotels.edit"
  | "media.upload"
  | "leads.view"
  | "leads.manage"
  | "b2b.manage"
  | "b2b.delete"
  | "users.manage"
  | "settings.manage";

const MATRIX: Record<Role, readonly Permission[]> = {
  admin: [
    "catalog.view",
    "catalog.edit",
    "catalog.publish",
    "catalog.delete",
    "hotels.edit",
    "media.upload",
    "leads.view",
    "leads.manage",
    "b2b.manage",
    "b2b.delete",
    "users.manage",
    "settings.manage",
  ],
  content: ["catalog.view", "catalog.edit", "catalog.publish", "hotels.edit", "media.upload", "leads.view"],
  // Sales can add a hotel while building a company quote, but not edit programs.
  sales: ["catalog.view", "hotels.edit", "media.upload", "leads.view", "leads.manage", "b2b.manage"],
};

export function can(role: Role | null | undefined, permission: Permission): boolean {
  return !!role && MATRIX[role].includes(permission);
}

export const isRole = (value: unknown): value is Role => typeof value === "string" && (ROLES as readonly string[]).includes(value);
