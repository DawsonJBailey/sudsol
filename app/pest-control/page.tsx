import { getControlProducts } from "@/lib/shopify/catalog";
import PestControlList from "./PestControlList";

export const revalidate = 300;

export default async function PestControlPage() {
  const products = await getControlProducts();

  return (
    <div className="max-w-5xl mx-auto px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Shop</p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-3">Pest Control</h1>
      <p className="text-charcoal/70 max-w-xl mb-10">
        Treatments matched to the most common lawn pests. Not sure what you're dealing
        with? Try the AI pest identifier first.
      </p>

      <PestControlList products={products} />
    </div>
  );
}
