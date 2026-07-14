# Milestone 0 — Real API Verification Findings

Verified 2026-07-11 against the live Xtream Codes backend at `http://10.1.20.202:9191` (user `claude`).

## get_live_categories

`GET /player_api.php?username=claude&password=***&action=get_live_categories`

Returns an array of `{ category_id: string, category_name: string, parent_id: number }` exactly as assumed in PLAN.md. The target group is:

```json
{ "category_id": "4359", "category_name": "🎵 SiriusXM", "parent_id": 0 }
```

Category names include emoji — no special handling needed beyond normal UTF-8 string display.

## get_live_streams

`GET /player_api.php?username=claude&password=***&action=get_live_streams&category_id=4359`

Returns 85 channel objects for the SiriusXM group. Confirmed fields (superset of what PLAN.md assumes):

```json
{
  "num": 702,
  "name": "SiriusXM Hits 1",
  "stream_type": "live",
  "stream_id": 1120,
  "stream_icon": "http://10.1.20.202:9191/api/channels/logos/760/cache/",
  "epg_channel_id": "702",
  "added": "1771943815",
  "is_adult": 0,
  "category_id": "4359",
  "category_ids": [4359],
  "custom_sid": null,
  "tv_archive": 0,
  "direct_source": "",
  "tv_archive_duration": 0
}
```

- `num`, `name`, `stream_id`, `stream_icon`, `epg_channel_id` all present and match assumed shapes/types.
- `epg_channel_id` here is just the channel number as a string (e.g. `"702"`), not a separate EPG identifier — not obviously more useful than `num` for matching.
- `stream_icon` is a logo URL with no file extension (dynamic image endpoint) — fine to use directly as an `<img src>`.

## Stream URL format

Tested `http://{base}/live/{user}/{pass}/{stream_id}.ts` and `.m3u8` directly:

- `.ts` returns `HTTP 200`, `Content-Type: video/mp2t`, `Transfer-Encoding: chunked` — raw continuous MPEG-TS binary, as expected.
- `.m3u8` **also** returns `Content-Type: video/mp2t` and raw TS binary (not an HLS playlist) — this backend appears to ignore the requested extension and always serves MPEG-TS. Requesting `.m3u8` is not harmful (still returns playable TS data) but doesn't get you HLS.
- Occasional `HTTP 000` / connection timeout on the first request to a given `stream_id` — reproduced on 1 of 3–4 attempts across different channels. Consistent with the upstream channel needing a moment to spin up before the stream backend proxies it; retrying resolves it. This is a live-stream connection-timing quirk, not a format problem — worth a one-retry-with-backoff on initial `loadfile`/connect rather than surfacing as a hard error immediately.

**Decision:** default the stream extension setting to `.ts` (matches PLAN.md's default) and treat it as reliable for this backend. Per-channel auto-detection (try `.ts`, fall back to `.m3u8`) is lower priority than originally scoped, since `.m3u8` doesn't behave differently here — but keep the Settings field and the try/fallback logic anyway since the plan explicitly calls out this can vary per-provider and we shouldn't hardcode assumptions from one backend.

## StellarTunerLog `/nowplaying`

**Update:** confirmed directly with the API operator that `/nowplaying` and `/channels` require no API key at all — only `/history` (per-channel play history) checks the `X-API-Key` header. The app polls `/nowplaying` unconditionally regardless of whether a key is configured; the key is only needed to populate the "recently played" panel in `ChannelModal`.
