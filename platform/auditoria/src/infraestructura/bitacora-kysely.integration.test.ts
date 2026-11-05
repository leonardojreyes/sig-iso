import { randomBytes, randomUUID } from "node:crypto";
import { conTenant, GestorPools, leerUrls, ROLES_BD } from "@sig/db";
import { crearEmpresaId } from "@sig/tenancy";
import { sql } from "kysely";
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { validarEvento } from '../dominio/validacion';
import type { EventoBitacora } from "../dominio/tipos";
import type { AlertasPort } from "../puertos/integridad.port";
import { Bitacora } from "../servicio/bitacora";
import { MantenimientoBitacora } from "../servicio/mantenimiento";
import { BitacoraKysely } from "./bitacora-kysely.adapter";
import { IntegridadKysely } from "./integridad-kysely.adapter";

// Integración con PostgreSQL real. Las filas de la bitácora no se pueden borrar: cada prueba usa empresas y marcas aleatorias.
const hayBase =
  ROLES_BD.every((r) => process.env[`DATABASE_URL_${r.toUpperCase()}`]) &&
  !!process.env.DATABASE_URL_TEST;

describe.skipIf(!hayBase)("BitacoraKysely (PostgreSQL real)", () => {
  const pools = new GestorPools(
    hayBase ? leerUrls(process.env, ROLES_BD, { prueba: true }) : {},
    { max: 6 },
  );
  const app = () => pools.db("app");
  const owner = () => pools.db("owner");
  const puerto = () =>
    new BitacoraKysely({ app: app(), plataforma: pools.db("plataforma") });
  const bitacora = () => new Bitacora(puerto());

  const E = crearEmpresaId(randomUUID());
  const OTRA = crearEmpresaId(randomUUID());
  const USUARIO = randomUUID();
  const traza = () => `t${randomBytes(6).toString("hex")}`;
  const origen = () => `o:${randomBytes(8).toString("hex")}`;
  const tabla = `prueba_auditoria_${randomBytes(4).toString("hex")}`;

  const evento = (cambios: Partial<EventoBitacora> = {}): EventoBitacora => ({
    empresaId: E,
    actor: { tipo: "usuario", usuarioId: USUARIO },
    accion: "login.ok",
    resultado: "ok",
    traceId: traza(),
    ...cambios,
  });
  const filas = async (traceId: string) =>
    (
      await sql<
        Record<string, unknown>
      >`select empresa_id, actor_tipo, usuario_id, accion, objeto, objeto_version, resultado, motivo, trace_id, origen_id, antes, despues, secuencia, creada_en from bitacora where trace_id = ${traceId}`.execute(
        owner(),
      )
    ).rows;

  beforeAll(async () => {
    // Tabla de apoyo SIN RLS, para comprobar que la acción se revierte si no se puede registrar.
    await sql
      .raw(`create table public.${tabla} (id int primary key)`)
      .execute(owner());
    await sql
      .raw(`grant select, insert on public.${tabla} to sigiso_app`)
      .execute(owner());
  });

  afterAll(async () => {
    if (!tabla.startsWith("prueba_auditoria_"))
      throw new Error("Limpieza rechazada: nombre inesperado");
    await sql.raw(`drop table if exists public.${tabla}`).execute(owner());
    await pools.cerrar();
  });

  describe("escritura autónoma (su propia transacción)", () => {
    it("registra un hecho de empresa con todos sus campos", async () => {
      const ev = evento({
        accion: "libreria.adoptada",
        objeto: "libreria:ejemplo-estructura-armonizada",
        objetoVersion: "1.0.0",
        antes: { adoptada: false },
        despues: { adoptada: true, entradas: 21 },
        origenId: origen(),
      });
      await bitacora().registrar(ev);
      const [f] = await filas(ev.traceId!);
      expect(f).toMatchObject({
        empresa_id: E,
        actor_tipo: "usuario",
        usuario_id: USUARIO,
        accion: "libreria.adoptada",
        objeto: "libreria:ejemplo-estructura-armonizada",
        objeto_version: "1.0.0",
        resultado: "ok",
        motivo: null,
        trace_id: ev.traceId,
        origen_id: ev.origenId,
        antes: { adoptada: false },
        despues: { adoptada: true, entradas: 21 },
      });
      expect(Number(f!.secuencia)).toBeGreaterThanOrEqual(1);
      expect(f!.creada_en).toBeInstanceOf(Date);
    });

    it("registra un hecho de plataforma con el rol de plataforma (sin empresa)", async () => {
      const ev = evento({
        empresaId: null,
        actor: { tipo: "plataforma" },
        accion: "catalogo.cargado",
        objeto: "libreria:ejemplo",
        objetoVersion: "1.0.0",
        despues: { entradas: 21 },
      });
      await bitacora().registrar(ev);
      const [f] = await filas(ev.traceId!);
      expect(f).toMatchObject({
        empresa_id: null,
        actor_tipo: "plataforma",
        usuario_id: null,
        accion: "catalogo.cargado",
      });
    });

    it("un evento inválido no escribe nada", async () => {
      const ev = evento({ motivo: "sin_permiso" });
      await expect(bitacora().registrar(ev)).rejects.toThrow(/no válido/);
      expect(await filas(ev.traceId!)).toEqual([]);
    });
  });

  describe("misma transacción que la acción (H6.8)", () => {
    it("si la acción falla después de registrar, el registro se revierte con ella", async () => {
      const ev = evento();
      await expect(
        conTenant(app(), E, async (trx) => {
          await new Bitacora(BitacoraKysely.enTransaccion(trx)).registrar(ev);
          throw new Error("la acción falló");
        }),
      ).rejects.toThrow("la acción falló");
      expect(await filas(ev.traceId!)).toEqual([]);
    });

    it("si la acción termina bien, el registro se confirma con ella", async () => {
      const ev = evento();
      await conTenant(app(), E, (trx) =>
        new Bitacora(BitacoraKysely.enTransaccion(trx)).registrar(ev),
      );
      expect(await filas(ev.traceId!)).toHaveLength(1);
    });

    it("si NO se puede registrar, la acción no se completa", async () => {
      const repetido = origen();
      await bitacora().registrar(evento({ origenId: repetido }));
      await expect(
        conTenant(app(), E, async (trx) => {
          await sql
            .raw(`insert into public.${tabla} (id) values (1)`)
            .execute(trx); // la "acción"
          await new Bitacora(BitacoraKysely.enTransaccion(trx)).registrar(
            evento({ origenId: repetido }),
          ); // el registro falla
        }),
      ).rejects.toThrow(/duplicate key|unique/i);
      const r = await sql<{
        n: number;
      }>`select count(*)::int as n from ${sql.table(tabla)}`.execute(owner());
      expect(r.rows[0]?.n).toBe(0);
    });

    it("una transacción de una empresa no puede registrar hechos de otra", async () => {
      await expect(
        conTenant(app(), E, (trx) =>
          new Bitacora(BitacoraKysely.enTransaccion(trx)).registrar(
            evento({ empresaId: OTRA }),
          ),
        ),
      ).rejects.toThrow(/row-level security/i);
    });

    it("en una transacción de empresa no se admiten hechos de plataforma", async () => {
      const ev = evento({
        empresaId: null,
        actor: { tipo: "plataforma" },
        accion: "catalogo.cargado",
        objeto: "libreria:x",
        objetoVersion: "1.0.0",
      });
      await expect(
        conTenant(app(), E, (trx) =>
          new Bitacora(BitacoraKysely.enTransaccion(trx)).registrar(ev),
        ),
      ).rejects.toThrow(/plataforma/i);
      expect(await filas(ev.traceId!)).toEqual([]);
    });
  });

  describe("registrarUnaVez (idempotencia por origenId)", () => {

    it("un hecho de empresa se registra una sola vez", async () => {
      const ev = evento({
        actor: { tipo: "proceso" },
        accion: "login.fallido",
        resultado: "rechazado",
        motivo: "credenciales_invalidas",
        origenId: origen(),
      });
      const reg = validarEvento(ev);
      expect(await puerto().registrarUnaVez(reg)).toBe("registrado");
      expect(await puerto().registrarUnaVez(reg)).toBe("ya_existia");
      expect(await filas(ev.traceId!)).toHaveLength(1);
    });

    it("un hecho de plataforma se registra una sola vez (sin permiso de lectura)", async () => {
      const ev = evento({
        empresaId: null,
        actor: { tipo: "proceso" },
        accion: "login.fallido",
        resultado: "rechazado",
        motivo: "cuenta_inexistente",
        origenId: origen(),
      });
      const reg = validarEvento(ev);
      expect(await puerto().registrarUnaVez(reg)).toBe("registrado");
      expect(await puerto().registrarUnaVez(reg)).toBe("ya_existia");
      expect(await filas(ev.traceId!)).toHaveLength(1);
    });

    it("dentro de una transacción, repetir el hecho no la aborta: la acción sigue y se confirma", async () => {
      const ev = evento({
        actor: { tipo: "proceso" },
        accion: "login.fallido",
        resultado: "rechazado",
        motivo: "credenciales_invalidas",
        origenId: origen(),
      });
      const otro = evento();
      await conTenant(app(), E, async (trx) => {
        const p = BitacoraKysely.enTransaccion(trx);
        expect(await p.registrarUnaVez(validarEvento(ev))).toBe("registrado");
        expect(await p.registrarUnaVez(validarEvento(ev))).toBe("ya_existia");
        await new Bitacora(p).registrar(otro); // la transacción sigue usable
      });
      expect(await filas(ev.traceId!)).toHaveLength(1);
      expect(await filas(otro.traceId!)).toHaveLength(1);
    });

    it("exige origenId", async () => {
      await expect(
        puerto().registrarUnaVez(validarEvento(evento())),
      ).rejects.toThrow(/origenId/);
    });
  });

  describe("mantenimiento con la base real", () => {
    it("verifica, ancla y deja constancia en la bitácora de plataforma", async () => {
      const empresa = crearEmpresaId(randomUUID());
      for (let i = 0; i < 3; i++)
        await bitacora().registrar(evento({ empresaId: empresa }));
      const alertas: AlertasPort = { notificar: vi.fn(async () => {}) };
      const integridad = new IntegridadKysely(owner());
      const r = await new MantenimientoBitacora(
        integridad,
        bitacora(),
        alertas,
      ).ejecutar();
      expect(r.ok).toBe(true);
      expect(r.problemas).toEqual([]);
      expect(alertas.notificar).not.toHaveBeenCalled();
      const anclas = await sql<{
        secuencia: string;
      }>`select secuencia::text from bitacora_ancla where clave = ${empresa}`.execute(
        owner(),
      );
      expect(anclas.rows.map((f) => f.secuencia)).toEqual(["3"]);
      const constancia = await sql<{
        n: number;
      }>`select count(*)::int as n from bitacora where empresa_id is null and accion = 'bitacora.verificacion' and resultado = 'ok'`.execute(
        owner(),
      );
      expect(constancia.rows[0]?.n).toBeGreaterThan(0);
    });

    it("IntegridadKysely.verificar devuelve una lista vacía sobre cadenas sanas y anclar devuelve un número", async () => {
      const integridad = new IntegridadKysely(owner());
      expect(await integridad.verificar()).toEqual([]);
      expect(typeof (await integridad.anclar())).toBe("number");
    });
  });
});
