export type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

const writeRoles = new Set<Role>(["OWNER", "ADMIN", "EDITOR"]);
const approvalRoles = new Set<Role>(["OWNER", "ADMIN"]);

export function canWrite(role: Role) {
  return writeRoles.has(role);
}

export function canManageApproval(role: Role) {
  return approvalRoles.has(role);
}

