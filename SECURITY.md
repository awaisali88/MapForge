# Security Policy

MapForge is a sandbox repository. Downstream consumers may build on it as a foundation for map-tool applications. Vulnerabilities in the template propagate into every project built from it, so we take security reports seriously.

## Reporting a vulnerability

**Please do not file security issues on the public issue tracker.** Email reports to:

> **security@uraanai.com**

Use the subject line `[MapForge] <short description>`. If you'd prefer encrypted email, request our PGP key in your first message and we'll respond with it before you send the details.

Please include:

- A clear description of the issue and its impact.
- Step-by-step reproduction (versions of Node, pnpm, browser, OS where relevant).
- Affected files, commits, or dependencies.
- Proof-of-concept code or screenshots if applicable.
- Your name and contact details for follow-up (or a pseudonym if you prefer; we'll still credit you in the advisory if you wish).

## What to expect

| Timeline                    | Action                                                                                                                                         |
| --------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| Within **3 business days**  | Acknowledgement of receipt and an initial triage classification (informational / low / medium / high / critical).                              |
| Within **10 business days** | First substantive update — confirmed vs. not reproducible, owner assigned, target fix window.                                                  |
| Within **30 days** (target) | Patch released for confirmed medium-or-higher findings. High and critical findings are prioritized over scheduled work.                        |
| **Coordinated disclosure**  | After a patch ships, we publish a GitHub Security Advisory crediting the reporter (unless anonymity was requested) and link to the fix commit. |

These are targets, not contractual SLAs — exact timing depends on severity, reproducibility, and the complexity of the fix. We will keep you informed.

## Scope

In scope:

- The template code in this repository (`src/`, `vite.config.ts`, `Dockerfile`, `nginx.conf`, CI workflows under `.github/`).
- Default configuration that ships with the template (e.g., security headers in `nginx.conf`, CSP defaults, ESLint rules that exist to catch unsafe patterns).
- Documentation that recommends insecure practices.

Out of scope:

- Vulnerabilities in third-party dependencies (please report those upstream; we will bump pinned versions promptly once an upstream fix is available).
- Findings that require the operator to already have privileged access to the host machine, container runtime, or build environment.
- Theoretical issues with no demonstrable impact on a production deployment derived from the template.
- Misconfigurations in downstream forks that diverge from our defaults.

## Supported versions

MapForge is pre-1.0. While that's the case, we patch the `main` branch and tag a new patch release. Once we cut a 1.0, the most recent minor release line will receive security patches; older lines will be supported on a best-effort basis only.

| Version             | Security patches |
| ------------------- | ---------------- |
| `main` (unreleased) | ✅               |
| `0.x` (current)     | ✅               |
| Pre-`0.1.0`         | ❌               |

## Safe harbor

We will not pursue legal action against researchers who:

- Make a good-faith effort to avoid privacy violations, data destruction, and service interruption.
- Report findings privately to the address above and give us reasonable time to remediate before public disclosure.
- Do not exploit the issue beyond what is necessary to demonstrate the vulnerability.

If you're unsure whether your testing falls within these bounds, ask first — we'd rather have the conversation than refuse a report.

## Defensive guidance for downstream consumers

Because MapForge is a template, security also depends on how it is deployed. We recommend:

- Pin dependency versions in your fork and enable Dependabot or Renovate.
- Run `pnpm audit` on every CI build; treat high/critical findings as build failures.
- Review the default Content Security Policy in `nginx.conf` before going to production — the shipped policy is a baseline, not a finished policy for every environment.
- Do not commit `.env*` files containing real credentials. Use a secrets manager (Vault, AWS Secrets Manager, GitHub Actions secrets) for production values.
- Audit any components you add for unsafe HTML rendering (`v-html`, `innerHTML`, `markdown-it` without sanitization on untrusted input).

Thank you for helping keep MapForge and the projects built on it secure.
