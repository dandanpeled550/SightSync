# Frontend — Agent Guidelines

## Run dev
cd frontend && npm run dev   # port 5173

## Run tests
cd frontend && npm test

## UI source of truth
Always open Sprints/site_diary_app_clickable_demo.html before building any screen.
It is the clickable prototype with exact colors, spacing, and navigation flow.

## Design tokens
Import ALL colors, radius, shadow, shell constants from frontend/src/constants/theme.ts.
No hex color literals in component files.

## Routing
All routes defined in frontend/src/router.tsx only. Routes are frozen — do not rename.
Navigation uses react-router-dom useNavigate() hook. No window.location assignments.

## Shell pattern
Every screen wraps content in <ScreenShell>. Never duplicate top bar or bottom nav chrome.
Screens that hide bottom nav: /task, /summary, /export, /onboard, /onboard/review.

## FAB and bottom nav positioning
Both use position: absolute inside the shell container — NOT position: fixed.
This keeps them anchored to the 390px shell on desktop.

## Padding rule
All screen content areas: paddingBottom: '72px' to clear the bottom nav.

## Key patterns
- All styling: React.CSSProperties objects only. No .css files, no Tailwind.
- All HTTP calls: frontend/src/api/ only. Never call axios directly from a component.
- State: useState/useEffect only. No Redux, React Query, or context.
- TypeScript: all response shapes defined in frontend/src/api/*.ts. Never use `any`.
- PROJECT_ID = 1 is intentional — hardcoded in all pages.

## Design skill
When building any screen, invoke `/frontend-design` before writing code to get aesthetic direction.
Apply its guidance within SightSync constraints: theme.ts tokens only, inline CSSProperties, ScreenShell wrapper.
`/frontend-design` wins on visual decisions; SightSync rules win on code structure.

## Desktop shell (added Sprint UI)
At ≥ 900px viewport width, DesktopShell renders a 3-column layout:
  220px SidebarNav | 1fr `<Outlet>` | 260px AsidePanel

All routes are wrapped in DesktopShell via the router layout route (router.tsx).
Do NOT add sidebar or aside logic inside page files — handled by the shell.
ScreenShell's BottomNav and hamburger leftAction auto-hide on desktop.
The desktop breakpoint token is: `desktop.breakpoint = 900` (from constants/theme.ts).

## Frontend phases
- Phase 1 (shell + design system): runs in parallel with backend Sprint 2 — UNBLOCKED
- Phase 2 (core workflow screens): requires Sprint 2 live on Render
- Phase 3 (alerts + report): requires Sprint 3 live on Render
- Phase 4 (AI + export): requires Sprint 5 live on Render
- Phase 5 (onboarding): requires Sprint 4 live on Render
Full detail: Sprints/FULL_PRODUCT_EXECUTION_PLAN.md
