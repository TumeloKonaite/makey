const API_BASE_URL = window.BEAUTYVERSE_API_URL || "http://localhost:8000";

const state = {
  categories: null,
  listings: null,
};

const routes = [
  { pattern: /^\/$/, render: renderHome },
  { pattern: /^\/categories\/?$/, render: renderCategoriesPage },
  { pattern: /^\/listings\/?$/, render: renderListingsPage },
  { pattern: /^\/listings\/([^/]+)\/?$/, render: renderListingDetailPage },
];

const app = document.querySelector("#app");

window.addEventListener("popstate", renderRoute);
document.addEventListener("click", (event) => {
  const link = event.target.closest("a[data-link]");
  if (!link) return;

  const url = new URL(link.href);
  if (url.origin !== window.location.origin) return;

  event.preventDefault();
  history.pushState({}, "", `${url.pathname}${url.search}`);
  renderRoute();
});

document.addEventListener("submit", (event) => {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.matches("[data-home-search]")) {
    event.preventDefault();
    const search = new FormData(form).get("search")?.toString().trim() || "";
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    navigate(`/listings${params.size ? `?${params}` : ""}`);
  }

  if (form.matches("[data-listing-filters]")) {
    event.preventDefault();
    applyListingFilters(form);
  }
});

document.addEventListener("change", (event) => {
  const field = event.target;
  const form = field instanceof HTMLElement ? field.closest("[data-listing-filters]") : null;
  if (form && field.matches("select")) applyListingFilters(form);
});

renderRoute();

function navigate(path) {
  history.pushState({}, "", path);
  renderRoute();
}

async function renderRoute() {
  updateActiveNav();
  const path = window.location.pathname;
  const match = routes.find((route) => route.pattern.test(path));

  if (!match) {
    app.innerHTML = errorState("Page not found.");
    app.focus();
    return;
  }

  app.innerHTML = loadingState();
  app.focus();

  try {
    const [, id] = path.match(match.pattern) || [];
    await match.render(id);
  } catch (error) {
    app.innerHTML = errorState(
      error.message || "Something went wrong while loading the marketplace.",
    );
  }
}

async function renderHome() {
  const [categories, listings] = await Promise.all([getCategories(), getListings()]);
  const latestListings = listings.slice(0, 6);
  const featuredCategories = categories.slice(0, 6);

  app.innerHTML = `
    <section class="hero">
      <div class="hero-content">
        <p class="eyebrow">Beauty services and products near you</p>
        <h1>Beautyverse Marketplace</h1>
        <p>Browse published beauty listings, discover specialists, and find your next appointment without signing in.</p>
        <form class="search-panel" data-home-search>
          <input name="search" type="search" placeholder="Search hair, nails, makeup, skincare..." aria-label="Search listings" />
          <button type="submit">Search</button>
        </form>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h2>Featured Categories</h2>
          <p>Start with a service area, then narrow the listings by what you need.</p>
        </div>
        <a class="button" href="/categories" data-link>View all</a>
      </div>
      ${renderCategoryGrid(featuredCategories)}
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h2>Latest Listings</h2>
          <p>Freshly published marketplace listings from beauty providers.</p>
        </div>
        <a class="button" href="/listings" data-link>Browse listings</a>
      </div>
      ${latestListings.length ? renderListingGrid(latestListings, categories) : emptyState("No published listings yet.", "Check back soon for new beauty listings.")}
    </section>
  `;
}

async function renderCategoriesPage() {
  const categories = await getCategories();

  app.innerHTML = `
    <section class="page-title">
      <h1>Categories</h1>
      <p>Explore active beauty categories and jump straight into matching published listings.</p>
    </section>
    <section class="content-wrap">
      ${categories.length ? renderCategoryGrid(categories) : emptyState("No categories yet.", "Active categories will appear here once they are available.")}
    </section>
  `;
}

async function renderListingsPage() {
  const [categories, listings] = await Promise.all([getCategories(), getListings()]);
  const params = new URLSearchParams(window.location.search);
  const search = params.get("search") || "";
  const category = params.get("category") || "";
  const visibleListings = filterListings(listings, categories, { search, category });

  app.innerHTML = `
    <section class="page-title">
      <h1>Listings</h1>
      <p>Search public listings, filter by category, and open any published listing for more detail.</p>
    </section>
    <form class="toolbar" data-listing-filters>
      <div class="field">
        <label for="listing-search">Search</label>
        <input id="listing-search" name="search" type="search" value="${escapeAttr(search)}" placeholder="Search by title, description, location..." />
      </div>
      <div class="field">
        <label for="listing-category">Category</label>
        <select id="listing-category" name="category">
          <option value="">All categories</option>
          ${categories
            .map(
              (item) =>
                `<option value="${escapeAttr(item.id)}" ${item.id === category ? "selected" : ""}>${escapeHtml(item.name)}</option>`,
            )
            .join("")}
        </select>
      </div>
      <button type="submit">Apply</button>
    </form>
    <section class="content-wrap">
      ${
        visibleListings.length
          ? renderListingGrid(visibleListings, categories)
          : emptyState(
              "No listings match your filters.",
              "Try a broader search or choose a different category.",
            )
      }
    </section>
  `;
}

async function renderListingDetailPage(id) {
  const [categories, listing] = await Promise.all([getCategories(), getListing(id)]);
  const category = findCategory(categories, listing.category_id);
  const image = getCoverImage(listing);

  app.innerHTML = `
    <section class="page-title">
      <a href="/listings" data-link>Back to listings</a>
    </section>
    <section class="content-wrap">
      <div class="detail-layout">
        <div class="detail-image">
          ${image ? `<img src="${escapeAttr(image.url)}" alt="${escapeAttr(listing.title)}" />` : `<span>No image yet</span>`}
        </div>
        <article class="detail-copy">
          <div class="badge-row">
            <span class="badge">${escapeHtml(category?.name || "Beauty")}</span>
            ${listing.location ? `<span class="badge">${escapeHtml(listing.location)}</span>` : ""}
          </div>
          <h1>${escapeHtml(listing.title)}</h1>
          <div class="price">${formatPrice(listing.price, listing.currency)}</div>
          <p class="listing-description">${escapeHtml(listing.description || "No description has been added for this listing yet.")}</p>
          <div class="provider-panel">
            <h2>Provider</h2>
            <p>${escapeHtml(listing.provider_name || "Provider details will be shared when you enquire.")}</p>
            <button type="button">Enquire</button>
          </div>
        </article>
      </div>
    </section>
  `;
}

async function getCategories() {
  if (state.categories) return state.categories;
  state.categories = await fetchJson("/categories");
  return state.categories;
}

async function getListings() {
  if (state.listings) return state.listings;
  const listings = await fetchJson("/listings");
  state.listings = listings.filter((listing) => listing.status === "published");
  return state.listings;
}

async function getListing(id) {
  const listing = await fetchJson(`/listings/${encodeURIComponent(id)}`);
  if (listing.status !== "published") {
    throw new Error("Listing was not found.");
  }
  return listing;
}

async function fetchJson(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: { Accept: "application/json" },
  });

  if (!response.ok) {
    if (response.status === 404) throw new Error("Listing was not found.");
    throw new Error("Could not load marketplace data.");
  }

  return response.json();
}

function applyListingFilters(form) {
  const data = new FormData(form);
  const params = new URLSearchParams();
  const search = data.get("search")?.toString().trim() || "";
  const category = data.get("category")?.toString() || "";

  if (search) params.set("search", search);
  if (category) params.set("category", category);

  const nextUrl = `/listings${params.size ? `?${params}` : ""}`;
  history.replaceState({}, "", nextUrl);
  renderListingsPage();
}

function filterListings(listings, categories, filters) {
  const search = filters.search.trim().toLowerCase();

  return listings.filter((listing) => {
    const category = findCategory(categories, listing.category_id);
    const matchesCategory = !filters.category || listing.category_id === filters.category;
    const haystack = [
      listing.title,
      listing.description,
      listing.location,
      category?.name,
      listing.provider_name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return matchesCategory && (!search || haystack.includes(search));
  });
}

function renderCategoryGrid(categories) {
  return `
    <div class="grid category-grid">
      ${categories
        .map(
          (category) => `
            <a class="category-card" href="/listings?category=${encodeURIComponent(category.id)}" data-link>
              <h3>${escapeHtml(category.name)}</h3>
              <p>${escapeHtml(category.description || "Browse published listings in this category.")}</p>
            </a>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderListingGrid(listings, categories) {
  return `
    <div class="grid listing-grid">
      ${listings.map((listing) => renderListingCard(listing, categories)).join("")}
    </div>
  `;
}

function renderListingCard(listing, categories) {
  const category = findCategory(categories, listing.category_id);
  const image = getCoverImage(listing);

  return `
    <a class="listing-card" href="/listings/${encodeURIComponent(listing.id)}" data-link>
      <div class="listing-image">
        ${image ? `<img src="${escapeAttr(image.url)}" alt="${escapeAttr(listing.title)}" loading="lazy" />` : `<span>No image yet</span>`}
      </div>
      <div class="listing-body">
        <div class="badge-row">
          <span class="badge">${escapeHtml(category?.name || "Beauty")}</span>
        </div>
        <h3>${escapeHtml(listing.title)}</h3>
        <div class="price">${formatPrice(listing.price, listing.currency)}</div>
        <div class="listing-meta">
          ${escapeHtml(listing.location || "Location TBA")}
          ${listing.provider_name ? ` · ${escapeHtml(listing.provider_name)}` : ""}
        </div>
      </div>
    </a>
  `;
}

function getCoverImage(listing) {
  if (!Array.isArray(listing.images) || listing.images.length === 0) return null;
  return listing.images.find((image) => image.is_cover) || listing.images[0];
}

function findCategory(categories, id) {
  return categories.find((category) => category.id === id);
}

function formatPrice(value, currency = "ZAR") {
  const amount = Number(value);
  if (!Number.isFinite(amount)) return `${currency} ${value}`;

  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
  }).format(amount);
}

function loadingState() {
  return `<section class="state"><div class="loading-state">Loading marketplace...</div></section>`;
}

function emptyState(title, copy) {
  return `
    <div class="empty-state">
      <h2>${escapeHtml(title)}</h2>
      <p>${escapeHtml(copy)}</p>
    </div>
  `;
}

function errorState(message) {
  return `<section class="state"><div class="error-state">${escapeHtml(message)}</div></section>`;
}

function updateActiveNav() {
  const path = window.location.pathname;
  document.querySelectorAll(".nav-links a").forEach((link) => {
    const href = link.getAttribute("href");
    const isActive = href === "/" ? path === "/" : path.startsWith(href);
    link.toggleAttribute("aria-current", isActive);
  });
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function escapeAttr(value) {
  return escapeHtml(value);
}
