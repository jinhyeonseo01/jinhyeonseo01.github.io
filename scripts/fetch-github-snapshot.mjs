import path from "node:path";
import { mkdir, writeFile } from "node:fs/promises";

const username = process.env.GITHUB_USERNAME ?? "jinhyeonseo01";
const outputPath =
  process.env.GITHUB_SNAPSHOT_OUTPUT ??
  path.join(process.cwd(), "public", "data", "github", `${username}.json`);
const token = (process.env.GH_SNAPSHOT_TOKEN ?? process.env.GITHUB_TOKEN ?? "").trim();
const perPage = 100;
const maxPages = 5;

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

async function fetchJson(url) {
  const response = await fetch(url, { headers: buildHeaders() });
  if (!response.ok) {
    throw new Error(`GitHub request failed (${response.status}) for ${url}`);
  }

  const data = await response.json();
  return { data, response };
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

async function main() {
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

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
