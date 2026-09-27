import { notFound } from "next/navigation";
import { isLocale, type Locale } from "@/i18n";

export function generateStaticParams() {
  return [{ locale: "de" }, { locale: "en" }];
}

export default async function LocaleLayout({
  children,
  params
}: Readonly<{
  children: React.ReactNode;
  params: Promise<{ locale: string }>;
}>) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();

  return <div lang={locale as Locale}>{children}</div>;
}
