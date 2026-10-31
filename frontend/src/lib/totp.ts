/** Standard authenticator-app codes (RFC 6238: HMAC-SHA1, 30-second steps, 6 digits). */

function base32Decode(input: string) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  const clean = input.toUpperCase().replace(/=+$/, '').replace(/\s/g, '');
  let bits = 0;
  let value = 0;
  const out: number[] = [];
  for (const ch of clean) {
    const i = alphabet.indexOf(ch);
    if (i < 0) continue;
    value = (value << 5) | i;
    bits += 5;
    if (bits >= 8) {
      out.push((value >>> (bits - 8)) & 0xff);
      bits -= 8;
    }
  }
  return new Uint8Array(out);
}

const rotl = (x: number, n: number) => (x << n) | (x >>> (32 - n));

function sha1(data: Uint8Array) {
  // The message, a 1 bit, zeros up to a 64-byte boundary, then its length in bits.
  const padded = new Uint8Array(((data.length + 8) >> 6 << 6) + 64);
  padded.set(data);
  padded[data.length] = 0x80;
  const view = new DataView(padded.buffer);
  view.setUint32(padded.length - 8, Math.floor((data.length * 8) / 2 ** 32));
  view.setUint32(padded.length - 4, (data.length * 8) >>> 0);

  const h = [0x67452301, 0xefcdab89, 0x98badcfe, 0x10325476, 0xc3d2e1f0];
  const w = new Array<number>(80);
  for (let block = 0; block < padded.length; block += 64) {
    for (let t = 0; t < 16; t++) w[t] = view.getUint32(block + t * 4);
    for (let t = 16; t < 80; t++) w[t] = rotl(w[t - 3]! ^ w[t - 8]! ^ w[t - 14]! ^ w[t - 16]!, 1);
    let [a, b, c, d, e] = h as [number, number, number, number, number];
    for (let t = 0; t < 80; t++) {
      const [f, k] =
        t < 20 ? [(b & c) | (~b & d), 0x5a827999] : t < 40 ? [b ^ c ^ d, 0x6ed9eba1] : t < 60 ? [(b & c) | (b & d) | (c & d), 0x8f1bbcdc] : [b ^ c ^ d, 0xca62c1d6];
      const next = (rotl(a, 5) + f + e + k + w[t]!) | 0;
      e = d;
      d = c;
      c = rotl(b, 30);
      b = a;
      a = next;
    }
    h[0] = (h[0]! + a) | 0;
    h[1] = (h[1]! + b) | 0;
    h[2] = (h[2]! + c) | 0;
    h[3] = (h[3]! + d) | 0;
    h[4] = (h[4]! + e) | 0;
  }
  const out = new Uint8Array(20);
  const result = new DataView(out.buffer);
  h.forEach((word, i) => result.setUint32(i * 4, word));
  return out;
}

function hmacSha1(key: Uint8Array, msg: Uint8Array) {
  const block = new Uint8Array(64);
  block.set(key.length > 64 ? sha1(key) : key);
  const inner = new Uint8Array(64 + msg.length);
  inner.set(block.map((b) => b ^ 0x36));
  inner.set(msg, 64);
  const outer = new Uint8Array(84);
  outer.set(block.map((b) => b ^ 0x5c));
  outer.set(sha1(inner), 64);
  return sha1(outer);
}

/**
 * The 6-digit code an authenticator app shows for this secret at time `at`.
 * Not crypto.subtle: browsers remove it on plain http, such as testing on a phone at a network address.
 */
export function totpCode(secret: string, at = Date.now()) {
  const counter = Math.floor(at / 30_000);
  const msg = new Uint8Array(8);
  new DataView(msg.buffer).setUint32(4, counter);
  new DataView(msg.buffer).setUint32(0, Math.floor(counter / 2 ** 32));
  const mac = hmacSha1(base32Decode(secret), msg);
  const offset = mac[mac.length - 1]! & 0x0f;
  const n = ((mac[offset]! & 0x7f) << 24) | (mac[offset + 1]! << 16) | (mac[offset + 2]! << 8) | mac[offset + 3]!;
  return String(n % 1_000_000).padStart(6, '0');
}
