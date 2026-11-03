import { createHash, randomBytes } from "crypto";
import { cookies } from "next/headers";
import type { Role } from "@/generated/prisma/client";
import { db } from "./db";

import { hashPassword, verifyPassword } from "./password";
export { hashPassword, verifyPassword };

const COOKIE = "pf_session";
const SESSION_HOURS = 8;


const sha = (s: string) => createHash("sha256").update(s).digest("hex");

export async function createSession(userId: string, ip?: string, userAgent?: string) {
  const token = randomBytes(32).toString("base64url");
  await db.session.create({
    data: { userId, tokenHash: sha(token), ip, userAgent, expiresAt: new Date(Date.now() + SESSION_HOURS * 3600_000) },
  });
  cookies().set(COOKIE, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_HOURS * 3600,
  });
}

export async function destroySession() {
  const token = cookies().get(COOKIE)?.value;
  if (token) await db.session.deleteMany({ where: { tokenHash: sha(token) } });
  cookies().delete(COOKIE);
}

export async function currentUser() {
  const token = cookies().get(COOKIE)?.value;
  if (!token) return null;
  const s = await db.session.findUnique({
    where: { tokenHash: sha(token) },
    include: { user: { include: { member: true } } },
  });
  if (!s || s.expiresAt < new Date() || s.user.status === "SUSPENDED" || s.user.status === "CLOSED") return null;
  return s.user;
}

export class HttpError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

export async function requireUser(roles?: Role[]) {
  const u = await currentUser();
  if (!u) throw new HttpError(401, "Not authenticated");
  if (roles && !roles.includes(u.role)) throw new HttpError(403, "Forbidden");
  return u;
}

export const STAFF_ROLES: Role[] = ["KYC_OFFICER", "FINANCE_OFFICER", "FINANCE_APPROVER", "LOAN_OFFICER", "COMMITTEE", "ADMIN", "AUDITOR"];

export async function requireApprovedMember() {
  const u = await requireUser(["MEMBER"]);
  if (!u.member || u.member.kycStatus !== "APPROVED") throw new HttpError(403, "KYC approval required");
  return { user: u, member: u.member };
}
