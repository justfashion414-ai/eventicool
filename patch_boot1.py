import io
p = 'index.html'
s = io.open(p, encoding='utf-8').read()
old = """  <body>
    <div id="root"></div>"""
new = """  <body>
    <div id="root"></div>
    <script>
    // BOOT WATCHDOG: if the app has not painted anything after 8 seconds, or
    // the module bundle itself fails to load (a cached page pointing at a
    // bundle a new deploy replaced), reload once with a cache-buster instead
    // of leaving the visitor on the splash until they refresh by hand.
    (function () {
      var retried = false;
      try { retried = !!sessionStorage.getItem('ev-boot-retry'); } catch (e) {}
      if (retried) return;
      var forceReload = function () {
        if (retried) return;
        retried = true;
        try { sessionStorage.setItem('ev-boot-retry', '1'); } catch (e) {}
        var q = location.search;
        q += (q ? '&' : '?') + 'cb=' + Date.now();
        location.replace(location.pathname + q + location.hash);
      };
      window.addEventListener('error', function (e) {
        var t = e.target;
        if (t && t.tagName === 'SCRIPT' && (t.getAttribute('type') === 'module' || (t.src || '').indexOf('/assets/') > -1)) forceReload();
      }, true);
      setTimeout(function () {
        var r = document.getElementById('root');
        if (!r || !r.hasChildNodes()) forceReload();
      }, 8000);
    })();
    </script>"""
assert old in s, 'index.html anchor not found'
s = s.replace(old, new, 1)
io.open(p, 'w', encoding='utf-8').write(s)
print('index.html ok')
