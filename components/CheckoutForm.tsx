"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { PaymentElement, useElements, useStripe } from "@stripe/react-stripe-js";
import { useCart } from "@/components/CartContext";

export default function CheckoutForm() {
  const stripe = useStripe();
  const elements = useElements();
  const { clearCart, subtotal } = useCart();
  const router = useRouter();

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [address, setAddress] = useState("");
  const [zip, setZip] = useState("");
  const [deliveryDate, setDeliveryDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!stripe || !elements) return;

    setSubmitting(true);
    setErrorMessage(null);

    const { error, paymentIntent } = await stripe.confirmPayment({
      elements,
      redirect: "if_required",
      confirmParams: {
        return_url: `${window.location.origin}/order-confirmation`,
        payment_method_data: {
          billing_details: {
            name,
            email,
            address: {
              line1: address,
              postal_code: zip,
              country: "US",
            },
          },
        },
      },
    });

    if (error) {
      setErrorMessage(error.message ?? "Something went wrong processing your payment.");
      setSubmitting(false);
      return;
    }

    if (paymentIntent?.status === "succeeded") {
      clearCart();
      router.push(`/order-confirmation?payment_intent=${paymentIntent.id}`);
      return;
    }

    setErrorMessage("Payment was not completed. Please try again.");
    setSubmitting(false);
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <h2 className="font-display text-xl text-pine mb-2">Shipping details</h2>

      <div>
        <label className="block text-sm font-medium text-charcoal/80 mb-1">Full name</label>
        <input
          required
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal/80 mb-1">Email</label>
        <input
          required
          type="email"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
        />
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal/80 mb-1">Street address</label>
        <input
          required
          type="text"
          value={address}
          onChange={(e) => setAddress(e.target.value)}
          className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium text-charcoal/80 mb-1">ZIP code</label>
          <input
            required
            type="text"
            value={zip}
            onChange={(e) => setZip(e.target.value)}
            className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-charcoal/80 mb-1">Delivery date</label>
          <input
            type="date"
            value={deliveryDate}
            onChange={(e) => setDeliveryDate(e.target.value)}
            className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-charcoal/80 mb-2">Payment</label>
        <PaymentElement />
      </div>

      {errorMessage && <p className="text-sm text-clay">{errorMessage}</p>}

      <button
        type="submit"
        disabled={submitting || !stripe || !elements}
        className="w-full bg-pine text-parchment font-medium py-3 rounded-full hover:bg-pine-dark transition-colors disabled:opacity-60"
      >
        {submitting ? "Placing order…" : `Place Order — $${subtotal.toFixed(2)}`}
      </button>
    </form>
  );
}
