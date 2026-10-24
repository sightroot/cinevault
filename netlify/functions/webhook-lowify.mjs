import { getStore } from "@netlify/blobs";

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
    console.log("[LOWIFY WEBHOOK]", JSON.stringify(body));

    const event = body.event;
    const email = body.customer?.email?.toLowerCase().trim();

    if (!email) {
      console.log("[LOWIFY] No email found in payload");
      return new Response(JSON.stringify({ received: true, warning: "no email found" }), {
        status: 200,
        headers: { "Content-Type": "application/json" }
      });
    }

    const approved = event === "sale.paid" && body.status === "paid";
    console.log(`[LOWIFY] Email: ${email}, Event: ${event}, Approved: ${approved}`);

    if (approved) {
      const store = getStore("cinevault-buyers");
      await store.set(email, JSON.stringify({
        email,
        approved_at: new Date().toISOString(),
        product: body.product?.name || "unknown",
        order_id: body.order_id || "unknown"
      }));
      console.log(`[LOWIFY] ✅ Email stored: ${email}`);
    }

    return new Response(JSON.stringify({ received: true, email, approved }), {
      status: 200,
      headers: { "Content-Type": "application/json" }
    });

  } catch (err) {
    console.error("[LOWIFY ERROR]", err.message);
    return new Response(JSON.stringify({ error: "Invalid payload" }), {
      status: 400,
      headers: { "Content-Type": "application/json" }
    });
  }
};

export const config = {
  path: "/api/webhook-lowify"
};
