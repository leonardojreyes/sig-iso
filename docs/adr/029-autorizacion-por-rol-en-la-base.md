# ADR 029 — Autorización por rol desde la base; OpenFGA queda pospuesto

- **Estado:** Aprobado (2026-11-07) por el responsable, tras ver el costo frente al valor en el corte 0.6
- **Fecha:** 2026-11-07
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

El ADR 008 fijó OpenFGA para la autorización y el ADR 025 previó instalarlo de forma nativa. La tarea 9.1 lo dejó instalado y funcionando (1.22.1, 53 MB de RAM, solo en 127.0.0.1 y con clave).

El corte vertical 0.6 solo usa **dos roles** (`administrador_sig` y `colaborador`) con permisos **por empresa**. La matriz en código de `platform/autorizacion` ya los cubre, con pruebas y con falla cerrada por omisión. OpenFGA aportaría permisos **por objeto y relación**, que este corte no necesita. Las tareas 9.2 (modelo) y 9.3 (adaptador y siembra de tuplas) añaden trabajo sin cambiar lo que se ve, y el sistema aún no tiene pantallas reales.

Hoy la autorización de producción es `AutorizacionNoConfigurada`, que falla cerrada: sin otra fuente de roles, la adopción de librerías no funcionaría en una ejecución real.

## Decisión

1. **OpenFGA no se integra en el corte 0.6.** Las tareas 9.2 y 9.3 quedan pospuestas. Lo hecho en la 9.1 (`pnpm openfga:*`, base `openfga`) se conserva, pero no forma parte del arranque por omisión ni de ninguna prueba.
2. **El rol de cada persona vive en la base**: columna `rol` de la tabla `usuario` (que ya lleva `empresa_id` y RLS). Un adaptador `AutorizacionPostgres` implementa `AutorizacionPort` con la **misma matriz** y **falla cerrada**: sin fila, sin rol o con un rol desconocido, no hay permiso.
3. **El token sigue sin llevar el rol** (solo `empresa_id`, ADR 027). Un cambio de rol surte efecto de inmediato, sin esperar a que venza el token de 5 minutos, y no mezcla identidad con permisos. En el corte 0.6 lo fija la siembra; no hay pantalla para cambiarlo. Cuando exista el cambio de rol, deberá registrar `rol.cambiado` en la misma transacción (regla 4).
4. **El puerto `AutorizacionPort` no cambia.** El adaptador de OpenFGA, cuando llegue, lo sustituye sin tocar casos de uso ni controladores.

## Cuándo retomar OpenFGA (disparadores)

- Permisos **por objeto o por relación**: un auditor externo con acceso a ciertos proyectos, un proveedor con acceso a un solo documento, delegaciones.
- Más de unos tres roles con excepciones, o reglas que la matriz ya no exprese con claridad.
- Necesidad de consultas del tipo «¿qué puede ver esta persona?» (`ListObjects`).
- Despliegue en servidor con varios servicios que compartan autorización.

Al retomarlo: migrar `usuario.rol` a tuplas (un script sencillo), activar las tareas 9.2 y 9.3 y retirar la columna cuando ya no se lea. El pendiente quedó anotado en `docs/fase0/estado.md` y en la memoria del proyecto.

## Alternativas consideradas

| Alternativa | Por qué no |
| --- | --- |
| Seguir con OpenFGA ahora (tareas 9.2 y 9.3) | Más piezas y más RAM para dos roles; retrasa ver el sistema. Queda como camino futuro. |
| Rol como claim del token (atributo en Keycloak) | Un cambio de rol tarda hasta 5 minutos en surtir efecto; mezcla identidad y permisos; exige administrar Keycloak para cada cambio. |
| Mantener `AutorizacionNoConfigurada` | La adopción fallaría cerrada en toda ejecución real. |

## Estándar y licencia

- Estándar: RBAC (INCITS 359-2004) para el corte; Zanzibar (OpenFGA) queda para después.
- Sin dependencias nuevas ni excepciones de licencia.

## Consecuencias

- Se cancelan dos tareas (9.2 y 9.3) y se agrega una (9.4: migración de `usuario.rol`, adaptador, siembra y composición de producción). El ADR 008 sigue vigente como dirección; este ADR solo aplaza su integración.
- Del ADR 025 queda «OpenFGA instalado y verificado, no usado»; las demás partes siguen igual.
- Riesgo aceptado: dos fuentes de permisos a lo largo del tiempo (la base hoy, OpenFGA después). Se acota con el puerto único y el script de migración previsto.
- Deuda registrada: sin modelo de permisos por objeto hasta que un disparador lo exija.

## Criterio de tecnología mayoritaria (P12)

Un rol por persona y una matriz es la solución más simple y probada para dos roles; no se introduce tecnología nueva. OpenFGA se mantiene como la opción decidida para cuando el modelo de permisos crezca.
