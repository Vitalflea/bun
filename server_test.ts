import { serve } from "bun";
import db, { type User } from "./db";
import jwt from "jsonwebtoken";
import bcrypt from "bcrypt";
import 'dotenv/config';

const SECRET = process.env.JWT_SECRET ?? (() => {
  throw new Error("JWT_SECRET must be set in environment variables");
})();

interface JWTPayload {
  id: number;
  username: string;
}

function generateToken(user: User): string {
  return jwt.sign(
    { id: user.id, username: user.username },
    SECRET,
    { expiresIn: "1h" }
  );
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
      let url: URL;
      try {
        // safer: don't trust Host header
        url = new URL(req.url, "http://localhost");
      } catch {
        return new Response("Invalid URL", { status: 400 });
      }

      // Serve homepage
      if (req.method === "GET" && url.pathname === "/") {
        return new Response(await htmlPath.text(), {
          headers: { "Content-Type": "text/html" },
        });
      }

      // Register new user
      if (req.method === "POST" && url.pathname === "/register") {
        let form: FormData;
        try {
          form = await req.formData();
        } catch {
          return new Response("Invalid form data", { status: 400 });
        }

        const username = form.get("username")?.toString().trim() ?? "";
        const password = form.get("password")?.toString() ?? "";

        if (!username || !password) {
          return new Response("Missing fields", { status: 400 });
        }

        if (password.length < 8) {
          return new Response("Password must be at least 8 characters long", {
            status: 400,
          });
        }

        const hashed = await bcrypt.hash(password, 10);

        try {
          db.prepare("INSERT INTO users (username, password) VALUES (?, ?)").run(
            username,
            hashed,
          );
          return new Response("User registered successfully!");
        } catch (err: any) {
          if (err?.message?.includes("UNIQUE constraint failed")) {
            return new Response("Username already exists", { status: 400 });
          }
          console.error("Database error:", err);
          return new Response("Database error", { status: 500 });
        }
      }

      // Login
      if (req.method === "POST" && url.pathname === "/login") {
        let form: FormData;
        try {
          form = await req.formData();
        } catch {
          return new Response("Invalid form data", { status: 400 });
        }

        const username = form.get("username")?.toString().trim() ?? "";
        const password = form.get("password")?.toString() ?? "";

        if (!username || !password) {
          return new Response("Missing fields", { status: 400 });
        }

        const user: User | undefined = db
          .prepare("SELECT * FROM users WHERE username = ?")
          .get(username);

        if (!user) {
          return new Response("Invalid credentials", { status: 401 });
        }

        const match = await bcrypt.compare(password, user.password);
        if (!match) {
          return new Response("Invalid credentials", { status: 401 });
        }

        const token = generateToken(user);
        return new Response(JSON.stringify({ token }), {
          headers: { "Content-Type": "application/json" },
        });
      }

      // Protected profile route
      if (req.method === "GET" && url.pathname === "/profile") {
        const authHeader = req.headers.get("Authorization") || "";
        const token = authHeader.startsWith("Bearer ")
          ? authHeader.slice(7)
          : null;

        if (!token) {
          return new Response("Unauthorized", { status: 401 });
        }

        const user = authenticateToken(token);
        if (!user) {
          return new Response("Unauthorized", { status: 401 });
        }

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
