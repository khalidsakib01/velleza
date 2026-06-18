/**
 * VELLEZA SSLCommerz Payment Backend
 * Handles: bKash, Nagad, Cards, Net Banking
 * Mode: SANDBOX (test money, no real charges)
 *
 * SETUP:
 *   1. npm install
 *   2. Copy .env.example -> .env and fill values
 *   3. node server.js
 */

const express = require('express');
const cors = require('cors');
const axios = require('axios');
const bodyParser = require('body-parser');
const qs = require('qs');
const catalogProducts = require('./products.js');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 4000;

const normalizeUrl = (url) => (url ? String(url).replace(/\/+$/, '') : '');
const FRONTEND_URL = normalizeUrl(process.env.FRONTEND_URL) || 'http://127.0.0.1:5500';
const BACKEND_URL = normalizeUrl(process.env.BACKEND_URL) || `http://localhost:${PORT}`;

const ALLOWED_ORIGINS = new Set([
  FRONTEND_URL,
  'http://127.0.0.1:5500',
  'http://localhost:5500',
  'http://127.0.0.1:3000',
  'http://localhost:3000'
]);

app.use(cors({
  origin(origin, callback) {
    if (!origin || ALLOWED_ORIGINS.has(origin)) return callback(null, true);
    return callback(new Error('Origin not allowed'));
  }
}));
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

const SSL_CONFIG = {
  store_id: process.env.SSL_STORE_ID || 'testbox',
  store_passwd: process.env.SSL_STORE_PASS || 'qwerty',
  init_url: 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
  validate_url: 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php',
};

function text(value, maxLength = 120) {
  return String(value || '').trim().slice(0, maxLength);
}

function normalizeProducts(products) {
  if (!Array.isArray(products) || !products.length || products.length > 20) {
    throw new Error('Invalid products.');
  }

  return products.map((item) => {
    const catalogItem = catalogProducts.find((product) => product.name === (item && item.name));
    if (!catalogItem) throw new Error('Unknown product.');

    const quantity = Number.parseInt(item.quantity ?? item.qty ?? 1, 10);
    if (!Number.isInteger(quantity) || quantity < 1 || quantity > 10) {
      throw new Error('Invalid product quantity.');
    }

    return {
      name: catalogItem.name,
      quantity,
      price: Number(catalogItem.price),
      size: text(item.size, 20),
      category: catalogItem.category || ''
    };
  });
}

function normalizeCustomer(customer) {
  const clean = customer || {};
  const normalized = {
    name: text(clean.name, 80),
    email: text(clean.email, 120),
    phone: text(clean.phone, 24),
    address: text(clean.address, 240),
    district: text(clean.district || clean.city, 60),
    city: text(clean.city || clean.district, 60),
    postcode: text(clean.postcode || '1000', 12)
  };

  if (normalized.name.length < 2) throw new Error('Customer name is required.');
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalized.email)) throw new Error('Valid customer email is required.');
  if (!/^\+?8801[3-9]\d{8}$/.test(normalized.phone)) throw new Error('Valid Bangladesh phone is required.');
  if (normalized.address.length < 10) throw new Error('Shipping address is required.');
  if (!normalized.city) throw new Error('Customer district is required.');

  return normalized;
}

function normalizeOrderInput(body) {
  const products = normalizeProducts(body.products);
  const total = products.reduce((sum, item) => sum + (item.price * item.quantity), 0);
  const requestedTotal = Number(body.total_amount);

  if (!Number.isFinite(requestedTotal) || Math.abs(requestedTotal - total) > 0.01) {
    throw new Error('Cart total does not match product catalog.');
  }

  const tran_id = text(body.tran_id, 40);
  if (!/^VLZ_\d{10,}$/.test(tran_id)) throw new Error('Invalid transaction ID.');

  return {
    tran_id,
    total_amount: total,
    currency: body.currency === 'BDT' ? 'BDT' : 'BDT',
    customer: normalizeCustomer(body.customer),
    products,
    note: text(body.note, 500)
  };
}

app.post('/api/initiate-payment', async (req, res) => {
  let orderInput;
  try {
    orderInput = normalizeOrderInput(req.body);
  } catch (error) {
    return res.status(400).json({ status: 'error', message: error.message });
  }

  const { tran_id, total_amount, currency, customer, products, note } = orderInput;

  const productDesc = (products || [])
    .map(p => `${p.name} x${p.quantity}`)
    .join(', ') || 'VELLEZA Products';

  const payload = {
    store_id: SSL_CONFIG.store_id,
    store_passwd: SSL_CONFIG.store_passwd,
    total_amount: parseFloat(total_amount).toFixed(2),
    currency,
    tran_id,

    success_url: process.env.SUCCESS_URL || `${BACKEND_URL}/payment/success`,
    fail_url: process.env.FAIL_URL || `${BACKEND_URL}/payment/fail`,
    cancel_url: process.env.CANCEL_URL || `${BACKEND_URL}/payment/cancel`,
    ipn_url: process.env.IPN_URL || `${BACKEND_URL}/api/ipn`,

    cus_name: customer.name,
    cus_email: customer.email || 'customer@velleza.com',
    cus_add1: customer.address || 'N/A',
    cus_add2: customer.district || '',
    cus_city: customer.city || 'Dhaka',
    cus_state: customer.district || customer.city || 'Dhaka',
    cus_postcode: customer.postcode || '1000',
    cus_country: 'Bangladesh',
    cus_phone: customer.phone || '01700000000',

    ship_name: customer.name,
    ship_add1: customer.address || 'N/A',
    ship_add2: customer.district || '',
    ship_city: customer.city || 'Dhaka',
    ship_state: customer.district || customer.city || 'Dhaka',
    ship_postcode: customer.postcode || '1000',
    ship_country: 'Bangladesh',

    product_name: productDesc,
    product_category: 'Fashion & Accessories',
    product_profile: 'physical-goods',
    product_amount: parseFloat(total_amount).toFixed(2),
    shipping_method: 'Courier',
    num_of_item: (products || []).reduce((s, p) => s + (p.quantity || 1), 0) || 1,

    value_a: note || '',
  };

  console.log(`\n[${new Date().toISOString()}] Initiating payment`);
  console.log('Transaction ID:', tran_id);
  console.log('Amount:', `${currency} ${total_amount}`);
  console.log('Customer:', customer.name, '|', customer.email);

  try {
    const response = await axios.post(
      SSL_CONFIG.init_url,
      qs.stringify(payload),
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 12000
      }
    );

    const data = response.data;

    if (data?.status === 'SUCCESS' && data?.GatewayPageURL) {
      console.log('Gateway URL received:', data.GatewayPageURL);
      return res.json({ status: 'success', gatewayUrl: data.GatewayPageURL });
    } else {
      console.error('SSLCommerz error:', data);
      return res.status(502).json({
        status: 'error',
        message: data?.failedreason || 'SSLCommerz initiation failed',
        raw: data,
      });
    }
  } catch (err) {
    console.error('Network/request error:', err.message);
    const message = err.code === 'ECONNABORTED'
      ? 'SSLCommerz request timed out'
      : err.message;
    return res.status(500).json({ status: 'error', message });
  }
});

app.post('/api/validate-payment', async (req, res) => {
  const { val_id } = req.body;
  if (!val_id) return res.status(400).json({ status: 'error', message: 'val_id missing' });

  try {
    const response = await axios.get(SSL_CONFIG.validate_url, {
      params: {
        val_id,
        store_id: SSL_CONFIG.store_id,
        store_passwd: SSL_CONFIG.store_passwd,
        format: 'json',
      }
    });

    const data = response.data;
    console.log(`\n[VALIDATE] val_id=${val_id} status=${data.status}`);

    if (data.status === 'VALID' || data.status === 'VALIDATED') {
      return res.json({
        status: 'success',
        tran_id: data.tran_id,
        amount: data.amount,
        currency: data.currency_type,
        card_type: data.card_type,
        payment_data: data,
      });
    } else {
      return res.status(402).json({ status: 'failed', message: 'Payment not valid', raw: data });
    }
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

app.post('/api/ipn', (req, res) => {
  const data = req.body;
  console.log('\n[IPN] Received:', JSON.stringify(data, null, 2));
  res.status(200).send('IPN received');
});

app.post('/payment/success', async (req, res) => {
  const { val_id, tran_id, amount, card_type } = req.body;
  console.log(`\n[SUCCESS] tran_id=${tran_id} val_id=${val_id}`);

  try {
    const vRes = await axios.post(
      `http://localhost:${PORT}/api/validate-payment`,
      { val_id },
      { headers: { 'Content-Type': 'application/json' } }
    );

    if (vRes.data.status === 'success') {
      return res.redirect(
        303,
        `${FRONTEND_URL}/order-success.html?tran_id=${tran_id}&amount=${amount}&method=${encodeURIComponent(card_type || '')}&val_id=${encodeURIComponent(val_id || '')}&status=success`
      );
    }
  } catch (_) {}

  res.redirect(303, `${FRONTEND_URL}/order-success.html?status=unverified`);
});

app.post('/payment/fail', (req, res) => {
  const { tran_id, error } = req.body;
  console.log(`\n[FAIL] tran_id=${tran_id} error=${error}`);
  res.redirect(
    303,
    `${FRONTEND_URL}/checkout.html?status=failed&tran_id=${tran_id}`
  );
});

app.post('/payment/cancel', (req, res) => {
  const { tran_id } = req.body;
  console.log(`\n[CANCEL] tran_id=${tran_id}`);
  res.redirect(
    303,
    `${FRONTEND_URL}/cart.html?status=cancelled`
  );
});

app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'sandbox',
    store_id: SSL_CONFIG.store_id,
    timestamp: new Date().toISOString(),
  });
});

app.listen(PORT, () => {
  console.log(`Payment server running on http://localhost:${PORT}`);
  console.log(`Store ID: ${SSL_CONFIG.store_id}`);
  console.log(`Init URL: ${SSL_CONFIG.init_url}`);
});
