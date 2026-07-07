"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/utils/supabase/client";

const MAX_AVATAR_BYTES = 5 * 1024 * 1024;

export default function ProfilePage() {
  const router = useRouter();
  const supabase = createClient();

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [fullName, setFullName] = useState("");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      if (!data.user) {
        router.push("/login");
        return;
      }
      setUser(data.user);

      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, avatar_url")
        .eq("id", data.user.id)
        .single();

      setFullName(profile?.full_name ?? "");
      setAvatarUrl(profile?.avatar_url ?? null);
      setLoading(false);
    })();
  }, [router, supabase]);

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please choose an image file.");
      return;
    }
    if (file.size > MAX_AVATAR_BYTES) {
      setError("Image must be 5MB or smaller.");
      return;
    }

    setError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!user) return;
    setSaving(true);
    setError(null);
    setMessage(null);

    let nextAvatarUrl = avatarUrl;

    if (avatarFile) {
      const ext = avatarFile.name.split(".").pop();
      const path = `${user.id}/avatar.${ext}`;
      const { error: uploadError } = await supabase.storage
        .from("avatars")
        .upload(path, avatarFile, { upsert: true });

      if (uploadError) {
        setSaving(false);
        setError(uploadError.message);
        return;
      }

      const { data: publicUrlData } = supabase.storage.from("avatars").getPublicUrl(path);
      // Cache-bust so the new image shows immediately even though the path is unchanged.
      nextAvatarUrl = `${publicUrlData.publicUrl}?t=${Date.now()}`;
    }

    const { error: updateError } = await supabase
      .from("profiles")
      .update({
        full_name: fullName,
        avatar_url: nextAvatarUrl,
        updated_at: new Date().toISOString(),
      })
      .eq("id", user.id);

    setSaving(false);

    if (updateError) {
      setError(updateError.message);
      return;
    }

    setAvatarUrl(nextAvatarUrl);
    setAvatarFile(null);
    setMessage("Profile updated.");
  }

  if (loading) {
    return <div className="max-w-2xl mx-auto px-6 py-16 text-charcoal/70">Loading…</div>;
  }

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Account</p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-8">Edit Profile</h1>

      <form onSubmit={handleSave} className="space-y-6">
        <div className="flex items-center gap-5">
          {avatarPreview || avatarUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={avatarPreview ?? avatarUrl ?? ""}
              alt="Avatar preview"
              className="h-20 w-20 rounded-full object-cover border border-pine/20"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-pine text-parchment flex items-center justify-center text-2xl font-medium">
              {(fullName || user?.email || "?").charAt(0).toUpperCase()}
            </div>
          )}
          <div>
            <label className="inline-block cursor-pointer rounded-full border border-pine/20 bg-white px-4 py-2 text-sm font-medium text-charcoal/80 hover:bg-parchment transition-colors">
              Change photo
              <input type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
            </label>
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal/80 mb-1">Email</label>
          <input
            disabled
            value={user?.email ?? ""}
            className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-parchment/60 text-charcoal/60"
          />
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal/80 mb-1">Full Name</label>
          <input
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
          />
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {message ? <p className="text-sm text-pine">{message}</p> : null}

        <button
          type="submit"
          disabled={saving}
          className="rounded-full bg-pine text-parchment px-6 py-2.5 font-medium hover:bg-pine-dark transition-colors disabled:opacity-60"
        >
          {saving ? "Saving…" : "Save Changes"}
        </button>
      </form>
    </div>
  );
}
