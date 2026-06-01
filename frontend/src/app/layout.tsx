import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Navbar } from "@/components/layout/navbar";
import { Footer } from "@/components/layout/footer";
import { Providers } from "@/lib/providers";
import { Toaster } from "sonner";

import { AIRLINE_NAME, AIRLINE_DESCRIPTION, AIRLINE_KEYWORDS } from "@/lib/branding";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-sans",
});

export const metadata: Metadata = {
  title: {
    default: AIRLINE_NAME,
    template: `%s | ${AIRLINE_NAME}`,
  },
  description: AIRLINE_DESCRIPTION,
  keywords: AIRLINE_KEYWORDS,
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="dark">
      <body className={`${inter.variable} font-sans antialiased`}>
        <Providers>
          <div className="flex min-h-screen flex-col">
            <Navbar />
            <main className="flex-1">{children}</main>
            <Footer />
          </div>
          <Toaster
            position="top-right"
            richColors
            theme="dark"
            toastOptions={{
              style: {
                background: "oklch(0.18 0.008 160)",
                border: "1px solid oklch(0.30 0.015 160)",
              },
            }}
          />
        </Providers>
      </body>
    </html>
  );
}
