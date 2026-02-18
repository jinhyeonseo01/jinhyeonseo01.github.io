import path from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";

const username = process.env.GITHUB_USERNAME ?? "jinhyeonseo01";
const outputPath =
  process.env.GITHUB_SNAPSHOT_OUTPUT ??
  path.join(process.cwd(), "public", "data", "github", `${username}.json`);
const token = (process.env.GH_SNAPSHOT_TOKEN ?? process.env.GITHUB_TOKEN ?? "").trim();
const perPage = 100;
const maxPages = 5;
const requestTimeoutMs = Number(process.env.GITHUB_SNAPSHOT_TIMEOUT_MS ?? 12000);
const maxRetriesRaw = Number(process.env.GITHUB_SNAPSHOT_MAX_RETRIES ?? 2);
const maxRetries = Number.isFinite(maxRetriesRaw) && maxRetriesRaw >= 0 ? Math.floor(maxRetriesRaw) : 2;
const retryBaseMsRaw = Number(process.env.GITHUB_SNAPSHOT_RETRY_BASE_MS ?? 1000);
const retryBaseMs = Number.isFinite(retryBaseMsRaw) && retryBaseMsRaw > 0 ? retryBaseMsRaw : 1000;
const strictMode = /^(1|true|yes)$/i.test((process.env.GITHUB_SNAPSHOT_REQUIRED ?? "").trim());

function buildHeaders() {
  const headers = {
    Accept: "application/vnd.github+json",
    "X-GitHub-Api-Version": "2022-11-28"
  };

  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  return headers;
}

class GitHubHttpError extends Error {
  constructor(url, status) {
    super(`GitHub request failed (${status}) for ${url}`);
    this.name = "GitHubHttpError";
    this.status = status;
    this.url = url;
  }
}

function formatError(error) {
  if (error instanceof Error && error.message) {
    return error.message;
  }
  return String(error);
}

function isRetriableStatus(status) {
  return status === 403 || status === 408 || status === 429 || status >= 500;
}

function isRetriableError(error) {
  if (error?.name === "AbortError") {
    return true;
  }

  if (error instanceof GitHubHttpError) {
    return isRetriableStatus(error.status);
  }

  return false;
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function fetchJson(url) {
  let lastError = null;

  for (let attempt = 0; attempt <= maxRetries; attempt += 1) {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), requestTimeoutMs);

    try {
      const response = await fetch(url, { headers: buildHeaders(), signal: controller.signal });
      if (!response.ok) {
        throw new GitHubHttpError(url, response.status);
      }

      const data = await response.json();
      return { data, response };
    } catch (error) {
      lastError = error;
      const retriable = isRetriableError(error);
      const hasMoreAttempts = attempt < maxRetries;

      if (!retriable || !hasMoreAttempts) {
        throw error;
      }

      const waitMs = retryBaseMs * (attempt + 1);
      console.warn(
        `[github] retry ${attempt + 1}/${maxRetries} for ${url}: ${formatError(error)} (waiting ${waitMs}ms)`
      );
      await sleep(waitMs);
    } finally {
      clearTimeout(timeout);
    }
  }

  throw lastError ?? new Error(`GitHub request failed for ${url}`);
}

async function fetchAllRepos() {
  const repos = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const { data } = await fetchJson(
      `https://api.github.com/users/${username}/repos?per_page=${perPage}&page=${page}&sort=updated`
    );

    if (!Array.isArray(data) || data.length === 0) {
      break;
    }

    repos.push(...data);

    if (data.length < perPage) {
      break;
    }
  }

  return repos;
}

function normalizeUser(user) {
  return {
    login: user.login,
    name: user.name,
    avatar_url: user.avatar_url,
    html_url: user.html_url,
    followers: user.followers,
    following: user.following,
    public_repos: user.public_repos,
    public_gists: user.public_gists,
    updated_at: user.updated_at
  };
}

function normalizeRepo(repo) {
  return {
    name: repo.name,
    full_name: repo.full_name,
    html_url: repo.html_url,
    description: repo.description,
    language: repo.language,
    stargazers_count: repo.stargazers_count,
    forks_count: repo.forks_count,
    open_issues_count: repo.open_issues_count,
    pushed_at: repo.pushed_at,
    topics: Array.isArray(repo.topics) ? repo.topics : [],
    fork: repo.fork,
    archived: repo.archived,
    disabled: repo.disabled
  };
}

async function loadExistingSnapshot() {
  try {
    const raw = await readFile(outputPath, "utf8");
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") {
      return null;
    }

    if (!parsed.user || !Array.isArray(parsed.repos)) {
      return null;
    }

    return parsed;
  } catch {
    return null;
  }
}

async function main() {
  if (!token) {
    console.warn("[github] GH_SNAPSHOT_TOKEN not set, using unauthenticated GitHub API quota.");
  }

  const [{ data: user, response }, repos] = await Promise.all([
    fetchJson(`https://api.github.com/users/${username}`),
    fetchAllRepos()
  ]);

  const rateLimit = Number(response.headers.get("x-ratelimit-limit") || -1);
  const rateRemaining = Number(response.headers.get("x-ratelimit-remaining") || -1);
  const rateResetEpochSeconds = Number(response.headers.get("x-ratelimit-reset") || 0);
  const rateResetAt =
    Number.isFinite(rateResetEpochSeconds) && rateResetEpochSeconds > 0
      ? new Date(rateResetEpochSeconds * 1000).toISOString()
      : null;

  const snapshot = {
    generatedAt: new Date().toISOString(),
    username,
    source: token ? "authenticated-api" : "public-api",
    rateLimit,
    rateRemaining,
    rateResetAt,
    user: normalizeUser(user),
    repos: repos.map(normalizeRepo)
  };

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, `${JSON.stringify(snapshot, null, 2)}\n`, "utf8");

  console.log(`GitHub snapshot written: ${outputPath}`);
  console.log(`username=${username}, repos=${snapshot.repos.length}, source=${snapshot.source}`);
}

async function handleFailure(error) {
  const previousSnapshot = await loadExistingSnapshot();
  if (previousSnapshot && !strictMode) {
    console.warn(`[github] snapshot fetch failed, using existing snapshot at ${outputPath}`);
    console.warn(`[github] reason: ${formatError(error)}`);
    console.warn("[github] set GITHUB_SNAPSHOT_REQUIRED=true to fail this step when refresh fails.");
    return;
  }

  console.error(error);
  process.exitCode = 1;
}

main().catch(handleFailure);
