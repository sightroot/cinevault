const BRAVOPAY_URL = "https://bravopay.club/api/v1";
const BRAVOPAY_KEY = process.env.BRAVOPAY_API_KEY || "bp_live_lwJx7KttVWJaD-uVuK-wVinQd3oNpHf9-F2M0g";

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
    const { name, email, cpf } = await req.json();

    if (!email || !email.includes("@")) {
      return new Response(JSON.stringify({ error: "E-mail obrigatório" }), {
        status: 400, headers
      });
    }

    // R$19,90 = 1990 centavos
    const payload = {
      amount_cents: 1990,
      payment_method: "pix",
      customer: {
        name: name || "Cliente CineVault",
        email: email.toLowerCase().trim(),
        ...(cpf ? { cpf } : {})
      },
      items: [
        {
          title: "CineVault — Acesso Vitalício",
          quantity: 1,
          unit_price: 1990
        }
      ],
      postback_url: `https://${req.headers.get("host")}/api/webhook-bravopay`,
      metadata: {
        product: "cinevault",
        email: email.toLowerCase().trim()
      }
    };

    console.log("[CHECKOUT] Creating transaction for:", email);

    const res = await fetch(`${BRAVOPAY_URL}/transactions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${BRAVOPAY_KEY}`
      },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    console.log("[CHECKOUT] BravoPay response:", JSON.stringify(data));

    if (!res.ok) {
      return new Response(JSON.stringify({
        error: "Erro ao criar pagamento",
        details: data
      }), { status: res.status, headers });
    }

    // Retorna dados do PIX — a resposta da BravoPay pode variar,
    // então retornamos tudo que vier útil
    return new Response(JSON.stringify({
      success: true,
      transaction_id: data.id || data.transaction_id,
      pix_code: data.pix_code || data.pix?.code || data.qr_code || data.payment?.pix_code,
      pix_qr: data.pix_qr || data.pix?.qr_code_url || data.qr_code_url || data.payment?.qr_code_url,
      pix_url: data.pix_url || data.payment_url || data.checkout_url,
      amount: "R$ 19,90",
      status: data.status,
      raw: data
    }), { status: 200, headers });

  } catch (err) {
    console.error("[CHECKOUT ERROR]", err.message);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers
    });
  }
};

export const config = {
  path: "/api/create-checkout"
};
