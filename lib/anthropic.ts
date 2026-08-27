import Anthropic from '@anthropic-ai/sdk';

// Used only for the optional "smart report" screenshot analysis. If
// ANTHROPIC_API_KEY isn't set, /api/report/analyze catches the error and
// the report form just skips auto-fill -- evidence upload and manual
// report submission both work fine without it.
export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
});
