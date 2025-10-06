// BlackJack Update Checker
// Dependency-free update checking functionality

// GitHub repository configuration
const GH_RAW_VERSION_URL = "https://raw.githubusercontent.com/Zmk55/BlackJack/main/VERSION";

/**
 * Compare two semantic version strings
 * @param {string} a - First version string
 * @param {string} b - Second version string
 * @returns {number} -1 if a < b, 0 if a == b, 1 if a > b
 */
function cmpSemver(a, b) {
    const toNum = v => v.split("-")[0].split(".").map(x => parseInt(x || "0", 10));
    const pa = toNum(a), pb = toNum(b);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
        const x = pa[i] || 0, y = pb[i] || 0;
        if (x > y) return 1;
        if (x < y) return -1;
    }
    return 0;
}

/**
 * Fetch the latest version from GitHub
 * @returns {Promise<string>} Latest version string
 */
async function fetchLatestVersion() {
    const url = `${GH_RAW_VERSION_URL}?_=${Date.now()}`; // bust caches
    const res = await fetch(url, { cache: "no-store" });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return (await res.text()).trim();
}

/**
 * Reload the page with cache-busting parameters
 * @param {string} latest - Latest version string
 */
function cacheBustedReload(latest) {
    const u = new URL(window.location.href);
    u.searchParams.set("v", latest);
    u.searchParams.set("t", String(Date.now()));
    // Optional SW-aware reload; see below
    window.location.replace(u.toString());
}

/**
 * Update service worker if present
 * @returns {Promise<boolean>} True if service worker was updated
 */
async function maybeUpdateServiceWorker() {
    if (!("serviceWorker" in navigator)) return false;
    const reg = await navigator.serviceWorker.getRegistration();
    if (!reg) return false;

    await reg.update().catch(() => {});
    if (reg.waiting) {
        reg.waiting.postMessage({ type: "SKIP_WAITING" });
        return new Promise(resolve => {
            navigator.serviceWorker.addEventListener("controllerchange", () => resolve(true), { once: true });
        });
    }
    return false;
}

/**
 * Manual check for updates (triggered by button click)
 */
async function manualCheckForUpdates() {
    const current = window.BLACKJACK_VERSION || "0.0.0";
    try {
        const latest = await fetchLatestVersion();
        const newer = cmpSemver(latest, current) > 0;

        if (!newer) {
            alert(`You're up to date (v${current}).`);
            return;
        }

        const ok = confirm(`BlackJack v${latest} is available (you have v${current}). Reload now?`);
        if (!ok) return;

        // Try SW fast-path; then reload
        try { await maybeUpdateServiceWorker(); } catch {}
        cacheBustedReload(latest);
    } catch (e) {
        console.error("Update check failed:", e);
        alert("Could not check for updates. Try again later.");
    }
}

/**
 * Passive check for updates on page load
 */
async function passiveCheckOnLoad() {
    const banner = document.getElementById("update-banner");
    if (!banner) return;

    const current = window.BLACKJACK_VERSION || "0.0.0";
    try {
        const latest = await fetchLatestVersion();
        if (cmpSemver(latest, current) <= 0) return;

        banner.style.display = "block";
        banner.innerHTML = `
            <div class="update-banner-content">
                <div class="update-banner-text">
                    <span>🔄 New version <strong>v${latest}</strong> available</span>
                </div>
                <div class="update-banner-actions">
                    <button id="update-reload" type="button">Reload</button>
                    <button id="update-dismiss" type="button" aria-label="Dismiss">Dismiss</button>
                </div>
            </div>
        `;
        document.getElementById("update-reload")?.addEventListener("click", async () => {
            try { await maybeUpdateServiceWorker(); } catch {}
            cacheBustedReload(latest);
        });
        document.getElementById("update-dismiss")?.addEventListener("click", () => {
            banner.style.display = "none";
        });
    } catch (e) {
        // Fail silently
        console.debug("Passive update check failed", e);
    }
}

// Wire up on DOM ready
document.addEventListener("DOMContentLoaded", () => {
    document.getElementById("check-updates-btn")
        ?.addEventListener("click", () => manualCheckForUpdates());
    passiveCheckOnLoad();
});

// Export for manual use
window.manualCheckForUpdates = manualCheckForUpdates;
