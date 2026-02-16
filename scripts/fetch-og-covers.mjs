import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const registryFiles = [
  path.join("src", "data", "registry", "main-links.json"),
  path.join("src", "data", "registry", "projects.json"),
  path.join("src", "data", "registry", "apis.json")
];

const outputPath =
  process.env.OG_COVERS_OUTPUT ??
  path.join(process.cwd(), "src", "data", "generated", "og-covers.json");

const requestTimeoutMs = Number(process.env.OG_FETCH_TIMEOUT_MS ?? 12000);
const userAgent =
  process.env.OG_FETCH_USER_AGENT ??
  "clerin-dev-hub-og-fetcher/1.0 (+https://jinhyeonseo01.github.io)";

const metaKeyPriority = [
  "og:image:secure_url",
  "og:image:url",
  "og:image",
  "twitter:image",
  "twitter:image:src"
];

function toNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0 ? value.trim() : null;
}

function decodeHtmlEntities(value) {
  return value
    .replaceAll("&amp;", "&")
    .replaceAll("&quot;", "\"")
    .replaceAll("&#39;", "'")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">");
}

function parseTagAttributes(tag) {
  const attributes = {};
  const attrPattern = /([^\s"'=<>\/]+)\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+))/g;
  let match = attrPattern.exec(tag);

  while (match) {
    const rawKey = match[1];
    const rawValue = match[2] ?? match[3] ?? match[4] ?? "";
    attributes[rawKey.toLowerCase()] = decodeHtmlEntities(rawValue);
    match = attrPattern.exec(tag);
  }

  return attributes;
}

function normalizeImageUrl(rawValue, baseUrl) {
  const value = toNonEmptyString(rawValue);
  if (!value || value.toLowerCase().startsWith("data:")) {
    return null;
  }

  try {
    const resolved = new URL(value, baseUrl);
    if (resolved.protocol === "http:" || resolved.protocol === "https:") {
      return resolved.toString();
    }
  } catch {
    return null;
  }

  return null;
}

function extractMetaImage(html, pageUrl) {
  const metaTags = html.match(/<meta\s[^>]*>/gi) ?? [];
  const candidates = [];

  for (const tag of metaTags) {
    const attrs = parseTagAttributes(tag);
    const key = (attrs.property ?? attrs.name ?? attrs.itemprop ?? "").toLowerCase();
    const content = toNonEmptyString(attrs.content);
    if (!key || !content) {
      continue;
    }
    candidates.push({ key, content });
  }

  for (const key of metaKeyPriority) {
    for (const candidate of candidates) {
      if (candidate.key !== key) {
        continue;
      }

      const image = normalizeImageUrl(candidate.content, pageUrl);
      if (image) {
        return { image, source: key };
      }
    }
  }

  return null;
}

function extractLinkImage(html, pageUrl) {
  const linkTags = html.match(/<link\s[^>]*>/gi) ?? [];

  for (const tag of linkTags) {
    const attrs = parseTagAttributes(tag);
    const rel = (attrs.rel ?? "").toLowerCase();
    if (!rel.split(/\s+/).includes("image_src")) {
      continue;
    }

    const image = normalizeImageUrl(attrs.href, pageUrl);
    if (image) {
      return { image, source: "link:image_src" };
    }
  }

  return null;
}

function extractCoverImage(html, pageUrl) {
  return extractMetaImage(html, pageUrl) ?? extractLinkImage(html, pageUrl);
}

async function fetchHtml(url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

  try {
    const response = await fetch(url, {
      headers: {
        Accept: "text/html,application/xhtml+xml;q=0.9,*/*;q=0.8",
        "User-Agent": userAgent
      },
      redirect: "follow",
      signal: controller.signal
    });

    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }

    const html = await response.text();
    return { html, finalUrl: response.url || url };
  } finally {
    clearTimeout(timeout);
  }
}

function isHttpUrl(value) {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

async function loadRegistryLinks() {
  const linksBySlug = new Map();

  for (const relativePath of registryFiles) {
    const absolutePath = path.join(process.cwd(), relativePath);
    const raw = await readFile(absolutePath, "utf8");
    const json = JSON.parse(raw);
    if (!Array.isArray(json)) {
      continue;
    }

    for (const item of json) {
      const slug = toNonEmptyString(item?.slug);
      const href = toNonEmptyString(item?.href);
      if (!slug || !href || !isHttpUrl(href)) {
        continue;
      }

      linksBySlug.set(slug, { slug, href });
    }
  }

  return [...linksBySlug.values()];
}

async function loadExistingEntries() {
  try {
    const raw = await readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.entries)) {
      return new Map();
    }

    const entries = new Map();
    for (const entry of parsed.entries) {
      const slug = toNonEmptyString(entry?.slug);
      const href = toNonEmptyString(entry?.href);
      const image = toNonEmptyString(entry?.image);
      const source = toNonEmptyString(entry?.source) ?? "previous";
      if (!slug || !href || !image) {
        continue;
      }

      entries.set(slug, {
        slug,
        href,
        image,
        source
      });
    }

    return entries;
  } catch {
    return new Map();
  }
}

function formatError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

async function main() {
  const links = await loadRegistryLinks();
  const previousEntries = await loadExistingEntries();
  const generatedAt = new Date().toISOString();
  const entries = [];

  for (const link of links) {
    try {
      const { html, finalUrl } = await fetchHtml(link.href);
      const cover = extractCoverImage(html, finalUrl);

      if (cover?.image) {
        entries.push({
          slug: link.slug,
          href: link.href,
          image: cover.image,
          source: cover.source,
          checkedAt: generatedAt
        });
        console.log(`[og] ${link.slug} -> ${cover.source}`);
        continue;
      }

      throw new Error("No OG-compatible cover metadata found.");
    } catch (error) {
      const fallback = previousEntries.get(link.slug);
      if (fallback) {
        entries.push({
          ...fallback,
          href: link.href,
          source: `${fallback.source}:stale`,
          checkedAt: generatedAt
        });
        console.warn(`[og] ${link.slug} -> fallback cached cover (${formatError(error)})`);
        continue;
      }

      console.warn(`[og] ${link.slug} -> no cover (${formatError(error)})`);
    }
  }

  const payload = {
    generatedAt,
    entries
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(payload, null, 2)}\n`, "utf8");

  console.log(`[og] cover snapshot written: ${outputPath}`);
  console.log(`[og] coverage: ${entries.length}/${links.length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
