import type { Metadata, Viewport } from "next";
import "./globals.css";

export const metadata: Metadata = {
  metadataBase: new URL("https://geocalc.uz"),
  title: {
    default: "GeoCalc — Yer maydoni, Cut & Fill va koordinata kalkulyatori",
    template: "%s · GeoCalc",
  },
  description:
    "WGS84 koordinatalari bo‘yicha yer maydoni, perimetr, Cut & Fill hajmi va koordinata formatlarini sodda va aniq hisoblang.",
  keywords: [
    "GeoCalc",
    "yer maydoni",
    "WGS84",
    "Cut and Fill",
    "geodeziya",
    "koordinata konvertori",
    "UTM",
  ],
  authors: [{ name: "GeoCalc" }],
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    locale: "uz_UZ",
    url: "https://geocalc.uz",
    siteName: "GeoCalc",
    title: "GeoCalc — Geodezik hisoblar sodda tilda",
    description:
      "Yer maydoni, koordinata konvertori, TIN Cut & Fill va GeoAI bir joyda.",
  },
  twitter: {
    card: "summary",
    title: "GeoCalc — Geodezik hisoblar sodda tilda",
    description: "Maydon, koordinata va Cut & Fill kalkulyatori.",
  },
  robots: { index: true, follow: true },
  other: {
    "codex-preview": "development",
  },
  icons: {
    icon: "/favicon.ico",
    shortcut: "/favicon.ico",
    apple: "/favicon.png",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#06100e",
  colorScheme: "dark light",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const structuredData = {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "GeoCalc",
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    url: "https://geocalc.uz",
    description:
      "Yer maydoni, koordinata konvertori va Cut & Fill hajmi uchun geodezik veb ilova.",
  };

  return (
    <html lang="uz" suppressHydrationWarning>
      <body>
        {children}
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
        />
      </body>
    </html>
  );
}
