function sanitizeFilename(name) {
  return (name || "pin").replace(/[^a-zA-Z0-9_-]/g, "_").slice(0, 40);
}

function getExtension(url) {
  const m = url.match(/\.([a-zA-Z0-9]{3,4})(?:\?|$)/);
  return m ? m[1].toLowerCase() : "jpg";
}

async function resolveWorkingUrl(origUrl, fallbackUrl) {
  if (!origUrl || origUrl === fallbackUrl) return origUrl || fallbackUrl;
  try {
    const resp = await fetch(origUrl, { method: "HEAD" });
    if (resp.ok) return origUrl;
  } catch (_) {}
  return fallbackUrl || origUrl;
}

function downloadFile(url, filename) {
  return new Promise((resolve) => {
    chrome.downloads.download(
      { url, filename, saveAs: false },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          resolve({ ok: false, error: chrome.runtime.lastError.message });
        } else {
          resolve({ ok: true, downloadId });
        }
      }
    );
  });
}

chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
  if (msg?.type === "DOWNLOAD_SINGLE_PIN" && msg.item) {
    (async () => {
      const url = await resolveWorkingUrl(msg.item.origUrl, msg.item.fallbackUrl);
      const ext = getExtension(url);
      const filename = `pinterest_images/pin_${sanitizeFilename(msg.item.id)}.${ext}`;
      const res = await downloadFile(url, filename);
      sendResponse(res);
    })();
    return true;
  }

  if (msg?.type === "BULK_DOWNLOAD_PINS" && Array.isArray(msg.items)) {
    (async () => {
      let started = 0;
      for (const item of msg.items) {
        const url = await resolveWorkingUrl(item.origUrl, item.fallbackUrl);
        const ext = getExtension(url);
        const filename = `pinterest_images/pin_${sanitizeFilename(item.id)}.${ext}`;
        const res = await downloadFile(url, filename);
        if (res.ok) started++;
        await new Promise((r) => setTimeout(r, 200));
      }
      sendResponse({ ok: true, started });
    })();
    return true;
  }
});
