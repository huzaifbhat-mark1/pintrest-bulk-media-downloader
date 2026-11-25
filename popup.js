const pinGridEl = document.getElementById("pinGrid");
const statusEl = document.getElementById("status");
const countBadgeEl = document.getElementById("countBadge");
const selectAllEl = document.getElementById("selectAll");
const downloadSelectedBtn = document.getElementById("downloadSelectedBtn");
const refreshBtn = document.getElementById("refreshBtn");
const scrollToggleBtn = document.getElementById("scrollToggleBtn");

let currentPins = [];
let activeTabId = null;
let isScrolling = false;
let pollTimer = null;

function updateSelectedCount() {
  const checked = pinGridEl.querySelectorAll('input[type="checkbox"]:checked').length;
  downloadSelectedBtn.textContent = `Download Selected (${checked})`;
  downloadSelectedBtn.disabled = checked === 0;
  selectAllEl.checked = currentPins.length > 0 && checked === currentPins.length;
}

function updateScrollUI(scrolling) {
  isScrolling = scrolling;
  scrollToggleBtn.classList.toggle("active", scrolling);
  scrollToggleBtn.textContent = scrolling ? "Stop Scroll" : "Auto-Scroll";
  if (scrolling && !pollTimer) {
    pollTimer = setInterval(loadPins, 1200);
  } else if (!scrolling && pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
  }
}

function renderPins(pins) {
  currentPins = pins;
  countBadgeEl.textContent = `${pins.length} image${pins.length === 1 ? "" : "s"}`;
  pinGridEl.innerHTML = "";

  if (pins.length === 0) {
    pinGridEl.innerHTML = `
      <div class="empty-state">
        No Pinterest images captured yet.<br />
        Open a Pinterest board or search page and scroll (or click <strong>Auto-Scroll</strong>).
      </div>
    `;
    updateSelectedCount();
    return;
  }

  pins.forEach((pin, idx) => {
    const card = document.createElement("div");
    card.className = "pin-card";

    const img = document.createElement("img");
    img.src = pin.thumbUrl;
    img.alt = pin.title;
    img.loading = "lazy";

    const cb = document.createElement("input");
    cb.type = "checkbox";
    cb.checked = true;
    cb.dataset.index = String(idx);
    cb.addEventListener("change", updateSelectedCount);

    const saveBtn = document.createElement("button");
    saveBtn.className = "pin-save";
    saveBtn.textContent = "Save";
    saveBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      saveBtn.textContent = "...";
      chrome.runtime.sendMessage({ type: "DOWNLOAD_SINGLE_PIN", item: pin }, (res) => {
        saveBtn.textContent = res?.ok ? "✓" : "Retry";
      });
    });

    card.addEventListener("click", () => {
      cb.checked = !cb.checked;
      updateSelectedCount();
    });

    card.appendChild(img);
    card.appendChild(cb);
    card.appendChild(saveBtn);
    pinGridEl.appendChild(card);
  });

  updateSelectedCount();
}

async function loadPins() {
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  activeTabId = tab?.id || null;

  if (!activeTabId || !tab.url || !tab.url.includes("pinterest.")) {
    statusEl.textContent = "Open a Pinterest tab first";
    scrollToggleBtn.disabled = true;
    renderPins([]);
    return;
  }

  scrollToggleBtn.disabled = false;
  chrome.tabs.sendMessage(activeTabId, { type: "GET_PINS" }, (res) => {
    if (chrome.runtime.lastError || !res) {
      statusEl.textContent = "Refresh the Pinterest tab once after installing";
      renderPins([]);
      return;
    }
    statusEl.textContent = res.isScrolling ? "Auto-scrolling & collecting..." : "Ready on Pinterest";
    updateScrollUI(Boolean(res.isScrolling));
    renderPins(res.pins || []);
  });
}

scrollToggleBtn.addEventListener("click", () => {
  if (!activeTabId) return;
  const type = isScrolling ? "STOP_AUTO_SCROLL" : "START_AUTO_SCROLL";
  chrome.tabs.sendMessage(activeTabId, { type }, (res) => {
    if (res) {
      updateScrollUI(Boolean(res.isScrolling));
      loadPins();
    }
  });
});

selectAllEl.addEventListener("change", () => {
  const boxes = pinGridEl.querySelectorAll('input[type="checkbox"]');
  boxes.forEach((b) => (b.checked = selectAllEl.checked));
  updateSelectedCount();
});

downloadSelectedBtn.addEventListener("click", () => {
  const checkedBoxes = Array.from(
    pinGridEl.querySelectorAll('input[type="checkbox"]:checked')
  );
  const items = checkedBoxes.map((b) => currentPins[Number(b.dataset.index)]);
  if (items.length === 0) return;

  downloadSelectedBtn.disabled = true;
  downloadSelectedBtn.textContent = `Downloading ${items.length}...`;

  chrome.runtime.sendMessage({ type: "BULK_DOWNLOAD_PINS", items }, (res) => {
    downloadSelectedBtn.textContent = res?.ok
      ? `Started ${res.started} downloads ✓`
      : "Download error";
    setTimeout(updateSelectedCount, 2200);
  });
});

refreshBtn.addEventListener("click", loadPins);
loadPins();
