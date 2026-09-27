import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Staff sales",
  robots: { index: false, follow: false },
};

export default function StaffLayout({ children }: { children: React.ReactNode }) {
  return children;
}
