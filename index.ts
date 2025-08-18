import { serve } from 'bun';
import jwtDecode from 'jwt-decode';

const JWT_URL = 'https://jagex.akamaized.net/direct6/osrs-win/osrs-win.json';

interface DecodedToken {
    [key: string]: any;
}

serve({
    port: 3000,
    async fetch(req) {
        try {
            const response = await fetch(JWT_URL);
            const token = await response.text();
            const decoded: DecodedToken = jwtDecode(token);
            return new Response(JSON.stringify(decoded, null, 2), {
                headers: { 'Content-Type': 'application/json' },
            });
        } catch (err) {
            return new Response(`Error: ${err}`, { status: 500 });
        }
    },
});

console.log('✅ Server running at http://localhost:3000');