// Daily countdown that resets at 23:59:59 each night.
(function () {
  var el = document.getElementById("countdown");
  if (!el) return;
  function setCount() {
    var now = new Date();
    var end = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59);
    var diff = Math.max(0, end - now);
    var h = Math.floor(diff / 3600000);
    var m = Math.floor((diff % 3600000) / 60000);
    var s = Math.floor((diff % 60000) / 1000);
    el.textContent =
      ("0" + h).slice(-2) + ":" + ("0" + m).slice(-2) + ":" + ("0" + s).slice(-2);
  }
  setCount();
  setInterval(setCount, 1000);
})();

// Footer year.
document.addEventListener("DOMContentLoaded", function () {
  var y = document.getElementById("year");
  if (y) y.textContent = new Date().getFullYear();
});

// Show sticky mobile buy bar only on pages that have the offer section.
(function () {
  var bar = document.getElementById("sticky-buy");
  if (!bar) return;
  if (document.getElementById("offer")) bar.classList.add("show");
})();