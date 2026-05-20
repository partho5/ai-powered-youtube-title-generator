import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YouTube Title Research",
  description: "Multi-step pipeline that turns a raw concept into 5 ready-to-use YouTube titles.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="bg-yt-bg text-yt-text">
        <header className="border-b border-yt-border bg-white sticky top-0 z-10">
          <div className="max-w-5xl mx-auto px-4 py-3 flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <span
                aria-hidden
                className="inline-flex items-center justify-center w-9 h-6 rounded-md bg-yt-red text-white font-bold text-xs"
              >
                ▶
              </span>
              <span className="font-semibold tracking-tight">
                Title Research
              </span>
            </div>
            <span className="text-yt-muted text-sm hidden sm:inline">
              concept → keywords → trends → competition → titles
            </span>
          </div>
        </header>
        <main className="max-w-5xl mx-auto px-4 py-6">{children}</main>
      </body>
    </html>
  );
}
