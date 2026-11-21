# Event Till prompts

Prompts for the B'rakaland Event Till (Sat 28 Nov 2026). One prompt = one milestone = one session, run by path: `Implement docs/prompts/<file>`. Schedule and cut line: `docs/event/06_MILESTONES.md`.

| ID | Prompt | Model | Status | Report |
|---|---|---|---|---|
| H0 | `H0-clean-base.md` | Sonnet | done 2026-11-21 | `reports/H0_BASELINE.md` |
| H1 | `H1-sale-engine.md` | Sonnet | built 2026-11-21, awaiting H1-R (1,234 unit tests / 68 suites, e2e 35/35) | `reports/H1_EVIDENCE.md` |
| H1-R | fresh review of H1 | Opus | done 2026-11-21, verdict blockers | `docs/reviews/h1-sale-engine.md` |
| H1F | `H1F-fix-review-findings.md` | Sonnet | built 2026-11-21, 12 of 13 probes green, 2 reviewer probes need a ruling (1,254 unit tests / 69 suites, e2e 141/143) | `reports/H1_EVIDENCE.md` (H1F section) |
| H1F2 | `H1F2-last-two-fixes.md` | Sonnet | built 2026-11-21: S-1 and S-2 fixed, 3 of 3 full e2e runs 166/166, 1,288 unit tests / 70 suites | `reports/H1_EVIDENCE.md` (Accepted risks), `reports/proof/H1F2_final_runs.txt` |
| H2 | go live (prompt not yet written) | Sonnet | not started | `reports/H2_REPORT.md` |
| H3 | event till screen (prompt not yet written) | Opus | not started | `reports/H3_REPORT.md` |
| H4a | event reports API (prompt not yet written) | Sonnet | not started | `reports/H4a_REPORT.md` |
| H4b | live view (prompt not yet written) | Opus | not started | `reports/H4b_REPORT.md` |
| H5 | after the event: bank match and final report (prompt not yet written) | Sonnet | not started | `reports/H5_REPORT.md` |

Report paths for H1-R to H5 are proposals; each prompt sets its own when written.
