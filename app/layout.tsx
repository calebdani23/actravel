import type { Metadata } from "next";
import { Geist } from "next/font/google";
import { getSiteUrl } from "@/lib/seo/public-seo";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: getSiteUrl(),
  title: {
    default: "AC Travel",
    template: "%s | AC Travel",
  },
  description: "AC Travel — Suma viajes, suma experiencias, suma sueños.",
  icons: {
    icon: [
      { url: "/brand/ac-travel-logo-500x500-v3.png", type: "image/png", sizes: "500x500" },
      { url: "/brand/ac-travel-logo-500x500-v3.png", rel: "shortcut icon", type: "image/png", sizes: "500x500" },
    ],
    apple: [{ url: "/brand/ac-travel-logo-500x500-v3.png", type: "image/png", sizes: "500x500" }],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className={`${geistSans.variable} min-h-screen antialiased`}>{children}</body>
    </html>
  );
}
