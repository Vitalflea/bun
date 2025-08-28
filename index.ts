import { serve } from "bun";
import { fetchJson } from "./networking.ts";
import { decodeJwt } from "./JsonUtils.ts";
import pako from "pako";
import { writeFile, mkdir } from "fs/promises";
import { dirname, join } from "path";
import { archiveBinary } from "./archive";

const HOST = "https://jagex.akamaized.net";
const WINDOWS = `${HOST}/direct6/osrs-win`;
const BOOTSTRAP = `${WINDOWS}/osrs-win.json`;
const CATALOG = (id: string) => `${WINDOWS}/catalog/${id}/catalog.json`;
const BIN = "/home/vitalflea/binaries";

function stringToHexString(input: Uint8Array | Buffer): string {
  return Array.from(input)
    .map(b => b.toString(16).padStart(2, "0"))
    .join("");
}

async function saveBinary(manifest: any, binaryId: string, version: string, data: Uint8Array) {

	let offset = 0;

  for (const file of manifest.files) {

    const fileName: string = file.name;
    const fileSize: number = file.size;

    if (fileName.includes("discord")) {
      offset += fileSize;
      continue;
    }

    const fileBytes = data.slice(offset, offset + fileSize);
    offset += fileSize;
  const outputDir = join(process.cwd(), "binaries");
  await mkdir(outputDir, { recursive: true });

  const path = join(outputDir, `${binaryId}-${version}.bin`);
   await writeFile(path, fileBytes);

  archiveBinary(binaryId, version, path);
  console.log(`Archived ${binaryId} v${version} → ${path}`);
}
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

function formatPiece(template: string, vars: Record<string, string>) {

  template = template.replace(/\{SubString:(\d+),(\d+),\{(\w+)\}\}/g, (_, start, end, varName) => {
    const value = vars[varName];
    if (!value) {
		throw new Error(`Missing variable: ${varName}`);
	}
    return value.substring(Number(start), Number(end));
  });

  template = template.replace(/\{(\w+)\}/g, (_, varName) => {
    const value = vars[varName];
    if (!value) {
		throw new Error(`Missing variable: ${varName}`);
	}
    return value;
  });

  return template;
}

function decodeDigest(digestB64: string): string {

	let base64 = digestB64.replace(/-/g, "+").replace(/_/g, "/");
	base64 = base64.padEnd(Math.ceil(base64.length / 4) * 4, "=");

	const bytes = Buffer.from(base64, "base64");
	
	return bytes.toString("hex");
}

async function processPieces(metafile: any, remote: any): Promise<Uint8Array> {
  const digests: string[] = metafile?.pieces?.digests;
	if (!digests) {
		throw new Error("No digests found in manifest");
	}

  const decompressedChunks: Uint8Array[] = [];

  for (const digest of digests) {
    const TargetDigest = decodeDigest(digest);
	const pieceUrl = `${remote.baseUrl}${formatPiece(remote.pieceFormat, { TargetDigest })}`;

    console.log(pieceUrl);
    const resp = await fetch(pieceUrl);
    if (!resp.ok) {
		throw new Error(`Failed to fetch piece: ${resp.status}`);
	}
    const data = new Uint8Array(await resp.arrayBuffer());

    const decompressed = pako.inflate(data.subarray(6));
    decompressedChunks.push(decompressed);
  }

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
     
      const data = await fetchJson(BOOTSTRAP);
      const bootstrap = decodeJwt(data);

      const id: string = bootstrap?.environments?.production?.id;
	  const version: string = bootstrap?.environments?.production?.version;
      if (!id) { 
		throw new Error("ID not found in decoded data");
	  }
      const catalogUrl = CATALOG(id);
      const catalogData = await fetchJson(catalogUrl);
      const catalogDecoded = decodeJwt(catalogData);

      const metafileUrl: string = catalogDecoded?.metafile;
      if (!metafileUrl) {

		throw new Error("Metafile URL not found in catalog");
	  }
      const manifestData = await fetchJson(metafileUrl);
      const manifestDecoded = decodeJwt(manifestData);

      const remote = catalogDecoded?.config?.remote;

      const mergedPieces = await processPieces(manifestDecoded, remote);

	 await saveBinary(manifestDecoded, version, id, mergedPieces);
  	 console.log(`Saved binary ${version} version ${id}`);
     // await saveFiles(manifestDecoded, mergedPieces, BIN);
     
      return new Response(
        JSON.stringify(
          {
            base: bootstrap,
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
