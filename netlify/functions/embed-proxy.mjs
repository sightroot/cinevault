export default async (req) => {
  const headers = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "text/html; charset=utf-8",
    "X-Content-Type-Options": "nosniff"
  };

  const url = new URL(req.url);
  const target = url.searchParams.get("url");

  if (!target) {
    return new Response("Missing url param", { status: 400, headers });
  }

  // Whitelist de domínios permitidos
  const allowed = [
    "fembed.lol",
    "embed.warezcdn.net",
    "multiembed.mov",
    "player.autoembed.cc",
    "vidsrc.pro",
    "cinesrc.st",
    "rdembed.sbs",
    "w1.rdembed.sbs",
    "w2.rdembed.sbs",
    "v2.rdembed.sbs"
  ];

  let targetUrl;
  try {
    targetUrl = new URL(target);
  } catch {
    return new Response("Invalid url", { status: 400, headers });
  }

  const isAllowed = allowed.some(d => targetUrl.hostname === d || targetUrl.hostname.endsWith("." + d));
  if (!isAllowed) {
    return new Response("Domain not allowed", { status: 403, headers });
  }

  try {
    const resp = await fetch(target, {
      headers: {
        "User-Agent": "Mozilla/5.0 (Linux; Android 14; Pixel 8) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36",
        "Referer": targetUrl.origin + "/",
        "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8"
      },
      redirect: "follow"
    });

    if (!resp.ok) {
      return new Response(`Upstream error: ${resp.status}`, { status: 502, headers });
    }

    const contentType = resp.headers.get("content-type") || "text/html";

    // Se não for HTML, retorna direto (JS, CSS, etc.)
    if (!contentType.includes("html")) {
      return new Response(resp.body, {
        status: 200,
        headers: {
          "Content-Type": contentType,
          "Access-Control-Allow-Origin": "*"
        }
      });
    }

    let html = await resp.text();

    // Injeta <base> tag pra resolver URLs relativas pro domínio original
    const baseTag = `<base href="${targetUrl.origin}/">`;
    if (html.includes("<head>")) {
      html = html.replace("<head>", `<head>${baseTag}`);
    } else if (html.includes("<HEAD>")) {
      html = html.replace("<HEAD>", `<HEAD>${baseTag}`);
    } else {
      html = baseTag + html;
    }

    return new Response(html, {
      status: 200,
      headers: {
        "Content-Type": "text/html; charset=utf-8",
        "Access-Control-Allow-Origin": "*",
        "X-Frame-Options": "ALLOWALL"
      }
    });

  } catch (err) {
    return new Response(`Proxy error: ${err.message}`, { status: 502, headers });
  }
};

export const config = {
  path: "/api/embed-proxy"
};
