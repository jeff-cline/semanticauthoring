# Semantic Authoring — browser extension

Saves the page you are reading to your research library, with its DOI when the
page declares one.

## Install (unpacked)

1. Create an access token at
   [semanticauthoring.org/app/tokens](https://semanticauthoring.org/app/tokens)
   with the **write** scope.
2. Open `chrome://extensions`, turn on **Developer mode**.
3. **Load unpacked** → choose this `extension/` folder.
4. Click the icon on any article page, paste your token once, and save.

Works in Chrome, Edge, Brave, and Arc (all Chromium, Manifest V3).

## What it reads

Only what the page already declares about itself — `citation_title`,
`citation_author`, `citation_doi`, `DC.Identifier`, and Open Graph tags. It does
not scrape body text, and **it never invents a DOI**: a page without one is
saved without one.

## Not published to the Web Store

Publishing requires a Chrome Web Store developer account and review. The
unpacked install above works today and is the honest state of it.

## Icon

Add a 128×128 `icon.png` — the app icon at `/icon.svg` rendered to PNG works.
