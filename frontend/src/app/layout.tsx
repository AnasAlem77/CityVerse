import type { Metadata } from "next";

import "./globals.css";

import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import ThemeProvider from "@/components/ThemeProvider/ThemeProvider";

export const metadata: Metadata = {
  metadataBase: new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "http://localhost:3000"),
  title: {
    default: "CityVerse",
    template: "%s | CityVerse",
  },
  description:
    "Discover amazing cities, places and experiences around the world.",
  applicationName: "CityVerse",
  icons: { icon: "/favicon.ico" },
  openGraph: {
    type: "website",
    siteName: "CityVerse",
    title: "CityVerse",
    description: "Discover amazing cities, places and experiences around the world.",
  },
  twitter: {
    card: "summary",
    title: "CityVerse",
    description: "Discover amazing cities, places and experiences around the world.",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      dir="ltr"
      suppressHydrationWarning
      className="font-sans"
    >
      <body className="min-h-screen">
        <ThemeProvider>
          <Navbar />

          <main className="min-h-screen">
            {children}
          </main>

          <Footer />
        </ThemeProvider>
      </body>
    </html>
  );
}
