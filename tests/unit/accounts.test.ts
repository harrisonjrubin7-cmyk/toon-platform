import { afterAll, describe, expect, it } from "vitest";
import { actorForToken, authenticate, createSession, destroySession, listUsers, setUserDisabled, setUserRole, signup } from "@/lib/domain/accounts";
import { hashPassword, verifyPassword } from "@/lib/auth/password";
import { makeUser, pool, q } from "./helpers";

afterAll(() => pool.end());

describe("passwords", () => {
  it("verifies the right password and rejects the wrong one", async () => {
    const h = await hashPassword("abc123456789");
    expect(await verifyPassword("abc123456789", h)).toBe(true);
    expect(await verifyPassword("abc12345678x", h)).toBe(false);
    expect(await verifyPassword("x", "garbage")).toBe(false);
  });
});

describe("signup and sign in", () => {
  it("rejects bad input with field errors", async () => {
    await expect(signup(q, { email: "nope", displayName: "", password: "short", ageConfirmed: false })).rejects.toMatchObject({
      code: "invalid",
      fields: { email: expect.any(String), displayName: expect.any(String), password: expect.any(String), ageConfirmed: expect.any(String) },
    });
  });

  it("creates a reader, blocks duplicate email (case-insensitive), and signs in", async () => {
    const email = `Case${Date.now()}@Example.com`;
    const a = await signup(q, { email, displayName: "Wren", password: "long enough pw", ageConfirmed: true });
    expect(a.role).toBe("reader");
    expect(a.ageConfirmed).toBe(true);
    await expect(signup(q, { email: email.toLowerCase(), displayName: "x", password: "long enough pw", ageConfirmed: true })).rejects.toMatchObject({ code: "conflict" });
    await expect(authenticate(q, email.toUpperCase(), "long enough pw")).resolves.toMatchObject({ id: a.id });
    await expect(authenticate(q, email, "wrong password")).rejects.toMatchObject({ code: "unauthenticated" });
    await expect(authenticate(q, "missing@example.com", "whatever")).rejects.toMatchObject({ code: "unauthenticated" });
  });

  it("makes ADMIN_EMAILS addresses admins", async () => {
    const email = `boss${Date.now()}@example.com`;
    process.env.ADMIN_EMAILS = `other@example.com, ${email}`;
    const a = await signup(q, { email, displayName: "Boss", password: "long enough pw", ageConfirmed: true });
    expect(a.role).toBe("admin");
    delete process.env.ADMIN_EMAILS;
  });
});

describe("sessions", () => {
  it("resolves a token, then stops after sign out", async () => {
    const u = await makeUser();
    const { token } = await createSession(q, u.id);
    expect((await actorForToken(q, token))?.id).toBe(u.id);
    expect(await actorForToken(q, "forged")).toBeNull();
    await destroySession(q, token);
    expect(await actorForToken(q, token)).toBeNull();
  });

  it("expired sessions are rejected", async () => {
    const u = await makeUser();
    const { token } = await createSession(q, u.id);
    await q.query("update sessions set expires_at = now() - interval '1 minute' where user_id = $1", [u.id]);
    expect(await actorForToken(q, token)).toBeNull();
  });
});

describe("user administration", () => {
  it("only admins can list users and change roles", async () => {
    const reader = await makeUser("reader");
    const editor = await makeUser("editor");
    await expect(listUsers(q, reader)).rejects.toMatchObject({ code: "forbidden" });
    await expect(listUsers(q, editor)).rejects.toMatchObject({ code: "forbidden" });
    await expect(setUserRole(q, editor, reader.id, "admin")).rejects.toMatchObject({ code: "forbidden" });
    await expect(listUsers(q, null)).rejects.toMatchObject({ code: "forbidden" });
  });

  it("admin promotes a reader; the last admin can't be demoted", async () => {
    await q.query("update users set role = 'reader' where role = 'admin'");
    const admin = await makeUser("admin");
    const r = await makeUser("reader");
    await setUserRole(q, admin, r.id, "editor");
    const { rows } = await q.query("select role from users where id = $1", [r.id]);
    expect(rows[0].role).toBe("editor");
    await expect(setUserRole(q, admin, admin.id, "reader")).rejects.toMatchObject({ code: "invalid" });
    await expect(setUserRole(q, admin, r.id, "owner")).rejects.toMatchObject({ code: "invalid" });
  });

  it("disabling a user ends their sessions and blocks sign in", async () => {
    const admin = await makeUser("admin");
    const r = await makeUser("reader");
    const { token } = await createSession(q, r.id);
    await setUserDisabled(q, admin, r.id, true);
    expect(await actorForToken(q, token)).toBeNull();
    await expect(setUserDisabled(q, admin, admin.id, true)).rejects.toMatchObject({ code: "invalid" });
  });
});
