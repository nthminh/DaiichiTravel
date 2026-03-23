/**
 * Removes Vietnamese accents from a string
 */
export const removeAccents = (str: string): string => {
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D');
};

/**
 * Returns a match score (0 = no match, higher = better match) for use when
 * sorting suggestions. Handles:
 *  - Accent/diacritic removal (e.g. "Ha Noi" → "Hà Nội")
 *  - Space-collapsed matching (e.g. "hanoi" → "Ha Noi")
 */
export const matchScore = (text: string, searchTerm: string): number => {
  if (!searchTerm.trim()) return 1;
  const normText = removeAccents(text.toLowerCase().trim());
  const normSearch = removeAccents(searchTerm.toLowerCase().trim());

  // Exact substring match (highest priority)
  if (normText.includes(normSearch)) return 100;

  // Match ignoring all spaces (handles "hanoi" vs "ha noi", "danang" vs "da nang")
  const textNoSpaces = normText.replace(/\s+/g, '');
  const searchNoSpaces = normSearch.replace(/\s+/g, '');
  if (textNoSpaces.includes(searchNoSpaces)) return 80;

  return 0;
};

/**
 * Checks if a string matches a search term, ignoring accents and case.
 */
export const matchesSearch = (text: string, searchTerm: string): boolean => {
  return matchScore(text, searchTerm) > 0;
};
