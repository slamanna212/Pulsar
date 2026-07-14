#!/usr/bin/env node
// Downloads the mpv binaries bundled with Apogee so the app never depends on
// a system-installed mpv. Windows has no package manager to depend on at
// all, so it's always bundled. Linux bundles it too (on top of also
// declaring `mpv` as a package dependency for .deb/.rpm - see
// src-tauri/tauri.conf.json's bundle.linux.deb/rpm.depends - as a harmless
// extra safety net) since CI builds deb/rpm/AppImage in a single pass and
// there's no per-format way to bundle only for AppImage without splitting
// that into a separate build invocation. macOS relies on the user installing
// mpv via Homebrew and gets a clear in-app error message if it's missing
// instead - see the plan this implements for why it isn't bundled there.
//
// Invoked automatically from tauri.conf.json's beforeBuildCommand via
// `node scripts/fetch-mpv.mjs auto`, which detects the host platform. Can
// also be run directly with an explicit target: `windows`, `linux`, or `all`.
//
// Windows: official shinchiro mpv build, distributed as a .7z archive via
// SourceForge (linked from https://mpv.io/installation/). Extracted with the
// `7zip-min` devDependency so no system 7z/7-Zip install is required.
//
// Linux: mpv has no official static/portable Linux build (see
// https://github.com/mpv-player/mpv/issues/4056). This uses the community
// "anylinux" build from pkgforge-dev/mpv-AppImage, which is itself a
// directly-runnable, dependency-free portable executable (built with
// "sharun", no FUSE/extraction required) - so it's used as-is as our bundled
// `mpv` binary, not unpacked.

import {
  createWriteStream,
  createReadStream,
  existsSync,
  mkdirSync,
  chmodSync,
  unlinkSync,
  renameSync,
  rmSync,
  readFileSync,
  writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { pipeline } from 'node:stream/promises';
import { Readable } from 'node:stream';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import sevenzip from '7zip-min';
// Node's built-in global fetch (a frozen vendored undici) hits a known
// assertion crash - "assert(!this.paused)" in Parser.finish - when a
// streamed download's destination write backpressures while the socket
// ends (nodejs/undici#5360, fixed in the standalone undici package at
// 8.4.1+). The fix hasn't landed in Node 24's bundled undici yet, so use
// the actively-maintained npm package here instead of the ambient global.
import { fetch } from 'undici';

const __dirname = dirname(fileURLToPath(import.meta.url));
const BINARIES_DIR = join(__dirname, '..', 'src-tauri', 'binaries');

const TARGETS = {
  windows: {
    url: 'https://sourceforge.net/projects/mpv-player-windows/files/release/mpv-0.41.0-x86_64.7z/download',
    sha256: 'ef86fde0959d789d77a3ad7c3c2dca51c6999695363f493a6154f2c518634c0f',
    outputName: 'mpv.exe',
    archiveEntry: 'mpv.exe',
  },
  linux: {
    url: 'https://github.com/pkgforge-dev/mpv-AppImage/releases/download/v0.41.0%402026-07-01_1782914175/mpv-v0.41.0-anylinux-x86_64.AppImage',
    sha256: '9ba489eb78c39fa4d5ef9cfaf9e80b92dcb9f69a05dd365d30255e6dca3c8fbd',
    outputName: 'mpv',
    // The pkgforge-dev "anylinux" build is produced with AppImage tooling and
    // ships two embedded ELF sections that AppImage desktop integrations
    // (AppImageLauncher, Gear Lever, appimaged, etc.) read to offer
    // self-updates: `.upd_info` (a zsync feed pointing at this project's
    // GitHub releases) and `.sig_key`. Since we bundle and version this
    // binary ourselves, that's exactly the "should mpv check for updates?"
    // popup users were seeing - strip both sections so the shipped binary
    // carries no update metadata at all.
    stripAppImageUpdateInfo: true,
  },
};

// macOS has no bundled target - it relies on a system mpv (Homebrew) and a
// clear in-app error message if it's missing, so `auto` is a no-op there.
const AUTO_TARGETS_BY_PLATFORM = {
  win32: ['windows'],
  linux: ['linux'],
  darwin: [],
};

// Zeroes the *content* of named ELF sections in place, without touching the
// file's total length or moving any other bytes. This matters specifically
// because a type-2 AppImage is an ELF executable with a squashfs filesystem
// image appended directly after it, as raw bytes outside any ELF section -
// running `objcopy --remove-section` on one (as this script used to)
// rewrites/relinks the whole file from its section table and silently
// discards that trailing, non-section-owned squashfs payload, corrupting the
// AppImage down to a fraction of its real size ("SquashFS or DwarFS image
// not found" at runtime). Zeroing the two small sections' bytes in place
// achieves the same goal (the update metadata is no longer readable) while
// guaranteeing every other byte - including the appended squashfs - is
// preserved untouched.
function zeroElfSections(filePath, sectionNames) {
  const buf = readFileSync(filePath);

  if (buf.readUInt32LE(0) !== 0x464c457f) {
    throw new Error(`${filePath}: not an ELF file (bad magic)`);
  }
  if (buf[4] !== 2) {
    throw new Error(`${filePath}: expected a 64-bit ELF (EI_CLASS)`);
  }
  if (buf[5] !== 1) {
    throw new Error(`${filePath}: expected a little-endian ELF (EI_DATA)`);
  }

  const shoff = Number(buf.readBigUInt64LE(0x28));
  const shentsize = buf.readUInt16LE(0x3a);
  const shnum = buf.readUInt16LE(0x3c);
  const shstrndx = buf.readUInt16LE(0x3e);

  const shstrtabHeader = shoff + shstrndx * shentsize;
  const shstrtabOffset = Number(buf.readBigUInt64LE(shstrtabHeader + 24));

  const readCString = (offset) => {
    let end = offset;
    while (buf[end] !== 0) end++;
    return buf.toString('utf8', offset, end);
  };

  let zeroedCount = 0;
  for (let i = 0; i < shnum; i++) {
    const shdr = shoff + i * shentsize;
    const nameOffset = buf.readUInt32LE(shdr);
    const name = readCString(shstrtabOffset + nameOffset);
    if (!sectionNames.includes(name)) continue;

    const dataOffset = Number(buf.readBigUInt64LE(shdr + 24));
    const dataSize = Number(buf.readBigUInt64LE(shdr + 32));
    buf.fill(0, dataOffset, dataOffset + dataSize);
    zeroedCount++;
  }

  if (zeroedCount === 0) {
    throw new Error(`${filePath}: none of [${sectionNames.join(', ')}] found in ELF section headers`);
  }

  writeFileSync(filePath, buf);
  return zeroedCount;
}

async function download(url, destPath) {
  const res = await fetch(url, { redirect: 'follow' });
  if (!res.ok) throw new Error(`download failed: ${res.status} ${res.statusText} (${url})`);
  await pipeline(Readable.fromWeb(res.body), createWriteStream(destPath));
}

async function verifiedFetch(name, target) {
  const finalPath = join(BINARIES_DIR, target.outputName);
  if (existsSync(finalPath)) {
    console.log(`[fetch-mpv] ${name}: ${finalPath} already present, skipping`);
    return;
  }

  mkdirSync(BINARIES_DIR, { recursive: true });
  const downloadPath = join(BINARIES_DIR, `.download-${name}`);
  console.log(`[fetch-mpv] ${name}: downloading ${target.url}`);
  await download(target.url, downloadPath);

  const actualHash = await new Promise((resolve, reject) => {
    const hash = createHash('sha256');
    const stream = createReadStream(downloadPath);
    stream.on('data', (chunk) => hash.update(chunk));
    stream.on('end', () => resolve(hash.digest('hex')));
    stream.on('error', reject);
  });

  if (actualHash !== target.sha256) {
    unlinkSync(downloadPath);
    throw new Error(
      `[fetch-mpv] ${name}: checksum mismatch (expected ${target.sha256}, got ${actualHash}) - refusing to use this file`,
    );
  }

  if (target.archiveEntry) {
    // Windows build ships as a .7z archive - extract just the binary we need.
    const extractDir = join(BINARIES_DIR, `.extract-${name}`);
    mkdirSync(extractDir, { recursive: true });
    await new Promise((resolve, reject) => {
      sevenzip.unpack(downloadPath, extractDir, (err) => (err ? reject(err) : resolve()));
    });
    renameSync(join(extractDir, target.archiveEntry), finalPath);
    rmSync(extractDir, { recursive: true, force: true });
    unlinkSync(downloadPath);
  } else {
    // Linux build is a directly-runnable portable executable - use as-is.
    renameSync(downloadPath, finalPath);
  }

  if (target.stripAppImageUpdateInfo) {
    try {
      zeroElfSections(finalPath, ['.upd_info', '.sig_key']);
      console.log(`[fetch-mpv] ${name}: zeroed embedded AppImage update-info sections`);
    } catch (err) {
      throw new Error(`[fetch-mpv] ${name}: failed to zero AppImage update-info sections: ${err.message}`);
    }
  }

  chmodSync(finalPath, 0o755);
  console.log(`[fetch-mpv] ${name}: wrote ${finalPath}`);
}

const requested = process.argv[2] ?? 'auto';

let names;
if (requested === 'auto') {
  names = AUTO_TARGETS_BY_PLATFORM[process.platform] ?? [];
  if (names.length === 0) {
    console.log(`[fetch-mpv] auto: no bundled mpv target for platform "${process.platform}", nothing to fetch`);
  }
} else if (requested === 'all') {
  names = Object.keys(TARGETS);
} else {
  names = [requested];
}

for (const name of names) {
  const target = TARGETS[name];
  if (!target) {
    console.error(`[fetch-mpv] unknown target "${name}" (expected one of: ${Object.keys(TARGETS).join(', ')}, auto, all)`);
    process.exit(1);
  }
  await verifiedFetch(name, target);
}
