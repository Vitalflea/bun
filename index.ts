import { serve } from "bun";
import { fetchJson } from "./networking.ts";
import { extractJwt, decodeJwt } from "./JsonUtils.ts";

const HOST = 'https://jagex.akamaized.net/direct6/osrs-win/osrs-win.json';

serve({
  port: 3000,
  async fetch(req) {
    try {
     
      const data = await fetchJson(HOST);

        const decoded = decodeJwt(data);

      return new Response(JSON.stringify(decoded, null, 2), {
        headers: { "Content-Type": "application/json" },
      });
    } catch (err) {
      return new Response(`Error: ${err}`, { status: 500 });
    }
  },
});

console.log("✅ Server running at http://localhost:3000");
