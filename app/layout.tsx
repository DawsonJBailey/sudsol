import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartProvider } from "@/components/CartContext";
import ChunkErrorRecovery from "@/components/ChunkErrorRecovery";

export const metadata: Metadata = {
  title: "Meridian Turf Co.",
  description: "Research-backed turfgrass varieties for home lawns and beyond.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        <ChunkErrorRecovery />
        <CartProvider>
          <Header />
          <main>{children}</main>
          <Footer />
        </CartProvider>
      </body>
    </html>
  );
}
