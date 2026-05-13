// â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�
//   WordCraft â€“ Main Application Logic
//   Validation: local DICTIONARY Set only.
//   Definitions: fetched lazily from API with
//   rate-limit queue + fallback.
// â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�â•�

// â”€â”€ State â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
let allFoundWords = [];
let filteredWords = [];
let activeFilter = "all";
let sortMode = "alpha";
let currentSearch = 0;
let currentPage = 1;
const PAGE_SIZE = 12;

// Search history for back navigation
let searchHistory = [];
let currentWord = "";

// â”€â”€ Built-in definitions for short / common words â”€â”€â”€
// These bypass the API entirely.
const SHORT_WORD_DEFS = {
  // 1-letter
  a: {
    pos: "article",
    text: "Used before a noun to refer to a single, unspecified thing.",
  },
  i: { pos: "pronoun", text: "Used by a speaker to refer to themselves." },
  // Prepositions
  at: {
    pos: "preposition",
    text: "Expressing location or position in a place.",
  },
  in: {
    pos: "preposition",
    text: "Inside or within a place, time, or situation.",
  },
  on: {
    pos: "preposition",
    text: "Physically in contact with and supported by a surface.",
  },
  to: {
    pos: "preposition",
    text: "Expressing direction or movement toward a place or person.",
  },
  of: {
    pos: "preposition",
    text: "Expressing the relationship between a part and a whole.",
  },
  up: { pos: "adverb", text: "Moving toward a higher position or level." },
  by: {
    pos: "preposition",
    text: "Identifying the agent performing an action.",
  },
  as: {
    pos: "conjunction",
    text: "Used to indicate that something happens at the same time.",
  },
  // Pronouns
  he: {
    pos: "pronoun",
    text: "Used to refer to a male person previously mentioned.",
  },
  me: {
    pos: "pronoun",
    text: "Used as the object of a verb or preposition, referring to oneself.",
  },
  we: {
    pos: "pronoun",
    text: "Used by a speaker to refer to themselves and others.",
  },
  us: {
    pos: "pronoun",
    text: 'Object form of "we"; used when the speaker and others are the object.',
  },
  it: {
    pos: "pronoun",
    text: "Referring to a thing, animal, or idea previously mentioned.",
  },
  // Verbs
  am: { pos: "verb", text: 'First person singular present tense of "be".' },
  is: { pos: "verb", text: 'Third person singular present tense of "be".' },
  do: { pos: "verb", text: "Perform or carry out an action or task." },
  go: { pos: "verb", text: "Move from one place to another; travel." },
  be: { pos: "verb", text: "Exist; have reality or actuality." },
  // Conjunctions / other
  or: {
    pos: "conjunction",
    text: "Used to link alternatives or present a choice.",
  },
  so: { pos: "conjunction", text: "Therefore; for that reason; as a result." },
  if: {
    pos: "conjunction",
    text: "Introducing a conditional clause; on the condition that.",
  },
  no: {
    pos: "adverb",
    text: "Used to give a negative response or to deny something.",
  },
  my: { pos: "pronoun", text: "Belonging to or associated with the speaker." },
  hi: { pos: "exclamation", text: "Used as an informal greeting." },
  ok: { pos: "adjective", text: "Satisfactory; acceptable; all right." },
  oh: {
    pos: "exclamation",
    text: "Used to express surprise, disappointment, or acknowledgement.",
  },
  an: {
    pos: "article",
    text: "Used before a vowel sound to refer to a single, unspecified thing.",
  },
};

// Pre-populate cache so short words bypass API
const definitionCache = { ...SHORT_WORD_DEFS };

// â”€â”€ DOM Refs â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€â”€
const input = document.getElementById("wordInput");
const letterTiles = document.getElementById("letterTiles");
const statsBar = document.getElementById("statsBar");
const filterBar = document.getElementById("filterBar");
const resultsSection = document.getElementById("resultsSection");
const resultsGrid = document.getElementById("resultsGrid");
const loading = document.getElementById("loading");
const emptyState = document.getElementById("emptyState");
const heroIntro = document.getElementById("heroIntro");
const totalCount = document.getElementById("totalCount");
const uniqueLetters = document.getElementById("uniqueLetters");
const longestWord = document.getElementById("longestWord");
const filterBtns = document.getElementById("filterButtons");
const sortLabel = document.getElementById("sortLabel");
const pagination = document.getElementById("pagination");
const backBar = document.getElementById("backBar");
const backWord = document.getElementById("backWord");
const breadcrumb = document.getElementById("breadcrumb");

function initParticles() {
  const container = document.getElementById("particles");
  const colors = ["#7c5cfc", "#00d4aa", "#ff6b9d", "#81d8f7", "#ffb56b"];
  for (let i = 0; i < 25; i++) {
    const p = document.createElement("div");
    p.className = "particle";
    const size = Math.random() * 6 + 2;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random() * colors.length)]};
      left:${Math.random() * 100}%;
      animation-duration:${Math.random() * 15 + 8}s;
      animation-delay:${Math.random() * 10}s;opacity:0;`;
    container.appendChild(p);
  }
}

function sanitizeInput(val) {
  return val.replace(/[^a-zA-Z]/g, "");
}

input.addEventListener("input", () => {
  const clean = sanitizeInput(input.value);
  if (clean !== input.value) input.value = clean;
  const val = input.value.trim();
  if (val.length > 0) showLetterTiles(val);
  else letterTiles.innerHTML = "";
});

input.addEventListener("keydown", (e) => {
  if (e.key === "Enter") findWords();
});

function canForm(word, available) {
  const count = {};
  for (const ch of available) count[ch] = (count[ch] || 0) + 1;
  for (const ch of word) {
    if (!count[ch]) return false;
    count[ch]--;
  }
  return true;
}

function findCandidates(inputWord) {
  const letters = inputWord.toLowerCase().split("");
  const results = [];
  for (const word of DICTIONARY) {
    if (word === inputWord.toLowerCase()) continue;
    if (canForm(word, letters)) results.push(word);
  }
  return results;
}

const API_BASE = "https://api.dictionaryapi.dev/api/v2/entries/en/";

let _apiQueue = Promise.resolve();
let _lastReqTime = 0;
const API_INTERVAL_MS = 400; // max ~2.5 req/s

function enqueueApiRequest(word) {
  _apiQueue = _apiQueue.then(async () => {
    const now = Date.now();
    const wait = API_INTERVAL_MS - (now - _lastReqTime);
    if (wait > 0) await delay(wait);
    _lastReqTime = Date.now();

    if (definitionCache[word] !== undefined) return; // already cached

    try {
      const res = await fetch(API_BASE + word, {
        signal: AbortSignal.timeout(8000),
      });
      if (res.status === 429) {
        // Rate-limited: set a placeholder and move on
        definitionCache[word] = makeFallbackDef(word);
        return;
      }
      if (!res.ok) {
        definitionCache[word] = makeFallbackDef(word);
        return;
      }
      const data = await res.json();
      const meaning = data[0]?.meanings[0];
      if (!meaning) {
        definitionCache[word] = makeFallbackDef(word);
        return;
      }
      const def = {
        pos: meaning.partOfSpeech || "word",
        text: meaning.definitions[0]?.definition || "",
      };
      definitionCache[word] = def.text ? def : makeFallbackDef(word);
    } catch {
      definitionCache[word] = makeFallbackDef(word);
    }
  });
  return _apiQueue;
}

/** Fallback definition when API is unavailable / rate-limited. */
function makeFallbackDef(word) {
  return {
    pos: "word",
    text: `A valid English word (${word.length} letters).`,
  };
}

function delay(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function showLetterTiles(word) {
  letterTiles.innerHTML = "";
  [...word.toUpperCase()].forEach((ch, i) => {
    const tile = document.createElement("div");
    tile.className = "tile";
    tile.textContent = ch;
    tile.style.animationDelay = `${i * 50}ms`;
    letterTiles.appendChild(tile);
  });
}

function setLoadingText(msg) {
  const p = loading.querySelector("p");
  if (p) p.textContent = msg;
}

function buildFilterButtons(words) {
  const lengths = [...new Set(words.map((w) => w.length))].sort(
    (a, b) => a - b,
  );
  filterBtns.innerHTML = "";
  const makeBtn = (label, val) => {
    const btn = document.createElement("button");
    btn.className = "filter-btn" + (activeFilter === val ? " active" : "");
    btn.textContent = label;
    btn.dataset.len = val;
    btn.onclick = () => applyFilter(val);
    filterBtns.appendChild(btn);
  };
  makeBtn(`All (${words.length})`, "all");
  lengths.forEach((len) => {
    const cnt = words.filter((w) => w.length === len).length;
    makeBtn(`${len} letter${len > 1 ? "s" : ""} (${cnt})`, len);
  });
}

function applyFilter(len) {
  activeFilter = len;
  currentPage = 1;
  filteredWords =
    len === "all"
      ? [...allFoundWords]
      : allFoundWords.filter((w) => w.length === len);
  applySortAndRender();
  document.querySelectorAll(".filter-btn").forEach((b) => {
    b.classList.toggle("active", b.dataset.len == len);
  });
}

function toggleSort() {
  sortMode = sortMode === "alpha" ? "length" : "alpha";
  currentPage = 1;
  sortLabel.textContent = sortMode === "alpha" ? "Sort: Aâ€“Z" : "Sort: Length";
  applySortAndRender();
}
window.toggleSort = toggleSort;

function applySortAndRender() {
  const sorted = [...filteredWords];
  if (sortMode === "alpha") sorted.sort((a, b) => a.localeCompare(b));
  else sorted.sort((a, b) => b.length - a.length || a.localeCompare(b));
  renderWords(sorted);
  renderPagination(sorted.length);
}

function makeWordCard(word, def) {
  const card = document.createElement("div");
  card.className = "word-card";
  card.id = "card-" + word;
  card.dataset.len = word.length;
  card.style.cursor = "pointer";
  card.title = `Click to search "${word}"`;
  card.innerHTML = `
    <div class="word-header">
      <span class="word-text">${word}</span>
      <span class="word-pos">${def.pos}</span>
    </div>
    <div class="word-len"><span>${word.length} letter${word.length > 1 ? "s" : ""}</span></div>
    <div class="word-def">${def.text.length > 90 ? def.text.slice(0, 90) + "â€¦" : def.text}</div>
  `;
  card.addEventListener("click", () => useExample(word));
  return card;
}

/** Render current page of words. Words without a cached def get a spinner placeholder. */
function renderWords(words) {
  resultsGrid.innerHTML = "";
  const start = (currentPage - 1) * PAGE_SIZE;
  const end = start + PAGE_SIZE;
  const page = words.slice(start, end);
  page.forEach((word, i) => {
    const def = definitionCache[word] || makeFallbackDef(word);
    const card = makeWordCard(word, def);
    card.style.animationDelay = `${Math.min(i * 40, 400)}ms`;
    resultsGrid.appendChild(card);
  });

  // Lazily fetch definitions for visible words not yet in cache
  fetchDefinitionsForPage(page);
}

/** Queue API lookups only for the words currently on screen. */
function fetchDefinitionsForPage(pageWords) {
  pageWords.forEach((word) => {
    // Skip words already definitively cached or covered by SHORT_WORD_DEFS
    if (definitionCache[word] !== undefined) return;
    enqueueApiRequest(word).then(() => {
      // Update the card in-place if it's still visible
      const card = document.getElementById("card-" + word);
      if (card) {
        const def = definitionCache[word] || makeFallbackDef(word);
        const defEl = card.querySelector(".word-def");
        const posEl = card.querySelector(".word-pos");
        if (defEl)
          defEl.textContent =
            def.text.length > 90 ? def.text.slice(0, 90) + "â€¦" : def.text;
        if (posEl) posEl.textContent = def.pos;
      }
    });
  });
}

function renderPagination(total) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) {
    setVisible(pagination, false);
    return;
  }
  setVisible(pagination, true);
  pagination.innerHTML = "";

  const make = (label, page, cls = "") => {
    const btn = document.createElement("button");
    btn.className = "page-btn " + cls;
    btn.innerHTML = label;
    if (page !== null) btn.onclick = () => goToPage(page);
    if (page === currentPage) btn.classList.add("active");
    if (page === null) btn.disabled = true;
    return btn;
  };

  // Prev
  const prev = make(
    "&#8592;",
    currentPage > 1 ? currentPage - 1 : null,
    "arrow",
  );
  if (currentPage === 1) prev.disabled = true;
  pagination.appendChild(prev);

  // Page numbers with ellipsis
  const pages = buildPageRange(currentPage, totalPages);
  pages.forEach((p) => {
    if (p === "...") {
      const dots = document.createElement("span");
      dots.className = "page-dots";
      dots.textContent = "â€¦";
      pagination.appendChild(dots);
    } else {
      pagination.appendChild(make(p, p));
    }
  });

  // Next
  const next = make(
    "&#8594;",
    currentPage < totalPages ? currentPage + 1 : null,
    "arrow",
  );
  if (currentPage === totalPages) next.disabled = true;
  pagination.appendChild(next);

  const existingInfo = pagination.nextElementSibling;
  if (existingInfo && existingInfo.classList.contains("page-info"))
    existingInfo.remove();

  const info = document.createElement("div");
  info.className = "page-info";
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end = Math.min(currentPage * PAGE_SIZE, total);
  info.textContent = `Showing ${start}â€“${end} of ${total} words`;
  pagination.after(info);
}

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({ length: total }, (_, i) => i + 1);
  const pages = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push("...");
    pages.push(total);
  } else if (current >= total - 3) {
    pages.push(1);
    pages.push("...");
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1);
    pages.push("...");
    pages.push(current - 1);
    pages.push(current);
    pages.push(current + 1);
    pages.push("...");
    pages.push(total);
  }
  return pages;
}

function goToPage(page) {
  currentPage = page;
  applySortAndRender();
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}
window.goToPage = goToPage;

function updateStats(words, inputWord) {
  totalCount.textContent = words.length;
  uniqueLetters.textContent = new Set(inputWord.toLowerCase()).size;
  const longest = words.reduce((a, b) => (a.length >= b.length ? a : b), "");
  longestWord.textContent = longest || "â€“";
}

function setVisible(el, v) {
  el.style.display = v ? "" : "none";
}

/**
 * Finds all words formable from `inputWord` using the local DICTIONARY.
 * No external API is called for validation â€” the Set membership check
 * is the only gate. Definitions are fetched lazily per page.
 */
async function findWords() {
  if (!_dictReady) {
    showGFeedback && showGFeedback('Dictionary still loading, please wait...', 'warn');
    const btn = document.getElementById('searchBtn');
    if (btn) { btn.textContent = 'Loading...'; setTimeout(() => { btn.innerHTML = '<span class="btn-text">Find Words</span><span class="btn-icon">→</span>'; }, 1500); }
    return;
  }
  const raw = input.value;
  const word = sanitizeInput(raw).trim();
  input.value = word;

  if (!word) {
    input.focus();
    input.classList.add("shake");
    setTimeout(() => input.classList.remove("shake"), 500);
    return;
  }
  if (word.length < 2) {
    showError("Please enter at least 2 letters.");
    return;
  }

  currentWord = word;

  // Cancel previous search token
  const searchId = ++currentSearch;

  // Reset state
  allFoundWords = [];
  filteredWords = [];
  activeFilter = "all";
  currentPage = 1;
  sortMode = "alpha";
  sortLabel.textContent = "Sort: Aâ€“Z";

  showLetterTiles(word);
  setVisible(heroIntro, false);
  setVisible(statsBar, false);
  setVisible(filterBar, false);
  setVisible(resultsSection, false);
  setVisible(emptyState, false);
  setVisible(loading, true);
  resultsGrid.innerHTML = "";
  setLoadingText("Finding wordsâ€¦");
  updateBackBar();

  await delay(40);
  if (currentSearch !== searchId) return;

  // â”€â”€ Local-only validation (instant, no API) â”€â”€
  const candidates = findCandidates(word);

  if (candidates.length === 0) {
    setVisible(loading, false);
    setVisible(emptyState, true);
    return;
  }

  // Sort: longer words first so the first page is most interesting
  candidates.sort((a, b) => b.length - a.length || a.localeCompare(b));

  // All candidates are valid (they're in the DICTIONARY Set)
  allFoundWords = candidates;
  filteredWords = [...allFoundWords];

  setVisible(loading, false);
  setVisible(resultsSection, true);
  setVisible(statsBar, true);
  setVisible(filterBar, true);

  updateStats(allFoundWords, word);
  buildFilterButtons(allFoundWords);
  applySortAndRender();
}
window.findWords = findWords;

function useExample(word) {
  // Push current search to history before navigating
  if (currentWord && allFoundWords.length > 0) {
    searchHistory.push({
      word: currentWord,
      words: [...allFoundWords],
      cache: { ...definitionCache },
      page: currentPage,
      filter: activeFilter,
      sort: sortMode,
    });
  }
  input.value = word;
  showLetterTiles(word);
  findWords();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.useExample = useExample;

function goBack() {
  if (searchHistory.length === 0) return;
  const prev = searchHistory.pop();

  // Restore snapshot
  Object.assign(definitionCache, prev.cache);
  allFoundWords = prev.words;
  filteredWords =
    prev.filter === "all"
      ? [...allFoundWords]
      : allFoundWords.filter((w) => w.length === prev.filter);
  activeFilter = prev.filter;
  sortMode = prev.sort;
  currentPage = prev.page;
  currentWord = prev.word;
  sortLabel.textContent = sortMode === "alpha" ? "Sort: Aâ€“Z" : "Sort: Length";

  input.value = prev.word;
  showLetterTiles(prev.word);

  // Re-render UI without API calls
  setVisible(heroIntro, false);
  setVisible(emptyState, false);
  setVisible(loading, false);

  const sorted = [...filteredWords];
  if (sortMode === "alpha") sorted.sort((a, b) => a.localeCompare(b));
  else sorted.sort((a, b) => b.length - a.length || a.localeCompare(b));

  updateStats(allFoundWords, prev.word);
  buildFilterButtons(allFoundWords);
  renderWords(sorted);
  renderPagination(sorted.length);

  setVisible(statsBar, true);
  setVisible(filterBar, true);
  setVisible(resultsSection, true);

  updateBackBar();
  window.scrollTo({ top: 0, behavior: "smooth" });
}
window.goBack = goBack;

function updateBackBar() {
  if (searchHistory.length === 0) {
    setVisible(backBar, false);
    return;
  }
  setVisible(backBar, true);

  // Update back button label
  const prevWord = searchHistory[searchHistory.length - 1].word;
  backWord.textContent = prevWord;

  // Build breadcrumb trail
  breadcrumb.innerHTML = "";
  const trail = [...searchHistory.map((h) => h.word), currentWord];
  trail.forEach((w, idx) => {
    const crumb = document.createElement("span");
    crumb.className = "crumb" + (idx === trail.length - 1 ? " current" : "");
    crumb.textContent = w;
    if (idx < trail.length - 1) {
      crumb.onclick = () => jumpToHistory(idx);
    }
    breadcrumb.appendChild(crumb);
    if (idx < trail.length - 1) {
      const sep = document.createElement("span");
      sep.className = "crumb-sep";
      sep.textContent = "â€º";
      breadcrumb.appendChild(sep);
    }
  });
}

function jumpToHistory(targetIdx) {
  while (searchHistory.length > targetIdx + 1) searchHistory.pop();
  goBack();
}

function showError(msg) {
  setVisible(loading, false);
  resultsGrid.innerHTML = `<div style="text-align:center;color:#ff6b9d;padding:20px;font-size:.95rem;grid-column:1/-1;">${msg}</div>`;
  setVisible(resultsSection, true);
  setVisible(heroIntro, false);
}

const shakeStyle = document.createElement("style");
shakeStyle.textContent = `
  @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
  .shake{animation:shake .4s ease!important;}
`;
document.head.appendChild(shakeStyle);

// ── Init: wait for dictionary then reveal app ──
onDictionaryReady(() => {
  // Hide loading overlay
  const loader = document.getElementById('dictLoader');
  if (loader) {
    loader.style.opacity = '0';
    loader.style.pointerEvents = 'none';
    setTimeout(() => loader.remove(), 400);
  }
  // Pre-warm game word pool in background (non-blocking)
  setTimeout(buildGameWordPool, 0);
});

initParticles();
// Focus input after fonts settle
setTimeout(() => { const inp = document.getElementById('wordInput'); if (inp) inp.focus(); }, 200);

// ------------------------------------------
//   GAME MODE
// ------------------------------------------

// -- Game State -----------------------------
let GAME_WORD_POOL = [];
let gamePoolBuilt = false;
let gameActive = false;
let gameWord = "";
let gameAnswer = []; // all valid sub-words (3+ letters)
let gameFound = new Set();
let gameTimerId = null;
let gameSecsLeft = 0;

// -- Build Pool -----------------------------
// Curated list of common, meaningful English words for the game.
// All are well-known words guaranteed to have clear definitions.
const CURATED_GAME_WORDS = [
  // 6-letter common words
  "planet",
  "master",
  "stream",
  "garden",
  "travel",
  "castle",
  "forest",
  "player",
  "mother",
  "finger",
  "winter",
  "spring",
  "strong",
  "bridge",
  "center",
  "change",
  "charge",
  "circle",
  "course",
  "credit",
  "danger",
  "dinner",
  "driver",
  "factor",
  "family",
  "figure",
  "flight",
  "flower",
  "formal",
  "handle",
  "happen",
  "health",
  "height",
  "island",
  "keeper",
  "launch",
  "leader",
  "length",
  "little",
  "lonely",
  "market",
  "mental",
  "mirror",
  "modern",
  "moment",
  "monkey",
  "motion",
  "nation",
  "nature",
  "narrow",
  "notice",
  "object",
  "option",
  "parent",
  "permit",
  "person",
  "plenty",
  "poster",
  "pretty",
  "proper",
  "random",
  "reason",
  "record",
  "repair",
  "rescue",
  "result",
  "return",
  "reveal",
  "reward",
  "rocket",
  "sample",
  "screen",
  "search",
  "second",
  "settle",
  "shadow",
  "signal",
  "simple",
  "single",
  "sister",
  "smooth",
  "social",
  "source",
  "spirit",
  "stable",
  "strain",
  "street",
  "strike",
  "studio",
  "summer",
  "supply",
  "system",
  "target",
  "triple",
  "trophy",
  "useful",
  "valley",
  "vendor",
  "vision",
  "volume",
  "wander",
  "weapon",
  "window",
  "winter",
  "wisdom",
  "wonder",
  "yellow",
  // 7-letter common words
  "account",
  "achieve",
  "advance",
  "already",
  "another",
  "arrange",
  "attempt",
  "balance",
  "captain",
  "capture",
  "certain",
  "chapter",
  "citizen",
  "clarity",
  "classic",
  "collect",
  "comfort",
  "command",
  "comment",
  "compare",
  "complex",
  "concern",
  "connect",
  "contain",
  "context",
  "control",
  "country",
  "courage",
  "curious",
  "current",
  "declare",
  "defense",
  "deliver",
  "deposit",
  "despite",
  "develop",
  "digital",
  "disease",
  "dispute",
  "freedom",
  "general",
  "grammar",
  "imagine",
  "intense",
  "involve",
  "journey",
  "justice",
  "kingdom",
  "morning",
  "mystery",
  "network",
  "nothing",
  "officer",
  "opinion",
  "perfect",
  "picture",
  "popular",
  "protect",
  "provide",
  "quality",
  "realize",
  "recover",
  "release",
  "respect",
  "restore",
  "romance",
  "science",
  "section",
  "service",
  "session",
  "shelter",
  "silence",
  "similar",
  "society",
  "student",
  "subject",
  "success",
  "support",
  "through",
  "tonight",
  "trouble",
  "typical",
  "variety",
  "venture",
  "version",
  "village",
  "virtual",
  "welcome",
  "western",
  "without",
  "century",
  "library",
  "history",
  "feature",
  "payment",
  "present",
  "process",
  "summary",
];

// Called once lazily. Filters curated list to words in DICTIONARY with
// enough sub-words to make the game interesting.
function buildGameWordPool() {
  if (gamePoolBuilt) return;
  gamePoolBuilt = true;
  GAME_WORD_POOL = CURATED_GAME_WORDS.filter((word) => {
    if (!DICTIONARY.has(word)) return false;
    const subs = findGameCandidates(word);
    return subs.length >= 8;
  });
  // Fallback: use the full curated list if filter is too strict
  if (GAME_WORD_POOL.length < 10) {
    GAME_WORD_POOL = CURATED_GAME_WORDS.filter((w) => DICTIONARY.has(w));
  }
}

// Sub-words: all lengths in DICTIONARY, formable from gameWord's letters
function findGameCandidates(inputWord) {
  const letters = inputWord.toLowerCase().split("");
  const res = [];
  for (const word of DICTIONARY) {
    if (word === inputWord.toLowerCase()) continue;
    if (canForm(word, letters)) res.push(word);
  }
  return res;
}

// -- Shuffle helper -------------------------
function shuffleStr(str) {
  const a = str.split("");
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.join("");
}

// -- Timer display --------------------------
function updateGameTimer() {
  const el = document.getElementById("gameTimer");
  if (!el) return;

  if (gameSecsLeft < 0) {
    // Unlimited play
    el.textContent = "∞";
    el.classList.remove("danger");
    return;
  }

  const m = Math.floor(gameSecsLeft / 60)
    .toString()
    .padStart(2, "0");
  const s = (gameSecsLeft % 60).toString().padStart(2, "0");
  el.textContent = m + ":" + s;
  el.classList.toggle("danger", gameSecsLeft <= 60);
}

function tickGameTimer() {
  if (!gameActive) return;
  if (gameSecsLeft < 0) return; // Do not tick if unlimited
  gameSecsLeft--;
  updateGameTimer();
  if (gameSecsLeft <= 0) endGame("timeout");
}

// -- Entry point ----------------------------
// Real-time validation debounce timer
let _customWordTimer = null;

function startGame() {
  if (!_dictReady) {
    alert('Dictionary is still loading. Please wait a moment!');
    return;
  }
  buildGameWordPool();
  // Reset custom input state each time modal opens
  const inp = document.getElementById("customWordInput");
  const err = document.getElementById("customWordError");
  if (inp) {
    inp.value = "";
    inp.className = "custom-word-input";
    // Attach real-time validation (only once)
    if (!inp._dictValidatorAttached) {
      inp._dictValidatorAttached = true;
      inp.addEventListener("input", () => {
        clearTimeout(_customWordTimer);
        const errEl = document.getElementById("customWordError");
        const val = inp.value.trim().toLowerCase();

        // Clear state if empty
        if (!val) {
          inp.className = "custom-word-input";
          if (errEl) { errEl.className = "custom-word-error"; errEl.textContent = ""; }
          return;
        }

        // Debounce 350ms so we don't check on every keystroke
        _customWordTimer = setTimeout(() => {
          if (val.length < 3) {
            inp.className = "custom-word-input invalid";
            if (errEl) { errEl.className = "custom-word-error"; errEl.textContent = "⚠️ Word must be at least 3 letters"; }
            return;
          }
          if (!DICTIONARY.has(val)) {
            inp.className = "custom-word-input invalid";
            if (errEl) { errEl.className = "custom-word-error"; errEl.textContent = `❌ "${val}" is not a valid English word`; }
          } else {
            inp.className = "custom-word-input valid";
            const subs = findGameCandidates(val);
            if (errEl) {
              errEl.className = "custom-word-error success";
              errEl.textContent = subs.length === 0
                ? "✅ Valid word! (No sub-words though — still playable)"
                : `✅ Valid! ${subs.length} sub-word${subs.length > 1 ? "s" : ""} to find`;
            }
          }
        }, 350);
      });
    }
  }
  if (err) err.textContent = "";
  document.getElementById("timePicker").style.display = "flex";
  setTimeout(() => {
    if (inp) inp.focus();
  }, 100);
}
window.startGame = startGame;

function closeTimePicker() {
  document.getElementById("timePicker").style.display = "none";
}
window.closeTimePicker = closeTimePicker;

function clearCustomWord() {
  const inp = document.getElementById("customWordInput");
  const err = document.getElementById("customWordError");
  if (inp) {
    inp.value = "";
    inp.className = "custom-word-input";
  }
  if (err) err.textContent = "";
  if (inp) inp.focus();
}
window.clearCustomWord = clearCustomWord;

// -- Begin game with chosen minutes ---------
function beginGame(minutes) {
  const inp = document.getElementById("customWordInput");
  const err = document.getElementById("customWordError");
  const customVal = inp ? inp.value.trim().toLowerCase() : "";

  // Validate custom word if provided
  if (customVal) {
    if (customVal.length < 3) {
      if (err) err.textContent = "⚠️ Word must be at least 3 letters";
      if (inp) inp.className = "custom-word-input invalid";
      return;
    }

    // ── Dictionary check: từ phải là từ tiếng Anh có nghĩa ──
    if (!DICTIONARY.has(customVal)) {
      if (err) err.textContent = `❌ "${customVal}" is not a valid English word. Please try another word.`;
      if (inp) {
        inp.className = "custom-word-input invalid";
        inp.focus();
        inp.select();
      }
      return;
    }

    const subs = findGameCandidates(customVal);
    // Valid custom word – accept regardless of sub-word count
    if (inp) inp.className = "custom-word-input valid";
    if (err)
      err.textContent =
        subs.length === 0 ? "No sub-words found — but good luck!" : "";
    gameWord = customVal;
    gameAnswer = subs;
  } else {
    // Pick random word from curated pool
    gameWord =
      GAME_WORD_POOL[Math.floor(Math.random() * GAME_WORD_POOL.length)];
    gameAnswer = findGameCandidates(gameWord);
  }

  closeTimePicker();
  gameFound = new Set();
  gameSecsLeft = minutes * 60;
  gameActive = true;

  // (gameAnswer already set above)
  gameFound = new Set();
  gameSecsLeft = minutes * 60;
  gameActive = true;

  // Build tiles in original order
  const scrambled = gameWord;
  const tilesEl = document.getElementById("gameTiles");
  tilesEl.innerHTML = "";
  [...scrambled.toUpperCase()].forEach((ch, i) => {
    const t = document.createElement("div");
    t.className = "game-tile";
    t.textContent = ch;
    t.style.animationDelay = i * 60 + "ms";
    tilesEl.appendChild(t);
  });

  // Reset UI
  document.getElementById("gameProgress").textContent =
    "0 / " + gameAnswer.length;
  document.getElementById("gameFoundGrid").innerHTML = "";
  document.getElementById("gameFeedback").textContent = "";
  document.getElementById("gameFeedback").className = "game-feedback";
  document.getElementById("gameInput").value = "";
  updateGameTimer();

  // Hide search UI, show game screen
  [
    "heroIntro",
    "resultsSection",
    "statsBar",
    "filterBar",
    "emptyState",
    "loading",
    "backBar",
  ].forEach((id) => setVisible(document.getElementById(id), false));
  document.getElementById("gameScreen").style.display = "block";
  document.getElementById("searchSection").style.display = "none";

  setTimeout(() => document.getElementById("gameInput").focus(), 120);

  // Show stop button only for unlimited mode
  const stopRow = document.getElementById("stopGameRow");
  if (stopRow) stopRow.style.display = minutes < 0 ? "flex" : "none";

  gameTimerId = setInterval(tickGameTimer, 1000);
}
window.beginGame = beginGame;

// -- Stop game (Unlimited mode) -------------
function stopGame() {
  endGame("stopped");
}
window.stopGame = stopGame;

// -- Submit a word guess --------------------
function submitGameWord() {
  if (!gameActive) return;
  const inp = document.getElementById("gameInput");
  const word = inp.value.trim().toLowerCase();
  inp.value = "";
  inp.focus();

  if (!word) {
    showGFeedback("Please type a word", "warn");
    return;
  }
  if (gameFound.has(word)) {
    showGFeedback('"' + word + '" already found!', "duplicate");
    return;
  }
  if (gameAnswer.includes(word)) {
    gameFound.add(word);
    showGFeedback('? "' + word + '" — Nice!', "correct");
    addGameFoundCard(word);
    document.getElementById("gameProgress").textContent =
      gameFound.size + " / " + gameAnswer.length;
    if (gameFound.size === gameAnswer.length) endGame("victory");
  } else {
    showGFeedback('? "' + word + '" — Not valid', "wrong");
  }
}
window.submitGameWord = submitGameWord;

function addGameFoundCard(word) {
  const grid = document.getElementById("gameFoundGrid");
  const card = document.createElement("div");
  card.className = "game-found-card";

  const defId = "gdef-" + word;
  card.innerHTML =
    '<div class="gcard-main">' +
      '<span class="gcard-word">' + word + "</span>" +
      '<span class="gcard-len">' + word.length + "L</span>" +
    "</div>" +
    '<div class="gcard-def" id="' + defId + '">...</div>';

  grid.prepend(card);

  // Fetch definition immediately (no throttle for game mode)
  fetchGameDefinition(word, defId);
}

// Fetch a single word definition and update the card element
async function fetchGameDefinition(word, elId) {
  // Use cache if available
  if (definitionCache[word] !== undefined) {
    const def = definitionCache[word];
    const el = document.getElementById(elId);
    if (el) el.textContent = def.text ? "(" + def.pos + ") " + def.text : word;
    return;
  }
  try {
    const res = await fetch(API_BASE + word, {
      signal: AbortSignal.timeout(6000),
    });
    if (!res.ok) throw new Error("no def");
    const data = await res.json();
    const meaning = data[0]?.meanings[0];
    if (!meaning) throw new Error("no meaning");
    const def = {
      pos: meaning.partOfSpeech || "word",
      text: meaning.definitions[0]?.definition || "",
    };
    definitionCache[word] = def;
    const el = document.getElementById(elId);
    if (el) el.textContent = "(" + def.pos + ") " + def.text;
  } catch {
    definitionCache[word] = { pos: "", text: "" };
    const el = document.getElementById(elId);
    if (el) el.textContent = "";
  }
}

function showGFeedback(msg, type) {
  const el = document.getElementById("gameFeedback");
  el.textContent = msg;
  el.className = "game-feedback " + type;
  clearTimeout(el._t);
  el._t = setTimeout(() => {
    el.textContent = "";
    el.className = "game-feedback";
  }, 1800);
}

// -- End game -------------------------------
function endGame(reason) {
  gameActive = false;
  clearInterval(gameTimerId);

  const endBox = document.getElementById("gameEndBox");
  const icon = document.getElementById("gameEndIcon");
  const title = document.getElementById("gameEndTitle");
  const msg = document.getElementById("gameEndMsg");
  const missedSec = document.getElementById("missedSection");
  const missedG = document.getElementById("missedGrid");

  if (reason === "victory") {
    endBox.className = "modal-box victory";
    icon.textContent = "🏆";
    title.textContent = "You Win!";
    msg.textContent =
      "Amazing! You found all " +
      gameAnswer.length +
      ' words hidden in "' +
      gameWord +
      '"!';
    missedSec.style.display = "none";
  } else {
    const missed = gameAnswer.filter((w) => !gameFound.has(w));
    const isStopped = reason === "stopped";
    endBox.className = "modal-box timeout";
    icon.textContent = isStopped ? "⏹" : "⏰";
    title.textContent = isStopped ? "Game Stopped" : "Time's Up!";
    msg.textContent =
      "You found " +
      gameFound.size +
      " of " +
      gameAnswer.length +
      ' words from "' +
      gameWord +
      '".';
    if (missed.length > 0) {
      missedSec.style.display = "block";
      missedG.innerHTML = "";
      missed
        .sort((a, b) => b.length - a.length || a.localeCompare(b))
        .forEach((w) => {
          const sp = document.createElement("span");
          sp.className = "missed-word";
          sp.textContent = w;
          missedG.appendChild(sp);
        });
    } else {
      missedSec.style.display = "none";
    }
  }

  document.getElementById("gameEndModal").style.display = "flex";
}

// -- Play Again / Exit ----------------------
function playAgain() {
  document.getElementById("gameEndModal").style.display = "none";
  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("searchSection").style.display = "";
  startGame();
}
window.playAgain = playAgain;

function exitGame() {
  gameActive = false;
  clearInterval(gameTimerId);
  document.getElementById("gameEndModal").style.display = "none";
  document.getElementById("gameScreen").style.display = "none";
  document.getElementById("searchSection").style.display = "";
  setVisible(document.getElementById("heroIntro"), true);
}
window.exitGame = exitGame;
