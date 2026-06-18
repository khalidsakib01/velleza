const notifyAttempts = new Map();
const RATE_LIMIT_WINDOW_MS = 10 * 60 * 1000;
const RATE_LIMIT_MAX = 8;

function rateLimitKey(req) {
  return String(
    req.headers['x-forwarded-for'] ||
    req.headers['x-real-ip'] ||
    req.socket?.remoteAddress ||
    'unknown'
  ).split(',')[0].trim();
}

function isRateLimited(req) {
  const now = Date.now();
  const key = rateLimitKey(req);
  const current = notifyAttempts.get(key) || { count: 0, resetAt: now + RATE_LIMIT_WINDOW_MS };

  if (now > current.resetAt) {
    notifyAttempts.set(key, { count: 1, resetAt: now + RATE_LIMIT_WINDOW_MS });
    return false;
  }

  current.count += 1;
  notifyAttempts.set(key, current);
  return current.count > RATE_LIMIT_MAX;
}

module.exports = async (req, res) => {
  const frontendUrl = (process.env.FRONTEND_URL || 'https://velleza.vercel.app').replace(/\/+$/, '');
  const allowedOrigins = new Set([
    frontendUrl,
    'http://127.0.0.1:5500',
    'http://localhost:5500',
    'http://127.0.0.1:3000',
    'http://localhost:3000'
  ]);
  const origin = req.headers.origin;
  const allowedOrigin = origin && allowedOrigins.has(origin) ? origin : frontendUrl;

  res.setHeader('Access-Control-Allow-Origin', allowedOrigin);
  res.setHeader('Vary', 'Origin');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type,X-Order-Notify-Secret');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
  }

  if (isRateLimited(req)) {
    return res.status(429).json({ status: 'error', message: 'Too many notification requests.' });
  }

  const notifySecret = process.env.ORDER_NOTIFY_SECRET;
  if (notifySecret && req.headers['x-order-notify-secret'] !== notifySecret) {
    return res.status(401).json({ status: 'error', message: 'Unauthorized notification request.' });
  }

  const body = typeof req.body === 'string'
    ? (() => {
        try {
          return JSON.parse(req.body);
        } catch (_) {
          return {};
        }
      })()
    : (req.body || {});

  const order = body.order || {};
  const event = body.event || 'order_update';
  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail = process.env.ORDER_FROM_EMAIL;
  const ownerEmail = process.env.ORDER_ALERT_EMAIL;
  const customerEmail = order.customer && order.customer.email;
  const allowedEvents = new Set(['payment_confirmed', 'cod_confirmed']);

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function safeText(value, maxLength = 160) {
    return String(value || '').trim().slice(0, maxLength);
  }

  if (!allowedEvents.has(event)) {
    return res.status(400).json({ status: 'error', message: 'Unsupported notification event.' });
  }

  if (!/^VLZ_\d{10,}$/.test(String(order.tran_id || ''))) {
    return res.status(400).json({ status: 'error', message: 'Invalid order reference.' });
  }

  if (!order.customer || !safeText(order.customer.phone, 24)) {
    return res.status(400).json({ status: 'error', message: 'Missing customer details.' });
  }

  if (!resendApiKey || !fromEmail || !ownerEmail) {
    return res.status(202).json({
      status: 'skipped',
      message: 'Notification service is not configured yet.'
    });
  }

  const money = Number(order.total_amount || 0).toLocaleString();
  const itemLines = Array.isArray(order.products) && order.products.length
    ? order.products.slice(0, 20).map((item) => `- ${safeText(item.name, 80)} x${Number.parseInt(item.quantity, 10) || 1}`).join('\n')
    : '- No line items captured';
  const safeEvent = escapeHtml(event);
  const safeTranId = escapeHtml(order.tran_id || 'N/A');
  const safePayment = escapeHtml(order.payment_label || order.payment_method || 'N/A');
  const safeCustomerName = escapeHtml(order.customer && order.customer.name || 'N/A');
  const safeCustomerEmail = escapeHtml(customerEmail || 'N/A');
  const safeCustomerPhone = escapeHtml(order.customer && order.customer.phone || 'N/A');
  const safeCustomerAddress = escapeHtml(order.customer && order.customer.address || 'N/A');
  const safeItemLines = escapeHtml(itemLines);

  const ownerHtml = `
    <h2>New Order Update: ${safeEvent}</h2>
    <p><strong>Transaction:</strong> ${safeTranId}</p>
    <p><strong>Total:</strong> BDT ${money}</p>
    <p><strong>Payment:</strong> ${safePayment}</p>
    <p><strong>Customer:</strong> ${safeCustomerName}</p>
    <p><strong>Email:</strong> ${safeCustomerEmail}</p>
    <p><strong>Phone:</strong> ${safeCustomerPhone}</p>
    <p><strong>Address:</strong> ${safeCustomerAddress}</p>
    <pre>${safeItemLines}</pre>
  `;

  const requests = [
    fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        from: fromEmail,
        to: [ownerEmail],
        subject: `VELLEZA order ${safeText(event, 40)}: ${safeText(order.tran_id, 40) || 'N/A'}`,
        html: ownerHtml
      })
    })
  ];

  if (customerEmail && (event === 'payment_confirmed' || event === 'cod_confirmed')) {
    requests.push(
      fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${resendApiKey}`,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          from: fromEmail,
          to: [customerEmail],
          subject: `Your VELLEZA order ${safeText(order.tran_id, 40) || ''}`,
          html: `
            <h2>Thank you for your order</h2>
            <p>We received your order and recorded it successfully.</p>
            <p><strong>Transaction:</strong> ${safeTranId}</p>
            <p><strong>Total:</strong> BDT ${money}</p>
            <p><strong>Payment:</strong> ${safePayment}</p>
            <pre>${safeItemLines}</pre>
          `
        })
      })
    );
  }

  try {
    const responses = await Promise.all(requests);
    const failed = responses.find((response) => !response.ok);
    if (failed) {
      return res.status(502).json({ status: 'error', message: 'Email provider rejected the request.' });
    }

    return res.status(200).json({ status: 'success' });
  } catch (error) {
    return res.status(500).json({ status: 'error', message: error.message });
  }
};
