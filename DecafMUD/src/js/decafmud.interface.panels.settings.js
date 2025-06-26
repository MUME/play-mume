/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 *
 * This is decafmud.interface.discworld.js from Discworld, but it is generic
 * and can be included in the upstream.
 */

/**
 * This file has functionality to change DecafMud settings.
 */

var fontpercentage = 100;
var fkeymacros = true;
var numpadwalking = true;

var showprogressbars = false;
var showmap = false;

function set_fontsize(k) {
  fontpercentage = k;
  DecafMUD.instances[0].ui.el_display.style.fontSize = (k*110/100) + "%";
}

function get_fontsize() {
  return fontpercentage;
}

function fkeys_enabled() {
  return fkeymacros;
}

function toggle_fkeys(value) {
  fkeymacros = value;
}

function numpad_enabled() {
  return numpadwalking;
}

function toggle_numpad(value) {
  numpadwalking = value;
}

function progress_visible() {
  return showprogressbars;
}

function map_visible() {
  return showmap;
}

function toggle_progressbars(value) {
  showprogressbars = value;
  if (value) {
    DecafMUD.instances[0].ui.showSidebar();
    DecafMUD.instances[0].ui.showProgressBars();
  }
  else {
    DecafMUD.instances[0].ui.hideProgressBars();
    if (!showmap) DecafMUD.instances[0].ui.hideSidebar();
  }
}

function toggle_map(value) {
  showmap = value;
  if (value) DecafMUD.instances[0].ui.showMap();
  else DecafMUD.instances[0].ui.hideMap();
  if (!showmap && !showprogressbars) DecafMUD.instances[0].ui.hideSidebar();
  else DecafMUD.instances[0].ui.showSidebar();
}

