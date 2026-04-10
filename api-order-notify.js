module.exports = async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ status: 'error', message: 'Method not allowed' });
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

  if (!resendApiKey || !fromEmail || !ownerEmail) {
    return res.status(202).json({
      status: 'skipped',
      message: 'Notification service is not configured yet.'
    });
  }

  const money = Number(order.total_amount || 0).toLocaleString();
  const itemLines = Array.isArray(order.products) && order.products.length
    ? order.products.map((item) => `- ${item.name} x${item.quantity}`).join('\n')
    : '- No line items captured';

  const ownerHtml = `
    <h2>New Order Update: ${event}</h2>
    <p><strong>Transaction:</strong> ${order.tran_id || 'N/A'}</p>
    <p><strong>Total:</strong> BDT ${money}</p>
    <p><strong>Payment:</strong> ${order.payment_label || order.payment_method || 'N/A'}</p>
    <p><strong>Customer:</strong> ${(order.customer && order.customer.name) || 'N/A'}</p>
    <p><strong>Email:</strong> ${customerEmail || 'N/A'}</p>
    <p><strong>Phone:</strong> ${(order.customer && order.customer.phone) || 'N/A'}</p>
    <p><strong>Address:</strong> ${(order.customer && order.customer.address) || 'N/A'}</p>
    <pre>${itemLines}</pre>
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
        subject: `VELLEZA order ${event}: ${order.tran_id || 'N/A'}`,
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
          subject: `Your VELLEZA order ${order.tran_id || ''}`,
          html: `
            <h2>Thank you for your order</h2>
            <p>We received your order and recorded it successfully.</p>
            <p><strong>Transaction:</strong> ${order.tran_id || 'N/A'}</p>
            <p><strong>Total:</strong> BDT ${money}</p>
            <p><strong>Payment:</strong> ${order.payment_label || order.payment_method || 'N/A'}</p>
            <pre>${itemLines}</pre>
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
