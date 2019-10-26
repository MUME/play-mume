# Play MUME!

A modern web client for MUME using DecafMUD that is hosted on
[mume.org](https://mume.org/play/browser).

The target audience is new players who don't want to install desktop
applications to test MUME, and other players who can't use their usual setup
for some reason (not at home etc). It is not intended to replace a
full-featured client + mapper.

## I Want to Host a Copy of Play MUME!

It is a Bad Idea to self-host a copy of Play MUME! for general usage because
you will encourage players to input their MUME passwords into random websites
and expose themselves to phishing attacks.

Please contact the Valar on MUME before doing this. We'll discuss other options.

## I Want to Contribute to Play MUME!

Great! You'll need a little setup described below. If you get stuck, do not
hesitate to contact the Valar on MUME!

### Forking the repositories

The Github contribution workflow requires that you sign up on Github and fork
the two repositories, [DecafMUD](https://github.com/MUME/DecafMUD/) and
[Play MUME!](https://github.com/MUME/play-mume/).

Doing so now will save you time later when you want to send pull requests.

In this document we will use `YOU` as a placeholder for your Github username.
You could skip this step and use `MUME` as `YOU`, but you'll eventually have
to sign up, fork, and then replace your remote URLs (an advanced topic).

Github has a [4 mins
tutorial](https://guides.github.com/activities/hello-world/) on forking
repositories and sending pull requests.

### Getting the Source Code

The `index.html` of this project expects to be installed alongside with
DecafMUD, like this:

    play/           # Clone of https://github.com/YOU/play-mume/
        index.html  # point your browser here (/play/)
        DecafMUD/   # Clone of https://github.com/YOU/DecafMUD/

So, assuming you are in your project directory and are using the `git`
command-line software, run:

    git clone https://github.com/YOU/play-mume.git play
    cd play
    git submodule update --init
    cd DecafMUD
    git remote add YOU https://github.com/YOU/DecafMud.git
    git fetch YOU
    git checkout YOU master

Remember to replace `YOU` with your Github username.

Adapt these instructions if you are using a graphical Git client to get the
above directory layout.

### Compiling the Source Code

The best part of Play MUME! is written in TypeScript (`src/*`) and will need to
be compiled to JavaScript (`build/*`) before your browser can use it.

#### Docker

You can use `docker-compose` to quickly get a working developer environment up
and running. This will run the TypeScript compiler and expose Play MUME! on
port 4000 running on node.js within a Docker container:

    docker-compose up --build

#### Alternative

If you do not want to use Docker you will need to set up your developer
environment manually. You will need to install TypeScript compiler from
https://www.typescriptlang.org and run in `play`:

    tsc

TypeScript is a superset of JavaScript that compiles to clean JavaScript
output. It helps catching bugs before anybody even tests the code, letting me
produce more features in less time. Try it with a [compatible
editor](https://github.com/Microsoft/TypeScript/wiki/TypeScript-Editor-Support)
and you'll love it too!

#### Getting the Third-party Libraries

Play MUME! relies on a few 3rd-party Javascript libraries. As I didn't
integrate with NPM or Yarn yet, you'll have to download them by hand into the
`node_modules/` directory. See `node_modules/README.txt` for the instructions.

Or just grab the `libs` folder from a recent
[release](https://github.com/MUME/play-mume/releases)'s
`play-mume-vX.Y.Z.zip`.

If you're using `docker-compose` you can enter into the container and grab the
libraries out:

    docker exec -it play_play-mume_1 sh

### Getting Map Data

The map data is an export of a MMapper map into a special web-friendly format
that allows the browser to only load the surrounding area instead of the whole
35k+ rooms.

As the time of writing, that feature has yet to be included in a stable MMapper
release. Instead, you can just grab the `mapdata` folder from a recent release
`.zip`.

### Setting Up a Web Server

The map display works only if served over HTTP(S), as opposed to just opening
local files in your browser (or you'd have to disable security checks in your
browser).

Setting up a production server is outside of the scope of this document, but
for testing purposes you can use:
- https://cesanta.com/ (untested!) for Windows.
- `python -m SimpleHTTPServer` or `python -m http.server` on GNU/Linux from
  your project's directory (ie. `mume/`).

After one of these commands starts succesfully, point your browser to
http://127.0.0.1:8000/play/.

Just keep the current settings in index.html and you'll use the official MUME
WebSocket proxy.

### Testing

If everything went well, you should see your very own Play MUME! running on
127.0.0.1 in your browser! Check that the map seems to work.

### Contributing

This is where you reap the benefit of the forks above. Write awesome commits
(possibly in a [feature branch](https://guides.github.com/introduction/flow/)),
send a pull request, *et voilà*!

## About the WebSocket Proxy

WebSocket is a modern browser technology that lets Javascript code create data
streams (such as Telnet for MUDs) inside HTTP(S).

### Javascript (Client-Side) Configuration

`index.html` configures the DecafMUD Javascript code to securely connect to
MUME's official WebSocket URL at `https://mume.org/ws-play/` with these
settings:
- `host` set to `mume.org`
- `set_socket.wspath` set to `ws-play/`
- `set_socket.wsport` set to 443 (`*`)
- `set_socket.ssl` set to true (`*`)
