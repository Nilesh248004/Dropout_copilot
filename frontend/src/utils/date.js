export const toIsoFromLocalDateTime = (value) => {
  if (!value) return "";
  const text = String(value).trim();
  if (!text) return "";

  const hasTimezone = /[zZ]$|[+-]\d{2}:?\d{2}$/.test(text);
  if (!hasTimezone) {
    const match = text.match(
      /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?/
    );
    if (match) {
      const [, year, month, day, hours, minutes, seconds] = match;
      const date = new Date(
        Number(year),
        Number(month) - 1,
        Number(day),
        Number(hours),
        Number(minutes),
        Number(seconds || 0)
      );
      return Number.isNaN(date.getTime()) ? "" : date.toISOString();
    }
  }

  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? "" : parsed.toISOString();
};
