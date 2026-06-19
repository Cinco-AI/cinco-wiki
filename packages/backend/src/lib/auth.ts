import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import type { UserRole } from "@noteshare/shared";
import { LIMITS } from "@noteshare/shared";
import { env } from "./env.js";

const ACCESS_TTL = "15m";
const REFRESH_TTL_DAYS = LIMITS.rememberMeDays;

export interface AccessClaims {
  sub: string; // userId
  role: UserRole;
  typ: "access";
}

export interface RefreshClaims {
  sub: string;
  ver: number; // tokenVersion — doit matcher le doc user
  typ: "refresh";
}

function secret(): Uint8Array {
  return new TextEncoder().encode(env.jwtSecret);
}

export async function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export async function signAccessToken(userId: string, role: UserRole): Promise<string> {
  return new SignJWT({ role, typ: "access" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(ACCESS_TTL)
    .sign(secret());
}

export async function signRefreshToken(
  userId: string,
  tokenVersion: number,
  rememberMe = false,
): Promise<string> {
  const days = rememberMe ? REFRESH_TTL_DAYS : 1;
  return new SignJWT({ ver: tokenVersion, typ: "refresh" })
    .setProtectedHeader({ alg: "HS256" })
    .setSubject(userId)
    .setIssuedAt()
    .setExpirationTime(`${days}d`)
    .sign(secret());
}

export async function verifyAccessToken(token: string): Promise<AccessClaims> {
  const { payload } = await jwtVerify(token, secret());
  if (payload.typ !== "access") throw new Error("Type de token invalide");
  return { sub: payload.sub!, role: payload.role as UserRole, typ: "access" };
}

export async function verifyRefreshToken(token: string): Promise<RefreshClaims> {
  const { payload } = await jwtVerify(token, secret());
  if (payload.typ !== "refresh") throw new Error("Type de token invalide");
  return { sub: payload.sub!, ver: payload.ver as number, typ: "refresh" };
}

/** Mot de passe temporaire lisible montré une fois à l'admin (§3.2). */
export function generateTempPassword(): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
  const bytes = new Uint8Array(12);
  globalThis.crypto.getRandomValues(bytes);
  return Array.from(bytes, (b) => alphabet[b % alphabet.length]).join("");
}
