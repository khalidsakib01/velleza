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

  function closeSearchDropdowns() {
    document.querySelectorAll(".search-dropdown.open").forEach(function (dropdown) {
      dropdown.classList.remove("open");
    });
  }

  function filterProducts(query, resultsEl) {
    if (!resultsEl) return;

    if (typeof products === "undefined" || !Array.isArray(products)) {
      resultsEl.innerHTML = '<p style="padding:14px 16px;font-size:11px;color:#777;letter-spacing:0.1em">Search is not available right now.</p>';
      return;
    }

    var list = query.trim() === ""
      ? products
      : products.filter(function (p) {
          return p.name.toLowerCase().includes(query.toLowerCase()) || p.category.toLowerCase().includes(query.toLowerCase());
        });

    if (list.length === 0) {
      resultsEl.innerHTML = '<p style="padding:14px 16px;font-size:11px;color:#777;letter-spacing:0.1em">No results found.</p>';
      return;
    }

    resultsEl.innerHTML = list.map(function (p) {
      return '<a href="product.html?product=' + encodeURIComponent(p.name) + '" class="search-result-item">'
        + '<img src="' + p.image + '" alt="' + p.name + '" onerror="this.src=\'gucci1.png\'">'
        + '<div><p class="search-result-name">' + p.name + '</p>'
        + '<p class="search-result-meta">' + p.currency + p.price + ' - ' + p.category + '</p></div></a>';
    }).join("");
  }

  function initSearch() {
    document.querySelectorAll(".search-container").forEach(function (container) {
      var toggle = container.querySelector(".search-toggle");
      var dropdown = container.querySelector(".search-dropdown");
      var input = container.querySelector(".search-input");
      var results = container.querySelector(".search-results");

      if (!toggle || !dropdown || !input || !results) return;

      toggle.addEventListener("click", function (event) {
        event.stopPropagation();
        var willOpen = !dropdown.classList.contains("open");
        closeSearchDropdowns();
        dropdown.classList.toggle("open", willOpen);

        if (willOpen) {
          input.focus();
          filterProducts("", results);
        }
      });

      dropdown.addEventListener("click", function (event) {
        event.stopPropagation();
      });

      input.addEventListener("input", function () {
        filterProducts(input.value, results);
      });

      input.addEventListener("keydown", function (event) {
        if (event.key !== "Enter") return;
        event.preventDefault();

        var query = input.value.trim().toLowerCase();
        if (!query) return;

        var match = products.find(function (p) {
          return p.name.toLowerCase() === query;
        }) || products.find(function (p) {
          return p.name.toLowerCase().includes(query) || p.category.toLowerCase().includes(query);
        });

        if (match) {
          window.location.href = "product.html?product=" + encodeURIComponent(match.name);
        } else {
          results.innerHTML = '<p style="padding:14px 16px;font-size:11px;color:#777;letter-spacing:0.1em">No product found.</p>';
        }
      });
    });

    document.addEventListener("click", closeSearchDropdowns);
  }

  function openPanel(id) {
    var panel = document.getElementById(id);
    var overlay = document.getElementById("overlay");

    if (panel) panel.classList.add("open");
    if (overlay) overlay.classList.add("active");
  }

  function closePanel(id) {
    var panel = document.getElementById(id);
    if (panel) panel.classList.remove("open");

    if (!document.querySelector(".panel.open")) {
      var overlay = document.getElementById("overlay");
      if (overlay) overlay.classList.remove("active");
    }
  }

  function closePanels() {
    document.querySelectorAll(".panel.open").forEach(function (panel) {
      panel.classList.remove("open");
    });

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

  document.addEventListener("DOMContentLoaded", function () {
    if (window.lucide && typeof window.lucide.createIcons === "function") {
      window.lucide.createIcons();
    }

    applyMobileMode();
    updateCartCount();
    initSearch();
    window.addEventListener("resize", applyMobileMode);
  });
})();
