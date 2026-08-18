// api/flow-create.js  — Vercel Serverless Function
const crypto = require('crypto');

function sign(params, secretKey) {
  const keys = Object.keys(params).sort();
  let toSign = '';
  for (const k of keys) toSign += k + params[k];
  return crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    return res.status(204).end();
  }
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  res.setHeader('Access-Control-Allow-Origin', '*');

  const apiKey = process.env.FLOW_API_KEY;
  const secretKey = process.env.FLOW_SECRET_KEY;
  const apiUrl = (process.env.FLOW_API_URL || 'https://www.flow.cl/api').replace(/\/$/, '');
  const urlConfirmation = process.env.FLOW_URL_CONFIRMATION;
  const urlReturn = process.env.FLOW_URL_RETURN;

  if (!apiKey || !secretKey) {
    return res.status(500).json({ error: 'Faltan FLOW_API_KEY o FLOW_SECRET_KEY en Vercel' });
  }
  if (!urlConfirmation || !urlReturn) {
    return res.status(500).json({ error: 'Faltan FLOW_URL_CONFIRMATION o FLOW_URL_RETURN en Vercel' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) {
      return res.status(400).json({ error: 'JSON inválido' });
    }
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
    apiKey,
    commerceOrder,
    subject,
    currency: 'CLP',
    amount: String(amount),
    email,
    urlConfirmation,
    urlReturn,
    optional,
  };

  params.s = sign(params, secretKey);

  try {
    const form = new URLSearchParams(params).toString();
    const r = await fetch(apiUrl + '/payment/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: form,
    });
    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      console.error('Flow error', data);
      return res.status(502).json({
        error: (data && (data.message || data.error)) || 'Error al crear pago en Flow',
        detail: data,
      });
    }
    if (!data.url || !data.token) {
      return res.status(502).json({ error: 'Respuesta incompleta de Flow', detail: data });
    }
    const payUrl = data.url + (data.url.includes('?') ? '&' : '?') + 'token=' + data.token;
    return res.status(200).json({
      url: payUrl,
      token: data.token,
      flowOrder: data.flowOrder,
      commerceOrder,
    });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Error de conexión con Flow' });
  }
};
