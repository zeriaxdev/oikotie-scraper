import "./globals.css";
import type { ReactNode } from "react";
import { Inter } from "next/font/google";
import { Masthead } from "@/components/masthead";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata = {
  title: "Oikotie — Market Report",
  description: "A hedonic valuation of the Finnish rental market.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={inter.variable}>
      <body className="font-sans antialiased min-h-screen">
        <Masthead />
        {children}
        <SiteFooter />
      </body>
    </html>
  );
}

function FooterCell({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="border-t border-l border-border px-5 py-6">
      <div className="eyebrow mb-3">{label}</div>
      <div className="flex flex-col gap-2 text-sm text-muted-foreground">{children}</div>
    </div>
  );
}

function SiteFooter() {
  return (
    <footer className="mx-auto mt-24 max-w-[1400px] px-4 sm:px-8">
      <div className="grid grid-cols-1 border-r border-b border-border sm:grid-cols-2 lg:grid-cols-4">
        <div className="border-t border-l border-border px-5 py-6">
          <div className="display text-xl tracking-tight">Oikotie</div>
          <p className="mt-2 max-w-[22ch] text-sm text-muted-foreground">
            A hedonic reading of the Finnish rental market.
          </p>
        </div>
        <FooterCell label="Method">
          <span>Per-city log-price model</span>
          <span>District fixed effects</span>
          <span>Robust z-scored residuals</span>
        </FooterCell>
        <FooterCell label="Data">
          <span>Public Oikotie listings</span>
          <span>Updated on each crawl</span>
        </FooterCell>
        <FooterCell label="Colophon">
          <span>Inter · Redaction</span>
          <span>Next.js · SQLite · Bun</span>
        </FooterCell>
      </div>
      <p className="px-1 py-5 text-xs text-muted-foreground">
        Model estimates from scraped public listings — not appraisals. © {new Date().getFullYear()}
      </p>
    </footer>
  );
}
