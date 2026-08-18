// api/flow-confirm.js — Flow llama aquí cuando confirma el pago. Debe responder 200 rápido.
module.exports = async function handler(req, res) {
  // Flow envía token; puedes consultar payment/getStatus si quieres validar.
  console.log('Flow confirmation', req.method, req.body || req.query);
  res.status(200).send('OK');
};
