import type { Metadata } from "next";
import { Barlow_Condensed, Outfit, Source_Serif_4 } from "next/font/google";
import "./globals.css";

const outfit = Outfit({
  variable: "--font-outfit",
  subsets: ["latin"],
});

const barlow = Barlow_Condensed({
  variable: "--font-barlow",
  subsets: ["latin"],
  weight: ["500", "600", "700"],
});

const source = Source_Serif_4({
  variable: "--font-source",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "T20 Simulator",
  description: "Ball-by-ball T20 match simulation from team averages and player targets.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" className={`${outfit.variable} ${barlow.variable} ${source.variable} h-full antialiased`}>
      <body className="min-h-full">{children}</body>
    </html>
  );
}
