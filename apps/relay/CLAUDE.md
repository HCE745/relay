@AGENTS.md

## Git — branch and deploy rules

**Always commit and push to `main` only.**

- Never create or push to `fresh-main`, feature branches, or any other branch unless the user explicitly asks you to create a named feature branch.
- Before committing, verify you are on `main` with `git branch`. If you are not, run `git checkout main` first.
- `main` is the production branch. Commits to `main` deploy to Production on Vercel. Commits to any other branch deploy only to Preview and will not reach users.
- Do not use `git push origin HEAD:<other-branch>` or `git push origin <local>:<remote>` with anything other than `main`.

## Android / Capacitor

After every `npm run build` (or any change to web assets), run:

```
npx cap sync android
```

This copies the latest web output and plugin configuration into the Android project so the native build stays in sync with web changes. Skipping this step means the Android app may run stale code.
