import { jwtDecode } from "jwt-decode";

export function decodeJwt(token: string): any {
  if (!token) throw new Error("No token provided");
  return jwtDecode(token);
}

export function extractJwt(json: Record<string, any>, key: string = "response"): string {
  const token = json[key];
  if (!token) throw new Error(`No JWT found under key "${key}"`);
  return token;
}
