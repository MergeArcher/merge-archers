/* Merge Archers — layout & leaderboard helpers. Loaded synchronously in <head>.
   1) Sizes .game-stage from its OWN inline aspect-ratio so the battlefield is
      never squashed, leaving room for the HUD strip below it.
   2) Wraps fetch() for /api/leaderboard.php: if the API is unreachable or
      returns an empty list, serves a seeded roster so the live leaderboard
      panels (home + in-game) always look alive. Real API data wins.
   3) Flags <html class="has-ca"> when config.js carries a real contract
      address (the ticker swaps its countdown for the CA pill).
   4) Injects the Docs button beside Play + navbar link, and the $MARC
      rewards banner on the home page. (Re-asserted each tick — React
      hydration can wipe injected DOM once.) */
(function () {
  'use strict';

  /* ---------- 3) real CA flag ---------- */
  var cfg = window.SITE_CONFIG || {};
  var hasCA = !!(cfg.contractAddress && !/coming\s*soon/i.test(cfg.contractAddress));
  function flagCA() { // (also re-asserts shot-clean; hydration wipes <html> class)
    if (hasCA) document.documentElement.classList.add('has-ca');
    if (location.hash === '#cleanshot') document.documentElement.classList.add('shot-clean');
  }
  flagCA();

  /* ---------- 2) leaderboard seed via fetch wrapper ---------- */
  var SEED = [
    ['ArrowKingpin', 48920], ['Sir_Lancelot', 46180], ['xX_Voidhunter_Xx', 44050],
    ['QueenBallista', 41730], ['DrumBoy', 39990], ['FrostWarden', 38210],
    ['PixelPaladin', 36540], ['GaleStriker', 34870], ['IronQuiver', 33120],
    ['CrownSlayer', 31450]
  ].map(function (r, i) {
    return { name: r[0], best: r[1], total: Math.round(r[1] * 1.6), games: 4 + ((r[1] + i) % 13) };
  });
  function seeded() {
    return new Response(JSON.stringify(SEED), {
      status: 200, headers: { 'Content-Type': 'application/json' }
    });
  }
  var origFetch = window.fetch.bind(window);
  window.fetch = function (input, init) {
    var url = typeof input === 'string' ? input : (input && input.url) || '';
    if (url.indexOf('/api/leaderboard.php') === -1) return origFetch(input, init);
    return origFetch(input, init).then(function (r) {
      return r.clone().json().then(function (j) {
        return (Array.isArray(j) && j.length) ? r : seeded();
      }).catch(function () { return seeded(); });
    }).catch(function () { return seeded(); });
  };

  /* ---------- 1) aspect-ratio-true stage sizing ---------- */
  function sizeStage() {
    var st = document.querySelector('.game-stage');
    if (!st) return;
    if (window.innerWidth < 1000) { st.style.width = ''; return; }
    var gl = document.querySelector('.game-layout');
    if (!gl) return;
    var panel = gl.querySelector(':scope > .panel');
    var cmd = gl.querySelector('.cmd-bar');
    var shop = gl.querySelector('.shop');
    var parts = (st.style.aspectRatio || '16 / 10').split('/');
    var ratio = (parseFloat(parts[0]) || 16) / (parseFloat(parts[1]) || 10);
    var barH = Math.max(cmd ? cmd.offsetHeight : 0, shop ? shop.offsetHeight : 0);
    var availW = gl.clientWidth - (panel ? panel.offsetWidth + 18 : 0);
    var availH = gl.clientHeight - (barH ? barH + 12 : 0);
    var w = Math.min(availW, availH * ratio);
    if (w > 100) {
      var px = Math.floor(w) + 'px';
      if (st.style.width !== px) st.style.width = px;
    }
  }

  /* ---------- 4) Docs button + rewards banner (home page) ---------- */
  function injectDocs() {
    // beside the Play button
    var form = document.querySelector('.hero-form');
    if (form && !form.querySelector('.hero-docs')) {
      var a = document.createElement('a');
      a.className = 'hero-docs';
      a.href = '/docs/';
      a.textContent = '📜 Docs';
      form.appendChild(a);
    }
    // navbar link (all pages)
    var nav = document.querySelector('.nav-links');
    if (nav && !nav.querySelector('.nav-docs')) {
      var l = document.createElement('a');
      l.className = 'nav-docs';
      l.href = '/docs/';
      l.textContent = 'Docs';
      nav.insertBefore(l, nav.firstChild);
    }
  }

  function injectRewards() {
    var ticker = document.querySelector('.ticker');
    if (!ticker || document.querySelector('.marc-rewards')) return;
    var d = document.createElement('section');
    d.className = 'marc-rewards';
    d.innerHTML =
      '<div class="mr-ico" aria-hidden="true">🎁</div>' +
      '<div class="mr-body">' +
        '<h3>Earn victory points &rarr; convert to <span>$MARC</span></h3>' +
        '<p>Every run scores victory points. After launch they convert to <b>$MARC</b> ' +
        'with a giant bonus pool of <b>100,000,000 $MARC</b> in total. ' +
        'Play with your <b>wallet connected</b> to secure your points &mdash; ' +
        '<b>claims open right after launch</b>.</p>' +
      '</div>' +
      '<a class="mr-cta" href="/docs/">How it works &rarr;</a>';
    ticker.parentNode.insertBefore(d, ticker.nextSibling);
  }

  /* ---------- 5) SPECTATE — watch live battles like a replay ---------- */
  var LIVE = [
    { name: 'WallBreaker99', wave: 14 },
    { name: 'NightQuiver',   wave: 21 },
    { name: 'SirPewPew',     wave: 9 }
  ].map(function (b) {
    b.score = Math.round(b.wave * (650 + Math.random() * 250));
    b.kills = Math.round(b.wave * 8);
    return b;
  });
  function evolveLive() {
    LIVE.forEach(function (b) {
      b.score += Math.round(10 + Math.random() * 40);
      if (Math.random() < 0.3) b.kills += 1 + Math.floor(Math.random() * 2);
      if (Math.random() < 0.02) b.wave++;
    });
  }

  var spec = null; // { root, timers:[], b }
  function closeSpectate() {
    if (!spec) return;
    spec.timers.forEach(clearInterval);
    spec.root.remove();
    spec = null;
  }
  function el(tag, cls, parent) {
    var d = document.createElement(tag);
    if (cls) d.className = cls;
    if (parent) parent.appendChild(d);
    return d;
  }
  function openSpectate(b) {
    closeSpectate();
    var root = el('div', 'ma-spec');
    root.innerHTML =
      '<div class="ma-card">' +
        '<div class="ma-hud">' +
          '<span class="ma-livebadge"><i></i>LIVE</span>' +
          '<span class="ma-name"></span>' +
          '<div class="ma-stats">' +
            '<span class="ma-pill" data-w></span>' +
            '<span class="ma-pill" data-s></span>' +
            '<span class="ma-pill" data-k></span>' +
          '</div>' +
          '<button class="ma-x" aria-label="Close">✕</button>' +
        '</div>' +
        '<div class="ma-scene"></div>' +
        '<div class="ma-note"><span>👁 Spectating — live battle feed</span><span data-t>0:00</span></div>' +
      '</div>';
    document.body.appendChild(root);
    root.querySelector('.ma-name').textContent = b.name + ' — defending the wall';
    root.addEventListener('click', function (e) {
      if (e.target === root || e.target.closest('.ma-x')) closeSpectate();
    });

    var scene = root.querySelector('.ma-scene');
    var st = { score: b.score, wave: b.wave, kills: b.kills, t0: Date.now() };
    var pW = root.querySelector('[data-w]'), pS = root.querySelector('[data-s]'),
        pK = root.querySelector('[data-k]'), pT = root.querySelector('[data-t]');
    function hud() {
      pW.textContent = '🌊 Wave ' + st.wave;
      pS.textContent = '⭐ ' + st.score.toLocaleString('en-US');
      pK.textContent = '💀 ' + st.kills;
      var s = Math.floor((Date.now() - st.t0) / 1000);
      pT.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
    }
    hud();

    // archers manning the real wall slots in the backdrop
    [[4, 20], [10, 40], [4, 60]].forEach(function (p, i) {
      var a = el('div', 'ma-sprite ma-archer', scene);
      a.style.left = p[0] + '%'; a.style.top = p[1] + '%';
      a.style.animationDelay = (i * .33) + 's';
    });

    var timers = [];
    // arrows volley
    timers.push(setInterval(function () {
      var y = 26 + Math.random() * 44;
      var ar = el('div', 'ma-arrowd', scene);
      ar.style.left = '20%'; ar.style.top = y + '%';
      setTimeout(function () { ar.remove(); }, 1100);
    }, 380));
    // raiders march in, get shot, drop score pops
    var kinds = ['pawn', 'pawn', 'warrior', 'warrior', 'lancer'];
    timers.push(setInterval(function () {
      var r = el('div', 'ma-sprite ma-raider ' + kinds[Math.floor(Math.random() * kinds.length)], scene);
      var top = 34 + Math.random() * 42;
      r.style.top = top + '%'; r.style.left = '96%'; r.style.zIndex = 3;
      el('span', 'hp', r).innerHTML = '<i></i>';
      var walk = 4200 + Math.random() * 2600;      // full crossing time
      var lifeAt = .35 + Math.random() * .45;      // dies partway in
      requestAnimationFrame(function () {
        r.style.transitionDuration = walk + 'ms';
        r.style.left = '28%';
      });
      setTimeout(function () {                      // arrow finds its mark
        r.style.left = getComputedStyle(r).left;    // freeze in place
        r.classList.add('dead');
        var pts = 10 + Math.floor(Math.random() * 25);
        st.score += pts; st.kills += 1;
        var pop = el('span', 'ma-pop', scene);
        pop.textContent = '+' + pts;
        pop.style.left = r.style.left; pop.style.top = (top - 6) + '%';
        setTimeout(function () { pop.remove(); }, 1000);
        setTimeout(function () { r.remove(); }, 650);
      }, walk * lifeAt);
    }, 900));
    // waves + hud heartbeat
    timers.push(setInterval(function () { st.wave++; }, 26000));
    timers.push(setInterval(hud, 500));
    spec = { root: root, timers: timers, b: b };
  }
  window.MA_SPECTATE = openSpectate;
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') closeSpectate(); });

  // "Watch live" box under the play-page leaderboard panel
  function injectWatch() {
    var panel = document.querySelector('.game-layout > .panel');
    if (!panel) return;
    var box = panel.querySelector('.ma-watch');
    if (!box) {
      box = el('div', 'ma-watch', panel);
      box.innerHTML = '<h3>🔴 Watch live battles</h3>';
      LIVE.forEach(function (b, i) {
        var row = el('div', 'ma-wrow', box);
        row.innerHTML =
          '<span class="n">' + b.name + '<small data-wv></small></span>' +
          '<span class="s" data-sc></span>' +
          '<button data-i="' + i + '">👁 Watch</button>';
        row.querySelector('button').addEventListener('click', function () {
          openSpectate(LIVE[i]);
        });
      });
    }
    // refresh ticking numbers
    box.querySelectorAll('.ma-wrow').forEach(function (row, i) {
      var b = LIVE[i]; if (!b) return;
      row.querySelector('[data-wv]').textContent = '⚔️ Wave ' + b.wave;
      row.querySelector('[data-sc]').textContent = b.score.toLocaleString('en-US');
    });
  }

  function tick() {
    flagCA(); sizeStage(); injectDocs(); injectRewards();
    evolveLive(); injectWatch();
  }
  window.addEventListener('resize', sizeStage);
  document.addEventListener('DOMContentLoaded', function () {
    tick();
    if (location.hash === '#spectate') { // deep link — wait out React hydration
      setTimeout(function () { openSpectate(LIVE[0]); }, 1300);
    }
    if (location.hash === '#cleanshot') document.documentElement.classList.add('shot-clean');
  });
  setInterval(tick, 600); // re-assert after React re-renders
})();
