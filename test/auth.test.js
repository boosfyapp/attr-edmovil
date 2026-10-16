import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createAuth, createLimiter, hashPassword, verifyPassword } from "../server/lib/auth.js";
import { tmpDir } from "./helpers.js";

describe("hash de contraseña", () => {
  it("verifica la correcta y rechaza la incorrecta", () => {
    const h = hashPassword("una-clave-larga-1");
    assert.ok(verifyPassword("una-clave-larga-1", h));
    assert.equal(verifyPassword("otra", h), false);
    assert.equal(verifyPassword("x", "basura"), false);
  });
  it("usa sal distinta cada vez", () => {
    assert.notEqual(hashPassword("a1234567890"), hashPassword("a1234567890"));
  });
});

describe("limitador", () => {
  it("bloquea tras 5 fallos y libera al pasar la ventana", () => {
    let t = 1_000_000;
    const limiter = createLimiter({ max: 5, windowMs: 900_000, now: () => t });
    for (let i = 0; i < 5; i++) {
      assert.equal(limiter.check("ip").allowed, true);
      limiter.fail("ip");
      t += 1000;
    }
    const blocked = limiter.check("ip");
    assert.equal(blocked.allowed, false);
    assert.ok(blocked.retryAfter > 0 && blocked.retryAfter <= 900);
    assert.equal(limiter.check("otra-ip").allowed, true);
    t += 900_000;
    assert.equal(limiter.check("ip").allowed, true);
  });
  it("reset limpia los fallos", () => {
    const limiter = createLimiter({ max: 2 });
    limiter.fail("ip"); limiter.fail("ip");
    assert.equal(limiter.check("ip").allowed, false);
    limiter.reset("ip");
    assert.equal(limiter.check("ip").allowed, true);
  });
});

describe("auth", () => {
  it("sin contraseña configurada está deshabilitada", () => {
    const auth = createAuth({ dataDir: tmpDir(), envPassword: "" });
    assert.equal(auth.enabled(), false);
    assert.equal(auth.checkPassword("lo-que-sea"), false);
  });

  it("acepta la contraseña del entorno y rechaza otras", () => {
    const auth = createAuth({ dataDir: tmpDir(), envPassword: "clave-del-entorno" });
    assert.ok(auth.enabled());
    assert.ok(auth.checkPassword("clave-del-entorno"));
    assert.equal(auth.checkPassword("clave-del-entornO"), false);
    assert.equal(auth.checkPassword(""), false);
    assert.equal(auth.checkPassword(undefined), false);
  });

  it("emite y verifica tokens; rechaza manipulados y expirados", () => {
    let t = 5_000_000;
    const auth = createAuth({ dataDir: tmpDir(), envPassword: "x", now: () => t });
    const token = auth.issueToken();
    assert.ok(auth.verifyToken(token));
    const parts = token.split(".");
    assert.equal(auth.verifyToken(`${Number(parts[0]) + 1000}.${parts.slice(1).join(".")}`), false);
    assert.equal(auth.verifyToken(`${token}x`), false);
    assert.equal(auth.verifyToken("a.b.c.d"), false);
    assert.equal(auth.verifyToken(undefined), false);
    t += 12 * 3600 * 1000 + 1;
    assert.equal(auth.verifyToken(token), false);
  });

  it("el secreto persiste entre instancias (mismo dataDir)", () => {
    const dir = tmpDir();
    const a = createAuth({ dataDir: dir, envPassword: "x" });
    const token = a.issueToken();
    assert.ok(createAuth({ dataDir: dir, envPassword: "x" }).verifyToken(token));
    assert.equal(createAuth({ dataDir: tmpDir(), envPassword: "x" }).verifyToken(token), false);
  });

  it("cambiar contraseña: exige la actual, prevalece sobre el entorno e invalida sesiones", () => {
    const dir = tmpDir();
    const auth = createAuth({ dataDir: dir, envPassword: "clave-del-entorno" });
    const token = auth.issueToken();
    assert.throws(() => auth.changePassword("mala", "nueva-clave-segura"), /actual/);
    assert.throws(() => auth.changePassword("clave-del-entorno", "corta"), /al menos/);
    auth.changePassword("clave-del-entorno", "nueva-clave-segura");
    assert.equal(auth.checkPassword("clave-del-entorno"), false);
    assert.ok(auth.checkPassword("nueva-clave-segura"));
    assert.equal(auth.verifyToken(token), false);
    assert.ok(auth.verifyToken(auth.issueToken()));
    assert.ok(createAuth({ dataDir: dir, envPassword: "" }).enabled());
  });
});
