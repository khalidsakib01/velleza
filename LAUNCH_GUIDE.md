# VELLEZA Launch Guide

## What Changed

- Orders are now written to Firestore from checkout and the success page.
- SSLCommerz callbacks now run through the new Vercel handler in `api/payment-handler.js`.
- Production payment config no longer silently depends on sandbox defaults.
- The success page no longer promises an email unless you add a mailer.
- The site now includes an admin order dashboard, email-ready notifications, and policy pages.

## Required Before Going Live

1. In Vercel, set:
   - `SSL_MODE=live`
   - `SSL_STORE_ID=your_live_store_id`
   - `SSL_STORE_PASS=your_live_store_password`
   - `FRONTEND_URL=https://your-domain`
   - `BACKEND_URL=https://your-domain`
   - `RESEND_API_KEY=your_resend_api_key`
   - `ORDER_FROM_EMAIL=orders@your-domain.com`
   - `ORDER_ALERT_EMAIL=khalidsakib01@gmail.com`

2. In SSLCommerz merchant settings, use these callback URLs:
   - `https://your-domain/payment/success`
   - `https://your-domain/payment/fail`
   - `https://your-domain/payment/cancel`
   - `https://your-domain/payment/ipn`

3. `admin-orders.html` is already set to `khalidsakib01@gmail.com` as the admin login email.

4. `firestore.rules` is already set to `khalidsakib01@gmail.com`; publish those rules in Firebase Console.

## Firestore Rules

Use the repo file `firestore.rules` as your source of truth:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function signedIn() {
      return request.auth != null;
    }

    function isAdmin() {
      return signedIn() && request.auth.token.email in [
        "khalidsakib01@gmail.com"
      ];
    }

    match /users/{userId} {
      allow read, write: if signedIn() && request.auth.uid == userId;
    }

    match /orders/{orderId} {
      allow create: if true;
      allow read: if isAdmin();
      allow update: if isAdmin();
      allow delete: if false;
    }
  }
}
```

## Resend Setup

1. Create a Resend account.
2. Add and verify your domain.
3. Create a sender address that matches your verified domain, such as `orders@your-domain.com`.
4. Put that sender in `ORDER_FROM_EMAIL`.

## Payment Test Checklist

1. Test one successful SSLCommerz payment.
2. Test one failed payment return.
3. Test one cancelled payment return.
4. Test one cash-on-delivery order.
5. Double-click the checkout button and confirm only one order is submitted.
6. Confirm each order appears in Firestore.
7. Confirm each order appears in `admin-orders.html`.
8. Confirm owner email alerts arrive after order creation and payment confirmation.

## Still Requires Your Dashboard Access

- Publishing Firestore rules in Firebase Console
- Setting Vercel environment variables
- Verifying your Resend sending domain
- Updating SSLCommerz merchant callback URLs
