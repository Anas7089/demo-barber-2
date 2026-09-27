import Link from "next/link";
import { business } from "@/config/business";
import { getMessages, isLocale } from "@/i18n";
import { notFound } from "next/navigation";

export default async function Home({ params }: { params: Promise<{ locale: string }> }) {
  const { locale } = await params;
  if (!isLocale(locale)) notFound();
  const t = getMessages(locale);

  return (
    <main className="min-h-screen px-6 py-10 md:px-12">
      <div className="mx-auto flex min-h-[80vh] max-w-5xl flex-col justify-between rounded-[2rem] border border-black/10 bg-[var(--surface)] p-7 shadow-sm md:p-12">
        <header className="flex items-center justify-between gap-4">
          <strong className="text-xl tracking-tight">{business.name}</strong>
          <nav className="flex gap-2 text-sm" aria-label="Language switcher">
            <Link className="rounded-full border px-3 py-1" href="/de">DE</Link>
            <Link className="rounded-full border px-3 py-1" href="/en">EN</Link>
          </nav>
        </header>

        <section className="max-w-3xl py-20">
          <p className="mb-4 text-sm uppercase tracking-[0.2em] text-[var(--accent)]">{t.brandTagline}</p>
          <h1 className="text-5xl font-semibold leading-[0.95] tracking-tight md:text-7xl">{t.stageTitle}</h1>
          <p className="mt-6 max-w-2xl text-lg leading-8 text-[var(--muted)]">{t.stageBody}</p>
          <button className="mt-8 rounded-full bg-black px-6 py-3 font-medium text-white" type="button">
            {t.bookAppointment}
          </button>
        </section>

        <footer className="flex flex-wrap gap-x-8 gap-y-2 border-t border-black/10 pt-6 text-sm text-[var(--muted)]">
          <span>{business.country}</span>
          <span>{business.currency} · incl. VAT</span>
          <span>{business.timezone}</span>
        </footer>
      </div>
    </main>
  );
}
