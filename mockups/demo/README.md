# PM interview walkthrough demo

## Deliverable (use this in interviews)

**[`ai-policy-foundry-pm-walkthrough.mp4`](./ai-policy-foundry-pm-walkthrough.mp4)**

Subtitles are **hard-burned into the video frames** (not a separate subtitle track / not an SRT sidecar).  
Play the MP4 in any player — captions appear on screen with no caption settings required.

| Attribute | Value |
|---|---|
| Duration | ~7:01 |
| Audio | None (silent) |
| Subtitles | Burned into picture |
| Surface | Dark workflow mockup |
| Resolution | 1440×900 |

## Re-generate (optional)

Caption text lives inside `record-pm-walkthrough.mjs` (`CUES`). No SRT file is used.

```bash
cd <repo-root>
node mockups/demo/record-pm-walkthrough.mjs
ffmpeg -y -i mockups/demo/walkthrough-raw.webm -an \
  -c:v libx264 -preset medium -crf 20 -pix_fmt yuv420p -movflags +faststart \
  mockups/demo/ai-policy-foundry-pm-walkthrough.mp4
```
