const GITHUB_ACCEPT_HEADER = { Accept: "application/vnd.github+json" };
const MAX_REPO_PAGES = 5;
const REPO_PAGE_SIZE = 100;
const DAY_MS = 24 * 60 * 60 * 1000;
const LOCAL_CACHE_TTL_MS = 15 * 60 * 1000;
const ENABLE_LIVE_FALLBACK_DEFAULT = false;
const API_KEYWORD_PATTERN = /\b(api|apis|sdk|rest|graphql|backend|endpoint|openapi|swagger|service|server)\b/i;
const githubDataCache = new Map();

function formatNumber(value, locale) {
  if (typeof value !== "number" || Number.isNaN(value)) {
    return "--";
  }
  return new Intl.NumberFormat(locale || undefined).format(value);
}

function formatDate(value, locale) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return "--";
  }

  return new Intl.DateTimeFormat(locale || undefined, {
    year: "numeric",
    month: "short",
    day: "numeric"
  }).format(date);
}

async function fetchJSON(url) {
  const response = await fetch(url, { headers: GITHUB_ACCEPT_HEADER });
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status})`);
  }

  const data = await response.json();
  return { data, response };
}

async function fetchAllRepos(username) {
  const repos = [];

  for (let page = 1; page <= MAX_REPO_PAGES; page += 1) {
    const { data } = await fetchJSON(
      `https://api.github.com/users/${username}/repos?per_page=${REPO_PAGE_SIZE}&page=${page}&sort=updated`
    );

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    repos.push(...data);

    if (data.length < REPO_PAGE_SIZE) {
      break;
    }
  }

  return repos;
}

function getNumber(value) {
  return typeof value === "number" && Number.isFinite(value) ? value : 0;
}

function isActiveWithinDays(pushedAt, days) {
  if (typeof pushedAt !== "string") {
    return false;
  }

  const pushedTime = new Date(pushedAt).getTime();
  if (Number.isNaN(pushedTime)) {
    return false;
  }

  return pushedTime >= Date.now() - days * DAY_MS;
}

function compareByUpdatedDesc(a, b) {
  return new Date(b.pushed_at || 0).getTime() - new Date(a.pushed_at || 0).getTime();
}

function compareByStarsDesc(a, b) {
  const starsGap = getNumber(b.stargazers_count) - getNumber(a.stargazers_count);
  if (starsGap !== 0) {
    return starsGap;
  }

  return compareByUpdatedDesc(a, b);
}

function normalizeUser(user) {
  if (!user || typeof user !== "object") {
    return null;
  }

  return {
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
    followers: getNumber(user.followers),
    following: getNumber(user.following),
    public_repos: getNumber(user.public_repos),
    public_gists: getNumber(user.public_gists),
    updated_at: user.updated_at
  };
}

function normalizeRepo(repo) {
  if (!repo || typeof repo !== "object" || typeof repo.name !== "string") {
    return null;
  }

  return {
    name: repo.name,
    full_name: typeof repo.full_name === "string" ? repo.full_name : repo.name,
    html_url: repo.html_url,
    description: repo.description,
    language: repo.language,
    stargazers_count: getNumber(repo.stargazers_count),
    forks_count: getNumber(repo.forks_count),
    open_issues_count: getNumber(repo.open_issues_count),
    pushed_at: repo.pushed_at,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    fork: Boolean(repo.fork),
    archived: Boolean(repo.archived),
    disabled: Boolean(repo.disabled)
  };
}

function normalizeDataset(payload, source) {
  if (!payload || typeof payload !== "object") {
    return null;
  }

  const user = normalizeUser(payload.user);
  const repos = Array.isArray(payload.repos)
    ? payload.repos.map((repo) => normalizeRepo(repo)).filter(Boolean)
    : [];

  if (!user || repos.length === 0) {
    return null;
  }

  const syncedAt = typeof payload.generatedAt === "string" ? payload.generatedAt : new Date().toISOString();

  return {
    user,
    repos,
    rateRemaining:
      typeof payload.rateRemaining === "number" && Number.isFinite(payload.rateRemaining)
        ? payload.rateRemaining
        : -1,
    syncedAt,
    source
  };
}

function getLocalCacheKey(username) {
  return `github-insights-cache:${username}`;
}

function readLocalCache(username) {
  try {
    const raw = window.localStorage.getItem(getLocalCacheKey(username));
    if (!raw) {
      return null;
    }

    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (typeof parsed.cachedAt !== "number") {
      return null;
    }

    if (Date.now() - parsed.cachedAt > LOCAL_CACHE_TTL_MS) {
      return null;
    }

    return normalizeDataset(parsed.dataset, "local-cache");
  } catch {
    return null;
  }
}

function writeLocalCache(username, dataset) {
  try {
    window.localStorage.setItem(
      getLocalCacheKey(username),
      JSON.stringify({
        cachedAt: Date.now(),
        dataset
      })
    );
  } catch {
    // no-op
  }
}

async function fetchSnapshotDataset(username) {
  try {
    const response = await fetch(`/data/github/${username}.json`, { cache: "no-store" });
    if (!response.ok) {
      return null;
    }

    const snapshot = await response.json();
    return normalizeDataset(snapshot, "snapshot");
  } catch {
    return null;
  }
}

async function fetchLiveDataset(username) {
  const [{ data: user, response: userResponse }, repos] = await Promise.all([
    fetchJSON(`https://api.github.com/users/${username}`),
    fetchAllRepos(username)
  ]);

  return {
    user: normalizeUser(user),
    repos: repos.map((repo) => normalizeRepo(repo)).filter(Boolean),
    rateRemaining: Number(userResponse.headers.get("x-ratelimit-remaining") || -1),
    syncedAt: new Date().toISOString(),
    source: "live"
  };
}

function getLanguageStats(repos) {
  const languageCount = new Map();

  for (const repo of repos) {
    const language = typeof repo.language === "string" && repo.language.trim() ? repo.language.trim() : null;
    if (!language) {
      continue;
    }

    const current = languageCount.get(language) ?? 0;
    languageCount.set(language, current + 1);
  }

  const entries = Array.from(languageCount.entries()).sort((a, b) => b[1] - a[1]).slice(0, 7);
  const total = entries.reduce((sum, [, count]) => sum + count, 0);

  return entries.map(([language, count]) => ({
    language,
    count,
    share: total > 0 ? count / total : 0
  }));
}

function getApiCandidates(repos) {
  return repos
    .filter((repo) => {
      const parts = [repo.name, repo.description];

      if (Array.isArray(repo.topics)) {
        parts.push(repo.topics.join(" "));
      }

      return API_KEYWORD_PATTERN.test(parts.filter(Boolean).join(" "));
    })
    .sort(compareByStarsDesc);
}

function getAggregates(repos) {
  return {
    stars: repos.reduce((sum, repo) => sum + getNumber(repo.stargazers_count), 0),
    forks: repos.reduce((sum, repo) => sum + getNumber(repo.forks_count), 0),
    issues: repos.reduce((sum, repo) => sum + getNumber(repo.open_issues_count), 0),
    active30d: repos.filter((repo) => isActiveWithinDays(repo.pushed_at, 30)).length
  };
}

async function getGitHubDataset(username, options = {}) {
  const allowLive =
    typeof options.allowLive === "boolean" ? options.allowLive : ENABLE_LIVE_FALLBACK_DEFAULT;
  const cacheKey = `${username}:${allowLive ? "live" : "snapshot"}`;
  const cachedPromise = githubDataCache.get(cacheKey);
  if (cachedPromise) {
    return cachedPromise;
  }

  const promise = (async () => {
    const localCached = readLocalCache(username);
    if (localCached) {
      return localCached;
    }

    const snapshot = await fetchSnapshotDataset(username);
    if (snapshot) {
      writeLocalCache(username, snapshot);
      return snapshot;
    }

    if (!allowLive) {
      throw new Error("GitHub snapshot unavailable and live fallback disabled.");
    }

    const live = await fetchLiveDataset(username);
    writeLocalCache(username, live);
    return live;
  })();

  githubDataCache.set(cacheKey, promise);

  try {
    return await promise;
  } catch (error) {
    githubDataCache.delete(cacheKey);
    throw error;
  }
}

function setMetric(root, key, value, locale) {
  const target = root.querySelector(`[data-gh-metric="${key}"]`);
  if (!target) {
    return;
  }

  target.textContent = typeof value === "number" ? formatNumber(value, locale) : String(value);
}

function setSyncAndQuota(root, syncedAt, quotaRemaining, source, locale) {
  const syncTarget = root.querySelector("[data-gh-sync]");
  if (syncTarget) {
    const prefix = syncTarget.dataset.prefix || "Last sync";
    syncTarget.textContent = `${prefix}: ${formatDate(syncedAt, locale)}`;
  }

  const quotaTarget = root.querySelector("[data-gh-rate]");
  if (quotaTarget) {
    const cachedLabel = root.dataset.cachedLabel || "Cached";
    if (source === "live" && quotaRemaining >= 0) {
      quotaTarget.textContent = `${quotaRemaining}/60`;
    } else {
      quotaTarget.textContent = cachedLabel;
    }
  }
}

function clearChildren(node) {
  while (node.firstChild) {
    node.removeChild(node.firstChild);
  }
}

function renderLanguages(root, stats, unavailableText, locale) {
  const target = root.querySelector("[data-gh-languages]");
  if (!target) {
    return;
  }

  clearChildren(target);

  if (stats.length === 0) {
    const empty = document.createElement("p");
    empty.className = "github-placeholder";
    empty.textContent = unavailableText;
    target.appendChild(empty);
    return;
  }

  for (const stat of stats) {
    const row = document.createElement("div");
    row.className = "github-language-row";

    const meta = document.createElement("div");
    meta.className = "github-language-row__meta";

    const name = document.createElement("span");
    name.textContent = stat.language;
    meta.appendChild(name);

    const count = document.createElement("span");
    count.textContent = formatNumber(stat.count, locale);
    meta.appendChild(count);

    const track = document.createElement("div");
    track.className = "github-language-row__track";

    const fill = document.createElement("span");
    fill.className = "github-language-row__fill";
    fill.style.width = `${Math.max(8, Math.round(stat.share * 100))}%`;
    track.appendChild(fill);

    row.appendChild(meta);
    row.appendChild(track);
    target.appendChild(row);
  }
}

function renderRepoTable(target, repos, locale, unavailableText, options = {}) {
  if (!target) {
    return;
  }

  clearChildren(target);

  if (!repos.length) {
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = unavailableText;
    row.appendChild(cell);
    target.appendChild(row);
    return;
  }

  for (const repo of repos) {
    const row = document.createElement("tr");

    const nameCell = document.createElement("td");
    const link = document.createElement("a");
    link.href = repo.html_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = repo.name;
    link.className = "github-table__link";
    nameCell.appendChild(link);
    row.appendChild(nameCell);

    const languageCell = document.createElement("td");
    languageCell.textContent = repo.language || "-";
    row.appendChild(languageCell);

    const starsCell = document.createElement("td");
    starsCell.textContent = formatNumber(getNumber(repo.stargazers_count), locale);
    row.appendChild(starsCell);

    const fourthCell = document.createElement("td");
    fourthCell.textContent = formatNumber(
      getNumber(options.useIssues ? repo.open_issues_count : repo.forks_count),
      locale
    );
    row.appendChild(fourthCell);

    const updatedCell = document.createElement("td");
    updatedCell.textContent = formatDate(repo.pushed_at, locale);
    row.appendChild(updatedCell);

    target.appendChild(row);
  }
}

function renderTopRepos(root, repos, locale, unavailableText) {
  const list = root.querySelector("[data-top-repos-list]");
  if (!list) {
    return;
  }

  clearChildren(list);

  const labelStars = root.dataset.labelStars || "Stars";
  const labelForks = root.dataset.labelForks || "Forks";
  const labelIssues = root.dataset.labelIssues || "Issues";
  const labelUpdated = root.dataset.labelUpdated || "Updated";
  const labelOpen = root.dataset.labelOpen || "Open";

  const topRepos = [...repos].sort(compareByStarsDesc).slice(0, 20);

  if (!topRepos.length) {
    const empty = document.createElement("article");
    empty.className = "repo-strip-card repo-strip-card--placeholder";
    empty.textContent = unavailableText;
    list.appendChild(empty);
    return;
  }

  for (const repo of topRepos) {
    const card = document.createElement("article");
    card.className = "repo-strip-card";

    const title = document.createElement("h3");
    title.className = "repo-strip-card__title";
    const link = document.createElement("a");
    link.href = repo.html_url;
    link.target = "_blank";
    link.rel = "noopener noreferrer";
    link.textContent = repo.name;
    title.appendChild(link);
    card.appendChild(title);

    const desc = document.createElement("p");
    desc.className = "repo-strip-card__summary";
    desc.textContent = repo.description || "-";
    card.appendChild(desc);

    const stats = document.createElement("div");
    stats.className = "repo-strip-card__stats";

    const statItems = [
      `${labelStars}: ${formatNumber(getNumber(repo.stargazers_count), locale)}`,
      `${labelForks}: ${formatNumber(getNumber(repo.forks_count), locale)}`,
      `${labelIssues}: ${formatNumber(getNumber(repo.open_issues_count), locale)}`
    ];

    for (const item of statItems) {
      const span = document.createElement("span");
      span.textContent = item;
      stats.appendChild(span);
    }

    card.appendChild(stats);

    const footer = document.createElement("div");
    footer.className = "repo-strip-card__footer";

    const updated = document.createElement("span");
    updated.textContent = `${labelUpdated}: ${formatDate(repo.pushed_at, locale)}`;
    footer.appendChild(updated);

    const openLink = document.createElement("a");
    openLink.className = "repo-strip-card__open";
    openLink.href = repo.html_url;
    openLink.target = "_blank";
    openLink.rel = "noopener noreferrer";
    openLink.textContent = labelOpen;
    footer.appendChild(openLink);

    card.appendChild(footer);
    list.appendChild(card);
  }
}

function showError(root, selector, text) {
  const error = root.querySelector(selector);
  if (error) {
    error.hidden = false;
    error.textContent = text;
  }
}

function hideError(root, selector) {
  const error = root.querySelector(selector);
  if (error) {
    error.hidden = true;
  }
}

function updateSharedMetrics(username, user, locale) {
  const targets = document.querySelectorAll(`[data-gh-shared-metric][data-username="${username}"]`);
  for (const target of targets) {
    if (!(target instanceof HTMLElement)) {
      continue;
    }

    const key = target.dataset.ghSharedMetric;
    if (key === "repos") {
      target.textContent = formatNumber(getNumber(user.public_repos), locale);
    }
  }
}

function hydrateOverview(root, dataset, locale, unavailableText) {
  const { user, repos, syncedAt, rateRemaining, source } = dataset;
  const aggregates = getAggregates(repos);

  hideError(root, "[data-gh-error]");

  setMetric(root, "followers", getNumber(user.followers), locale);
  setMetric(root, "following", getNumber(user.following), locale);
  setMetric(root, "repos", getNumber(user.public_repos), locale);
  setMetric(root, "gists", getNumber(user.public_gists), locale);
  setMetric(root, "stars", aggregates.stars, locale);
  setMetric(root, "forks", aggregates.forks, locale);
  setMetric(root, "issues", aggregates.issues, locale);
  setMetric(root, "active_30d", aggregates.active30d, locale);

  setSyncAndQuota(root, syncedAt, rateRemaining, source, locale);
  renderLanguages(root, getLanguageStats(repos), unavailableText, locale);
  renderRepoTable(root.querySelector("[data-gh-repos]"), [...repos].sort(compareByUpdatedDesc).slice(0, 7), locale, unavailableText);
}

function hydrateApi(root, dataset, locale, unavailableText) {
  const { user, repos, syncedAt, rateRemaining, source } = dataset;
  const candidates = getApiCandidates(repos);

  hideError(root, "[data-gh-error]");

  setMetric(root, "repos", getNumber(user.public_repos), locale);
  setMetric(root, "api_candidates", candidates.length, locale);
  setMetric(
    root,
    "api_candidate_stars",
    candidates.reduce((sum, repo) => sum + getNumber(repo.stargazers_count), 0),
    locale
  );
  setMetric(
    root,
    "api_candidate_issues",
    candidates.reduce((sum, repo) => sum + getNumber(repo.open_issues_count), 0),
    locale
  );
  setMetric(
    root,
    "api_candidate_active_30d",
    candidates.filter((repo) => isActiveWithinDays(repo.pushed_at, 30)).length,
    locale
  );

  setSyncAndQuota(root, syncedAt, rateRemaining, source, locale);
  renderRepoTable(root.querySelector("[data-gh-api-repos]"), candidates.slice(0, 10), locale, unavailableText, {
    useIssues: true
  });
}

function hydrateTopRepoStrip(root, dataset, locale, unavailableText) {
  hideError(root, "[data-top-repos-error]");
  renderTopRepos(root, dataset.repos, locale, unavailableText);
}

function fallbackBoard(root, unavailableText) {
  const metrics = root.querySelectorAll("[data-gh-metric]");
  for (const metric of metrics) {
    metric.textContent = "--";
  }

  const repoTargets = [root.querySelector("[data-gh-repos]"), root.querySelector("[data-gh-api-repos]")];
  for (const target of repoTargets) {
    if (!(target instanceof HTMLElement)) {
      continue;
    }

    clearChildren(target);
    const row = document.createElement("tr");
    const cell = document.createElement("td");
    cell.colSpan = 5;
    cell.textContent = unavailableText;
    row.appendChild(cell);
    target.appendChild(row);
  }

  const languageTarget = root.querySelector("[data-gh-languages]");
  if (languageTarget instanceof HTMLElement) {
    clearChildren(languageTarget);
    const message = document.createElement("p");
    message.className = "github-placeholder";
    message.textContent = unavailableText;
    languageTarget.appendChild(message);
  }

  showError(root, "[data-gh-error]", unavailableText);
}

function fallbackTopRepoStrip(root, unavailableText) {
  const list = root.querySelector("[data-top-repos-list]");
  if (list instanceof HTMLElement) {
    clearChildren(list);
    const empty = document.createElement("article");
    empty.className = "repo-strip-card repo-strip-card--placeholder";
    empty.textContent = unavailableText;
    list.appendChild(empty);
  }

  showError(root, "[data-top-repos-error]", unavailableText);
}

async function hydrateInsightsRoot(root) {
  const username = root.dataset.username || "jinhyeonseo01";
  const locale = root.dataset.locale || undefined;
  const mode = root.dataset.mode || "overview";
  const unavailableText = root.dataset.unavailable || "Unavailable";
  const allowLiveFallback = root.dataset.liveFallback === "true";

  try {
    const dataset = await getGitHubDataset(username, { allowLive: allowLiveFallback });
    updateSharedMetrics(username, dataset.user, locale);

    if (mode === "api") {
      hydrateApi(root, dataset, locale, unavailableText);
    } else {
      hydrateOverview(root, dataset, locale, unavailableText);
    }
  } catch {
    fallbackBoard(root, unavailableText);
  }
}

async function hydrateTopRepoRoot(root) {
  const username = root.dataset.username || "jinhyeonseo01";
  const locale = root.dataset.locale || undefined;
  const unavailableText = root.dataset.unavailable || "Unavailable";
  const allowLiveFallback = root.dataset.liveFallback === "true";

  try {
    const dataset = await getGitHubDataset(username, { allowLive: allowLiveFallback });
    updateSharedMetrics(username, dataset.user, locale);
    hydrateTopRepoStrip(root, dataset, locale, unavailableText);
  } catch {
    fallbackTopRepoStrip(root, unavailableText);
  }
}

document.querySelectorAll("[data-github-insights]").forEach((node) => {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  hydrateInsightsRoot(node);
});

document.querySelectorAll("[data-top-repos]").forEach((node) => {
  if (!(node instanceof HTMLElement)) {
    return;
  }

  hydrateTopRepoRoot(node);
});
