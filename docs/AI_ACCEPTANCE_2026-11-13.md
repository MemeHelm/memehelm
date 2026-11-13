# Live AI acceptance — 2026-11-13

## Current result

The user-provided credential matches the existing ignored server credential. Its authenticated model list now returns HTTP 200. Earlier HTTP 403 group-permission failures are historical; no provider account permissions were changed by the assistant.

The active local model is now `gpt-6.1-sol`. A fresh Signals brief for the public BIAO token completed through both an isolated authenticated application server and the actual running product at port 4318, each in about 13 seconds. Private persistence passed. No provider permissions, credential, base URL, wallet code or signing boundary were changed.

Earlier checks found that `gpt-6-luna` did not return within 60 seconds. `gpt-5.6-luna` subsequently completed social drafting, daily briefing and one Signals request, but later Signals requests were rejected with HTTP 400: `Model "gpt-5.6-luna" is not available for this group`. Authenticated model discovery still listed that model. The observed group rejection explains the reproduced failure; the screenshot's original request had no retained provider diagnostics, so its exact status cannot be recovered.

Only `AI_MODEL` in the ignored `.env` was changed to select the newly verified model. The running localhost backend was restarted to load it. A model appearing in `/models` is not treated as proof that generation is available.

## Fresh end-to-end evidence

| Check | Result |
| --- | --- |
| Authenticated model discovery | HTTP 200; selected model advertised as OpenAI Chat Completions compatible. |
| Social draft through the real application API with isolated storage | HTTP 200 in about 7.7 seconds; 379 characters; saved history matched the output and remained private. Editing and saving the result also succeeded and did not publish it. |
| Daily brief through the actual running local product at port 4318 | HTTP 200 in about 18.5 seconds; 979 characters; response reported the selected model; saved history matched the output and remained private. |
| Signals brief using `gpt-6.1-sol`, isolated authenticated application server | HTTP 200 in about 12.7 seconds; 1,203 characters; exactly one provider call; private history matched; another wallet could not read it. The sampled BIAO watch stayed paused. |
| Signals brief using `gpt-6.1-sol`, actual running product at port 4318 | HTTP 200 in about 12.7 seconds; 1,340 characters; saved history matched; anonymous history requests returned 401; paused watch stayed paused. Used a separate unfunded deterministic wallet; removed only its exact temporary watch/brief and logged out afterward. |
| Temporary data | Isolated storage was removed. The running-product check used a separate unfunded deterministic test wallet and a uniquely created private draft; only that draft and its activity were removed afterward, and its test session was logged out. |
| Credential boundary | `.env` remains ignored by Git; the credential was not found in `src`, `public` or the built browser assets. No credential or provider settings were added to the user interface. |

Sanitized evidence is in the ignored `artifacts/ai-readiness-2026-11-13/` directory:

- `live-generation-working-model.json`
- `running-product-generation.json`

The samples used illustrative unlaunched projects without user-private project data, onchain transactions or fabricated market facts. Paid generation was explicitly requested by the user supplying their provider credential. These checks cover live social drafting and daily briefing, persistence and private editing; they do not claim a live acceptance run of every task, every model, or long-term provider availability. No automatic paid retries or model failover were introduced.

The later Signals checks used the public BIAO address `0x579a86802556ed5f4e103981400c4da9cd015497` and actual observed token data, with no user-private alerts. Their sanitized evidence is under ignored `artifacts/signals-ai-fix-2026-11-13/`: `reproduction.json` (initial successful old-model reproduction), `verified-generation.json` (new-model isolated acceptance), and `running-product-generation.json` (new-model running-product acceptance). Failed group-denial probes preceded the model change. The previously passing post/daily samples above belong to the earlier model; the new model's live acceptance covers Signals specifically.

## Error recovery changes

- Classify busy, timeout, access and invalid-response failures without exposing provider text. A bounded HTTP 400 error body recognizes the observed model/group rejection. Server logs retain allowlisted status/category/timing and UUID request IDs only; prompts, provider response text, credentials and settings stay out of logs and user messages.
- Signals identifies the affected token, offers an explicit retry for transient errors, marks only that row as writing, and preserves saved briefs. Successful generation inserts the already-persisted result directly, so a later history refresh cannot misreport that successful generation as a failed write and invite a duplicate paid request.
- Align the Signals browser deadline (80 seconds) with its bounded core market read (12 seconds), model request (60 seconds) and response overhead. Other API timeouts retain their earlier values.
- Invalidate outdated refreshes and ignore old-wallet results. Hidden price thresholds remain hidden, and narrow watch rows group identity, settings and the brief action without a detached remove button.
- **41 Node tests passed** after the changes; TypeScript, production build and diff whitespace checks passed. Tests cover the observed HTTP 400 denial, 401/403, 429, 5xx, transport timeout, malformed/empty results, private history retention and a later explicit retry. No lint script is configured.
- Real-component browser checks used an explicitly labeled local fixture with no provider, wallet or chain requests: two desktop/mobile visual passes, 768px tablet and 390px/320px wrapping/overflow checks, saved-brief access after failure, manual retry, and success. Switching fixture wallets during generation cleared prior history and ignored the late result. These are emulated viewports, not physical-phone acceptance. Screenshots in the ignored Signals evidence directory: `recovery-desktop.jpg`, `recovered-desktop.jpg`, `recovered-mobile.jpg`. Fixture records/output are illustrative and are not the live-provider acceptance evidence.

## Scope of the fix

F1 from the functional audit is now resolved for the selected model in the local application. Human-wallet mainnet acceptance, public hosting, independent contract audit, explorer holder availability and sustained background-monitoring acceptance retain their separately documented limits.

The provider's public integration guide is at https://rivernexus.vip/api-guide. The current outcome is supported by the actual HTTP/application checks above, not by model-list presence alone.
