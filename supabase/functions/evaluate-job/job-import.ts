export type ImportedJob = {
  title: string;
  description: string;
  location: string;
  remoteType: string;
  canonicalUrl: string;
  sourceMode: "structured" | "page_text";
};

const MAX_HTML_BYTES = 1_000_000;
const MAX_REDIRECTS = 3;
const FETCH_TIMEOUT_MS = 10_000;

function isPrivateIpv4(hostname: string): boolean {
  const parts = hostname.split(".");
  if (parts.length !== 4 || parts.some((part) => !/^\d{1,3}$/.test(part))) return false;
  const octets = parts.map(Number);
  if (octets.some((part) => part < 0 || part > 255)) return true;
  return octets[0] === 0
    || octets[0] === 10
    || octets[0] === 127
    || (octets[0] === 169 && octets[1] === 254)
    || (octets[0] === 172 && octets[1] >= 16 && octets[1] <= 31)
    || (octets[0] === 192 && octets[1] === 168)
    || octets[0] >= 224;
}

export function validatePublicJobUrl(value: string): URL {
  if (!value || value.length > 2048) throw new Error("Enter a valid public job URL");
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error("Enter a complete job URL beginning with https://");
  }
  if (url.protocol !== "https:") throw new Error("Job URLs must begin with https://");
  if (url.username || url.password) throw new Error("Job URLs cannot contain credentials");
  if (url.port && url.port !== "443") throw new Error("Job URLs must use the standard HTTPS port");

  const hostname = url.hostname.toLowerCase().replace(/\.$/, "");
  const blockedName = hostname === "localhost"
    || hostname.endsWith(".localhost")
    || hostname.endsWith(".local")
    || hostname.endsWith(".internal")
    || hostname === "metadata.google.internal"
    || hostname.endsWith(".supabase.co")
    || hostname.endsWith(".supabase.in");
  if (!hostname || blockedName || hostname.includes(":") || isPrivateIpv4(hostname)) {
    throw new Error("That job URL is not on a public website");
  }
  url.hash = "";
  return url;
}

function decodeEntities(value: string): string {
  const named: Record<string, string> = {
    amp: "&",
    apos: "'",
    gt: ">",
    lt: "<",
    nbsp: " ",
    quot: '"',
  };
  return value.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, entity: string) => {
    if (entity.startsWith("#")) {
      const hex = entity[1]?.toLowerCase() === "x";
      const code = Number.parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : match;
    }
    return named[entity.toLowerCase()] ?? match;
  });
}

function htmlToText(value: unknown): string {
  return decodeEntities(String(value ?? "")
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
    .replace(/<br\s*\/?\s*>/gi, "\n")
    .replace(/<\/p\s*>/gi, "\n")
    .replace(/<\/li\s*>/gi, "\n")
    .replace(/<[^>]+>/g, " "))
    .replace(/[ \t]+/g, " ")
    .replace(/\n\s*\n+/g, "\n")
    .trim();
}

function metaContent(html: string, key: string): string {
  const escaped = key.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const patterns = [
    new RegExp(`<meta[^>]+(?:property|name)=["']${escaped}["'][^>]+content=["']([^"']+)["'][^>]*>`, "i"),
    new RegExp(`<meta[^>]+content=["']([^"']+)["'][^>]+(?:property|name)=["']${escaped}["'][^>]*>`, "i"),
  ];
  for (const pattern of patterns) {
    const match = html.match(pattern);
    if (match?.[1]) return htmlToText(match[1]);
  }
  return "";
}

function flattenJsonLd(value: unknown): Record<string, unknown>[] {
  if (Array.isArray(value)) return value.flatMap(flattenJsonLd);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  const graph = flattenJsonLd(record["@graph"]);
  return [record, ...graph];
}

function jsonLdRecords(html: string): Record<string, unknown>[] {
  const records: Record<string, unknown>[] = [];
  const scripts = html.matchAll(/<script\b[^>]*type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi);
  for (const match of scripts) {
    const raw = match[1]?.trim();
    if (!raw) continue;
    try {
      records.push(...flattenJsonLd(JSON.parse(raw)));
    } catch {
      try {
        records.push(...flattenJsonLd(JSON.parse(decodeEntities(raw))));
      } catch {
        // Ignore malformed structured data and continue to page-text fallback.
      }
    }
  }
  return records;
}

function isJobPosting(record: Record<string, unknown>): boolean {
  const type = record["@type"];
  return Array.isArray(type)
    ? type.some((value) => String(value).toLowerCase() === "jobposting")
    : String(type ?? "").toLowerCase() === "jobposting";
}

function collectAddress(value: unknown): string[] {
  if (Array.isArray(value)) return value.flatMap(collectAddress);
  if (!value || typeof value !== "object") return [];
  const record = value as Record<string, unknown>;
  if (record.address) return collectAddress(record.address);
  return [record.addressLocality, record.addressRegion, record.addressCountry]
    .map((part) => htmlToText(part))
    .filter(Boolean);
}

function fallbackPageText(html: string): string {
  const main = html.match(/<main\b[^>]*>([\s\S]*?)<\/main>/i)?.[1]
    ?? html.match(/<article\b[^>]*>([\s\S]*?)<\/article>/i)?.[1]
    ?? html.match(/<body\b[^>]*>([\s\S]*?)<\/body>/i)?.[1]
    ?? html;
  return htmlToText(main
    .replace(/<nav\b[^>]*>[\s\S]*?<\/nav>/gi, " ")
    .replace(/<header\b[^>]*>[\s\S]*?<\/header>/gi, " ")
    .replace(/<footer\b[^>]*>[\s\S]*?<\/footer>/gi, " ")
    .replace(/<form\b[^>]*>[\s\S]*?<\/form>/gi, " "))
    .slice(0, 50_000);
}

export function extractJobPostingHtml(html: string, canonicalUrl: string): ImportedJob {
  const job = jsonLdRecords(html).find(isJobPosting);
  const titleFromPage = htmlToText(html.match(/<title\b[^>]*>([\s\S]*?)<\/title>/i)?.[1] ?? "")
    .replace(/\s+[|–—-]\s+(LinkedIn|Indeed|Glassdoor).*$/i, "")
    .trim();
  const title = htmlToText(job?.title)
    || metaContent(html, "og:title")
    || metaContent(html, "twitter:title")
    || titleFromPage;
  const structuredDescription = htmlToText(job?.description);
  const metaDescription = metaContent(html, "description") || metaContent(html, "og:description");
  const description = structuredDescription.length >= 50
    ? structuredDescription
    : metaDescription.length >= 50
      ? metaDescription
      : fallbackPageText(html);
  if (description.length < 50) throw new Error("The job page did not expose enough readable job details");

  const locationParts = collectAddress(job?.jobLocation);
  const location = [...new Set(locationParts)].join(", ");
  const locationType = String(job?.jobLocationType ?? "").toLowerCase();
  const descriptionText = description.toLowerCase();
  const remoteType = locationType.includes("telecommute") || /\bfully remote\b|\bremote role\b/.test(descriptionText)
    ? "Remote"
    : /\bhybrid\b/.test(descriptionText)
      ? "Hybrid"
      : /\bon[ -]?site\b/.test(descriptionText)
        ? "On-site"
        : "";

  return {
    title: title.slice(0, 300),
    description,
    location: location.slice(0, 300),
    remoteType,
    canonicalUrl,
    sourceMode: job ? "structured" : "page_text",
  };
}

async function readLimitedText(response: Response): Promise<string> {
  const contentLength = Number(response.headers.get("content-length") ?? "0");
  if (contentLength > MAX_HTML_BYTES) throw new Error("The job page is too large to import");
  if (!response.body) return "";

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let received = 0;
  let result = "";
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > MAX_HTML_BYTES) {
      await reader.cancel();
      throw new Error("The job page is too large to import");
    }
    result += decoder.decode(value, { stream: true });
  }
  return result + decoder.decode();
}

export async function importJobFromUrl(value: string): Promise<ImportedJob> {
  let url = validatePublicJobUrl(value);
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
    try {
      const response = await fetch(url, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "Accept": "text/html,application/xhtml+xml;q=0.9",
          "User-Agent": "Ex-GH-Talent-Network-Job-Importer/1.0",
        },
      });

      if ([301, 302, 303, 307, 308].includes(response.status)) {
        const location = response.headers.get("location");
        if (!location || redirect === MAX_REDIRECTS) throw new Error("The job page redirected too many times");
        url = validatePublicJobUrl(new URL(location, url).href);
        continue;
      }
      if (!response.ok) throw new Error(`The job page returned HTTP ${response.status}`);
      const contentType = response.headers.get("content-type")?.toLowerCase() ?? "";
      if (!contentType.includes("text/html") && !contentType.includes("application/xhtml+xml")) {
        throw new Error("The URL did not return a readable web page");
      }
      const html = await readLimitedText(response);
      return extractJobPostingHtml(html, url.href);
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        throw new Error("The job page took too long to respond");
      }
      throw error;
    } finally {
      clearTimeout(timeout);
    }
  }
  throw new Error("The job page could not be imported");
}
