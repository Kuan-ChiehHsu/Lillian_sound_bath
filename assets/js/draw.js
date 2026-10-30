// =============================================================
// draw.js — Homepage daily draw inside the profile card.
// One card per browser per local day. Another browser gets
// another combination. Clicking again replays the same card.
// =============================================================

(function () {
  'use strict';

  var STORAGE_KEY = 'lillian-draw-user';
  var SEEN_KEY = 'lillian-draw-seen';
  var TURN_MS = 700;
  var REPEAT_HOLD_MS = 1500;

  var root = document.querySelector('.profile-draw');
  var dataEl = document.getElementById('profile-draw-data');
  if (!root || !dataEl) return;

  var button = root.querySelector('.profile-draw-button');
  var back = root.querySelector('.profile-draw-back');
  var repeatNote = root.querySelector('.profile-draw-repeat');
  var result = root.querySelector('.profile-draw-result');
  if (!button || !back || !repeatNote || !result) return;

  var data;
  try {
    data = JSON.parse(dataEl.textContent);
  } catch (e) {
    return;
  }

  var pools = {
    love: asList(data.love),
    career: asList(data.career),
    wealth: asList(data.wealth),
    deity: asList(data.deity)
  };
  if (!pools.love.length || !pools.career.length || !pools.wealth.length || !pools.deity.length) {
    return;
  }

  var reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var card = todaysCard(pools);
  var busy = false;

  button.addEventListener('click', function () {
    if (busy) return;
    reveal();
  });

  function reveal() {
    var repeat = drawnToday();
    var turn = reducedMotion ? 0 : TURN_MS;
    var hold = repeat ? (reducedMotion ? 900 : REPEAT_HOLD_MS) : 0;
    busy = true;
    button.disabled = true;
    result.textContent = '';
    hideRepeat();
    back.hidden = false;
    back.classList.remove('is-animating');
    // Restart the fixed animation on every click.
    void back.offsetWidth;
    if (!reducedMotion) back.classList.add('is-animating');

    if (repeat) {
      window.setTimeout(function () {
        showRepeat();
      }, Math.floor(turn * 0.45));
    }

    window.setTimeout(function () {
      back.hidden = true;
      back.classList.remove('is-animating');
      hideRepeat();
      render(result, card);
      markDrawnToday();
      button.textContent = '再看一次';
      button.disabled = false;
      busy = false;
    }, turn + hold);
  }

  function showRepeat() {
    repeatNote.hidden = false;
    back.classList.add('is-repeat');
    back.removeAttribute('aria-hidden');
  }

  function hideRepeat() {
    repeatNote.hidden = true;
    back.classList.remove('is-repeat');
    back.setAttribute('aria-hidden', 'true');
  }

  function render(container, drawn) {
    container.textContent = '';
    appendBlock(container, '愛情', drawn.love);
    appendBlock(container, '事業', drawn.career);
    appendBlock(container, '財運', drawn.wealth);
    appendDeity(container, drawn.deity);
  }

  function appendBlock(container, label, line) {
    var block = document.createElement('section');
    block.className = 'profile-draw-block';
    var heading = document.createElement('p');
    heading.className = 'profile-draw-label';
    heading.textContent = label;
    var text = document.createElement('p');
    text.className = 'profile-draw-line';
    text.textContent = line;
    block.appendChild(heading);
    block.appendChild(text);
    container.appendChild(block);
  }

  function appendDeity(container, deity) {
    var block = document.createElement('section');
    block.className = 'profile-draw-block';
    var heading = document.createElement('p');
    heading.className = 'profile-draw-label';
    heading.textContent = '神諭';
    var name = document.createElement('p');
    name.className = 'profile-draw-deity';
    name.textContent = deity && deity.name ? deity.name : '';
    var text = document.createElement('p');
    text.className = 'profile-draw-line';
    text.textContent = deity && deity.line ? deity.line : '';
    block.appendChild(heading);
    block.appendChild(name);
    block.appendChild(text);
    container.appendChild(block);
  }

  function todaysCard(source) {
    var rng = mulberry32(hashString(userId() + ':' + localDate()));
    return {
      love: pick(rng, source.love),
      career: pick(rng, source.career),
      wealth: pick(rng, source.wealth),
      deity: pick(rng, source.deity)
    };
  }

  function pick(rng, list) {
    return list[Math.floor(rng() * list.length)];
  }

  function localDate() {
    var now = new Date();
    return now.getFullYear() + '-' + pad(now.getMonth() + 1) + '-' + pad(now.getDate());
  }

  function pad(n) {
    return (n < 10 ? '0' : '') + n;
  }

  function drawnToday() {
    var today = localDate();
    try {
      return localStorage.getItem(SEEN_KEY) === today;
    } catch (e) {
      return drawnToday.memory === today;
    }
  }

  function markDrawnToday() {
    var today = localDate();
    try {
      localStorage.setItem(SEEN_KEY, today);
    } catch (e) {
      drawnToday.memory = today;
    }
  }

  function userId() {
    try {
      var existing = localStorage.getItem(STORAGE_KEY);
      if (existing) return existing;
      var created = createId();
      localStorage.setItem(STORAGE_KEY, created);
      return created;
    } catch (e) {
      if (!userId.fallback) userId.fallback = createId();
      return userId.fallback;
    }
  }

  function createId() {
    var bytes = new Uint8Array(16);
    if (window.crypto && window.crypto.getRandomValues) {
      window.crypto.getRandomValues(bytes);
    } else {
      for (var i = 0; i < bytes.length; i++) bytes[i] = Math.floor(Math.random() * 256);
    }
    var hex = '';
    for (var j = 0; j < bytes.length; j++) {
      var piece = bytes[j].toString(16);
      hex += piece.length === 1 ? '0' + piece : piece;
    }
    return hex;
  }

  // FNV-1a, then mulberry32. Same id and local date always yield the same card.
  function hashString(value) {
    var hash = 2166136261;
    for (var i = 0; i < value.length; i++) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
  }

  function mulberry32(seed) {
    var a = seed >>> 0;
    return function () {
      a = (a + 0x6D2B79F5) | 0;
      var t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function asList(value) {
    return Object.prototype.toString.call(value) === '[object Array]' ? value : [];
  }
})();
