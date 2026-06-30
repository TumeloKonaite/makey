const API_BASE_URL =
  window.MARKETPLACE_ROOMS_API_URL ||
  window.ROOMS_MARKETPLACE_API_URL ||
  window.MARKETPLACE_API_URL ||
  window.BEAUTYVERSE_API_URL ||
  "http://localhost:8000";

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

  if (form.matches("[data-enquiry-form]")) {
    event.preventDefault();
    submitEnquiryForm(form);
  }
});

document.addEventListener("change", (event) => {
  const field = event.target;
  const form = field instanceof HTMLElement ? field.closest("[data-listing-filters]") : null;
  if (form && field.matches("select")) applyListingFilters(form);

  if (field instanceof HTMLInputElement && field.matches("[data-viewing-toggle]")) {
    const enquiryForm = field.closest("[data-enquiry-form]");
    if (enquiryForm) syncViewingFields(enquiryForm);
  }
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
        <p class="eyebrow">Rooms and rentals near you</p>
        <h1>Marketplace Rooms</h1>
        <p>Browse published room listings, compare room types, and contact owners or agents without signing in.</p>
        <form class="search-panel" data-home-search>
          <input name="search" type="search" placeholder="Search single rooms, studios, shared rooms..." aria-label="Search listings" />
          <button type="submit">Search</button>
        </form>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h2>Featured Room Types</h2>
          <p>Start with a room type, then narrow the listings by location and budget.</p>
        </div>
        <a class="button" href="/categories" data-link>View all</a>
      </div>
      ${renderCategoryGrid(featuredCategories)}
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h2>Latest Listings</h2>
          <p>Freshly published room listings from landlords and agents.</p>
        </div>
        <a class="button" href="/listings" data-link>Browse listings</a>
      </div>
      ${latestListings.length ? renderListingGrid(latestListings, categories) : emptyState("No published listings yet.", "Check back soon for new room listings.")}
    </section>
  `;
}

async function renderCategoriesPage() {
  const categories = await getCategories();

  app.innerHTML = `
    <section class="page-title">
      <h1>Room Types</h1>
      <p>Explore available room types and jump straight into matching published listings.</p>
    </section>
    <section class="content-wrap">
      ${categories.length ? renderCategoryGrid(categories) : emptyState("No room types yet.", "Available room types will appear here once they are available.")}
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
      <p>Search public room listings, filter by room type, and open any published listing for more detail.</p>
    </section>
    <form class="toolbar" data-listing-filters>
      <div class="field">
        <label for="listing-search">Search</label>
        <input id="listing-search" name="search" type="search" value="${escapeAttr(search)}" placeholder="Search by title, description, location..." />
      </div>
      <div class="field">
        <label for="listing-category">Room type</label>
        <select id="listing-category" name="category">
          <option value="">All room types</option>
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
              "Try a broader search or choose a different room type.",
            )
      }
    </section>
  `;
}

async function renderListingDetailPage(id) {
  const [categories, listing] = await Promise.all([getCategories(), getListing(id)]);
  const category = findCategory(categories, listing.category_id);
  const image = getCoverImage(listing);
  const ownerName = getListingOwnerName(listing);

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
            <span class="badge">${escapeHtml(category?.name || "Room")}</span>
            ${listing.location ? `<span class="badge">${escapeHtml(listing.location)}</span>` : ""}
          </div>
          <h1>${escapeHtml(listing.title)}</h1>
          <div class="price">${formatPrice(listing.price, listing.currency)}</div>
          <p class="listing-description">${escapeHtml(listing.description || "No description has been added for this listing yet.")}</p>
          <div class="owner-panel">
            <h2>Ask about this room</h2>
            <p>${escapeHtml(ownerName || "The agent or landlord can follow up after you send your enquiry.")}</p>
            <form class="enquiry-form" data-enquiry-form data-listing-id="${escapeAttr(listing.id)}">
              <div class="form-grid">
                <div class="field">
                  <label for="enquiry-name">Your name</label>
                  <input id="enquiry-name" name="name" type="text" required maxlength="160" autocomplete="name" />
                </div>
                <div class="field">
                  <label for="enquiry-email">Email</label>
                  <input id="enquiry-email" name="email" type="email" maxlength="255" autocomplete="email" />
                </div>
                <div class="field">
                  <label for="enquiry-phone">Phone</label>
                  <input id="enquiry-phone" name="phone" type="tel" maxlength="50" autocomplete="tel" />
                </div>
                <div class="field">
                  <label for="enquiry-move-in-date">Desired move-in date</label>
                  <input id="enquiry-move-in-date" name="desired_move_in_date" type="date" />
                </div>
                <div class="field">
                  <label for="enquiry-occupants">Number of occupants</label>
                  <input id="enquiry-occupants" name="occupant_count" type="number" min="1" inputmode="numeric" />
                </div>
                <div class="field field-span-full">
                  <label for="enquiry-message">Message the agent</label>
                  <textarea id="enquiry-message" name="message" rows="5" required placeholder="Hi, is this room still available?"></textarea>
                </div>
              </div>
              <label class="checkbox-field" for="enquiry-viewing-requested">
                <input id="enquiry-viewing-requested" name="is_viewing_requested" type="checkbox" data-viewing-toggle />
                <span>Request a viewing</span>
              </label>
              <div class="form-grid viewing-fields" data-viewing-fields hidden>
                <div class="field">
                  <label for="enquiry-viewing-date">Preferred viewing date</label>
                  <input id="enquiry-viewing-date" name="preferred_viewing_date" type="date" />
                </div>
                <div class="field">
                  <label for="enquiry-viewing-time">Preferred viewing time</label>
                  <input id="enquiry-viewing-time" name="preferred_viewing_time" type="time" />
                </div>
                <div class="field field-span-full">
                  <label for="enquiry-viewing-notes">Viewing notes</label>
                  <textarea id="enquiry-viewing-notes" name="viewing_notes" rows="3" placeholder="Share your preferred time window or anything the agent should know."></textarea>
                </div>
              </div>
              <div class="form-actions">
                <p class="form-hint">For this MVP, include either an email address or a phone number.</p>
                <button type="submit">Enquire about this room</button>
              </div>
              <div class="form-feedback" data-form-feedback aria-live="polite"></div>
            </form>
          </div>
        </article>
      </div>
    </section>
  `;

  const enquiryForm = app.querySelector("[data-enquiry-form]");
  if (enquiryForm) syncViewingFields(enquiryForm);
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

async function postJson(path, payload) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: "POST",
    headers: {
      Accept: "application/json",
      "Content-Type": "application/json",
    },
    body: JSON.stringify(payload),
  });

  if (!response.ok) {
    let detail = "Could not send your enquiry.";

    try {
      const errorBody = await response.json();
      detail = formatApiError(errorBody.detail) || detail;
    } catch {
      // Fall back to the default copy if the API error body is not JSON.
    }

    throw new Error(detail);
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
      getListingOwnerName(listing),
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
              <p>${escapeHtml(category.description || "Browse published listings for this room type.")}</p>
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
  const ownerName = getListingOwnerName(listing);

  return `
    <a class="listing-card" href="/listings/${encodeURIComponent(listing.id)}" data-link>
      <div class="listing-image">
        ${image ? `<img src="${escapeAttr(image.url)}" alt="${escapeAttr(listing.title)}" loading="lazy" />` : `<span>No image yet</span>`}
      </div>
      <div class="listing-body">
        <div class="badge-row">
          <span class="badge">${escapeHtml(category?.name || "Room")}</span>
        </div>
        <h3>${escapeHtml(listing.title)}</h3>
        <div class="price">${formatPrice(listing.price, listing.currency)}</div>
        <div class="listing-meta">
          ${escapeHtml(listing.location || "Location TBA")}
          ${ownerName ? ` &middot; ${escapeHtml(ownerName)}` : ""}
        </div>
      </div>
    </a>
  `;
}

function getListingOwnerName(listing) {
  return listing.owner_name || listing.provider_name || "";
}

async function submitEnquiryForm(form) {
  const listingId = form.dataset.listingId;
  const submitButton = form.querySelector('button[type="submit"]');
  if (!listingId || !(submitButton instanceof HTMLButtonElement)) return;

  const data = new FormData(form);
  const isViewingRequested = data.get("is_viewing_requested") === "on";
  const payload = {
    name: data.get("name")?.toString().trim() || "",
    email: data.get("email")?.toString().trim() || null,
    phone: data.get("phone")?.toString().trim() || null,
    message: data.get("message")?.toString().trim() || "",
    desired_move_in_date: data.get("desired_move_in_date")?.toString() || null,
    occupant_count: parsePositiveInteger(data.get("occupant_count")),
    is_viewing_requested: isViewingRequested,
    preferred_viewing_date: isViewingRequested
      ? data.get("preferred_viewing_date")?.toString() || null
      : null,
    preferred_viewing_time: isViewingRequested
      ? normaliseTimeValue(data.get("preferred_viewing_time")?.toString() || "")
      : null,
    viewing_notes: isViewingRequested
      ? data.get("viewing_notes")?.toString().trim() || null
      : null,
  };

  setFormFeedback(form, "");
  submitButton.disabled = true;
  submitButton.textContent = "Sending...";

  try {
    await postJson(`/listings/${encodeURIComponent(listingId)}/enquiries`, payload);
    form.reset();
    syncViewingFields(form);
    setFormFeedback(
      form,
      "Your enquiry has been sent. The agent or landlord can contact you to confirm availability or arrange a viewing.",
      "success",
    );
  } catch (error) {
    setFormFeedback(
      form,
      error instanceof Error ? error.message : "Could not send your enquiry.",
      "error",
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Enquire about this room";
  }
}

function syncViewingFields(form) {
  const toggle = form.querySelector("[data-viewing-toggle]");
  const fields = form.querySelector("[data-viewing-fields]");
  if (!(toggle instanceof HTMLInputElement) || !(fields instanceof HTMLElement)) return;

  const showViewingFields = toggle.checked;
  fields.hidden = !showViewingFields;
  fields.querySelectorAll("input, textarea").forEach((field) => {
    field.disabled = !showViewingFields;
  });
}

function setFormFeedback(form, message, tone = "") {
  const feedback = form.querySelector("[data-form-feedback]");
  if (!(feedback instanceof HTMLElement)) return;

  feedback.textContent = message;
  feedback.dataset.tone = tone;
  feedback.hidden = !message;
}

function parsePositiveInteger(value) {
  const raw = value?.toString().trim();
  if (!raw) return null;
  const parsed = Number.parseInt(raw, 10);
  return Number.isFinite(parsed) ? parsed : raw;
}

function normaliseTimeValue(value) {
  const trimmed = value.trim();
  if (!trimmed) return null;
  return trimmed.length === 5 ? `${trimmed}:00` : trimmed;
}

function formatApiError(detail) {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail
      .map((item) => {
        if (typeof item === "string") return item;
        if (!item || typeof item !== "object") return "";
        const location = Array.isArray(item.loc) ? item.loc.slice(1).join(" ") : "";
        return [location, item.msg].filter(Boolean).join(": ");
      })
      .filter(Boolean)
      .join(" ");
  }
  return "";
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
  return `<section class="state"><div class="loading-state">Loading room listings...</div></section>`;
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
