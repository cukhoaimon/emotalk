const { createHttpError } = require("../utils/httpError");

const DEFAULT_BASE_URL = "https://agent.tinyfish.ai/v1";
const DEFAULT_SEARCH_START_URL = "https://duckduckgo.com/";

function getTinyfishBaseUrl() {
  return (process.env.TINYFISH_BASE_URL || DEFAULT_BASE_URL).replace(/\/+$/, "");
}

function getHeaders() {
  if (!process.env.TINYFISH_API_KEY) {
    throw createHttpError(500, "TINYFISH_API_KEY is missing. Add it to your .env file.");
  }

  return {
    "Content-Type": "application/json",
    "X-API-Key": process.env.TINYFISH_API_KEY
  };
}

async function startSearchRun(query) {
  const response = await fetch(`${getTinyfishBaseUrl()}/automation/run-async`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      url: process.env.TINYFISH_SEARCH_START_URL || DEFAULT_SEARCH_START_URL,
      goal: [
        `Search the web for: ${query}.`,
        "Open the most relevant current sources and extract only facts that answer the query.",
        "Return JSON with exactly this shape:",
        '{ "summary": "string", "sources": [ { "title": "string", "url": "string", "snippet": "string" } ] }',
        "Use 2 to 5 sources. Prefer trustworthy, specific sources. Keep snippets short."
      ].join(" "),
      browser_profile: (process.env.TINYFISH_BROWSER_PROFILE || "lite").toLowerCase(),
      api_integration: "emotalk-backend"
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok || payload.error) {
    throw createHttpError(
      502,
      `TinyFish run start failed: ${payload.error?.message || response.statusText || "Unknown TinyFish error."}`
    );
  }

  if (!payload.run_id) {
    throw createHttpError(502, "TinyFish did not return a run_id.");
  }

  return payload.run_id;
}

async function getRun(runId) {
  const response = await fetch(`${getTinyfishBaseUrl()}/runs/batch`, {
    method: "POST",
    headers: getHeaders(),
    body: JSON.stringify({
      run_ids: [runId]
    })
  });

  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw createHttpError(502, `TinyFish run polling failed: ${response.statusText || "Unknown TinyFish error."}`);
  }

  return payload?.data?.[0] || null;
}

async function waitForRun(runId) {
  const maxAttempts = Number(process.env.TINYFISH_MAX_POLL_ATTEMPTS || 15);
  const pollMs = Number(process.env.TINYFISH_POLL_MS || 2000);

  for (let attempt = 0; attempt < maxAttempts; attempt += 1) {
    const run = await getRun(runId);

    if (run?.status === "COMPLETED") {
      return run;
    }

    if (run?.status === "FAILED" || run?.status === "CANCELLED") {
      throw createHttpError(502, `TinyFish run failed: ${run.error?.message || run.status}.`);
    }

    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }

  throw createHttpError(504, "TinyFish search timed out before completion.");
}

function normalizeSearchResult(run) {
  const raw = run?.result?.resultJson || run?.resultJson || run?.result || {};
  const sources = Array.isArray(raw.sources) ? raw.sources : [];

  return {
    summary: typeof raw.summary === "string" ? raw.summary.trim() : "",
    sources: sources
      .map((source) => ({
        title: String(source.title || "").trim(),
        url: String(source.url || "").trim(),
        snippet: String(source.snippet || "").trim()
      }))
      .filter((source) => source.title && source.url)
  };
}

async function searchWeb(query) {
  const runId = await startSearchRun(query);
  const run = await waitForRun(runId);
  const result = normalizeSearchResult(run);

  if (!result.summary && result.sources.length === 0) {
    throw createHttpError(502, "TinyFish search completed but returned no usable results.");
  }

  return {
    runId,
    ...result
  };
}

module.exports = {
  searchWeb
};
