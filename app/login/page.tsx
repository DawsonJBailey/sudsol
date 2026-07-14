"use client";

import { Suspense } from "react";
import { useSearchParams } from "next/navigation";

function LoginContent() {
  const searchParams = useSearchParams();
  const error = searchParams.get("error");

  return (
    <div className="max-w-md mx-auto px-6 py-16 text-center">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Account</p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-4">Sign In</h1>
      <p className="text-charcoal/70 mb-8">
        We&apos;ll email you a one-time code — no password needed. New here? Signing in creates
        your account automatically.
      </p>

      {error ? (
        <p className="text-sm text-red-600 mb-6">Sign-in didn&apos;t complete. Please try again.</p>
      ) : null}

      <a
        href="/auth/login"
        className="inline-block w-full rounded-full bg-pine text-parchment px-5 py-3 font-medium hover:bg-pine-dark transition-colors"
      >
        Continue with Email
      </a>

      <p className="text-xs text-charcoal/50 mt-6">
        Sign-in is handled securely by our store platform.
      </p>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense>
      <LoginContent />
    </Suspense>
  );
}
