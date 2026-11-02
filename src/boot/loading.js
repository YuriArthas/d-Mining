/* Inline loading UI only. No network reporting or performance collection. */
(function () {
  'use strict';
  var packs = window.__MINING_BOOT_LOCALES__;
  var known = function (v) { return packs.some(function (p) { return p.id === v; }) ? v : null; };
  var asked = known(new URLSearchParams(location.search).get('lang')), saved = null;
  try { saved = known(localStorage.getItem('mining.language')); } catch (_) {}
  var lang = asked || saved || 'en';
  var pack = packs.find(function (p) { return p.id === lang; });
  document.documentElement.lang = pack.locale;
  var say = function (id) { if (!(id in pack.messages)) throw Error('Missing boot message: ' + id); return pack.messages[id]; };
  var started = Date.now(), failed = false, ready = false, timer;
  function show() {
    var label = document.getElementById('boot-status');
    if (!label) return;
    var seconds = Math.floor((Date.now() - started) / 1000);
    label.textContent = failed
      ? say('boot.failed')
      : seconds >= 30
        ? say('boot.wait')
        : say('boot.entering_the_mine');
    var detail = document.getElementById('boot-detail');
    if (detail) {
      detail.hidden = !failed;
      detail.textContent = failed ? say('boot.failure_detail') : '';
    }
    var busy = document.getElementById('boot-busy'); if (busy) busy.hidden = failed;
    var retry = document.getElementById('boot-retry'); if (retry) retry.hidden = !failed && seconds < 30;
  }
  function fail() { if (!ready) { failed = true; show(); } }
  function done() { ready = true; clearInterval(timer); }
  window.addEventListener('error', function (event) {
    if ((!event.target || event.target === window || event.target.tagName === 'SCRIPT') && document.getElementById('boot-status')) fail();
  }, true);
  window.addEventListener('unhandledrejection', function () { if (document.getElementById('boot-status')) fail(); });
  document.addEventListener('DOMContentLoaded', function () {
    document.querySelectorAll('[data-msg]').forEach(function (e) { e.textContent = say(e.getAttribute('data-msg')); });
    document.querySelectorAll('[data-msg-label]').forEach(function (e) { e.setAttribute('aria-label', say(e.getAttribute('data-msg-label'))); });
    show();
    var retry = document.getElementById('boot-retry');
    if (retry) retry.onclick = function () { var url = new URL(location.href); url.searchParams.set('bootRetry', String(Date.now())); location.replace(url.href); };
  });
  timer = setInterval(show, 2000);
  window.__MINING_BOOT__ = { fail: fail, ready: done };
}());
