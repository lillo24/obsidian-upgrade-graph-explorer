# Repository agent skills

KG0 approves two third-party skills from [`vercel-labs/agent-skills`](https://github.com/vercel-labs/agent-skills):

- `vercel-react-best-practices` for relevant React implementation and performance reviews. Apply its Vite/React guidance; its presence does not authorize Next.js, Vercel hosting, or deployment work.
- `web-design-guidelines` for relevant UI, accessibility, interaction, and design reviews. Its presence does not expand a task into a redesign.

They are installed at project scope by the Agent Skills CLI. The committed copies live under `.agents/skills/vercel-react-best-practices/` and `.agents/skills/web-design-guidelines/`; source hashes are recorded in `skills-lock.json`. `npx skills list` reports both as project-scoped and discoverable by Codex. Do not edit third-party skill content locally. Review upstream changes before running `npx skills update --project`.

Deployment, Tauri, React Flow, Sigma/Graphology, Playwright/browser automation, backend, database, and cloud skills are deliberately not installed in KG0.
