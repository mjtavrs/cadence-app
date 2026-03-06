import { CalendarDaysIcon, LayoutDashboardIcon, NotebookTextIcon } from "lucide-react";
import { GrGallery } from "react-icons/gr";

export type NavItem = {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
};

export const navItems: NavItem[] = [
  { href: "/app", label: "Dashboard", icon: LayoutDashboardIcon },
  { href: "/app/posts", label: "Posts", icon: NotebookTextIcon },
  { href: "/app/calendar", label: "Calendario", icon: CalendarDaysIcon },
  { href: "/app/media", label: "Biblioteca de midia", icon: GrGallery },
];

