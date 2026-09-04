import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Outpost",
  description: "Scheduled email, and eventually everything else.",
};

const NAV = [
  ["/", "Compose"],
  ["/contacts", "Contacts"],
  ["/templates", "Templates"],
] as const;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <div className="mx-auto max-w-3xl px-5 py-8">
          <header className="mb-8 flex flex-wrap items-baseline gap-x-5 gap-y-2 border-b border-black/10 pb-3 dark:border-white/10">
            <a href="/" className="text-lg font-semibold tracking-tight">
              Outpost
            </a>
            <nav className="flex gap-4 text-xs uppercase tracking-widest">
              {NAV.map(([href, title]) => (
                <a key={href} href={href} className="opacity-50 hover:opacity-100">
                  {title}
                </a>
              ))}
            </nav>
          </header>
          {children}
        </div>
      </body>
    </html>
  );
}
