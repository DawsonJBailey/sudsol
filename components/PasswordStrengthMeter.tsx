const LABELS = ["Very weak", "Weak", "Fair", "Good", "Strong"];
const BAR_COLORS = ["bg-clay", "bg-clay", "bg-gold", "bg-gold-light", "bg-pine"];

export function getPasswordStrength(password: string): { score: 0 | 1 | 2 | 3 | 4; label: string } {
  let score = 0;
  if (password.length >= 8) score++;
  if (password.length >= 12) score++;
  if (/[a-z]/.test(password) && /[A-Z]/.test(password)) score++;
  if (/\d/.test(password)) score++;
  if (/[^A-Za-z0-9]/.test(password)) score++;

  const clamped = Math.min(score, 4) as 0 | 1 | 2 | 3 | 4;
  return { score: clamped, label: LABELS[clamped] };
}

export default function PasswordStrengthMeter({ password }: { password: string }) {
  if (!password) return null;
  const { score, label } = getPasswordStrength(password);

  return (
    <div className="mt-2">
      <div className="flex gap-1.5">
        {[0, 1, 2, 3].map((i) => (
          <div
            key={i}
            className={`h-1.5 flex-1 rounded-full transition-colors ${
              i < score ? BAR_COLORS[score] : "bg-pine/10"
            }`}
          />
        ))}
      </div>
      <p className="text-xs text-charcoal/60 mt-1">
        {label}
        <span className="text-charcoal/40">
          {" "}
          — use 8+ characters with a mix of upper/lowercase letters, numbers &amp; symbols
        </span>
      </p>
    </div>
  );
}
