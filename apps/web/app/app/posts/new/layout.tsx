import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Criar novo post",
};

export default function NewPostLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return children;
}
