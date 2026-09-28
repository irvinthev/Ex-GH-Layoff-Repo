function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function renderPeopleStories(stories) {
  const grid = document.getElementById("peopleStoriesGrid");
  if (!grid) return;

  grid.innerHTML = "";

  const published = stories.filter((story) => story.published !== false);

  if (!published.length) {
    grid.innerHTML = '<div class="empty-state">More stories coming soon.</div>';
    return;
  }

  published.forEach((story) => {
    const card = document.createElement("article");
    card.className = "people-story-card";

    const tags = Array.isArray(story.tags) ? story.tags : [];
    const linkedin = story.linkedin_url
      ? `<a class="resource-link" href="${escapeHtml(story.linkedin_url)}" target="_blank" rel="noopener noreferrer">View on LinkedIn →</a>`
      : "";

    card.innerHTML = `
      <div class="people-story-card-top">
        <span class="resource-series">${escapeHtml(story.series || "People Behind the Network")}</span>
        <h3>${escapeHtml(story.name)}</h3>
        <p class="people-story-role">${escapeHtml(story.headline || "")}</p>
      </div>

      <p class="people-story-hook">${escapeHtml(story.hook || "")}</p>
      <p class="people-story-summary">${escapeHtml(story.summary || "")}</p>

      ${tags.length ? `
        <div class="people-story-tags">
          ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
        </div>
      ` : ""}

      <div class="people-story-actions">
        ${linkedin}
      </div>
    `;

    grid.appendChild(card);
  });
}

function formatDate(dateString) {
  if (!dateString) {
    return "";
  }

  const date = new Date(`${dateString}T00:00:00`);

  if (Number.isNaN(date.getTime())) {
    return dateString;
  }

  return date.toLocaleDateString(
    "en-US",
    {
      year: "numeric",
      month: "short",
      day: "numeric"
    }
  );
}

function parsePostDate(dateString) {
  if (!dateString) {
    return null;
  }

  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function comparePostsByDateDesc(a, b) {
  const aTimestamp = parsePostDate(a.date);
  const bTimestamp = parsePostDate(b.date);

  if (aTimestamp === null && bTimestamp === null) {
    return 0;
  }

  if (aTimestamp === null) {
    return 1;
  }

  if (bTimestamp === null) {
    return -1;
  }

  return bTimestamp - aTimestamp;
}

function getResourceLinkLabel(post) {
  let hostname = "";

  try {
    hostname = post.url
      ? new URL(post.url).hostname.toLowerCase()
      : "";
  } catch {
    hostname = "";
  }

  const matchesHostname = (domain) =>
  hostname === domain || hostname.endsWith(`.${domain}`);

  if (post.format === "video") {
  if (
    matchesHostname("youtube.com") ||
    matchesHostname("youtu.be")
  ) {
    return "Watch on YouTube →";
  }

    return "Watch video →";
  }

  if (
    matchesHostname("linkedin.com")
  ) {
    return "Read on LinkedIn →";
  }

  return "Open resource →";
}

async function loadResources() {
  const [postsResponse, storiesResponse] = await Promise.all([
    fetch("./posts.json"),
    fetch("./people-stories.json")
  ]);

  if (!postsResponse.ok) {
    throw new Error(
      `Failed to load posts.json: ${postsResponse.status}`
    );
  }

  if (!storiesResponse.ok) {
    throw new Error(
      `Failed to load people-stories.json: ${storiesResponse.status}`
    );
  }

  const posts = await postsResponse.json();
  const stories = await storiesResponse.json();

  renderPeopleStories(stories);

  const grid = document.getElementById("resourceGrid");
  const filters = document.getElementById("resourceFilters");

  let activeCategory = "All";


  /* =====================
     CATEGORIES
  ===================== */

  function getCategories() {
    return [
      "All",
      ...new Set(
        posts
          .map((post) => post.category)
          .filter(Boolean)
      )
    ];
  }


  /* =====================
     FILTER BUTTONS
  ===================== */

  function renderFilters() {
    filters.innerHTML = "";

    getCategories().forEach(
      (category) => {
        const button = document.createElement("button");

        button.type = "button";

        button.className =
          `resource-filter-btn ${
            activeCategory === category
              ? "active"
              : ""
          }`;

        button.textContent = category;

        button.onclick = () => {
          activeCategory = category;

          renderFilters();
          renderPosts();
        };

        filters.appendChild(button);
      }
    );
  }


  /* =====================
     RESOURCE CARDS
  ===================== */

  function renderPosts() {
    grid.innerHTML = "";

    const filtered =
      activeCategory === "All"
        ? posts
        : posts.filter(
            (post) =>
              post.category === activeCategory
          );

    const sorted = [...filtered].sort(comparePostsByDateDesc);

    if (!sorted.length) {
      grid.innerHTML = `
        <div class="empty-state">
          No resources found.
        </div>
      `;

      return;
    }

    sorted.forEach(
      (post) => {
        const card = document.createElement("article");

        card.className =
          post.featured
            ? "resource-card featured"
            : "resource-card";

        const validUrl =
          post.url &&
          !post.url.includes("PASTE_");

        card.innerHTML = `
          <div class="resource-card-top">

            <span class="resource-series">
              ${post.series || "Resource"}
            </span>

            ${
              post.category
                ? `
                  <span class="resource-category">
                    ${post.category}
                  </span>
                `
                : ""
            }

          </div>

          <h3>
            ${post.title}
          </h3>

          <p class="resource-description">
            ${post.description || ""}
          </p>

          ${
            post.date
              ? `
                <p class="resource-date">
                  ${formatDate(post.date)}
                </p>
              `
              : ""
          }

          ${
            validUrl
              ? `
                <a
                  class="resource-link"
                  href="${post.url}"
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  ${getResourceLinkLabel(post)}
                </a>
              `
              : `
                <span class="resource-link resource-link-pending">
                  Coming soon
                </span>
              `
          }

        `;

        grid.appendChild(card);
      }
    );
  }


  /* =====================
     INITIAL LOAD
  ===================== */

  renderFilters();
  renderPosts();
}


if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    comparePostsByDateDesc,
    formatDate,
    getResourceLinkLabel,
  };
}


/* =====================
   ERROR HANDLING
===================== */

if (typeof document !== "undefined") {
  loadResources().catch(
    (error) => {
      console.error(
        "Failed to load resources:",
        error
      );

      const grid = document.getElementById("resourceGrid");

      if (grid) {
        grid.innerHTML = `
          <div class="empty-state">
            Resources could not be loaded.
          </div>
        `;
      }
    }
  );
}