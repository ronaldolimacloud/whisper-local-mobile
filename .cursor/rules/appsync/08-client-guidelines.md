Client usage

GraphQL: generate typed operations; ensure subscription docs ⊆ mutation response.

Events: pre‑define channel patterns; use wildcards sparingly. Chunk large payloads; prefer IDs over blobs.

Reconnect with jittered backoff; debounce UI updates; maintain an in‑memory store keyed by IDs.

Mobile: background handling—queue/display on resume; avoid heavy work on event thread.