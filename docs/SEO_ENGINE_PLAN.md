# RX Studio SEO Engine Plan

- `brand-memory/CONTEXT.md`: canonical business facts and safety boundaries.
- `brand-memory/voice-guide.md`: human writing rules used by generation.
- `brand-memory/profiles/*.json`: preset ideas, keywords, proof and CTA per profile.
- `brand-memory/platform-rules.json`: platform SEO and length rules.
- `brand-memory/banned-phrases.json`: phrases rejected by the quality gate.
- `brand-memory/index.js`: profile aliases, loaders, compact prompt memory and rotations.
- `lib/seo-lint.js`: deterministic scoring and error/warning checks.
- `lib/ai.js`: inject profile memory, choose targets, lint and repair once.
- `lib/validate.js`: retain structured SEO metadata and platform extras.
- `app/studio.js`: prefill a basic idea and show selectable presets/SEO chips.
- `app/globals.css`: compact preset and SEO badge styling.
- `lib/planner.js`: balanced topic selection and local-city rotation.
- `docs/PROFILE_FIELDS.md`: ready-to-paste profile optimisation copy.
- `docs/SEO_SAMPLES.json`: reviewable sample output for every requested profile/platform.
- `tests/brand-memory.test.js`: memory, rotation and lint coverage.

Implementation keeps existing profile IDs, routes, environment variables,
Publer payload fields and scheduling behaviour intact.
