# App icons

`icon.svg` is the real, production-ready icon (vector, used by the manifest and the browser tab).

`icon-192.png` / `icon-512.png` are referenced by the manifest for Android install prompts.
Generate them once from the SVG — any of these works:

```bash
npx sharp-cli -i public/icons/icon.svg -o public/icons/icon-192.png resize 192 192
npx sharp-cli -i public/icons/icon.svg -o public/icons/icon-512.png resize 512 512
```

Or open `icon.svg` in any design tool and export at 192px and 512px.
Until then the SVG icon is used everywhere and the app still installs on iOS and desktop.
