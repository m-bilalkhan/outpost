import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Outpost",
  description: "Scheduled email, and eventually everything else.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-3xl px-5 py-8">
          <header className="mb-8 flex items-baseline justify-between border-b border-black/10 pb-3 dark:border-white/10">
            <a href="/" className="text-lg font-semibold tracking-tight">
              Outpost
            </a>
            <span className="text-xs uppercase tracking-widest opacity-50">
              scheduled mail
            </span>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
