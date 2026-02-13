import type { Metadata } from "next";
import { CalendarClient } from "./CalendarClient";

export const metadata: Metadata = {
  title: "Calendário",
};

export default function CalendarPage() {
  return <CalendarClient />;
}

