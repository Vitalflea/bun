import { serve } from "bun";
import db, { User } from "./db";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import { join } from "path";

const SECRET = "your_jwt_secret";

interface JWTPayload {
  id: number;
  username: string;
}

function generateToken(user: User): string {
  return jwt.sign({ id: user.id, username: user.username }, SECRET, { expiresIn: "1h" });
}

function authenticateToken(token: string): JWTPayload | null {
  try {
    return jwt.verify(token, SECRET) as JWTPayload;
  } catch {
    return null;
  }
}

const htmlPath = Bun.file("public/index.html");

serve({
  port: 3000,
  async fetch(req: Request) {
    try {
      // Safely parse URL
      let url: URL;
      try {
        url = new URL(req.url, `http://${req.headers.get("host")}`);
      } catch {
        return new Response("Invalid URL", { status: 400 });
      }

      // Serve static HTML page
      if (req.method === "GET" && url.pathname === "/") {
        return new Response(await htmlPath.text(), {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Register route
      if (req.method === "POST" && url.pathname === "/register") {
        let form: FormData;
        try {
          form = await req.formData();
        } catch {
          return new Response("Invalid form data", { status: 400 });
        }

        const username = form.get("username")?.toString().trim() ?? "";
        const password = form.get("password")?.toString() ?? "";

        if (!username || !password) return new Response("Missing fields", { status: 400 });

        const hashed = await bcrypt.hash(password, 10);

        try {
          db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(username, hashed);
          return new Response("User registered successfully!");
        } catch {
          return new Response("Username already exists or database error", { status: 400 });
        }
      }

      // Login route
      if (req.method === "POST" && url.pathname === "/login") {
        let form: FormData;
        try {
          form = await req.formData();
        } catch {
          return new Response("Invalid form data", { status: 400 });
        }

        const username = form.get("username")?.toString().trim() ?? "";
        const password = form.get("password")?.toString() ?? "";

        if (!username || !password) return new Response("Missing fields", { status: 400 });

        const user: User | undefined = db.prepare("SELECT * FROM users WHERE username = ?").get(username);

        if (!user) return new Response("Invalid credentials", { status: 401 });

        const match = await bcrypt.compare(password, user.password);
        if (!match) return new Response("Invalid credentials", { status: 401 });

        const token = generateToken(user);
        return new Response(JSON.stringify({ token }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Protected route
      if (req.method === "GET" && url.pathname === "/profile") {
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.split(" ")[1];

        if (!token) return new Response("Unauthorized", { status: 401 });

        const user = authenticateToken(token);
        if (!user) return new Response("Unauthorized", { status: 401 });

        return new Response(`Welcome ${user.username}! This is your profile.`);
      }

      return new Response("Not found", { status: 404 });

    } catch (err) {
      console.error("Server error:", err);
      return new Response("Internal Server Error", { status: 500 });
    }
  },
});

console.log("Server running on http://localhost:3000");
