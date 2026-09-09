const LATEST_RELEASE_API = "https://api.github.com/repos/Carouan/TEC_Widget/releases/latest";
const LATEST_RELEASE_PAGE = "https://github.com/Carouan/TEC_Widget/releases/latest";

const downloadLink = document.querySelector("#android-download-link");
const releaseLink = document.querySelector("#android-release-link");

function normaliseVersion(tagName = "") {
  return tagName.replace(/^android-v/, "").trim();
}

function setFallback() {
  if (downloadLink) {
    downloadLink.href = LATEST_RELEASE_PAGE;
    downloadLink.textContent = "Télécharger la dernière APK stable";
  }
  if (releaseLink) releaseLink.href = LATEST_RELEASE_PAGE;
}

async function resolveLatestAndroidRelease() {
  if (!downloadLink || !releaseLink) return;

  setFallback();

  try {
    const response = await fetch(LATEST_RELEASE_API, {
      headers: { Accept: "application/vnd.github+json" },
    });
    if (!response.ok) throw new Error(`GitHub API ${response.status}`);

    const release = await response.json();
    if (release.draft || release.prerelease) throw new Error("Latest release is not stable");

    const apk = Array.isArray(release.assets)
      ? release.assets.find((asset) => asset?.name?.toLowerCase().endsWith(".apk"))
      : null;

    releaseLink.href = release.html_url || LATEST_RELEASE_PAGE;

    if (!apk?.browser_download_url) return;

    const version = normaliseVersion(release.tag_name);
    downloadLink.href = apk.browser_download_url;
    downloadLink.textContent = version
      ? `Télécharger l’APK ${version}`
      : "Télécharger la dernière APK stable";
  } catch (error) {
    console.warn("Impossible de résoudre la dernière release Android", error);
  }
}

resolveLatestAndroidRelease();
