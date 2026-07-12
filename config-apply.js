/* Applies window.SITE_CONFIG.socials to the header links. Auto-loaded. */
(function () {
  function apply() {
    var c = (window.SITE_CONFIG && window.SITE_CONFIG.socials) || {};
    var map = {
      "X (Twitter)": c.x, "X": c.x,
      "Telegram": c.telegram,
      "GitHub": c.github
    };
    var links = document.querySelectorAll('.nav-links a[aria-label]');
    for (var i = 0; i < links.length; i++) {
      var u = map[links[i].getAttribute('aria-label')];
      if (u) links[i].href = u;
    }
  }
  if (document.readyState !== 'loading') apply();
  else document.addEventListener('DOMContentLoaded', apply);
  setTimeout(apply, 600);   // re-apply after React hydration, just in case
  setTimeout(apply, 1800);
})();
