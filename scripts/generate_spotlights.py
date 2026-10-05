#!/usr/bin/env python3
"""Generate individual Spotlight pages from people-stories.json.

The spotlight/ directory is generated output. Do not hand-edit files inside it.
"""

from __future__ import annotations

import html
import json
import re
import shutil
from pathlib import Path
from urllib.parse import urlparse, parse_qs

ROOT = Path(__file__).resolve().parents[1]
SOURCE = ROOT / "people-stories.json"
OUTPUT = ROOT / "spotlight"
SLUG_RE = re.compile(r"^[a-z0-9]+(?:-[a-z0-9]+)*$")


def esc(value: object) -> str:
    return html.escape(str(value or ""), quote=True)


def youtube_id(url: str) -> str:
    if not url:
        return ""
    parsed = urlparse(url)
    host = parsed.hostname or ""
    if host in {"youtu.be", "www.youtu.be"}:
        return parsed.path.strip("/").split("/")[0]
    if host in {"youtube.com", "www.youtube.com"}:
        if parsed.path == "/watch":
            return parse_qs(parsed.query).get("v", [""])[0]
        parts = [part for part in parsed.path.split("/") if part]
        if len(parts) >= 2 and parts[0] in {"embed", "shorts", "live"}:
            return parts[1]
    return ""


def story_sections(story: dict) -> str:
    sections = story.get("story_sections") or []
    if not sections:
        return f'<p>{esc(story.get("summary"))}</p>'
    return "\n".join(
        f"""
        <section class="people-story-section">
          <h3>{esc(section.get("label"))}</h3>
          {''.join(f'<p>{esc(p)}</p>' for p in str(section.get("text") or "").split("\\n\\n") if p.strip())}
        </section>
        """
        for section in sections
    )


def render(story: dict) -> str:
    slug = story["slug"]
    name = esc(story.get("name"))
    headline = esc(story.get("headline"))
    hook = esc(story.get("hook"))
    summary = esc(story.get("summary"))
    linkedin = esc(story.get("linkedin_url"))
    directory = esc(story.get("directory_url") or "../../index.html")
    short_video = story.get("short_video_url") or ""
    full_video = story.get("full_video_url") or ""
    short_id = youtube_id(short_video)
    full_id = youtube_id(full_video)
    canonical = f"https://irvinthev.github.io/Ex-GH-Layoff-Repo/spotlight/{slug}/"
    og_image = (
        f"https://i.ytimg.com/vi/{short_id}/hqdefault.jpg"
        if short_id else
        f"https://i.ytimg.com/vi/{full_id}/hqdefault.jpg"
        if full_id else
        "https://irvinthev.github.io/Ex-GH-Layoff-Repo/"
    )

    tags = "".join(f"<span>{esc(tag)}</span>" for tag in (story.get("tags") or []))

    video_cards = []
    if short_video and short_id:
        video_cards.append(f"""
        <article class="featured-media-card">
          <a class="featured-media-thumbnail" href="{esc(short_video)}" target="_blank" rel="noopener noreferrer">
            <img src="https://i.ytimg.com/vi/{esc(short_id)}/hqdefault.jpg" alt="YouTube thumbnail for {name}" loading="lazy" />
            <span class="featured-media-play" aria-hidden="true">▶</span>
          </a>
          <div class="featured-media-labels">
            <span class="resource-series">People Behind the Spreadsheet</span>
            <span class="resource-category">Video</span>
          </div>
          <h3>Meet {name}</h3>
          <p>{summary}</p>
          <a class="resource-link" href="{esc(short_video)}" target="_blank" rel="noopener noreferrer">Watch on YouTube →</a>
        </article>
        """)

    if full_video and full_id:
        video_cards.append(f"""
        <article class="featured-media-card">
          <div class="people-story-video">
            <iframe
              src="https://www.youtube-nocookie.com/embed/{esc(full_id)}"
              title="Meet {name} — full episode"
              loading="lazy"
              referrerpolicy="strict-origin-when-cross-origin"
              allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
              allowfullscreen
            ></iframe>
          </div>
          <div class="featured-media-labels">
            <span class="resource-series">People Behind the Spreadsheet</span>
            <span class="resource-category">Full episode</span>
          </div>
          <h3>Go deeper with {name}</h3>
          <a class="resource-link" href="{esc(full_video)}" target="_blank" rel="noopener noreferrer">Watch the full episode on YouTube →</a>
        </article>
        """)

    video_section = ""
    if video_cards:
        video_section = f"""
    <section class="resources-section" aria-labelledby="spotlight-video-title">
      <div class="resources-section-header">
        <div>
          <p class="resources-section-kicker">Watch</p>
          <h2 id="spotlight-video-title">Meet {name}</h2>
        </div>
        <p>Go beyond the résumé and hear the story directly.</p>
      </div>
      <div class="featured-media-grid">
        {''.join(video_cards)}
      </div>
    </section>
        """

    linkedin_button = (
        f'<a class="primary-btn" href="{linkedin}" target="_blank" rel="noopener noreferrer">Connect with {name} →</a>'
        if linkedin else ""
    )

    return f"""<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>{name} | People Behind the Spreadsheet</title>
  <meta name="description" content="{hook or summary}" />
  <link rel="canonical" href="{canonical}" />

  <meta property="og:title" content="{name} | People Behind the Spreadsheet" />
  <meta property="og:description" content="{hook or summary}" />
  <meta property="og:type" content="profile" />
  <meta property="og:url" content="{canonical}" />
  <meta property="og:image" content="{og_image}" />

  <link rel="stylesheet" href="../../style.css?v=guide-nav-2" />
  <link rel="stylesheet" href="../../resources.css?v=6" />
</head>
<body class="resources-page">
  <nav class="site-nav" aria-label="Main navigation">
    <div class="site-nav-inner">
      <div class="nav-brand">
        <a href="../../index.html">Talent Network HQ</a>
        <span class="nav-brand-subtext">Currently supporting Ex-GH talent</span>
      </div>
      <div class="nav-links">
        <a href="../../about.html">About</a>
        <a href="../../index.html">Directory</a>
        <a href="../../resources.html" aria-current="page">Spotlight</a>
        <a href="../../layoff-guide.html">Playbook</a>
        <a href="https://docs.google.com/forms/d/e/1FAIpQLSehawGkkedBDJJCGhzKEy33epkB2GeRQ7sB8x8fQ-Uz_kxgAQ/viewform" target="_blank" rel="noopener noreferrer">Join</a>
      </div>
    </div>
  </nav>

  <header class="resources-hero">
    <div class="resources-shell resources-hero-inner">
      <p class="resources-kicker">People Behind the Spreadsheet</p>
      <h1>{name}</h1>
      <p class="resources-lead">{headline}</p>
      <div class="resources-hero-actions">
        {linkedin_button}
        <a class="secondary-btn" href="../../{directory}">View in Talent Directory →</a>
      </div>
    </div>
  </header>

  <main class="resources-shell">
    <section class="resources-section people-stories-section" aria-labelledby="spotlight-story-title">
      <article class="people-story-card expanded">
        <div class="people-story-card-top">
          <div>
            <span class="resource-series">People Behind the Spreadsheet</span>
            <h2 id="spotlight-story-title">{hook or f"Meet {name}"}</h2>
            <p class="people-story-role">{headline}</p>
          </div>
        </div>

        <div class="people-story-tags">{tags}</div>

        <div class="people-story-expanded">
          <div class="people-story-sections">
            {story_sections(story)}
          </div>

          <div class="people-story-actions">
            <a class="resource-link story-primary-link" href="../../{directory}">View in Talent Directory →</a>
            {f'<a class="resource-link" href="{linkedin}" target="_blank" rel="noopener noreferrer">Connect with {name} on LinkedIn →</a>' if linkedin else ''}
          </div>
        </div>
      </article>
    </section>

    {video_section}

    <section class="resources-section">
      <div class="resources-section-header">
        <div>
          <p class="resources-section-kicker">The Ask</p>
          <h2>Know someone {name} should meet?</h2>
        </div>
        <p>If someone in your network should know {name}, make the introduction.</p>
      </div>
      <div class="resources-hero-actions">
        {linkedin_button}
        <a class="secondary-btn" href="../../resources.html">Back to Spotlight →</a>
      </div>
    </section>
  </main>

  <footer class="site-footer">
    <div class="site-footer-inner">
      <nav class="site-footer-nav" aria-label="Footer navigation">
        <a href="../../about.html">About</a>
        <a href="../../index.html">Directory</a>
        <a href="../../resources.html">Spotlight</a>
        <a href="../../layoff-guide.html">Playbook</a>
      </nav>
      <p class="site-footer-note">Talent Network HQ is independently operated and community-built.</p>
    </div>
  </footer>

  <script src="../../analytics-config.js"></script>
  <script src="../../analytics.js"></script>
</body>
</html>
"""


def main() -> None:
    stories = json.loads(SOURCE.read_text(encoding="utf-8"))
    published = [story for story in stories if story.get("published") is True]

    seen = set()
    for story in published:
        slug = str(story.get("slug") or "")
        if not SLUG_RE.fullmatch(slug):
            raise SystemExit(f"Invalid Spotlight slug: {slug!r}")
        if slug in seen:
            raise SystemExit(f"Duplicate Spotlight slug: {slug}")
        seen.add(slug)

    if OUTPUT.exists():
        shutil.rmtree(OUTPUT)
    OUTPUT.mkdir(parents=True)

    for story in published:
        page_dir = OUTPUT / story["slug"]
        page_dir.mkdir(parents=True)
        (page_dir / "index.html").write_text(render(story), encoding="utf-8")

    print(f"Generated {len(published)} Spotlight page(s)")


if __name__ == "__main__":
    main()
