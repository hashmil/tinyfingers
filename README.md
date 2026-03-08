# Tiny Fingers

Tiny Fingers is a simple toddler-friendly typing toy built with plain HTML, CSS, and JavaScript. It starts on a playful intro screen, can enter full screen, and turns key presses into big animated characters across a colorful background.

## Run locally

From the project directory, start any static file server. One simple option is:

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000` in a modern desktop browser.

## Full screen behavior

- `Start Full Screen` attempts to enter browser full screen, but the page still starts if the browser refuses.
- `Start Here` begins in windowed mode.
- After the app starts, the corner button toggles full screen on and off.
- Pressing `Escape` exits full screen through normal browser behavior.

## Key handling

- Letters `A-Z` and digits `0-9` appear exactly as typed.
- Shifted letters keep their case.
- Space and other printable symbols such as `!`, `?`, `@`, or `#` show a random emoji instead of the literal symbol.
- Modifier and navigation keys such as `Shift`, `Control`, `Alt`, `Meta`, `Tab`, and the arrow keys are ignored.

## Debug hooks

The page exposes two globals for automated checks:

- `window.render_game_to_text()` returns a JSON summary of the current state.
- `window.advanceTime(ms)` advances sprite lifetimes without waiting for real time.
