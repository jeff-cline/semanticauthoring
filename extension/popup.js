// Reads what the page already declares about itself. It does not scrape the
// body text, and it never invents a DOI — an absent DOI stays absent.

const BASE = "https://semanticauthoring.org";
const $ = (id) => document.getElementById(id);

function scrape() {
  const meta = (sel) => document.querySelector(sel)?.content?.trim() ?? "";
  const doi =
    meta('meta[name="citation_doi"]') ||
    meta('meta[name="DC.Identifier"]').replace(/^doi:/i, "") ||
    (document.querySelector('a[href*="doi.org/"]')?.href ?? "")
      .replace(/^https?:\/\/(dx\.)?doi\.org\//i, "");
  const authors = [...document.querySelectorAll('meta[name="citation_author"]')]
    .map((m) => m.content).join(", ") || meta('meta[name="author"]');
  return {
    title: meta('meta[name="citation_title"]') || meta('meta[property="og:title"]')
      || document.title,
    authors,
    year: (meta('meta[name="citation_publication_date"]').match(/\d{4}/) ?? [""])[0],
    publication: meta('meta[name="citation_journal_title"]'),
    doi: /^10\.\d{4,}\//.test(doi) ? doi : "",
    url: location.href,
  };
}

async function init() {
  const { token } = await chrome.storage.local.get("token");
  if (!token) { $("setup").hidden = false; return; }
  $("form").hidden = false;

  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  try {
    const [{ result }] = await chrome.scripting.executeScript({
      target: { tabId: tab.id }, func: scrape,
    });
    $("title").value = result.title ?? "";
    $("authors").value = result.authors ?? "";
    $("doi").value = result.doi ?? "";
    window.__meta = result;
  } catch {
    $("title").value = tab.title ?? "";
    window.__meta = { url: tab.url, title: tab.title };
  }
}

$("saveToken").onclick = async () => {
  const token = $("token").value.trim();
  if (!token) return;
  await chrome.storage.local.set({ token });
  $("setup").hidden = true;
  init();
};

$("forget").onclick = async () => {
  await chrome.storage.local.remove("token");
  $("form").hidden = true;
  $("setup").hidden = false;
};

$("save").onclick = async () => {
  const { token } = await chrome.storage.local.get("token");
  const m = window.__meta ?? {};
  $("status").textContent = "Saving…";
  $("status").className = "muted";
  try {
    const res = await fetch(`${BASE}/api/v1/sources`, {
      method: "POST",
      headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
      body: JSON.stringify({
        title: $("title").value, authors: $("authors").value, doi: $("doi").value,
        tags: $("tags").value, url: m.url, year: m.year ?? "",
        publication: m.publication ?? "",
        kind: m.doi ? "article" : "website",
        provider: "browser-extension", source_url: m.url,
      }),
    });
    const j = await res.json();
    if (j.ok) {
      $("status").textContent = "Saved to your library.";
      $("status").className = "ok";
    } else {
      $("status").textContent = j.error ?? "Could not save.";
      $("status").className = "err";
    }
  } catch {
    $("status").textContent = "Network error.";
    $("status").className = "err";
  }
};

init();
