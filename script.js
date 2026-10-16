(() => {
  "use strict";

  const prefersReducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  /* ============================================================
     Contenido administrable: published/content.js (panel /admin)
     con respaldo a los datos del repo (data.js, catalog-data.js).
     ============================================================ */
  const SC = window.SITE_CONTENT || {};
  const pickList = (value, fallback) => (Array.isArray(value) ? value : fallback);
  const PREMIUM = pickList(SC.plans && SC.plans.premium, PLANS_PREMIUM);
  const LITE = pickList(SC.plans && SC.plans.lite, PLANS_LITE);
  const SIMPLE = pickList(SC.plans && SC.plans.simple, PLANS_SIMPLE);
  const TEAM_LIST = pickList(SC.team, TEAM);
  const STORE_LIST = pickList(SC.stores, STORES);
  const DEVICE_LIST = pickList(SC.devices, DEVICE_CATALOG);
  const FAQ_LIST = pickList(SC.faqs, FAQS);
  const BUDGETS = pickList(SC.budgetRanges, BUDGET_RANGES);
  const COUPON_LIST = pickList(SC.coupons, COUPONS);
  const ZONE_LIST = pickList(SC.coverageZones, COVERAGE_ZONES);
  const WA_MAIN = (SC.settings && SC.settings.whatsapp) || WHATSAPP_PRINCIPAL;

  const escapeHtml = (value) => String(value ?? "").replace(/[&<>"']/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[char]);
  const fmtMoney = (n) => Number(n).toLocaleString("es-MX");
  const fmtNum = (n) => String(Number(n));

  /* Texto con **negritas**: se construye con nodos DOM (nunca innerHTML). */
  function setRichText(el, value) {
    const boldTag = (el.querySelector("b, strong") || { tagName: "STRONG" }).tagName.toLowerCase();
    el.textContent = "";
    String(value).split("**").forEach((part, index) => {
      if (!part) return;
      if (index % 2 === 1) {
        const bold = document.createElement(boldTag);
        bold.textContent = part;
        el.append(bold);
      } else {
        el.append(document.createTextNode(part));
      }
    });
  }

  function applyTexts(texts) {
    if (!texts) return;
    document.querySelectorAll("[data-cms]").forEach((el) => {
      const key = el.getAttribute("data-cms");
      if (!Object.prototype.hasOwnProperty.call(texts, key)) return;
      const value = texts[key];
      if (typeof value !== "string" || !value.trim()) return;
      const attr = el.getAttribute("data-cms-attr");
      if (attr) el.setAttribute(attr, value);
      else setRichText(el, value);
    });
  }
  applyTexts(SC.texts);

  /* GA4: G-BTCKL6ENXP llegó en el formato final. Meta Pixel sigue sin ID. */
  window.dataLayer = window.dataLayer || [];
  function trackEvent(name, params) {
    window.dataLayer.push({ event: name, ...(params || {}) });
    if (typeof window.gtag === "function") window.gtag("event", name, params || {});
  }

  /* ---------- Año en footer ---------- */
  const yearEl = document.getElementById("year");
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  /* ---------- Header scroll state ---------- */
  const header = document.getElementById("header");
  const onScrollHeader = () => {
    if (window.scrollY > 24) header.classList.add("is-scrolled");
    else header.classList.remove("is-scrolled");
  };
  onScrollHeader();
  window.addEventListener("scroll", onScrollHeader, { passive: true });

  /* ---------- Mobile nav toggle ---------- */
  const navToggle = document.getElementById("navToggle");
  const navLinks = document.getElementById("navLinks");
  if (navToggle && navLinks) {
    navToggle.addEventListener("click", () => {
      const isOpen = navLinks.classList.toggle("is-open");
      navToggle.setAttribute("aria-expanded", String(isOpen));
    });
    navLinks.querySelectorAll("a[data-nav]").forEach((link) => {
      link.addEventListener("click", () => {
        navLinks.classList.remove("is-open");
        navToggle.setAttribute("aria-expanded", "false");
      });
    });
  }

  /* ============================================================
     WhatsApp — construcción de link + tracking de modalidad/origen
     ============================================================ */
  let selectedProduct = "";
  function buildWaLink(text, phone) {
    const base = text || "Hola, quiero información.";
    const context = base.includes("Landing Barrio Cascatta") || base.includes("landing de AT&T Barrio Cascatta") ? "" : "\nOrigen: Landing Barrio Cascatta.";
    const choice = selectedProduct ? `\nInterés: ${selectedProduct}.` : "";
    const msg = encodeURIComponent(base + context + choice);
    return `https://wa.me/${phone || WA_MAIN}?text=${msg}`;
  }

  document.querySelectorAll("[data-wa-cta]").forEach((el) => {
    const modality = el.getAttribute("data-wa-modality") || "general";
    const text = el.getAttribute("data-wa-text");
    const phone = el.getAttribute("data-wa-phone");
    const link = buildWaLink(text, phone);
    if (el.tagName === "A") {
      el.setAttribute("href", link);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
    }
    el.addEventListener("click", (e) => {
      const currentLink = buildWaLink(text, phone);
      if (el.tagName === "A") el.setAttribute("href", currentLink);
      if (el.tagName !== "A") e.preventDefault();
      trackEvent("whatsapp_click", { source: "landing", modality });
      if (modality === "sucursal") trackEvent("cta_sucursal", { source: "landing" });
      if (modality === "domicilio") trackEvent("cta_domicilio", { source: "landing" });
      if (modality === "callcenter") trackEvent("cta_callcenter", { source: "landing" });
      if (el.tagName !== "A") window.open(currentLink, "_blank", "noopener");
    });
  });

  /* ---------- Scroll reveal ---------- */
  const revealEls = document.querySelectorAll(".reveal, .reveal-stagger");
  if ("IntersectionObserver" in window && !prefersReducedMotion) {
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            io.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12, rootMargin: "0px 0px -60px 0px" }
    );
    revealEls.forEach((el) => io.observe(el));
  } else {
    revealEls.forEach((el) => el.classList.add("is-visible"));
  }

  /* ---------- Parallax (hero orbs) ---------- */
  const parallaxEls = document.querySelectorAll("[data-parallax]");
  if (parallaxEls.length && !prefersReducedMotion) {
    let ticking = false;
    function updateParallax() {
      const y = window.scrollY;
      parallaxEls.forEach((el) => {
        const speed = parseFloat(el.getAttribute("data-parallax")) || 0;
        el.style.transform = `translate3d(0, ${y * speed}px, 0)`;
      });
      ticking = false;
    }
    window.addEventListener(
      "scroll",
      () => {
        if (!ticking) {
          requestAnimationFrame(updateParallax);
          ticking = true;
        }
      },
      { passive: true }
    );
    updateParallax();
  }

  /* ---------- FAQ accordion (delegado, se llena dinámicamente) ---------- */
  function wireFaqAccordion(container) {
    container.querySelectorAll(".faq-item").forEach((item) => {
      const q = item.querySelector(".faq-q");
      const a = item.querySelector(".faq-a");
      q.addEventListener("click", () => {
        const isOpen = item.classList.contains("is-open");
        container.querySelectorAll(".faq-item.is-open").forEach((openItem) => {
          if (openItem !== item) {
            openItem.classList.remove("is-open");
            openItem.querySelector(".faq-a").style.maxHeight = null;
          }
        });
        if (isOpen) {
          item.classList.remove("is-open");
          a.style.maxHeight = null;
        } else {
          item.classList.add("is-open");
          a.style.maxHeight = a.scrollHeight + "px";
        }
      });
    });
  }

  /* ---------- Plan tabs ---------- */
  const tabs = document.querySelectorAll(".plan-tab");
  const panels = document.querySelectorAll(".plan-panel");
  tabs.forEach((tab) => {
    tab.addEventListener("click", () => {
      const key = tab.getAttribute("data-cat");
      tabs.forEach((t) => {
        t.classList.toggle("is-active", t === tab);
        t.setAttribute("aria-selected", String(t === tab));
      });
      panels.forEach((p) => {
        const isActive = p.getAttribute("data-panel") === key;
        p.classList.toggle("is-active", isActive);
        if (isActive) {
          p.querySelectorAll(".reveal-stagger").forEach((el) => el.classList.add("is-visible"));
        }
      });
    });
  });
  document.querySelectorAll("[data-plan-choice]").forEach((choice) => {
    choice.addEventListener("click", () => {
      const plan = choice.dataset.planChoice;
      selectedProduct = plan === "lite" ? "Solo servicio" : plan === "premium" ? "Servicio + equipo" : "Plan anual";
      trackEvent("product_intent", { source: "landing", category: plan });
      document.querySelector(`.plan-tab[data-cat="${plan}"]`)?.click();
    });
  });

  const checkSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 6L9 17l-5-5"/></svg>';
  const pinSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>';
  const mapSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M5 12h14M13 6l6 6-6 6"/></svg>';
  const plusSvg =
    '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><line x1="12" y1="5" x2="12" y2="19"/><line x1="5" y1="12" x2="19" y2="12"/></svg>';

  /* ============================================================
     Render — Planes (Premium / Lite / Simple)
     ============================================================ */
  function renderPremium() {
    const grid = document.getElementById("gridPremium");
    grid.innerHTML = PREMIUM.map(
      (p) => `
      <div class="plan-card">
        <span class="gb-pill">${fmtNum(p.gb)} GB</span>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="price">$${fmtMoney(p.price)}<small>/mes${p.hasAsterisk ? "*" : ""}</small></div>
        ${p.note ? `<div class="note">${escapeHtml(p.note)}</div>` : ""}
        <span class="portability-tag">20% desc. portabilidad · 6 meses</span>
      </div>`
    ).join("");
  }

  function renderLite() {
    const grid = document.getElementById("gridLite");
    grid.innerHTML = LITE.map(
      (p) => `
      <div class="plan-card">
        <span class="gb-pill">${fmtNum(p.gb)} GB</span>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="price">$${fmtMoney(p.price)}<small>/mes</small></div>
        <div class="note">${fmtNum(p.socials)} redes sociales ilimitadas a elegir</div>
        <span class="portability-tag">${escapeHtml(p.portability)} desc. portabilidad · 6 meses</span>
      </div>`
    ).join("");
  }

  function renderSimple() {
    const grid = document.getElementById("gridSimple");
    grid.innerHTML = SIMPLE.map(
      (p) => `
      <div class="plan-card">
        <span class="gb-pill">${fmtNum(p.gbDouble)} GB</span>
        <div class="name">${escapeHtml(p.name)}</div>
        <div class="price">$${fmtMoney(p.price)}<small>/mes</small></div>
        <div class="note">Doble de GB: de ${fmtNum(p.gbBase)} a ${fmtNum(p.gbDouble)} GB</div>
        <div class="terms">
          ${p.terms
            .map(
              (t) =>
                `<span><b>${fmtNum(t.months)} meses</b> · pagas ${fmtNum(t.pay)}, ${fmtNum(t.free)} de regalo · total $${fmtMoney(t.total)}</span>`
            )
            .join("")}
        </div>
      </div>`
    ).join("");
  }

  renderPremium();
  renderLite();
  renderSimple();

  /* ============================================================
     Render — Equipo comercial
     ============================================================ */
  function initials(name) {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((w) => w[0])
      .join("")
      .toUpperCase();
  }

  const teamGrid = document.getElementById("teamGrid");
  teamGrid.innerHTML = TEAM_LIST.map((m) => {
    const isManager = !!m.principal;
    return `
      <div class="team-card ${isManager ? "is-manager" : ""}">
        <div class="avatar"><img src="${escapeHtml(m.image)}" alt="Foto de ${escapeHtml(m.name)}" loading="lazy"></div>
        <div class="role">${escapeHtml(m.role)}</div>
        <div class="name">${escapeHtml(m.name)}</div>
        <span class="no-contact">Atención asignada por el equipo</span>
      </div>`;
  }).join("");

  /* ============================================================
     Render — Ubicaciones
     ============================================================ */
  const locGrid = document.getElementById("locGrid");
  locGrid.innerHTML = STORE_LIST.map(
    (s) => `
    <div class="loc-card ${s.principal ? "is-principal" : ""}">
      <div class="loc-card-head">
        <span class="pin">${pinSvg}</span>
        ${s.principal ? '<span class="principal-badge">Sucursal principal</span>' : ""}
      </div>
      <h3>${escapeHtml(s.name)}</h3>
      <address>${escapeHtml(s.address)}</address>
      <div class="hours">${escapeHtml(s.hours)}</div>
      <a class="map-link" href="${escapeHtml(s.map)}" target="_blank" rel="noopener" data-store="${escapeHtml(s.name)}">${mapSvg} Cómo llegar</a>
      <a class="store-coupon-link" href="${escapeHtml(buildWaLink(`Hola, vengo de la Landing Barrio Cascatta. Quiero solicitar un cupón antes de acudir a ${s.name}. ¿Qué beneficio corresponde a mi contratación?`))}" target="_blank" rel="noopener" data-store="${escapeHtml(s.name)}">Solicitar cupón</a>
    </div>`
  ).join("");
  locGrid.querySelectorAll(".map-link").forEach((a) => {
    a.addEventListener("click", () => trackEvent("store_map_click", { store: a.getAttribute("data-store") }));
  });
  let selectedStore = "";
  locGrid.querySelectorAll(".store-coupon-link").forEach((a) => {
    a.addEventListener("click", () => {
      selectedStore = a.dataset.store;
      trackEvent("coupon_request", { store: selectedStore, source: "landing" });
      trackEvent("whatsapp_click", { store: selectedStore, modality: "cupon" });
    });
  });

  /* Cupones: solo los activos y vigentes hoy (hora de Ciudad de México). */
  const todayMx = new Intl.DateTimeFormat("en-CA", { timeZone: "America/Mexico_City" }).format(new Date());
  const liveCoupons = COUPON_LIST.filter((c) => c.active !== false && (!c.from || c.from <= todayMx) && (!c.to || c.to >= todayMx));
  const couponGrid = document.getElementById("couponGrid");
  const couponSection = document.getElementById("cupones");
  if (!liveCoupons.length) {
    if (couponSection) couponSection.style.display = "none";
  } else {
    couponGrid.innerHTML = liveCoupons.map((c) => `
      <article class="coupon-card"><img src="${escapeHtml(c.image)}" alt="${escapeHtml(`Cupón de $${c.amount} MXN: ${c.description}`)}" loading="lazy"><div><h3>${escapeHtml(c.title)}</h3><p>${escapeHtml(c.description)}</p><a class="btn btn-wa btn-sm coupon-request" href="#" data-coupon="${escapeHtml(c.id)}">Solicitar por WhatsApp</a></div></article>`).join("");
    couponGrid.querySelectorAll(".coupon-request").forEach((a) => {
      const coupon = liveCoupons.find((c) => c.id === a.dataset.coupon);
      const message = () => `Hola, vengo de la Landing Barrio Cascatta. Solicito el cupón de $${coupon.amount} MXN para ${coupon.product}. Punto de venta: ${selectedStore || "por elegir"}.`;
      a.href = buildWaLink(message());
      a.target = "_blank";
      a.rel = "noopener";
      a.addEventListener("click", () => {
        a.href = buildWaLink(message());
        trackEvent("coupon_request", { coupon: coupon.id, store: selectedStore || "sin_elegir", source: "landing" });
        trackEvent("whatsapp_click", { modality: "cupon", coupon: coupon.id });
      });
    });
  }

  /* Zonas de atención a domicilio */
  const coverageList = document.getElementById("coverageList");
  if (coverageList) coverageList.innerHTML = ZONE_LIST.map((z) => `<span>${escapeHtml(z)}</span>`).join("");

  /* Catálogo: reproducir todas las mensualidades proporcionadas en el XLSX. */
  const catalogGrid = document.getElementById("catalogGrid");
  const catalogBrand = document.getElementById("catalogBrand");
  const pricedCatalog = DEVICE_LIST.filter((item) => !item.hidden && !item.quoteOnly && Number.isFinite(item.monthly));
  [...new Set(pricedCatalog.map((item) => item.brand))].sort().forEach((brand) => {
    const option = document.createElement("option");
    option.value = brand;
    option.textContent = brand;
    catalogBrand.append(option);
  });
  function renderCatalog() {
    const brand = catalogBrand.value;
    const visible = pricedCatalog.filter((item) => !brand || item.brand === brand);
    catalogGrid.innerHTML = visible.length ? visible.map((item) => {
      const waText = `Hola, vengo de la Landing Barrio Cascatta. Quiero cotizar ${item.model} con Plan ${item.plan}. En la landing aparece la mensualidad de $${Number(item.monthly).toLocaleString("es-MX", { minimumFractionDigits: 2 })}. ¿Me confirman el precio final y la disponibilidad?`;
      return `<article class="device-card">
        <div class="device-media"><img src="${escapeHtml(item.image)}" alt="${escapeHtml(item.model)}" loading="lazy"></div>
        <div class="device-detail"><span class="device-brand">${escapeHtml(item.brand)}</span><h3>${escapeHtml(item.model)}</h3><p>Plan ${escapeHtml(item.plan)} · ${escapeHtml(item.term || "plazo por confirmar")}</p>
        <strong class="device-price">$${Number(item.monthly).toLocaleString("es-MX", { minimumFractionDigits: 2 })}<small>/mes</small></strong>
        <a class="device-quote" href="${buildWaLink(waText)}" target="_blank" rel="noopener" data-device="${escapeHtml(item.model)}">Cotizar con un asesor →</a></div>
      </article>`;
    }).join("") : '<p class="catalog-empty">No hay equipos con precio en la hoja para esta marca.</p>';
    catalogGrid.querySelectorAll(".device-quote").forEach((a) => a.addEventListener("click", () => {
      trackEvent("device_quote_click", { device: a.dataset.device, source: "landing" });
      trackEvent("whatsapp_click", { modality: "equipo", device: a.dataset.device });
    }));
  }
  catalogBrand.addEventListener("change", renderCatalog);
  renderCatalog();

  /* ============================================================
     Render — FAQ
     ============================================================ */
  const faqList = document.getElementById("faqList");
  faqList.innerHTML = FAQ_LIST.map(
    (f) => `
    <div class="faq-item">
      <button class="faq-q">${escapeHtml(f.q)}<span class="icon">${plusSvg}</span></button>
      <div class="faq-a"><div class="faq-a-inner">${escapeHtml(f.a)}</div></div>
    </div>`
  ).join("");
  wireFaqAccordion(faqList);

  /* ============================================================
     Re-wire de data-wa-cta para elementos renderizados por JS
     (equipo comercial). Los estáticos ya se wirearon arriba.
     ============================================================ */
  function wireWaCtas(container) {
    container.querySelectorAll("[data-wa-cta]").forEach((el) => {
      if (el.dataset.waWired) return;
      el.dataset.waWired = "1";
      const modality = el.getAttribute("data-wa-modality") || "general";
      const text = el.getAttribute("data-wa-text");
      const phone = el.getAttribute("data-wa-phone");
      const link = buildWaLink(text, phone);
      el.setAttribute("href", link);
      el.setAttribute("target", "_blank");
      el.setAttribute("rel", "noopener");
      el.addEventListener("click", () => {
        trackEvent("whatsapp_click", { source: "landing", modality });
      });
    });
  }

  /* ============================================================
     Cotizador por presupuesto
     ============================================================ */
  const quoterState = { budget: null, budgetLabel: "", need: "", modalidad: "", marca: "" };
  const quoterBox = document.getElementById("quoterBox");
  const quoterSteps = quoterBox.querySelectorAll(".quoter-step");
  const quoterDots = quoterBox.querySelectorAll(".step-dot");
  const quoterBack = document.getElementById("quoterBack");
  const quoterSend = document.getElementById("quoterSend");
  let currentStep = 1;
  let quoterStarted = false;

  function goToStep(n) {
    currentStep = n;
    quoterSteps.forEach((s) => s.classList.toggle("is-active", parseInt(s.getAttribute("data-step"), 10) === n));
    quoterDots.forEach((d) => d.classList.toggle("is-done", parseInt(d.getAttribute("data-dot"), 10) <= n));
    quoterBack.style.visibility = n === 1 ? "hidden" : "visible";
    quoterSend.style.display = n === 4 ? "inline-flex" : "none";
    if (n === 4) renderQuoterResults();
  }

  quoterBack.addEventListener("click", () => goToStep(Math.max(1, currentStep - 1)));

  const budgetOptionsEl = document.getElementById("quoterBudgetOptions");
  budgetOptionsEl.innerHTML = BUDGETS.map(
    (r) => `<button class="quoter-option" data-field="budget" data-id="${escapeHtml(r.id)}"><strong>${escapeHtml(r.label)}</strong><span>${escapeHtml(r.tag)}</span></button>`
  ).join("");

  quoterBox.addEventListener("click", (e) => {
    const opt = e.target.closest(".quoter-option");
    if (!opt) return;
    const field = opt.getAttribute("data-field");
    const group = opt.closest(".quoter-options");
    group.querySelectorAll(".quoter-option").forEach((o) => o.classList.remove("is-selected"));
    opt.classList.add("is-selected");

    if (field === "budget") {
      const range = BUDGETS.find((r) => r.id === opt.getAttribute("data-id"));
      quoterState.budget = range;
      if (!quoterStarted) {
        trackEvent("cotizador_start", { source: "landing" });
        quoterStarted = true;
      }
      trackEvent("cotizador_budget", { budget_range: range.id });
      goToStep(2);
    } else if (field === "need") {
      quoterState.need = opt.getAttribute("data-value");
      goToStep(3);
    } else if (field === "modalidad") {
      quoterState.modalidad = opt.getAttribute("data-value");
      goToStep(4);
    }
  });

  const marcaSelect = document.getElementById("q-marca");
  marcaSelect.addEventListener("change", () => {
    quoterState.marca = marcaSelect.value;
  });

  const ALL_PLANS = [
    ...PREMIUM.map((p) => ({ ...p, cat: "Premium" })),
    ...LITE.map((p) => ({ ...p, cat: "Lite" })),
    ...SIMPLE.map((p) => ({ ...p, cat: "Simple", gb: p.gbDouble })),
  ];

  function pickSpread(arr, n) {
    if (arr.length <= n) return arr;
    const out = [];
    for (let i = 0; i < n; i++) {
      out.push(arr[Math.round((i * (arr.length - 1)) / (n - 1))]);
    }
    return out;
  }

  function renderQuoterResults() {
    const resultsEl = document.getElementById("quoterResults");
    if (!quoterState.budget) {
      resultsEl.innerHTML = "";
      return;
    }
    const { min, max } = quoterState.budget;
    let matches = ALL_PLANS.filter((p) => p.price >= min && p.price <= max).sort((a, b) => a.price - b.price);
    matches = pickSpread(matches, 3);

    if (!matches.length) {
      resultsEl.innerHTML = `<p style="grid-column:1/-1;color:var(--text-2);font-size:14px;">No encontramos una coincidencia exacta en ese rango — escríbenos y te asesoramos personalmente.</p>`;
    } else {
      resultsEl.innerHTML = matches
        .map(
          (p) => `
        <div class="quoter-result-card">
          <span class="cat">${escapeHtml(p.cat)}</span>
          <strong>${escapeHtml(p.name)}</strong>
          <span class="gb">$${fmtMoney(p.price)}/mes · ${fmtNum(p.gb)} GB</span>
        </div>`
        )
        .join("");
    }

    trackEvent("cotizador_result", {
      budget_range: quoterState.budget.id,
      product: matches.map((m) => m.name).join(", "),
    });
  }

  quoterSend.addEventListener("click", () => {
    const nombre = document.getElementById("q-nombre").value.trim() || "un cliente";
    const telefono = document.getElementById("q-telefono").value.trim();
    const budgetLabel = quoterState.budget ? quoterState.budget.label : "sin especificar";
    const mensaje =
      `Hola, hice una cotización en la landing de AT&T Barrio Cascatta.\n` +
      `Nombre: ${nombre}\n` +
      `Mi presupuesto mensual es de ${budgetLabel}.\n` +
      `Busco: ${quoterState.need || "sin especificar"}.\n` +
      `Modalidad preferida: ${quoterState.modalidad || "sin especificar"}.\n` +
      (quoterState.marca ? `Marca de preferencia: ${quoterState.marca}.\n` : "") +
      (telefono ? `Mi WhatsApp: ${telefono}.\n` : "");

    trackEvent("whatsapp_click", {
      source: "cotizador",
      modality: quoterState.modalidad,
      product: quoterState.need,
      budget: quoterState.budget ? quoterState.budget.id : null,
    });

    const toast = document.getElementById("toast");
    if (toast) {
      toast.classList.add("is-visible");
      setTimeout(() => toast.classList.remove("is-visible"), 3200);
    }
    window.open(buildWaLink(mensaje), "_blank", "noopener");
  });
})();
