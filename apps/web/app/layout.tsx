import "./globals.css";
import type { ReactNode } from "react";
import { Fraunces, Hanken_Grotesk } from "next/font/google";
import { Masthead } from "@/components/masthead";

const fraunces = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
});

const hanken = Hanken_Grotesk({
  subsets: ["latin"],
  variable: "--font-hanken",
});

export const metadata = {
  title: "Oikotie — Market Report",
  description: "A hedonic valuation of the Finnish rental market.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${fraunces.variable} ${hanken.variable}`}>
      <body className="font-sans antialiased min-h-screen">
        <Masthead />
        {children}
        <footer className="mx-auto max-w-6xl px-6 py-10 mt-16 rule">
          <p className="text-xs text-muted-foreground">
            Valuations are model estimates from scraped public listings, not appraisals. Compare
            against the listed comparables before drawing conclusions.
          </p>
        </footer>
      </body>
    </html>
  );
}
