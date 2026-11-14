# Creator operations extension

This extension adds work after token issuance to the existing Robinhood mainnet creator workspace. It is a local release, with no external publication or funded transaction performed during verification.

## Workflows

- **Today** combines overdue actions, proposals awaiting approval, ready actions, community reviews, planned posts/events and creator-recorded outcomes. Market evidence retains observation times and the explorer's returned balance sample. Addresses are not labeled as people, whales or trustworthy holders.
- **Community goals** have private drafts and explicit public snapshots. Instructions lock after the first submission. Authenticated visitors submit one contribution per wallet per goal, with optional HTTPS evidence and public-sharing consent. Creators approve or decline with a review note. Only approved, opted-in entries enter the public list and scoreboard; approved private work still counts toward the goal. Points have no financial value. Withdrawal removes the public entry and points.
- **Goal completion** closes submissions and review, even below the target. A factual recap stays private unless explicitly shared. Completed goals can be hidden while retaining their records. Closed goals do not count as pending reviews on Today.
- **Content calendar** stores private drafts, intended channel and local publication time. Copying content and opening X's composer are manual actions. Completing a plan records the creator's outcome, not a verified publication receipt. Calendar plans and outcomes become bounded context for later operations reviews.
- **Meme Studio** imports PNG/JPEG/WebP artwork up to 5 MB and 6,000 pixels per dimension, composes captions and downloads a square 1080-pixel PNG. It runs entirely in the browser. It does not generate AI images, upload files, publish media or retain artwork after the tool is closed.
- **Shared task outcomes** publish only the reviewed title and result after explicit confirmation. Private task instructions are excluded. Public pages distinguish creator reports from transaction receipts.

## Data and consent

Private endpoints require the existing authenticated owner session. Public participation requires its own verified wallet session. Public responses omit participant wallet addresses and private review notes, except that a signed-in participant can retrieve their own review. Evidence links are validated but never fetched by the server. Public project visibility still controls whether goals and contributions are available.

Goals, contributions and calendar plans use the existing SQLite document store. Limits are 50 goals and 200 calendar plans per project, and 500 contribution records per goal. Revision checks reject stale mutations. UI forms preserve edits after failed saves and expose explicit reload recovery for conflicts. Project navigation stays locked while the current editor holds work.

## Local verification, 2026-11-14

The browser fixture uses real components and persistence modules with clearly labeled illustrative data in a separate temporary database. It makes no external requests. Browser checks exercised private creation/publication, failed saves with retained edits, stale-goal recovery, participant submission, creator approval, point visibility, withdrawal, goal completion/shared recap, calendar creation/completion, explicit task-result publication, local image import, layout changes and a real PNG download. These checks do not substitute for real wallet-prompt acceptance or live X API integration.

Two visual inspection batches checked 1440×1000, 1024×768, 768×1024, 390×844 and 320×800. The narrow layouts have local horizontal navigation and stacked forms rather than page overflow. Screenshots are retained under `.impeccable/review/`; example values are fixture data. The mechanical design detector returned no findings. A separate finish review is recorded with the final verification result.

The established `docs/DESIGN.md` remains the visual system: graphite surfaces, cold-white text, citron actions, DM Sans/Space Grotesk, 44-pixel main controls and container-based reflow. No theme replacement, new UI library or credential change was needed. Existing Impeccable setup drift was reported, not repaired.

Automated acceptance finished with 104 passing tests, zero failures. TypeScript checking, the production Vite build, credential-boundary scanning and `git diff --check` passed. The repository has no configured lint script. A separate unfunded test wallet exercised private goal persistence, calendar completion, overview linkage, rejected publication for a private project, anonymous denial and cross-owner denial against the real server on port 4318. Its exact temporary records were removed, preserving existing projects and watches. No model request, social post or financial transaction was sent by that acceptance script.

The initial finish review requested two corrections: reveal the active horizontal navigation item after shortcuts/resizing, and replace new arrow glyphs with the existing SVG component. Both corrections were applied together. Browser measurements confirmed the selected Community goals button fully visible at a logical 320-pixel viewport, with no horizontal page overflow, and still visible after resizing. All required viewport evidence was recaptured over the same files for the reviewer's verdict. Screenshot raster dimensions may exclude chrome/scrollbars and are not asserted to equal the requested logical viewport dimensions.

The verdict pass returned **ship** for the two scored fixes in this extension, with both resolved and no regressions observed in the ten required captures. This is not a whole-product audit or a claim of full keyboard/device coverage. After the UI rebuild, the verified MemeHelm listener on port 4318 was restarted with the existing ignored environment file; the real-service acceptance script passed again against that process. The database was preserved.

## Remaining integrations

Real X OAuth/API acceptance requires the user's developer application. Discord/Telegram remain community links and manual content destinations. Public hosting, production backups, unattended hosted monitoring, richer external news/social data, audited contracts and human-signed mainnet acceptance remain separate work. This iteration does not claim full MemeOS feature parity.
