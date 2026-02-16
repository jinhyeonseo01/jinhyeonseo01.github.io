import type { APIRoute } from "astro";
import { locales } from "../i18n/config";
import { getLinksByKind } from "../lib/registry";

const site = "https://jinhyeonseo01.github.io";

function createAbsoluteUrl(pathname: string): string {
  return new URL(pathname, site).toString();
}

function buildUrlEntries(): string[] {
  const siteLinks = [...getLinksByKind("main"), ...getLinksByKind("project")];
  const apiLinks = getLinksByKind("api");
  const entries: string[] = [];

  for (const locale of locales) {
    entries.push(`/${locale}/`);

    for (const link of siteLinks) {
      entries.push(`/${locale}/sites/${link.slug}/`);
    }

    for (const link of apiLinks) {
      entries.push(`/${locale}/apis/${link.slug}/`);
    }
  }

  return entries;
}

function renderSitemapXml(paths: string[]): string {
  const now = new Date().toISOString();
  const body = paths
    .map(
      (path) => `<url><loc>${createAbsoluteUrl(path)}</loc><lastmod>${now}</lastmod></url>`
    )
    .join("");

  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${body}</urlset>`;
}

export const GET: APIRoute = () => {
  const urls = buildUrlEntries();
  return new Response(renderSitemapXml(urls), {
    headers: {
      "Content-Type": "application/xml; charset=utf-8"
    }
  });
};

