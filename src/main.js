import { commuteProfiles } from './config.js';

const stopName = document.querySelector('#stop-name');
const routeNumber = document.querySelector('#route-number');
const direction = document.querySelector('#direction');
const departures = document.querySelector('#departures');
const clock = document.querySelector('#current-time');
const swapButton = document.querySelector('#swap-route');
const dataStatus = document.querySelector('#data-status');
const referenceHourSelect = document.querySelector('#reference-hour');
const departureCountSelect = document.querySelector('#departure-count');

const STORAGE_KEYS = {
  referenceHour: 'tec-widget.reference-hour',
  departureCount: 'tec-widget.departure-count'
};

let forcedProfileId = null;
let scheduleData = null;
let referenceHour = localStorage.getItem(STORAGE_KEYS.referenceHour) || 'now';
let departureCount = Number(localStorage.getItem(STORAGE_KEYS.departureCount)) || 3;
if (departureCount < 2 || departureCount > 5) departureCount = 3;

function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

function dateKey(date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}${m}${d}`;
}

function isServiceActive(serviceId, date) {
  if (!scheduleData) return false;
  const key = dateKey(date);
  const exception = scheduleData.exceptions?.[serviceId]?.[key];
  if (exception === 1) return true;
  if (exception === 2) return false;

  const service = scheduleData.services?.[serviceId];
  if (!service || key < service.start_date || key > service.end_date) return false;
  const fields = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
  return service[fields[date.getDay()]] === '1';
}

function getAutomaticProfile(now = new Date()) {
  const current = now.getHours() * 60 + now.getMinutes();
  const outboundStart = toMinutes(commuteProfiles.outbound.activeFrom);
  const outboundEnd = toMinutes(commuteProfiles.outbound.activeUntil);
  const inboundStart = toMinutes(commuteProfiles.inbound.activeFrom);

  if (current >= outboundStart && current <= outboundEnd) return commuteProfiles.outbound;
  if (current >= inboundStart) return commuteProfiles.inbound;
  return commuteProfiles.outbound;
}

function getActiveProfile(now = new Date()) {
  return forcedProfileId ? commuteProfiles[forcedProfileId] : getAutomaticProfile(now);
}

function getReferenceDate(now = new Date()) {
  if (referenceHour === 'now') return now;
  const selected = new Date(now);
  selected.setHours(Number(referenceHour), 0, 0, 0);
  return selected;
}

function minutesUntil(time, referenceDate) {
  const [hours, minutes] = time.split(':').map(Number);
  const current = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  return Math.max(0, hours * 60 + minutes - current);
}

function getProfileDepartures(profile, date) {
  if (!scheduleData?.profiles?.[profile.id]) {
    return profile.demoDepartures.map((time) => ({ time, service_id: null }));
  }

  return scheduleData.profiles[profile.id]
    .filter((item) => isServiceActive(item.service_id, date));
}

function getAvailableHours(profile, now) {
  const hours = getProfileDepartures(profile, now)
    .map((item) => Number(item.time.split(':')[0]))
    .filter((hour) => Number.isInteger(hour) && hour >= 0 && hour <= 23);

  if (!hours.length) return [];
  const first = Math.min(...hours);
  const last = Math.max(...hours);
  return Array.from({ length: last - first + 1 }, (_, index) => first + index);
}

function syncReferenceHourOptions(profile, now) {
  const availableHours = getAvailableHours(profile, now);
  const options = [new Option('Maintenant', 'now')];
  for (const hour of availableHours) {
    options.push(new Option(`${String(hour).padStart(2, '0')}h`, String(hour)));
  }
  referenceHourSelect.replaceChildren(...options);

  const validValues = new Set(options.map((option) => option.value));
  if (!validValues.has(referenceHour)) {
    referenceHour = 'now';
    localStorage.setItem(STORAGE_KEYS.referenceHour, referenceHour);
  }
  referenceHourSelect.value = referenceHour;
}

function getTimes(profile, now) {
  const referenceDate = getReferenceDate(now);
  const threshold = referenceDate.getHours() * 60 + referenceDate.getMinutes();
  return getProfileDepartures(profile, now)
    .filter((item) => toMinutes(item.time) >= threshold)
    .slice(0, departureCount)
    .map((item) => item.time.slice(0, 5));
}

function buildDepartureItem(time, referenceDate) {
  const item = document.createElement('li');
  const timeElement = document.createElement('strong');
  const waitElement = document.createElement('span');
  const wait = minutesUntil(time, referenceDate);

  timeElement.textContent = time;
  if (referenceHour === 'now') {
    waitElement.textContent = wait === 0 ? 'maintenant' : `dans ${wait} min`;
  } else {
    waitElement.textContent = `+ ${wait} min`;
  }
  item.append(timeElement, waitElement);
  return item;
}

function render() {
  const now = new Date();
  const profile = getActiveProfile(now);
  syncReferenceHourOptions(profile, now);
  departureCountSelect.value = String(departureCount);

  const referenceDate = getReferenceDate(now);
  const times = getTimes(profile, now);

  clock.textContent = now.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  stopName.textContent = profile.stopName;
  routeNumber.textContent = profile.route;
  direction.textContent = `→ ${profile.direction}`;

  if (times.length) {
    departures.replaceChildren(...times.map((time) => buildDepartureItem(time, referenceDate)));
  } else {
    const empty = document.createElement('li');
    empty.textContent = referenceHour === 'now'
      ? 'Aucun passage planifié restant aujourd’hui.'
      : `Aucun passage planifié à partir de ${String(referenceHour).padStart(2, '0')}:00 aujourd’hui.`;
    departures.replaceChildren(empty);
  }

  dataStatus.textContent = scheduleData
    ? `Horaires planifiés TEC · données préparées ${new Date(scheduleData.generated_at).toLocaleDateString('fr-BE')}`
    : 'Horaires planifiés · données de démonstration (GTFS préparé indisponible)';
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

swapButton.addEventListener('click', () => {
  const currentId = getActiveProfile().id;
  forcedProfileId = currentId === 'outbound' ? 'inbound' : 'outbound';
  render();
});

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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

render();
loadSchedules();
setInterval(render, 60_000);
