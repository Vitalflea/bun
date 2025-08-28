import { serve } from "bun";
import { fetchJson } from "./networking.ts";
import { decodeJwt } from "./JsonUtils.ts";
import { decode as base64Decode } from "js-base64";
import pako from "pako";
import { writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { join } from "path";
import os from "os";

const HOST = 'https://jagex.akamaized.net/direct6/osrs-win/osrs-win.json';
const BIN = "/home/vitalflea/binaries";

// convert Uint8Array/Buffer to hex string (C++ equivalent of stringToHexString)
function stringToHexString(input: Uint8Array | Buffer): string {
  return Array.from(input)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}


async function saveFiles(manifest: any, mergedPieces: Uint8Array, outputDir: string) {
  let offset = 0;

  for (const file of manifest.files) {
    const fileName: string = file.name;
    const fileSize: number = file.size;

    if (fileName.includes("discord")) {
      offset += fileSize;
      continue;
    }

    const fileBytes = mergedPieces.slice(offset, offset + fileSize);
    offset += fileSize;

    const outPath = join(outputDir, fileName);
    await mkdir(dirname(outPath), { recursive: true });

    await writeFile(outPath, fileBytes);

    console.log(`Saved ${fileName} (${fileSize} bytes) → ${outPath}`);
  }
}

function decodeDigest(digestB64: string): string {

	let base64 = digestB64.replace(/-/g, "+").replace(/_/g, "/");
	base64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

	const bytes = Buffer.from(base64, "base64");
	
	return bytes.toString("hex");
}

// process all pieces
async function processPieces(metafile: any, baseUrl: string): Promise<Uint8Array> {
  const digests: string[] = metafile?.pieces?.digests;
  if (!digests) throw new Error("No digests found in manifest");

  const decompressedChunks: Uint8Array[] = [];

  for (const digestB64 of digests) {
    const hexDigest = decodeDigest(digestB64);
    const pieceUrl = `${baseUrl}/direct6/osrs-win/pieces/${hexDigest.substring(0, 2)}/${hexDigest}.solidpiece`;

    console.log(pieceUrl);
    const resp = await fetch(pieceUrl, { insecure: true });
    if (!resp.ok) throw new Error(`Failed to fetch piece: ${resp.status}`);
    const data = new Uint8Array(await resp.arrayBuffer());

    // skip first 6 bytes, decompress gzip
    const decompressed = pako.inflate(data.subarray(6));
    decompressedChunks.push(decompressed);
  }

  // merge all chunks into one Uint8Array
  const totalLength = decompressedChunks.reduce((n, arr) => n + arr.length, 0);
  const merged = new Uint8Array(totalLength);
  let offset = 0;
  for (const arr of decompressedChunks) {
    merged.set(arr, offset);
    offset += arr.length;
  }

  return merged;
}


serve({
  port: 3000,
  async fetch(req) {
    try {
      // Step 1: base
      const data = await fetchJson(HOST);
      const decoded = decodeJwt(data);

      // Step 2: catalog
      const id: string = decoded?.environments?.production?.id;
      if (!id) throw new Error("ID not found in decoded data");
      const catalogUrl = `https://jagex.akamaized.net/direct6/osrs-win/catalog/${id}/catalog.json`;
      const catalogData = await fetchJson(catalogUrl);
      const catalogDecoded = decodeJwt(catalogData);

      // Step 3: manifest
      const metafileUrl: string = catalogDecoded?.metafile;
      if (!metafileUrl) throw new Error("Metafile URL not found in catalog");
      const manifestData = await fetchJson(metafileUrl);
      const manifestDecoded = decodeJwt(manifestData);

      // Step 4: process 
      const baseUrlFull: string = catalogDecoded?.config?.remote?.baseUrl;

      const baseUrl = baseUrlFull.split("/direct6/osrs-win/")[0]; // strip suffix
      if (!baseUrl) throw new Error("Base URL not found in catalog config");
      const mergedPieces = await processPieces(manifestDecoded, baseUrl);

		
      await saveFiles(manifestDecoded, mergedPieces, BIN);
      // Return sizes only (raw Uint8Array too large for JSON)
      return new Response(
        JSON.stringify(
          {
            base: decoded,
            catalog: catalogDecoded,
            manifest: manifestDecoded,
            mergedPiecesSize: mergedPieces.length
          },
          null,
          2
        ),
        { headers: { "Content-Type": "application/json" } }
      );
    } catch (err) {
      return new Response(`Error: ${err}`, { status: 500 });
    }
  },
});

console.log("✅ Server running at http://localhost:3000");
