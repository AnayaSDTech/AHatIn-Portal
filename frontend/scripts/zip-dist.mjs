// Packs dist/ into ahat-frontend.zip for uploading to Hostinger (npm run build:hostinger).
// Paths inside the zip always use "/" (e.g. "assets/index.js"): Windows' Compress-Archive writes "assets\index.js",
// which Hostinger's Linux servers extract as one file with a backslash in its name instead of an assets folder.
import { readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs';
import { join, relative, sep } from 'node:path';
import { crc32, deflateRawSync } from 'node:zlib';

const root = new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1');
const dist = join(root, 'dist');
const out = join(root, 'ahat-frontend.zip');

function files(dir) {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name);
    return statSync(path).isDirectory() ? files(path) : [path];
  });
}

const local = [];
const central = [];
let offset = 0;
for (const path of files(dist)) {
  const name = Buffer.from(relative(dist, path).split(sep).join('/'), 'utf8');
  const data = readFileSync(path);
  const packed = deflateRawSync(data, { level: 9 });
  const crc = crc32(data);
  const head = Buffer.alloc(30);
  head.writeUInt32LE(0x04034b50, 0); // local file header
  head.writeUInt16LE(20, 4); // version needed
  head.writeUInt16LE(0x0800, 6); // UTF-8 names
  head.writeUInt16LE(8, 8); // deflate
  head.writeUInt32LE(0x00210000, 10); // date/time: 1 Jan 1980
  head.writeUInt32LE(crc, 14);
  head.writeUInt32LE(packed.length, 18);
  head.writeUInt32LE(data.length, 22);
  head.writeUInt16LE(name.length, 26);
  local.push(head, name, packed);

  const entry = Buffer.alloc(46);
  entry.writeUInt32LE(0x02014b50, 0); // central directory header
  entry.writeUInt16LE(0x0314, 4); // made by: Unix, so permissions below apply
  entry.writeUInt16LE(20, 6);
  entry.writeUInt16LE(0x0800, 8);
  entry.writeUInt16LE(8, 10);
  entry.writeUInt32LE(0x00210000, 12);
  entry.writeUInt32LE(crc, 16);
  entry.writeUInt32LE(packed.length, 20);
  entry.writeUInt32LE(data.length, 24);
  entry.writeUInt16LE(name.length, 28);
  entry.writeUInt32LE((0o100644 << 16) >>> 0, 38); // regular file, rw-r--r--
  entry.writeUInt32LE(offset, 42);
  central.push(entry, name);
  offset += head.length + name.length + packed.length;
}

const dir = Buffer.concat(central);
const end = Buffer.alloc(22);
end.writeUInt32LE(0x06054b50, 0); // end of central directory
end.writeUInt16LE(central.length / 2, 8);
end.writeUInt16LE(central.length / 2, 10);
end.writeUInt32LE(dir.length, 12);
end.writeUInt32LE(offset, 16);
writeFileSync(out, Buffer.concat([...local, dir, end]));
console.log(`ahat-frontend.zip: ${central.length / 2} files`);
