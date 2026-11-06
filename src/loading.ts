// The loading screen in index.html. It shows while the game downloads and builds its first picture, and goes away
// once that picture is on screen.

/** Fades the loading screen out and removes it. Safe to call more than once. */
export function hideLoading(): void {
  const el = document.getElementById("loading");
  if (!el || el.dataset.done) return;
  el.dataset.done = "1";
  // Still waiting to fade in (a quick start): nobody saw it, so it just goes.
  const shown = parseFloat(getComputedStyle(el).opacity) || 0;
  if (shown < 0.05) {
    el.remove();
    return;
  }
  // Hold it where its fade-in got to, then fade out from there.
  el.style.animation = "none";
  el.style.opacity = String(shown);
  void el.offsetWidth;
  el.style.opacity = "0";
  window.setTimeout(() => el.remove(), 400);
}
