(function () {
  const firebaseConfig = {
    apiKey: "AIzaSyCcmnhjA05Xj3oHo8m3AS6EiOPXu-ewn0g",
    authDomain: "vellega-auth.firebaseapp.com",
    projectId: "vellega-auth",
    storageBucket: "vellega-auth.firebasestorage.app",
    messagingSenderId: "422298524460",
    appId: "1:422298524460:web:c4bb023f1301bfe16bea89",
    measurementId: "G-LHMJRCS07C"
  };

  function ensureDb() {
    if (!window.firebase || !window.firebase.firestore) {
      throw new Error("Firebase Firestore is not available.");
    }

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    return firebase.firestore();
  }

  function safeParse(value, fallback) {
    try {
      return JSON.parse(value);
    } catch (_) {
      return fallback;
    }
  }

  function getStoredUser() {
    const user = safeParse(localStorage.getItem("user") || "null", null);
    return user && typeof user === "object" ? user : null;
  }

  function normalizeItems(products) {
    return (products || []).map((item) => ({
      name: String(item.name || "Item").trim().slice(0, 80),
      quantity: Math.min(Math.max(Number.parseInt(item.quantity ?? item.qty ?? 1, 10) || 1, 1), 10),
      price: Number(item.price || 0),
      size: String(item.size || "").trim().slice(0, 20),
      image: String(item.image || "").trim().slice(0, 160),
      category: String(item.category || "").trim().slice(0, 80)
    }));
  }

  function text(value, maxLength) {
    return String(value || "").trim().slice(0, maxLength);
  }

  function buildOrderRecord(orderData, overrides) {
    const data = orderData || {};
    const extra = overrides || {};
    const now = firebase.firestore.FieldValue.serverTimestamp();
    const storedUser = getStoredUser();
    const items = normalizeItems(data.products);
    const totalAmount = Number(extra.total_amount ?? data.total_amount ?? 0);
    const paymentMethod = extra.payment_method || data.payment_method || "sslcommerz";
    const transactionId = extra.tran_id || data.tran_id || `VLZ_${Date.now()}`;

    return {
      tran_id: transactionId,
      source: "website",
      currency: extra.currency || data.currency || "BDT",
      total_amount: totalAmount,
      order_status: extra.order_status || "pending",
      payment_status: extra.payment_status || "pending",
      fulfillment_status: extra.fulfillment_status || "new",
      payment_method: paymentMethod,
      customer: {
        name: text(extra.customer?.name || data.customer?.name, 80),
        email: text(extra.customer?.email || data.customer?.email, 120),
        phone: text(extra.customer?.phone || data.customer?.phone, 24),
        address: text(extra.customer?.address || data.customer?.address, 240),
        district: text(extra.customer?.district || data.customer?.district, 60),
        city: text(extra.customer?.city || data.customer?.city, 60),
        postcode: text(extra.customer?.postcode || data.customer?.postcode, 12),
        country: extra.customer?.country || data.customer?.country || "Bangladesh"
      },
      products: items,
      note: text(extra.note ?? data.note, 500),
      auth_user: storedUser ? {
        name: storedUser.name || "",
        email: storedUser.email || "",
        phone: storedUser.phone || "",
        uid: storedUser.uid || ""
      } : null,
      payment_details: {
        gateway: paymentMethod === "cod" ? "cash-on-delivery" : "sslcommerz",
        method_label: extra.method_label || "",
        amount: Number((extra.payment_amount ?? totalAmount) || 0),
        val_id: extra.val_id || "",
        card_type: extra.card_type || ""
      },
      created_at: extra.created_at || now,
      updated_at: now
    };
  }

  async function saveOrder(orderData, overrides) {
    const db = ensureDb();
    const record = buildOrderRecord(orderData, overrides);
    await db.collection("orders").doc(record.tran_id).set(record, { merge: true });
    return record;
  }

  window.VellezaOrderStore = {
    buildOrderRecord,
    getStoredUser,
    saveOrder
  };
})();
