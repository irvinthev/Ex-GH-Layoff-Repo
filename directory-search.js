(function (root) {
  "use strict";

  function normalize(value) {
    return String(value || "").toLowerCase()
      .replace(/\bsr\b\.?/g, "senior")
      .replace(/\bjr\b\.?/g, "junior")
      .replace(/\s+/g, " ").trim();
  }

  function matches(query, fields) {
    const terms = Array.from(String(query || "").matchAll(/"([^"]+)"|(\S+)/g),
      match => normalize(match[1] || match[2])).filter(Boolean);
    const text = normalize(fields.join(" "));
    return terms.every(term => text.includes(term));
  }

  const api = { matches };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else root.DirectorySearch = api;
})(typeof globalThis !== "undefined" ? globalThis : this);
