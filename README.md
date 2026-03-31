# VELLEZA — Payment Gateway Setup Guide
## SSLCommerz · bKash · Nagad · Cards · Sandbox Mode

---

## 📁 Files Overview

| File | Purpose |
|---|---|
| `server.js` | Node.js backend — talks to SSLCommerz API |
| `package.json` | Node dependencies |
| `.env.example` | Environment variable template |
| `cart.html` | Fixed cart page |
| `checkout.html` | Checkout form + payment trigger |
| `order-success.html` | Success / fail / COD result page |

---

## 🚀 Step 1 — Install & Run Backend

```bash
# In your backend folder:
npm install

# Copy env file
cp .env.example .env

# Start server (sandbox mode, no real money)
npm run dev
```

Server runs at: `http://localhost:4000`

---

## 🔧 Step 2 — Connect Checkout to Backend

In `checkout.html`, find the `initiateSSLCommerz()` function and replace it:

```javascript
async function initiateSSLCommerz(orderData) {
  const res = await fetch('http://localhost:4000/api/initiate-payment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(orderData)
  });
  const json = await res.json();
  if (json.status !== 'success') throw new Error(json.message);
  return json.gatewayUrl;
}
```

---

## 🧪 Step 3 — Test Sandbox Payments

### Test Card (Visa/Mastercard)
| Field | Value |
|---|---|
| Card Number | `4111 1111 1111 1111` |
| Expiry | Any future date (e.g. `12/26`) |
| CVV | Any 3 digits (e.g. `123`) |
| OTP | `123456` |

### Test bKash
| Field | Value |
|---|---|
| bKash Number | `01711111111` |
| OTP | `123456` |
| PIN | `12345` |

### Test Nagad
| Field | Value |
|---|---|
| Nagad Number | `01711111111` |
| OTP | `123456` |

---

## 🌐 Step 4 — Make Backend Publicly Accessible (for SSLCommerz callbacks)

SSLCommerz needs to POST back to your success/fail/cancel URLs. 
`localhost` won't work — use **ngrok** for testing:

```bash
# Install ngrok: https://ngrok.com
ngrok http 4000
```

Copy the ngrok URL (e.g. `https://abc123.ngrok.io`) and update `.env`:

```env
SUCCESS_URL=https://abc123.ngrok.io/payment/success
FAIL_URL=https://abc123.ngrok.io/payment/fail
CANCEL_URL=https://abc123.ngrok.io/payment/cancel
IPN_URL=https://abc123.ngrok.io/api/ipn
FRONTEND_URL=http://127.0.0.1:5500
```

Restart the server after updating `.env`.

---

## ☁️ Step 5 — Deploy Backend Free (Production)

### Option A: Vercel (Recommended — easiest)
```bash
npm i -g vercel
vercel deploy
```
Add environment variables in Vercel dashboard → Settings → Environment Variables.

### Option B: Render.com
1. Push your backend folder to GitHub
2. Go to render.com → New Web Service → connect repo
3. Set Build Command: `npm install`
4. Set Start Command: `node server.js`
5. Add environment variables in Render dashboard

---

## 💳 Step 6 — Go Live (Real Money)

1. Register at https://merchant.sslcommerz.com
2. Submit business documents (takes 2–5 days)
3. Get approved → receive live Store ID + Store Password
4. Update `.env`:
   ```env
   SSL_STORE_ID=your_live_store_id
   SSL_STORE_PASS=your_live_store_password
   ```
5. Change SSLCommerz URLs in `server.js` from sandbox to live:
   ```javascript
   init_url: 'https://securepay.sslcommerz.com/gwprocess/v4/api.php',
   validate_url: 'https://securepay.sslcommerz.com/validator/api/validationserverAPI.php',
   ```

---

## 💰 SSLCommerz Fees (Live Mode)

| Method | Fee |
|---|---|
| bKash / Nagad | ~1.5% per transaction |
| Visa / Mastercard | ~2.5% per transaction |
| Net Banking | ~1.5–2% |
| Setup Fee | Free |
| Monthly Fee | Free |

---

## 🔄 Payment Flow Summary

```
User clicks "Place Order"
        ↓
checkout.html → POST /api/initiate-payment (your backend)
        ↓
server.js → POST to SSLCommerz API (with store credentials)
        ↓
SSLCommerz returns GatewayPageURL
        ↓
User redirected to SSLCommerz payment page
(chooses bKash / Nagad / Card / etc.)
        ↓
Payment success/fail
        ↓
SSLCommerz POSTs to your /payment/success or /payment/fail
        ↓
server.js validates payment with SSLCommerz
        ↓
User redirected to order-success.html
```

---

## 📞 SSLCommerz Support

- Docs: https://developer.sslcommerz.com/doc/v4/
- Sandbox: https://sandbox.sslcommerz.com
- Email: integration@sslcommerz.com
