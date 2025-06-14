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

import $ from 'jquery';
import { MumeMap, MumeXmlParser, RoomCoords, MumeXmlParserTag } from './mume.mapper';
import { throttle } from './utils';

(function () {
  "use strict";

  let tagEventHandler: ((_event: unknown, tag: MumeXmlParserTag) => void) | undefined;

  $(window).on("load", function (_e: JQuery.Event) {
    MumeMap.load("mume-map").done(function (map: MumeMap) {
      let parser: MumeXmlParser | undefined;
      let matches: RegExpExecArray | null;

      const opener = window.opener as Window; // Cast once

      if (opener && opener.DecafMUD && opener.DecafMUD.instances && opener.DecafMUD.instances[0]) {
        const decafInstance = opener.DecafMUD.instances[0];
        if (decafInstance) {
            parser = decafInstance.textInputFilter as MumeXmlParser;
        }


        if (!parser || typeof parser.filterInputText !== 'function') {
          console.error("Bug: expected to find a MumeXmlParser instance in opener window or textInputFilter is invalid.");
          parser = undefined;
        }

        if (parser) {
          tagEventHandler = map.processTag.bind(map);
          $(parser).on(MumeXmlParser.SIG_TAG_END, tagEventHandler);
          console.log("The main window will now send data to the map window");
        } else {
            console.log("MumeXmlParser not found or invalid on opener, map events not bound.");
        }

        if ((matches = /^#(\d+),(\d+),(\d+)$/.exec(location.hash))) {
          map.onMovement(null, new RoomCoords(+matches[1], +matches[2], +matches[3]));
        }

        if (map.display && typeof map.display.fitParent === 'function') {
          map.display.fitParent();
          $(window).on("resize", throttle(map.display.fitParent.bind(map.display), 500));
        } else {
          console.error("map.display or map.display.fitParent is not available.");
        }
      } else {
        console.error("DecafMUD instance not found in opener window. Map cannot be initialized fully.");
        $('#mume-map').html('<p>Error: Could not connect to the main MUME window. Please ensure the main window is open and DecafMUD is running.</p>');
      }
    }).fail(function(error: unknown) {
      console.error("Failed to load MumeMap for map.html:", error);
      $('#mume-map').html('<p>Error: Failed to load map components.</p>');
    });
  });

  $(window).on("unload", function (_e: JQuery.Event) {
    const opener = window.opener as Window;
    if (opener && opener.DecafMUD && opener.DecafMUD.instances && opener.DecafMUD.instances[0]) {
      const decafInstance = opener.DecafMUD.instances[0];
      if (decafInstance) {
        const parser = decafInstance.textInputFilter;
        if (tagEventHandler && parser) {
          $(parser).off(MumeXmlParser.SIG_TAG_END, tagEventHandler);
        }
      }
    }
  });
})();

export {};
