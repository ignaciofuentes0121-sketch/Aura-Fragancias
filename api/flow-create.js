// api/flow-create.js — Vercel Serverless Function
//
// Variables en Vercel → Settings → Environment Variables
// (Production + Preview, luego Redeploy):
//   FLOW_API_KEY, FLOW_SECRET_KEY
//   FLOW_API_URL = https://www.flow.cl/api  (o sandbox)
//   FLOW_URL_CONFIRMATION = https://TU-DOMINIO.vercel.app/api/flow-confirm
//   FLOW_URL_RETURN       = https://TU-DOMINIO.vercel.app/

const crypto = require('crypto');

function sign(params, secretKey) {
  const keys = Object.keys(params).sort();
  let toSign = '';
  for (let i = 0; i < keys.length; i++) {
    const k = keys[i];
    toSign += k + String(params[k]);
  }
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
}

function env(name) {
  const v = process.env[name];
  if (v == null) return '';
  return String(v).trim().replace(/^["']|["']$/g, '');
}

/** Flow rechaza optional demasiado largo → mantener corto */
function buildOptional(items) {
  if (!Array.isArray(items) || !items.length) return '';
  // Solo nombre x cantidad (sin precios ni JSON pesado)
  const parts = items.map(function (it) {
    const name = String((it && it.name) || 'item').slice(0, 40);
    const qty = Number((it && it.qty) || 1);
    return name + ' x' + qty;
  });
  let text = parts.join('; ');
  // límite seguro (Flow suele fallar cerca de ~250–500 chars en optional)
  if (text.length > 200) text = text.slice(0, 197) + '...';
  // formato simple clave=valor / JSON mínimo
  const json = JSON.stringify({ d: text });
  if (json.length > 240) return JSON.stringify({ d: text.slice(0, 150) + '...' });
  return json;
}

function buildSubject(subject, items, amount) {
  let s = String(subject || '').trim();
  if (!s && Array.isArray(items) && items.length) {
    s = items
      .map(function (it) {
        return String((it && it.name) || 'item').slice(0, 30) + ' x' + Number((it && it.qty) || 1);
      })
      .join(', ');
  }
  if (!s) s = 'Pedido Aura Fragancias';
  s = 'Aura Fragancias — ' + s.replace(/^Aura Fragancias\s*[—\-]\s*/i, '');
  // subject también tiene tope práctico
  if (s.length > 180) s = s.slice(0, 177) + '...';
  return s;
}

module.exports = async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(204).end();
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = env('FLOW_API_KEY');
  const secretKey = env('FLOW_SECRET_KEY');
  const apiUrl = (env('FLOW_API_URL') || 'https://www.flow.cl/api').replace(/\/$/, '');
  const urlConfirmation = env('FLOW_URL_CONFIRMATION');
  const urlReturn = env('FLOW_URL_RETURN');

  if (!apiKey || !secretKey) {
    return res.status(500).json({
      error:
        'Faltan FLOW_API_KEY o FLOW_SECRET_KEY en Vercel. Revisa Environment Variables y haz Redeploy.',
      debug: {
        hasApiKey: Boolean(apiKey),
        hasSecretKey: Boolean(secretKey),
        apiUrl: apiUrl,
      },
    });
  }

  if (!urlConfirmation || !urlReturn) {
    return res.status(500).json({
      error: 'Faltan FLOW_URL_CONFIRMATION o FLOW_URL_RETURN en Vercel.',
    });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'JSON inválido' });
    }
  }
  if (!body || typeof body !== 'object') {
    return res.status(400).json({ error: 'Body vacío' });
  }

  const amount = Math.round(Number(body.amount));
  const email = String(body.email || '').trim();
  const items = Array.isArray(body.items) ? body.items : [];

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (!amount || amount < 350) {
    return res.status(400).json({ error: 'Monto mínimo $350' });
  }

  const commerceOrder = 'AURA-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
  const subject = buildSubject(body.subject, items, amount);
  const optional = buildOptional(items);

  const params = {
    apiKey: apiKey,
    commerceOrder: commerceOrder,
    subject: subject,
    currency: 'CLP',
    amount: String(amount),
    email: email,
    urlConfirmation: urlConfirmation,
    urlReturn: urlReturn,
  };

  // Solo enviar optional si hay contenido (evita errores innecesarios)
  if (optional) {
    params.optional = optional;
  }

  params.s = sign(params, secretKey);

  try {
    const form = new URLSearchParams();
    Object.keys(params).forEach(function (k) {
      form.append(k, params[k]);
    });

    const r = await fetch(apiUrl + '/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form.toString(),
    });

    const text = await r.text();
    let data = {};
    try {
      data = JSON.parse(text);
    } catch (e) {
      data = { raw: text };
    }

    if (!r.ok) {
      const msg =
        (data && (data.message || data.error || data.code)) ||
        text ||
        'Error al crear pago en Flow';
      console.error('Flow error', r.status, data);
      return res.status(502).json({
        error: String(msg),
        status: r.status,
        apiUrl: apiUrl,
      });
    }

    if (!data.url || !data.token) {
      return res.status(502).json({
        error: 'Respuesta incompleta de Flow',
        detail: data,
      });
    }

    const payUrl =
      data.url + (String(data.url).indexOf('?') >= 0 ? '&' : '?') + 'token=' + data.token;

    return res.status(200).json({
      url: payUrl,
      token: data.token,
      flowOrder: data.flowOrder,
      commerceOrder: commerceOrder,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({
      error: 'Error de conexión con Flow: ' + (err && err.message ? err.message : 'desconocido'),
    });
  }
};
