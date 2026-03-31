/**
 * ╔══════════════════════════════════════════════════════════╗
 * ║         VELLEZA — SSLCommerz Payment Backend             ║
 * ║         Handles: bKash, Nagad, Cards, Net Banking        ║
 * ║         Mode: SANDBOX (test money, no real charges)      ║
 * ╚══════════════════════════════════════════════════════════╝
 *
 * SETUP:
 *   1. npm install
 *   2. Copy .env.example → .env and fill values
 *   3. node server.js  (or: npm run dev  with nodemon)
 *
 * DEPLOY FREE:
 *   Vercel  → vercel deploy
 *   Render  → connect GitHub repo → auto-deploy
 */

const express    = require('express');
const cors       = require('cors');
const axios      = require('axios');
const bodyParser = require('body-parser');
const qs         = require('qs');
require('dotenv').config();

const app  = express();
const PORT = process.env.PORT || 4000;

/* ── Middleware ── */
app.use(cors({ origin: '*' }));           // tighten to your domain in production
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

/* ── SSLCommerz Sandbox Config ── */
const SSL_CONFIG = {
  store_id:   process.env.SSL_STORE_ID   || 'testbox',
  store_passwd: process.env.SSL_STORE_PASS || 'qwerty',
  // Sandbox endpoint — change to live URL when going live:
  init_url: 'https://sandbox.sslcommerz.com/gwprocess/v4/api.php',
  // Validation endpoint:
  validate_url: 'https://sandbox.sslcommerz.com/validator/api/validationserverAPI.php',
};

/* ─────────────────────────────────────────────────────────
   POST /api/initiate-payment
   Called by checkout.html when user clicks "Place Order"
   Returns: { status, gatewayUrl }
───────────────────────────────────────────────────────── */
app.post('/api/initiate-payment', async (req, res) => {
  const {
    tran_id,
    total_amount,
    currency = 'BDT',
    customer,
    products,
    note,
  } = req.body;

  /* Basic validation */
 console.log('Received body:', req.body);
if (!tran_id || total_amount == null || Number.isNaN(Number(total_amount)) || !customer?.name) {
  return res.status(400).json({
    status: 'error',
    message: 'Missing required fields',
    debug: {
      tran_id,
      total_amount,
      customer_name: customer?.name
    }
  });
}
  /* Build product description string */
  const productDesc = (products || [])
    .map(p => `${p.name} x${p.quantity}`)
    .join(', ') || 'VELLEZA Products';

  /* Payload for SSLCommerz */
  const payload = {
    store_id:       SSL_CONFIG.store_id,
    store_passwd:   SSL_CONFIG.store_passwd,
    total_amount:   parseFloat(total_amount).toFixed(2),
    currency,
    tran_id,

    /* Your success / fail / cancel URLs (frontend pages) */
    success_url: process.env.SUCCESS_URL || `http://localhost:${PORT}/payment/success`,
    fail_url:    process.env.FAIL_URL    || `http://localhost:${PORT}/payment/fail`,
    cancel_url:  process.env.CANCEL_URL  || `http://localhost:${PORT}/payment/cancel`,

    /* IPN (server-to-server notification) — optional but recommended */
    ipn_url: process.env.IPN_URL || `http://localhost:${PORT}/api/ipn`,

    /* Customer details */
    cus_name:    customer.name,
    cus_email:   customer.email    || 'customer@velleza.com',
    cus_add1:    customer.address  || 'N/A',
    cus_add2:    customer.district || '',
    cus_city:    customer.city     || 'Dhaka',
    cus_state:   customer.district || customer.city || 'Dhaka',
    cus_postcode: customer.postcode || '1000',
    cus_country: 'Bangladesh',
    cus_phone:   customer.phone    || '01700000000',

    /* Shipping (same as billing for now) */
    ship_name:    customer.name,
    ship_add1:    customer.address || 'N/A',
    ship_add2:    customer.district || '',
    ship_city:    customer.city    || 'Dhaka',
    ship_state:   customer.district || customer.city || 'Dhaka',
    ship_postcode: customer.postcode || '1000',
    ship_country: 'Bangladesh',

    /* Product info */
    product_name:     productDesc,
    product_category: 'Fashion & Accessories',
    product_profile:  'physical-goods',
    product_amount:   parseFloat(total_amount).toFixed(2),
    shipping_method:  'Courier',
    num_of_item:      (products || []).reduce((s, p) => s + (p.quantity || 1), 0) || 1,

    /* Order note */
    value_a: note || '',
  };

  console.log(`\n[${new Date().toISOString()}] Initiating payment`);
  console.log('Transaction ID:', tran_id);
  console.log('Amount:', `${currency} ${total_amount}`);
  console.log('Customer:', customer.name, '|', customer.email);

  try {
    const response = await axios.post(
      SSL_CONFIG.init_url,
      qs.stringify(payload),          // SSLCommerz requires form-encoded
      {
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        timeout: 12000
      }
    );

    const data = response.data;

    if (data?.status === 'SUCCESS' && data?.GatewayPageURL) {
      console.log('✅ Gateway URL received:', data.GatewayPageURL);
      return res.json({ status: 'success', gatewayUrl: data.GatewayPageURL });
    } else {
      console.error('❌ SSLCommerz error:', data);
      return res.status(502).json({
        status: 'error',
        message: data?.failedreason || 'SSLCommerz initiation failed',
        raw: data,
      });
    }
  } catch (err) {
    console.error('❌ Network/request error:', err.message);
    const message = err.code === 'ECONNABORTED'
      ? 'SSLCommerz request timed out'
      : err.message;
    return res.status(500).json({ status: 'error', message });
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/validate-payment
   Called after SSLCommerz redirects to your success_url.
   Validates the payment is genuine before fulfilling order.
───────────────────────────────────────────────────────── */
app.post('/api/validate-payment', async (req, res) => {
  const { val_id } = req.body;
  if (!val_id) return res.status(400).json({ status: 'error', message: 'val_id missing' });

  try {
    const response = await axios.get(SSL_CONFIG.validate_url, {
      params: {
        val_id,
        store_id:   SSL_CONFIG.store_id,
        store_passwd: SSL_CONFIG.store_passwd,
        format: 'json',
      }
    });

    const data = response.data;
    console.log(`\n[VALIDATE] val_id=${val_id} status=${data.status}`);

    if (data.status === 'VALID' || data.status === 'VALIDATED') {
      /*
        ✅ Payment is genuine.
        Here you would:
          - Mark order as PAID in your database
          - Send confirmation email
          - Trigger fulfillment
      */
      return res.json({
        status: 'success',
        tran_id: data.tran_id,
        amount:  data.amount,
        currency: data.currency_type,
        card_type: data.card_type,      // e.g. "bKash", "Visa", "Nagad"
        payment_data: data,
      });
    } else {
      return res.status(402).json({ status: 'failed', message: 'Payment not valid', raw: data });
    }
  } catch (err) {
    return res.status(500).json({ status: 'error', message: err.message });
  }
});

/* ─────────────────────────────────────────────────────────
   POST /api/ipn
   Instant Payment Notification — SSLCommerz posts here
   automatically when payment status changes.
   Useful as a backup in case user closes browser early.
───────────────────────────────────────────────────────── */
app.post('/api/ipn', (req, res) => {
  const data = req.body;
  console.log('\n[IPN] Received:', JSON.stringify(data, null, 2));

  /*
    Validate the IPN by calling /api/validate-payment with data.val_id
    Then update your order database accordingly.
  */
  res.status(200).send('IPN received');
});

/* ─────────────────────────────────────────────────────────
   Payment result pages (SSLCommerz redirects here)
   These POST back with payment data.
   Forward the user to your frontend with query params.
───────────────────────────────────────────────────────── */

/* SUCCESS */
app.post('/payment/success', async (req, res) => {
  const { val_id, tran_id, amount, card_type } = req.body;
  console.log(`\n[SUCCESS] tran_id=${tran_id} val_id=${val_id}`);

  /* Validate the payment before trusting it */
  try {
    const vRes = await axios.post(
      `http://localhost:${PORT}/api/validate-payment`,
      { val_id },
      { headers: { 'Content-Type': 'application/json' } }
    );
    if (vRes.data.status === 'success') {
      /* Redirect to your frontend success page */
      return res.redirect(
        `${process.env.FRONTEND_URL || 'http://127.0.0.1:5500'}/order-success.html` +
        `?tran_id=${tran_id}&amount=${amount}&method=${encodeURIComponent(card_type || '')}&status=success`
      );
    }
  } catch (_) {}

  res.redirect(`${process.env.FRONTEND_URL || 'http://127.0.0.1:5500'}/order-success.html?status=unverified`);
});

/* FAIL */
app.post('/payment/fail', (req, res) => {
  const { tran_id, error } = req.body;
  console.log(`\n[FAIL] tran_id=${tran_id} error=${error}`);
  res.redirect(
    `${process.env.FRONTEND_URL || 'http://127.0.0.1:5500'}/checkout.html?status=failed&tran_id=${tran_id}`
  );
});

/* CANCEL */
app.post('/payment/cancel', (req, res) => {
  const { tran_id } = req.body;
  console.log(`\n[CANCEL] tran_id=${tran_id}`);
  res.redirect(
    `${process.env.FRONTEND_URL || 'http://127.0.0.1:5500'}/cart.html?status=cancelled`
  );
});

/* ── Health check ── */
app.get('/health', (req, res) => {
  res.json({
    status: 'ok',
    mode: 'sandbox',
    store_id: SSL_CONFIG.store_id,
    timestamp: new Date().toISOString(),
  });
});

/* ── Start server ── */
app.listen(PORT, () => {
  console.log('\n╔══════════════════════════════════════╗');
  console.log('║   VELLEZA Payment Server Running     ║');
  console.log(`║   http://localhost:${PORT}              ║`);
  console.log('║   Mode: SANDBOX (test only)          ║');
  console.log('╚══════════════════════════════════════╝\n');
  console.log(`Store ID:   ${SSL_CONFIG.store_id}`);
  console.log(`Init URL:   ${SSL_CONFIG.init_url}\n`);
});
