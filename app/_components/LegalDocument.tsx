import Link from "next/link";

type LegalSection = {
  title: string;
  paragraphs: string[];
};

type LegalBulletSection = {
  title: string;
  items: string[];
};

type LegalFaqItem = {
  question: string;
  answer: string;
};

type LegalDocumentProps = {
  activeDocument: "privacy" | "terms" | "what-is-this";
  eyebrow: string;
  title: string;
  description: string;
  lastUpdated: string;
  sections: LegalSection[];
  bulletSections?: LegalBulletSection[];
  faqItems?: LegalFaqItem[];
};

const DOCUMENT_LINKS = [
  { href: "/privacy", label: "Privacy Policy", key: "privacy" },
  { href: "/terms", label: "Terms of Service", key: "terms" },
  { href: "/what-is-this", label: "What Is This?", key: "what-is-this" },
] as const;

export default function LegalDocument({
  activeDocument,
  eyebrow,
  title,
  description,
  lastUpdated,
  sections,
  bulletSections = [],
  faqItems = [],
}: LegalDocumentProps) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="motion-ambient absolute left-[-7rem] top-20 h-72 w-72 rounded-full bg-blue-500/12 blur-3xl" />
        <div className="motion-ambient-slow absolute right-[-6rem] top-1/3 h-80 w-80 rounded-full bg-cyan-400/10 blur-3xl" />
        <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/12 to-transparent" />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-6xl flex-col gap-4 px-6 py-6 sm:flex-row sm:items-center sm:justify-between lg:px-8">
        <Link
          href="/"
          className="text-2xl font-[800] uppercase tracking-widest transition-opacity hover:opacity-80"
        >
          oneflash
        </Link>

        <nav className="flex flex-wrap items-center gap-3 text-sm font-medium">
          {DOCUMENT_LINKS.map((link) => {
            const isActive = link.key === activeDocument;

            return (
              <Link
                key={link.href}
                href={link.href}
                prefetch={false}
                className={`rounded-full border px-4 py-2 transition-colors ${
                  isActive
                    ? "border-blue-500/60 bg-blue-500/10 text-blue-400"
                    : "border-border bg-surface text-muted-foreground hover:border-border-strong hover:text-foreground"
                }`}
              >
                {link.label}
              </Link>
            );
          })}
        </nav>
      </header>

      <main className="relative z-10 mx-auto flex w-full max-w-4xl flex-col gap-8 px-6 pb-16 pt-4 lg:px-8">
        <section className="rounded-[2rem] border border-border-strong bg-surface/95 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.18)] sm:p-10">
          <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-400">
            {eyebrow}
          </p>
          <h1 className="mt-4 font-outfit text-4xl font-[800] tracking-tight sm:text-5xl">
            {title}
          </h1>
          <p className="mt-4 max-w-3xl text-base leading-7 text-muted-foreground sm:text-lg">
            {description}
          </p>
          <p className="mt-4 text-sm font-medium text-muted">
            Last updated: {lastUpdated}
          </p>
        </section>

        <section className="space-y-5 rounded-[2rem] border border-border bg-surface-soft/90 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:p-10">
          {sections.map((section) => (
            <article
              key={section.title}
              className="border-b border-border/70 pb-5 last:border-b-0 last:pb-0"
            >
              <h2 className="text-xl font-semibold tracking-tight text-foreground">
                {section.title}
              </h2>
              <div className="mt-3 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
                {section.paragraphs.map((paragraph) => (
                  <p key={paragraph}>{paragraph}</p>
                ))}
              </div>
            </article>
          ))}
        </section>

        {bulletSections.length > 0 ? (
          <section className="space-y-5 rounded-[2rem] border border-border bg-surface-soft/90 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:p-10">
            {bulletSections.map((section) => (
              <article
                key={section.title}
                className="border-b border-border/70 pb-5 last:border-b-0 last:pb-0"
              >
                <h2 className="text-xl font-semibold tracking-tight text-foreground">
                  {section.title}
                </h2>
                <ul className="mt-4 space-y-3 text-sm leading-7 text-muted-foreground sm:text-base">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-3">
                      <span className="mt-2 h-2 w-2 flex-none rounded-full bg-blue-400" />
                      <span>{item}</span>
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </section>
        ) : null}

        {faqItems.length > 0 ? (
          <section className="space-y-4 rounded-[2rem] border border-border bg-surface-soft/90 p-8 shadow-[0_24px_60px_rgba(15,23,42,0.12)] sm:p-10">
            <div>
              <p className="text-sm font-semibold uppercase tracking-[0.24em] text-blue-400">
                FAQ
              </p>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-foreground sm:text-3xl">
                Frequently asked questions
              </h2>
            </div>

            {faqItems.map((item) => (
              <article
                key={item.question}
                className="rounded-[1.5rem] border border-border bg-surface px-5 py-5"
              >
                <h3 className="text-base font-semibold text-foreground sm:text-lg">
                  {item.question}
                </h3>
                <p className="mt-2 text-sm leading-7 text-muted-foreground sm:text-base">
                  {item.answer}
                </p>
              </article>
            ))}
          </section>
        ) : null}
      </main>
    </div>
  );
}
