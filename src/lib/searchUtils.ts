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
 * Computes the Levenshtein edit distance between two strings.
 */
export const levenshteinDistance = (a: string, b: string): number => {
  const m = a.length, n = b.length;
  if (m === 0) return n;
  if (n === 0) return m;
  const dp: number[][] = [];
  for (let i = 0; i <= m; i++) {
    dp[i] = [i];
    for (let j = 1; j <= n; j++) {
      dp[i][j] = i === 0
        ? j
        : a[i - 1] === b[j - 1]
          ? dp[i - 1][j - 1]
          : 1 + Math.min(dp[i - 1][j - 1], dp[i - 1][j], dp[i][j - 1]);
    }
  }
  return dp[m][n];
};

/**
 * Allow 1 edit per this many characters for full-word (no-spaces) fuzzy matching.
 * More conservative (20%) to avoid false positives when comparing full city names.
 */
const NO_SPACES_FUZZY_DIVISOR = 5;

/**
 * Allow 1 edit per this many characters for token-level fuzzy matching.
 * Slightly more lenient (25%) because tokens are shorter individual words.
 */
const TOKEN_FUZZY_DIVISOR = 4;

/**
 * Returns a match score (0 = no match, higher = better match) for use when
 * sorting suggestions. Handles:
 *  - Accent/diacritic removal (e.g. "Ha Noi" → "Hà Nội")
 *  - Space-collapsed matching (e.g. "hanoi" → "Ha Noi")
 *  - Token-level fuzzy matching for minor typos (e.g. "Dalat" → "Da Lat")
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

  // Fuzzy match on space-collapsed strings (handles typos like "haloi" → "ha noi")
  const nsThreshold = Math.max(1, Math.floor(Math.min(searchNoSpaces.length, textNoSpaces.length) / NO_SPACES_FUZZY_DIVISOR));
  if (textNoSpaces.length > 0 && levenshteinDistance(textNoSpaces, searchNoSpaces) <= nsThreshold) return 70;

  // Token-level fuzzy matching for minor typos
  const textTokens = normText.split(/\s+/).filter(Boolean);
  const searchTokens = normSearch.split(/\s+/).filter(Boolean);
  if (searchTokens.length === 0) return 1;

  // Each search token must fuzzy-match (prefix or small edit distance) at least one text token.
  // Short tokens (≤ 3 chars) only use prefix matching to avoid false positives such as
  // "cat" matching "cau" (cầu) or "ba" matching "ha" in unrelated Vietnamese addresses.
  const allTokensMatch = searchTokens.every(st => {
    if (st.length <= 3) {
      return textTokens.some(tt => tt.startsWith(st));
    }
    const threshold = Math.max(1, Math.floor(st.length / TOKEN_FUZZY_DIVISOR));
    return textTokens.some(tt => tt.startsWith(st) || levenshteinDistance(st, tt) <= threshold);
  });

  if (allTokensMatch) return 60;

  return 0;
};

/**
 * Checks if a string matches a search term, ignoring accents, case, and minor typos.
 */
export const matchesSearch = (text: string, searchTerm: string): boolean => {
  return matchScore(text, searchTerm) > 0;
};
