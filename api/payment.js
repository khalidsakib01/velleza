const axios = require('axios');
const qs = require('qs');

const SSL_CONFIG = {
  store_id: process.env.SSL_STORE_ID || 'testbox',
  store_passwd: process.env.SSL_STORE_PASS || 'qwerty',
  init_url: 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
  validate_url: 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
};

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://velleza.vercel.app').replace(/\/+$/, '');
const BACKEND_URL = (process.env.BACKEND_URL || 'https://velleza.vercel.app').replace(/\/+$/, '');

async function validatePayment(val_id) {
  const response = await axios.get(SSL_CONFIG.validate_url, {
    params: {
      val_id,
      store_id: SSL_CONFIG.store_id,
      store_passwd: SSL_CONFIG.store_passwd,
      format: 'json'
    }
  });

  return response.data;
}

module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.status(200).end();

  const url = new URL(req.url, `https://${req.headers.host}`);
  const action = url.searchParams.get('action');
  const path = url.pathname;

  function getAction() {
    if (action) return action;
    if (path.endsWith('/api/initiate-payment')) return 'initiate';
    if (path.endsWith('/api/validate-payment')) return 'validate';
    if (path.endsWith('/api/health')) return 'health';
    if (path.endsWith('/success')) return 'success';
    if (path.endsWith('/fail')) return 'fail';
    if (path.endsWith('/cancel')) return 'cancel';
    if (path.endsWith('/ipn')) return 'ipn';
    return null;
  }

  const resolvedAction = getAction();

  let body = req.body || {};
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body);
    } catch (_) {
      body = {};
    }
  }

  if (req.method === 'POST' && resolvedAction === 'initiate') {
    const { tran_id, total_amount, currency = 'BDT', customer, products, note } = body;

    if (!tran_id || total_amount == null || !customer?.name) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const productDesc = (products || []).map((p) => `${p.name} x${p.quantity}`).join(', ') || 'VELLEZA Products';

    const payload = {
      store_id: SSL_CONFIG.store_id,
      store_passwd: SSL_CONFIG.store_passwd,
      total_amount: parseFloat(total_amount).toFixed(2),
      currency,
      tran_id,

      success_url: `${BACKEND_URL}/payment/success`,
      fail_url: `${BACKEND_URL}/payment/fail`,
      cancel_url: `${BACKEND_URL}/payment/cancel`,
      ipn_url: `${BACKEND_URL}/payment/ipn`,

      cus_name: customer.name,
      cus_email: customer.email || 'customer@velleza.com',
      cus_add1: customer.address || 'N/A',
      cus_city: customer.city || 'Dhaka',
      cus_state: customer.district || 'Dhaka',
      cus_postcode: customer.postcode || '1000',
      cus_country: 'Bangladesh',
      cus_phone: customer.phone || '01700000000',

      ship_name: customer.name,
      ship_add1: customer.address || 'N/A',
      ship_city: customer.city || 'Dhaka',
      ship_state: customer.district || 'Dhaka',
      ship_postcode: customer.postcode || '1000',
      ship_country: 'Bangladesh',

      product_name: productDesc,
      product_category: 'Fashion & Accessories',
      product_profile: 'physical-goods',
      product_amount: parseFloat(total_amount).toFixed(2),
      shipping_method: 'Courier',
      num_of_item: (products || []).reduce((s, p) => s + (p.quantity || 1), 0) || 1,
      value_a: note || ''
    };

    try {
      const response = await axios.post(SSL_CONFIG.init_url, qs.stringify(payload), {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 12000
      });

      const data = response.data;
      if (data?.status === 'SUCCESS' && data?.GatewayPageURL) {
        return res.json({ status: 'success', gatewayUrl: data.GatewayPageURL });
      }

      return res.status(502).json({
        status: 'error',
        message: data?.failedreason || 'SSLCommerz initiation failed',
        raw: data
      });
    } catch (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
  }

  if (req.method === 'POST' && resolvedAction === 'validate') {
    const { val_id } = body;
    if (!val_id) return res.status(400).json({ status: 'error', message: 'val_id missing' });

    try {
      const data = await validatePayment(val_id);
      if (data.status === 'VALID' || data.status === 'VALIDATED') {
        return res.json({
          status: 'success',
          tran_id: data.tran_id,
          amount: data.amount,
          currency: data.currency_type,
          card_type: data.card_type,
          payment_data: data
        });
      }
      return res.status(402).json({ status: 'failed', message: 'Payment not valid', raw: data });
    } catch (err) {
      return res.status(500).json({ status: 'error', message: err.message });
    }
  }

  if (req.method === 'POST' && resolvedAction === 'success') {
    const { val_id, tran_id, amount, card_type } = body;

    try {
      const data = await validatePayment(val_id);
      if (data.status === 'VALID' || data.status === 'VALIDATED') {
        return res.redirect(
          303,
          `${FRONTEND_URL}/order-success.html?tran_id=${encodeURIComponent(tran_id || '')}&amount=${encodeURIComponent(amount || '')}&method=${encodeURIComponent(card_type || '')}&status=success`
        );
      }
    } catch (_) {}

    return res.redirect(303, `${FRONTEND_URL}/order-success.html?status=unverified`);
  }

  if (req.method === 'POST' && resolvedAction === 'fail') {
    const { tran_id } = body;
    return res.redirect(303, `${FRONTEND_URL}/checkout.html?status=failed&tran_id=${encodeURIComponent(tran_id || '')}`);
  }

  if (req.method === 'POST' && resolvedAction === 'cancel') {
    const { tran_id } = body;
    return res.redirect(303, `${FRONTEND_URL}/cart.html?status=cancelled&tran_id=${encodeURIComponent(tran_id || '')}`);
  }

  if (req.method === 'POST' && resolvedAction === 'ipn') {
    console.log('[IPN]', JSON.stringify(body));
    return res.status(200).send('IPN received');
  }

  if (req.method === 'GET' && resolvedAction === 'health') {
    return res.json({
      status: 'ok',
      mode: 'sandbox',
      store_id: SSL_CONFIG.store_id,
      timestamp: new Date().toISOString()
    });
  }

  return res.status(404).json({ status: 'error', message: 'Route not found' });
};


