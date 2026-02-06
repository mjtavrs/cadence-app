import { CalendarDaysIcon, ImageIcon, LayoutDashboardIcon, NotebookTextIcon } from "lucide-react";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const navItems: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/app/posts", label: "Posts", icon: NotebookTextIcon },
  { href: "/app/calendar", label: "Calendário", icon: CalendarDaysIcon },
  { href: "/app/media", label: "Mídia", icon: ImageIcon },
];

