# Frontend — Agent Guidelines

## Run dev
```bash
cd frontend && npm run dev   # port 5173
```

## Run tests
```bash
cd frontend && npm test
```

## Key patterns
- All styling: `React.CSSProperties` objects only. No `.css` files, no Tailwind.
- All HTTP calls: `frontend/src/api/` only. Never call axios directly from a component.
- State: `useState`/`useEffect` only. No Redux, React Query, or context.
- TypeScript: all response shapes defined in `frontend/src/api/*.ts`. Never use `any`.
- `PROJECT_ID = 1` is intentional — hardcoded in all pages.

## Note
Frontend sprint work is deferred pending UI mockups from the user.
Do not add new pages or components until explicitly told to.
