export function pct(value: number): string {
  return `${Math.round(value * 100)}%`;
}

export function oddsText(value: number | null): string {
  return value == null ? '—' : value.toFixed(2);
}

export function signed(value: number): string {
  const text = value.toFixed(2);
  return value > 0 ? `+${text}` : text;
}

export function kickoffLabel(ms: number): string {
  return new Date(ms).toLocaleString(undefined, {
    weekday: 'short',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function localDate(now = new Date()): string {
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${now.getFullYear()}-${month}-${day}`;
}

export function uid(prefix: string): string {
  return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`;
}
