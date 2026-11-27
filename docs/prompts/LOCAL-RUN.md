# Running a track in a terminal on the owner's Mac (27 Nov 2026)

The owner runs the third-run tracks (T8, T9, T10, RT6) in Claude Code in a terminal on his Mac instead of at claude.ai/code. Everything in `LONG-RUN-RULES.md` still holds. These lines replace the parts of it that assume a cloud container.

1. **Your folder.** You were started in your own git worktree: `~/Code/nimbus-t8`, `~/Code/nimbus-t9`, `~/Code/nimbus-t10` or `~/Code/nimbus-rt6`. Work only there. Never open, change or run anything in another worktree, in `~/Code/nimbus-pos-event`, or anywhere else on this Mac. Your worktree starts on a detached commit; create your branch exactly as your prompt says.
2. **Install.** Run `corepack pnpm@8.15.0 install --frozen-lockfile` once in your worktree. Install nothing globally.
3. **Database.** A throwaway Postgres 16 runs in Docker on `127.0.0.1:5432`, user `postgres`, no password, reachable only from this Mac. Create your own databases, always named with your track first (`t8_…`, `t9_…`, `t10_…`, `rt6_…`), and never touch another track's. Set `DATABASE_URL` and `DIRECT_DATABASE_URL` in your shell to `postgresql://postgres@127.0.0.1:5432/<your db>`; never write them to a file. If that server is not answering, say so in your progress file and work on what needs no database. Never Neon. Never read, print or write `.env*`.
4. **Ports.** Anything you start listens only on your own ports: T8 web 3100, API 4100; T10 web 3200, API 4200; T9 API 4300; RT6 API 4400. Redis, if a test needs it: run your own with Docker on 6300 (T8), 6301 (T9), 6302 (T10), 6303 (RT6), named `redis-<track>`, and stop it when done.
5. **Browser.** Drive screens with Playwright's own Chromium (`pnpm exec playwright install chromium` inside your worktree if it is missing). Do not use or close the owner's own Chrome windows.
6. **Stopping things.** Record the PID of everything you start and stop only those; never `pkill`, never `killall`, never stop a Docker container you did not start.
7. **Git.** Push only your branch, exactly as your prompt says. Never `git worktree remove`, never delete a branch, never touch `rebuild/main`.
