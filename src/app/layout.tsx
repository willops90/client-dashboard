import type { Metadata, Viewport } from "next";
import { Archivo, Fraunces } from "next/font/google";
import "@/styles/globals.css";

// Self-hosted at build time, so no request goes to Google when a client loads the page.
const archivo = Archivo({ subsets: ["latin"], axes: ["wdth"], variable: "--font-archivo", display: "swap" });
// Only for the Owner Optional wordmark, matching the marketing site.
const fraunces = Fraunces({ subsets: ["latin"], weight: ["600"], style: ["normal", "italic"], variable: "--font-brand", display: "swap" });

export const metadata: Metadata = {
  title: { default: "LEAP dashboard", template: "%s · Owner Optional" },
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#EEF2F1" },
    { media: "(prefers-color-scheme: dark)", color: "#10181D" },
  ],
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en-AU" className={`${archivo.variable} ${fraunces.variable}`}>
      <body>{children}</body>
    </html>
  );
}
