# Changes in 0.10.0 (unreleased)

- Add an API for an input filter plugin.

# Changes in 0.9.1 (Nov 2014)

Release focus: integrating the improvements made by Pit of Discworld into the
most recent DecafMUD source, in MUD-agnostic way.

## For players

- You can bind keys, depending on what your MUD owner configured.
- The UI now sports Discworld's menus instead of a simple toolbar.
- Better browser support (Chrome 16+, Firefox 11+, IE 10+).
- You can clear the input field at once with shift+backspace.

## For MUD owners

- You can customize the menus provided by overwriting the `toolbar_menus`
  global variable (see decafmud.interface.panels.menu.js for the format).
- You can customize the keybindings by defining a `tryExtraMacro(decaf,
  keycode)` global function, returning true if that keycode was handled.
- You can disable the hint about using the alternate websocket or flash version
  by setting the `connect_hint` option to false.
- I have little interest into maintaining the Flash version: Websockets are a
  superior solution with good support in modern browsers, without the
  single-vendor FUD.

