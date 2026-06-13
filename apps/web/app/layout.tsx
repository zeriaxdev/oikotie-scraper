import "./globals.css";
import type { ReactNode } from "react";

export const metadata = {
  title: "oikotie analyzer",
  description: "Apartment market analysis powered by a hedonic pricing model",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <header className="top">
          <div className="wrap">
            <a href="/" className="brand">
              oikotie <span>analyzer</span>
            </a>
            <div className="grow" />
            <span className="stat">Next.js · reads oikotie.db directly</span>
          </div>
        </header>
        {children}
      </body>
    </html>
  );
}
