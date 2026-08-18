// api/flow-create.js — Vercel Serverless Function
//
// Variables en Vercel → Settings → Environment Variables
// (marca Production + Preview, luego Redeploy obligatorio):
//
//   FLOW_API_KEY
//   FLOW_SECRET_KEY
//   FLOW_API_URL = https://sandbox.flow.cl/api   ← pruebas
//                o https://www.flow.cl/api      ← real
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
        'Faltan variables en Vercel. Revisa FLOW_API_KEY y FLOW_SECRET_KEY (Settings → Environment Variables) y haz Redeploy.',
      debug: {
        hasApiKey: Boolean(apiKey),
        hasSecretKey: Boolean(secretKey),
        hasConfirm: Boolean(urlConfirmation),
        hasReturn: Boolean(urlReturn),
        apiUrl: apiUrl,
      },
    });
  }

  if (!urlConfirmation || !urlReturn) {
    return res.status(500).json({
      error:
        'Faltan FLOW_URL_CONFIRMATION o FLOW_URL_RETURN en Vercel. Deben ser URLs https públicas de tu sitio.',
      debug: {
        hasConfirm: Boolean(urlConfirmation),
        hasReturn: Boolean(urlReturn),
      },
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
  let subject = String(body.subject || 'Pedido Aura Fragancias').trim();
  if (subject.length > 200) subject = subject.slice(0, 197) + '...';

  if (!email || !email.includes('@')) {
    return res.status(400).json({ error: 'Email inválido' });
  }
  if (!amount || amount < 350) {
    return res.status(400).json({ error: 'Monto mínimo $350' });
  }

  const commerceOrder = 'AURA-' + Date.now() + '-' + Math.floor(Math.random() * 9999);
  const optional = JSON.stringify({
    items: Array.isArray(body.items) ? body.items : [],
  });

  const params = {
    apiKey: apiKey,
    commerceOrder: commerceOrder,
    subject: subject,
    currency: 'CLP',
    amount: String(amount),
    email: email,
    urlConfirmation: urlConfirmation,
    urlReturn: urlReturn,
    optional: optional,
  };

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
        apiKeyPrefix: apiKey.slice(0, 8) + '…',
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
