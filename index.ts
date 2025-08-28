import { serve } from "bun";
import { fetchJson } from "./networking.ts";
import { extractJwt, decodeJwt } from "./JsonUtils.ts";

const HOST = 'https://jagex.akamaized.net/direct6/osrs-win/osrs-win.json';

serve({
  port: 3000,
  async fetch(req) {
    try {
      // Step 1: fetch and decode first file
      const data = await fetchJson(HOST);
      const decoded = decodeJwt(data);

      // Step 2: extract id from decoded
      const id: string = decoded?.environments?.production?.id;
      if (!id) {
        throw new Error("ID not found in decoded data");
      }

      // Step 3: build catalog URL and fetch it
      const catalogUrl = `https://jagex.akamaized.net/direct6/osrs-win/catalog/${id}/catalog.json`;
      const catalogData = await fetchJson(catalogUrl);
      const catalogDecoded = decodeJwt(catalogData);

      // Step 4: return combined result
      return new Response(
        JSON.stringify(
          { base: decoded, catalog: catalogDecoded },
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
