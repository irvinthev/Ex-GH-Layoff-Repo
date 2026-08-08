async function loadResources() {
  const response = await fetch("./posts.json");

  if (!response.ok) {
    throw new Error(
      `Failed to load posts.json: ${response.status}`
    );
  }

  const posts = await response.json();

  const grid = document.getElementById("resourceGrid");
  const filters = document.getElementById("resourceFilters");

  let activeCategory = "All";


  /* =====================
     DATE
  ===================== */

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

    const sorted = [...filtered].sort(
      (a, b) =>
        new Date(b.date) - new Date(a.date)
    );

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
                  Read on LinkedIn →
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


/* =====================
   ERROR HANDLING
===================== */

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