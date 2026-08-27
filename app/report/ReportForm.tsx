'use client';

import { useState } from 'react';
import Script from 'next/script';

const SCAM_TYPES = [
  'Scammer/Spam Caller',
  'Fake Email/Link',
  'Flake-No Show',
  'Threats/Dangerous',
  'Fake Payment',
  'Other',
];

// Common country dial codes. Picking one just pre-fills the "+XX" prefix
// on the number field next to it -- the actual submitted value is
// whatever's typed, so it still works fine if someone pastes a full
// international number (with its own "+") and ignores the dropdown.
const COUNTRY_CODES = [
  { code: '+1', label: '+1 US/CA' },
  { code: '+44', label: '+44 UK' },
  { code: '+61', label: '+61 AU' },
  { code: '+91', label: '+91 IN' },
  { code: '+52', label: '+52 MX' },
  { code: '+55', label: '+55 BR' },
  { code: '+49', label: '+49 DE' },
  { code: '+33', label: '+33 FR' },
  { code: '+39', label: '+39 IT' },
  { code: '+34', label: '+34 ES' },
  { code: '+31', label: '+31 NL' },
  { code: '+46', label: '+46 SE' },
  { code: '+41', label: '+41 CH' },
  { code: '+353', label: '+353 IE' },
  { code: '+64', label: '+64 NZ' },
  { code: '+27', label: '+27 ZA' },
  { code: '+234', label: '+234 NG' },
  { code: '+254', label: '+254 KE' },
  { code: '+20', label: '+20 EG' },
  { code: '+971', label: '+971 AE' },
  { code: '+966', label: '+966 SA' },
  { code: '+65', label: '+65 SG' },
  { code: '+60', label: '+60 MY' },
  { code: '+63', label: '+63 PH' },
  { code: '+62', label: '+62 ID' },
  { code: '+66', label: '+66 TH' },
  { code: '+84', label: '+84 VN' },
  { code: '+82', label: '+82 KR' },
  { code: '+81', label: '+81 JP' },
  { code: '+86', label: '+86 CN' },
  { code: '+92', label: '+92 PK' },
  { code: '+880', label: '+880 BD' },
  { code: '+90', label: '+90 TR' },
  { code: '+7', label: '+7 RU/KZ' },
  { code: '+48', label: '+48 PL' },
  { code: '+351', label: '+351 PT' },
  { code: '+30', label: '+30 GR' },
  { code: '+972', label: '+972 IL' },
  { code: '+54', label: '+54 AR' },
  { code: '+56', label: '+56 CL' },
  { code: '+57', label: '+57 CO' },
];

// Native <select> arrows render inconsistently across browsers, so we hide
// the default one (appearance-none) and draw this instead -- keeps every
// dropdown visually identical to the text inputs next to it.
function SelectChevron() {
  return (
    <svg
      className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
    </svg>
  );
}

// Filing a report requires being signed in (enforced by middleware), so
// the reporter's own contact info comes from their Clerk account
// server-side -- no need to ask for it here. The person being reported
// starts with just a phone number field; email and second entries are
// opt-in via the buttons below, to keep the common case (one number) fast.
export default function ReportForm() {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState('');
  const [scamType, setScamType] = useState('');

  const [showPhone2, setShowPhone2] = useState(false);
  const [showEmail, setShowEmail] = useState(false);
  const [showEmail2, setShowEmail2] = useState(false);

  const [phoneCode, setPhoneCode] = useState('+1');
  const [phone2Code, setPhone2Code] = useState('+1');

  // If someone typed a bare local number, stitch the selected country
  // code onto the front. If they already typed/pasted a "+..." number
  // (including whatever the screenshot analyzer filled in), leave it
  // alone -- it's already complete.
  function withCountryCode(raw: string, code: string): string {
    if (!raw) return raw;
    return raw.startsWith('+') ? raw : `${code}${raw.replace(/^0+/, '')}`;
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError('');
    const formData = new FormData(e.currentTarget);

    const phone = withCountryCode(((formData.get('phone_number') as string) || '').trim(), phoneCode);
    const phone2 = withCountryCode(((formData.get('phone_number_2') as string) || '').trim(), phone2Code);
    formData.set('phone_number', phone);
    formData.set('phone_number_2', phone2);

    const email = (formData.get('subject_email') as string)?.trim();
    const email2 = (formData.get('subject_email_2') as string)?.trim();

    if (!phone && !phone2 && !email && !email2) {
      setError("Provide at least one phone number or email for the person you're reporting.");
      return;
    }

    setSubmitting(true);

    try {
      const res = await fetch('/api/report', { method: 'POST', body: formData });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Something went wrong. Try again.');
      } else {
        setDone(true);
      }
    } catch {
      setError('Something went wrong. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="mx-auto max-w-lg rounded-xl border border-orange bg-orange/10 p-8 text-center">
        <p className="font-semibold">Thanks — your report was submitted.</p>
        <p className="mt-2 text-sm text-muted">
          It'll be reviewed before it appears in search results. No charge,
          ever, for filing a report.
        </p>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleSubmit}
      encType="multipart/form-data"
      className="mx-auto max-w-lg rounded-xl border border-border bg-card p-5 text-left sm:p-8 md:p-10"
    >
      <section>
        <h2 className="mb-5 text-xs font-bold uppercase tracking-wide text-orange">
          Evidence
        </h2>
        <div>
          <label className="mb-2 block text-sm text-muted">
            Screenshot or photo (optional)
          </label>
          <input
            name="evidence"
            type="file"
            accept="image/*"
            className="block w-full text-sm text-muted file:mr-3 file:rounded-lg file:border file:border-border file:bg-navy file:px-3 file:py-2 file:text-sm file:text-white"
          />
          <p className="mt-3 text-xs text-muted">
            Upload a screenshot or photo of the conversation as supporting
            evidence for your report.
          </p>
        </div>
      </section>

      <section className="mt-8 border-t border-border pt-6">
        <h2 className="mb-5 text-xs font-bold uppercase tracking-wide text-[#5aa9e6]">
          Who you're reporting
        </h2>
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-muted">
              Phone number (international OK)
            </label>
            <div className="flex gap-2">
              <div className="relative w-28 shrink-0">
                <select
                  value={phoneCode}
                  onChange={(e) => setPhoneCode(e.target.value)}
                  aria-label="Area/country code"
                  className="w-full appearance-none rounded-lg border border-border bg-navy py-3 pl-3 pr-8 text-sm outline-none focus:border-[#5aa9e6]"
                >
                  {COUNTRY_CODES.map((c) => (
                    <option key={c.code + c.label} value={c.code}>
                      {c.label}
                    </option>
                  ))}
                </select>
                <SelectChevron />
              </div>
              <input
                name="phone_number"
                type="tel"
                placeholder="e.g. 7911 123456"
                className="w-full rounded-lg border border-border bg-navy px-4 py-3 outline-none focus:border-[#5aa9e6]"
              />
            </div>
          </div>

          {showPhone2 && (
            <div>
              <label className="mb-2 block text-sm text-muted">
                Second phone number
              </label>
              <div className="flex gap-2">
                <div className="relative w-28 shrink-0">
                  <select
                    value={phone2Code}
                    onChange={(e) => setPhone2Code(e.target.value)}
                    aria-label="Area/country code"
                    className="w-full appearance-none rounded-lg border border-border bg-navy py-3 pl-3 pr-8 text-sm outline-none focus:border-[#5aa9e6]"
                  >
                    {COUNTRY_CODES.map((c) => (
                      <option key={c.code + c.label} value={c.code}>
                        {c.label}
                      </option>
                    ))}
                  </select>
                  <SelectChevron />
                </div>
                <input
                  name="phone_number_2"
                  type="tel"
                  className="w-full rounded-lg border border-border bg-navy px-4 py-3 outline-none focus:border-[#5aa9e6]"
                />
              </div>
            </div>
          )}

          {showEmail && (
            <div>
              <label className="mb-2 block text-sm text-muted">Email</label>
              <input
                name="subject_email"
                type="email"
                className="w-full rounded-lg border border-border bg-navy px-4 py-3 outline-none focus:border-[#5aa9e6]"
              />
            </div>
          )}

          {showEmail2 && (
            <div>
              <label className="mb-2 block text-sm text-muted">
                Second email
              </label>
              <input
                name="subject_email_2"
                type="email"
                className="w-full rounded-lg border border-border bg-navy px-4 py-3 outline-none focus:border-[#5aa9e6]"
              />
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            {!showPhone2 && (
              <button
                type="button"
                onClick={() => setShowPhone2(true)}
                className="rounded-full border border-[#5aa9e6]/40 px-3 py-1 text-xs font-medium text-[#5aa9e6] transition hover:bg-[#5aa9e6]/10"
              >
                + Second number
              </button>
            )}
            {!showEmail && (
              <button
                type="button"
                onClick={() => setShowEmail(true)}
                className="rounded-full border border-[#5aa9e6]/40 px-3 py-1 text-xs font-medium text-[#5aa9e6] transition hover:bg-[#5aa9e6]/10"
              >
                + Email
              </button>
            )}
            {showEmail && !showEmail2 && (
              <button
                type="button"
                onClick={() => setShowEmail2(true)}
                className="rounded-full border border-[#5aa9e6]/40 px-3 py-1 text-xs font-medium text-[#5aa9e6] transition hover:bg-[#5aa9e6]/10"
              >
                + Second email
              </button>
            )}
          </div>
          <p className="text-xs italic text-muted">
            At least one phone number or email above is required.
          </p>

          <div>
            <label className="mb-2 block text-sm text-muted">
              First name, if known (last names aren't collected)
            </label>
            <input
              name="subject_name"
              type="text"
              placeholder="First name only"
              className="w-full rounded-lg border border-border bg-navy px-4 py-3 outline-none focus:border-[#5aa9e6]"
            />
          </div>
        </div>
      </section>

      <section className="mt-8 border-t border-border pt-6">
        <h2 className="mb-5 text-xs font-bold uppercase tracking-wide text-[#a78bfa]">
          What happened
        </h2>
        <div className="space-y-5">
          <div>
            <label className="mb-2 block text-sm text-muted">Type</label>
            <div className="relative">
              <select
                name="scam_type"
                value={scamType}
                onChange={(e) => setScamType(e.target.value)}
                className={`w-full appearance-none rounded-lg border border-border bg-navy px-4 py-3 pr-8 outline-none focus:border-[#a78bfa] ${
                  scamType ? 'text-white' : 'text-muted'
                }`}
              >
                <option value="" className="text-muted">
                  Select one
                </option>
                {SCAM_TYPES.map((t) => (
                  <option key={t} value={t} className="text-white">
                    {t}
                  </option>
                ))}
              </select>
              <SelectChevron />
            </div>
          </div>

          {scamType === 'Threats/Dangerous' && (
            <div className="rounded-lg border border-red bg-red/10 p-4 text-sm">
              <p className="font-semibold text-red">
                If you feel unsafe or are in danger right now, please
                contact local law enforcement or emergency services
                immediately (911 in the US).
              </p>
              <p className="mt-2 text-xs text-muted">
                Filing a report here does not notify police — it only adds
                to this registry. For your safety, please report threats
                directly to law enforcement as well.
              </p>
            </div>
          )}

          {scamType === 'Other' && (
            <div>
              <label className="mb-2 block text-sm text-muted">
                Please specify (only visible to admins — never shown to
                subscribers or the public)
              </label>
              <input
                name="scam_type_other"
                type="text"
                className="w-full rounded-lg border border-border bg-navy px-4 py-3 outline-none focus:border-[#a78bfa]"
              />
            </div>
          )}

          <div>
            <label className="mb-2 block text-sm text-muted">
              What happened? *
            </label>
            <textarea
              name="description"
              required
              rows={5}
              className="w-full rounded-lg border border-border bg-navy px-4 py-3 outline-none focus:border-[#a78bfa]"
            />
          </div>
        </div>
      </section>

      <div className="mt-10 space-y-5">
        {process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY && (
          <>
            <Script
              src="https://challenges.cloudflare.com/turnstile/v0/api.js"
              strategy="afterInteractive"
            />
            <div
              className="cf-turnstile"
              data-sitekey={process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY}
              data-theme="dark"
            />
          </>
        )}

        {error && (
          <div className="rounded-lg border border-red bg-red/10 p-3 text-sm">
            {error}
          </div>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="w-full rounded-lg bg-gradient-to-br from-red to-orange px-6 py-3 font-semibold text-white disabled:opacity-60"
        >
          {submitting ? 'Submitting…' : 'Report'}
        </button>
      </div>
    </form>
  );
}
