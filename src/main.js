import { commuteProfiles } from './config.js';

const stopName = document.querySelector('#stop-name');
const routeNumber = document.querySelector('#route-number');
const direction = document.querySelector('#direction');
const departures = document.querySelector('#departures');
const clock = document.querySelector('#current-time');
const swapButton = document.querySelector('#swap-route');
const dataStatus = document.querySelector('#data-status');

let forcedProfileId = null;
let scheduleData = null;

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

function minutesUntil(time, now = new Date()) {
  const [hours, minutes] = time.split(':').map(Number);
  const current = now.getHours() * 60 + now.getMinutes();
  return Math.max(0, hours * 60 + minutes - current);
}

function getTimes(profile, now) {
  if (!scheduleData?.profiles?.[profile.id]) return profile.demoDepartures.slice(0, 3);
  const current = now.getHours() * 60 + now.getMinutes();
  return scheduleData.profiles[profile.id]
    .filter((item) => isServiceActive(item.service_id, now) && toMinutes(item.time) >= current)
    .slice(0, 3)
    .map((item) => item.time.slice(0, 5));
}

function buildDepartureItem(time, now) {
  const item = document.createElement('li');
  const timeElement = document.createElement('strong');
  const waitElement = document.createElement('span');
  const wait = minutesUntil(time, now);

  timeElement.textContent = time;
  waitElement.textContent = wait === 0 ? 'maintenant' : `dans ${wait} min`;
  item.append(timeElement, waitElement);
  return item;
}

function render() {
  const now = new Date();
  const profile = getActiveProfile(now);
  const times = getTimes(profile, now);

  clock.textContent = now.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  stopName.textContent = profile.stopName;
  routeNumber.textContent = profile.route;
  direction.textContent = `→ ${profile.direction}`;

  if (times.length) {
    departures.replaceChildren(...times.map((time) => buildDepartureItem(time, now)));
  } else {
    const empty = document.createElement('li');
    empty.textContent = 'Aucun passage planifié restant aujourd’hui.';
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

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js'));
}

render();
loadSchedules();
setInterval(render, 60_000);
