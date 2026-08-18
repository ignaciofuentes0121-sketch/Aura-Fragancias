const crypto = require('crypto');

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const apiKey = process.env.FLOW_API_KEY;
  const secretKey = process.env.FLOW_SECRET_KEY;
  const flowApiUrl = process.env.FLOW_API_URL || 'https://www.flow.cl/api';
  const urlConfirmation = process.env.FLOW_URL_CONFIRMATION;
  const urlReturn = process.env.FLOW_URL_RETURN;

  if (!apiKey || !secretKey) {
    return res.status(500).json({ error: 'Internal Server Error - apiKey not found' });
  }

  let body = req.body;
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (e) {
      return res.status(400).json({ error: 'JSON inválido' });
    }
  }

  const { amount, subject, email } = body || {};
  const commerceOrder = 'ORDEN-' + Date.now();

  const params = {
    apiKey: apiKey,
    commerceOrder: commerceOrder,
    subject: subject || 'Compra en Aura Fragancias',
    currency: 'CLP',
    amount: amount || 1000,
    email: email || 'test@test.com',
    urlConfirmation: urlConfirmation,
    urlReturn: urlReturn
  };

  const keys = Object.keys(params).sort();
  let toSign = '';
  keys.forEach(key => {
    toSign += key + params[key];
  });

  const signature = crypto.createHmac('sha256', secretKey).update(toSign).digest('hex');
  params.signature = signature;

  try {
    const response = await fetch(${flowApiUrl}/payment/create, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(params).toString()
    });

    const data = await response.json();
    
    if (data.url && data.token) {
      return res.status(200).json({ redirectUrl: ${data.url}?token=${data.token} });
    } else {
      return res.status(400).json({ error: 'Error al generar el pago en Flow', details: data });
    }
  } catch (error) {
    return res.status(500).json({ error: 'Error del servidor', details: error.message });
  }
}
