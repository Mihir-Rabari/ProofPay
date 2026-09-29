import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ProofPay — Impact, with proof",
  description: "Funds move when the ground proves it.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="en"><body>{children}</body></html>;
}
