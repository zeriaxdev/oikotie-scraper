export const config = {
  db: {
    path: process.env.DB_PATH ?? "oikotie.db",
  },
  scraper: {
    pageSize: Number(process.env.SCRAPE_PAGE_SIZE ?? 24),
    delayMs: Number(process.env.SCRAPE_DELAY_MS ?? 1500),
  },
} as const;
