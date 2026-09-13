window.RACHNA_CONFIG = {
  META_PIXEL_ID: "[YOUR-META-PIXEL-ID]",
  GA4_ID: "[YOUR-GA4-ID]"
};

(function () {
  var cfg = window.RACHNA_CONFIG || {};
  var isReady = function (v) { return v && v.indexOf("YOUR") === -1; };

  if (isReady(cfg.META_PIXEL_ID)) {
    !function (f, b, e, v, n, t, s) {
      if (f.fbq) return; n = f.fbq = function () { n.callMethod ? n.callMethod.apply(n, arguments) : n.queue.push(arguments); };
      if (!f._fbq) f._fbq = n; n.push = n; n.loaded = !0; n.version = "2.0"; n.queue = [];
      t = b.createElement(e); t.async = !0; t.src = v; s = b.getElementsByTagName(e)[0]; s.parentNode.insertBefore(t, s);
    }(window, document, "script", "https://connect.facebook.net/en_US/fbevents.js");
    fbq("init", cfg.META_PIXEL_ID);
    fbq("track", "PageView");

    if (document.body.dataset.view === "product") {
      fbq("track", "ViewContent", { content_type: "product", value: 699, currency: "INR" });
    }
    document.querySelectorAll("[data-track]").forEach(function (el) {
      el.addEventListener("click", function () {
        fbq("track", el.getAttribute("data-track"), { content_type: "product", value: 699, currency: "INR" });
      });
    });
  }

  if (isReady(cfg.GA4_ID)) {
    window.dataLayer = window.dataLayer || [];
    function gtag() { dataLayer.push(arguments); }
    window.gtag = gtag;
    gtag("js", new Date());
    gtag("config", cfg.GA4_ID);
  }
})();