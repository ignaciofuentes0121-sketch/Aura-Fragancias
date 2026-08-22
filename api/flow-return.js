// api/flow-return.js
// Pon en Vercel:
// FLOW_URL_RETURN = https://TU-DOMINIO.vercel.app/api/flow-return
//
// Acepta GET y POST (Flow a veces hace POST al anular/volver).

const HTML = "<!DOCTYPE html>\n<html lang=\"es\">\n<head>\n<meta charset=\"UTF-8\">\n<meta name=\"viewport\" content=\"width=device-width, initial-scale=1.0\">\n<title>Aura Fragancias \u00b7 Resultado del pago</title>\n<style>\n  :root {\n    --bg: #FBF6EC;\n    --text: #1A1510;\n    --muted: #6B6358;\n    --brass: #C4A35A;\n    --line: #E5D9C5;\n    --ok: #2D6A4F;\n    --warn: #9A6B2F;\n  }\n  * { box-sizing: border-box; }\n  body {\n    margin: 0;\n    min-height: 100vh;\n    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;\n    background: var(--bg);\n    color: var(--text);\n    display: flex;\n    align-items: center;\n    justify-content: center;\n    padding: 24px;\n  }\n  .card {\n    width: min(420px, 100%);\n    background: #fff;\n    border: 1px solid var(--line);\n    padding: 32px 28px;\n    text-align: center;\n  }\n  .mark {\n    font-size: 12px;\n    letter-spacing: 0.22em;\n    text-transform: uppercase;\n    color: var(--muted);\n    margin-bottom: 20px;\n  }\n  .mark span { color: var(--brass); }\n  h1 {\n    font-size: 1.35rem;\n    font-weight: 600;\n    margin: 0 0 10px;\n    line-height: 1.3;\n  }\n  p {\n    margin: 0 0 12px;\n    font-size: 14px;\n    line-height: 1.55;\n    color: var(--muted);\n  }\n  .status {\n    display: inline-block;\n    margin: 8px 0 18px;\n    padding: 6px 12px;\n    font-size: 11px;\n    letter-spacing: 0.08em;\n    text-transform: uppercase;\n  }\n  .status--ok { background: rgba(45,106,79,0.12); color: var(--ok); }\n  .status--pending { background: rgba(154,107,47,0.14); color: var(--warn); }\n  .status--fail { background: rgba(140,40,40,0.1); color: #8C2828; }\n  .actions {\n    display: flex;\n    flex-direction: column;\n    gap: 10px;\n    margin-top: 22px;\n  }\n  a.btn {\n    display: block;\n    padding: 13px 16px;\n    text-decoration: none;\n    font-size: 12px;\n    letter-spacing: 0.1em;\n    text-transform: uppercase;\n  }\n  a.btn-primary {\n    background: #1A1510;\n    color: #FBF6EC;\n  }\n  a.btn-ghost {\n    border: 1px solid var(--line);\n    color: var(--text);\n  }\n  .detail {\n    margin-top: 16px;\n    padding-top: 14px;\n    border-top: 1px solid var(--line);\n    font-size: 12px;\n    color: var(--muted);\n    word-break: break-all;\n  }\n</style>\n</head>\n<body>\n  <div class=\"card\">\n    <div class=\"mark\">Aura <span>Fragancias</span></div>\n    <h1 id=\"title\">Procesando\u2026</h1>\n    <div class=\"status status--pending\" id=\"badge\">Espera</div>\n    <p id=\"msg\">Estamos confirmando el estado de tu pago con Flow.</p>\n    <div class=\"actions\">\n      <a class=\"btn btn-primary\" id=\"wa\" href=\"https://wa.me/56951435986?text=Hola%2C%20acabo%20de%20pagar%20por%20Webpay%20y%20quiero%20coordinar%20la%20entrega.\" target=\"_blank\" rel=\"noopener\">Coordinar por WhatsApp</a>\n      <a class=\"btn btn-ghost\" href=\"/\">Volver al cat\u00e1logo</a>\n    </div>\n    <div class=\"detail\" id=\"detail\" hidden></div>\n  </div>\n<script>\n(function () {\n  var params = new URLSearchParams(window.location.search);\n  var token = params.get('token') || '';\n  var status = (params.get('status') || params.get('payment_status') || '').toLowerCase();\n\n  var title = document.getElementById('title');\n  var badge = document.getElementById('badge');\n  var msg = document.getElementById('msg');\n  var detail = document.getElementById('detail');\n\n  var kind = 'pending';\n  if (status === '2' || status === 'paid' || status === 'success' || status === 'ok') kind = 'ok';\n  if (status === '0' || status === 'cancelled' || status === 'canceled' || status === 'failed' || status === 'rejected') kind = 'fail';\n\n  if (kind === 'ok') {\n    title.textContent = 'Pago recibido';\n    badge.textContent = 'Pagado';\n    badge.className = 'status status--ok';\n    msg.textContent = 'Gracias. Recibimos tu pago. Escr\u00edbenos por WhatsApp para coordinar la entrega (metro, fines de semana).';\n  } else if (kind === 'fail') {\n    title.textContent = 'Pago no completado';\n    badge.textContent = 'Cancelado o fallido';\n    badge.className = 'status status--fail';\n    msg.textContent = 'Cancelaste el pago o no se complet\u00f3. Puedes volver al cat\u00e1logo e intentarlo de nuevo, o escribirnos por WhatsApp.';\n  } else {\n    title.textContent = 'Gracias por tu compra';\n    badge.textContent = 'Listo';\n    badge.className = 'status status--ok';\n    msg.textContent = 'Si completaste el pago, te llegar\u00e1 el comprobante al correo. Coordina la entrega por WhatsApp (metro, fines de semana).';\n  }\n\n  if (token) {\n    detail.hidden = false;\n    detail.textContent = 'Ref: ' + token.slice(0, 16) + '\u2026';\n  }\n})();\n</script>\n</body>\n</html>\n";

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, POST, HEAD');
    return res.status(405).send('Method Not Allowed');
  }

  if (req.method === 'POST') {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = Object.fromEntries(new URLSearchParams(body));
      } catch (e) {
        body = {};
      }
    }
    const q = new URLSearchParams();
    const token = body.token || body.Token || '';
    const status = body.status || body.payment_status || body.statusPago || '';
    if (token) q.set('token', String(token));
    if (status !== '' && status != null) q.set('status', String(status));
    // Si anuló y no hay status, marcamos cancelled para el mensaje
    if (!status) q.set('status', 'cancelled');
    const qs = q.toString();
    res.statusCode = 303;
    res.setHeader('Location', '/api/flow-return' + (qs ? '?' + qs : ''));
    return res.end();
  }

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(HTML);
};
