"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/utils/supabase/client";
import PasswordStrengthMeter, { getPasswordStrength } from "@/components/PasswordStrengthMeter";
import { COUNTRY_CODES } from "@/lib/countryCodes";

export default function LoginPage() {
  const router = useRouter();
  const supabase = createClient();

  const [mode, setMode] = useState<"sign-in" | "sign-up">("sign-in");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [countryIso, setCountryIso] = useState("US");
  const [phone, setPhone] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const dialCode = COUNTRY_CODES.find((c) => c.iso === countryIso)?.dial ?? "+1";

  function resetForm() {
    setFirstName("");
    setLastName("");
    setPhone("");
    setPassword("");
    setConfirmPassword("");
    setError(null);
    setMessage(null);
  }

  async function handleGoogle() {
    setError(null);
    await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    });
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setMessage(null);

    if (mode === "sign-up") {
      if (!firstName.trim() || !lastName.trim()) {
        setError("Please enter your first and last name.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords do not match.");
        return;
      }
      if (getPasswordStrength(password).score < 3) {
        setError("Please choose a stronger password.");
        return;
      }

      setLoading(true);
      const { error } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            first_name: firstName.trim(),
            last_name: lastName.trim(),
            full_name: `${firstName.trim()} ${lastName.trim()}`.trim(),
            ...(phone.trim() ? { phone: `${dialCode} ${phone.trim()}` } : {}),
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      setLoading(false);
      if (error) {
        setError(error.message);
        return;
      }
      setMessage("Check your email to confirm your account.");
      return;
    }

    setLoading(true);
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (error) {
      setError(error.message);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <div className="max-w-md mx-auto px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">
        {mode === "sign-in" ? "Welcome back" : "Create an account"}
      </p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-8">
        {mode === "sign-in" ? "Sign In" : "Sign Up"}
      </h1>

      <button
        type="button"
        onClick={handleGoogle}
        className="w-full flex items-center justify-center gap-3 rounded-lg border border-pine/20 bg-white px-4 py-2.5 font-medium text-charcoal/80 hover:bg-parchment transition-colors mb-6"
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path
            fill="#4285F4"
            d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.9c1.7-1.57 2.7-3.88 2.7-6.62z"
          />
          <path
            fill="#34A853"
            d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.9-2.26c-.8.54-1.84.86-3.06.86-2.35 0-4.34-1.59-5.05-3.72H.9v2.33A9 9 0 0 0 9 18z"
          />
          <path
            fill="#FBBC05"
            d="M3.95 10.7A5.4 5.4 0 0 1 3.66 9c0-.59.1-1.17.29-1.7V4.97H.9A9 9 0 0 0 0 9c0 1.45.35 2.83.9 4.03l3.05-2.33z"
          />
          <path
            fill="#EA4335"
            d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.46.89 11.43 0 9 0A9 9 0 0 0 .9 4.97L3.95 7.3C4.66 5.17 6.65 3.58 9 3.58z"
          />
        </svg>
        Continue with Google
      </button>

      <div className="flex items-center gap-3 mb-6">
        <div className="h-px flex-1 bg-pine/10" />
        <span className="text-xs text-charcoal/50 uppercase tracking-wide">or</span>
        <div className="h-px flex-1 bg-pine/10" />
      </div>

      <form onSubmit={handleSubmit} className="space-y-5">
        {mode === "sign-up" ? (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-charcoal/80 mb-1">First name</label>
              <input
                required
                type="text"
                autoComplete="given-name"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-charcoal/80 mb-1">Last name</label>
              <input
                required
                type="text"
                autoComplete="family-name"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-charcoal/80 mb-1">Email</label>
          <input
            required
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>

        {mode === "sign-up" ? (
          <div>
            <label className="block text-sm font-medium text-charcoal/80 mb-1">
              Phone <span className="text-charcoal/40 font-normal">(optional)</span>
            </label>
            <div className="flex gap-2">
              <select
                value={countryIso}
                onChange={(e) => setCountryIso(e.target.value)}
                aria-label="Country code"
                className="rounded-lg border border-pine/20 px-2 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold max-w-[7.5rem]"
              >
                {COUNTRY_CODES.map((c) => (
                  <option key={c.iso} value={c.iso}>
                    {c.iso} {c.dial}
                  </option>
                ))}
              </select>
              <input
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                placeholder="555 123 4567"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
              />
            </div>
          </div>
        ) : null}

        <div>
          <label className="block text-sm font-medium text-charcoal/80 mb-1">Password</label>
          <input
            required
            type="password"
            minLength={mode === "sign-up" ? 8 : 6}
            autoComplete={mode === "sign-up" ? "new-password" : "current-password"}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
          />
          {mode === "sign-up" ? <PasswordStrengthMeter password={password} /> : null}
        </div>

        {mode === "sign-up" ? (
          <div>
            <label className="block text-sm font-medium text-charcoal/80 mb-1">Confirm password</label>
            <input
              required
              type="password"
              minLength={8}
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
            />
            {confirmPassword && confirmPassword !== password ? (
              <p className="text-xs text-clay mt-1">Passwords don&apos;t match yet.</p>
            ) : null}
          </div>
        ) : null}

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-pine">{message}</p> : null}

        <button
          type="submit"
          disabled={loading}
          className="w-full rounded-full bg-pine text-parchment px-5 py-2.5 font-medium hover:bg-pine-dark transition-colors disabled:opacity-60"
        >
          {loading ? "Please wait…" : mode === "sign-in" ? "Sign In" : "Sign Up"}
        </button>
      </form>

      <p className="text-sm text-charcoal/70 mt-6 text-center">
        {mode === "sign-in" ? "Don't have an account?" : "Already have an account?"}{" "}
        <button
          type="button"
          onClick={() => {
            setMode(mode === "sign-in" ? "sign-up" : "sign-in");
            resetForm();
          }}
          className="text-pine font-medium hover:underline"
        >
          {mode === "sign-in" ? "Sign up" : "Sign in"}
        </button>
      </p>
    </div>
  );
}
