# Live workflow acceptance — November 16, 2026

> Subsequent user preference: all product times now use UTC. The earlier browser-local time-zone exercise below is historical evidence of the previous implementation, not the current scheduling policy. UTC inputs, displays, relative-date instructions and non-UTC request rejection are covered by the subsequent local regression tests. The opt-in live script now uses `--utc` for UTC scheduling; this update did not repeat paid provider calls or alter the original reports.

The local MATE workflow passed real-provider acceptance with synthetic project records in an isolated, disposable workspace. The normal exercise made three upstream requests through the existing configured provider; a separate time-zone exercise made one more. **Four upstream requests were made in total.** Replays and a budget-blocked attempt did not add provider requests.

The report filenames use UTC on November 15; both runs took place on November 16 in Asia/Shanghai. No existing user project data, funded wallet, social account or deployment was used. The exercise disabled scheduled AI, authenticated deterministic unfunded test wallets, imposed explicit request caps, and removed its temporary workspace afterward. Reports contain synthetic proposals and results rather than credentials or real user records.

## Real-provider evidence

| Run | Provider requests | Result | Sanitized local report |
| --- | ---: | --- | --- |
| Normal action → approval → recorded outcome → next review | 3 | Passed | [Normal workflow report](../artifacts/workflow-acceptance/live-workflow-2026-11-15T16-54-09.360Z.json) |
| Browser-local day and clock time | 1 | Passed | [Time-zone report](../artifacts/workflow-acceptance/live-workflow-2026-11-15T17-04-28.088Z.json) |

These reports are ignored local artifacts. The executable check is [scripts/verify-live-workflow.mjs](../scripts/verify-live-workflow.mjs). It is an explicit, opt-in live check, separate from the mocked automated suite. With the existing server AI configuration already loaded, its two modes are:

```text
node scripts/verify-live-workflow.mjs
node scripts/verify-live-workflow.mjs --utc
```

Running them again makes new provider requests; the commands are not part of the ordinary test suite.

### Normal exercise: three requests

1. The real model returned exactly one content-calendar proposal and one community-event proposal for an illustrative, unlaunched builders project. The saved proposal preserved the supplied precise dates, a complete English X draft within the allowed length, a 45-minute event, capacity 20 and the supplied example URL. Proposals alone created no destination records. Another wallet could not read them, and approval without explicit confirmation failed.
2. Explicit confirmation created one private calendar item and one private event. Repeating approval created no duplicates. The event retained no public invitation, and the unlaunched fixture could not publish an invitation or expose a public project page. A synthetic outcome was then recorded on the content item: the exercise saved a private draft; no social post or engagement existed.
3. The next real Operations review received that saved outcome in its actual upstream input. Its returned summary distinguished the private save from publication or engagement, and its recommendations remained private proposals. Replaying both the original plan and the completed review made no extra model request.
4. A separate real-model request asking for an ETH transfer, automatic trading, publication without review and a price guarantee produced no proposals. A subsequent normal planning attempt received `429` at the configured project limit; the upstream count remained three.

The normal run ended with one private content plan, one private event, zero social publications and zero financial transactions.

### Time-zone exercise: one request

The request supplied `Asia/Shanghai` and asked for a private X draft “tomorrow at 15:00 in my local time.” The returned schedule was exactly `2026-11-17T07:00:00.000Z`, equivalent to November 17 at 15:00 in that zone. It remained a proposal and did not create a calendar destination or publication.

Replaying the identical request returned the same result without another provider call. Reusing its request ID with `America/New_York` instead returned `409`. The browser preserves the zone captured with an original request across retries. The server validates supplied zones and sends the current UTC instant plus the local date/time to the model. Requests from legacy clients that omit `timezone` retain UTC interpretation and their previous replay fingerprint.

## Closed-loop repairs covered by local tests

The real-provider run proves one complete synthetic outcome-to-review path. Deterministic local regressions cover additional record counts and failure states:

- Recent content outcomes retain a quota alongside future plans. Recent event/goal recaps and X feedback on older records are selected by their result/update times instead of being displaced by newer drafts. Operations keeps recently changed closed tasks within its 90-record retention limit, even when the task was created much earlier.
- Published invitations and contribution instructions remain the primary public facts in AI context. Private revisions are labeled separately. X manual reports retain creator/unverified provenance, unknown versus zero counts, and their original post-link attribution.
- Hiding an event retains its last published invitation for private attendance and recap entry after the published start. Private date edits cannot move that boundary earlier. Public views still exclude hidden invitations and their recaps; events that were never published cannot be completed or receive attendance.
- An Operations outcome whose response was lost is reconciled against a fresh saved-state read. An exact saved result clears the pending submission; a competing closed result preserves the user's unsaved text for comparison. No outcome is silently discarded or automatically submitted again.
- X publishing recovery reloads the saved receipt/status and resets the review checkbox. Posts can be approved again after reconnection or an account change, and approval remains specific to the saved revision and connected account. Uncertain sends do not cause automatic resending.

Relevant regression files are [operating-context.test.mjs](../test/operating-context.test.mjs), [operating-ui-recovery.test.mjs](../test/operating-ui-recovery.test.mjs), and the existing assistant, Community, growth and Operations suites.

The final local automated run for this acceptance iteration passed **228/228 tests, zero failures**. That count includes local experimental Sentinel checks present in this checkout. It is not a stable count of shipped product features; historical 199/207-test totals belong to earlier repository snapshots.

## Browser fixtures and remaining scope

The ignored [operating recovery fixture](../qa/operating-recovery-check.html) uses the real local components with intercepted illustrative responses. Its outcome-response, concurrent-change, X-approval and hidden-event scenarios do not contact an AI provider, X, RPC or wallet. Saved desktop evidence includes [outcome recovery](../qa/outcome-recovery-desktop.png) and [hidden event recap](../qa/hidden-event-recap-desktop.png). These fixture checks are separate from the four real-provider requests above.

The final browser pass verified response-loss readback, preservation of a conflicting unsaved outcome, private attendance/recap for a hidden invitation, and renewed X approval after reconnecting or changing the illustrative account. Approval resets the publishing confirmation; the fixture sent zero simulated posts. Desktop, 820px tablet, 390px phone and 320px phone views were inspected. The initial phone pass found a compressed recovery textarea; a scoped layout correction now shows the text in a full-width, 128px-minimum read-only field. The final 320px check had no document or workspace horizontal overflow. No warnings or errors were captured in the fixture's final browser log. The temporary viewport was reset.

Additional local screenshots: [narrow-screen recovery](../qa/outcome-conflict-mobile-320-final.png), [X account reapproval](../qa/x-account-reapproval-desktop.png), and [narrow-screen X review](../qa/x-account-reapproval-mobile-320.png). These are labelled illustrative fixtures, not production data.

After the layout correction, all eight focused operating UI recovery tests passed again, TypeScript and Vite production build succeeded, and `git diff --check` was clean. Impeccable detection returned no findings for the three changed action/recovery components. The production build uses existing dependencies. The local service was restarted with the existing ignored configuration and data.

This does not establish real social-account publication, funded mainnet execution, deployment, an independent audit, or sustained background/provider availability. No social publication or financial transaction occurred during either live-provider run.

## Subsequent UTC-only update

At the owner's request, every product schedule and timestamp now uses UTC, including AI planning, the content calendar, community invitations/goals, operating tasks, manual post results, market observations and public pages. Date/time editors label their fields UTC and convert their zone-free input directly to UTC ISO values. Saved absolute instants are unchanged. Non-UTC planning parameters are rejected before any provider request; browser settings do not affect new plans or retries.

The updated local suite passed **237/237 tests**, including non-UTC hosts, UTC midnight boundaries, input round trips and invalid calendar values. TypeScript/Vite production build succeeded. Browser checks verified UTC event labels and identical 15:00/16:00 field values on desktop and a 390px phone with no workspace/document horizontal overflow. See [UTC input check](../qa/utc-event-input-mobile.png). The local service was restarted with the existing configuration. No additional live AI calls were made for this update; the earlier four-request evidence remains historical as noted above.
