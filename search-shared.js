(function () {
  const TOKEN_ALIASES = {
    man: 'men',
    mens: 'men',
    male: 'men',
    boy: 'men',
    boys: 'men',
    woman: 'women',
    womens: 'women',
    lady: 'women',
    ladies: 'women',
    female: 'women',
    bag: 'bags',
    handbag: 'bags',
    handbags: 'bags',
    purse: 'bags',
    purses: 'bags',
    tote: 'bags',
    totes: 'bags',
    satchel: 'bags',
    satchels: 'bags',
    clutch: 'bags',
    clutches: 'bags',
    hobo: 'bags',
    hobos: 'bags',
    weekender: 'bags',
    weekenders: 'bags',
    holdall: 'bags',
    holdalls: 'bags',
    shoe: 'shoes',
    sneaker: 'shoes',
    sneakers: 'shoes',
    heel: 'shoes',
    heels: 'shoes',
    sandal: 'shoes',
    sandals: 'shoes',
    mule: 'shoes',
    mules: 'shoes',
    pump: 'shoes',
    pumps: 'shoes',
    flat: 'shoes',
    flats: 'shoes',
    loafer: 'shoes',
    loafers: 'shoes'
  };

  const IGNORED_TOKENS = new Set([
    'the', 'our', 'all', 'for', 'with', 'and', 'new', 'in',
    'section', 'sections', 'collection', 'collections',
    'piece', 'pieces', 'product', 'products', 'item', 'items'
  ]);

  function injectSharedSearchStyles() {
    if (document.getElementById('velleza-search-shared-style')) return;

    const style = document.createElement('style');
    style.id = 'velleza-search-shared-style';
    style.textContent = `
      .search-dropdown,
      #search-dropdown {
        width: min(320px, calc(100vw - 24px)) !important;
        max-width: min(320px, calc(100vw - 24px)) !important;
        max-height: 380px !important;
        border-radius: 16px !important;
        background: #faf8f4 !important;
        color: #171717 !important;
        border: 1px solid rgba(184, 151, 90, 0.18) !important;
        box-shadow: 0 22px 50px rgba(0, 0, 0, 0.34) !important;
        overflow: hidden !important;
      }

      .search-input,
      #search-input {
        width: 100% !important;
        padding: 14px 16px !important;
        border: none !important;
        border-bottom: 1px solid #e8e2d8 !important;
        background: transparent !important;
        color: #161616 !important;
        outline: none !important;
        font-size: 11px !important;
        letter-spacing: 0.12em !important;
      }

      .search-input::placeholder,
      #search-input::placeholder {
        color: #8b857b !important;
      }

      .search-results,
      #search-results {
        max-height: 320px !important;
        overflow-y: auto !important;
      }

      .search-result-item,
      .search-item {
        display: grid !important;
        grid-template-columns: 40px minmax(0, 1fr) !important;
        align-items: center !important;
        gap: 10px !important;
        padding: 10px 14px !important;
        text-decoration: none !important;
        color: #171717 !important;
        border-bottom: 1px solid #f1ece3 !important;
        background: transparent !important;
        min-width: 0 !important;
      }

      .search-result-item:hover,
      .search-item:hover {
        background: #f4efe7 !important;
      }

      .search-result-item img,
      .search-item img {
        width: 40px !important;
        height: 40px !important;
        object-fit: cover !important;
        border-radius: 8px !important;
      }

      .search-result-item > div,
      .search-item > div {
        min-width: 0 !important;
      }

      .search-result-name,
      .search-item-name {
        font-family: 'Cormorant Garamond', serif !important;
        font-size: 15px !important;
        line-height: 1.08 !important;
        letter-spacing: 0.02em !important;
        color: #171717 !important;
        white-space: normal !important;
        overflow-wrap: anywhere !important;
      }

      .search-result-meta,
      .search-item-price {
        margin-top: 3px !important;
        font-size: 8px !important;
        line-height: 1.35 !important;
        letter-spacing: 0.12em !important;
        text-transform: uppercase !important;
        color: #8c8477 !important;
        white-space: normal !important;
      }

      body.mobile-view .search-dropdown,
      body.mobile-view #search-dropdown {
        position: fixed !important;
        top: calc(var(--mobile-nav-height, 58px) + 8px) !important;
        right: 10px !important;
        left: auto !important;
        width: min(320px, calc(100vw - 20px)) !important;
        max-width: min(320px, calc(100vw - 20px)) !important;
        max-height: min(50vh, 360px) !important;
        z-index: 900 !important;
      }

      body.mobile-view .search-results,
      body.mobile-view #search-results {
        max-height: min(42vh, 300px) !important;
      }

      body.mobile-view .search-result-item,
      body.mobile-view .search-item {
        grid-template-columns: 38px minmax(0, 1fr) !important;
        gap: 9px !important;
        padding: 9px 12px !important;
      }

      body.mobile-view .search-result-item img,
      body.mobile-view .search-item img {
        width: 38px !important;
        height: 38px !important;
      }

      body.mobile-view .search-result-name,
      body.mobile-view .search-item-name {
        font-size: 13px !important;
      }

      body.mobile-view .search-result-meta,
      body.mobile-view .search-item-price {
        font-size: 8px !important;
        letter-spacing: 0.09em !important;
      }
    `;

    document.head.appendChild(style);
  }

  function getProducts() {
    return Array.isArray(window.products) ? window.products : [];
  }

  function normalizeText(value) {
    return String(value || '')
      .toLowerCase()
      .replace(/&/g, ' and ')
      .replace(/['’]/g, '')
      .replace(/[^a-z0-9]+/g, ' ')
      .trim();
  }

  function toTokens(value) {
    return normalizeText(value)
      .split(/\s+/)
      .filter(Boolean)
      .map(token => TOKEN_ALIASES[token] || token)
      .filter(token => token && !IGNORED_TOKENS.has(token));
  }

  function unique(items) {
    return Array.from(new Set(items.filter(Boolean)));
  }

  function buildIndex(product) {
    const name = normalizeText(product.name);
    const category = normalizeText(product.category);
    const collection = normalizeText(product.collection);
    const type = normalizeText(product.type);
    const page = normalizeText(product.page);

    const tags = unique([
      ...toTokens(product.name),
      ...toTokens(product.category),
      ...toTokens(product.collection),
      ...toTokens(product.type),
      ...toTokens(product.page),
      collection,
      type,
      `${collection} ${type}`.trim(),
      `${type} ${collection}`.trim(),
      `${collection} bags`.trim(),
      `${collection} shoes`.trim()
    ]);

    return {
      name,
      category,
      collection,
      type,
      page,
      tags,
      joinedTags: normalizeText(tags.join(' '))
    };
  }

  function getResultHref(product) {
    return `product.html?preview=2&product=${encodeURIComponent(product.name)}`;
  }

  function getMatchStats(product, queryNorm, queryTokens) {
    const idx = buildIndex(product);
    const matchedTokenCount = queryTokens.filter(token =>
      idx.tags.includes(token) || idx.name.includes(token) || idx.category.includes(token)
    ).length;

    return {
      idx,
      matchedTokenCount,
      fullTextMatch:
        (idx.name.includes(queryNorm) && queryNorm.length > 2) ||
        (idx.category.includes(queryNorm) && queryNorm.length > 2) ||
        (`${idx.collection} ${idx.type}`.trim() === queryNorm) ||
        (idx.joinedTags.includes(queryNorm) && queryNorm.length > 2)
    };
  }

  function scoreProduct(product, queryNorm, queryTokens, options) {
    if (!queryNorm || !queryTokens.length) return 0;

    const { idx, matchedTokenCount } = getMatchStats(product, queryNorm, queryTokens);
    const collectionMatch = queryTokens.includes(idx.collection);
    const typeMatch = queryTokens.includes(idx.type);
    let score = 0;

    if (idx.name === queryNorm) score += 360;
    if (idx.category === queryNorm) score += 280;
    if (`${idx.collection} ${idx.type}`.trim() === queryNorm) score += 320;
    if (idx.collection === queryNorm) score += 220;
    if (idx.type === queryNorm) score += 200;
    if (idx.joinedTags.includes(queryNorm) && queryNorm.length > 2) score += 80;

    score += queryTokens.filter(token => idx.tags.includes(token)).length * 34;
    score += queryTokens.filter(token => idx.name.includes(token)).length * 28;
    score += queryTokens.filter(token => idx.category.includes(token)).length * 20;

    if (collectionMatch) score += 85;
    if (typeMatch) score += 80;
    if (collectionMatch && typeMatch) score += 120;
    if (matchedTokenCount === queryTokens.length) score += 110;

    if (idx.name.startsWith(queryNorm)) score += 42;
    if (idx.name.includes(queryNorm) && queryNorm.length > 2) score += 60;
    if (idx.category.includes(queryNorm) && queryNorm.length > 2) score += 54;

    if (options && options.preferCollection && idx.collection === normalizeText(options.preferCollection)) {
      score += 32;
    }

    return score;
  }

  function searchProducts(query, options) {
    const queryNorm = normalizeText(query);
    const queryTokens = toTokens(query);
    if (!queryNorm || !queryTokens.length) return [];
    if (queryNorm.length < 2 && !['men', 'women'].includes(queryNorm)) return [];

    return getProducts()
      .map(product => {
        const stats = getMatchStats(product, queryNorm, queryTokens);
        const passes = queryTokens.length === 1
          ? stats.matchedTokenCount >= 1 || stats.fullTextMatch
          : stats.matchedTokenCount === queryTokens.length || stats.fullTextMatch;

        return {
          product,
          score: passes ? scoreProduct(product, queryNorm, queryTokens, options || {}) : 0
        };
      })
      .filter(entry => entry.score > 0)
      .sort((a, b) => {
        if (b.score !== a.score) return b.score - a.score;
        return a.product.name.localeCompare(b.product.name);
      })
      .map(entry => entry.product);
  }

  function buildMeta(product) {
    const amount = Number(product.price || 0).toLocaleString();
    return `${product.category || 'Selection'} · ${product.currency || 'BDT '}${amount}`;
  }

  function renderResults(query, resultsEl, options) {
    if (!resultsEl) return [];

    const settings = Object.assign({
      limit: 12,
      itemClass: 'search-result-item',
      nameClass: 'search-result-name',
      metaClass: 'search-result-meta',
      noResultsText: 'No matching products found.',
      preferCollection: ''
    }, options || {});

    const trimmed = String(query || '').trim();
    if (!trimmed) {
      resultsEl.innerHTML = '';
      return [];
    }

    const matches = searchProducts(trimmed, { preferCollection: settings.preferCollection }).slice(0, settings.limit);

    if (!matches.length) {
      resultsEl.innerHTML = `<div style="padding:14px 16px;font-size:10px;letter-spacing:0.12em;text-transform:uppercase;color:#777">${settings.noResultsText}</div>`;
      return [];
    }

    resultsEl.innerHTML = matches.map(product => `
      <a class="${settings.itemClass}" href="${getResultHref(product)}">
        <img src="${product.image}" alt="${product.name}" onerror="this.src='preview.jpg'">
        <div>
          <div class="${settings.nameClass}">${product.name}</div>
          <div class="${settings.metaClass}">${buildMeta(product)}</div>
        </div>
      </a>
    `).join('');

    return matches;
  }

  function findBestMatch(query, options) {
    return searchProducts(query, options)[0] || null;
  }

  function closeDropdowns(dropdownSelector) {
    document.querySelectorAll(dropdownSelector || '.search-dropdown').forEach(dropdown => {
      dropdown.classList.remove('open');
    });
  }

  function initDropdownSearches(options) {
    injectSharedSearchStyles();

    const settings = Object.assign({
      containerSelector: '.search-container',
      toggleSelector: '.search-toggle',
      dropdownSelector: '.search-dropdown',
      inputSelector: '.search-input',
      resultsSelector: '.search-results'
    }, options || {});

    document.querySelectorAll(settings.containerSelector).forEach(container => {
      if (container.dataset.vellezaSearchBound === 'true') return;

      const toggle = container.querySelector(settings.toggleSelector);
      const dropdown = container.querySelector(settings.dropdownSelector);
      const input = container.querySelector(settings.inputSelector);
      const results = container.querySelector(settings.resultsSelector);

      if (!toggle || !dropdown || !input || !results) return;
      container.dataset.vellezaSearchBound = 'true';

      toggle.addEventListener('click', event => {
        event.stopPropagation();
        const willOpen = !dropdown.classList.contains('open');
        closeDropdowns(settings.dropdownSelector);
        dropdown.classList.toggle('open', willOpen);

        if (willOpen) {
          input.focus();
          if (input.value.trim()) {
            renderResults(input.value, results, settings);
          } else {
            results.innerHTML = '';
          }
        }
      });

      dropdown.addEventListener('click', event => event.stopPropagation());

      input.addEventListener('input', () => {
        renderResults(input.value, results, settings);
      });

      input.addEventListener('keydown', event => {
        if (event.key !== 'Enter') return;
        event.preventDefault();

        const bestMatch = findBestMatch(input.value, { preferCollection: settings.preferCollection });
        if (!bestMatch) {
          renderResults(input.value, results, settings);
          return;
        }

        window.location.href = getResultHref(bestMatch);
      });
    });

    if (!document.body.dataset.vellezaSearchDocumentBound) {
      document.addEventListener('click', event => {
        if (!event.target.closest(settings.containerSelector)) {
          closeDropdowns(settings.dropdownSelector);
        }
      });
      document.body.dataset.vellezaSearchDocumentBound = 'true';
    }
  }

  window.VellezaSearch = {
    normalizeText,
    searchProducts,
    renderResults,
    findBestMatch,
    initDropdownSearches,
    closeDropdowns,
    getResultHref
  };
})();
