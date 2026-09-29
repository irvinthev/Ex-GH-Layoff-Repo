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

function formatStoryDate(dateString) {
  if (!dateString) return "";

  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return dateString;

  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  });
}

function getWeekStart(dateString) {
  const date = new Date(`${dateString}T00:00:00`);
  if (Number.isNaN(date.getTime())) return "";

  const day = date.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  date.setDate(date.getDate() + diff);

  return date.toISOString().slice(0, 10);
}

function formatWeekLabel(weekStart) {
  if (!weekStart) return "Undated";

  const date = new Date(`${weekStart}T00:00:00`);
  if (Number.isNaN(date.getTime())) return weekStart;

  return `Week of ${date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric"
  })}`;
}

function storyCardMarkup(story, expanded = false) {
  const tags = Array.isArray(story.tags) ? story.tags : [];
  const firstName = String(story.name || "").trim().split(/\s+/)[0] || "them";
  const hasSections = Array.isArray(story.story_sections) && story.story_sections.length;

  let actions = "";

  if (story.directory_url) {
    actions += `<a class="resource-link story-primary-link" href="${escapeHtml(story.directory_url)}">View in Talent Directory →</a>`;
  }

  if (story.linkedin_url) {
    actions += `<a class="resource-link" href="${escapeHtml(story.linkedin_url)}" target="_blank" rel="noopener noreferrer">Connect with ${escapeHtml(firstName)} on LinkedIn →</a>`;
  }

  const body = hasSections
    ? `
      <div class="people-story-sections">
        ${story.story_sections.map((section) => `
          <section class="people-story-section">
            <h4>${escapeHtml(section.label || "")}</h4>
            <p>${escapeHtml(section.text || "")}</p>
          </section>
        `).join("")}
      </div>
    `
    : `<p class="people-story-summary">${escapeHtml(story.summary || "")}</p>`;

  return `
    <div class="people-story-card-top">
      <div>
        <span class="resource-series">${escapeHtml(story.series || "People Behind the Spreadsheet")}</span>
        <h3>${escapeHtml(story.name)}</h3>
        <p class="people-story-role">${escapeHtml(story.headline || "")}</p>
      </div>
      ${story.published_date ? `<time class="people-story-date" datetime="${escapeHtml(story.published_date)}">${escapeHtml(formatStoryDate(story.published_date))}</time>` : ""}
    </div>

    <p class="people-story-hook">${escapeHtml(story.hook || "")}</p>

    ${tags.length ? `
      <div class="people-story-tags">
        ${tags.map((tag) => `<span>${escapeHtml(tag)}</span>`).join("")}
      </div>
    ` : ""}

    <div class="people-story-preview">
      ${hasSections
        ? `<p>${escapeHtml(story.story_sections[0]?.text || story.summary || "")}</p>`
        : `<p>${escapeHtml(story.summary || "")}</p>`
      }
    </div>

    <button
      class="people-story-toggle"
      type="button"
      aria-expanded="${expanded ? "true" : "false"}"
    >
      ${expanded ? "Show less ↑" : "Read full story ↓"}
    </button>

    <div class="people-story-expanded"${expanded ? "" : " hidden"}>
      ${body}

      ${actions ? `
        <div class="people-story-actions">
          ${actions}
        </div>
      ` : ""}
    </div>
  `;
}

function renderPeopleStories(stories) {
  const grid = document.getElementById("peopleStoriesGrid");
  const selector = document.getElementById("spotlightWeekSelector");
  const heading = document.getElementById("spotlightWeekHeading");
  const count = document.getElementById("spotlightWeekCount");

  if (!grid) return;

  const params = new URLSearchParams(window.location.search);
  const requestedStory = (params.get("story") || "").trim();
  const requestedPreview = (params.get("preview") || "").trim();
  const requestedWeek = (params.get("week") || "").trim();

  const previewStory = requestedPreview
    ? stories.find((story) =>
        story.slug === requestedPreview &&
        story.preview === true &&
        story.published === false
      )
    : null;

  if (previewStory) {
    let robots = document.querySelector('meta[name="robots"]');
    if (!robots) {
      robots = document.createElement("meta");
      robots.setAttribute("name", "robots");
      document.head.appendChild(robots);
    }
    robots.setAttribute("content", "noindex, nofollow, noarchive");
    document.title = `Preview: ${previewStory.name} | TalentBot HQ`;
  }

  const published = stories
    .filter((story) => story.published !== false)
    .filter((story) => story.published_date)
    .sort((a, b) => String(b.published_date).localeCompare(String(a.published_date)));

  const visibleStories = previewStory ? [previewStory] : published;

  if (!visibleStories.length) {
    grid.innerHTML = '<div class="empty-state">More stories coming soon.</div>';
    return;
  }

  const weekMap = new Map();

  visibleStories.forEach((story) => {
    const week = getWeekStart(story.published_date);
    if (!weekMap.has(week)) weekMap.set(week, []);
    weekMap.get(week).push(story);
  });

  const weeks = [...weekMap.keys()].sort((a, b) => b.localeCompare(a));
  const latestWeek = weeks[0];
  let activeWeek = weeks.includes(requestedWeek) ? requestedWeek : latestWeek;

  if (requestedStory && !previewStory) {
    const story = published.find((item) => item.slug === requestedStory);
    if (story) activeWeek = getWeekStart(story.published_date);
  }

  if (previewStory) {
    activeWeek = getWeekStart(previewStory.published_date);
  }

  function setUrl(activeWeekValue, storySlug = "") {
    const url = new URL(window.location.href);
    url.searchParams.set("week", activeWeekValue);

    if (storySlug) {
      url.searchParams.set("story", storySlug);
    } else {
      url.searchParams.delete("story");
    }

    window.history.replaceState({}, "", url);
  }

  function renderWeekSelector() {
    if (!selector) return;

    selector.innerHTML = "";

    weeks.forEach((week, index) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `spotlight-week-btn ${activeWeek === week ? "active" : ""}`;
      button.textContent = index === 0 ? "Latest" : formatWeekLabel(week).replace("Week of ", "");
      button.setAttribute("aria-pressed", activeWeek === week ? "true" : "false");

      button.onclick = () => {
        activeWeek = week;
        setUrl(activeWeek);
        renderWeekSelector();
        renderWeek();
      };

      selector.appendChild(button);
    });
  }

  function renderWeek() {
    const weekStories = weekMap.get(activeWeek) || [];

    if (heading) heading.textContent = formatWeekLabel(activeWeek);
    if (count) {
      count.textContent = `${weekStories.length} stor${weekStories.length === 1 ? "y" : "ies"} this week`;
    }

    grid.innerHTML = "";

    weekStories.forEach((story) => {
      const autoExpanded = previewStory
        ? story.slug === previewStory.slug
        : requestedStory && story.slug === requestedStory;
      const card = document.createElement("article");
      card.className = "people-story-card";
      card.dataset.storySlug = story.slug || "";
      card.innerHTML = `
        ${previewStory && story.slug === previewStory.slug ? `
          <div class="people-story-preview-notice" role="note">
            <strong>PREVIEW — NOT YET PUBLISHED</strong>
            <span>This story is in review and is not part of the public Spotlight series yet.</span>
          </div>
        ` : ""}
        ${storyCardMarkup(story, autoExpanded)}
      `;

      const toggle = card.querySelector(".people-story-toggle");
      const expanded = card.querySelector(".people-story-expanded");
      const preview = card.querySelector(".people-story-preview");

      if (autoExpanded) {
        card.classList.add("expanded");
        preview.hidden = true;
      }

      toggle.onclick = () => {
        const isExpanded = card.classList.toggle("expanded");
        toggle.setAttribute("aria-expanded", isExpanded ? "true" : "false");
        toggle.textContent = isExpanded ? "Show less ↑" : "Read full story ↓";
        expanded.hidden = !isExpanded;
        preview.hidden = isExpanded;

        if (!previewStory) {
          setUrl(activeWeek, isExpanded ? story.slug || "" : "");
        }
      };

      grid.appendChild(card);

      if (autoExpanded) {
        requestAnimationFrame(() => {
          card.scrollIntoView({ behavior: "smooth", block: "start" });
        });
      }
    });
  }

  renderWeekSelector();
  renderWeek();
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
      fetch("./people-stories.json?v=3")
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
