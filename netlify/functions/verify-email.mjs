import { getStore } from "@netlify/blobs";

export default async (req, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type",
    "Content-Type": "application/json"
  };

  if (req.method === "OPTIONS") {
    return new Response("OK", { status: 200, headers });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405, headers
    });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ authorized: false, error: "Email inválido" }), {
        status: 400, headers
      });
    }

    const normalized = email.toLowerCase().trim();
    const store = getStore("cinevault-buyers");
    const record = await store.get(normalized);

    if (record) {
      const data = JSON.parse(record);
      console.log(`[VERIFY] ✅ Authorized: ${normalized}`);
      return new Response(JSON.stringify({
        authorized: true,
        email: normalized,
        approved_at: data.approved_at
      }), { status: 200, headers });
    }

    console.log(`[VERIFY] ❌ Not found: ${normalized}`);
    return new Response(JSON.stringify({ authorized: false }), {
      status: 200, headers
    });

  } catch (err) {
    console.error("[VERIFY ERROR]", err.message);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500, headers
    });
  }
};

export const config = {
  path: "/api/verify-email"
};
