import type { Metadata, Viewport } from "next";
import { Montserrat } from "next/font/google";
import "./globals.css";
import AnalyticsClient from "@/components/AnalyticsClient";

const montserrat = Montserrat({
  subsets: ["latin"],
  variable: "--font-montserrat",
});

export const metadata: Metadata = {
  title: "The Wolf Network",
  description: "Relief. Discretion. Precision.",
  icons: {
    icon: "/wolf.svg",
    apple: "/wolf.svg",
  },
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1A1A1A",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${montserrat.variable} font-sans antialiased bg-background text-main-text`}> 
        <AnalyticsClient />
        {children}
      </body>
    </html>
  );
}
