import type { Metadata } from "next";
import { JetBrains_Mono, Martian_Mono, IBM_Plex_Sans } from "next/font/google";
import "./globals.css";

const machine = JetBrains_Mono({
  variable: "--font-machine",
  subsets: ["latin"],
  weight: ["400", "500", "700"],
  display: "swap",
});

const display = Martian_Mono({
  variable: "--font-display",
  subsets: ["latin"],
  weight: ["400", "600", "700"],
  display: "swap",
});

const prose = IBM_Plex_Sans({
  variable: "--font-prose",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "PROSE · intent-first programming",
  description:
    "A sentence is source code. PROSE compiles a natural-language intent into a typed, versioned, replayable agent task-graph — then executes it with verification, retries, and a live trace.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${machine.variable} ${display.variable} ${prose.variable}`}
    >
      <body>{children}</body>
    </html>
  );
}
