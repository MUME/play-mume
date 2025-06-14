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

// src/decafmud.d.ts

interface DecafMUDInstance {
  textInputFilter?: any;
  socket: DecafMUDSocket;
  sendInput: (command: string) => void;
}

interface DecafMUDStatic {
  new (options: any): DecafMUDInstance;
  plugins?: {
    TextInputFilter?: any;
  };
  instances?: DecafMUDInstance[];
}

declare var DecafMUD: DecafMUDStatic;

declare interface DecafMUDSocket {
  write(data: string): void;
}

declare const MENU_HELP: number;
declare const MI_SUBMENU: number;
declare const MENU_OPTIONS: number;

declare function fkeys_enabled(): boolean;
declare function numpad_enabled(): boolean;
