import Link from "next/link";

export default function Footer() {
  return (
    <footer className="bg-pine text-parchment/80">
      <div className="max-w-6xl mx-auto px-6 py-12 flex flex-col md:flex-row md:justify-center md:items-center gap-10 md:gap-20 text-center md:text-left">
        <div className="md:max-w-xs">
          <h3 className="font-display text-xl text-parchment mb-3">Meridian Turf Co.</h3>
          <p className="text-sm leading-relaxed">
            Research-backed turfgrass varieties for home lawns, sports fields, and commercial landscapes.
          </p>
        </div>
        <div className="flex gap-16">
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gold-light mb-3">Shop</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/shop/sod" className="hover:text-parchment transition-colors">
                  Sod
                </Link>
              </li>
              <li>
                <Link href="/shop/seed" className="hover:text-parchment transition-colors">
                  Seed
                </Link>
              </li>
              <li>
                <Link href="/shop/plugs" className="hover:text-parchment transition-colors">
                  Plugs
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="text-sm font-semibold uppercase tracking-wide text-gold-light mb-3">Resources</h4>
            <ul className="space-y-2 text-sm">
              <li>
                <Link href="/guides" className="hover:text-parchment transition-colors">
                  Lawn Guides
                </Link>
              </li>
              <li>
                <Link href="/orders" className="hover:text-parchment transition-colors">
                  Order Status
                </Link>
              </li>
              <li>
                <Link href="/contact" className="hover:text-parchment transition-colors">
                  Contact Support
                </Link>
              </li>
            </ul>
          </div>
        </div>
      </div>
      <div className="border-t border-parchment/10 py-4 text-center text-xs text-parchment/50">
        This is a fictional demo brand built to showcase frontend engineering — not affiliated with any real company.
      </div>
    </footer>
  );
}
