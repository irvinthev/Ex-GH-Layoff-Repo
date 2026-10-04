/**
 * TalentBot HQ analytics
 *
 * Observational only. No site feature depends on this file or any analytics provider.
 * Provider failures are swallowed so directory/search/navigation/form flows continue.
 */
(function () {
  "use strict";

  const config = window.TALENT_ANALYTICS_CONFIG || {};
  const state = {
    gaReady: false
  };

  function safeRun(fn) {
    try {
      fn();
    } catch (error) {
      console.debug("[analytics] ignored error:", error);
    }
  }

  function loadGoogleAnalytics(measurementId) {
    if (!/^G-[A-Z0-9]+$/i.test(String(measurementId || "").trim())) return;

    safeRun(() => {
      window.dataLayer = window.dataLayer || [];
      window.gtag = window.gtag || function () {
        window.dataLayer.push(arguments);
      };

      window.gtag("js", new Date());
      window.gtag("config", measurementId, {
        anonymize_ip: true
      });

      const script = document.createElement("script");
      script.async = true;
      script.src = "https://www.googletagmanager.com/gtag/js?id=" +
        encodeURIComponent(measurementId);
      script.onerror = function () {
        console.debug("[analytics] Google Analytics unavailable");
      };
      document.head.appendChild(script);

      state.gaReady = true;
    });
  }

  function loadCloudflareWebAnalytics(token) {
    const cleanToken = String(token || "").trim();
    if (!cleanToken) return;

    safeRun(() => {
      const script = document.createElement("script");
      script.defer = true;
      script.src = "https://static.cloudflareinsights.com/beacon.min.js";
      script.setAttribute("data-cf-beacon", JSON.stringify({ token: cleanToken }));
      script.onerror = function () {
        console.debug("[analytics] Cloudflare Web Analytics unavailable");
      };
      document.head.appendChild(script);
    });
  }

  function trackEvent(name, params) {
    safeRun(() => {
      if (state.gaReady && typeof window.gtag === "function") {
        window.gtag("event", name, params || {});
      }
    });
  }

  function classifyOutboundLink(anchor) {
    const href = anchor && anchor.href ? anchor.href : "";
    if (!href) return null;

    if (/linkedin\.com/i.test(href)) return "linkedin";
    if (/docs\.google\.com\/forms/i.test(href)) return "google_form";
    if (/youtube\.com|youtu\.be/i.test(href)) return "youtube";
    if (/linkedin\.com\/newsletters/i.test(href)) return "linkedin_newsletter";

    return null;
  }

  function bindClickTracking() {
    document.addEventListener("click", function (event) {
      const anchor = event.target.closest && event.target.closest("a");
      if (!anchor) return;

      const outboundType = classifyOutboundLink(anchor);

      if (outboundType === "linkedin") {
        trackEvent("linkedin_click", {
          source_page: window.location.pathname
        });
      }

      if (outboundType === "google_form") {
        const text = (anchor.textContent || "").trim().toLowerCase();
        let formAction = "form_click";

        if (text.includes("share an open role")) formAction = "share_role_click";
        else if (text.includes("join")) formAction = "join_directory_click";
        else if (text.includes("update") || text.includes("remove")) {
          formAction = "profile_update_click";
        }

        trackEvent(formAction, {
          source_page: window.location.pathname
        });
      }

      if (outboundType === "youtube") {
        trackEvent("video_click", {
          source_page: window.location.pathname
        });
      }
    });
  }

  function bindDirectoryTracking() {
    const search = document.getElementById("search");
    const functionFilter = document.getElementById("functionFilter");
    const locationFilter = document.getElementById("locationFilter");
    const clearFilters = document.getElementById("clearFilters");

    if (search) {
      let searchTracked = false;
      search.addEventListener("input", function () {
        if (searchTracked || !search.value.trim()) return;
        searchTracked = true;
        trackEvent("directory_search_used", {
          source_page: window.location.pathname
        });
      });
    }

    if (functionFilter) {
      functionFilter.addEventListener("change", function () {
        if (!functionFilter.value) return;
        trackEvent("directory_filter_used", {
          filter_type: "function",
          filter_value: functionFilter.value,
          source_page: window.location.pathname
        });
      });
    }

    if (locationFilter) {
      locationFilter.addEventListener("change", function () {
        if (!locationFilter.value) return;
        trackEvent("directory_filter_used", {
          filter_type: "location",
          filter_value: locationFilter.value,
          source_page: window.location.pathname
        });
      });
    }

    if (clearFilters) {
      clearFilters.addEventListener("click", function () {
        trackEvent("directory_filters_cleared", {
          source_page: window.location.pathname
        });
      });
    }
  }

  function init() {
    loadGoogleAnalytics(config.gaMeasurementId);
    loadCloudflareWebAnalytics(config.cloudflareToken);
    bindClickTracking();
    bindDirectoryTracking();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init, { once: true });
  } else {
    init();
  }
})();
