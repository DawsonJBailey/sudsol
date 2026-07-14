import type { Metadata } from "next";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import { CartProvider } from "@/components/CartContext";
import ChunkErrorRecovery from "@/components/ChunkErrorRecovery";
import LawnAssistant from "@/components/LawnAssistant";
import { getProducts } from "@/lib/shopify/catalog";

export const metadata: Metadata = {
  title: "Meridian Turf Co.",
  description: "Research-backed turfgrass varieties for home lawns and beyond.",
};

export const revalidate = 300;

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  // Search index for the header; a catalog outage shouldn't take down every page.
  let searchProducts: { slug: string; name: string; tagline: string }[] = [];
  try {
    searchProducts = (await getProducts()).map((p) => ({
      slug: p.slug,
      name: p.name,
      tagline: p.tagline,
    }));
  } catch (e) {
    console.error("Failed to load products for search:", e);
  }

  return (
    <html lang="en">
      <body className="min-h-screen flex flex-col">
        <ChunkErrorRecovery />
        <CartProvider>
          <Header searchProducts={searchProducts} />
          <main className="flex-1">{children}</main>
          <Footer />
          <LawnAssistant />
        </CartProvider>
      </body>
    </html>
  );
}
