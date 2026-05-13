// ═══════════════════════════════════════════
//   WordCraft – Main Application Logic
//   Validation: local DICTIONARY Set only.
//   Definitions: fetched lazily from API with
//   rate-limit queue + fallback.
// ═══════════════════════════════════════════

// ── State ──────────────────────────────────
let allFoundWords   = [];
let filteredWords   = [];
let activeFilter    = 'all';
let sortMode        = 'alpha';
let currentSearch   = 0;
let currentPage     = 1;
const PAGE_SIZE     = 12;

// Search history for back navigation
let searchHistory   = [];
let currentWord     = '';

// ── Built-in definitions for short / common words ───
// These bypass the API entirely.
const SHORT_WORD_DEFS = {
  // 1-letter
  'a':  { pos: 'article',     text: 'Used before a noun to refer to a single, unspecified thing.' },
  'i':  { pos: 'pronoun',     text: 'Used by a speaker to refer to themselves.' },
  // Prepositions
  'at': { pos: 'preposition', text: 'Expressing location or position in a place.' },
  'in': { pos: 'preposition', text: 'Inside or within a place, time, or situation.' },
  'on': { pos: 'preposition', text: 'Physically in contact with and supported by a surface.' },
  'to': { pos: 'preposition', text: 'Expressing direction or movement toward a place or person.' },
  'of': { pos: 'preposition', text: 'Expressing the relationship between a part and a whole.' },
  'up': { pos: 'adverb',      text: 'Moving toward a higher position or level.' },
  'by': { pos: 'preposition', text: 'Identifying the agent performing an action.' },
  'as': { pos: 'conjunction', text: 'Used to indicate that something happens at the same time.' },
  // Pronouns
  'he': { pos: 'pronoun',     text: 'Used to refer to a male person previously mentioned.' },
  'me': { pos: 'pronoun',     text: 'Used as the object of a verb or preposition, referring to oneself.' },
  'we': { pos: 'pronoun',     text: 'Used by a speaker to refer to themselves and others.' },
  'us': { pos: 'pronoun',     text: 'Object form of "we"; used when the speaker and others are the object.' },
  'it': { pos: 'pronoun',     text: 'Referring to a thing, animal, or idea previously mentioned.' },
  // Verbs
  'am': { pos: 'verb',        text: 'First person singular present tense of "be".' },
  'is': { pos: 'verb',        text: 'Third person singular present tense of "be".' },
  'do': { pos: 'verb',        text: 'Perform or carry out an action or task.' },
  'go': { pos: 'verb',        text: 'Move from one place to another; travel.' },
  'be': { pos: 'verb',        text: 'Exist; have reality or actuality.' },
  // Conjunctions / other
  'or': { pos: 'conjunction', text: 'Used to link alternatives or present a choice.' },
  'so': { pos: 'conjunction', text: 'Therefore; for that reason; as a result.' },
  'if': { pos: 'conjunction', text: 'Introducing a conditional clause; on the condition that.' },
  'no': { pos: 'adverb',      text: 'Used to give a negative response or to deny something.' },
  'my': { pos: 'pronoun',     text: 'Belonging to or associated with the speaker.' },
  'hi': { pos: 'exclamation', text: 'Used as an informal greeting.' },
  'ok': { pos: 'adjective',   text: 'Satisfactory; acceptable; all right.' },
  'oh': { pos: 'exclamation', text: 'Used to express surprise, disappointment, or acknowledgement.' },
  'an': { pos: 'article',     text: 'Used before a vowel sound to refer to a single, unspecified thing.' },
};

// Pre-populate cache so short words bypass API
const definitionCache = { ...SHORT_WORD_DEFS };

// ── DOM Refs ───────────────────────────────
const input          = document.getElementById('wordInput');
const letterTiles    = document.getElementById('letterTiles');
const statsBar       = document.getElementById('statsBar');
const filterBar      = document.getElementById('filterBar');
const resultsSection = document.getElementById('resultsSection');
const resultsGrid    = document.getElementById('resultsGrid');
const loading        = document.getElementById('loading');
const emptyState     = document.getElementById('emptyState');
const heroIntro      = document.getElementById('heroIntro');
const totalCount     = document.getElementById('totalCount');
const uniqueLetters  = document.getElementById('uniqueLetters');
const longestWord    = document.getElementById('longestWord');
const filterBtns     = document.getElementById('filterButtons');
const sortLabel      = document.getElementById('sortLabel');
const pagination     = document.getElementById('pagination');
const backBar        = document.getElementById('backBar');
const backWord       = document.getElementById('backWord');
const breadcrumb     = document.getElementById('breadcrumb');

// ── Background Particles ───────────────────
function initParticles() {
  const container = document.getElementById('particles');
  const colors = ['#7c5cfc','#00d4aa','#ff6b9d','#81d8f7','#ffb56b'];
  for (let i = 0; i < 25; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const size = Math.random() * 6 + 2;
    p.style.cssText = `
      width:${size}px;height:${size}px;
      background:${colors[Math.floor(Math.random()*colors.length)]};
      left:${Math.random()*100}%;
      animation-duration:${Math.random()*15+8}s;
      animation-delay:${Math.random()*10}s;opacity:0;`;
    container.appendChild(p);
  }
}

// ── Input Validation ───────────────────────
function sanitizeInput(val) {
  return val.replace(/[^a-zA-Z]/g, '');
}

input.addEventListener('input', () => {
  const clean = sanitizeInput(input.value);
  if (clean !== input.value) input.value = clean;
  const val = input.value.trim();
  if (val.length > 0) showLetterTiles(val);
  else letterTiles.innerHTML = '';
});

input.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') findWords();
});

// ── Core Algorithm ─────────────────────────
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
  const letters = inputWord.toLowerCase().split('');
  const results = [];
  for (const word of DICTIONARY) {
    if (word === inputWord.toLowerCase()) continue;
    if (canForm(word, letters)) results.push(word);
  }
  return results;
}

// ── Definition API with rate-limit queue ───
const API_BASE = 'https://api.dictionaryapi.dev/api/v2/entries/en/';

// Simple serial queue: one request at a time, 400 ms apart
let _apiQueue    = Promise.resolve();
let _lastReqTime = 0;
const API_INTERVAL_MS = 400; // max ~2.5 req/s

function enqueueApiRequest(word) {
  _apiQueue = _apiQueue.then(async () => {
    // Honour minimum interval between requests
    const now = Date.now();
    const wait = API_INTERVAL_MS - (now - _lastReqTime);
    if (wait > 0) await delay(wait);
    _lastReqTime = Date.now();

    if (definitionCache[word] !== undefined) return; // already cached

    try {
      const res = await fetch(API_BASE + word, { signal: AbortSignal.timeout(8000) });
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
      if (!meaning) { definitionCache[word] = makeFallbackDef(word); return; }
      const def = {
        pos:  meaning.partOfSpeech || 'word',
        text: meaning.definitions[0]?.definition || ''
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
  return { pos: 'word', text: `A valid English word (${word.length} letters).` };
}

function delay(ms) { return new Promise(r => setTimeout(r, ms)); }

// ── UI Helpers ─────────────────────────────
function showLetterTiles(word) {
  letterTiles.innerHTML = '';
  [...word.toUpperCase()].forEach((ch, i) => {
    const tile = document.createElement('div');
    tile.className = 'tile';
    tile.textContent = ch;
    tile.style.animationDelay = `${i * 50}ms`;
    letterTiles.appendChild(tile);
  });
}

function setLoadingText(msg) {
  const p = loading.querySelector('p');
  if (p) p.textContent = msg;
}

function buildFilterButtons(words) {
  const lengths = [...new Set(words.map(w => w.length))].sort((a,b)=>a-b);
  filterBtns.innerHTML = '';
  const makeBtn = (label, val) => {
    const btn = document.createElement('button');
    btn.className = 'filter-btn' + (activeFilter === val ? ' active' : '');
    btn.textContent = label;
    btn.dataset.len = val;
    btn.onclick = () => applyFilter(val);
    filterBtns.appendChild(btn);
  };
  makeBtn(`All (${words.length})`, 'all');
  lengths.forEach(len => {
    const cnt = words.filter(w => w.length === len).length;
    makeBtn(`${len} letter${len>1?'s':''} (${cnt})`, len);
  });
}

function applyFilter(len) {
  activeFilter = len;
  currentPage  = 1;
  filteredWords = len === 'all' ? [...allFoundWords] : allFoundWords.filter(w => w.length === len);
  applySortAndRender();
  document.querySelectorAll('.filter-btn').forEach(b => {
    b.classList.toggle('active', b.dataset.len == len);
  });
}

function toggleSort() {
  sortMode    = sortMode === 'alpha' ? 'length' : 'alpha';
  currentPage = 1;
  sortLabel.textContent = sortMode === 'alpha' ? 'Sort: A–Z' : 'Sort: Length';
  applySortAndRender();
}
window.toggleSort = toggleSort;

function applySortAndRender() {
  const sorted = [...filteredWords];
  if (sortMode === 'alpha') sorted.sort((a,b) => a.localeCompare(b));
  else sorted.sort((a,b) => b.length - a.length || a.localeCompare(b));
  renderWords(sorted);
  renderPagination(sorted.length);
}

function makeWordCard(word, def) {
  const card = document.createElement('div');
  card.className = 'word-card';
  card.id = 'card-' + word;
  card.dataset.len = word.length;
  card.style.cursor = 'pointer';
  card.title = `Click to search "${word}"`;
  card.innerHTML = `
    <div class="word-header">
      <span class="word-text">${word}</span>
      <span class="word-pos">${def.pos}</span>
    </div>
    <div class="word-len"><span>${word.length} letter${word.length>1?'s':''}</span></div>
    <div class="word-def">${def.text.length > 90 ? def.text.slice(0,90)+'…' : def.text}</div>
  `;
  card.addEventListener('click', () => useExample(word));
  return card;
}

/** Render current page of words. Words without a cached def get a spinner placeholder. */
function renderWords(words) {
  resultsGrid.innerHTML = '';
  const start = (currentPage - 1) * PAGE_SIZE;
  const end   = start + PAGE_SIZE;
  const page  = words.slice(start, end);
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
  pageWords.forEach(word => {
    // Skip words already definitively cached or covered by SHORT_WORD_DEFS
    if (definitionCache[word] !== undefined) return;
    enqueueApiRequest(word).then(() => {
      // Update the card in-place if it's still visible
      const card = document.getElementById('card-' + word);
      if (card) {
        const def = definitionCache[word] || makeFallbackDef(word);
        const defEl = card.querySelector('.word-def');
        const posEl = card.querySelector('.word-pos');
        if (defEl) defEl.textContent = def.text.length > 90 ? def.text.slice(0,90)+'…' : def.text;
        if (posEl) posEl.textContent = def.pos;
      }
    });
  });
}

// ── Pagination ─────────────────────────────
function renderPagination(total) {
  const totalPages = Math.ceil(total / PAGE_SIZE);
  if (totalPages <= 1) { setVisible(pagination, false); return; }
  setVisible(pagination, true);
  pagination.innerHTML = '';

  const make = (label, page, cls = '') => {
    const btn = document.createElement('button');
    btn.className = 'page-btn ' + cls;
    btn.innerHTML = label;
    if (page !== null) btn.onclick = () => goToPage(page);
    if (page === currentPage) btn.classList.add('active');
    if (page === null) btn.disabled = true;
    return btn;
  };

  // Prev
  const prev = make('&#8592;', currentPage > 1 ? currentPage - 1 : null, 'arrow');
  if (currentPage === 1) prev.disabled = true;
  pagination.appendChild(prev);

  // Page numbers with ellipsis
  const pages = buildPageRange(currentPage, totalPages);
  pages.forEach(p => {
    if (p === '...') {
      const dots = document.createElement('span');
      dots.className = 'page-dots';
      dots.textContent = '…';
      pagination.appendChild(dots);
    } else {
      pagination.appendChild(make(p, p));
    }
  });

  // Next
  const next = make('&#8594;', currentPage < totalPages ? currentPage + 1 : null, 'arrow');
  if (currentPage === totalPages) next.disabled = true;
  pagination.appendChild(next);

  // Page info text – remove old one first, then insert fresh
  const existingInfo = pagination.nextElementSibling;
  if (existingInfo && existingInfo.classList.contains('page-info')) existingInfo.remove();

  const info = document.createElement('div');
  info.className = 'page-info';
  const start = (currentPage - 1) * PAGE_SIZE + 1;
  const end   = Math.min(currentPage * PAGE_SIZE, total);
  info.textContent = `Showing ${start}–${end} of ${total} words`;
  pagination.after(info);
}

function buildPageRange(current, total) {
  if (total <= 7) return Array.from({length: total}, (_, i) => i + 1);
  const pages = [];
  if (current <= 4) {
    for (let i = 1; i <= 5; i++) pages.push(i);
    pages.push('...'); pages.push(total);
  } else if (current >= total - 3) {
    pages.push(1); pages.push('...');
    for (let i = total - 4; i <= total; i++) pages.push(i);
  } else {
    pages.push(1); pages.push('...');
    pages.push(current - 1); pages.push(current); pages.push(current + 1);
    pages.push('...'); pages.push(total);
  }
  return pages;
}

function goToPage(page) {
  currentPage = page;
  applySortAndRender();
  resultsSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
}
window.goToPage = goToPage;

function updateStats(words, inputWord) {
  totalCount.textContent    = words.length;
  uniqueLetters.textContent = new Set(inputWord.toLowerCase()).size;
  const longest = words.reduce((a,b) => a.length >= b.length ? a : b, '');
  longestWord.textContent   = longest || '–';
}

function setVisible(el, v) { el.style.display = v ? '' : 'none'; }

// ── Main Search ────────────────────────────
/**
 * Finds all words formable from `inputWord` using the local DICTIONARY.
 * No external API is called for validation — the Set membership check
 * is the only gate. Definitions are fetched lazily per page.
 */
async function findWords() {
  const raw  = input.value;
  const word = sanitizeInput(raw).trim();
  input.value = word;

  if (!word) {
    input.focus();
    input.classList.add('shake');
    setTimeout(() => input.classList.remove('shake'), 500);
    return;
  }
  if (word.length < 2) {
    showError('Please enter at least 2 letters.');
    return;
  }

  currentWord = word;

  // Cancel previous search token
  const searchId = ++currentSearch;

  // Reset state
  allFoundWords = [];
  filteredWords = [];
  activeFilter  = 'all';
  currentPage   = 1;
  sortMode      = 'alpha';
  sortLabel.textContent = 'Sort: A–Z';

  showLetterTiles(word);
  setVisible(heroIntro, false);
  setVisible(statsBar, false);
  setVisible(filterBar, false);
  setVisible(resultsSection, false);
  setVisible(emptyState, false);
  setVisible(loading, true);
  resultsGrid.innerHTML = '';
  setLoadingText('Finding words…');
  updateBackBar();

  await delay(40);
  if (currentSearch !== searchId) return;

  // ── Local-only validation (instant, no API) ──
  const candidates = findCandidates(word);

  if (candidates.length === 0) {
    setVisible(loading, false);
    setVisible(emptyState, true);
    return;
  }

  // Sort: longer words first so the first page is most interesting
  candidates.sort((a,b) => b.length - a.length || a.localeCompare(b));

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


// ── Example Words / History ────────────────
function useExample(word) {
  // Push current search to history before navigating
  if (currentWord && allFoundWords.length > 0) {
    searchHistory.push({
      word:    currentWord,
      words:   [...allFoundWords],
      cache:   { ...definitionCache },
      page:    currentPage,
      filter:  activeFilter,
      sort:    sortMode,
    });
  }
  input.value = word;
  showLetterTiles(word);
  findWords();
  window.scrollTo({ top: 0, behavior: 'smooth' });
}
window.useExample = useExample;

function goBack() {
  if (searchHistory.length === 0) return;
  const prev = searchHistory.pop();

  // Restore snapshot
  Object.assign(definitionCache, prev.cache);
  allFoundWords = prev.words;
  filteredWords = prev.filter === 'all'
    ? [...allFoundWords]
    : allFoundWords.filter(w => w.length === prev.filter);
  activeFilter  = prev.filter;
  sortMode      = prev.sort;
  currentPage   = prev.page;
  currentWord   = prev.word;
  sortLabel.textContent = sortMode === 'alpha' ? 'Sort: A–Z' : 'Sort: Length';

  input.value = prev.word;
  showLetterTiles(prev.word);

  // Re-render UI without API calls
  setVisible(heroIntro, false);
  setVisible(emptyState, false);
  setVisible(loading, false);

  const sorted = [...filteredWords];
  if (sortMode === 'alpha') sorted.sort((a,b) => a.localeCompare(b));
  else sorted.sort((a,b) => b.length - a.length || a.localeCompare(b));

  updateStats(allFoundWords, prev.word);
  buildFilterButtons(allFoundWords);
  renderWords(sorted);
  renderPagination(sorted.length);

  setVisible(statsBar, true);
  setVisible(filterBar, true);
  setVisible(resultsSection, true);

  updateBackBar();
  window.scrollTo({ top: 0, behavior: 'smooth' });
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
  breadcrumb.innerHTML = '';
  const trail = [...searchHistory.map(h => h.word), currentWord];
  trail.forEach((w, idx) => {
    const crumb = document.createElement('span');
    crumb.className = 'crumb' + (idx === trail.length - 1 ? ' current' : '');
    crumb.textContent = w;
    if (idx < trail.length - 1) {
      crumb.onclick = () => jumpToHistory(idx);
    }
    breadcrumb.appendChild(crumb);
    if (idx < trail.length - 1) {
      const sep = document.createElement('span');
      sep.className = 'crumb-sep';
      sep.textContent = '›';
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

// ── Shake CSS ──────────────────────────────
const shakeStyle = document.createElement('style');
shakeStyle.textContent = `
  @keyframes shake{0%,100%{transform:translateX(0)}20%{transform:translateX(-6px)}40%{transform:translateX(6px)}60%{transform:translateX(-4px)}80%{transform:translateX(4px)}}
  .shake{animation:shake .4s ease!important;}
`;
document.head.appendChild(shakeStyle);

// ── Init ───────────────────────────────────
initParticles();
input.focus();
