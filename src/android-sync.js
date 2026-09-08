import { defaultFavorites, preparedProfiles } from './config.js';

const syncButton = document.querySelector('#sync-android');
const syncStatus = document.querySelector('#android-sync-status');

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem('tec-widget.favorites-v1'));
    if (Array.isArray(saved) && saved.length) return saved;
  } catch (error) {
    console.info('Favoris locaux invalides pour la synchronisation Android.', error);
  }
  return defaultFavorites;
}

function currentProfileId() {
  const stop = document.querySelector('#stop-name')?.textContent?.trim();
  const direction = document.querySelector('#direction')?.textContent?.replace(/^→\s*/, '').trim();
  return Object.values(preparedProfiles).find(
    (profile) => profile.stopName === stop && profile.direction === direction,
  )?.id || 'outbound';
}

function currentFavorite(profileId) {
  const favoriteLabel = document.querySelector('#favorite-name')?.textContent?.trim();
  const favorites = loadFavorites();
  return favorites.find((favorite) => favorite.name === favoriteLabel && favorite.profileId === profileId)
    || favorites.find((favorite) => favorite.profileId === profileId)
    || defaultFavorites.find((favorite) => favorite.profileId === profileId);
}

function buildSyncUri() {
  const profileId = currentProfileId();
  const favorite = currentFavorite(profileId);
  const mode = document.querySelector('#mode-badge')?.textContent?.trim().toLowerCase() === 'auto'
    ? 'intelligent'
    : 'manual';
  const period = document.querySelector('[data-period].active')?.dataset.period || 'auto';
  const departureCount = Number(document.querySelector('#departure-count')?.value) || 3;
  const referenceHour = Number(document.querySelector('#reference-hour')?.value) || 7;

  const params = new URLSearchParams({
    favoriteId: favorite?.id || '',
    favoriteName: favorite?.name || document.querySelector('#favorite-name')?.textContent?.trim() || '',
    profileId,
    mode,
    period,
    departureCount: String(Math.min(5, Math.max(2, departureCount))),
    referenceHour: String(Math.min(23, Math.max(0, referenceHour))),
  });

  return `tecwidget://sync?${params.toString()}`;
}

syncButton?.addEventListener('click', () => {
  if (syncStatus) syncStatus.textContent = 'Ouverture de l’application Android…';
  window.location.href = buildSyncUri();
});
