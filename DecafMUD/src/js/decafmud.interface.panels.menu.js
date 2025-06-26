/*!
 * DecafMUD v0.9.0
 * http://decafmud.stendec.me
 *
 * Copyright 2010, Stendec <stendec365@gmail.com>
 * Licensed under the MIT license.
 *
 * This is disc.menu.js from Discworld, but after stripping it down it is now
 * generic and can be included in the upstream.
 */

/**
 * To add a new menu or menu item, just add it in the following variable.
 * The format is: [name of the menu item, css id, tool tip, list of
 * submenu items, each followed by the function to be executed as a
 * string.
 */

var toolbar_menus = [
  [ 'File', 'menu_file', 'Used for (re-)connecting.',
    ['Reconnect', 'menu_reconnect();']
  ],
  [ 'Log', 'menu_log', 'Create a log file for this session.',
    ['HTML log', 'menu_log(\'html\');',
     'Plain Text Log', 'menu_log(\'plain\');']
  ],
  [ 'Options', 'menu_options', 'Change DecafMud Options',
    [/*'Fullscreen', 'DecafMUD.instances[0].ui.click_fsbutton()',*/
     'Font (Size)', 'menu_font_size();',
     'Macros', 'menu_macros();',
     'Flush History', 'menu_history_flush();']
  ],
  [ 'Help', 'menu_help', 'Info about DecafMUD and its usage.',
    ['Client Features', 'menu_features();',
     'About', 'menu_about();' ]
  ]
];

var MENU_FILE    = 0,
    MENU_LOG     = 1,
    MENU_OPTIONS = 2,
    MENU_HELP    = 3,
    MI_SUBMENU = 3;

/**
 * =======================================
 * Functionality for generating the menus.
 * =======================================
 */
function build_menu(id) {
  var ret = toolbar_menus[id][0] + "<ul id=\"sub" +
            toolbar_menus[id][1] + "\" class=\"submenu\">";
  for (j = 0; j < toolbar_menus[id][3].length; j+=2) {
    ret += "<li><a href=\"javascript:" + toolbar_menus[id][3][j+1] +
           "\">" + toolbar_menus[id][3][j] + "</a></li>";
  }
  ret += "</ul>";
  return ret;
}

/**
 * This function tells decafmud.interface.discworld.js which menus it
 * should put on the screen.
 */
function get_menus() {
  var ret = new Array();
  for (i = 0; i < toolbar_menus.length; i++) {
    ret.push(toolbar_menus[i][1]);
    ret.push(build_menu(i));
    ret.push(toolbar_menus[i][2]);
  }
  return ret;
}

/**
 * ================================================
 * Functionality for opening and closing the menus.
 * ================================================
 */
var open_menu = -1;

function close_menus() {
  for (i = 0; i < toolbar_menus.length; i++) {
    menuname = "sub" + toolbar_menus[i][1];
    document.getElementById(menuname).style.visibility = 'hidden';
  }
  open_menu = -1;
  DecafMUD.instances[0].ui.input.focus();
}

function toggle_menu(index) {
  menuid = "sub" + toolbar_menus[index][1];
  if (open_menu == index) {
    document.getElementById(menuid).style.visibility = 'hidden';
    open_menu = -1;
    DecafMUD.instances[0].ui.input.focus();
  }
  else {
    close_menus();
    document.getElementById(menuid).style.visibility = 'visible';
    open_menu = index;
  }
}

/**
 * ===============================================
 * Functionality to open and close a popup window.
 * ===============================================
 */
var popup;
var popupheader;
var headerdrag;

function show_popup() {
  // if we already have a popup, clear it
  if (popup != null) {
    while (popup.children.length > 0) { 
      popup.removeChild(popup.children.item(1));
    }    
  }

  // otherwise create it
  popup = document.createElement("div");

  // get data about the screen size
  var w = DecafMUD.instances[0].ui.maxPopupWidth();
  var h = DecafMUD.instances[0].ui.maxPopupHeight();
  var t = DecafMUD.instances[0].ui.verticalPopupOffset();
  var l = DecafMUD.instances[0].ui.horizontalPopupOffset();

  l += w * 2 / 10;
  w = w * 6 / 10;
  h = h * 7 / 10;

  popup.style.width = w + "px";
  popup.style.height = h + "px";
  popup.style.top = t + "px";
  popup.style.left = l + "px";
  popup.className = 'decafmud window';
  popup.id = "popup";
  DecafMUD.instances[0].ui.container.insertBefore(popup, DecafMUD.instances[0].ui.el_display);

  // create the draggable header
  popupheader = document.createElement("div");
  popupheader.style.width = w + "px";
  popupheader.style.height = "25px";
  popupheader.style.top = "0px";
  popupheader.className = 'decafmud window-header';
  popupheader.id = "popupheader";
  popup.appendChild(popupheader);
  headerdrag = new dragObject("popup", "popupheader");

  // create a close button
  var x = document.createElement('button');
  x.innerHTML = '<big>X</big>';
  x.className = 'closebutton';
  x.onclick = function() { close_popup(); };
  popup.appendChild(x);

  return popup;
}

function close_popup() {
  headerdrag.StopListening(true);
  popup.parentNode.removeChild(popup);
  popup = undefined;
  popupheader = undefined;
}

function add_element(inside, kind, innerhtml) {
  var el = document.createElement(kind);
  el.innerHTML = innerhtml;
  inside.appendChild(el);
  return el;
}

function button_line(par) {
  var buttonline = document.createElement("p");
  buttonline.style.textAlign = "center";
  par.appendChild(buttonline);
  return buttonline;
}

function add_close_button(parentob) {
  var closebtn = document.createElement('a');
  closebtn.className = "fakebutton";
  closebtn.href = 'javascript:close_popup();';
  closebtn.innerHTML = '<big>Close</big>';
  parentob.appendChild(closebtn);
}

function popup_header(text) {
  var p = document.createElement("p");
  p.innerHTML = text;
  p.style.marginLeft = "5px";
  p.style.marginRight = "5px";
  p.style.marginBottom = "0px";
  p.style.fontSize = "150%";
  p.className = "headertext";
  popup.appendChild(p);
}

function popup_textarea(name, adjust) {
  var w = DecafMUD.instances[0].ui.maxPopupWidth() * 6 / 10 - 15;
  var h = DecafMUD.instances[0].ui.maxPopupHeight() * 7 / 10 - 100 - adjust;
  var textarea = document.createElement("textarea");
  textarea.id = name;
  textarea.cols = 80;
  textarea.rows = 20;
  textarea.style.width = w + "px";
  textarea.style.height = h + "px";
  textarea.style.margin = "5px";
  popup.appendChild(textarea);
  return textarea;
}

function popup_textdiv() {
  var w = DecafMUD.instances[0].ui.maxPopupWidth() * 6 / 10 - 10;
  var h = DecafMUD.instances[0].ui.maxPopupHeight() * 7 / 10 - 60;
  var div = document.createElement("div");
  div.style.width = w + "px";
  div.style.height = h + "px";
  div.style.margin = "5px";
  div.style.overflowY = "auto";
  popup.appendChild(div);
  return div;
}

/**
 * ============================================
 * Functionality for the individual menu items.
 * ============================================
 */

function menu_reconnect() {
  DecafMUD.instances[0].reconnect();
}

function menu_log(style) {
  var popup = show_popup();
  var textarea = popup_textarea("editor", 70);

  // get the log file
  var txt = DecafMUD.instances[0].ui.display.display.innerHTML;
  if (style == "plain") {
    txt = txt.replace(/\n/g, ' ');
    txt = txt.replace(/<br>/g, '\n');
    txt = txt.replace(/<.*?>/g, '');
    txt = txt.replace(/&nbsp;/g, ' ');
    txt = txt.replace(/\&lt;/g, '<');
    txt = txt.replace(/\&gt;/g, '>');
  }
  else {
    var currentTime = new Date();
    txt = "<html><head><title>DecafMUD " + currentTime.getDate() +
      "/" + currentTime.getMonth() + "/" + currentTime.getFullYear()+
      "</title>\n<link rel=\"stylesheet\" href=\"mud-colors.css\" "+
      "type=\"text/css\" />\n</head><body>\n" + txt +
      "</body></html>";
  }
  textarea.value = txt;
  
  // add an explanation
  add_element(popup, "p", "To log, copy the text from this area to "+
    "a text file (on most systems you can copy by clicking in the " +
    "field, then ctrl+a, ctrl+c).");
  if (style == "html") add_element(popup, "p", "The css-file used "+
    "for the colours can be downloaded <a href=\"mud-colors.css\">"+
    "here</a>.");

  // and end with a closing button
  var btns = button_line(popup);
  add_close_button(btns);
}

function menu_font_size() {
  var pop = popup_textdiv(show_popup());
  add_element(pop, "h2", "Change fonts.");
  var frm = document.createElement("form");
  frm.name = "formfonts";
  pop.appendChild(frm);
  add_element(frm, "p", "Font Size: "+
    "<input name=\"txtfontsize\" type=\"text\" size=5 value=\"" +
    get_fontsize() + "\">");
  add_element(frm, "p", "(Select a value between 50 and 500 - the "+
    "default size is 100.)");
  add_element(frm, "p", "Font Family: "+
    "<input name=\"txtfontfamily\" type=\"text\" size=20 value=\"\">");
  add_element(frm, "p", "(Select a font that is supported by your "+
    "browser, or leave empty for the current font.)");
  var savebtn = document.createElement("a");
  savebtn.className = "fakebutton";
  savebtn.href = "javascript:change_font();";
  savebtn.innerHTML = "<big>Save</big>";
  frm.appendChild(savebtn);
  add_element(frm, "span", "&nbsp;&nbsp;&nbsp;");
  var closebtn = document.createElement("a");
  closebtn.className = "fakebutton";
  closebtn.href = "javascript:close_popup();";
  closebtn.innerHTML = "<big>Cancel</big>";
  frm.appendChild(closebtn);
}

function change_font() {
  var k = parseInt(document.formfonts.txtfontsize.value);
  if (k < 50 || k > 500) {
    alert("Please select a size between 50 and 500.");
    return;
  }

  set_fontsize(k);
  var s = document.formfonts.txtfontfamily.value;
  if (s != "")
    DecafMUD.instances[0].ui.el_display.style.fontFamily = "'" + s + "', Consolas, "+
          "Courier, 'Courier New', 'Andale Mono', Monaco, monospace";
  close_popup();
  DecafMUD.instances[0].ui.display.scroll();
  DecafMUD.instances[0].ui.input.focus();
}

function menu_macros() {
  var pop = popup_textdiv(show_popup());

  add_element(pop, "p", "Decafmud supports both F-key macro's "+
    "(you need to use the mud's alias system to use them, for "+
    "example <tt>alias f1 score</tt>), and numpad navigation (you "+
    "need to turn numlock on for this to work).");
  var frm = document.createElement("form");
  frm.name = "formmacros";
  pop.appendChild(frm);
  add_element(frm, "p", "<input type=\"checkbox\" name=\"cfkey\" " +
    (fkeymacros ? "checked" : "") + "/>Enable f-key macros.");
  add_element(frm, "p", "<input type=\"checkbox\" name=\"cnumpad\" "+
    (numpadwalking ? "checked" : "") + "/>Enable numpad navigation.");
  var savebtn = document.createElement("a");
  savebtn.className = "fakebutton";
  savebtn.href = "javascript:change_macros();";
  savebtn.innerHTML = "<big>Save</big>";
  frm.appendChild(savebtn);
  add_element(frm, "span", "&nbsp;&nbsp;&nbsp;");
  var closebtn = document.createElement("a");
  closebtn.className = "fakebutton";
  closebtn.href = "javascript:close_popup();";
  closebtn.innerHTML = "<big>Cancel</big>";
  frm.appendChild(closebtn);
}

function menu_history_flush() {
  DecafMUD.instances[0].ui.display.clear();
}

function change_macros() {
  var fkey = document.formmacros.cfkey.checked;
  var nump = document.formmacros.cnumpad.checked;
  toggle_fkeys(fkey);
  toggle_numpad(nump);
  close_popup();
}

function menu_progressbars() {
  if (progress_visible()) toggle_progressbars(false);
  else toggle_progressbars(true);
}

function menu_map() {
  if (showmap) {
    toggle_map(false);
    alert("Warning: the map will automatically reappear when the "+
      "mud sends it.  To stop the side-map, change your settings "+
      "in options output map.");
    var p = document.getElementById("submenu_options");
    var c = document.getElementById("submenu_options_map");
    p.removeChild(c);
  }
}

function menu_features() {
  // create the popup
  var pop = popup_textdiv(show_popup());
  // show the necessary help
  var el;
  add_element(pop, "h2", "Client Features");
  add_element(pop, "p", "Decafmud is a basic mud client, "+
    "with just a few features.");
  el = document.createElement("ul");
  pop.appendChild(el);
  add_element(el, "li", "To send multiple commands at once, separate "+
    "them by putting ;; in between.<br>For example: "+
    "<tt>look;;score</tt>");
  add_element(el, "li", "You can browse your previous commands with "+
    "the up and down arrow keys.");
  add_element(el, "li", "The F1, F2, ... keys send the commands f1, "+
    "f2, ... to the mud.  You can use the MUD's alias system to "+
    "attach commands to this, for example \"alias f1 score\".  Use "+
    "\"help alias\" when logged in to the mud for more information.");
  add_element(el, "li", "You can use the numpad for quick "+
    "navigation.  Make sure you have the numlock key on for it to "+
    "work.");
  add_element(el, "li", "You can clear the input field immediately "+
    "using shift+backspace (useful for MUDs where you send a blank "+
    "line to interrupt the current action).");
  add_element(el, "li", "To create a log file from your current "+
    "session, use the Log menu.  Unfortunately it is not possible "+
    "(due to browers' security restrictions) to automatically save "+
    "a file to your computer, so you will have to copy it to a text "+
    "editor yourself.");
  // add end with a closing button
  add_close_button(button_line(pop));
}

function menu_about() {
  DecafMUD.instances[0].about();
}

/**
 * ===========================================
 * Functionality for the troubleshooting menu.
 * ===========================================
 */

function menu_trouble() {
  window.open("help.html", "Troubleshooting", "width=800,height=400,resizable=yes,scrollbar=yes,toolbar=yes,menubar=no,location=no,directories=no,status=no");
}

