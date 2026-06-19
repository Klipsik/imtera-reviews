export function parseDateRange(value: string): { from: string; to: string } {
  const parts = value.split(/\s+to\s+/i).map(part => part.trim()).filter(Boolean)

  return {
    from: parts[0] ?? '',
    to: parts[1] ?? '',
  }
}
