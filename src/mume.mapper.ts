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
import * as PIXI from 'pixi.js';
import SparkMD5 from 'spark-md5';

const ROOM_PIXELS = 48;
const MAP_DATA_PATH = "mapdata/v1/";
enum Dir { // Must match MM2's defs.
    NORTH = 0,
    SOUTH = 1,
    EAST = 2,
    WEST = 3,
    LAST_GROUND_DIR = WEST,
    UP = 4,
    DOWN = 5,
    NONE = 6,
    UNKNOWN = 7,
}

/* Like JQuery.when(), but the master Promise is resolved only when all
 * promises are resolved or rejected, not at the first rejection. */
const whenAll = function<T>( deferreds: JQueryPromise<T>[] )
{
    const master: JQueryDeferred<T> = $.Deferred();

    if ( deferreds.length === 0 )
        return master.resolve();

    const pending = new Set<JQueryPromise<T>>();
    for ( const dfr of deferreds )
        pending.add( dfr );

    for ( const dfr of deferreds )
    {
        dfr.always( () =>
        {
            pending.delete( dfr );
            if ( pending.size === 0 )
                master.resolve();
        } );
    }

    return master;
}

// Adapted from MMapper2: the result must be identical for the hashes to match
const translitUnicodeToAsciiLikeMMapper = function( unicode: string ): string
{
    const table = [
        /*192*/ 'A', 'A', 'A', 'A', 'A', 'A', 'A', 'C', 'E', 'E', 'E', 'E', 'I', 'I', 'I', 'I',
        /*208*/ 'D', 'N', 'O', 'O', 'O', 'O', 'O', 'x', 'O', 'U', 'U', 'U', 'U', 'Y', 'b', 'B',
        /*224*/ 'a', 'a', 'a', 'a', 'a', 'a', 'a', 'c', 'e', 'e', 'e', 'e', 'i', 'i', 'i', 'i',
        /*248*/ 'o', 'n', 'o', 'o', 'o', 'o', 'o', ':', 'o', 'u', 'u', 'u', 'u', 'y', 'b', 'y', ];

    let ascii = "";
    for ( const charString of unicode )
    {
        const ch = charString.charCodeAt( 0 );
        if (ch > 128)
        {
          if (ch < 192)
            ascii += "z"; // sic
          else
            ascii += table[ ch - 192 ];
        }
        else
        {
            ascii += charString;
        }
    }

    return ascii;
}


/* This is the "entry point" to this library for the rest of the code. */
export class MumeMap
{
    public mapData: MumeMapData | null = null;
    public mapIndex: MumeMapIndex | null = null;
    public display: MumeMapDisplay;
    public pathMachine: MumePathMachine;
    public processTag: ( _event: unknown, tag: MumeXmlParserTag ) => void;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    public static debugInstance: MumeMap;

    constructor( mapData: MumeMapData, display: MumeMapDisplay )
    {
        this.mapData = mapData;
        this.display = display;
        this.mapIndex = new MumeMapIndex();
        this.pathMachine = new MumePathMachine( this.mapData, this.mapIndex );
        this.processTag =
            ( _event: unknown, tag: MumeXmlParserTag ) => this.pathMachine.processTag( _event, tag );

        MumeMap.debugInstance = this;
    }

    public static load( containerElementName: string ): JQueryPromise<MumeMap>
    {
        const result = $.Deferred<MumeMap>();

        MumeMapData.load().done( ( mapData: MumeMapData ) =>
        {
            MumeMapDisplay.load( containerElementName, mapData )
                .then( ( display: MumeMapDisplay ) => {
                    const map = new MumeMap( mapData, display );

                    // eslint-disable-next-line @typescript-eslint/no-explicit-any
                    $( map.pathMachine ).on(
                        MumePathMachine.SIG_MOVEMENT,
                        ( _event: unknown, where: RoomCoords ) => map.onMovement( _event, where ) );

                    result.resolve( map );
                } )
                .catch( (error: unknown) => {
                    console.error("Failed to load MumeMapDisplay:", error);
                    result.reject(error);
                });
        } );

        return result;
    }

    public onMovement( _event: unknown, where: RoomCoords ): void
    {
        this.display.repositionTo( where );
    }
}



/* Analogy to MMapper2's path machine, although ours is a currently just a
 * naive room+desc exact search with no "path" to speak of.
 */
class MumePathMachine
{
    public static readonly SIG_MOVEMENT = "movement";

    public mapData: MumeMapData;
    public mapIndex: MumeMapIndex;
    public roomName: string | null;
    public here: RoomCoords | null;

    constructor( mapData: MumeMapData, mapIndex: MumeMapIndex )
    {
        this.mapData = mapData;
        this.mapIndex = mapIndex;
        this.roomName = null;
        this.here = null;
    }

    /* This receives an event from MumeXmlParser when it encounters a closing tag.
     * */
    public processTag( _event: unknown, tag: MumeXmlParserTag ): void
    {
        console.log( "MumePathMachine processes tag " + tag.name );
        if ( tag.name === "name" )
            this.roomName = tag.text;
        else if ( tag.name === "description" )
        {
            if ( this.roomName )
            {
                this.enterRoom( this.roomName, tag.text );
                this.roomName = null;
            }
            else
            {
                throw new Error("Bug: the MumePathMachine got a room description but no room name: " +
                    tag.text.substr( 0, 50 ) + "...");
            }
        }
        else if ( tag.name === "room" )
        {
            this.roomName = null;
        }
    }

    /* Internal function called when we got a complete room. */
    private enterRoom( name: string, desc: string ): void
    {
        this.mapIndex.findPosByNameDesc( name, desc )
            .done( ( coordinates: RoomCoords[] ) =>
            {
                this.here = coordinates[0];
                $(this).triggerHandler( MumePathMachine.SIG_MOVEMENT, [ coordinates[0] ] );
            } );
    }
}



/* Queries and caches the server-hosted index of rooms.
 * For v1 format, that's a roomname+roomdesc => coords index, 2.4MB total,
 * split into 10kB JSON chunks.
 */
class MumeMapIndex
{
    // This is a vast simplification of course...
    // eslint-disable-next-line no-control-regex
    private static readonly ANY_ANSI_ESCAPE =  /\x1B\[[^A-Za-z]+[A-Za-z]/g;

    private cache: Map<string, RoomCoords[]>;
    private cachedChunks: Set<string>;

    constructor()
    {
        this.cache = new Map<string, RoomCoords[]>();
        this.cachedChunks = new Set<string>();
    }

    /* Normalize into text that should match what MMapper used to produce the
     * name+desc hashes.
     */
    public static normalizeString( input: string )
    {
        // MMapper indexed the plain text without any escape, obviously.
        const text = input.replace( MumeMapIndex.ANY_ANSI_ESCAPE, '' );

        // MMapper applies these conversions to ensure the hashes in the index
        // are resilient to trivial changes.
        return translitUnicodeToAsciiLikeMMapper( text );
    }

    /* Returns a hash of the name+desc that identifies the chunk of the name+desc
     * index we want from the server. This algorithm must be identical to what
     * MMapper uses for this version of the webmap format.
     */
    public static hashNameDesc( name: string, desc: string )
    {
        const normName = MumeMapIndex.normalizeString( name );
        const normDesc = MumeMapIndex.normalizeString( desc.replace(/\s+/g, " ") );
        const namedesc = normName + "\n" + normDesc;

        const hash = SparkMD5.hash( namedesc );
        return hash;
    }

    private updateCache( json: IndexChunk )
    {
        let hash;
		const oldSize = this.cache.size;
        let invalid = 0;

        for ( hash in json )
        {
            if ( Object.prototype.hasOwnProperty.call(json, hash) )
            {
                const rawCoordsArray: number[][] = json[ hash ];
                if ( !Array.isArray( rawCoordsArray ) )
                {
                    ++invalid;
                    continue;
                }

                let coordsArray: RoomCoords[] | null = [];
                for ( const rawCoords of rawCoordsArray )
                {
                    if ( !Array.isArray( rawCoords ) || rawCoords.length !== 3 )
                    {
                        coordsArray = null;
                        break;
                    }
                    else
                        coordsArray.push( new RoomCoords( rawCoords[0], rawCoords[1], rawCoords[2] ) );
                }

                if ( coordsArray === null )
                    ++invalid;
                else
                    this.cache.set( hash, coordsArray );
            }
        }

        const sizeIncrease = this.cache.size - oldSize;
        const jsonSize = Object.keys( json ).length;

        console.log( "MumeMapIndex: cached %d new entries (%d total), ignored %d invalid",
            sizeIncrease, this.cache.size, jsonSize, invalid );

        if ( sizeIncrease !== jsonSize )
            console.error( "MumeMapIndex: stray index entries in %O?", json );
    }

    // Private helper for findPosByNameDesc().
    private findPosByNameDescCached( name: string, desc: string,
        result: JQueryDeferred<RoomCoords[]>, hash: string ): JQueryDeferred<RoomCoords[]>
    {
        const coordinates = this.cache.get( hash );
        const roomInfo = { name, desc, hash, };
        if ( coordinates === undefined )
        {
            console.log( "MumeMapIndex: unknown room %s (%O)", name, roomInfo );
            result.reject();
        }
        else
        {
            console.log( "MumeMapIndex: found %s (%O) in %O", name, roomInfo, coordinates );
            result.resolve( coordinates );
        }

        return result;
    }

    /* This may be asynchronous if the index chunk has not been downloaded yet, so
     * the result is a jQuery Deferred.
     */
    public findPosByNameDesc( name: string, desc: string ): JQueryDeferred<RoomCoords[]>
    {
        const hash = MumeMapIndex.hashNameDesc( name, desc );
        const result = $.Deferred<RoomCoords[]>();

        // Shortcut if we already have that index chunk in cache
        const chunk = hash.substr( 0, 2 );
        if ( this.cachedChunks.has( chunk ) )
            return this.findPosByNameDescCached( name, desc, result, hash );

        console.log( "Downloading map index chunk " + chunk );
        const url = MAP_DATA_PATH + "roomindex/" + chunk + ".json";
        $.getJSON( url )
            .done( ( json: IndexChunk ) =>
            {
                this.cachedChunks.add( chunk );
                this.updateCache( json );
                this.findPosByNameDescCached( name, desc, result, hash );
            } )
            .fail( function( jqxhr: JQuery.jqXHR, textStatus: string, error: string ) // Added types for fail params
            {
                console.error( "Loading map index chunk %s failed: %s, %O", url, textStatus, error );
                result.reject();
            } );

        return result;
    }
}


/* This is a RoomCoords shifted by metaData.minX/Y/Z to fit a zero-based Array. */
class ZeroedRoomCoords
{
    private preventDuckTyping!: never;

    public x: number;
    public y: number;
    public z: number;

    constructor( x: number, y: number, z: number )
    {
        this.x = x;
        this.y = y;
        this.z = z;
    }
}

/* Room coordinates, comprised in metaData.minX .. maxX etc. */
export class RoomCoords
{
    private preventDuckTyping!: never;

    public x: number;
    public y: number;
    public z: number;

    constructor( x: number, y: number, z: number )
    {
        this.x = x;
        this.y = y;
        this.z = z;
    }

    public toString(): string
    {
        return `RoomCoords(${this.x}, ${this.y}, ${this.z})`;
    }
}

/* Stores stuff in a x/y/z-indexed 3D array. The coordinates must be within the
 * minX/maxX/etc bounds of the metaData.
 */
class SpatialIndex<T>
{
    private readonly metaData: MapMetaData;
    private data: T[][][];

    constructor( metaData: MapMetaData )
    {
        this.metaData = metaData;

        // Hopefully, JS' sparse arrays will make this memory-efficient.
        this.data = new Array( this.metaData.maxX - this.metaData.minX );
    }

    /* Private helper to get 0-based coordinates from whatever MM2 provided */
    private getZeroedCoordinates( pos: RoomCoords ): ZeroedRoomCoords
    {
        return new ZeroedRoomCoords(
            pos.x - this.metaData.minX,
            pos.y - this.metaData.minY,
            pos.z - this.metaData.minZ,
        );
    }

    public set( c: RoomCoords, what: T ): void
    {
        const zero = this.getZeroedCoordinates( c );

        if ( this.data[ zero.x ] === undefined )
            this.data[ zero.x ] = new Array( this.metaData.maxY - this.metaData.minY );

        if ( this.data[ zero.x ][ zero.y ] === undefined )
            this.data[ zero.x ][ zero.y ] = [];

        this.data[ zero.x ][ zero.y ][ zero.z ] = what;
    }

    /* Public. */
    public get( c: RoomCoords ): T | null
    {
        const zero = this.getZeroedCoordinates( c );

        if ( this.data[ zero.x ] !== undefined &&
                this.data[ zero.x ][ zero.y ] !== undefined &&
                this.data[ zero.x ][ zero.y ][ zero.z ] !== undefined )
        {
            return this.data[ zero.x ][ zero.y ][ zero.z ];
        }
        else
        {
            return null;
        }
    }
}




// This is what we load from the server.
class MapMetaData
{
    /* The default values are never used and only make sure we can compare the
     * declared vs. downloaded properties at runtime. */
    directions: number[] = [];
    maxX: number = 0;
    maxY: number = 0;
    maxZ: number = 0;
    minX: number = 0;
    minY: number = 0;
    minZ: number = 0;
    roomsCount: number = 0;

    public static assertValid( json: MapMetaData ): void
    {
        const missing = new Array<string>();
        for ( const prop in new MapMetaData() )
            if ( !Object.prototype.hasOwnProperty.call(json, prop) )
                missing.push( prop );

        if ( missing.length !== 0 )
            throw new Error("Missing properties in loaded metadata: " + missing.join( ", " ));
    }
}

type RoomId = number & {
    _roomIdBrand: never; // Prevent implicit conversion with Number
};

type IndexChunk = {[hash: string]: number[][]};

// This is what we load from the server, inside RoomData.
interface RoomExit
{
    name: string;
    dflags: number;
    flags: number;
    in: RoomId[];
    out: RoomId[];
}

class RoomData
{
    name: string = "";
    desc: string = "";
    id: RoomId = 0 as RoomId;
    x: number = 0;
    y: number = 0;
    z: number = 0;
    exits: RoomExit[] = [];
    sector: number = 0;
    loadflags: number = 0;
    mobflags: number = 0;
    // ...
}

class Room
{
    public data: RoomData;

    constructor( data: RoomData )
    {
        this.data = data;
    }

    public coords(): RoomCoords
    {
        return new RoomCoords( this.data.x, this.data.y, this.data.z );
    }
}

/* Stores map data (an array of room structures, exposed as .data) and provides
 * an indexing feature. */
class MumeMapData
{
    /* These zones are currently in-memory. */
    private cachedZones = new Set<string>();
    /* These zones are known not to exist on the server. */
    private nonExistentZones = new Set<string>();
    /* Publicly readable, guaranteed to hold REQUIRED_META_PROPS. */
    public metaData: MapMetaData;
    /* Private in-memory room cache. */
    private rooms: SpatialIndex<Room>;

    // Arda is split into JSON files that wide.
    private static readonly ZONE_SIZE = 20;

    /* Initiates loading the external JSON map data.
     * Returns a JQuery Deferred that can be used to execute further code once done.
     */
    public static load(): JQueryPromise<MumeMapData>
    {
        const result = $.Deferred<MumeMapData>();

        $.getJSON( MAP_DATA_PATH + "arda.json" )
            .done( ( json: MapMetaData ) =>
            {
                try {
                    result.resolve( new MumeMapData( json ) );
                    console.log( "Map metadata loaded" );
                }
                catch ( e )
                {
                    console.error( "Loading metadata failed: %O", e );
                    result.reject();
                }
            } )
            .fail( function( jqxhr, textStatus, error )
            {
                console.error( "Loading metadata failed: %s, %O", textStatus, error );
                result.reject();
            } );

        return result;
    }

    constructor( json: MapMetaData )
    {
        MapMetaData.assertValid( json );
        this.metaData = (json as MapMetaData);
        this.rooms = new SpatialIndex<Room>( json );
    }

    /* Private helper that feeds the in-memory cache. */
    private setCachedRoom( room: Room ): void
    {
        this.rooms.set( room.coords(), room );
    }

    /* Returns a room from the in-memory cache or null if not found. Does not
     * attempt to download the zone if it's missing from the cache.
     */
    public getRoomAtCached( c: RoomCoords ): Room | null
    {
        const room = this.rooms.get( c );

        if ( room != null )
        {
            /*console.log( "MumeMapData found room %s (%d) for coords %d,%d,%d",
                room.name, room.id, x, y, z );*/
            return room;
        }
        else
        {
            /*console.log( "MumeMapData did not find a room for coords %d,%d,%d",
                x, y, z );*/
            return null;
        }
    }

    private getRoomResultAtCached( c: RoomCoords,
        result: JQueryDeferred<Room> ): JQueryDeferred<Room>
    {
        const room = this.getRoomAtCached( c );
        if ( room === null )
            return result.reject();
        else
            return result.resolve( room );
    }

    /* Stores a freshly retrieved JSON zone into the in-memory cache. Returns
     * the rooms added to the cache. */
    private cacheZone( zone: string, json: RoomData[] ): Room[]
    {
        if ( !Array.isArray( json ) )
        {
            console.error( "Expected to find an Array for zone %s, got %O", zone, json );
            return [];
        }

        const cached = new Array<Room>();
        for ( let i = 0; i < json.length; ++i )
        {
            const rdata: RoomData = json[ i ];

            const missing = new Array<string>();
            for ( const prop in new RoomData() )
                if ( !Object.prototype.hasOwnProperty.call(rdata, prop) )
                    missing.push( prop );

            if ( missing.length !== 0 )
            {
                console.error( "Missing properties %O in room #%d of zone %s", missing, i, zone );
                return cached; // but do not mark the zone as cached - we'll retry it
            }

            const room = new Room( rdata );
            this.setCachedRoom( room );
            cached.push( room );
        }

        console.log( "MumeMapData cached %d rooms for zone %s", cached, zone );
        this.cachedZones.add( zone );
        return cached;
    }

    /* Returns the x,y zone for that room's coords, or null if out of the map.
     */
    public getRoomZone( x: number, y: number ): string | null
    {
        if ( x < this.metaData.minX || x > this.metaData.maxX ||
                y < this.metaData.minY || y > this.metaData.maxY )
            return null;

        const zoneX = x - ( x % MumeMapData.ZONE_SIZE );
        const zoneY = y - ( y % MumeMapData.ZONE_SIZE );
        const zone = zoneX + "," + zoneY;

        return zone;
    }

    /* Private. */
    private downloadAndCacheZone( zone: string ): JQueryDeferred<void>
    {
        const result = $.Deferred<void>();

        console.log( "Downloading map zone %s", zone );
        const url = MAP_DATA_PATH + "zone/" + zone + ".json";
        $.getJSON( url )
            .done( (json: RoomData[]) =>
            {
                this.cacheZone( zone, json );
                result.resolve();
            } )
            .fail( function( jqXHR, textStatus, error )
            {
                if ( jqXHR.status === 404 )
                    console.log( "Map zone %s does not exist: %s, %O", url, textStatus, error );
                    // Not an error: zones without data simply don't get output
                else
                    console.error( "Downloading map zone %s failed: %s, %O", url, textStatus, error );
                result.reject();
            } );

        return result;
    }

    /* Fetches a room from the cache or the server. Returns a jQuery Deferred. */
    public getRoomAt( c: RoomCoords ): JQueryDeferred<Room>
    {
        const result = $.Deferred<Room>();

        const zone = this.getRoomZone( c.x, c.y );
        if ( zone === null || this.nonExistentZones.has( zone ) )
            return result.reject();

        if ( this.cachedZones.has( zone ) )
            return this.getRoomResultAtCached( c, result );

        this.downloadAndCacheZone( zone )
            .done( () =>
            {
                this.getRoomResultAtCached( c, result );
            } );

        return result;
    }

    /* Fetches rooms at an Array of x/y/z coords from the cache or the server.
     * Returns arrays of rooms through a jQuery Deferred. Partial results are
     * returned as soon as the rooms are available as notify()cations, and the
     * complete array of rooms is also returned when the Promise is resolved.
     * Rooms that do not exist are not part of the results.
     */
    public getRoomsAt( coordinates: RoomCoords[] ): JQueryPromise<Room[]>
    {
        const result = $.Deferred<Room[]>();
        const downloads: { zone: string, dfr: JQueryXHR }[] = [];
        const downloadDeferreds: JQueryXHR[] = [];
        const roomsNotInCachePerZone = new Map<string, Set<RoomCoords>>();
        const roomsInCache: Room[] = [];
        const roomsDownloaded: Room[] = [];

        // Sort coordinates into rooms in cache and rooms needing a download
        for ( const coords of coordinates )
        {
            const zone = this.getRoomZone( coords.x, coords.y );
            if ( zone === null )
                continue;

            if ( this.nonExistentZones.has( zone ) )
            {
                // Do nothing if the zone doesn't exist on the server
            }
            else if ( !this.cachedZones.has( zone ) )
            {
                let roomsNotInCache = roomsNotInCachePerZone.get( zone );
                if ( roomsNotInCache )
                    roomsNotInCache.add( coords );
                else
                {
                    roomsNotInCache = new Set<RoomCoords>();
                    roomsNotInCache.add( coords );
                    roomsNotInCachePerZone.set( zone, roomsNotInCache );

                    console.log( "Downloading map zone %s for room %d,%d", zone, coords.x, coords.y );
                    const url = MAP_DATA_PATH + "zone/" + zone + ".json";
                    const deferred = $.getJSON( url );
                    downloads.push( { zone, dfr: deferred } );
                    downloadDeferreds.push( deferred );
                }
            }
            else
            {
                const room = this.getRoomAtCached( coords );
                if ( room != null )
                    roomsInCache.push( room );
            }
        }

        // Return cached rooms immediatly through a notify
        result.notify( roomsInCache );

        // Async-download the rest (this is out of first for() for legibility only)
        for ( const download of downloads )
        {
            download.dfr
                .done( ( json: RoomData[] ) =>
                {
                    console.log( "Zone %s downloaded", download.zone );
                    const neededCoords = roomsNotInCachePerZone.get( download.zone );
                    if ( neededCoords == undefined )
                        return console.error( "Bug: inconsistent download list" );

                    const neededCoordsStr = new Set<string>(); // Equivalent Coords are not === equal
                    neededCoords.forEach( ( c ) => neededCoordsStr.add( c.toString() ) );

                    const downloaded = this.cacheZone( download.zone, json );
                    const neededRooms = downloaded
                        .filter( ( r ) => neededCoordsStr.has( r.coords().toString() ) );

                    // Send the batch of freshly downloaded rooms
                    roomsDownloaded.push( ...neededRooms );
                    result.notify( neededRooms );
                } )
                .fail( ( dfr: JQueryXHR, textStatus: string, error: string ) =>
                {
                    if ( dfr.status === 404 )
                    {
                        this.nonExistentZones.add( download.zone );
                        console.log( "Map zone %s does not exist: %s, %O", download.zone, textStatus, error );
                        // Not an error: zones without data simply don't get output
                    }
                    else
                        console.error( "Downloading map zone %s failed: %s, %O", download.zone, textStatus, error );
                } );
        }

        // Return the whole batch when done
        const allRooms = roomsInCache.concat( roomsDownloaded );
        whenAll( downloadDeferreds ).done( () => result.resolve( allRooms ) );

        return result;
    }
}



// Algorithms that build PIXI display elements.
// eslint-disable-next-line @typescript-eslint/no-namespace
namespace Mm2Gfx
{
    enum Sector
    {
        UNDEFINED      =  0,
        INSIDE         =  1,
        CITY           =  2,
        FIELD          =  3,
        FOREST         =  4,
        HILLS          =  5,
        MOUNTAIN       =  6,
        WATER_SHALLOW  =  7,
        WATER          =  8,
        WATER_NOBOAT   =  9,
        UNDERWATER     = 10,
        ROAD           = 11,
        BRUSH          = 12,
        TUNNEL         = 13,
        CAVERN         = 14,
        DEATHTRAP      = 15,
        COUNT          = 16,
    }

    enum ExitFlags
    {
        ROAD = ( 1 << 2 ),
    }

    type RoadKind = "road" | "trail";
    type ExtraKind = "mob" | "load";

    const MOB_FLAGS = 17;
    const LOAD_FLAGS = 24;

    const getSectorAssetPath = function( sector: number ): string
    {
        if ( sector < Sector.UNDEFINED || sector >= Sector.COUNT )
            sector = Sector.UNDEFINED;

        let name: string = "undefined";
        switch (sector) {
            case Sector.UNDEFINED:
                name = "undefined";
                break;
            case Sector.INSIDE:
                name = "indoors";
                break;
            case Sector.CITY:
                name = "city";
                break;
            case Sector.FIELD:
                name = "field";
                break;
            case Sector.FOREST:
                name = "forest";
                break;
            case Sector.HILLS:
                name = "hills";
                break;
            case Sector.MOUNTAIN:
                name = "mountains";
                break;
            case Sector.WATER_SHALLOW:
                name = "shallow";
                break;
            case Sector.WATER:
                name = "water";
                break;
            case Sector.WATER_NOBOAT:
                name = "rapids";
                break;
            case Sector.UNDERWATER:
                name = "underwater";
                break;
            case Sector.ROAD:
                name = "road";
                break;
            case Sector.BRUSH:
                name = "brush";
                break;
            case Sector.TUNNEL:
                name = "tunnel";
                break;
            case Sector.CAVERN:
                name = "cavern";
                break;
            case Sector.DEATHTRAP:
                name = "deathtrap";
                break;
            default:
                console.error("unable to load a texture for sector %d", sector);
        }
        return "resources/pixmaps/terrain-" + name + ".png";
    };

    const getRoadAssetPath = function( dirsf: number, kind: RoadKind ): string
    {
        let name: string = "none";
        switch (dirsf) {
            case 0:
                name = "none";
                break;
            case 1:
                name = "n";
                break;
            case 2:
                name = "s";
                break;
            case 3:
                name = "ns";
                break;
            case 4:
                name = "e";
                break;
            case 5:
                name = "ne";
                break;
            case 6:
                name = "es";
                break;
            case 7:
                name = "nes";
                break;
            case 8:
                name = "w";
                break;
            case 9:
                name = "nw";
                break;
            case 10:
                name = "sw";
                break;
            case 11:
                name ="nsw";
                break;
            case 12:
                name = "ew";
                break;
            case 13:
                name = "new";
                break;
            case 14:
                name = "esw";
                break;
            case 15:
                name = "all";
                break;
            default:
                console.error("unable to load a texture for dirsf %d", dirsf);
          }
        return `resources/pixmaps/${kind}-${name}.png`;
    };

    const getExtraAssetPath = function( extra: number, kind: ExtraKind ): string
    {
        let name: string = "";
        if (kind === "mob")
            switch (extra) {
                case 0:
                    name = "rent";
                    break;
                case 1:
                    name = "shop";
                    break;
                case 2:
                    name = "weaponshop";
                    break;
                case 3:
                    name = "armourshop";
                    break;
                case 4:
                    name = "foodshop";
                    break;
                case 5:
                    name = "petshop";
                    break;
                case 6:
                    name = "guild";
                    break;
                case 7:
                    name = "scoutguild";
                    break;
                case 8:
                    name = "mageguild";
                    break;
                case 9:
                    name = "clericguild";
                    break;
                case 10:
                    name = "warriorguild";
                    break;
                case 11:
                    name = "rangerguild";
                    break;
                case 12:
                    name = "aggmob";
                    break;
                case 13:
                    name = "questmob";
                    break;
                case 14:
                    name = "passivemob";
                    break;
                case 15:
                    name = "elitemob";
                    break;
                case 16:
                    name = "smob";
                    break;
                case 17:
                    name = "milkable";
                    break;
                case 18:
                    name = "rattlesnake";
                    break;
                default:
                  console.error("unable to load mob texture %d", extra);
            }
        else if (kind === "load")
            switch (extra) {
              case 0:
                name = "treasure";
                break;
            case 1:
                name = "armour";
                break;
            case 2:
                name = "weapon";
                break;
            case 3:
                name = "water";
                break;
            case 4:
                name = "food";
                break;
            case 5:
                name = "herb";
                break;
            case 6:
                name = "key";
                break;
            case 7:
                name = "mule";
                break;
            case 8:
                name = "horse";
                break;
            case 9:
                name = "pack";
                break;
            case 10:
                name = "trained";
                break;
            case 11:
                name = "rohirrim";
                break;
            case 12:
                name = "warg";
                break;
            case 13:
                name = "boat";
                break;
            case 14:
                name = "attention";
                break;
            case 15:
                name = "watch";
                break;
            case 16:
                name = "clock";
                break;
            case 17:
                name = "mail";
                break;
            case 18:
                name = "stable";
                break;
            case 19:
                name = "whiteword";
                break;
            case 20:
                name = "darkword";
                break;
            case 21:
                name = "equipment";
                break;
            case 22:
                name = "coach";
                break;
            case 23:
                name = "ferry";
                break;
            default:
              console.error("unable to load load texture %d", extra);
            }
        return `resources/pixmaps/${kind}-${name}.png`;
    }

    export function getAllAssetPaths(): string[]
    {
        const paths: string[] = [];

        for ( let i = 0; i < Sector.COUNT; ++i )
            paths.push( getSectorAssetPath( i ) );

        for ( let i = 0; i < ( 1 << ( Dir.LAST_GROUND_DIR + 1 ) ); ++i )
        {
            paths.push( getRoadAssetPath( i, "road" ) );
            paths.push( getRoadAssetPath( i, "trail" ) );
        }

        for ( let i = 0; i < MOB_FLAGS; ++i )
            paths.push( getExtraAssetPath( i, "mob" ) );
        for ( let i = 0; i < LOAD_FLAGS; ++i )
            paths.push( getExtraAssetPath( i, "load" ) );

        return paths;
    }

    // Road and trail assets are numbered 0..15 based on bit operations
    // describing which exits are roads/trails.
    const roadDirsFlags = function( room: Room ) : number
    {
        let dirsf: number = 0;

        for ( let dir = 0; dir <= Dir.LAST_GROUND_DIR; ++dir )
            if ( room.data.exits[ dir ].flags & ExitFlags.ROAD )
                dirsf |= ( 1 << dir );

        return dirsf;
    };

    const buildRoomSector = function( room: Room ) : PIXI.Container
    {
        let display: PIXI.Container;
        let sectorSprite: PIXI.Sprite;
        const dirsf = roadDirsFlags( room );

        if ( room.data.sector === Sector.ROAD )
        {
            const imgPath = getRoadAssetPath( dirsf, "road" );
            sectorSprite = new PIXI.Sprite( PIXI.Assets.get( imgPath ) );
            sectorSprite.height = sectorSprite.width = ROOM_PIXELS;
            display = sectorSprite;
        }
        else
        {
            const imgPath = getSectorAssetPath( room.data.sector );
            sectorSprite = new PIXI.Sprite( PIXI.Assets.get( imgPath ) );
            sectorSprite.height = sectorSprite.width = ROOM_PIXELS;

            if ( dirsf !== 0 ) // Trail (road exits but not Sectors.ROAD)
            {
                const trailPath = getRoadAssetPath( dirsf, "trail" );
                const trail = new PIXI.Sprite( PIXI.Assets.get( trailPath ) );
                trail.scale.set( sectorSprite.width / trail.width, sectorSprite.height / trail.height );

                display = new PIXI.Container();
                display.addChild( sectorSprite );
                display.addChild( trail );
            }
            else
            {
                display = sectorSprite;
            }
        }
        return display;
    };

    const buildRoomBorders = function( room: Room ) : PIXI.Graphics
    {
        const borders = new PIXI.Graphics();
        borders.setStrokeStyle( { width: 2, color: 0x000000, alpha: 1 } );

        const borderSpec = [
            { dir: Dir.NORTH, x0: 0,           y0: 0,           x1: ROOM_PIXELS, y1: 0           },
            { dir: Dir.EAST,  x0: ROOM_PIXELS, y0: 0,           x1: ROOM_PIXELS, y1: ROOM_PIXELS },
            { dir: Dir.SOUTH, x0: ROOM_PIXELS, y0: ROOM_PIXELS, x1: 0,           y1: ROOM_PIXELS },
            { dir: Dir.WEST,  x0: 0,           y0: ROOM_PIXELS, x1: 0,           y1: 0           },
        ];

        for ( const spec of borderSpec )
        {
            if ( room.data.exits[ spec.dir ].out.length === 0 )
            {
                borders.moveTo( spec.x0, spec.y0 );
                borders.lineTo( spec.x1, spec.y1 );
            }
        }
        borders.stroke()
        return borders;
    };

    const buildUpExit = function( room: Room ): PIXI.Container | null
    {
        if ( room.data.exits[ Dir.UP ].out.length === 0 )
            return null;

        const exit = new PIXI.Graphics();

        exit.fill( 0xffffff );
        exit.circle( ROOM_PIXELS * 0.75, ROOM_PIXELS * 0.25, ROOM_PIXELS / 8 );
        exit.fill();

        exit.setStrokeStyle( { width: 1, color: 0x000000, alpha: 1 } );
        exit.circle( ROOM_PIXELS * 0.75, ROOM_PIXELS * 0.25, 1 );
        exit.stroke()

        return exit;
    };

    const buildDownExit = function( room: Room ): PIXI.Container | null
    {
        if ( room.data.exits[ Dir.DOWN ].out.length === 0 )
            return null;

        const radius = ROOM_PIXELS / 8;
        const crossCoord = Math.sin( Math.PI / 4 ) * radius;
        const centerX = ROOM_PIXELS * 0.25;
        const centerY = ROOM_PIXELS * 0.75;

        const exit = new PIXI.Graphics();
        exit.setStrokeStyle( { width: 1, color: 0x000000, alpha: 1 } );

        exit.fill( 0xffffff );
        exit.circle( centerX, centerY, radius );
        exit.fill();

        exit.circle( centerX, centerY, radius );
        exit.stroke()

        exit.moveTo( centerX - crossCoord, centerY - crossCoord );
        exit.lineTo( centerX + crossCoord, centerY + crossCoord );
        exit.moveTo( centerX - crossCoord, centerY + crossCoord );
        exit.lineTo( centerX + crossCoord, centerY - crossCoord );
        exit.stroke()
        return exit;
    };

    const buildRoomExtra = function( room: Room, kind: ExtraKind ) : PIXI.Container | null
    {
        const flagsCount = (kind === "load" ? LOAD_FLAGS : MOB_FLAGS );
        const flags = (kind === "load" ? room.data.loadflags : room.data.mobflags );

        const paths: string[] = [];
        for ( let i = 0; i < flagsCount; ++i )
            if ( flags & ( 1 << i ) )
                paths.push( getExtraAssetPath( i, kind ) );

        if ( paths.length === 0 )
            return null;

        // Do not allocate a container for the common case of a single load flag
        if ( paths.length === 1 )
        {
            const sprite: PIXI.Sprite = new PIXI.Sprite( PIXI.Assets.get( paths[0] ) );
            sprite.scale.set( ROOM_PIXELS / sprite.width, ROOM_PIXELS / sprite.height );
            return sprite;
        }

        const container = new PIXI.Container();
        for ( const path of paths )
        {
            const sprite: PIXI.Sprite = new PIXI.Sprite( PIXI.Assets.get( path ) );
            sprite.scale.set( ROOM_PIXELS / sprite.width, ROOM_PIXELS / sprite.height );
            container.addChild( sprite );
        }
        return container;
    };

    const maybeAddChild = function( display: PIXI.Container, child: PIXI.Container | null ): void
    {
        if ( child != null )
            display.addChild( child );
    }

    /* Returns the graphical structure for a single room for rendering (base
     * texture, walls, flags etc). */
    export function buildRoomDisplay( room: Room ): PIXI.Container
    {
        const display = new PIXI.Container();

        display.addChild( buildRoomSector( room ) );
        display.addChild( buildRoomBorders( room ) );
        maybeAddChild( display, buildUpExit( room ) );
        maybeAddChild( display, buildDownExit( room ) );
        maybeAddChild( display, buildRoomExtra( room, "mob" ) );
        maybeAddChild( display, buildRoomExtra( room, "load" ) );

        // Position the room display in its layer
        display.position = new PIXI.Point( room.data.x * ROOM_PIXELS, room.data.y * ROOM_PIXELS );
        /*console.log( "MumeMapDisplay added room %s (%d,%d) in PIXI at local:%O, global:%O",
            room.data.name, room.data.x, room.data.y, display.position, display.getGlobalPosition() );*/

        display.updateCacheTexture();
        return display;
    }

    /* Returns the graphical structure for the yellow square that shows the current
     * position to the player. */
    export function buildHerePointer(): PIXI.Container
    {
        const size = ROOM_PIXELS * 1.4;
        const offset = ( size - ROOM_PIXELS ) / 2;

        const square = new PIXI.Graphics();

        square.fill( { color: 0x000000, alpha: 0.1 } );
        square.rect( -offset, -offset, size, size );
        square.fill();

        square.setStrokeStyle( { width: 2, color: 0xFFFF00, alpha: 1 } );
        square.rect( -offset, -offset, size, size )
        square.stroke();

        return square;
    }

    export function buildInitialHint(): PIXI.Text
    {
        const text = new PIXI.Text({
            text: "Enter Arda to see a map here",
            style: {
                fontFamily : 'Arial', fontSize: 24, fill : 'white', align : 'center',
                wordWrap: true, wordWrapWidth: 400,
                dropShadow: {
                    alpha: 1,
                    angle: Math.PI / 6,
                    blur: 5,
                    color: 'black',
                    distance: 0,
                },
            }
        });

        return text;
    }
}

/* Renders mapData into a DOM placeholder identified by containerElementName.
 */
class MumeMapDisplay
{
    private mapData: MumeMapData;
    private here: RoomCoords | undefined;

    // PIXI elements
    private roomDisplays: SpatialIndex<PIXI.Container>;
    private herePointer!: PIXI.Container;
    private layers: PIXI.Container[] = [];
    private pixi!: PIXI.Application;
    private initialHint!: PIXI.Text;

    // Use load() instead if the assets might not have been loaded yet.
    constructor( containerElementName: string, mapData: MumeMapData )
    {
        this.mapData = mapData;
        this.roomDisplays = new SpatialIndex( this.mapData.metaData );
    }

    // Async factory function. Returns a Display when the prerequisites are loaded.
    public static async load( containerElementName: string, mapData: MumeMapData ): Promise<MumeMapDisplay>
    {
        // Start loading assets
        // Ensure getAllAssetPaths returns string[]
        const assetPaths = Mm2Gfx.getAllAssetPaths().map(p => String(p));
        try {
            await PIXI.Assets.load(assetPaths);
        } catch (error: unknown) {
            console.error("Failed to load PIXI assets:", error);
            throw error;
        }

        const display = new MumeMapDisplay( containerElementName, mapData );
        await display.installMap( containerElementName );
        display.buildMapDisplay();
        return display;
    }

    /* Installs the viewport into the DOM. */
    public async installMap( containerElementName: string ): Promise<void>
    {
        this.pixi = new PIXI.Application();
        await this.pixi.init({
            autoStart: false,
            backgroundColor: 0x6e6e6e,
            resolution: window.devicePixelRatio || 1,
            autoDensity: true,
        });

        // Check if PIXI Application and its canvas were successfully created
        if (!this.pixi || !this.pixi.canvas) {
            throw new Error("Bug: Failed to initialize PIXI Application or get canvas.");
        }

        const stub = document.getElementById( containerElementName );
        if ( stub == null || stub.parentElement == null ) {
            document.body.appendChild(this.pixi.canvas as HTMLCanvasElement);
        } else {
            stub.parentElement.replaceChild(this.pixi.canvas as HTMLCanvasElement, stub);
        }
    }

    public fitParent(): boolean
    {
        const parentElement = (this.pixi.canvas as HTMLCanvasElement).parentElement;
        if (parentElement === null)
        {
            console.warn( "PIXI canvas parentElement is null." );
            return false;
        }

        const canvasParent = $(parentElement);

        if ( canvasParent.is( ":visible" ) && canvasParent.width() && canvasParent.height() )
        {
            let width  = canvasParent.width() as number;
            let height = canvasParent.height() as number;

            // Non-integers may cause the other dimension to unexpectedly
            // increase. 535.983,520 => 535.983,520.95, then rounded up to the
            // nearest integer, causing scrollbars.
            // Furthermore, in FF 52 ESR (at least), the actual height of the
            // canvas seems to be a few px more than reported by the Dev Tools,
            // causing scrollbars again. Same issue in Chromium 62 for the map window.
            width = Math.floor( width );
            height = Math.floor( height ) - 4;

            this.pixi.renderer.resize( width, height );
            this.fullRefresh();
        }
        else
        {
            this.pixi.renderer.resize( 0, 0 );
        }

        return true;
    }

    public isVisible(): boolean
    {
        const visible = this.pixi.renderer.width > 0 && this.pixi.renderer.height > 0;
        return visible;
    }

    /* Called when all assets are available. Constructs the graphical structure
     * (layers etc) used for rendering and throw all that at the rendering layer
     * (Pixi lib). */
    public buildMapDisplay(): void
    {
        // Everything belongs to the map, so we can move it around to emulate
        // moving the viewport
        const map = new PIXI.Container();

        // Rooms live on layers, there is one layer per z coord
        for ( let i = this.mapData.metaData.minZ; i <= this.mapData.metaData.maxZ; ++i )
        {
            const layer = new PIXI.Container();
            this.layers.push( layer );
            map.addChild( layer );
        }

        // Add the current room yellow square
        this.herePointer = Mm2Gfx.buildHerePointer();
        this.herePointer.visible = false;
        map.addChild( this.herePointer );

        // Add a hint for new users instead of a blank grey panel
        this.initialHint = Mm2Gfx.buildInitialHint();
        this.pixi.stage.addChild( this.initialHint );

        // And set the stage
        this.pixi.stage.addChild( map );
        this.reshapeInitialHint();
        this.pixi.render();

        return;
    }

    private static dumpContainer( indent: number, name: string, what: PIXI.Container ): void
    {
        let indentStr = "";
        while ( indent-- )
            indentStr += "  ";

        console.log( "%s%s: @%d,%d x=b=%d y=c=%d tx=%d ty=%d",
            indentStr, name,
            what.x, what.y,
            what.worldTransform.b, what.worldTransform.c,
            what.worldTransform.tx, what.worldTransform.ty );
    }

    public dumpAllCoords(): void
    {
        MumeMapDisplay.dumpContainer( 0, "stage", this.pixi.stage );

        const mapDO = this.pixi.stage.children[0];

        if ( !( mapDO instanceof PIXI.Container ) )
            return;
        const map: PIXI.Container = mapDO;

        MumeMapDisplay.dumpContainer( 1, "map", map );
        for ( let i = 0; i < map.children.length; ++i )
        {
            const name = ( i == map.children.length - 1 ) ? "herePointer" : "layer";
            MumeMapDisplay.dumpContainer( 2, name, map.children[i] );
        }
    }

    private roomCoordsToPoint( where: RoomCoords): PIXI.Point
    {
        return new PIXI.Point( where.x * ROOM_PIXELS, where.y * ROOM_PIXELS );
    }

    private zeroZ( z: number ): number
    {
        return z - this.mapData.metaData.minZ;
    }

    private layerForCoords( coords: RoomCoords ): PIXI.Container
    {
        const zeroedZ = this.zeroZ( coords.z );
        return this.layers[zeroedZ];
    }

    private roomCoordsNear( where: RoomCoords ): RoomCoords[]
    {
        const coordinates: RoomCoords[] = [];
        for ( let i = where.x - 20; i < where.x + 20; ++i )
        {
            for ( let j = where.y - 20; j < where.y + 20; ++j )
            {
                for ( let k = this.mapData.metaData.minZ; k <= this.mapData.metaData.maxZ; ++k )
                {
                    const c = new RoomCoords( i, j, k );
                    if ( this.roomDisplays.get( c ) == null )
                        coordinates.push( c );
                    // Yes, this tight loop is probably horrible for memory & CPU
                }
            }
        }

        return coordinates;
    }

    /* We want a perspective effect between the layers to emulate 3D rendering.
     * For that purpose, we need to set the pivot of each layer to the current
     * position so that the upper/lower layers are scaled up/down like
     * perspective would.
     *
     * However, PIXI's pivot is actually the anchor point for position, too, so
     * under the hood we shift the layers around. It doesn't affect the rest of
     * the code because it is hidden inside the map/stage abstraction.
     */
    private repositionLayers( where: RoomCoords ): void
    {
        const z = this.zeroZ( where.z );
        for ( let i = 0; i < this.layers.length; ++i )
        {
            const layer = this.layers[i];

            const localPx = this.roomCoordsToPoint( where );
            localPx.x += ROOM_PIXELS / 2;
            localPx.y += ROOM_PIXELS / 2;

            layer.visible = false;
            layer.scale.set( 1, 1 ); // pivot is affected by scale!
            layer.pivot = layer.position = localPx;
            layer.alpha = 1;
            layer.filters = [];

            if ( i === z - 1 ) // Shrink and darken the lower layer
            {
                layer.visible = true;
                layer.scale.set( 0.8, 0.8 );
                if ( this.pixi.renderer.type === PIXI.RendererType.WEBGL )
                {
                    const filter = new PIXI.ColorMatrixFilter();
                    filter.brightness( 0.4, false );
                    layer.filters = [ filter ];
                }
                else
                {
                    layer.alpha = 0.6;
                }
            }
            else if ( i === z )
            {
                layer.visible = true;
            }
            else if ( i === z + 1 ) // Enlarge and brighten the upper layer
            {
                layer.visible = true;
                layer.scale.set( 1.2, 1.2 );
                layer.alpha = 0.1;
            }

            /*console.log("layer[%d].position == %d,%d%s", i, layer.position.x, layer.position.y,
                ( i === z ? " (active)" : "" ) );*/
        }
    }

    /* Repositions the HerePointer (yellow square), centers the view, and fetches
     * nearby rooms for Pixi. Refreshes the view once done.
     */
    public repositionTo( where: RoomCoords ): void
    {
        this.here = where;
        this.initialHint.visible = false;

        if ( !this.isVisible() )
            return;

        console.log( "Recentering view to (r) %O", where );

        this.herePointer.position = new PIXI.Point( where.x * ROOM_PIXELS, where.y * ROOM_PIXELS );
        this.herePointer.visible = true;

        this.repositionLayers( where );

        // Scroll to make the herePointer visible
        const hpPos = this.herePointer.position;
        this.pixi.stage.x = - hpPos.x + this.pixi.screen.width / 2;
        this.pixi.stage.y = - hpPos.y + this.pixi.screen.height / 2;
        // PIXI.CanvasRenderer doesn't seem to update the stage's transform
        // correctly (not all all, lagging, plain wrong, pick one). This forces
        // a working update.
        this.pixi.stage.toGlobal( new PIXI.Point( 0, 0 ) );

        const coordinates: RoomCoords[] = this.roomCoordsNear( where );
        const background = this.mapData.getRoomsAt( coordinates )
            .progress( ( rooms: Room[] ) =>
            {
                console.log( "repositionHere progress, %d rooms", rooms.length );
                for ( let k = 0; k < rooms.length; ++k )
                {
                    const room = rooms[k];
                    const c = room.coords();
                    const display = Mm2Gfx.buildRoomDisplay( room );
                    if ( this.roomDisplays.get( c ) == null )
                    {
                        this.roomDisplays.set( c, display );
                        this.layerForCoords( c ).addChild( display );
                    }
                }
            } );

        background.done( () => this.pixi.render() );
    }

    private reshapeInitialHint(): void
    {
        this.initialHint.style.wordWrapWidth = this.pixi.renderer.width - 40;

        const hintSize = this.initialHint.getLocalBounds();
        this.initialHint.pivot.x = hintSize.width / 2;
        this.initialHint.pivot.y = hintSize.height / 2;

        this.initialHint.x = this.pixi.renderer.width / 2;
        this.initialHint.y = this.pixi.renderer.height / 2;

        this.pixi.render();
    }

    /* Update all graphical elements to match the current position, going as
     * far as fetching rooms if needed. */
    public fullRefresh()
    {
        if ( this.here != null )
            this.repositionTo( this.here );
        else if ( this.initialHint.visible )
            this.reshapeInitialHint();
        else
            console.warn( "ignoring MumeMapDisplay.fullRefresh(): no position known" );
    }
}



export interface MumeXmlParserTag
{
    name: string;
    attr: string;
    text: string;
}

enum MumeXmlMode
{
    // Not requested. We won't interpret <xml> tags, as players could send us fakes.
    Off,
    // We will request XML mode as soon as we're done with the login prompt.
    AsSoonAsPossible,
    // We requested XML mode and will enable it as soon as we get a <xml>
    Desirable,
    // We are in XML mode, interpreting <tags>
    On,
}

class ScoutingState
{
    public active: boolean = false;
    // We stop scouting automatically after a bit if somehow we missed the STOP message
    private scoutingBytes: number = 0;

    private static readonly START = /^You quietly scout (north|east|south|west|up|down)wards\.\.\.\s*$/m;
    private static readonly STOP = /^You stop scouting\.\s*$/m;

    public pushText( text: string ): void
    {
        const startMatch = text.match( ScoutingState.START );
        if ( startMatch )
        {
            let startIndex = startMatch.index;
            if ( startIndex === undefined ) // Shouldn't happen, but it does keep TS happy
                startIndex = text.indexOf( "You quietly scout" );
            this.scoutingBytes = text.length - ( startIndex + startMatch[0].length );

            this.active = true;
            console.log( "Starting to scout, ignoring new rooms." );
        }
        else if ( this.active )
        {
            this.scoutingBytes += text.length;

            if ( text.match( ScoutingState.STOP ) )
            {
                this.active = false;
                console.log( "Done scouting." );
            }
            else if ( this.scoutingBytes > 102400 )
            {
                this.active = false;
                console.warn( "Force-disabling scout mode after a while" );
            }
        }
    }

    public endTag( tag: MumeXmlParserTag ): void
    {
        if ( this.active && tag.name === "movement" )
        {
            // This typically happens when scouting a oneway
            this.active = false;
            console.log( "Aborting scout because of movement" );
        }
    }
}

/* Filters out the XML-like tags that MUME can send in "XML mode", and sends
 * them as events instead.
 *
 * Sample input:
 * <xml>XML mode is now on.
 * <prompt>!f- CW&gt;</prompt>f
 * You flee head over heels.
 * You flee north.
 * <movement dir=north/>
 * <room><name>A Flat Marsh</name>
 * <description>The few, low patches of tangled rushes add a clear tone to the otherwise sombre
 * colour of this flat marshland. Some puddles are scattered behind them, where
 * there are many pebbles of varying sizes. Most of these pebbles have been
 * covered by a thin layer of dark, green moss.
 * </description>A large green shrub grows in the middle of a large pool of mud.
 * </room><exits>Exits: north, east, south.
 * </exits>
 * <prompt>!%- CW&gt;</prompt>cha xml off
 * </xml>XML mode is now off.
 *
 * Matching event output:
 * { name: "prompt",      attr: "",          text: "!f- CW>" }
 * { name: "movement",    attr: "dir=north", text: "" }
 * { name: "name",        attr: "",          text: "A Flat Marsh" }
 * { name: "description", attr: "",          text: "The few... sombre\n...moss.\n" }
 * { name: "room",        attr: "",          text: "A large green...mud.\n" }
 * { name: "exits",       attr: "",          text: "Exits: north, east, south.\n" }
 * { name: "prompt",      attr: "",          text: "!%- CW>" }
 * { name: "xml",         attr: "",          text: "" }
 *
 * Tag hierarchy does not carry a lot of meaning and is not conveyed in the
 * events sent. The text of the XML is always empty as it would be useless but
 * grow huge over the course of the session.
 *
 * At the time of writing, MUME emits at most 1 attribute for tags encountered
 * during mortal sessions, and never quotes it.
 *
 * One registers to events by calling:
 * parser.on( MumeXmlParser.SIG_TAG_END, function( tag ) { /* Use tag.name etc here *./ } );
 */
export class MumeXmlParser
{
    // instanceof doesn't work cross-window
    private readonly isMumeXmlParser = true;

    private tagStack!: MumeXmlParserTag[];
    private plainText!: string;
    private mode!: MumeXmlMode;
    private xmlDesirableBytes: number = 0;
    private decaf: DecafMUDInstance;
    private scouting!: ScoutingState

    constructor( decaf: DecafMUDInstance )
    {
        this.decaf = decaf;
        this.clear();
    }

    public static readonly SIG_TAG_END = "tagend";

    public clear(): void
    {
        this.tagStack = [];
        this.plainText = "";
        this.mode = MumeXmlMode.Off;
        this.scouting = new ScoutingState();
    }

    public connected(): void
    {
        this.clear();
        this.mode = MumeXmlMode.AsSoonAsPossible;
    }

    private setXmlModeDesirable(): void
    {
        this.mode = MumeXmlMode.Desirable;
        this.xmlDesirableBytes = 0;
    }

    private static readonly ENTER_GAME_LINES = new RegExp(
        /^Reconnecting\.\s*$/.source + "|" +
        /^Never forget! Try to role-play\.\.\.\s*$/.source, 'm' );

    private detectXml( input: string ): { text: string, xml: string, }
    {
        switch ( this.mode )
        {
        case MumeXmlMode.AsSoonAsPossible:
            if ( input.match( MumeXmlParser.ENTER_GAME_LINES ) )
            {
                // Negociating XML mode at once sends a double login prompt,
                // which is unsightly as it is the first thing that players
                // see. WebSockets do not let us send the negociation string
                // before the MUD outputs anything, like MM2 does.

                // Wait until we're done with the pre-play to request XML mode +
                // gratuitous descs. Hopefully, the first screen won't be split
                // across filterInputText() calls, or we'll have to keep state.
                this.decaf.socket.write( "~$#EX2\n1G\n" );
                this.setXmlModeDesirable();
                console.log( "Negotiating MUME XML mode" );
            }

            // fall through

        case MumeXmlMode.Off:
            return { text: input, xml: "", };

        case MumeXmlMode.Desirable: {
            const xmlStart = input.indexOf( "<xml>", 0 );

            // If somehow XML doesn't get enabled right after we asked for it, at
            // least the xmlDesirableBytes will reduce the window during which
            // someone might send us a fake <xml> tag and confuse the parser, which
            // would be dangerous in the middle of PK for example.
            if ( xmlStart !== -1 && this.xmlDesirableBytes + xmlStart < 1024 )
            {
                console.log( "Enabled MUME XML mode" );
                this.mode = MumeXmlMode.On;
                return { text: input.substr( 0, xmlStart ), xml: input.substr( xmlStart ), };
            }

            if ( this.xmlDesirableBytes >= 1024 )
                this.mode = MumeXmlMode.Off;

            this.xmlDesirableBytes += input.length;

            return { text: input, xml: "", };
        }
        case MumeXmlMode.On:
            return { text: "", xml: input, };
        }
    }

    private topTag(): MumeXmlParserTag | null
    {
        if ( this.tagStack.length == 0 )
            return null;
        else
            return this.tagStack[ this.tagStack.length - 1 ];
    }

    // True if the current input is wrapped in <gratuitous>, ie. something for
    // the benefit of the client but that the player doesn't want to see.
    private isGratuitous(): boolean
    {
        for ( const tag of this.tagStack )
            if ( tag.name === "gratuitous" )
                return true;

        return false;
    }

    private resetPlainText(): string
    {
        const plainText = this.plainText;
        this.plainText = "";

        return plainText;
    }

    /* Matches a start or end tag and captures the following:
     * 1. any text preceeding the tag
     * 2. "/" if this is an end tag
     * 3. tag name
     * 4. any attributes
     * 5. "/" if this is a leaf tag (IOW, no end tag will follow).
     * 6. any text following the tag
     *
     * Pardon the write-only RE, JavaScript doesn't have /x.
     */
    private static readonly TAG_RE = /([^<]*)<(\/?)(\w+)(?: ([^/>]+))?(\/?)>([^<]*)/g;

    private static decodeEntities( text: string ): string
    {
        const decodedText = text
            .replace( /&lt;/g, "<" )
            .replace( /&gt;/g, ">" )
            .replace( /&amp;/g, "&" );

        return decodedText;
    }

    /* Takes text with pseudo-XML as input, returns plain text and emits events.
     */
    public filterInputText( rawInput: string ): string
    {
        if ( this.mode === MumeXmlMode.Off )
            return rawInput;

        const input = this.detectXml( rawInput );
        let matched: boolean = false;
        let matches: RegExpExecArray | null;

        while ( ( matches = MumeXmlParser.TAG_RE.exec( input.xml ) ) !== null )
        {
            const [ , textBefore, isEnd, tagName, attr, isLeaf, textAfter ] = matches;

            matched = true;

            if ( textBefore )
                this.pushText( textBefore );

            if ( isLeaf )
            {
                this.startTag( tagName, attr );
                this.endTag( tagName );
            }
            else if ( isEnd )
            {
                this.endTag( tagName );
            }
            else
            {
                this.startTag( tagName, attr );
            }

            if ( textAfter )
                this.pushText( textAfter );
        }

        if ( ! matched )
            this.pushText( input.xml );

        return input.text + this.resetPlainText();
    }

    private pushText( raw: string ): void
    {
        const text = MumeXmlParser.decodeEntities( raw );
        const topTag = this.topTag();

        this.scouting.pushText( text );

        if ( !topTag || topTag.name === "xml" )
        {
            this.plainText += text;
        }
        else
        {
            if ( topTag.text.length + text.length > 1500 )
            {
                console.warn( "Run-away MumeXmlParser tag " +
                    topTag.name + ", force-closing the tag." );
                this.tagStack.pop();
            }

            if ( !this.isGratuitous() )
                this.plainText += text;

            topTag.text += text;
        }
    }

    private startTag( tagName: string, attr: string ): void
    {
        if ( this.tagStack.length > 5 )
        {
            const tags = this.tagStack.map( t => t.name ).join();
            console.warn( `Ignoring MumeXmlParser tag ${tagName} because of deeply nested tags: ${tags}` );
            return;
        }

        this.tagStack.push( { name: tagName, attr, text: "" } );
    }

    private endTag( tagName: string ): void
    {
        if ( tagName === "xml" )
        {
            // Most likely, the player typed "cha xml" by mistake. Hopefully he'll
            // reenable it soon, otherwise we prefer to break rather than remain
            // wide open to attack.
            this.setXmlModeDesirable();
        }

        // Find the most recent tag in the stack which matches tagName
        let matchingTagIndex: number | null = null;
        for ( let i = this.tagStack.length - 1; i >= 0; --i )
        {
            if ( this.tagStack[i].name === tagName )
            {
                matchingTagIndex = i;
                break;
            }
        }

        // Perform some sanity checks
        if ( matchingTagIndex == null )
        {
            console.warn( "Ignoring unmatched closing MumeXmlParser tag " + tagName );
            return;
        }
        else if ( matchingTagIndex + 1 !== this.tagStack.length )
        {
            const tags = this.tagStack.slice( matchingTagIndex + 1 ).map( t => t.name ).join();
            console.warn( "Closing MumeXmlParser tag " + tagName +
                " with the following other tags open: " + tags );
            this.tagStack.length = matchingTagIndex + 1;

            // fall through
        }

        const topTag = this.tagStack.pop() as MumeXmlParserTag;
        this.scouting.endTag( topTag );
        if ( !this.scouting.active )
            $(this).triggerHandler( MumeXmlParser.SIG_TAG_END, [ topTag, ] );
    }
}
