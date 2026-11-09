# `/review` del corte vertical 0.6 (tarea 12.4)

**Fecha:** 2026-11-09 · **Rama:** `feature/paso-0-6-aislamiento-e2e` · **Alcance:** corte 0.6 completo, con foco en `scripts/web-verificar-aislamiento.ts` (nuevo) · **Revisores (en paralelo, solo lectura):** `arquitecto`, `revisor-multiempresa`, `revisor-seguridad`, `revisor-cumplimiento`, `auditor-accesibilidad`. `experto-iso` no se invocó: no hubo cambios de reglas de dominio.

## Veredicto: **aprobar** (sin hallazgos bloqueantes ni altos)

Pendiente que decide el responsable: H6.10 (abajo). La protección de `.local/` ya se corrigió. El merge lo aprueba un humano.

**No verificado por los revisores:** ejecución de las pruebas, contraste real de tokens, lector de pantalla y navegador, validación `iss/aud/alg` y PKCE en detalle, límites de Nx/ESLint, aprovisionamiento de roles (que `sigiso_app` no sea superusuario ni tenga `BYPASSRLS`), migración 0004 y `docs/` fila por fila.

## Corregido en esta rama

| Sev.  | Dónde                          | Hallazgo                                                                                  | Estado                                                                               |
| ----- | ------------------------------ | ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ |
| Baja  | `web-verificar-aislamiento.ts` | El vaciado de la bitácora no llevaba salvaguarda: si el permiso fallara, vaciaba la tabla | Corregido: todas las sentencias corren en una transacción que siempre se revierte    |
| Media | ídem                           | «A pide con el id de B» usaba un UUID de empresa como id de entrada: daba 404 aun sin RLS | Corregido: B pide por id una entrada real que solo adoptó A (y A la obtiene con 200) |
| Media | ídem                           | «B ve 0 entradas» podía pasar sin probar nada                                             | Corregido: se exige que A vea más de 0                                               |
| Baja  | ídem                           | `idA as never` anulaba el tipo `EmpresaId`                                                | Corregido: `crearEmpresaId`                                                          |
| Baja  | ídem                           | Terminaba con «Todo correcto» aun con la brecha H6.10 abierta                             | Corregido: mensaje final distinto cuando quedan brechas                              |

## Abiertos (ordenados por severidad)

| Sev.  | Ruta                                                                  | Hallazgo                                                                                                                              | Responsable / destino                                     |
| ----- | --------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Media | `catalogo.ts` (H6.10); `filtro-problemas.ts:59`                       | Nadie lanza `AccesoCruzadoException` en producción y el proxy web responde 404 sin escribir en la bitácora: 0 hechos `acceso.cruzado` | Fase 1 (ya en `estado.md`)                                |
| Media | `.claude/settings.json`, `hooks/reglas-bash.mjs`                      | Solo `.env*` está protegido; `.local/secretos-keycloak.json` se puede leer con `Read` o `cat`                                         | **Decisión del responsable** (cambio de permisos)         |
| Media | `platform/auditoria/src/servicio/mantenimiento.ts:34,42`              | `bitacora.verificacion` no la invoca ningún proceso: la verificación de integridad no corre sola                                      | Fase 1 (worker o tarea programada)                        |
| Media | `docs/adr/027…:61`, `catalogo.ts:9`                                   | `sesion.expirada` no se emite en producción, aunque el ADR 027 dice que sí                                                            | Emitirla o declararla diferida                            |
| Media | `apps/web/app/layout.tsx:5`                                           | Mismo `<title>` en portada, ingreso y requisitos (WCAG 2.4.2)                                                                         | Fase 1 / pantallas                                        |
| Media | `listado-requisitos.tsx:222`                                          | El filtro recarga la página: el cambio no se anuncia y el foco vuelve al inicio (4.1.3, 2.4.3)                                        | Fase 1 / pantallas                                        |
| Media | `presentacion.tsx:59`                                                 | Los avisos de error cargados con la página no se anuncian de forma fiable (4.1.3)                                                     | Mover el foco al aviso o documentar                       |
| Media | `scripts/*` (cuatro `web-verificar-*` y `keycloak-verificar`)         | Preámbulo, `comprobar` y obtención de token duplicados                                                                                | Extraer `scripts/lib/entorno-local.ts` y `cliente-api.ts` |
| Baja  | `apps/worker/src/eventos/cliente-eventos.ts:~134,~150`                | Sin `redirect: 'error'`; acepta `http:` en producción                                                                                 | Antes de producción                                       |
| Baja  | `autenticacion.guard.ts:46-48`                                        | Sin límite de frecuencia para peticiones sin token o con token inválido (DoS)                                                         | Antes de producción (límite previo por IP/proxy)          |
| Baja  | `apps/web/src/auth/sesion.ts:~46`; `next.config.mjs`                  | Cookie sin prefijo `__Host-`; faltan HSTS y COOP                                                                                      | Antes de producción                                       |
| Baja  | `0004_bitacora_cadena.sql:86-93`                                      | `bitacora_ancla` sin RLS (hoy ningún rol de aplicación tiene permisos sobre ella)                                                     | Defensa en profundidad                                    |
| Baja  | `0003_bitacora.sql:47-49`                                             | `sigiso_owner` lee la bitácora de todas las empresas (documentado en el ADR 028)                                                      | Confirmar que la API no use el pool `owner`               |
| Baja  | `listado-requisitos.tsx`, `presentacion.tsx` (`Tabla`, `EstadoVacio`) | Filtros inválidos sin `aria-invalid`/`aria-describedby`; tabla con desplazamiento sin foco; título de estado vacío como `<p>`         | Fase 1 / pantallas                                        |
| Baja  | `plan.md:96`; `siembra.ts:44`; `db-migrate.ts:12`                     | `libreria.rechazada` no existe en `ACCIONES`; la siembra no deja `rol.cambiado`; `db-migrate` imprime el mensaje completo             | Documentar o limpiar                                      |
| Baja  | `scripts/web-verificar-aislamiento.ts`                                | Extensiones de import inconsistentes; bucle con rama por rol                                                                          | Al pasar por el archivo                                   |

## Lo que los revisores verificaron como correcto

- RLS con `FORCE` y `app_tenant_id()` que falla sin empresa en `empresa`, `usuario`, `empresa_libreria` y `bitacora`; la empresa sale solo del token verificado; sin rutas con empresa en la URL de la API.
- Bitácora sin datos personales (vocabulario cerrado, `usuario_id` opaco); el cliente de eventos de Keycloak no deja salir la IP ni el nombre de usuario.
- Sin texto de normas en las librerías; `pnpm audit --prod` sin vulnerabilidades; 736 paquetes con licencias permitidas; sin secretos en git.
- Guardia cerrada por omisión, CORS con lista blanca, `Origin` exacto en adopción y cierre de sesión, redirecciones seguras, proxy que falla cerrado.
- Aviso de ingreso genérico, landmarks, etiquetas, foco visible, `prefers-reduced-motion`, tamaños de objetivo y regla 7 sin valores sueltos.
