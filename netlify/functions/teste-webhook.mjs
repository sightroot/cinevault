const html = `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Teste Webhook Lowify</title>
<style>body{background:#111;color:#fff;font-family:system-ui;display:flex;justify-content:center;align-items:center;min-height:100vh;margin:0}
.box{background:#1a1a2e;padding:32px;border-radius:12px;max-width:500px;width:90%;text-align:center}
h2{margin:0 0 8px;color:#7c3aed}p{color:#aaa;margin:0 0 24px;font-size:14px}
input{width:100%;padding:12px;border-radius:8px;border:1px solid #333;background:#0d0d1a;color:#fff;font-size:16px;margin-bottom:16px;box-sizing:border-box}
button{background:#7c3aed;color:#fff;border:none;padding:14px 32px;border-radius:8px;font-size:16px;cursor:pointer;width:100%}
button:hover{background:#6d28d9}
#res{margin-top:20px;padding:16px;border-radius:8px;font-size:14px;display:none;text-align:left;word-break:break-all}
.ok{background:#064e3b;border:1px solid #10b981}.err{background:#7f1d1d;border:1px solid #ef4444}
</style></head><body>
<div class="box">
<h2>Teste Webhook Lowify</h2>
<p>Simula uma venda aprovada pra testar o acesso</p>
<input id="email" type="email" placeholder="Email do cliente teste">
<button onclick="enviar()">Enviar Webhook Teste</button>
<div id="res"></div>
</div>
<script>
async function enviar(){
  const email=document.getElementById("email").value.trim();
  const res=document.getElementById("res");
  if(!email||!email.includes("@")){res.className="err";res.style.display="block";res.textContent="Digite um email válido.";return}
  res.style.display="block";res.className="";res.textContent="Enviando...";
  try{
    const r=await fetch("/api/webhook-lowify",{
      method:"POST",
      headers:{"Content-Type":"application/json"},
      body:JSON.stringify({
        event:"sale.paid",
        order_id:"ord_test_"+Date.now(),
        sale_amount:97,
        status:"paid",
        timestamp:new Date().toISOString(),
        product:{id:42,name:"CineVault Premium - Basico",price:97,type:"principal"},
        customer:{name:"Teste",email:email,phone:"11999999999"}
      })
    });
    const d=await r.json();
    if(d.approved){
      res.className="ok";
      res.textContent="✅ Email "+email+" liberado! Agora tenta logar no CineVault com esse email.";
    }else{
      res.className="err";
      res.textContent="❌ Resposta: "+JSON.stringify(d);
    }
  }catch(e){
    res.className="err";
    res.textContent="❌ Erro: "+e.message;
  }
}
</script>
</body></html>`;

export default async (req) => {
  return new Response(html, {
    status: 200,
    headers: { "Content-Type": "text/html; charset=utf-8" }
  });
};

export const config = {
  path: "/teste-webhook"
};
