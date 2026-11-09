# Hand-drawn animations

Drop the three animation files here. No code changes are needed: the player finds them by name.

| Clip | When it plays |
| --- | --- |
| `takeoff` | Rocket lifting off (every launch that clears the pad) |
| `explosion` | Rocket blowing up on launch (launch failures only) |
| `orbit_arrival` | Rocket in space, travelling to the planet (cut partway on transit failures) |

## Supported formats (checked in this order)

1. `takeoff.webm` or `takeoff.mp4`: video (best choice; use H.264 MP4 for widest support)
2. `takeoff.gif`, `takeoff.webp` or `takeoff.png` (APNG): animated image, shown for 4 s by default
3. `takeoff.json`: Lottie animation
4. `takeoff/frames.json`: PNG frame sequence, for example:

   ```json
   { "fps": 12, "frames": ["0001.png", "0002.png", "0003.png"] }
   ```

   with the PNGs in `public/animations/takeoff/`.

## Optional manifest

`public/animations/manifest.json` overrides file names or image durations:

```json
{
  "takeoff": { "src": "rocket-launch-final.mp4" },
  "explosion": { "src": "boom.gif", "durationMs": 3000 },
  "orbit_arrival": { "frames": ["orbit/0001.png", "orbit/0002.png"], "fps": 12 }
}
```

Until a file is present, a clearly labelled placeholder plays in its place.
