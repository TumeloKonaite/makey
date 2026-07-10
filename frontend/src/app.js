const browserWindow = typeof window !== "undefined" ? window : null;
const browserDocument = typeof document !== "undefined" ? document : null;

const API_BASE_URL = browserWindow
  ? browserWindow.MARKETPLACE_ROOMS_API_URL ||
    browserWindow.ROOMS_MARKETPLACE_API_URL ||
    browserWindow.MARKETPLACE_API_URL ||
    browserWindow.BEAUTYVERSE_API_URL ||
    "http://localhost:8000"
  : "http://localhost:8000";

const KEYCLOAK_ISSUER = browserWindow
  ? browserWindow.MARKETPLACE_ROOMS_KEYCLOAK_ISSUER || "http://localhost:8080/realms/marketplace"
  : "http://localhost:8080/realms/marketplace";

const KEYCLOAK_TOKEN_URL = browserWindow
  ? browserWindow.MARKETPLACE_ROOMS_TOKEN_URL ||
    `${KEYCLOAK_ISSUER}/protocol/openid-connect/token`
  : `${KEYCLOAK_ISSUER}/protocol/openid-connect/token`;

const KEYCLOAK_CLIENT_ID = browserWindow
  ? browserWindow.MARKETPLACE_ROOMS_AUTH_CLIENT_ID || "marketplace-api"
  : "marketplace-api";

const SESSION_STORAGE_KEY = "marketplace_rooms_owner_session";

const routeDefinitions = [
  { name: "home", pattern: /^\/$/, render: renderHome },
  { name: "login", pattern: /^\/login\/?$/, render: renderLoginPage },
  { name: "categories", pattern: /^\/categories\/?$/, render: renderCategoriesPage },
  { name: "listings", pattern: /^\/listings\/?$/, render: renderListingsPage },
  { name: "listing-detail", pattern: /^\/listings\/([^/]+)\/?$/, render: renderListingDetailPage },
  { name: "dashboard", pattern: /^\/dashboard\/?$/, render: renderDashboardHome, requiresAuth: true },
  {
    name: "dashboard-listings",
    pattern: /^\/dashboard\/listings\/?$/,
    render: renderOwnerListingsPage,
    requiresAuth: true,
  },
  {
    name: "dashboard-new-listing",
    pattern: /^\/dashboard\/listings\/new\/?$/,
    render: renderOwnerListingFormPage,
    requiresAuth: true,
  },
  {
    name: "dashboard-edit-listing",
    pattern: /^\/dashboard\/listings\/([^/]+)\/edit\/?$/,
    render: renderOwnerListingFormPage,
    requiresAuth: true,
  },
  {
    name: "dashboard-enquiries",
    pattern: /^\/dashboard\/enquiries\/?$/,
    render: renderOwnerEnquiriesPage,
    requiresAuth: true,
  },
];

const state = {
  categories: null,
  listings: null,
  ownerListings: null,
  ownerEnquiries: null,
  flash: null,
  session: loadSession(),
};

const app = browserDocument?.querySelector("#app") ?? null;

export function getRouteMatch(pathname) {
  const path = normalizePath(pathname);
  const definition = routeDefinitions.find((route) => route.pattern.test(path));
  if (!definition) return null;

  const match = path.match(definition.pattern) || [];
  return {
    ...definition,
    params: match.slice(1),
  };
}

export function getLoginRedirectPath(pathname) {
  const path = normalizePath(pathname);
  return `/login?next=${encodeURIComponent(path)}`;
}

export function resolveRouteAccess(pathname, isAuthenticated) {
  const route = getRouteMatch(pathname);
  if (!route) {
    return { type: "not-found" };
  }

  if (route.requiresAuth && !isAuthenticated) {
    return {
      type: "redirect",
      to: getLoginRedirectPath(pathname),
    };
  }

  return {
    type: "render",
    route,
  };
}

export function decodeJwtPayload(token) {
  if (!token) return null;

  const parts = token.split(".");
  if (parts.length < 2) return null;

  try {
    const base64 = parts[1].replaceAll("-", "+").replaceAll("_", "/");
    const padded = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");
    const decoded =
      typeof atob === "function"
        ? atob(padded)
        : Buffer.from(padded, "base64").toString("binary");
    const utf8 = decodeURIComponent(
      Array.from(decoded)
        .map((char) => `%${char.charCodeAt(0).toString(16).padStart(2, "0")}`)
        .join(""),
    );
    return JSON.parse(utf8);
  } catch {
    return null;
  }
}

export function buildListingPayload(fields) {
  const rentAmount = normalizeDecimal(fields.rent_amount);
  return {
    category_id: requiredString(fields.category_id),
    title: requiredString(fields.title),
    description: optionalString(fields.description),
    price: rentAmount || "0.00",
    rent_amount: rentAmount,
    deposit_amount: normalizeDecimal(fields.deposit_amount),
    agent_fee: normalizeDecimal(fields.agent_fee),
    available_date: optionalString(fields.available_date),
    is_furnished: parseNullableBoolean(fields.is_furnished),
    utilities_included: parseNullableBoolean(fields.utilities_included),
    parking_available: parseNullableBoolean(fields.parking_available),
    max_occupants: parseNullableInteger(fields.max_occupants),
    area: optionalString(fields.area),
    currency: optionalString(fields.currency) || "ZAR",
    location: requiredString(fields.location),
    status: optionalString(fields.status) || "draft",
  };
}

export function getListingStatusMeta(status) {
  switch (status) {
    case "published":
      return { label: "Published", tone: "published" };
    case "unpublished":
      return { label: "Unpublished", tone: "unpublished" };
    default:
      return { label: "Draft", tone: "draft" };
  }
}

export function renderPrimaryNav(session = null) {
  const isAuthenticated = Boolean(session?.token);
  return `
    <a href="/" data-link>Home</a>
    <a href="/categories" data-link>Room types</a>
    <a href="/listings" data-link>Find a room</a>
    ${isAuthenticated ? `<a href="/dashboard" data-link>Owner dashboard</a>` : ""}
    ${
      isAuthenticated
        ? `<button class="nav-button" type="button" data-logout>Sign out</button>`
        : `<a href="/login" data-link>Owner sign in</a>`
    }
  `;
}

if (browserWindow && browserDocument && app) {
  browserWindow.addEventListener("popstate", renderRoute);
  browserDocument.addEventListener("click", handleDocumentClick);
  browserDocument.addEventListener("submit", handleDocumentSubmit);
  browserDocument.addEventListener("change", handleDocumentChange);
  renderNav();
  renderRoute();
}

function loadSession() {
  if (!browserWindow?.localStorage) return null;

  try {
    const raw = browserWindow.localStorage.getItem(SESSION_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    const token = optionalString(parsed?.token);
    if (!token) return null;
    const claims = decodeJwtPayload(token);
    return {
      token,
      claims,
      username:
        optionalString(parsed?.username) ||
        optionalString(claims?.preferred_username) ||
        optionalString(claims?.email),
    };
  } catch {
    return null;
  }
}

function saveSession(token) {
  if (!browserWindow?.localStorage) return;

  const claims = decodeJwtPayload(token);
  const session = {
    token,
    claims,
    username:
      optionalString(claims?.preferred_username) ||
      optionalString(claims?.email) ||
      "Owner",
  };
  state.session = session;
  browserWindow.localStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(session));
  renderNav();
}

function clearSession() {
  state.session = null;
  state.ownerListings = null;
  state.ownerEnquiries = null;
  if (browserWindow?.localStorage) {
    browserWindow.localStorage.removeItem(SESSION_STORAGE_KEY);
  }
  renderNav();
}

function renderNav() {
  const nav = browserDocument?.querySelector(".nav-links");
  if (!(nav instanceof HTMLElement)) return;
  nav.innerHTML = renderPrimaryNav(state.session);
  updateActiveNav();
}

function handleDocumentClick(event) {
  const logoutButton = event.target.closest("[data-logout]");
  if (logoutButton) {
    event.preventDefault();
    clearSession();
    navigate("/");
    setFlash("You have been signed out.", "success");
    return;
  }

  const listingStatusButton = event.target.closest("[data-listing-status]");
  if (listingStatusButton instanceof HTMLButtonElement) {
    event.preventDefault();
    updateListingStatus(
      listingStatusButton.dataset.listingId,
      listingStatusButton.dataset.listingStatus,
      listingStatusButton,
    );
    return;
  }

  const deleteButton = event.target.closest("[data-delete-listing]");
  if (deleteButton instanceof HTMLButtonElement) {
    event.preventDefault();
    deleteOwnerListing(deleteButton.dataset.listingId, deleteButton);
    return;
  }

  const link = event.target.closest("a[data-link]");
  if (!link) return;

  const url = new URL(link.href);
  if (url.origin !== browserWindow.location.origin) return;

  event.preventDefault();
  history.pushState({}, "", `${url.pathname}${url.search}`);
  renderRoute();
}

function handleDocumentSubmit(event) {
  const form = event.target;
  if (!(form instanceof HTMLFormElement)) return;

  if (form.matches("[data-home-search]")) {
    event.preventDefault();
    const search = new FormData(form).get("search")?.toString().trim() || "";
    const params = new URLSearchParams();
    if (search) params.set("search", search);
    navigate(`/listings${params.size ? `?${params}` : ""}`);
    return;
  }

  if (form.matches("[data-listing-filters]")) {
    event.preventDefault();
    applyListingFilters(form);
    return;
  }

  if (form.matches("[data-enquiry-form]")) {
    event.preventDefault();
    submitEnquiryForm(form);
    return;
  }

  if (form.matches("[data-login-form]")) {
    event.preventDefault();
    submitLoginForm(form);
    return;
  }

  if (form.matches("[data-listing-form]")) {
    event.preventDefault();
    submitListingForm(form);
    return;
  }

  if (form.matches("[data-image-upload-form]")) {
    event.preventDefault();
    submitImageUploadForm(form);
  }
}

function handleDocumentChange(event) {
  const field = event.target;
  const form = field instanceof HTMLElement ? field.closest("[data-listing-filters]") : null;
  if (form && (field.matches("select") || field.matches('input[type="checkbox"]'))) {
    applyListingFilters(form);
  }

  if (field instanceof HTMLInputElement && field.matches("[data-viewing-toggle]")) {
    const enquiryForm = field.closest("[data-enquiry-form]");
    if (enquiryForm) syncViewingFields(enquiryForm);
  }
}

function navigate(path) {
  history.pushState({}, "", path);
  renderRoute();
}

async function renderRoute() {
  renderNav();
  const access = resolveRouteAccess(browserWindow.location.pathname, isAuthenticated());
  if (access.type === "redirect") {
    history.replaceState({}, "", access.to);
    await renderRoute();
    return;
  }

  updateActiveNav();

  if (access.type === "not-found") {
    setDocumentTitle("Page not found");
    app.innerHTML = errorState("Page not found.");
    app.focus();
    return;
  }

  app.innerHTML = loadingState(
    access.route.requiresAuth ? "Loading owner dashboard..." : "Loading room listings...",
  );
  app.focus();

  try {
    await access.route.render(...access.route.params);
  } catch (error) {
    if (error?.code === "AUTH_REQUIRED") {
      navigate(getLoginRedirectPath(browserWindow.location.pathname));
      return;
    }

    app.innerHTML = errorState(
      error instanceof Error ? error.message : "Something went wrong while loading the page.",
    );
  }
}

function isAuthenticated() {
  return Boolean(state.session?.token);
}

function setDocumentTitle(title) {
  if (browserDocument) {
    browserDocument.title = `Marketplace Rooms | ${title}`;
  }
}

function getFlashMarkup() {
  if (!state.flash) return "";
  const flash = state.flash;
  state.flash = null;
  return `
    <div class="flash-banner" data-tone="${escapeAttr(flash.tone || "info")}">
      ${escapeHtml(flash.message)}
    </div>
  `;
}

function setFlash(message, tone = "success") {
  state.flash = { message, tone };
}

async function renderHome() {
  setDocumentTitle("Find a room");
  const [categories, listings] = await Promise.all([getCategories(), getListings()]);
  const latestListings = listings.slice(0, 6);
  const uniqueAreas = new Set(
    listings
      .flatMap((listing) => [listing.area, listing.location])
      .filter(Boolean)
      .map((value) => value.toLowerCase()),
  );

  app.innerHTML = `
    <section class="hero">
      <div class="hero-content">
        <p class="eyebrow">Public room discovery</p>
        <h1>Find a room that fits your budget and move-in date.</h1>
        <p>Browse published room listings without logging in. Compare monthly rent, suburb, room type, furnishing, and rental terms before you enquire.</p>
        <form class="search-panel" data-home-search>
          <input name="search" type="search" placeholder="Search by suburb, room type, landmark, or title" aria-label="Search listings" />
          <button type="submit">Search rooms</button>
        </form>
        <div class="hero-stats">
          <div class="stat-card">
            <strong>${listings.length}</strong>
            <span>Published rooms</span>
          </div>
          <div class="stat-card">
            <strong>${categories.length}</strong>
            <span>Room types</span>
          </div>
          <div class="stat-card">
            <strong>${uniqueAreas.size}</strong>
            <span>Areas to explore</span>
          </div>
        </div>
      </div>
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h2>Browse by room type</h2>
          <p>Start with the kind of space you need, then filter by area, rent, and furnishing.</p>
        </div>
        <a class="button button-secondary" href="/categories" data-link>View room types</a>
      </div>
      ${renderCategoryGrid(categories.slice(0, 4))}
    </section>

    <section class="section">
      <div class="section-header">
        <div>
          <h2>Recently published rooms</h2>
          <p>See the latest available rooms with rent, suburb, availability date, and basic terms at a glance.</p>
        </div>
        <div class="hero-actions">
          <a class="button" href="/listings" data-link>Browse all rooms</a>
          <a class="button button-secondary" href="/dashboard" data-link>Owner dashboard</a>
        </div>
      </div>
      ${
        latestListings.length
          ? renderListingGrid(latestListings, categories)
          : emptyState("No published room listings yet.", "Check back soon for new rooms.")
      }
    </section>
  `;
}

async function renderLoginPage() {
  setDocumentTitle("Owner sign in");
  if (isAuthenticated()) {
    navigate(getPostLoginDestination());
    return;
  }

  app.innerHTML = `
    <section class="page-title">
      <h1>Owner sign in</h1>
      <p>Use the existing Keycloak owner account for this marketplace. After signing in, you can manage room listings, images, and renter enquiries.</p>
    </section>
    <section class="content-wrap">
      ${getFlashMarkup()}
      <div class="auth-card">
        <form class="auth-form" data-login-form>
          <div class="form-grid">
            <div class="field field-span-full">
              <label for="owner-username">Email or username</label>
              <input id="owner-username" name="username" type="text" required autocomplete="username" placeholder="owner@test.com" />
            </div>
            <div class="field field-span-full">
              <label for="owner-password">Password</label>
              <input id="owner-password" name="password" type="password" required autocomplete="current-password" placeholder="Password123!" />
            </div>
          </div>
          <div class="form-actions">
              <p class="form-hint">This uses the existing Keycloak token flow for the marketplace-api client.</p>
            <button type="submit">Sign in</button>
          </div>
          <div class="form-feedback" data-form-feedback aria-live="polite"></div>
        </form>
      </div>
    </section>
  `;
}

async function renderCategoriesPage() {
  setDocumentTitle("Room types");
  const categories = await getCategories();

  app.innerHTML = `
    <section class="page-title">
      <h1>Room Types</h1>
      <p>Explore room categories and jump straight into matching published rental listings.</p>
    </section>
    <section class="content-wrap">
      ${
        categories.length
          ? renderCategoryGrid(categories)
          : emptyState(
              "No room types yet.",
              "Room categories will appear here once listings are ready for browsing.",
            )
      }
    </section>
  `;
}

async function renderListingsPage() {
  setDocumentTitle("Find a room");
  const [categories, listings] = await Promise.all([getCategories(), getListings()]);
  const filters = getListingFiltersFromUrl();
  const visibleListings = filterListings(listings, categories, filters);
  const activeFilterCount = countActiveFilters(filters);

  app.innerHTML = `
    <section class="page-title">
      <h1>Find a Room</h1>
      <p>Filter published rooms by location, room type, rent, furnishing, availability, and fee terms without signing in.</p>
    </section>
    <form class="toolbar" data-listing-filters>
      <div class="filter-grid">
        <div class="field">
          <label for="listing-search">Search</label>
          <input id="listing-search" name="search" type="search" value="${escapeAttr(filters.search)}" placeholder="Title, landmark, suburb..." />
        </div>
        <div class="field">
          <label for="listing-location">Location</label>
          <input id="listing-location" name="location" type="text" value="${escapeAttr(filters.location)}" placeholder="City or town" />
        </div>
        <div class="field">
          <label for="listing-area">Area</label>
          <input id="listing-area" name="area" type="text" value="${escapeAttr(filters.area)}" placeholder="Suburb or area" />
        </div>
        <div class="field">
          <label for="listing-category">Room type</label>
          <select id="listing-category" name="category">
            <option value="">All room types</option>
            ${categories
              .map(
                (item) =>
                  `<option value="${escapeAttr(item.id)}" ${item.id === filters.category ? "selected" : ""}>${escapeHtml(item.name)}</option>`,
              )
              .join("")}
          </select>
        </div>
        <div class="field">
          <label for="listing-min-rent">Min rent</label>
          <input id="listing-min-rent" name="minRent" type="number" min="0" step="100" value="${escapeAttr(filters.minRent)}" placeholder="0" />
        </div>
        <div class="field">
          <label for="listing-max-rent">Max rent</label>
          <input id="listing-max-rent" name="maxRent" type="number" min="0" step="100" value="${escapeAttr(filters.maxRent)}" placeholder="12000" />
        </div>
        <div class="field">
          <label for="listing-furnished">Furnishing</label>
          <select id="listing-furnished" name="furnished">
            <option value="">Any</option>
            <option value="furnished" ${filters.furnished === "furnished" ? "selected" : ""}>Furnished</option>
            <option value="unfurnished" ${filters.furnished === "unfurnished" ? "selected" : ""}>Unfurnished</option>
          </select>
        </div>
        <div class="field">
          <label for="listing-fee">Agent fee</label>
          <select id="listing-fee" name="fee">
            <option value="">Any</option>
            <option value="no-agent-fee" ${filters.fee === "no-agent-fee" ? "selected" : ""}>No agent fee</option>
            <option value="agent-fee" ${filters.fee === "agent-fee" ? "selected" : ""}>Agent fee applies</option>
          </select>
        </div>
        <div class="field">
          <label for="listing-available-by">Available by</label>
          <input id="listing-available-by" name="availableBy" type="date" value="${escapeAttr(filters.availableBy)}" />
        </div>
        <label class="checkbox-field inline-filter" for="listing-available-now">
          <input id="listing-available-now" name="availableNow" type="checkbox" value="1" ${filters.availableNow ? "checked" : ""} />
          <span>Available now</span>
        </label>
      </div>
      <div class="toolbar-actions">
        <div class="toolbar-summary">
          <strong>${visibleListings.length}</strong>
          <span>${visibleListings.length === 1 ? "room matches" : "rooms match"}</span>
          ${activeFilterCount ? `<span class="toolbar-muted">${activeFilterCount} filter${activeFilterCount === 1 ? "" : "s"} active</span>` : ""}
        </div>
        <div class="toolbar-buttons">
          <a class="button button-secondary" href="/listings" data-link>Clear filters</a>
          <button type="submit">Apply filters</button>
        </div>
      </div>
    </form>
    <section class="content-wrap">
      ${
        visibleListings.length
          ? renderListingGrid(visibleListings, categories)
          : emptyState(
              "No rooms match these filters.",
              "Try widening your rent range or removing one of the location or availability filters.",
            )
      }
    </section>
  `;
}

async function renderListingDetailPage(id) {
  const [categories, listing] = await Promise.all([getCategories(), getListing(id)]);
  setDocumentTitle(listing.title);
  const category = findCategory(categories, listing.category_id);
  const image = getCoverImage(listing);
  const contactName = getListingContactName(listing);
  const terms = getListingTerms(listing);

  app.innerHTML = `
    <section class="page-title">
      <a class="text-link" href="/listings" data-link>Back to room listings</a>
    </section>
    <section class="content-wrap">
      <div class="detail-shell">
        <div class="detail-main">
          <div class="detail-image">
            ${
              image
                ? `<img src="${escapeAttr(image.url)}" alt="${escapeAttr(listing.title)}" />`
                : `<span>No cover image yet</span>`
            }
          </div>
          <article class="detail-panel">
            <div class="badge-row">
              <span class="badge">${escapeHtml(category?.name || "Room")}</span>
              ${renderOptionalBadge(getFurnishedBadgeLabel(listing))}
              ${renderOptionalBadge(getAvailabilityLabel(listing))}
            </div>
            <h1>${escapeHtml(listing.title)}</h1>
            <div class="price-row">
              <div class="price">${formatPrice(getListingRentAmount(listing), listing.currency)}</div>
              <span class="price-suffix">per month</span>
            </div>
            <p class="detail-location">${escapeHtml(getListingLocationLabel(listing))}</p>

            <div class="summary-grid">
              ${renderSummaryCard("Area", listing.area || "Not specified")}
              ${renderSummaryCard("Availability", getAvailabilityLabel(listing))}
              ${renderSummaryCard("Deposit", terms.deposit)}
              ${renderSummaryCard("Agent fee", terms.agentFee)}
            </div>

            <div class="detail-section">
              <h2>About this room</h2>
              <p class="listing-description">${escapeHtml(listing.description || "No description has been added for this room yet.")}</p>
            </div>

            <div class="detail-section">
              <h2>Rental details</h2>
              <dl class="fact-list">
                ${renderFactRow("Monthly rent", formatPrice(getListingRentAmount(listing), listing.currency))}
                ${renderFactRow("Room type", category?.name || "Room")}
                ${renderFactRow("Location", listing.location || "Not specified")}
                ${renderFactRow("Area", listing.area || "Not specified")}
                ${renderFactRow("Availability", getAvailabilityLabel(listing))}
                ${renderFactRow("Furnishing", getFurnishedLabel(listing))}
                ${renderFactRow("Deposit", terms.deposit)}
                ${renderFactRow("Agent fee", terms.agentFee)}
                ${renderFactRow("Utilities", getBooleanLabel(listing.utilities_included, "Included", "Excluded"))}
                ${renderFactRow("Parking", getBooleanLabel(listing.parking_available, "Available", "Not available"))}
                ${renderFactRow("Max occupants", getOccupancyLabel(listing.max_occupants))}
                ${renderFactRow("Listed by", contactName || "Landlord or agent")}
              </dl>
            </div>
          </article>
        </div>
        <aside class="detail-sidebar">
          <div class="enquiry-panel">
            <h2>Ask about this room</h2>
            <p>${escapeHtml(contactName || "The landlord or agent can follow up after you send your enquiry.")}</p>
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
                  <label for="enquiry-message">Message</label>
                  <textarea id="enquiry-message" name="message" rows="5" required placeholder="Hi, is this room still available and can I arrange a viewing?"></textarea>
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
                  <textarea id="enquiry-viewing-notes" name="viewing_notes" rows="3" placeholder="Share your preferred time window or anything relevant about the viewing."></textarea>
                </div>
              </div>
              <div class="form-actions">
                <p class="form-hint">For this MVP, include either an email address or a phone number.</p>
                <button type="submit">Send enquiry</button>
              </div>
              <div class="form-feedback" data-form-feedback aria-live="polite"></div>
            </form>
          </div>
        </aside>
      </div>
    </section>
  `;

  const enquiryForm = app.querySelector("[data-enquiry-form]");
  if (enquiryForm) syncViewingFields(enquiryForm);
}

async function renderDashboardHome() {
  setDocumentTitle("Owner dashboard");
  const [categories, listings, enquiries] = await Promise.all([
    getCategories(),
    getOwnerListings(),
    getOwnerEnquiries(),
  ]);
  const publishedCount = listings.filter((listing) => listing.status === "published").length;
  const draftCount = listings.filter((listing) => listing.status === "draft").length;
  const unpublishedCount = listings.filter((listing) => listing.status === "unpublished").length;

  app.innerHTML = `
    <section class="page-title">
      <p class="eyebrow">Authenticated owner area</p>
      <h1>Owner dashboard</h1>
      <p>Manage your room listings, track publication status, upload images, and review renter enquiries in one place.</p>
    </section>
    <section class="content-wrap dashboard-wrap">
      ${getFlashMarkup()}
      <div class="dashboard-toolbar">
        <div class="dashboard-intro">
          <strong>${escapeHtml(getSessionDisplayName())}</strong>
          <span>${escapeHtml(getOwnerRoleLabel())}</span>
        </div>
        <div class="toolbar-buttons">
          <a class="button" href="/dashboard/listings/new" data-link>Create room listing</a>
          <a class="button button-secondary" href="/dashboard/enquiries" data-link>View renter enquiries</a>
        </div>
      </div>

      <div class="dashboard-summary-grid">
        ${renderDashboardMetric("Total listings", listings.length)}
        ${renderDashboardMetric("Published", publishedCount)}
        ${renderDashboardMetric("Draft", draftCount)}
        ${renderDashboardMetric("Unpublished", unpublishedCount)}
        ${renderDashboardMetric("Renter enquiries", enquiries.length)}
      </div>

      <section class="dashboard-section">
        <div class="section-header">
          <div>
            <h2>Your latest room listings</h2>
            <p>Only your own listings appear here, including drafts and unpublished rooms.</p>
          </div>
          <a class="button button-secondary" href="/dashboard/listings" data-link>Manage listings</a>
        </div>
        ${
          listings.length
            ? renderOwnerListingCards(listings.slice(0, 3), categories)
            : emptyState(
                "You have not created any room listings yet.",
                "Create your first room listing to start publishing rooms to the marketplace.",
              )
        }
      </section>

      <section class="dashboard-section">
        <div class="section-header">
          <div>
            <h2>Recent renter enquiries</h2>
            <p>Review the latest messages sent to your published room listings.</p>
          </div>
          <a class="button button-secondary" href="/dashboard/enquiries" data-link>Open enquiries</a>
        </div>
        ${
          enquiries.length
            ? renderOwnerEnquiryCards(enquiries.slice(0, 4))
            : emptyState(
                "No renter enquiries yet.",
                "When renters enquire about your published rooms, those messages will appear here.",
              )
        }
      </section>
    </section>
  `;
}

async function renderOwnerListingsPage() {
  setDocumentTitle("Manage room listings");
  const [categories, listings] = await Promise.all([getCategories(), getOwnerListings()]);

  app.innerHTML = `
    <section class="page-title">
      <p class="eyebrow">Owner dashboard</p>
      <h1>Manage room listings</h1>
      <p>Create, edit, publish, unpublish, and remove only the room listings that belong to your owner account.</p>
    </section>
    <section class="content-wrap dashboard-wrap">
      ${getFlashMarkup()}
      <div class="dashboard-toolbar">
        <div class="toolbar-buttons">
          <a class="button" href="/dashboard/listings/new" data-link>Create room listing</a>
          <a class="button button-secondary" href="/dashboard/enquiries" data-link>Owner enquiries</a>
        </div>
      </div>
      ${
        listings.length
          ? renderOwnerListingCards(listings, categories)
          : emptyState(
              "No room listings yet.",
              "Create a draft room listing, then publish it when the photos and rental details are ready.",
            )
      }
    </section>
  `;
}

async function renderOwnerListingFormPage(id) {
  const isEditing = Boolean(id);
  const [categories, listing] = await Promise.all([
    getCategories(),
    isEditing ? getOwnerListing(id) : Promise.resolve(null),
  ]);
  setDocumentTitle(isEditing ? "Edit room listing" : "Create room listing");

  app.innerHTML = `
    <section class="page-title">
      <p class="eyebrow">Owner dashboard</p>
      <h1>${isEditing ? "Edit room listing" : "Create room listing"}</h1>
      <p>${isEditing ? "Update rental details, listing status, and listing images for this room." : "Add the core rental details for a new room listing and save it as a draft or publish it immediately."}</p>
    </section>
    <section class="content-wrap dashboard-wrap">
      ${getFlashMarkup()}
      <div class="editor-shell">
        <div class="editor-main">
          <form class="editor-card" data-listing-form data-listing-id="${escapeAttr(id || "")}">
            <div class="editor-grid">
              <div class="field field-span-full">
                <label for="listing-title">Title</label>
                <input id="listing-title" name="title" type="text" required maxlength="255" value="${escapeAttr(listing?.title || "")}" placeholder="Sunny room near campus" />
              </div>
              <div class="field field-span-full">
                <label for="listing-description">Description</label>
                <textarea id="listing-description" name="description" rows="6" required placeholder="Describe the room, household setup, utilities, transport access, and any rental conditions.">${escapeHtml(listing?.description || "")}</textarea>
              </div>
              <div class="field">
                <label for="listing-category-id">Room type</label>
                <select id="listing-category-id" name="category_id" required>
                  <option value="">Choose a room type</option>
                  ${categories
                    .map(
                      (category) =>
                        `<option value="${escapeAttr(category.id)}" ${category.id === listing?.category_id ? "selected" : ""}>${escapeHtml(category.name)}</option>`,
                    )
                    .join("")}
                </select>
              </div>
              <div class="field">
                <label for="listing-status">Listing status</label>
                <select id="listing-status" name="status">
                  ${renderStatusOptions(listing?.status || "draft")}
                </select>
              </div>
              <div class="field">
                <label for="listing-rent">Monthly rent</label>
                <input id="listing-rent" name="rent_amount" type="number" min="0" step="0.01" required value="${escapeAttr(listing?.rent_amount || "")}" placeholder="6500" />
              </div>
              <div class="field">
                <label for="listing-deposit">Deposit</label>
                <input id="listing-deposit" name="deposit_amount" type="number" min="0" step="0.01" value="${escapeAttr(listing?.deposit_amount || "")}" placeholder="6500" />
              </div>
              <div class="field">
                <label for="listing-agent-fee">Agent fee</label>
                <input id="listing-agent-fee" name="agent_fee" type="number" min="0" step="0.01" value="${escapeAttr(listing?.agent_fee || "")}" placeholder="0" />
              </div>
              <div class="field">
                <label for="listing-available-date">Available date</label>
                <input id="listing-available-date" name="available_date" type="date" value="${escapeAttr(listing?.available_date || "")}" />
              </div>
              <div class="field">
                <label for="listing-location">Location</label>
                <input id="listing-location" name="location" type="text" required value="${escapeAttr(listing?.location || "")}" placeholder="Cape Town" />
              </div>
              <div class="field">
                <label for="listing-area">Area</label>
                <input id="listing-area" name="area" type="text" value="${escapeAttr(listing?.area || "")}" placeholder="Observatory" />
              </div>
              <div class="field">
                <label for="listing-furnished-state">Furnished</label>
                <select id="listing-furnished-state" name="is_furnished">
                  ${renderTriStateOptions(listing?.is_furnished, "Not specified")}
                </select>
              </div>
              <div class="field">
                <label for="listing-utilities">Utilities included</label>
                <select id="listing-utilities" name="utilities_included">
                  ${renderTriStateOptions(listing?.utilities_included, "Not specified")}
                </select>
              </div>
              <div class="field">
                <label for="listing-parking">Parking</label>
                <select id="listing-parking" name="parking_available">
                  ${renderTriStateOptions(listing?.parking_available, "Not specified")}
                </select>
              </div>
              <div class="field">
                <label for="listing-occupants">Maximum occupants</label>
                <input id="listing-occupants" name="max_occupants" type="number" min="1" step="1" value="${escapeAttr(listing?.max_occupants || "")}" placeholder="1" />
              </div>
              <input name="currency" type="hidden" value="${escapeAttr(listing?.currency || "ZAR")}" />
            </div>
            <div class="form-actions">
              <div class="toolbar-buttons">
                <a class="button button-secondary" href="/dashboard/listings" data-link>Back to listings</a>
                ${
                  isEditing && listing?.status === "published"
                    ? `<a class="button button-secondary" href="/listings/${encodeURIComponent(listing.id)}" data-link>View public page</a>`
                    : ""
                }
              </div>
              <button type="submit">${isEditing ? "Save changes" : "Create listing"}</button>
            </div>
            <div class="form-feedback" data-form-feedback aria-live="polite"></div>
          </form>
        </div>
        ${
          isEditing
            ? `
              <aside class="editor-sidebar">
                <div class="editor-card">
                  <div class="section-header compact">
                    <div>
                      <h2>Listing images</h2>
                      <p>Upload room photos for this listing. Mark one image as the cover photo when needed.</p>
                    </div>
                  </div>
                  ${
                    listing.images?.length
                      ? renderImageGallery(listing.images)
                      : emptyState(
                          "No listing images yet.",
                          "Upload the first room photo to give renters a quick visual overview.",
                        )
                  }
                  <form class="image-upload-form" data-image-upload-form data-listing-id="${escapeAttr(listing.id)}">
                    <div class="form-grid">
                      <div class="field field-span-full">
                        <label for="listing-image-file">Image file</label>
                        <input id="listing-image-file" name="file" type="file" accept="image/png,image/jpeg,image/webp" required />
                      </div>
                      <div class="field">
                        <label for="listing-image-order">Display order</label>
                        <input id="listing-image-order" name="display_order" type="number" min="0" step="1" value="${escapeAttr(String(listing.images?.length || 0))}" />
                      </div>
                      <label class="checkbox-field field-span-full" for="listing-image-cover">
                        <input id="listing-image-cover" name="is_cover" type="checkbox" />
                        <span>Use as cover image</span>
                      </label>
                    </div>
                    <div class="form-actions">
                      <span class="form-hint">JPEG, PNG, and WebP are supported by the backend upload rules.</span>
                      <button type="submit">Upload image</button>
                    </div>
                    <div class="form-feedback" data-form-feedback aria-live="polite"></div>
                  </form>
                </div>
              </aside>
            `
            : ""
        }
      </div>
    </section>
  `;
}

async function renderOwnerEnquiriesPage() {
  setDocumentTitle("Renter enquiries");
  const enquiries = await getOwnerEnquiries();

  app.innerHTML = `
    <section class="page-title">
      <p class="eyebrow">Owner dashboard</p>
      <h1>Renter enquiries</h1>
      <p>Only enquiries sent to your own room listings appear here, with renter contact details and viewing preferences where supplied.</p>
    </section>
    <section class="content-wrap dashboard-wrap">
      ${getFlashMarkup()}
      <div class="dashboard-toolbar">
        <div class="toolbar-buttons">
          <a class="button button-secondary" href="/dashboard" data-link>Back to dashboard</a>
          <a class="button" href="/dashboard/listings" data-link>Manage listings</a>
        </div>
      </div>
      ${
        enquiries.length
          ? renderOwnerEnquiryCards(enquiries)
          : emptyState(
              "No renter enquiries yet.",
              "Enquiries will appear here after renters contact you from published room listings.",
            )
      }
    </section>
  `;
}

async function submitLoginForm(form) {
  const submitButton = form.querySelector('button[type="submit"]');
  if (!(submitButton instanceof HTMLButtonElement)) return;

  const data = new FormData(form);
  const username = data.get("username")?.toString().trim() || "";
  const password = data.get("password")?.toString() || "";

  setFormFeedback(form, "");
  submitButton.disabled = true;
  submitButton.textContent = "Signing in...";

  try {
    const response = await fetch(KEYCLOAK_TOKEN_URL, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        client_id: KEYCLOAK_CLIENT_ID,
        grant_type: "password",
        username,
        password,
      }),
    });

    if (!response.ok) {
      throw new Error("Could not sign in with that owner account.");
    }

    const body = await response.json();
    const token = optionalString(body.access_token);
    if (!token) {
      throw new Error("The login response did not include an access token.");
    }

    saveSession(token);
    state.ownerListings = null;
    state.ownerEnquiries = null;
    setFlash("Owner session started successfully.", "success");
    navigate(getPostLoginDestination());
  } catch (error) {
    setFormFeedback(
      form,
      error instanceof Error ? error.message : "Could not sign in with that owner account.",
      "error",
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Sign in";
  }
}

async function submitListingForm(form) {
  const submitButton = form.querySelector('button[type="submit"]');
  if (!(submitButton instanceof HTMLButtonElement)) return;

  const listingId = optionalString(form.dataset.listingId);
  const isEditing = Boolean(listingId);
  const data = new FormData(form);
  const payload = buildListingPayload(Object.fromEntries(data.entries()));

  setFormFeedback(form, "");
  submitButton.disabled = true;
  submitButton.textContent = isEditing ? "Saving..." : "Creating...";

  try {
    const savedListing = await requestJson(isEditing ? `/listings/${listingId}` : "/listings", {
      method: isEditing ? "PATCH" : "POST",
      auth: true,
      json: payload,
    });
    clearListingCaches();
    setFlash(
      isEditing
        ? "Room listing updated successfully."
        : "Room listing created successfully. You can now upload images.",
      "success",
    );
    navigate(
      isEditing
        ? `/dashboard/listings/${encodeURIComponent(savedListing.id)}/edit`
        : `/dashboard/listings/${encodeURIComponent(savedListing.id)}/edit`,
    );
  } catch (error) {
    setFormFeedback(
      form,
      error instanceof Error ? error.message : "Could not save the room listing.",
      "error",
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = isEditing ? "Save changes" : "Create listing";
  }
}

async function submitImageUploadForm(form) {
  const listingId = optionalString(form.dataset.listingId);
  const submitButton = form.querySelector('button[type="submit"]');
  if (!listingId || !(submitButton instanceof HTMLButtonElement)) return;

  const payload = new FormData(form);
  setFormFeedback(form, "");
  submitButton.disabled = true;
  submitButton.textContent = "Uploading...";

  try {
    await requestJson(`/listings/${listingId}/images`, {
      method: "POST",
      auth: true,
      formData: payload,
    });
    clearListingCaches();
    setFlash("Listing image uploaded successfully.", "success");
    navigate(`/dashboard/listings/${encodeURIComponent(listingId)}/edit`);
  } catch (error) {
    setFormFeedback(
      form,
      error instanceof Error ? error.message : "Could not upload the listing image.",
      "error",
    );
  } finally {
    submitButton.disabled = false;
    submitButton.textContent = "Upload image";
  }
}

async function updateListingStatus(listingId, nextStatus, button) {
  if (!listingId || !nextStatus || !(button instanceof HTMLButtonElement)) return;

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = nextStatus === "published" ? "Publishing..." : "Updating...";

  try {
    await requestJson(`/listings/${listingId}`, {
      method: "PATCH",
      auth: true,
      json: { status: nextStatus },
    });
    clearListingCaches();
    setFlash(`Listing moved to ${getListingStatusMeta(nextStatus).label.toLowerCase()}.`, "success");
    renderRoute();
  } catch (error) {
    setFlash(
      error instanceof Error ? error.message : "Could not update the listing status.",
      "error",
    );
    renderRoute();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function deleteOwnerListing(listingId, button) {
  if (!listingId || !(button instanceof HTMLButtonElement)) return;
  if (browserWindow && !browserWindow.confirm("Delete this room listing? This cannot be undone.")) {
    return;
  }

  const originalText = button.textContent;
  button.disabled = true;
  button.textContent = "Deleting...";

  try {
    await requestJson(`/listings/${listingId}`, {
      method: "DELETE",
      auth: true,
    });
    clearListingCaches();
    setFlash("Room listing deleted.", "success");
    renderRoute();
  } catch (error) {
    setFlash(
      error instanceof Error ? error.message : "Could not delete the room listing.",
      "error",
    );
    renderRoute();
  } finally {
    button.disabled = false;
    button.textContent = originalText;
  }
}

async function getCategories() {
  if (state.categories) return state.categories;
  state.categories = await requestJson("/categories");
  return state.categories;
}

async function getListings() {
  if (state.listings) return state.listings;
  state.listings = await requestJson("/listings");
  return state.listings;
}

async function getListing(id) {
  return requestJson(`/listings/${encodeURIComponent(id)}`);
}

async function getOwnerListings() {
  if (state.ownerListings) return state.ownerListings;
  state.ownerListings = await requestJson("/me/listings", { auth: true });
  return state.ownerListings;
}

async function getOwnerListing(id) {
  const cached = state.ownerListings?.find((listing) => listing.id === id);
  if (cached) return cached;
  return requestJson(`/me/listings/${encodeURIComponent(id)}`, { auth: true });
}

async function getOwnerEnquiries() {
  if (state.ownerEnquiries) return state.ownerEnquiries;
  state.ownerEnquiries = await requestJson("/me/owner-enquiries", { auth: true });
  return state.ownerEnquiries;
}

async function requestJson(path, options = {}) {
  const headers = {
    Accept: "application/json",
    ...(options.headers || {}),
  };

  if (options.auth) {
    const token = state.session?.token;
    if (!token) {
      const error = new Error("Please sign in to continue.");
      error.code = "AUTH_REQUIRED";
      throw error;
    }
    headers.Authorization = `Bearer ${token}`;
  }

  let body;
  if (options.json !== undefined) {
    headers["Content-Type"] = "application/json";
    body = JSON.stringify(options.json);
  } else if (options.formData) {
    body = options.formData;
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    method: options.method || "GET",
    headers,
    body,
  });

  if (response.status === 401 && options.auth) {
    clearSession();
    const error = new Error("Your owner session expired. Please sign in again.");
    error.code = "AUTH_REQUIRED";
    throw error;
  }

  if (!response.ok) {
    let detail = defaultErrorMessage(path, options.method);
    try {
      const errorBody = await response.json();
      detail = formatApiError(errorBody.detail) || detail;
    } catch {
      // Keep the fallback detail when the error body is not JSON.
    }
    throw new Error(detail);
  }

  if (response.status === 204) {
    return null;
  }

  return response.json();
}

function clearListingCaches() {
  state.listings = null;
  state.ownerListings = null;
}

function defaultErrorMessage(path, method = "GET") {
  if (path.startsWith("/me/")) return "Could not load owner dashboard data.";
  if (path.includes("/images")) return "Could not upload the listing image.";
  if (method === "DELETE") return "Could not delete the room listing.";
  if (method === "PATCH" || method === "POST") return "Could not save the room listing.";
  if (path.includes("/enquiries")) return "Could not load renter enquiries.";
  return "Could not load room listings.";
}

function getPostLoginDestination() {
  const params = new URLSearchParams(browserWindow.location.search);
  const next = params.get("next") || "/dashboard";
  return next.startsWith("/dashboard") ? next : "/dashboard";
}

function getSessionDisplayName() {
  return state.session?.username || state.session?.claims?.email || "Owner account";
}

function getOwnerRoleLabel() {
  const roles = extractRoles(state.session?.claims);
  if (roles.includes("landlord")) return "Landlord profile";
  if (roles.includes("provider")) return "Legacy owner role accepted";
  return "Owner profile";
}

function extractRoles(claims) {
  if (!claims || typeof claims !== "object") return [];
  const roles = new Set(claims.realm_access?.roles || []);
  const resourceAccess = claims.resource_access || {};
  Object.values(resourceAccess).forEach((client) => {
    (client?.roles || []).forEach((role) => roles.add(role));
  });
  return Array.from(roles);
}

function getListingFiltersFromUrl() {
  const params = new URLSearchParams(browserWindow.location.search);
  return {
    search: params.get("search") || "",
    category: params.get("category") || "",
    location: params.get("location") || "",
    area: params.get("area") || "",
    minRent: params.get("minRent") || "",
    maxRent: params.get("maxRent") || "",
    furnished: params.get("furnished") || "",
    availableNow: params.get("availableNow") === "1",
    availableBy: params.get("availableBy") || "",
    fee: params.get("fee") || "",
  };
}

function applyListingFilters(form) {
  const data = new FormData(form);
  const params = new URLSearchParams();
  const fields = [
    "search",
    "category",
    "location",
    "area",
    "minRent",
    "maxRent",
    "furnished",
    "availableBy",
    "fee",
  ];

  fields.forEach((key) => {
    const value = data.get(key)?.toString().trim() || "";
    if (value) params.set(key, value);
  });

  if (data.get("availableNow") === "1") {
    params.set("availableNow", "1");
  }

  const nextUrl = `/listings${params.size ? `?${params}` : ""}`;
  history.replaceState({}, "", nextUrl);
  renderListingsPage();
}

function filterListings(listings, categories, filters) {
  const search = normalizeText(filters.search);
  const location = normalizeText(filters.location);
  const area = normalizeText(filters.area);
  const minRent = parseNumber(filters.minRent);
  const maxRent = parseNumber(filters.maxRent);
  const today = getTodayIsoDate();

  return listings.filter((listing) => {
    const category = findCategory(categories, listing.category_id);
    const rent = getNumericRent(listing);
    const listingLocation = normalizeText(listing.location);
    const listingArea = normalizeText(listing.area);
    const haystack = [
      listing.title,
      listing.description,
      listing.location,
      listing.area,
      category?.name,
      getListingContactName(listing),
    ]
      .filter(Boolean)
      .join(" ");

    const matchesSearch = !search || normalizeText(haystack).includes(search);
    const matchesCategory = !filters.category || listing.category_id === filters.category;
    const matchesLocation = !location || listingLocation.includes(location);
    const matchesArea = !area || listingArea.includes(area);
    const matchesMinRent = minRent === null || (rent !== null && rent >= minRent);
    const matchesMaxRent = maxRent === null || (rent !== null && rent <= maxRent);
    const matchesFurnished =
      !filters.furnished ||
      (filters.furnished === "furnished" && listing.is_furnished === true) ||
      (filters.furnished === "unfurnished" && listing.is_furnished === false);
    const matchesAvailableNow = !filters.availableNow || isAvailableNow(listing, today);
    const matchesAvailableBy =
      !filters.availableBy || isAvailableBy(listing, filters.availableBy);
    const matchesFee =
      !filters.fee ||
      (filters.fee === "no-agent-fee" && hasNoAgentFee(listing)) ||
      (filters.fee === "agent-fee" && hasAgentFee(listing));

    return (
      matchesSearch &&
      matchesCategory &&
      matchesLocation &&
      matchesArea &&
      matchesMinRent &&
      matchesMaxRent &&
      matchesFurnished &&
      matchesAvailableNow &&
      matchesAvailableBy &&
      matchesFee
    );
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
              <p>${escapeHtml(category.description || "Browse available published rooms in this category.")}</p>
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
  const location = getListingLocationLabel(listing);
  const terms = getListingTerms(listing);

  return `
    <a class="listing-card" href="/listings/${encodeURIComponent(listing.id)}" data-link>
      <div class="listing-image">
        ${
          image
            ? `<img src="${escapeAttr(image.url)}" alt="${escapeAttr(listing.title)}" loading="lazy" />`
            : `<span>No cover image yet</span>`
        }
      </div>
      <div class="listing-body">
        <div class="badge-row">
          <span class="badge">${escapeHtml(category?.name || "Room")}</span>
          ${renderOptionalBadge(getFurnishedBadgeLabel(listing))}
        </div>
        <h3>${escapeHtml(listing.title)}</h3>
        <div class="price-row">
          <div class="price">${formatPrice(getListingRentAmount(listing), listing.currency)}</div>
          <span class="price-suffix">per month</span>
        </div>
        <dl class="fact-list compact">
          ${renderFactRow("Location", location)}
          ${renderFactRow("Availability", getAvailabilityLabel(listing))}
          ${renderFactRow("Rental terms", `${terms.deposit} · ${terms.agentFee}`)}
        </dl>
      </div>
    </a>
  `;
}

function renderOwnerListingCards(listings, categories) {
  return `
    <div class="dashboard-card-grid">
      ${listings.map((listing) => renderOwnerListingCard(listing, categories)).join("")}
    </div>
  `;
}

function renderOwnerListingCard(listing, categories) {
  const category = findCategory(categories, listing.category_id);
  const image = getCoverImage(listing);
  const status = getListingStatusMeta(listing.status);
  const canViewPublic = listing.status === "published";

  return `
    <article class="dashboard-card">
      <div class="dashboard-card-image">
        ${
          image
            ? `<img src="${escapeAttr(image.url)}" alt="${escapeAttr(listing.title)}" loading="lazy" />`
            : `<span>No cover image yet</span>`
        }
      </div>
      <div class="dashboard-card-body">
        <div class="dashboard-card-header">
          <span class="status-pill" data-status="${escapeAttr(status.tone)}">${escapeHtml(status.label)}</span>
          <span class="dashboard-meta">${escapeHtml(category?.name || "Room")}</span>
        </div>
        <h3>${escapeHtml(listing.title)}</h3>
        <div class="price-row">
          <div class="price">${formatPrice(getListingRentAmount(listing), listing.currency)}</div>
          <span class="price-suffix">per month</span>
        </div>
        <dl class="fact-list compact">
          ${renderFactRow("Location", getListingLocationLabel(listing))}
          ${renderFactRow("Available", getAvailabilityLabel(listing))}
          ${renderFactRow("Deposit", getListingTerms(listing).deposit)}
        </dl>
        <div class="dashboard-actions">
          ${
            canViewPublic
              ? `<a class="button button-secondary" href="/listings/${encodeURIComponent(listing.id)}" data-link>View</a>`
              : `<span class="button button-ghost" aria-disabled="true">Private</span>`
          }
          <a class="button button-secondary" href="/dashboard/listings/${encodeURIComponent(listing.id)}/edit" data-link>Edit</a>
          ${
            listing.status === "published"
              ? `<button type="button" class="button button-secondary" data-listing-id="${escapeAttr(listing.id)}" data-listing-status="unpublished">Unpublish</button>`
              : `<button type="button" class="button" data-listing-id="${escapeAttr(listing.id)}" data-listing-status="published">Publish</button>`
          }
          <button type="button" class="button button-danger" data-delete-listing data-listing-id="${escapeAttr(listing.id)}">Delete</button>
        </div>
      </div>
    </article>
  `;
}

function renderOwnerEnquiryCards(enquiries) {
  return `
    <div class="dashboard-card-grid enquiry-grid">
      ${enquiries.map((enquiry) => renderOwnerEnquiryCard(enquiry)).join("")}
    </div>
  `;
}

function renderOwnerEnquiryCard(enquiry) {
  return `
    <article class="dashboard-card enquiry-card">
      <div class="dashboard-card-body">
        <div class="dashboard-card-header">
          <span class="status-pill" data-status="${enquiry.is_viewing_requested ? "published" : "draft"}">
            ${enquiry.is_viewing_requested ? "Viewing requested" : "Room enquiry"}
          </span>
          <span class="dashboard-meta">${escapeHtml(formatDateTime(enquiry.created_at))}</span>
        </div>
        <h3>${escapeHtml(enquiry.listing?.title || "Room listing")}</h3>
        <dl class="fact-list">
          ${renderFactRow("Renter", enquiry.name || "Not provided")}
          ${renderFactRow("Email", enquiry.email || "Not provided")}
          ${renderFactRow("Phone", enquiry.phone || "Not provided")}
          ${renderFactRow("Occupants", getOccupancyLabel(enquiry.occupant_count))}
          ${renderFactRow("Move-in", enquiry.desired_move_in_date ? formatDate(enquiry.desired_move_in_date) : "Not specified")}
          ${
            enquiry.is_viewing_requested
              ? renderFactRow(
                  "Viewing",
                  [enquiry.preferred_viewing_date ? formatDate(enquiry.preferred_viewing_date) : "", enquiry.preferred_viewing_time || ""]
                    .filter(Boolean)
                    .join(" at ") || "Requested",
                )
              : ""
          }
        </dl>
        <p class="enquiry-message">${escapeHtml(enquiry.message || "")}</p>
      </div>
    </article>
  `;
}

function renderImageGallery(images) {
  return `
    <div class="image-gallery">
      ${images
        .map(
          (image) => `
            <figure class="image-tile">
              <img src="${escapeAttr(image.url)}" alt="Listing image" loading="lazy" />
              <figcaption>
                <span>${image.is_cover ? "Cover image" : `Display order ${image.display_order}`}</span>
              </figcaption>
            </figure>
          `,
        )
        .join("")}
    </div>
  `;
}

function renderDashboardMetric(label, value) {
  return `
    <div class="summary-card dashboard-metric">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(String(value))}</strong>
    </div>
  `;
}

function renderStatusOptions(selectedStatus) {
  return ["draft", "published", "unpublished"]
    .map((status) => {
      const meta = getListingStatusMeta(status);
      return `<option value="${status}" ${status === selectedStatus ? "selected" : ""}>${escapeHtml(meta.label)}</option>`;
    })
    .join("");
}

function renderTriStateOptions(value, emptyLabel) {
  return `
    <option value="">${escapeHtml(emptyLabel)}</option>
    <option value="true" ${value === true ? "selected" : ""}>Yes</option>
    <option value="false" ${value === false ? "selected" : ""}>No</option>
  `;
}

function getListingContactName(listing) {
  return listing.owner_name || listing.provider_name || "";
}

function getListingLocationLabel(listing) {
  return [listing.area, listing.location].filter(Boolean).join(", ") || "Location not specified";
}

function getListingRentAmount(listing) {
  return listing.rent_amount ?? listing.price;
}

function getListingTerms(listing) {
  return {
    deposit: listing.deposit_amount
      ? formatPrice(listing.deposit_amount, listing.currency)
      : "Deposit not specified",
    agentFee: getAgentFeeLabel(listing),
  };
}

function getAgentFeeLabel(listing) {
  const fee = parseNumber(listing.agent_fee);
  if (fee === null) return "Agent fee not specified";
  if (fee <= 0) return "No agent fee";
  return formatPrice(listing.agent_fee, listing.currency);
}

function getFurnishedLabel(listing) {
  if (listing.is_furnished === true) return "Furnished";
  if (listing.is_furnished === false) return "Unfurnished";
  return "Furnishing not specified";
}

function getFurnishedBadgeLabel(listing) {
  if (listing.is_furnished === true) return "Furnished";
  if (listing.is_furnished === false) return "Unfurnished";
  return "";
}

function getOccupancyLabel(value) {
  if (!value) return "Not specified";
  return value === 1 ? "1 person" : `${value} people`;
}

function getAvailabilityLabel(listing) {
  if (!listing.available_date) return "Date on request";
  if (isAvailableNow(listing, getTodayIsoDate())) return "Available now";
  return `Available ${formatDate(listing.available_date)}`;
}

function hasAgentFee(listing) {
  const fee = parseNumber(listing.agent_fee);
  return fee !== null && fee > 0;
}

function hasNoAgentFee(listing) {
  const fee = parseNumber(listing.agent_fee);
  return fee !== null && fee <= 0;
}

function isAvailableNow(listing, today = getTodayIsoDate()) {
  return Boolean(listing.available_date) && listing.available_date <= today;
}

function isAvailableBy(listing, targetDate) {
  return Boolean(listing.available_date) && listing.available_date <= targetDate;
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
    await requestJson(`/listings/${encodeURIComponent(listingId)}/enquiries`, {
      method: "POST",
      json: payload,
      auth: false,
    });
    form.reset();
    syncViewingFields(form);
    setFormFeedback(
      form,
      "Your enquiry has been sent. The landlord or agent can contact you to confirm availability or arrange a viewing.",
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
    submitButton.textContent = "Send enquiry";
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

  const isWhole = Math.abs(amount % 1) < Number.EPSILON;
  return new Intl.NumberFormat("en-ZA", {
    style: "currency",
    currency,
    minimumFractionDigits: isWhole ? 0 : 2,
    maximumFractionDigits: isWhole ? 0 : 2,
  }).format(amount);
}

function formatDate(value) {
  if (!value) return "Date on request";
  const date = new Date(`${value}T00:00:00`);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
  }).format(date);
}

function formatDateTime(value) {
  if (!value) return "Date unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat("en-ZA", {
    day: "numeric",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function renderSummaryCard(label, value) {
  return `
    <div class="summary-card">
      <span>${escapeHtml(label)}</span>
      <strong>${escapeHtml(value)}</strong>
    </div>
  `;
}

function renderFactRow(label, value) {
  return `
    <div class="fact-row">
      <dt>${escapeHtml(label)}</dt>
      <dd>${escapeHtml(value)}</dd>
    </div>
  `;
}

function renderOptionalBadge(value) {
  return value ? `<span class="badge badge-muted">${escapeHtml(value)}</span>` : "";
}

function getBooleanLabel(value, trueLabel, falseLabel) {
  if (value === true) return trueLabel;
  if (value === false) return falseLabel;
  return "Not specified";
}

function countActiveFilters(filters) {
  return Object.values(filters).filter((value) => {
    if (typeof value === "boolean") return value;
    return Boolean(value);
  }).length;
}

function normalizeText(value) {
  return String(value || "").trim().toLowerCase();
}

function parseNumber(value) {
  const raw = String(value ?? "").trim();
  if (!raw) return null;
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function getNumericRent(listing) {
  return parseNumber(getListingRentAmount(listing));
}

function getTodayIsoDate() {
  const today = new Date();
  const year = today.getFullYear();
  const month = String(today.getMonth() + 1).padStart(2, "0");
  const day = String(today.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function loadingState(message) {
  return `<section class="state"><div class="loading-state">${escapeHtml(message)}</div></section>`;
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
  const path = browserWindow.location.pathname;
  browserDocument.querySelectorAll(".nav-links a").forEach((link) => {
    const href = link.getAttribute("href");
    const isActive =
      href === "/"
        ? path === "/"
        : href === "/dashboard"
          ? path.startsWith("/dashboard")
          : path.startsWith(href);
    link.toggleAttribute("aria-current", isActive);
  });
}

function normalizePath(pathname) {
  return pathname && pathname !== "" ? pathname : "/";
}

function requiredString(value) {
  return String(value ?? "").trim();
}

function optionalString(value) {
  const normalized = String(value ?? "").trim();
  return normalized || null;
}

function normalizeDecimal(value) {
  const normalized = optionalString(value);
  return normalized === null ? null : normalized;
}

function parseNullableInteger(value) {
  const normalized = optionalString(value);
  if (normalized === null) return null;
  const parsed = Number.parseInt(normalized, 10);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseNullableBoolean(value) {
  if (value === true || value === false) return value;
  if (value === "true") return true;
  if (value === "false") return false;
  return null;
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
