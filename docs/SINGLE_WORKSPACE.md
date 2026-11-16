# Persistent MemeHelm workspace

MemeHelm uses one persistent primary window, an independent MATE assistant on its right, and temporary dialogs for bounded actions. It retains the titanium OS chrome, architectural wallpaper, graphite interiors, silver tools, citron accent, existing fonts and English product copy defined in the root `DESIGN.md`.

## Main canvas and navigation

Workbench, Launchpad, Projects and Market are the four global areas inside the same main frame. Detailed project tools and market views replace its content without opening another window. MATE remains adjacent. The rail, top bar, Apps, search, Dock, Command widgets and tool links use this common navigation. Its title and selected navigation identify the current task.

The shared project header groups Overview, Content, Community, Treasury and AI setup. Content contains Writing, Assets, Calendar and Publishing; Community contains Events & links, Goals and Public page; Activity is under Overview. Overview, memory and activity reuse one operations host. Each other visited editor keeps its own mounted surface and guard. Treasury uses the same project header and selector. Market groups Discover and Watchlist & alerts. Allocation preview is embedded in Launchpad; old calculator links remain compatible.

Visited primary pages remain mounted with stable keys; inactive pages are hidden and inert. Their form values, filters, scroll positions, selected records and pending requests survive ordinary navigation. Minimize and Show desktop hide the attached stage; selecting an application restores it. Focus mode temporarily gives the main task the available width. These actions do not discard work or cancel a request.

Browser back/forward and the titlebar back control restore the primary route without creating another window or pushing a duplicate entry. A repeated click on the active app does not add a history entry. Discover token links retain workspace history state. Legacy `#app/copilot` links enter the project workspace and reveal MATE.

## One assistant

`WorkspaceAssistant` owns exactly one `ProjectChat` host, which supports general conversations as well as the selected project. A verified wallet can chat before creating a project. General chat has its own wallet-scoped history; it never creates a placeholder project. AI shortcuts, Command links and the Dock reveal this existing panel without changing the main route. Collapsing, reopening, minimizing and focus mode preserve the conversation. The current shell does not mount the old floating MATE companion or a second Command chat card.

MATE follows the same authenticated wallet as the main canvas. When a project is available, Platform chat and Project chat explicitly choose whether its context is included. A newly loaded or created project never silently replaces an ongoing platform conversation. Unsent questions and pending requests prevent scope changes. Navigation alone never requests paid AI output. Platform chat supports ideas, explanations and writing for MemeHelm workflows; live project observations and action planning stay in Project chat. Chat history, downloads, deletion and request recovery work in both scopes. Approved assistant results open the corresponding saved calendar entry, community event or payout review in the main canvas; approval and wallet-signing boundaries remain unchanged.

### Platform scope

MATE only handles MemeHelm help, project creation and launch preparation, supported wallet workflows, revenue and Treasury, project knowledge, community content and activities, and interpreting supplied market observations. Unrelated questions cannot be made relevant by mentioning a brand, disguising them as community drafts, roleplay, or instructions inside project memory or chat history. A greeting or ambiguous follow-up asks for the user's platform task; mixed requests answer only the platform portion.

`server/mate-scope.mjs` supplies the authoritative system policy and fixed English refusal. Chat completions must use the exact `scope`/`reply` envelope. Off-topic and malformed completions return the fixed refusal, never raw provider text. Action planning requires a scope field too; off-topic plans force an empty proposal list, and malformed plans fail before saving actions. The shared policy also accompanies the other platform generation tasks without changing their existing response schemas. The model still performs semantic classification; envelope validation is not proof against every possible prompt injection, and tests with provider stubs verify the boundary implementation rather than an empirical model jailbreak rate.

The policy version stays in the server request journal, outside browser input. Replaying a result from before the policy fails safely and asks the owner to inspect saved work before explicitly starting a fresh request. It does not silently regenerate or charge for the same request ID. Existing historical conversations remain available to their owner and are not deleted by this policy.

## Responsive layout and accessibility

At widths of 1100px and above, an 88px single-column tool rail sits beside the main canvas and attached assistant. MATE defaults to 340px wide, adjustable from 280px to 460px by dragging its divider or using the divider's arrow-key controls. Collapsing MATE or entering focus mode gives the main canvas the released space.

Below 1100px, the rail disappears and MATE becomes an explicitly opened drawer. The drawer uses dialog semantics, traps focus, makes the covered main surface inert, and supports Escape and backdrop dismissal. A primary route change dismisses the drawer while preserving its chat. Transaction and sign-in dialogs retain focus priority. Apps, search, the Dock and horizontal project-tool navigation keep every task reachable.

At widths of 720px and below, the primary frame fills the available middle surface, with no outer margin. The top bar and horizontally scrolling Dock remain reachable; task interiors adapt to their actual container width. Reduced motion, pauseable wallpaper points, visible focus and existing entrance preferences remain in effect.

The MATE entrance now lasts 5.5 seconds, plus its existing 180ms exit. The desktop reveals at 4.35 seconds and the character reaches its target at 5.15 seconds. Its first destination is the visible welcome portrait inside the assistant panel; an existing chat uses the panel's title portrait. If the panel is closed on a narrow screen, the visible MATE control is the compact destination. Hidden copies and offscreen targets are ignored. The actual image is held transparent during the flight and restored through a short crossfade, including safe restoration on skip or failure. No floating mascot is added to the lower-right corner. The existing seen-state key remains unchanged; Apps → Replay intro previews the full sequence.

## State and permission boundaries

Each visited editor and request has its own guard. Hiding one tool cannot clear another tool's guard. The shell aggregates guards for explicit project changes, sign-out and browser exit; Launchpad and Treasury report their local assistance, draft and review states into that boundary. A rejected project change reveals the protected tool or assistant instead of replacing its context.

Signing out while work is pending requires an explicit keep-working or discard-and-sign-out decision. Wallet changes reset the private workspace boundary. Mainnet transactions still require current prepared terms, the existing review and risk acknowledgments, and the user's wallet signature. Revision checks, public-visibility consent, transaction expiry and recovery remain authoritative. Temporary dialogs handle import, previews and confirmations above the stable task surface.

## Implementation layers

| File | Responsibility |
| --- | --- |
| `src/SingleWorkspace.tsx` | Stable main frame, visited page slots, attached assistant, navigation, focus mode, drawer, aggregated guards |
| `src/Desktop.tsx` | Desktop entry wrapper, app inventory, shared icon and utility components |
| `src/main.tsx` | Existing business callbacks, primary route, selected project and the single assistant element |
| `shared/workspace-navigation.mjs` | Primary page keys, project-tool mapping, route parsing and guard destinations |
| `src/CopilotWorkspace.tsx` | Persistent project-tool presentation and independent editor guards |
| `src/WorkspaceAssistant.tsx` | Unique project chat host and assistant guard |
| `src/workspace-assistant.css` | Shared horizontal project-tool navigation and persistent AI interior |
| `src/single-workspace.css` | Last shell layer: main/assistant layout, 88px rail, divider, responsive drawer and phone canvas |

The preceding Command, Launchpad, application, community and Treasury style layers retain their interior improvements. The single-workspace layer governs their outer geometry; it does not replace their business logic.

## Verification

The latest complete automated run passed **319/319 tests**. Coverage checks a single primary frame, unique assistant, persistent hidden slots, all navigation entry points, route synchronization, project-change rejection, explicit sign-out and browser-exit protection. General chat adds verified-wallet isolation, separate project and general histories, pagination/export/deletion, idempotent retry and restart recovery, UTC daily usage, no automatic project creation, input method handling, and unsent/in-flight scope guards. Platform-scope coverage includes fixed refusals in chat and planning, malformed output handling, no hidden off-topic proposals, and safe pre-policy journal replay. Providers are stubbed. The Treasury regression prepares a component review with stubbed responses, verifies that it survives primary navigation and blocks project changes, releases the guard when the review closes, and keeps unfinished escrow fields protected without signing.

Real-browser visual checks have covered 1440px desktop, 1280×720 desktop, 1024×768 tablet and 390px phone layouts.

The general-chat revision was checked in two visual passes at 1440×900 and 390×844 using the isolated fixture, including an empty conversation and a sent message with an explicitly illustrative reply. It had no console errors, page overflow or failed images. Evidence is in `qa/general-chat-visual-final/`.

The platform-scope refusal and the new English scope notice were checked at 1440×900 and 390×844, using a visibly labeled fixture with a scripted refusal. `qa/mate-scope-visual/` contains the screenshots and browser report. This verifies presentation, not a live model's semantic decision.

The 5.5-second MATE revision passed 52 focused tests across choreography, live target selection, WAAPI disposal, intro preferences, keyboard exit, chat and the persistent workspace. TypeScript and the production build passed. Desktop and phone frame sequences are in `qa/mate-intro-55-desktop/` and `qa/mate-intro-55-mobile/`; captures include extra time before/after the animation. In a real browser run of the isolated fixture, entry completed in 5,794ms including setup and exit, the actor's landing center was within 0.004px of the welcome portrait center, and no temporary arrival marker remained. A separate Escape replay completed in 433ms including input dispatch. Bundled production-page screenshots are in `qa/mate-intro-55-production/`, with no console errors, page overflow or failed images. These checks made no wallet or paid AI request.

QA fixtures are isolated and explicitly illustrative. This UI acceptance does not claim real paid AI generation, social publication, a wallet-signed mainnet transaction or an independent audit.
