// dictionary.js — Lazy loader stub
// DICTIONARY Set sẽ được khởi tạo từ dictionary.json khi app load xong
// Điều này giúp HTML render ngay lập tức không bị block bởi 2MB JS

let DICTIONARY = new Set();
let _dictReady = false;
let _dictCallbacks = [];

function onDictionaryReady(cb) {
  if (_dictReady) { cb(); return; }
  _dictCallbacks.push(cb);
}

(async function loadDictionary() {
  try {
    const res = await fetch('dictionary.json');
    const words = await res.json();
    DICTIONARY = new Set(words);
    _dictReady = true;
    _dictCallbacks.forEach(cb => cb());
    _dictCallbacks = [];
  } catch (e) {
    console.error('Failed to load dictionary:', e);
  }
})();