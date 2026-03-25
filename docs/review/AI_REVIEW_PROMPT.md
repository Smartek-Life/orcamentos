# Prompt For Another AI Review

Use the following prompt with another AI reviewer:

---

You are performing a senior-level software engineering review of a desktop planning application built with:

- React
- TypeScript
- Vite
- Tailwind
- Electron
- Express

Please review this codebase with the mindset of an international staff/principal engineer.

What I want from you:

1. Review architecture, not just syntax.
2. Point out separation-of-concern problems.
3. Identify risks around persistence, Electron packaging, state management, and long-term maintainability.
4. Flag dead code, legacy dependencies, and coupling between UI and domain logic.
5. Suggest a phased refactor plan, not a rewrite fantasy.
6. Mention what is already good and should be preserved.
7. Be concrete and reference files.

Important context:

- This application now works primarily as a local desktop app.
- It has a project preparation phase where the user selects PDF pages, names floors, defines hatched area/perimeter, and confirms total area in square meters.
- After that, the user works module-by-module:
  - Wi-Fi
  - Cameras
  - Audio
- A floor can be skipped in one module and used in another.
- Saved module boards are later exported into a final PDF report.

Please produce:

1. Executive summary
2. Top engineering risks in order of priority
3. File-by-file findings where relevant
4. Recommended target architecture
5. 30-day refactor roadmap
6. “Keep / Change / Remove” summary

Please be rigorous. Do not just say “looks good”.

---
