# Test Layout

This repo now includes two test layers:

- `tests/unit`: Vitest + React Testing Library suites for page buttons and client-component handlers.
- `tests/e2e`: Playwright flows for public CTA and auth button paths.

Expected commands:

```bash
npm install
npm run test
npm run test:e2e
```

Notes:

- E2E uses `npm run dev` through Playwright's `webServer`.
- Unit tests rely on mocks for `next/navigation`, `next-auth/react`, `framer-motion`, and the Finder cloud context.
