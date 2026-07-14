import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import {
  getCustomerSession,
  getCustomerProfile,
  customerFetch,
  type CustomerProfile,
} from "@/lib/shopify/customer";

export const dynamic = "force-dynamic";

async function updateName(formData: FormData) {
  "use server";

  const session = await getCustomerSession();
  if (!session) redirect("/login");

  const firstName = String(formData.get("firstName") ?? "").trim();
  const lastName = String(formData.get("lastName") ?? "").trim();

  const data = await customerFetch<{
    customerUpdate: {
      customer: { id: string } | null;
      userErrors: { message: string }[];
    };
  }>(
    session.accessToken,
    /* GraphQL */ `
      mutation CustomerUpdate($input: CustomerUpdateInput!) {
        customerUpdate(input: $input) {
          customer {
            id
          }
          userErrors {
            message
          }
        }
      }
    `,
    { input: { firstName, lastName } }
  );

  const errors = data.customerUpdate.userErrors;
  if (errors.length > 0) {
    redirect(`/profile?error=${encodeURIComponent(errors.map((e) => e.message).join("; "))}`);
  }

  revalidatePath("/profile");
  redirect("/profile?saved=1");
}

export default async function ProfilePage({
  searchParams,
}: {
  searchParams: Promise<{ saved?: string; error?: string }>;
}) {
  const session = await getCustomerSession();
  if (!session) {
    redirect("/login");
  }

  let profile: CustomerProfile;
  try {
    profile = await getCustomerProfile(session.accessToken);
  } catch (err) {
    console.error("Failed to load customer profile:", err);
    redirect("/login");
  }

  const { saved, error } = await searchParams;
  const email = profile.emailAddress?.emailAddress ?? "";
  const initial = (profile.firstName || email || "?").charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto px-6 py-16">
      <p className="text-xs uppercase tracking-widest text-gold font-semibold mb-2">Account</p>
      <h1 className="font-display text-3xl md:text-4xl text-pine mb-8">Edit Profile</h1>

      <form action={updateName} className="space-y-6">
        <div className="flex items-center gap-5">
          <div className="h-20 w-20 rounded-full bg-pine text-parchment flex items-center justify-center text-2xl font-medium">
            {initial}
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-charcoal/80 mb-1">Email</label>
          <input
            disabled
            value={email}
            className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-parchment/60 text-charcoal/60"
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-charcoal/80 mb-1">First name</label>
            <input
              type="text"
              name="firstName"
              defaultValue={profile.firstName ?? ""}
              className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-charcoal/80 mb-1">Last name</label>
            <input
              type="text"
              name="lastName"
              defaultValue={profile.lastName ?? ""}
              className="w-full rounded-lg border border-pine/20 px-4 py-2.5 bg-white focus:outline-none focus:ring-2 focus:ring-gold"
            />
          </div>
        </div>

        {error ? <p className="text-sm text-red-600">{error}</p> : null}
        {saved ? <p className="text-sm text-pine">Profile updated.</p> : null}

        <button
          type="submit"
          className="rounded-full bg-pine text-parchment px-6 py-2.5 font-medium hover:bg-pine-dark transition-colors"
        >
          Save Changes
        </button>
      </form>
    </div>
  );
}
