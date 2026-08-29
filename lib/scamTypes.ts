// Single source of truth for report categories -- used by the report
// form, the report API's validation, and the search result breakdown.
// Keep this in sync with supabase/schema.sql's column comment.
export const SCAM_TYPES: string[] = [
  'Scammer/Spam Caller',
  'Fake Email/Link',
  'Flake-No Show',
  'Threats/Dangerous',
  'Fake Payment',
  'Other',
];
