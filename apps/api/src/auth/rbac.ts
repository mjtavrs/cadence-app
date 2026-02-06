export type Role = "OWNER" | "ADMIN" | "EDITOR" | "VIEWER";

const writeRoles = new Set<Role>(["OWNER", "ADMIN", "EDITOR"]);

export function canWrite(role: Role) {
  return writeRoles.has(role);
}

