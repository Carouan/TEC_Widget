import { commuteProfiles } from './config.js';

const stopName = document.querySelector('#stop-name');
const routeNumber = document.querySelector('#route-number');
const direction = document.querySelector('#direction');
const departures = document.querySelector('#departures');
const clock = document.querySelector('#current-time');
const swapButton = document.querySelector('#swap-route');

let forcedProfileId = null;

function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
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
  const target = new Date(now);
  const [hours, minutes] = time.split(':').map(Number);
  target.setHours(hours, minutes, 0, 0);
  if (target < now) target.setDate(target.getDate() + 1);
  return Math.max(0, Math.round((target - now) / 60000));
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

  clock.textContent = now.toLocaleTimeString('fr-BE', { hour: '2-digit', minute: '2-digit' });
  stopName.textContent = profile.stopName;
  routeNumber.textContent = profile.route;
  direction.textContent = `→ ${profile.direction}`;
  departures.replaceChildren(...profile.demoDepartures.map((time) => buildDepartureItem(time, now)));
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
setInterval(render, 60_000);
