# MemeHelm OS — implementation direction

User authorization: “改吧”, following the agreed third desktop concept and motion preview. The user explicitly wants an OS desktop, with a designed background when all windows are closed. English user-facing copy; no developer information. Existing application pages and wallet/transaction logic must remain.

## Direction contract

THESIS: A creator's desktop that keeps issuance, project context and ongoing operations one app away. Preserve independent tools and a personal desk instead of replacing them with a dashboard grid.

OWN-WORLD: Graphite ground, cold-white text, soft silver dimensional icons, original angular M with citron notch. Matte solid window interiors and restrained translucent chrome; no pastel reskin or retro pixel typography.

STORY: A visitor recognizes a working desktop, opens Launchpad or Workspace, and follows an actual task. Private projects and AI actions remain behind wallet sign-in; examples identify themselves. Closing tools returns to the branded desk.

FORM: `seed: none (pinned)`. The existing OS world was explicitly retained by the user's words: “都不好 我还是喜欢os的感觉只是现在这款os做的有点丑 你能去找点参考吗”. The user then requested the closed-window state: “这是窗口打开的情况 那窗口没打开的时候呢 设计一下背景”, asked for animation, and authorized implementation with “改吧”. The third mockup and interactive motion preview carried this selected direction; they are critique references for this code-led implementation. These named blocks formalize the carried-forward contract at review; no seed run is claimed.

Modern OS desktop in graphite, cold white, silver and MemeHelm citron. Original angular M as a large quiet relief on the wallpaper, never a circular plate. Nine desktop shortcuts in height-responsive columns, or a three-column phone grid; common apps in a floating, translucent Dock; the same nine apps reachable in an Apps menu. App icons share one matte dimensional tile with an angular citron detail. Thin top menu bar. Independent draggable and resizable windows, quiet glass titlebars, solid content surfaces, soft shadows, left traffic-light controls.

FIRST VIEWPORT: no open window on a fresh home visit. Brand wallpaper occupies the center-right; shortcuts left; floating Dock below. The top brand opens Workspace. Workspace shows real project identity, next actions and actual saved projects, or an honest empty state. AI, launch, treasury, discovery and signals remain independent tools.

Signature interaction: opening and restoring an app uses a 240ms transform/opacity transition; minimizing returns to its persistent Dock icon. Dock hover rises by 4px. Three small light points wander independently; never moving lines. Background pauses when hidden and has an explicit pause control on desktop and in the Apps menu. Respect reduced motion; keyboard actions skip window animation.

Responsive: at 720px and below, windows fill the available desktop surface, preserving top navigation and scrollable Dock. App menu preserves all tools. At 360px the wordmark condenses to its original M. No horizontal document scrolling.

FINISH: unreviewed and undocumented is unfinished; this build ends with the finish review, the verdict, DESIGN.md, and every shipping raster carrying its provenance

## Quality bar and scope

Recognizable MemeHelm OS rather than a SaaS dashboard or retro pixel theme. Calm, legible, consistent surfaces and honest states; useful working UI instead of invented statistics. Existing functionality remains reachable. Native SVG is used only for the established brand geometry and small app glyphs, not a raster illustration substitute.

Dedicated quality bar card: `.impeccable/os-quality-bar.md`.

Code-led implementation within the approved direction, not a pixel-for-pixel generated-comp build. The generated concept is a critique reference only:
`C:/Users/霸道少萝/.codex/generated_images/01a13ff0-fca3-7a70-9ffc-2e450b387b89/exec-1b8abb31-e7ea-45d1-a20b-ec2a108f9dae.png`.

## Verification boundary

Screenshots verify signed-out working surfaces and shell behavior; wallet sign-in, paid AI and mainnet writes are not executed as part of visual QA. Existing local tests pass (104/104). Browser environment reports reduced-motion preference, so live screenshots show that branch. Animated branch is checked in source; screenshots cannot prove timing.

Mechanical detector ran once across Desktop, Wallpaper, EntryLoader and their three CSS files: no findings. No new raster assets ship. UI changes do not modify environment variables, provider credentials, contract code or API logic.
