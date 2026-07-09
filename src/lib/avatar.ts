function stripDiacritics(s: string): string {
  return s.normalize("NFD").replace(/[̀-ͯ]/g, "").normalize("NFC");
}

export function getInitials(firstName: string, lastName: string): string {
  const f = firstName.trim();
  const l = lastName.trim();
  if (!f && !l) return "?";
  if (!l) return stripDiacritics(f.slice(0, 1)).toUpperCase();
  return stripDiacritics(f.slice(0, 1) + l.slice(0, 1)).toUpperCase();
}

// Deterministic, WCAG-safe (fixed saturation/lightness → white text passes AA)
export function getAvatarColor(seed: string): string {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = seed.charCodeAt(i) + ((hash << 5) - hash);
    hash |= 0;
  }
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 55% 42%)`;
}
