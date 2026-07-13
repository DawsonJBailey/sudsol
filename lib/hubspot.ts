import "server-only";

const HUBSPOT_API_BASE = "https://api.hubapi.com";

const accessToken = process.env.HUBSPOT_ACCESS_TOKEN;

if (!accessToken) {
  throw new Error("Missing HUBSPOT_ACCESS_TOKEN environment variable");
}

export type HubSpotContactProperties = {
  email: string;
  [property: string]: string;
};

// Upserts by email in a single call instead of the create-then-409-then-patch
// dance the plain contacts endpoint requires.
export async function upsertHubSpotContact(properties: HubSpotContactProperties) {
  const res = await fetch(`${HUBSPOT_API_BASE}/crm/v3/objects/contacts/batch/upsert`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      inputs: [
        {
          idProperty: "email",
          id: properties.email,
          properties,
        },
      ],
    }),
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`HubSpot API error (${res.status}): ${body}`);
  }

  return res.json();
}
