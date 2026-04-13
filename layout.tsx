import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "I Have To Poop",
  description: "Emergency restroom finder with smart ranking and live nearby search.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
