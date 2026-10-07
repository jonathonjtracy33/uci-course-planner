// UCI's General Catalogue page for a course, e.g. "I&C SCI 31".
export const catalogueUrl = (code: string) => `https://catalogue.uci.edu/search/?P=${encodeURIComponent(code)}`;
