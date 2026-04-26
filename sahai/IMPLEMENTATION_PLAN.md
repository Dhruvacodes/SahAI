# Sahai Implementation Plan

This is the handoff for the next smaller agent. The current code already has a working consent-first mobile demo and backend guardrails; the remaining work is mostly persistence, production hardening, and clinical/government review.

## Current State

- Mobile app: `apps/mobile/App.tsx` is an offline Expo SDK 55 demo with consent capture, 22 Indian language selection, same-language text-to-speech readback via `expo-speech`, privacy posture, model/cost display, and mock risk results.
- Backend: FastAPI now blocks transcription, extraction, deterministic risk scoring, and referral generation unless a valid `sahai-consent-v1` snapshot is attached.
- AI: Claude model selection is centralized in `backend/app/services/model_policy.py`; default is `claude-sonnet-4-6`.
- Prompt injection: extraction/referral prompts treat transcript and visit fields as untrusted JSON source data and ask for structured JSON only.
- Dependencies: root npm workspaces were removed because Expo SDK 55 needs React 19 and the dashboard needs React 18. Install apps independently.

## Runbook

```powershell
cd sahai
npm install
npm --prefix apps/mobile install
npm --prefix apps/dashboard install
npm --prefix apps/mobile run start -- --lan
npm --prefix apps/dashboard run dev
cd backend
python -m pytest tests -q -p no:cacheprovider
```

Verification commands that passed:

- `npx expo-doctor` from `apps/mobile`: 18/18 checks passed.
- `npm exec -- tsc --noEmit` from `apps/mobile`: passed.
- `npm run build` from `apps/dashboard`: passed.
- `python -m pytest tests -q -p no:cacheprovider` from `backend`: 2 passed.

## Government And Privacy Checklist

Use this as implementation guidance, not legal sign-off.

- DPDP Act, 2023: keep consent free, specific, informed, unambiguous, purpose-limited, and paired with notice and rights flows. India Code reference: https://www.indiacode.nic.in/handle/123456789/22037?locale=en
- ABDM / Health Data Management Policy: keep health-data sharing consent-based, auditable, revocable, and privacy-by-design. National Portal reference: https://www.india.gov.in/category/health-wellness/subcategory/health-care-promotion-products/details/health-data-management-policy-of-ayushman-bharat-digital-mission-abdm
- Telemedicine Practice Guidelines: when an ASHA/health worker initiates a consultation, explicit patient consent must be recorded; emergencies should be referred for in-person care. MoHFW PDF: https://www.mohfw.gov.in/pdf/Telemedicine.pdf
- Product stance: Sahai is decision support for ASHA/ANM/PHC workflows. It must not present itself as a replacement for an RMP, diagnosis, prescription, or emergency medical judgment.

## Language Plan

- Current capability target: 22 Indian languages from the Eighth Schedule.
- Backend source of truth: `backend/app/services/language_policy.py`.
- Mobile source of truth: `LANGUAGES` in `apps/mobile/App.tsx`.
- Next step: have native speakers review all demo readback strings. For production, generate patient-facing text with Claude in the selected language and keep the deterministic risk score outside the model.

## Model And Cost Plan

- Default: Claude Sonnet 4.6 (`claude-sonnet-4-6`) because Anthropic documents it as the best speed/intelligence balance, with multilingual support and 1M context.
- Budget alternative: Claude Haiku 4.5 (`claude-haiku-4-5-20251001`) for non-critical readback or draft-only paths after quality review.
- Current pricing constants: Sonnet 4.6 at $3/input MTok and $15/output MTok; Haiku 4.5 at $1/input MTok and $5/output MTok.
- Source: Anthropic model/pricing docs: https://platform.claude.com/docs/en/about-claude/models/overview and https://platform.claude.com/docs/en/about-claude/pricing

## Remaining Work

1. Persist consent receipts.
   - Add a `consent_receipts` table or JSONB field with `consentId`, `patientId`, `ashaId`, `languageCode`, scopes, version, timestamp, and withdrawal status.
   - Add `POST /api/consent/withdraw`.

2. Wire mobile to backend.
   - Add a backend URL setting in mobile.
   - Send the same `ConsentSnapshot` to ASR, extraction, risk, and referral endpoints.
   - Keep the offline mock path as demo fallback.

3. Add real audio capture.
   - Prefer Expo SDK 55-compatible audio recording package.
   - Do not store raw audio by default.
   - Upload audio only after consent and delete local temp files after transcription.

4. Harden prompt-injection handling.
   - Add tests with transcripts like "ignore previous instructions" and "return markdown".
   - Assert JSON-only parsing and no prompt text leaks into patient-facing output.

5. Production privacy.
   - Encrypt data at rest and in transit.
   - Add access controls by ASHA/ANM/PHC role.
   - Add audit logs for consent, view, sync, referral generation, and withdrawal.
   - Add retention/deletion policy and patient rights screens.

6. Clinical governance.
   - Review risk rules with maternal-health clinicians.
   - Label all AI output as draft support.
   - Keep emergency action deterministic: high BP, absent fetal movement, severe symptoms should trigger immediate referral independent of LLM output.
