import type { Metadata } from "next";

import {
  Inter,
  Noto_Kufi_Arabic,
} from "next/font/google";

import "./globals.css";

import Navbar from "@/components/Navbar/Navbar";
import Footer from "@/components/Footer/Footer";
import ThemeProvider from "@/components/ThemeProvider/ThemeProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
  display: "swap",
});

const notoKufiArabic = Noto_Kufi_Arabic({
  variable: "--font-arabic",
  subsets: ["arabic"],
  display: "swap",
  weight: ["400", "500", "600", "700"],
});

export const metadata: Metadata = {
  title: "CityVerse",
  description:
    "Discover amazing cities, places and experiences around the world.",
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
      className={`${inter.variable} ${notoKufiArabic.variable}`}
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