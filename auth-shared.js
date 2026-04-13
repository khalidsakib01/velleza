(function () {
  function updateCartCount() {
    var cart = JSON.parse(localStorage.getItem("cart") || "[]");
    var total = cart.reduce(function (sum, item) {
      return sum + (item.quantity || item.qty || 1);
    }, 0);

    var badge = document.getElementById("cart-count");
    if (badge) {
      badge.textContent = total;
      badge.classList.toggle("visible", total > 0);
    }
  }

  function initSearch() {
    if (!window.VellezaSearch) return;
    window.VellezaSearch.initDropdownSearches({
      containerSelector: ".search-container",
      toggleSelector: ".search-toggle",
      dropdownSelector: ".search-dropdown",
      inputSelector: ".search-input",
      resultsSelector: ".search-results",
      itemClass: "search-result-item",
      nameClass: "search-result-name",
      metaClass: "search-result-meta",
      noResultsText: "No matching products found."
    });
  }

  function openPanel(id) {
    var panel = document.getElementById(id);
    var overlay = document.getElementById("overlay");

    if (panel) panel.classList.add("open");
    if (overlay) overlay.classList.add("active");
    if (id === "contact-panel") {
      document.body.classList.add("contact-open");
    }
    if (id === "menu-panel") {
      document.body.classList.add("menu-open");
    }
  }

  function closePanel(id) {
    var panel = document.getElementById(id);
    if (panel) panel.classList.remove("open");
    if (id === "contact-panel") {
      document.body.classList.remove("contact-open");
    }
    if (id === "menu-panel") {
      document.body.classList.remove("menu-open");
    }

    if (!document.querySelector(".panel.open")) {
      var overlay = document.getElementById("overlay");
      if (overlay) overlay.classList.remove("active");
    }
  }

  function closePanels() {
    document.querySelectorAll(".panel.open").forEach(function (panel) {
      panel.classList.remove("open");
    });
    document.body.classList.remove("contact-open", "menu-open");

    var overlay = document.getElementById("overlay");
    if (overlay) overlay.classList.remove("active");
  }

  window.openPanel = openPanel;
  window.closePanel = closePanel;
  window.closePanels = closePanels;

  function applyMobileMode() {
    var mobile = window.matchMedia("(max-width: 768px), (pointer: coarse)").matches;
    document.body.classList.toggle("mobile-view", mobile);
  }

  function isDesktopAuthLayout() {
    return !window.matchMedia("(max-width: 980px)").matches;
  }

  function initFirebaseConfig() {
    if (!window.firebase) return null;

    var firebaseConfig = {
      apiKey: "AIzaSyCcmnhjA05Xj3oHo8m3AS6EiOPXu-ewn0g",
      authDomain: "vellega-auth.firebaseapp.com",
      projectId: "vellega-auth",
      storageBucket: "vellega-auth.firebasestorage.app",
      messagingSenderId: "422298524460",
      appId: "1:422298524460:web:c4bb023f1301bfe16bea89",
      measurementId: "G-LHMJRCS07C"
    };

    if (!firebase.apps.length) {
      firebase.initializeApp(firebaseConfig);
    }

    return {
      auth: firebase.auth(),
      db: typeof firebase.firestore === "function" ? firebase.firestore() : null
    };
  }

  function initAuthPage() {
    var body = document.body;
    if (!body.classList.contains("auth-page")) return;

    var shell = document.querySelector(".auth-shell-switcher");
    var brandTitle = document.querySelector("[data-auth-brand-title]");
    var brandCopy = document.querySelector("[data-auth-brand-copy]");
    var switchButtons = document.querySelectorAll("[data-auth-switch]");
    var loginStatus = document.getElementById("login-status");
    var signupStatus = document.getElementById("signup-status");
    var formStage = document.querySelector(".form-stage");
    var loginCard = document.querySelector(".login-card");
    var signupCard = document.querySelector(".signup-card");
    var initialMode = body.dataset.authInitial === "signup" ? "signup" : "login";
    var currentMode = initialMode;
    var authRefs = initFirebaseConfig();

    if (!shell || !brandTitle || !brandCopy) return;

    var brandContent = {
      login: {
        title: "Hello, Friend!",
        copy: "Enter your personal details and begin your private VELLEZA journey with us.",
        button: "Sign Up",
        href: "signup.html"
      },
      signup: {
        title: "Welcome Back!",
        copy: "To keep connected with us please sign in with your personal information.",
        button: "Sign In",
        href: "login.html"
      }
    };

    function setStatus(el, message, type) {
      if (!el) return;
      el.textContent = message;
      el.className = "status" + (type ? " " + type : "");
    }

    function syncMobileAuthHeight(mode) {
      if (!formStage) return;
      if (!document.body.classList.contains("mobile-view")) {
        formStage.style.removeProperty("--auth-mobile-height");
        formStage.style.height = "";
        return;
      }
      formStage.style.removeProperty("--auth-mobile-height");
      formStage.style.height = "";
    }

    function renderMode(mode, pushHistory) {
      currentMode = mode;
      body.classList.toggle("auth-mode-login", mode === "login");
      body.classList.toggle("auth-mode-signup", mode === "signup");

      document.querySelectorAll(".auth-mobile-switch-btn").forEach(function (button) {
        var isActive = button.getAttribute("data-target-mode") === mode;
        button.classList.toggle("is-active", isActive);
      });

      brandTitle.textContent = brandContent[mode].title;
      brandCopy.textContent = brandContent[mode].copy;

      switchButtons.forEach(function (button) {
        button.textContent = brandContent[mode].button;
        button.setAttribute("href", brandContent[mode].href);
        button.setAttribute("data-target-mode", mode === "login" ? "signup" : "login");
      });

      document.title = mode === "login" ? "Login - VELLEZA" : "Create Account - VELLEZA";
      syncMobileAuthHeight(mode);

      if (pushHistory) {
        var nextUrl = mode === "login" ? "login.html" : "signup.html";
        window.history.pushState({ authMode: mode }, "", nextUrl);
      }
    }

    renderMode(initialMode, false);
    window.addEventListener("resize", function () {
      syncMobileAuthHeight(currentMode);
    });

    switchButtons.forEach(function (button) {
      button.addEventListener("click", function (event) {
        if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
        event.preventDefault();
        renderMode(button.getAttribute("data-target-mode") || (currentMode === "login" ? "signup" : "login"), true);
      });
    });

    window.addEventListener("popstate", function () {
      var mode = window.location.pathname.toLowerCase().endsWith("signup.html") ? "signup" : "login";
      renderMode(mode, false);
    });

    var loginForm = document.getElementById("login-form");
    var loginSubmitBtn = document.getElementById("login-submit-btn");
    var forgotBtn = document.getElementById("forgot-password");

    if (loginForm && authRefs) {
      loginForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        var email = document.getElementById("login-email").value.trim();
        var password = document.getElementById("login-password").value;

        loginSubmitBtn.disabled = true;
        loginSubmitBtn.textContent = "Signing In...";
        setStatus(loginStatus, "Authenticating...", "");

        try {
          var credential = await authRefs.auth.signInWithEmailAndPassword(email, password);

          if (!credential.user.emailVerified) {
            await credential.user.sendEmailVerification();
            await authRefs.auth.signOut();
            throw new Error("Please verify your email first. A new verification email has been sent.");
          }

          localStorage.setItem("user", JSON.stringify({
            uid: credential.user.uid,
            email: credential.user.email,
            name: credential.user.displayName || ""
          }));

          setStatus(loginStatus, "Login successful. Redirecting...", "success");
          window.setTimeout(function () {
            window.location.href = "index.html";
          }, 700);
        } catch (error) {
          setStatus(loginStatus, error.message, "error");
        } finally {
          loginSubmitBtn.disabled = false;
          loginSubmitBtn.textContent = "Sign In";
        }
      });
    }

    if (forgotBtn && authRefs) {
      forgotBtn.addEventListener("click", async function (event) {
        event.preventDefault();
        var email = document.getElementById("login-email").value.trim();

        if (!email) {
          setStatus(loginStatus, "Enter your email first, then click forgot password.", "error");
          return;
        }

        try {
          await authRefs.auth.sendPasswordResetEmail(email);
          setStatus(loginStatus, "Password reset email sent.", "success");
        } catch (error) {
          setStatus(loginStatus, error.message, "error");
        }
      });
    }

    var signupForm = document.getElementById("signup-form");
    var signupSubmitBtn = document.getElementById("signup-submit-btn");

    if (signupForm && authRefs) {
      signupForm.addEventListener("submit", async function (event) {
        event.preventDefault();

        var name = document.getElementById("signup-name").value.trim();
        var phone = document.getElementById("signup-phone").value.trim();
        var email = document.getElementById("signup-email").value.trim();
        var password = document.getElementById("signup-password").value;

        if (password.length < 8) {
          setStatus(signupStatus, "Use at least 8 characters in your password.", "error");
          return;
        }

        signupSubmitBtn.disabled = true;
        signupSubmitBtn.textContent = "Creating...";
        setStatus(signupStatus, "Setting up your account...", "");

        try {
          var created = await authRefs.auth.createUserWithEmailAndPassword(email, password);
          var user = created.user;

          await user.updateProfile({ displayName: name });

          if (authRefs.db) {
            await authRefs.db.collection("users").doc(user.uid).set({
              name: name,
              phone: phone,
              email: email,
              createdAt: firebase.firestore.FieldValue.serverTimestamp()
            }, { merge: true });
          }

          try {
            await user.sendEmailVerification();
          } catch (verificationError) {
            console.warn("Email verification could not be sent:", verificationError);
          }

          setStatus(signupStatus, "Account created. Check your email for verification before logging in.", "success");
          window.setTimeout(function () {
            renderMode("login", true);
            setStatus(loginStatus, "Account ready. Please sign in after email verification.", "success");
          }, 650);
        } catch (error) {
          setStatus(signupStatus, error.message, "error");
        } finally {
          signupSubmitBtn.disabled = false;
          signupSubmitBtn.textContent = "Create Account";
        }
      });
    }
  }

  document.addEventListener("DOMContentLoaded", function () {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }

    applyMobileMode();
    initAuthPage();
    updateCartCount();
    initSearch();
    window.addEventListener("resize", function () {
      applyMobileMode();
    });
  });
})();
