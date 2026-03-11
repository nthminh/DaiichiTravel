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
 * Checks if a string matches a search term, ignoring accents and case
 */
export const matchesSearch = (text: string, searchTerm: string): boolean => {
  const normalizedText = removeAccents(text.toLowerCase());
  const normalizedSearch = removeAccents(searchTerm.toLowerCase());
  return normalizedText.includes(normalizedSearch);
};
