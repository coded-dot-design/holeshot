// A stand-in fizlet-rooms server for the online tests (tests/online.browser.mjs, tests/netlag.mjs; copied
// from Dune Hop 0.4.1; Salvo Bay's, grown to rooms of
// up to four like the real one): the wire protocol @fzlt/core/presence speaks (12-byte messages; LOBBY,
// START, WELCOME, INPUT relayed with first write wins and rising frames, LEAVE on a close) and the
// invite check (POST /invite, which says how many seats a room may have), on Node's own http with a
// minimal WebSocket (RFC 6455, binary frames only). As the real room does: every joiner must ask the
// room's size (409 otherwise), the host's START begins once its count is seated (0: now), and a start
// with fewer seats than the size renumbers them in arrival order. Not the real server: no caps, no
// passes, no resume.
//
// `lag` puts a phone's network between each seat and the room (both ways, in order, as TCP keeps it):
// seat s's round trip `rtt[s % rtt.length]` ms (half up, half down), ± `jitter` ms on each leg, and a
// `spike` ms hold on everything a seat sends or gets for 100 ms, about every `spikeEvery` ms (seeded).
import { createServer } from "node:http";
import { createHash } from "node:crypto";

export const CODE = "HOLESHOT-TEST-CODE";
const INPUT = 1, HASH = 2, WELCOME = 3, LEAVE = 4, START = 7, LOBBY = 8;
const msg = (k, s, p, mode, a = 0, b = 0) => {
  const d = Buffer.alloc(12);
  (d[0] = k), (d[1] = s), (d[2] = p), (d[3] = mode);
  d.writeUInt32LE(a >>> 0, 4), d.writeUInt32LE(b >>> 0, 8);
  return d;
};

/** A seeded 0..1 draw (the shim's jitter and spikes repeat run to run). */
const draw = (seed) => () => ((seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0), seed / 4294967296);
/** One leg of a seat's link: `run(fn)` runs fn after this leg's delay, never before an earlier one. */
function leg(lag, seat, salt) {
  if (!lag) return (fn) => fn();
  const r = draw(((lag.seed ?? 7) * 977 + seat * 131 + salt) >>> 0), rtt = lag.rtt[seat % lag.rtt.length], j = lag.jitter ?? 0;
  let at = 0, spikeTo = 0, nextSpike = lag.spikeEvery ? performance.now() + r() * lag.spikeEvery * 2 : Infinity, timer = null;
  // One queue a leg, drained in order (separate timers could fire out of order and cut the stream).
  const q = [];
  const drain = () => {
    timer = null;
    const now = performance.now();
    while (q.length && q[0][0] <= now + 0.5) q.shift()[1]();
    if (q.length) timer = setTimeout(drain, q[0][0] - now);
  };
  return (fn) => {
    const now = performance.now();
    if (now >= nextSpike) (spikeTo = now + 100), (nextSpike = now + lag.spikeEvery * (0.5 + r()));
    const d = rtt / 2 + (r() * 2 - 1) * j + (now < spikeTo ? lag.spike ?? 300 : 0);
    at = Math.max(at, now + Math.max(0, d));
    q.push([at, fn]);
    if (!timer) timer = setTimeout(drain, at - now);
  };
}

export function roomServer({ max = 4, lag = null } = {}) {
  const rooms = new Map(), socks = new Set();
  let joined = 0;
  const server = createServer((req, res) => {
    const cors = { "access-control-allow-origin": "*", "content-type": "application/json" };
    if (req.url.startsWith("/invite") && req.method === "POST") {
      let body = "";
      req.on("data", (c) => (body += c));
      req.on("end", () => (body.trim().toUpperCase() === CODE ? res.writeHead(200, cors).end(JSON.stringify({ ok: true, players: max })) : res.writeHead(403, cors).end('{"ok":false}')));
      return;
    }
    res.writeHead(404, cors).end("{}");
  });
  server.on("upgrade", (req, sock) => {
    const url = new URL(req.url, "http://x"), m = url.pathname.match(/^\/room\/(\d+)$/), protos = String(req.headers["sec-websocket-protocol"] ?? "").split(",").map((s) => s.trim());
    if (!m || !protos.includes("invite." + CODE)) return sock.end("HTTP/1.1 403 Forbidden\r\n\r\n");
    const players = Number(url.searchParams.get("players")) || 2, key = m[1];
    if (players < 1 || players > max || (rooms.get(key) && rooms.get(key).asked !== players)) return sock.end("HTTP/1.1 409 Conflict\r\n\r\n");
    const accept = createHash("sha1").update(req.headers["sec-websocket-key"] + "258EAFA5-E914-47DA-95CA-C5AB0DC85B11").digest("base64");
    let room = rooms.get(key);
    sock.write(`HTTP/1.1 101 Switching Protocols\r\nUpgrade: websocket\r\nConnection: Upgrade\r\nSec-WebSocket-Accept: ${accept}\r\nSec-WebSocket-Protocol: fizlet-rooms\r\n\r\n`);
    socks.add(sock);
    sock.on("close", () => socks.delete(sock));
    if (!room) rooms.set(key, (room = { seats: new Array(players).fill(null), players, asked: players, started: false, want: 0, mode: 0, seed: (Math.random() * 2 ** 32) >>> 0, frames: new Map() }));
    // Full or playing: the socket opens and closes at once (the real room closes it 4000 "room full").
    if (room.started || room.seats.indexOf(null) < 0) return sock.end(Buffer.from([0x88, 0]));
    const n = joined++, up = leg(lag, n, 1), down = leg(lag, n, 2);
    const peer = { sock, slot: room.seats.indexOf(null), buf: Buffer.alloc(0), send: (d) => ((f) => down(() => !sock.destroyed && sock.write(f)))(Buffer.concat([Buffer.from([0x82, d.length]), d])) };
    room.seats[peer.slot] = peer;
    const taken = () => room.seats.filter(Boolean);
    const lobby = () => room.seats.forEach((p, s) => p?.send(msg(LOBBY, s, room.players, taken().length)));
    const ready = () => {
      const n = taken().length;
      if (room.started || !(n === room.players || (room.want && n >= room.want))) return;
      if (n < room.players) {
        // Fewer than the size: the seats taken, renumbered in arrival order (seat 0, the host, stays).
        room.seats = taken();
        room.seats.forEach((p, s) => (p.slot = s));
        room.players = n;
      }
      room.started = true;
      room.seats.forEach((p, s) => p.send(msg(WELCOME, s, n, room.mode, room.seed, 1 + s)));
    };
    const leave = () => {
      if (room.seats[peer.slot] !== peer) return;
      room.seats[peer.slot] = null;
      if (room.started) room.seats.forEach((p) => p?.send(msg(LEAVE, peer.slot, room.players, 0)));
      if (!taken().length) rooms.delete(key);
      else if (!room.started) lobby();
    };
    sock.on("data", (chunk) => up(() => {
      peer.buf = Buffer.concat([peer.buf, chunk]);
      while (peer.buf.length >= 2) {
        const op = peer.buf[0] & 15, masked = peer.buf[1] & 128;
        let len = peer.buf[1] & 127, at = 2;
        if (len === 126) (len = peer.buf.readUInt16BE(2)), (at = 4);
        else if (len === 127) return sock.destroy();
        const end = at + (masked ? 4 : 0) + len;
        if (peer.buf.length < end) return;
        const mask = masked ? peer.buf.subarray(at, at + 4) : null, data = Buffer.from(peer.buf.subarray(end - len, end));
        if (mask) for (let i = 0; i < data.length; i++) data[i] ^= mask[i & 3];
        peer.buf = peer.buf.subarray(end);
        if (op === 8) return leave(), sock.end(Buffer.from([0x88, 0]));
        if (op !== 2 || data.length !== 12) continue;
        if (!room.started) {
          if (data[0] === START && peer.slot === 0) (room.want = Math.max(1, data[2])), (room.mode = data[3]), ready();
          continue;
        }
        if (data[0] !== INPUT && data[0] !== HASH) continue;
        const k = peer.slot * 2 + data[0], f = data.readUInt32LE(4);
        if (f <= (room.frames.get(k) ?? -1)) continue;
        room.frames.set(k, f);
        data[1] = peer.slot;
        room.seats.forEach((p, s) => s !== peer.slot && p?.send(data));
      }
    }));
    // (Through the uplink too: the room hears the close after the seat's last messages.)
    sock.on("close", () => up(leave));
    sock.on("error", () => up(leave));
    lobby();
    ready();
  });
  return new Promise((ok) => server.listen(0, "127.0.0.1", () => ok({ url: `ws://127.0.0.1:${server.address().port}`, close: () => (socks.forEach((s) => s.destroy()), server.closeAllConnections?.(), server.close()) })));
}
