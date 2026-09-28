function escapeHtml(value) {
  return String(value || "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function getYouTubeVideoId(url) {
  if (!url) return "";

  try {
    const parsed = new URL(url);
    const host = parsed.hostname.toLowerCase();

    if (host === "youtu.be" || host.endsWith(".youtu.be")) {
      return parsed.pathname.split("/").filter(Boolean)[0] || "";
    }

    if (host === "youtube.com" || host.endsWith(".youtube.com")) {
      if (parsed.pathname === "/watch") {
        return parsed.searchParams.get("v") || "";
      }

      const parts = parsed.pathname.split("/").filter(Boolean);
      const markerIndex = parts.findIndex((part) =>
        ["embed", "shorts", "live"].includes(part)
      );

      if (markerIndex >= 0 && parts[markerIndex + 1]) {
        return parts[markerIndex + 1];
      }
    }
  } catch {
    return "";
  }

  return "";
}

function getYouTubeThumbnail(url) {
  const videoId = getYouTubeVideoId(url);
  return videoId
    ? `https://i.ytimg.com/vi/${encodeURIComponent(videoId)}/hqdefault.jpg`
    : "";
}

function storyCardMarkup(story) {
  const tags = Array.isArray(story.tags) ? story.tags : [];

  let actions = "";

  if (story.directory_url) {
    actions += `<a class="resource-link story-primary-link" href="${escapeHtml(story.directory_url)}">View in Talent Directory →</a>`;
  } else if (story.linkedin_url) {
    actions += `<a class="resource-link story-primary-link" href="${escapeHtml(story.linkedin_url)}" target="_blank" rel="noopener noreferrer">View on LinkedIn →</a>`;
  }

  return `
    <div class="people-story-card-top">
      <span class="resource-series">${escapeHtml(story.series || "People Behind the Spreadsheet")}</span>
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

    ${actions ? `
      <div class="people-story-actions">
        ${actions}
      </div>
    ` : ""}
  `;
}

function renderPeopleStories(stories) {
  const grid = document.getElementById("peopleStoriesGrid");
  if (!grid) return;

  const published = stories.filter((story) => story.published !== false);

  grid.innerHTML = "";

  if (!published.length) {
    grid.innerHTML = '<div class="empty-state">More stories coming soon.</div>';
    return;
  }

  published.forEach((story) => {
    const card = document.createElement("article");
    card.className = "people-story-card";
    card.innerHTML = storyCardMarkup(story);
    grid.appendChild(card);
  });
}

function formatDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    year: "numeric",
    month: "short",
    day: "numeric"
  });
}

function parsePostDate(dateString) {
  if (!dateString) return null;
  const date = new Date(`${dateString}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function comparePostsByDateDesc(a, b) {
  const aTimestamp = parsePostDate(a.date);
  const bTimestamp = parsePostDate(b.date);

  if (aTimestamp === null && bTimestamp === null) return 0;
  if (aTimestamp === null) return 1;
  if (bTimestamp === null) return -1;

  return bTimestamp - aTimestamp;
}

function getResourceLinkLabel(post) {
  let hostname = "";

  try {
    hostname = post.url ? new URL(post.url).hostname.toLowerCase() : "";
  } catch {
    hostname = "";
  }

  const matchesHostname = (domain) =>
    hostname === domain || hostname.endsWith(`.${domain}`);

  if (post.format === "video") {
    if (matchesHostname("youtube.com") || matchesHostname("youtu.be")) {
      return "Watch on YouTube →";
    }
    return "Watch video →";
  }

  if (matchesHostname("linkedin.com")) {
    return "Read on LinkedIn →";
  }

  return "Open resource →";
}

function renderResourceLibrary(posts) {
  const grid = document.getElementById("resourceGrid");
  const filters = document.getElementById("resourceFilters");
  if (!grid || !filters) return;

  const pageSection = document.body.classList.contains("layoff-guide")
    ? "playbook"
    : "spotlight";

  const scopedPosts = posts.filter((post) =>
    !post.section || post.section === pageSection
  );

  let activeCategory = "All";

  function getCategories() {
    return [
      "All",
      ...new Set(scopedPosts.map((post) => post.category).filter(Boolean))
    ];
  }

  function renderFilters() {
    filters.innerHTML = "";

    getCategories().forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `resource-filter-btn ${activeCategory === category ? "active" : ""}`;
      button.textContent = category;

      button.onclick = () => {
        activeCategory = category;
        renderFilters();
        renderPosts();
      };

      filters.appendChild(button);
    });
  }

  function renderPosts() {
    grid.innerHTML = "";

    const filtered = activeCategory === "All"
      ? scopedPosts
      : scopedPosts.filter((post) => post.category === activeCategory);

    const sorted = [...filtered].sort(comparePostsByDateDesc);

    if (!sorted.length) {
      grid.innerHTML = '<div class="empty-state">No resources found.</div>';
      return;
    }

    sorted.forEach((post) => {
      const card = document.createElement("article");
      card.className = post.featured ? "resource-card featured" : "resource-card";

      const validUrl = post.url && !post.url.includes("PASTE_");

      card.innerHTML = `
        <div class="resource-card-top">
          <span class="resource-series">${escapeHtml(post.series || "Resource")}</span>
          ${post.category ? `<span class="resource-category">${escapeHtml(post.category)}</span>` : ""}
        </div>

        <h3>${escapeHtml(post.title)}</h3>
        <p class="resource-description">${escapeHtml(post.description || "")}</p>

        ${post.date ? `<p class="resource-date">${formatDate(post.date)}</p>` : ""}

        ${validUrl
          ? `<a class="resource-link" href="${escapeHtml(post.url)}" target="_blank" rel="noopener noreferrer">${getResourceLinkLabel(post)}</a>`
          : '<span class="resource-link resource-link-pending">Coming soon</span>'
        }
      `;

      grid.appendChild(card);
    });
  }

  renderFilters();
  renderPosts();
}

async function loadResources() {
  const peopleGrid = document.getElementById("peopleStoriesGrid");
  const resourceGrid = document.getElementById("resourceGrid");

  const jobs = [];

  if (peopleGrid) {
    jobs.push(
      fetch("./people-stories.json?v=2")
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to load people-stories.json: ${response.status}`);
          return response.json();
        })
        .then(renderPeopleStories)
    );
  }

  if (resourceGrid) {
    jobs.push(
      fetch("./posts.json")
        .then((response) => {
          if (!response.ok) throw new Error(`Failed to load posts.json: ${response.status}`);
          return response.json();
        })
        .then(renderResourceLibrary)
    );
  }

  await Promise.all(jobs);
}

if (typeof module !== "undefined" && module.exports) {
  module.exports = {
    comparePostsByDateDesc,
    formatDate,
    getResourceLinkLabel,
    getYouTubeVideoId
  };
}

if (typeof document !== "undefined") {
  loadResources().catch((error) => {
    console.error("Failed to load page resources:", error);

    const peopleGrid = document.getElementById("peopleStoriesGrid");
    const resourceGrid = document.getElementById("resourceGrid");

    if (peopleGrid && !peopleGrid.children.length) {
      peopleGrid.innerHTML = '<div class="empty-state">Stories could not be loaded.</div>';
    }

    if (resourceGrid && !resourceGrid.children.length) {
      resourceGrid.innerHTML = '<div class="empty-state">Resources could not be loaded.</div>';
    }
  });
}
