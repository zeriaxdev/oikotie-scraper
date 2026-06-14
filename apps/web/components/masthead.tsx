import Link from "next/link";

function Mark() {
  // Compact engineering glyph — concentric squares, a nod to the grid.
  return (
    <svg width="22" height="22" viewBox="0 0 22 22" fill="none" aria-hidden>
      <rect x="1.5" y="1.5" width="19" height="19" stroke="currentColor" strokeWidth="1.5" />
      <rect x="6.5" y="6.5" width="9" height="9" stroke="currentColor" strokeWidth="1.5" />
      <path d="M1.5 1.5 11 11M20.5 1.5 11 11M1.5 20.5 11 11M20.5 20.5 11 11" stroke="currentColor" strokeWidth="1.2" />
    </svg>
  );
}

export function Masthead() {
  return (
    <header className="sticky top-0 z-50 border-b border-border bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex max-w-[1400px] items-center justify-between px-4 py-3.5 sm:px-8">
        <Link href="/" className="flex items-center gap-2.5 text-foreground">
          <Mark />
          <span className="display text-xl tracking-tight">Oikotie</span>
        </Link>
        <nav className="flex items-center gap-7 text-sm">
          <Link href="/" className="text-foreground/80 transition-colors hover:text-foreground">
            Market
          </Link>
          <Link href="/search" className="text-foreground/80 transition-colors hover:text-foreground">
            Search
          </Link>
          <a
            href="https://github.com/zeriaxdev/oikotie-scraper"
            target="_blank"
            rel="noreferrer"
            className="text-muted-foreground transition-colors hover:text-foreground"
          >
            Source ↗
          </a>
        </nav>
      </div>
    </header>
  );
}
