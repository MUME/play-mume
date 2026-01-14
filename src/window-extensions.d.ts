/*  Play MUME!, a modern web client for MUME using DecafMUD.
    Copyright (C) 2017, Waba.

    This program is free software; you can redistribute it and/or modify
    it under the terms of the GNU General Public License as published by
    the Free Software Foundation; either version 2 of the License, or
    (at your option) any later version.

    This program is distributed in the hope that it will be useful,
    but WITHOUT ANY WARRANTY; without even the implied warranty of
    MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
    GNU General Public License for more details.

    You should have received a copy of the GNU General Public License along
    with this program; if not, write to the Free Software Foundation, Inc.,
    51 Franklin Street, Fifth Floor, Boston, MA 02110-1301 USA. */

// src/window-extensions.d.ts

declare global {
  interface MenuItemArray extends Array<string> {
  }

  interface ToolbarSubmenu {
    [miSubmenu: string]: MenuItemArray;
  }

  interface ToolbarMenus {
    [menuHelpOrOptions: string]: ToolbarSubmenu;
  }

  interface Window {
    toolbar_menus: ToolbarMenus;
    Zlib?: {
      InflateStream?: any;
    };
    DecafMUD?: DecafMUDStatic;
    open_mume_map_window?: () => void;
    mume_menu_new?: () => void;
    mume_menu_help?: () => void;
    mume_menu_rules?: () => void;
    mume_menu_about_map?: () => void;
    mume_menu_map_bug?: () => void;
    tryExtraMacro?: (decaf: DecafMUDInstance, keycode: number) => number;
  }

}

export {};
