import { getStore } from "@netlify/blobs";

const ADMIN_KEY = process.env.ADMIN_KEY || "cinevault_admin_2024";

export default async (req, context) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
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

  const auth = req.headers.get("authorization");
  if (!auth || auth !== `Bearer ${ADMIN_KEY}`) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401, headers
    });
  }

  try {
    const { email } = await req.json();

    if (!email || typeof email !== "string" || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "Email inválido" }), {
        status: 400, headers
      });
    }

    const normalized = email.toLowerCase().trim();
    const store = getStore("cinevault-buyers");
    await store.set(normalized, JSON.stringify({
      email: normalized,
      approved_at: new Date().toISOString(),
      raw_status: "manual"
    }));

    console.log(`[ADMIN] ✅ Manually added: ${normalized}`);
    return new Response(JSON.stringify({ added: true, email: normalized }), {
      status: 200, headers
    });

  } catch (err) {
    console.error("[ADMIN ERROR]", err.message);
    return new Response(JSON.stringify({ error: "Server error" }), {
      status: 500, headers
    });
  }
};

export const config = {
  path: "/api/add-email"
};
