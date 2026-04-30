import type { Metadata } from "next";
import { IBM_Plex_Mono, Space_Grotesk } from "next/font/google";
import "./globals.css";

const appSans = Space_Grotesk({
  variable: "--font-app-sans",
  subsets: ["latin"],
  display: "swap",
});

const appMono = IBM_Plex_Mono({
  variable: "--font-app-mono",
  subsets: ["latin"],
  weight: ["400", "500"],
  display: "swap",
});

export const metadata: Metadata = {
  title: "AID-32 Match Console",
  description: "Dating MVP app for profile, discovery, matching, and chat",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${appSans.variable} ${appMono.variable}`}>
      <body>{children}</body>
    </html>
  );
}
