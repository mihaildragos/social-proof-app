import type { Metadata } from "next";
import localFont from "next/font/local";
import "./globals.css";
import TanstackClientProvider from "@/components/providers/tanstack-client-provider";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Pulse Social Proof",
  description: "Pulse Social Proof - Social Proof for more sales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
        <TanstackClientProvider>{children}</TanstackClientProvider>
      </body>
    </html>
  );
}
