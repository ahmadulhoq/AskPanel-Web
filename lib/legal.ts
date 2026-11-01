// Details the legal pages need from the operator. Until they are filled in, /privacy and
// /terms show a "draft" notice instead of made-up values (backlog: legal details).
export const LEGAL = {
  // e.g. "Example Ltd, registered in England and Wales (no. 12345678)"
  operator: null as string | null,
  contactEmail: null as string | null,
  // e.g. "the laws of England and Wales"
  governingLaw: null as string | null,
  lastUpdated: '1 November 2026',
}

export const legalDraft = !LEGAL.operator || !LEGAL.contactEmail || !LEGAL.governingLaw
