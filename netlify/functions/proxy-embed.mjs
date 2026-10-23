// proxy-embed.mjs — Netlify Function que busca embed de player,
// remove scripts de ad/popunder/redirect, e devolve HTML limpo.

const ALLOWED_HOSTS = [
  'fembed.lol',
  'embed.warezcdn.net',
  'multiembed.mov',
  'player.autoembed.cc',
  'vidsrc.pro',
  'cinesrc.st',
  'v2.rdembed.sbs',
  'w2.rdembed.sbs',
  'w1.rdembed.sbs',
];

// Padrões de domínios/scripts de ad conhecidos
const AD_DOMAIN_PATTERNS = [
  /popunder/i, /popads/i, /popcash/i, /popmy/i,
  /juicyads/i, /exoclick/i, /trafficjunky/i, /adsterra/i,
  /propellerads/i, /monetag/i, /hilltopads/i, /clickadu/i,
  /a]?d[sx]?\.js/i, /ads\.min/i, /adblock/i,
  /miner/i, /coin-?hive/i, /crypto/i,
  /track(er|ing)?\.js/i, /analytics\.js/i,
  /pushnotif/i, /push\.js/i, /onesignal/i,
  /sw\.js/i,  // service workers usados por push/mining
  /redirect/i,
  /window\.open\s*\(/i,
  /document\.createElement\(\s*['"]script['"]\s*\)/i,
];

// Scripts inline suspeitos
const INLINE_AD_PATTERNS = [
  /window\.open\s*\(/gi,
  /window\.location\s*[=]/gi,
  /document\.location\s*[=]/gi,
  /location\.href\s*[=]/gi,
  /location\.replace\s*\(/gi,
  /\.onclick\s*=\s*function[^{]*\{[^}]*window/gi,
  /popunder/gi,
  /pop[_-]?up/gi,
  /onclick\s*=\s*["'][^"']*open\s*\(/gi,
  /adsbygoogle/gi,
  /googlesyndication/gi,
  /var\s+[\w$]+\s*=\s*['"]https?:\/\/[^'"]+['"];\s*[\w$]*\.src/gi,
];

function isAllowedHost(urlStr) {
  try {
    const u = new URL(urlStr);
    return ALLOWED_HOSTS.some(h => u.hostname === h || u.hostname.endsWith('.' + h));
  } catch { return false; }
}

function isAdScript(tag) {
  const src = tag.match(/src\s*=\s*["']([^"']+)["']/i);
  if (src) {
    const url = src[1].toLowerCase();
    if (AD_DOMAIN_PATTERNS.some(p => p.test(url))) return true;
    // Bloquear scripts externos que não são do próprio host do embed
    if (/^https?:\/\//i.test(url)) {
      // Permitir CDNs de player legítimos
      const legitimate = [
        'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'unpkg.com',
        'hls.js', 'plyr', 'video.js', 'jwplayer', 'flowplayer',
        'dashjs', 'shaka-player', 'clappr',
      ];
      if (!legitimate.some(l => url.includes(l))) return true;
    }
  }
  return false;
}

function cleanHtml(html, embedHost) {
  // 1. Remover <script> tags de ad (com src externo suspeito)
  html = html.replace(/<script[^>]*src\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/script>/gi,
    (match, src) => {
      if (isAdScript(match)) return '<!-- ad-removed -->';
      return match;
    }
  );

  // 2. Remover <script> inline com padrões de ad
  html = html.replace(/<script(?![^>]*\bsrc\s*=)[^>]*>([\s\S]*?)<\/script>/gi,
    (match, content) => {
      if (INLINE_AD_PATTERNS.some(p => p.test(content))) {
        return '<!-- inline-ad-removed -->';
      }
      // Bloquear scripts inline que criam novos scripts dinamicamente
      if (/createElement\s*\(\s*['"]script/i.test(content) &&
          !/(hls|video|player|dash|shaka|clappr)/i.test(content)) {
        return '<!-- dynamic-script-removed -->';
      }
      return match;
    }
  );

  // 3. Remover iframes de ad (não o player principal)
  html = html.replace(/<iframe[^>]*src\s*=\s*["']([^"']+)["'][^>]*>[\s\S]*?<\/iframe>/gi,
    (match, src) => {
      // Manter iframes do mesmo host ou de CDNs de vídeo
      if (src.includes(embedHost) || /(video|player|stream|hls|m3u8)/i.test(src)) {
        return match;
      }
      if (/(ad|banner|pop|track|pixel|analytics|syndic)/i.test(src)) {
        return '<!-- ad-iframe-removed -->';
      }
      return match;
    }
  );

  // 4. Remover elementos com IDs/classes de ad
  html = html.replace(/<div[^>]*(?:id|class)\s*=\s*["'][^"']*(?:ad[_-]?(?:banner|container|wrapper|overlay|popup)|popunder|overlay-ad)[^"']*["'][^>]*>[\s\S]*?<\/div>/gi,
    '<!-- ad-div-removed -->'
  );

  // 5. Remover onclick handlers suspeitos em <body> ou <html>
  html = html.replace(/(<(?:body|html)[^>]*)\s+onclick\s*=\s*["'][^"']*["']/gi, '$1');
  html = html.replace(/(<(?:body|html)[^>]*)\s+onmousedown\s*=\s*["'][^"']*["']/gi, '$1');
  html = html.replace(/(<(?:body|html)[^>]*)\s+onmouseup\s*=\s*["'][^"']*["']/gi, '$1');

  // 6. Injetar bloqueio de window.open e popups no topo
  const antiAdScript = `
<script>
(function(){
  // Bloquear window.open
  window.open=function(){return null;};
  // Bloquear criação de popups
  var origCreate=document.createElement.bind(document);
  document.createElement=function(tag){
    var el=origCreate(tag);
    if(tag.toLowerCase()==='a'){
      var origSet=Object.getOwnPropertyDescriptor(HTMLAnchorElement.prototype,'href');
      // Deixar links normais mas interceptar target _blank forçados por ad
    }
    return el;
  };
  // Bloquear document.write após load (usado por ads)
  window.addEventListener('load',function(){
    document.write=function(){};
    document.writeln=function(){};
  });
  // Bloquear event listeners de click no body que abrem popups
  document.addEventListener('click',function(e){
    // Não bloquear cliques no player de vídeo
    if(e.target.closest('video,button,.jw-video,.plyr,.vjs-tech,[class*=player]'))return;
  },true);
})();
</script>`;

  // Injetar logo após <head> ou no início
  const headIdx = html.indexOf('</head>');
  if (headIdx !== -1) {
    html = html.slice(0, headIdx) + antiAdScript + html.slice(headIdx);
  } else {
    html = antiAdScript + html;
  }

  return html;
}

export default async function handler(req) {
  const url = new URL(req.url, 'https://localhost');
  const target = url.searchParams.get('url');

  if (!target) {
    return new Response('Missing url param', { status: 400 });
  }

  if (!isAllowedHost(target)) {
    return new Response('Host not allowed', { status: 403 });
  }

  try {
    const targetUrl = new URL(target);
    const resp = await fetch(target, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Referer': targetUrl.origin + '/',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      },
      redirect: 'follow',
    });

    if (!resp.ok) {
      return new Response('Upstream error: ' + resp.status, { status: 502 });
    }

    const contentType = resp.headers.get('content-type') || '';

    // Se não é HTML (ex: HLS manifesto, JS, CSS), passar direto
    if (!contentType.includes('text/html') && !contentType.includes('application/xhtml')) {
      return new Response(resp.body, {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Access-Control-Allow-Origin': '*',
          'Cache-Control': 'public, max-age=300',
        },
      });
    }

    let html = await resp.text();

    // Reescrever URLs relativas para apontar ao host original
    const base = targetUrl.origin;
    // Adicionar <base> tag para resolver assets relativos
    const baseTag = `<base href="${base}/">`;
    const headStart = html.indexOf('<head');
    if (headStart !== -1) {
      const headEnd = html.indexOf('>', headStart);
      html = html.slice(0, headEnd + 1) + baseTag + html.slice(headEnd + 1);
    } else {
      html = baseTag + html;
    }

    // Limpar ads
    html = cleanHtml(html, targetUrl.hostname);

    return new Response(html, {
      status: 200,
      headers: {
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, max-age=300',
        'X-Frame-Options': 'ALLOWALL',
      },
    });
  } catch (err) {
    return new Response('Proxy error: ' + err.message, { status: 500 });
  }
}

export const config = {
  path: '/api/proxy-embed',
};
