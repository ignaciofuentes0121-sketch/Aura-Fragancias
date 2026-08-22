// api/flow-return.js
// FLOW_URL_RETURN = https://TU-DOMINIO.vercel.app/api/flow-return
//
// Consulta el estado real en Flow con el token (no asume cancelado).

const crypto = require('crypto');

function env(name) {
  const v = process.env[name];
  if (v == null) return '';
  return String(v).trim().replace(/^["']|["']$/g, '');
}

function sign(params, secretKey) {
  const keys = Object.keys(params).sort();
  let toSign = '';
  for (let i = 0; i < keys.length; i++) {
    toSign += keys[i] + String(params[keys[i]]);
  }
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
}

/** status Flow: 1 pendiente, 2 pagada, 3 rechazada, 4 anulada */
async function getFlowStatus(token) {
  const apiKey = env('FLOW_API_KEY');
  const secretKey = env('FLOW_SECRET_KEY');
  const apiUrl = (env('FLOW_API_URL') || 'https://www.flow.cl/api').replace(/\/$/, '');
  if (!apiKey || !secretKey || !token) return null;

  const params = { apiKey: apiKey, token: String(token) };
  params.s = sign(params, secretKey);
  const qs = new URLSearchParams(params).toString();

  try {
    const r = await fetch(apiUrl + '/payment/getStatus?' + qs, { method: 'GET' });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('getStatus error', r.status, data);
      return null;
    }
    return data;
  } catch (e) {
    console.error('getStatus fetch', e);
    return null;
  }
}

function kindFromFlowStatus(status) {
  const n = Number(status);
  if (n === 2) return 'ok';
  if (n === 1) return 'pending';
  if (n === 3 || n === 4) return 'fail';
  return 'pending';
}

function pageHtml(kind, token) {
  const isOk = kind === 'ok';
  const isFail = kind === 'fail';

  const title = isOk
    ? 'Pago recibido'
    : isFail
      ? 'Pago no completado'
      : 'Estamos confirmando tu pago';
  const badge = isOk ? 'Pagado' : isFail ? 'Cancelado' : 'Pendiente';
  const badgeClass = isOk ? 'status--ok' : isFail ? 'status--fail' : 'status--pending';
  const msg = isOk
    ? 'Gracias. Recibimos tu pago. Escríbenos por WhatsApp para coordinar la entrega (metro, fines de semana).'
    : isFail
      ? 'Cancelaste el pago o no se completó. Puedes volver al catálogo e intentarlo de nuevo cuando quieras.'
      : 'Si acabas de pagar, la confirmación puede tardar unos segundos. Revisa tu correo o vuelve en un momento. Si cancelaste, no se realizó ningún cargo.';
  const waHidden = isOk ? '' : ' hidden';
  const detail =
    isOk && token
      ? `<div class="detail">Ref: ${String(token).slice(0, 16)}…</div>`
      : '<div class="detail" hidden></div>';

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Aura Fragancias · Resultado del pago</title>
<style>
  :root {
    --bg: #FBF6EC;
    --text: #1A1510;
    --muted: #6B6358;
    --brass: #C4A35A;
    --line: #E5D9C5;
    --ok: #2D6A4F;
    --warn: #9A6B2F;
  }
  * { box-sizing: border-box; }
  body {
    margin: 0;
    min-height: 100vh;
    font-family: system-ui, -apple-system, Segoe UI, Roboto, sans-serif;
    background: var(--bg);
    color: var(--text);
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 24px;
  }
  .card {
    width: min(420px, 100%);
    background: #fff;
    border: 1px solid var(--line);
    padding: 32px 28px;
    text-align: center;
  }
  .mark {
    font-size: 12px;
    letter-spacing: 0.22em;
    text-transform: uppercase;
    color: var(--muted);
    margin-bottom: 20px;
  }
  .mark span { color: var(--brass); }
  h1 {
    font-size: 1.35rem;
    font-weight: 600;
    margin: 0 0 10px;
    line-height: 1.3;
  }
  p {
    margin: 0 0 12px;
    font-size: 14px;
    line-height: 1.55;
    color: var(--muted);
  }
  .status {
    display: inline-block;
    margin: 8px 0 18px;
    padding: 6px 12px;
    font-size: 11px;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .status--ok { background: rgba(45,106,79,0.12); color: var(--ok); }
  .status--pending { background: rgba(154,107,47,0.14); color: var(--warn); }
  .status--fail { background: rgba(140,40,40,0.1); color: #8C2828; }
  .actions {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 22px;
  }
  a.btn {
    display: block;
    padding: 13px 16px;
    text-decoration: none;
    font-size: 12px;
    letter-spacing: 0.1em;
    text-transform: uppercase;
  }
  a.btn-primary {
    background: #1A1510;
    color: #FBF6EC;
  }
  a.btn[hidden] { display: none !important; }
  a.btn-ghost {
    border: 1px solid var(--line);
    color: var(--text);
  }
  .detail {
    margin-top: 16px;
    padding-top: 14px;
    border-top: 1px solid var(--line);
    font-size: 12px;
    color: var(--muted);
    word-break: break-all;
  }
</style>
</head>
<body>
  <div class="card">
    <div class="mark">Aura <span>Fragancias</span></div>
    <h1>${title}</h1>
    <div class="status ${badgeClass}">${badge}</div>
    <p>${msg}</p>
    <div class="actions">
      <a class="btn btn-primary" id="wa"${waHidden} href="https://wa.me/56951435986?text=Hola%2C%20acabo%20de%20pagar%20por%20Webpay%20y%20quiero%20coordinar%20la%20entrega." target="_blank" rel="noopener">Coordinar por WhatsApp</a>
      <a class="btn btn-ghost" href="/">Volver al catálogo</a>
    </div>
    ${detail}
  </div>
</body>
</html>`;
}

function pickTokenStatus(req) {
  let token = '';
  let statusHint = '';

  if (req.method === 'GET' || req.method === 'HEAD') {
    const q = req.query || {};
    token = q.token || q.Token || '';
    statusHint = q.status || q.payment_status || '';
  } else if (req.method === 'POST') {
    let body = req.body || {};
    if (typeof body === 'string') {
      try {
        body = Object.fromEntries(new URLSearchParams(body));
      } catch (e) {
        body = {};
      }
    }
    token = body.token || body.Token || '';
    statusHint = body.status || body.payment_status || body.statusPago || '';
    // query también por si Vercel mezcla
    const q = req.query || {};
    if (!token) token = q.token || '';
    if (!statusHint) statusHint = q.status || '';
  }

  return { token: String(token || ''), statusHint: String(statusHint || '').toLowerCase() };
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET' && req.method !== 'POST' && req.method !== 'HEAD') {
    res.setHeader('Allow', 'GET, POST, HEAD');
    return res.status(405).send('Method Not Allowed');
  }

  const { token, statusHint } = pickTokenStatus(req);

  let kind = 'pending';

  // 1) Fuente de verdad: API Flow con el token
  if (token) {
    const data = await getFlowStatus(token);
    if (data && data.status != null) {
      kind = kindFromFlowStatus(data.status);
      console.log('Flow status', data.status, 'kind', kind, 'order', data.commerceOrder || data.flowOrder);
    } else if (
      statusHint === 'cancelled' ||
      statusHint === 'canceled' ||
      statusHint === 'failed' ||
      statusHint === 'rejected' ||
      statusHint === '0' ||
      statusHint === '3' ||
      statusHint === '4'
    ) {
      // Solo si la API no respondió, usamos la pista de la URL
      kind = 'fail';
    } else if (statusHint === '2' || statusHint === 'paid' || statusHint === 'success') {
      kind = 'ok';
    }
  } else if (
    statusHint === 'cancelled' ||
    statusHint === 'canceled' ||
    statusHint === 'failed'
  ) {
    kind = 'fail';
  }

  const html = pageHtml(kind, token);
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  return res.status(200).send(html);
};
