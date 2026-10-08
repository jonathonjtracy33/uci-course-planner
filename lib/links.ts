// UCI's General Catalogue page for a course, e.g. "I&C SCI 31".
export const catalogueUrl = (code: string) => `https://catalogue.uci.edu/search/?P=${encodeURIComponent(code)}`;

// RateMyProfessors search for a UCI instructor ("ALFARO, S." -> last name "Alfaro"). Only a link:
// RMP's terms don't allow copying their ratings onto other sites.
const RMP_UCI = 1074; // UC Irvine's school id on RateMyProfessors
export function rateMyProfessorsUrl(instructor: string): string {
  const last = instructor.split(",")[0].trim().toLowerCase().replace(/\b\w/g, (c) => c.toUpperCase());
  return `https://www.ratemyprofessors.com/search/professors/${RMP_UCI}?q=${encodeURIComponent(last)}`;
}
