(() => {
  if (window.__pbdInstalled) return;
  window.__pbdInstalled = true;

  const pinStore = new Map(); // key -> { id, title, thumbUrl, origUrl, fallbackUrl }
  let scrollTimer = null;

  function toOriginalUrl(src) {
    return src.replace(/\/(\d+x|736x|564x|474x|236x)\//, "/originals/");
  }

  function toLargeFallback(src) {
    if (/\/(236x|474x|564x)\//.test(src)) {
      return src.replace(/\/(236x|474x|564x)\//, "/736x/");
    }
    return src;
  }

  function extractPinId(img) {
    const link = img.closest('a[href*="/pin/"]') ||
      img.closest('[data-test-id="pin"]')?.querySelector('a[href*="/pin/"]');
    const href = link?.getAttribute("href") || "";
    const match = href.match(/\/pin\/(\d+)/);
    if (match) return match[1];

    // Fallback: hash from filename
    const fileMatch = img.src.match(/\/([a-f0-9]{16,32})\./i);
    return fileMatch ? fileMatch[1].slice(0, 12) : null;
  }

  function scanImages() {
    const imgs = document.querySelectorAll('img[src*="i.pinimg.com"]');
    for (const img of imgs) {
      const src = img.src || "";
      if (!src) continue;
      // Skip tiny profile avatars and UI icons
      if (/_RS\/|\/30x30\/|\/75x75\/|\/60x60\//.test(src)) continue;
      if (img.naturalWidth > 0 && img.naturalWidth < 100) continue;

      const pinId = extractPinId(img);
      if (!pinId) continue;

      const origUrl = toOriginalUrl(src);
      const fallbackUrl = toLargeFallback(src);
      const key = origUrl;

      if (!pinStore.has(key)) {
        const title = (img.alt || `Pin ${pinId}`).replace(/\s+/g, " ").trim().slice(0, 80);
        pinStore.set(key, {
          id: pinId,
          title,
          thumbUrl: src,
          origUrl,
          fallbackUrl
        });
      }
    }
  }

  function startAutoScroll() {
    if (scrollTimer) return;
    scanImages();
    scrollTimer = setInterval(() => {
      window.scrollBy({ top: 750, behavior: "smooth" });
      scanImages();
    }, 950);
  }

  function stopAutoScroll() {
    if (scrollTimer) {
      clearInterval(scrollTimer);
      scrollTimer = null;
    }
  }

  const observer = new MutationObserver(() => scanImages());
  if (document.body) {
    observer.observe(document.body, { childList: true, subtree: true });
    scanImages();
  } else {
    document.addEventListener("DOMContentLoaded", () => {
      observer.observe(document.body, { childList: true, subtree: true });
      scanImages();
    });
  }

  window.addEventListener("scroll", () => scanImages(), { passive: true });

  chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
    if (msg?.type === "GET_PINS") {
      scanImages();
      sendResponse({
        pins: Array.from(pinStore.values()).reverse(),
        isScrolling: Boolean(scrollTimer)
      });
    } else if (msg?.type === "START_AUTO_SCROLL") {
      startAutoScroll();
      sendResponse({ ok: true, isScrolling: true });
    } else if (msg?.type === "STOP_AUTO_SCROLL") {
      stopAutoScroll();
      sendResponse({ ok: true, isScrolling: false });
    } else if (msg?.type === "CLEAR_PINS") {
      pinStore.clear();
      scanImages();
      sendResponse({ ok: true });
    }
  });
})();
