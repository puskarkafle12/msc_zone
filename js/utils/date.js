export function pad2(n) {
  return String(n).padStart(2, "0");
}

export function formatISODate(date) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`;
}

export function fromInputDate(value) {
  return new Date(`${value}T12:00:00`);
}

export function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

export function startOfWeekSunday(date) {
  return addDays(date, -date.getDay());
}

export function eachDate(start, end) {
  const days = [];
  let current = new Date(start);
  while (current <= end) {
    days.push(new Date(current));
    current = addDays(current, 1);
  }
  return days;
}

export function dateRangeForType(type, anchorDate, customStart, customEnd) {
  if (type === "today") {
    return { type, start: anchorDate, end: anchorDate };
  }

  if (type === "week") {
    const start = startOfWeekSunday(anchorDate);
    return { type, start, end: addDays(start, 6) };
  }

  if (type === "month") {
    const start = new Date(anchorDate.getFullYear(), anchorDate.getMonth(), 1, 12, 0, 0);
    const end = new Date(anchorDate.getFullYear(), anchorDate.getMonth() + 1, 0, 12, 0, 0);
    return { type, start, end };
  }

  if (type === "year") {
    const start = new Date(anchorDate.getFullYear(), 0, 1, 12, 0, 0);
    const end = new Date(anchorDate.getFullYear(), 11, 31, 12, 0, 0);
    return { type, start, end };
  }

  const start = customStart <= customEnd ? customStart : customEnd;
  const end = customStart <= customEnd ? customEnd : customStart;
  return { type: "custom", start, end };
}
