import { defaultFavorites, preparedProfiles } from './config.js';
import { addDays, dayStart, labelDate, nextSmartPlan, sameDay, toMinutes } from './planner.js';

const $ = (selector) => document.querySelector(selector);
const $$ = (selector) => [...document.querySelectorAll(selector)];

const stopName = $('#stop-name');
const favoriteName = $('#favorite-name');
const routeNumber = $('#route-number');
const direction = $('#direction');
const departures = $('#departures');
const clock = $('#current-time');
const swapButton = $('#swap-route');
const dataStatus = $('#data-status');
const contextLabel = $('#context-label');
const modeBadge = $('#mode-badge');
const resetAutoButton = $('#reset-auto');
const customDateInput = $('#custom-date');
const advancedHour = $('#advanced-hour');
const referenceHourSelect = $('#reference-hour');
const departureCountSelect = $('#departure-count');
const settingsDialog = $('#settings-dialog');
const tripsDialog = $('#trips-dialog');
const favoriteEditor = $('#favorite-editor');

const STORAGE_KEYS = {
  favorites: 'tec-widget.favorites-v1',
  departureCount: 'tec-widget.departure-count',
  referenceHour: 'tec-widget.reference-hour'
};

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function loadFavorites() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEYS.favorites));
    if (Array.isArray(saved) && saved.length) {
      return saved.filter((item) => item && preparedProfiles[item.profileId]).map((item, index) => ({
        id: item.id || `favorite-${index}`,
        name: item.name || `Trajet ${index + 1}`,
        profileId: item.profileId,
        days: Array.isArray(item.days) ? item.days.filter((day) => day >= 0 && day <= 6) : [1,2,3,4,5],
        period: ['morning', 'afternoon'].includes(item.period) ? item.period : 'morning',
        startTime: /^\d{2}:\d{2}$/.test(item.startTime || '') ? item.startTime : '07:00'
      }));
    }
  } catch (error) {
    console.info('Favoris locaux invalides, valeurs par défaut utilisées.', error);
  }
  return clone(defaultFavorites);
}

let favorites = loadFavorites();
let scheduleData = null;
let manualFavoriteId = null;
let dateMode = 'auto';
let customDate = null;
let periodMode = 'auto';
let referenceHour = localStorage.getItem(STORAGE_KEYS.referenceHour) || '7';
let departureCount = Number(localStorage.getItem(STORAGE_KEYS.departureCount)) || 3;
let editorDraft = [];
if (departureCount < 2 || departureCount > 5) departureCount = 3;

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function localDateValue(date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

function parseLocalDate(value) {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, month - 1, day, 0, 0, 0, 0);
}

function isServiceActive(serviceId, date) {
  if (!scheduleData) return true;
  const key = dateKey(date);
  const exception = scheduleData.exceptions?.[serviceId]?.[key];
  if (exception === 1) return true;
  if (exception === 2) return false;
  const service = scheduleData.services?.[serviceId];
  if (!service || key < service.start_date || key > service.end_date) return false;
  const fields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return service[fields[date.getDay()]] === '1';
}

function getProfileDepartures(profileId, date) {
  const profile = preparedProfiles[profileId];
  if (!profile) return [];
  if (!scheduleData?.profiles?.[profileId]) {
    return profile.demoDepartures.map((time) => ({ time, service_id: null }));
  }
  return scheduleData.profiles[profileId].filter((item) => isServiceActive(item.service_id, date));
}

function favoriteDepartures(favorite, date) {
  return getProfileDepartures(favorite.profileId, date);
}

function getSmartPlan(now, subset = favorites) {
  return nextSmartPlan({ now, favorites: subset, getDepartures: favoriteDepartures });
}

function periodBounds(period, hour) {
  if (period === 'morning') return { min: 4 * 60, max: 12 * 60 };
  if (period === 'afternoon') return { min: 12 * 60, max: 30 * 60 };
  if (period === 'hour') return { min: Number(hour) * 60, max: 30 * 60 };
  return { min: 0, max: 30 * 60 };
}

function filterForPeriod(items, period, hour, date, now) {
  const { min, max } = periodBounds(period, hour);
  let threshold = min;
  if (period === 'now' && sameDay(date, now)) threshold = now.getHours() * 60 + now.getMinutes();
  return items.filter((item) => {
    const value = toMinutes(item.time);
    return value >= threshold && value < max;
  });
}

function findPlanForPeriod(now, period, hour) {
  for (let offset = 0; offset <= 14; offset += 1) {
    const date = addDays(dayStart(now), offset);
    const current = now.getHours() * 60 + now.getMinutes();
    if (offset === 0) {
      if (period === 'morning' && current >= 12 * 60) continue;
      if (period === 'hour' && current > Number(hour) * 60) continue;
    }

    const candidates = [];
    for (const favorite of favorites) {
      if (!favorite.days.includes(date.getDay())) continue;
      let list = filterForPeriod(favoriteDepartures(favorite, date), period, hour, date, now);
      if (offset === 0) list = list.filter((item) => toMinutes(item.time) >= current);
      if (list.length) candidates.push({ favorite, date, firstDeparture: list[0] });
    }
    if (candidates.length) {
      candidates.sort((a, b) => toMinutes(a.firstDeparture.time) - toMinutes(b.firstDeparture.time));
      return candidates[0];
    }
  }
  return null;
}

function resolveTargetDate(now, smartPlan) {
  if (dateMode === 'today') return dayStart(now);
  if (dateMode === 'tomorrow') return addDays(dayStart(now), 1);
  if (dateMode === 'custom' && customDate) return customDate;
  if (periodMode !== 'auto') {
    return findPlanForPeriod(now, periodMode, referenceHour)?.date || dayStart(now);
  }
  return smartPlan?.date || dayStart(now);
}

function chooseFavorite(date, now, smartPlan) {
  const forced = favorites.find((item) => item.id === manualFavoriteId);
  if (forced) return forced;
  if (dateMode === 'auto' && periodMode === 'auto' && smartPlan) return smartPlan.favorite;

  const eligible = favorites.filter((item) => item.days.includes(date.getDay()));
  if (!eligible.length) return favorites[0];
  if (periodMode === 'morning') return eligible.find((item) => item.period === 'morning') || eligible[0];
  if (periodMode === 'afternoon') return eligible.find((item) => item.period === 'afternoon') || eligible[0];

  const current = sameDay(date, now) ? now.getHours() * 60 + now.getMinutes() : 0;
  const scored = eligible.map((favorite) => {
    const threshold = periodMode === 'hour' ? Number(referenceHour) * 60 : Math.max(current, toMinutes(favorite.startTime));
    const first = favoriteDepartures(favorite, date).find((item) => toMinutes(item.time) >= threshold);
    return { favorite, time: first ? toMinutes(first.time) : Infinity };
  }).sort((a, b) => a.time - b.time);
  return scored[0]?.favorite || eligible[0];
}

function getVisibleDepartures(favorite, date, now) {
  const all = favoriteDepartures(favorite, date);
  if (periodMode === 'auto') {
    const threshold = sameDay(date, now)
      ? Math.max(now.getHours() * 60 + now.getMinutes(), toMinutes(favorite.startTime))
      : toMinutes(favorite.startTime);
    return all.filter((item) => toMinutes(item.time) >= threshold).slice(0, departureCount);
  }
  return filterForPeriod(all, periodMode, referenceHour, date, now).slice(0, departureCount);
}

function syncHourOptions(favorite, date) {
  const hours = favoriteDepartures(favorite, date)
    .map((item) => Number(item.time.split(':')[0]))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);
  const first = hours.length ? Math.min(...hours) : 5;
  const last = hours.length ? Math.max(...hours) : 23;
  const options = Array.from({ length: last - first + 1 }, (_, index) => first + index)
    .map((hour) => new Option(`${String(hour).padStart(2, '0')}h`, String(hour)));
  referenceHourSelect.replaceChildren(...options);
  if (!options.some((option) => option.value === String(referenceHour))) referenceHour = String(first);
  referenceHourSelect.value = String(referenceHour);
}

function periodLabel(favorite) {
  if (periodMode === 'morning') return 'matin';
  if (periodMode === 'afternoon') return 'après-midi';
  if (periodMode === 'hour') return `à partir de ${String(referenceHour).padStart(2, '0')}:00`;
  if (periodMode === 'now') return 'à partir de maintenant';
  return favorite.period === 'morning' ? 'matin' : 'retour';
}

function buildDepartureItem(item, targetDate, now) {
  const li = document.createElement('li');
  const strong = document.createElement('strong');
  const detail = document.createElement('span');
  strong.textContent = item.time.slice(0, 5);

  const busMinutes = toMinutes(item.time);
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (sameDay(targetDate, now) && busMinutes >= nowMinutes) {
    const wait = busMinutes - nowMinutes;
    detail.textContent = wait === 0 ? 'maintenant' : `dans ${wait} min`;
  } else {
    detail.textContent = labelDate(targetDate, now);
  }
  li.append(strong, detail);
  return li;
}

function syncControls() {
  $$('[data-date-mode]').forEach((button) => button.classList.toggle('active', button.dataset.dateMode === dateMode));
  $$('.date-picker').forEach((picker) => picker.classList.toggle('active', dateMode === 'custom'));
  $$('[data-period]').forEach((button) => button.classList.toggle('active', button.dataset.period === periodMode));
  advancedHour.hidden = periodMode !== 'hour';
  departureCountSelect.value = String(departureCount);
  const intelligent = !manualFavoriteId && dateMode === 'auto' && periodMode === 'auto';
  modeBadge.textContent = intelligent ? 'Auto' : 'Manuel';
  resetAutoButton.hidden = intelligent;
}

function render() {
  const now = new Date();
  const forcedFavorite = favorites.find((item) => item.id === manualFavoriteId);
  const smartPlan = getSmartPlan(now, forcedFavorite ? [forcedFavorite] : favorites);
  const targetDate = resolveTargetDate(now, smartPlan);
  const favorite = chooseFavorite(targetDate, now, smartPlan) || favorites[0];
  if (!favorite) return;
  const profile = preparedProfiles[favorite.profileId];
  syncHourOptions(favorite, targetDate);
  const visible = getVisibleDepartures(favorite, targetDate, now);

  clock.textContent = now.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  favoriteName.textContent = favorite.name;
  stopName.textContent = profile.stopName;
  routeNumber.textContent = profile.route;
  direction.textContent = `→ ${profile.direction}`;
  contextLabel.textContent = `${labelDate(targetDate, now)} · ${periodLabel(favorite)}`;

  if (visible.length) {
    departures.replaceChildren(...visible.map((item) => buildDepartureItem(item, targetDate, now)));
  } else {
    const empty = document.createElement('li');
    empty.textContent = `Aucun passage planifié pour ${labelDate(targetDate, now).toLowerCase()} dans cette période.`;
    departures.replaceChildren(empty);
  }

  dataStatus.textContent = scheduleData
    ? `Horaires planifiés TEC · données préparées ${new Date(scheduleData.generated_at).toLocaleDateString('fr-BE')}`
    : 'Horaires planifiés · données de démonstration (GTFS préparé indisponible)';
  syncControls();
}

async function loadSchedules() {
  try {
    const response = await fetch('./data/schedules.json', { cache: 'no-cache' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    scheduleData = await response.json();
  } catch (error) {
    console.info('GTFS préparé indisponible, fallback démo.', error);
    scheduleData = null;
  }
  render();
}

function transportLabel(profileId) {
  const profile = preparedProfiles[profileId];
  return `Ligne ${profile.route} · ${profile.stopName} → ${profile.direction}`;
}

function renderFavoriteEditor() {
  favoriteEditor.replaceChildren(...editorDraft.map((favorite) => {
    const card = document.createElement('section');
    card.className = 'favorite-card';
    card.dataset.favoriteId = favorite.id;

    const nameLabel = document.createElement('label');
    nameLabel.textContent = 'Nom du trajet';
    const nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = favorite.name;
    nameInput.dataset.field = 'name';
    nameLabel.append(nameInput);

    const profileLabel = document.createElement('label');
    profileLabel.textContent = 'Arrêt / ligne / direction';
    const profileSelect = document.createElement('select');
    profileSelect.dataset.field = 'profileId';
    for (const profile of Object.values(preparedProfiles)) {
      profileSelect.add(new Option(transportLabel(profile.id), profile.id));
    }
    profileSelect.value = favorite.profileId;
    profileLabel.append(profileSelect);

    const daysWrap = document.createElement('div');
    const daysTitle = document.createElement('small');
    daysTitle.textContent = 'Jours habituels';
    const days = document.createElement('div');
    days.className = 'days';
    ['D','L','M','M','J','V','S'].forEach((label, day) => {
      const toggle = document.createElement('label');
      toggle.className = 'day-toggle';
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.value = String(day);
      input.dataset.field = 'day';
      input.checked = favorite.days.includes(day);
      toggle.append(input, document.createTextNode(label));
      days.append(toggle);
    });
    daysWrap.append(daysTitle, days);

    const habitGrid = document.createElement('div');
    habitGrid.className = 'habit-grid';
    const periodLabelEl = document.createElement('label');
    periodLabelEl.textContent = 'Période habituelle';
    const periodSelect = document.createElement('select');
    periodSelect.dataset.field = 'period';
    periodSelect.add(new Option('Matin', 'morning'));
    periodSelect.add(new Option('Après-midi / retour', 'afternoon'));
    periodSelect.value = favorite.period;
    periodLabelEl.append(periodSelect);
    const startLabel = document.createElement('label');
    startLabel.textContent = 'À partir de';
    const startInput = document.createElement('input');
    startInput.type = 'time';
    startInput.value = favorite.startTime;
    startInput.dataset.field = 'startTime';
    startLabel.append(startInput);
    habitGrid.append(periodLabelEl, startLabel);

    const remove = document.createElement('button');
    remove.type = 'button';
    remove.className = 'remove-favorite';
    remove.textContent = 'Supprimer ce trajet';
    remove.hidden = editorDraft.length <= 1;
    remove.addEventListener('click', () => {
      editorDraft = editorDraft.filter((item) => item.id !== favorite.id);
      renderFavoriteEditor();
    });

    card.append(nameLabel, profileLabel, daysWrap, habitGrid, remove);
    return card;
  }));
}

function readEditorDraft() {
  return $$('.favorite-card').map((card, index) => {
    const days = [...card.querySelectorAll('[data-field="day"]:checked')].map((input) => Number(input.value));
    return {
      id: card.dataset.favoriteId,
      name: card.querySelector('[data-field="name"]').value.trim() || `Trajet ${index + 1}`,
      profileId: card.querySelector('[data-field="profileId"]').value,
      days: days.length ? days : [1,2,3,4,5],
      period: card.querySelector('[data-field="period"]').value,
      startTime: card.querySelector('[data-field="startTime"]').value || '07:00'
    };
  });
}

swapButton.addEventListener('click', () => {
  const now = new Date();
  const forcedFavorite = favorites.find((item) => item.id === manualFavoriteId);
  const smartPlan = getSmartPlan(now, forcedFavorite ? [forcedFavorite] : favorites);
  const current = chooseFavorite(resolveTargetDate(now, smartPlan), now, smartPlan);
  const index = Math.max(0, favorites.findIndex((item) => item.id === current?.id));
  manualFavoriteId = favorites[(index + 1) % favorites.length]?.id || null;
  render();
});

resetAutoButton.addEventListener('click', () => {
  manualFavoriteId = null;
  dateMode = 'auto';
  periodMode = 'auto';
  customDate = null;
  customDateInput.value = '';
  render();
});

$$('[data-date-mode]').forEach((button) => button.addEventListener('click', () => {
  dateMode = button.dataset.dateMode;
  render();
}));

customDateInput.addEventListener('change', () => {
  if (!customDateInput.value) return;
  customDate = parseLocalDate(customDateInput.value);
  dateMode = 'custom';
  render();
});

$$('[data-period]').forEach((button) => button.addEventListener('click', () => {
  periodMode = button.dataset.period;
  render();
}));

referenceHourSelect.addEventListener('change', () => {
  referenceHour = referenceHourSelect.value;
  localStorage.setItem(STORAGE_KEYS.referenceHour, referenceHour);
  render();
});

departureCountSelect.addEventListener('change', () => {
  departureCount = Number(departureCountSelect.value);
  localStorage.setItem(STORAGE_KEYS.departureCount, String(departureCount));
  render();
});

$('#open-settings').addEventListener('click', () => settingsDialog.showModal());
$('#open-trips').addEventListener('click', () => {
  editorDraft = clone(favorites);
  renderFavoriteEditor();
  tripsDialog.showModal();
});

$('#add-favorite').addEventListener('click', () => {
  const source = Object.keys(preparedProfiles)[0];
  editorDraft.push({
    id: `favorite-${Date.now()}`,
    name: 'Nouveau trajet',
    profileId: source,
    days: [1,2,3,4,5],
    period: 'morning',
    startTime: '07:00'
  });
  renderFavoriteEditor();
});

$('#save-favorites').addEventListener('click', (event) => {
  event.preventDefault();
  favorites = readEditorDraft();
  localStorage.setItem(STORAGE_KEYS.favorites, JSON.stringify(favorites));
  if (!favorites.some((item) => item.id === manualFavoriteId)) manualFavoriteId = null;
  tripsDialog.close();
  render();
});

customDateInput.min = localDateValue(new Date());
departureCountSelect.value = String(departureCount);

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

render();
loadSchedules();
setInterval(render, 60_000);
