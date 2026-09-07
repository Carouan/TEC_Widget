export function toMinutes(value) {
  const [hours, minutes] = value.split(':').map(Number);
  return hours * 60 + minutes;
}

export function addDays(date, days) {
  const result = new Date(date);
  result.setDate(result.getDate() + days);
  return result;
}

export function sameDay(a, b) {
  return a.getFullYear() === b.getFullYear()
    && a.getMonth() === b.getMonth()
    && a.getDate() === b.getDate();
}

export function dayStart(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

export function periodThreshold(period, hour = null) {
  if (period === 'morning') return 4 * 60;
  if (period === 'afternoon') return 12 * 60;
  if (period === 'hour' && hour !== null) return Number(hour) * 60;
  return 0;
}

export function nextSmartPlan({ now, favorites, getDepartures, maxDays = 14 }) {
  for (let offset = 0; offset <= maxDays; offset += 1) {
    const date = addDays(dayStart(now), offset);
    const candidates = [];

    for (const favorite of favorites) {
      if (!favorite.days.includes(date.getDay())) continue;
      const departures = getDepartures(favorite, date);
      if (!departures.length) continue;

      const habitStart = toMinutes(favorite.startTime || '00:00');
      const threshold = offset === 0
        ? Math.max(now.getHours() * 60 + now.getMinutes(), habitStart)
        : habitStart;
      const first = departures.find((item) => toMinutes(item.time) >= threshold);
      if (!first) continue;

      candidates.push({ favorite, date, firstDeparture: first, threshold });
    }

    if (candidates.length) {
      candidates.sort((a, b) => toMinutes(a.firstDeparture.time) - toMinutes(b.firstDeparture.time));
      return candidates[0];
    }
  }
  return null;
}

export function labelDate(target, today) {
  const targetStart = dayStart(target);
  const todayStart = dayStart(today);
  const diff = Math.round((targetStart - todayStart) / 86400000);
  if (diff === 0) return 'Aujourd’hui';
  if (diff === 1) return 'Demain';
  return target.toLocaleDateString('fr-BE', { weekday: 'short', day: 'numeric', month: 'short' });
}
