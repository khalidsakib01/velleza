const axios = require('axios');
const qs = require('qs');

const SSL_MODE = (process.env.SSL_MODE || 'sandbox').toLowerCase();
const IS_LIVE_MODE = SSL_MODE === 'live';
const IS_PRODUCTION = process.env.VERCEL_ENV === 'production' || process.env.NODE_ENV === 'production';

const DEFAULT_SANDBOX = {
  store_id: 'testbox',
  store_passwd: 'qwerty'
};

const SSL_CONFIG = {
  store_id: process.env.SSL_STORE_ID || (IS_PRODUCTION ? '' : DEFAULT_SANDBOX.store_id),
  store_passwd: process.env.SSL_STORE_PASS || (IS_PRODUCTION ? '' : DEFAULT_SANDBOX.store_passwd),
  init_url: process.env.SSL_INIT_URL || (
    IS_LIVE_MODE
      ? 'https://securepay.sslcommerz.com/gwprocess/v4/api.php'
      : 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php'
  ),
  validate_url: process.env.SSL_VALIDATE_URL || (
    IS_LIVE_MODE
      ? 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php'
      : 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php'
  )
};

const FRONTEND_URL = (process.env.FRONTEND_URL || 'https://velleza.vercel.app').replace(/\/+$/, '');
const BACKEND_URL = (process.env.BACKEND_URL || 'https://velleza.vercel.app').replace(/\/+$/, '');
const ALLOWED_ORIGINS = new Set([
  FRONTEND_URL,
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://localhost:3000'
]);

function setCorsHeaders(req, res) {
  const origin = req.headers.origin;
  const allowedOrigin = origin && ALLOWED_ORIGINS.has(origin) ? origin : FRONTEND_URL;

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
}

function credentialsReady() {
  return Boolean(SSL_CONFIG.store_id && SSL_CONFIG.store_passwd);
}

function getAction(url) {
  const action = url.searchParams.get('action');
  const path = url.pathname;

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

function normalizeBody(body) {
  if (!body) return {};
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (_) {
      return {};
    }
  }
  return body;
}

async function validatePayment(valId) {
  const response = await axios.get(SSL_CONFIG.validate_url, {
    params: {
      val_id: valId,
      store_id: SSL_CONFIG.store_id,
      store_passwd: SSL_CONFIG.store_passwd,
      format: 'json'
    }
  });

  return response.data;
}

module.exports = async (req, res) => {
  setCorsHeaders(req, res);

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  const url = new URL(req.url, `https://${req.headers.host}`);
  const action = getAction(url);
  const body = normalizeBody(req.body);

  if (req.method === 'POST' && action === 'initiate') {
    if (!credentialsReady()) {
      return res.status(503).json({
        status: 'error',
        message: 'Payment gateway credentials are not configured.'
      });
    }

    const {
      tran_id,
      total_amount,
      currency = 'BDT',
      customer,
      products,
      note
    } = body;

    if (!tran_id || total_amount == null || Number.isNaN(Number(total_amount)) || !customer?.name) {
      return res.status(400).json({ status: 'error', message: 'Missing required fields' });
    }

    const productDesc = (products || [])
      .map((item) => `${item.name} x${item.quantity}`)
      .join(', ') || 'VELLEZA Products';

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
      num_of_item: (products || []).reduce((sum, item) => sum + (item.quantity || 1), 0) || 1,
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
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  if (req.method === 'POST' && action === 'validate') {
    if (!credentialsReady()) {
      return res.status(503).json({
        status: 'error',
        message: 'Payment gateway credentials are not configured.'
      });
    }

    const { val_id } = body;
    if (!val_id) {
      return res.status(400).json({ status: 'error', message: 'val_id missing' });
    }

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
    } catch (error) {
      return res.status(500).json({ status: 'error', message: error.message });
    }
  }

  if (req.method === 'POST' && action === 'success') {
    const { val_id, tran_id, amount, card_type } = body;

    if (credentialsReady() && val_id) {
      try {
        const data = await validatePayment(val_id);
        if (data.status === 'VALID' || data.status === 'VALIDATED') {
          return res.redirect(
            303,
            `${FRONTEND_URL}/order-success.html?tran_id=${encodeURIComponent(tran_id || '')}&amount=${encodeURIComponent(amount || '')}&method=${encodeURIComponent(card_type || '')}&status=success`
          );
        }
      } catch (_) {
      }
    }

    return res.redirect(303, `${FRONTEND_URL}/order-success.html?status=unverified&tran_id=${encodeURIComponent(tran_id || '')}`);
  }

  if (req.method === 'POST' && action === 'fail') {
    const { tran_id } = body;
    return res.redirect(303, `${FRONTEND_URL}/checkout.html?status=failed&tran_id=${encodeURIComponent(tran_id || '')}`);
  }

  if (req.method === 'POST' && action === 'cancel') {
    const { tran_id } = body;
    return res.redirect(303, `${FRONTEND_URL}/cart.html?status=cancelled&tran_id=${encodeURIComponent(tran_id || '')}`);
  }

  if (req.method === 'POST' && action === 'ipn') {
    console.log('[IPN]', JSON.stringify(body));
    return res.status(200).send('IPN received');
  }

  if (req.method === 'GET' && action === 'health') {
    return res.json({
      status: 'ok',
      mode: SSL_MODE,
      store_configured: credentialsReady(),
      timestamp: new Date().toISOString()
    });
  }

  return res.status(404).json({ status: 'error', message: 'Route not found' });
};
