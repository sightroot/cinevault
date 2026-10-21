import { getStore } from "@netlify/blobs";

const BRAVOPAY_KEY = process.env.BRAVOPAY_API_KEY || "bp_live_lwJx7KttVWJaD-uVuK-wVinQd3oNpHf9-F2M0g";
const WEBHOOK_SECRET = process.env.BRAVOPAY_WEBHOOK_SECRET || "";

function extractEmail(obj) {
  if (!obj || typeof obj !== "object") return null;
  const emailKeys = [
    "email", "buyer_email", "customer_email", "payer_email",
    "client_email", "user_email", "contact_email", "email_address"
  ];
  for (const key of emailKeys) {
    if (obj[key] && typeof obj[key] === "string" && obj[key].includes("@")) {
      return obj[key].toLowerCase().trim();
    }
  }
  const nested = ["buyer", "customer", "payer", "client", "user", "contact", "metadata", "data", "payment", "transaction"];
  for (const key of nested) {
    if (obj[key] && typeof obj[key] === "object") {
      const found = extractEmail(obj[key]);
      if (found) return found;
    }
  }
  return null;
}

function isApproved(obj) {
  if (!obj || typeof obj !== "object") return false;
  const statusKeys = ["status", "payment_status", "transaction_status", "state"];
  const approvedValues = [
    "approved", "paid", "completed", "confirmed", "settled",
    "aprovado", "pago", "concluido", "confirmado",
    "transaction.paid"
  ];
  // BravoPay event types: transaction.paid, transaction.created, etc.
  if (obj.event && typeof obj.event === "string") {
    if (approvedValues.includes(obj.event.toLowerCase())) return true;
  }
  for (const key of statusKeys) {
    if (obj[key] && typeof obj[key] === "string") {
      if (approvedValues.includes(obj[key].toLowerCase())) return true;
    }
  }
  const nested = ["data", "payment", "transaction", "charge"];
  for (const key of nested) {
    if (obj[key] && typeof obj[key] === "object") {
      if (isApproved(obj[key])) return true;
    }
  }
  return false;
}

export default async (req, context) => {
  if (req.method === "OPTIONS") {
    return new Response("OK", {
      status: 200,
      headers: {
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Methods": "POST, OPTIONS",
        "Access-Control-Allow-Headers": "Content-Type, Authorization"
      }
    });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Method not allowed" }), {
      status: 405,
      headers: { "Content-Type": "application/json" }
    });
  }

  try {
    const body = await req.json();
    console.log("[BRAVOPAY WEBHOOK]", JSON.stringify(body));

    const email = extractEmail(body);
    const approved = isApproved(body);

    if (!email) {
      console.log("[BRAVOPAY] No email found in payload");
      return new Response(JSON.stringify({ received: true, warning: "no email found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    console.log(`[BRAVOPAY] Email: ${email}, Approved: ${approved}`);

    if (approved) {
      const store = getStore("cinevault-buyers");
      await store.set(email, JSON.stringify({
        email,
        approved_at: new Date().toISOString(),
        raw_status: body.status || body?.data?.status || "unknown"
      }));
      console.log(`[BRAVOPAY] ✅ Email stored: ${email}`);
    }

    return new Response(JSON.stringify({ received: true, email, approved }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("[BRAVOPAY ERROR]", err.message);
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config = {
  path: "/api/webhook-bravopay"
};
