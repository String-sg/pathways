# Fonts

`SpaceGrotesk-latin.woff2` is Space Grotesk (variable, weights 300–700, latin subset), by Florian Karsten, from Google
Fonts. It is under the SIL Open Font Licence 1.1
(https://openfontlicense.org), which allows it to be built into the page. `app/tools/build_app.py` inlines it as a
data: URI, so the page still makes no network request. Characters outside the latin subset (✓ ✗ ☆ ↗) come from the
system font.

Added for the Bright theme. To go back to the system font, remove `--sans` from the Bright group
in `app_tokens.css`; the file can then go too.
