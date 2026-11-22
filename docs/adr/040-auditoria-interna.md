# ADR 040 — Auditoría interna: programa, independencia, hallazgos e informe congelado

- **Estado:** Aprobado (2026-11-22, al integrar el PR del módulo; propuesto el 2026-11-19). Spec aprobado por el responsable con la propuesta por omisión (`docs/specs/auditoria-interna/spec.md`, sección 11). Completa los ADR 028 (privacidad), 029 (permisos por rol) y 033 (Word) y no los contradice.
- **Fecha:** 2026-11-19
- **Decide:** Ing. Leonardo J. Reyes B.

## Contexto

Para pasar la Etapa 2 la empresa debe mostrar al menos una auditoría interna hecha con programa, criterios, personas imparciales y resultados registrados. El módulo necesita fijar cómo se mide la independencia, qué se congela, qué significa «completada» y cuánto de las no conformidades se trata aquí (el tratamiento es de otro módulo).

## Decisión

1. **Proceso mínimo.** Entidad `proceso` (código `PR-001`, dueña, importancia, frecuencia prevista, marca transversal; se **retira**, no se borra) y relación persona–proceso con cuatro tipos (dueña, participa, diseñó, supervisa). Solo sirve a la auditoría. «Gestión del SIG» es un proceso transversal que el administrador crea con un botón y entra al alcance de toda auditoría que cubra las cláusulas 4 a 10.
2. **Independencia.** Una persona con relación con un proceso del alcance **no puede** ser designada. La repetición sobre el mismo proceso en 12 meses es **solo aviso**. Excepción posible con **motivo y medida compensatoria**, visible en la auditoría, el informe y la bitácora (solo la marca); nadie aprueba su propia excepción salvo el único administrador activo. Se evalúa al designar y otra vez al emitir el informe.
3. **Programa y auditoría.** Un programa por año y empresa, aprobado una vez; lo que no entra en el año lleva motivo; los cambios posteriores, motivo cerrado y nota breve. Estados de la auditoría: planificada → en preparación → en ejecución → informe emitido → cerrada, y cancelada (no se reabre). Fechas en hora de Ecuador.
4. **Lista de verificación.** Una fila por entrada de las normas **adoptadas**, fijada con la versión de la librería al generarla; se regenera solo a propósito. Solo el equipo designado evalúa, con concurrencia optimista por versión. Nunca texto de normas.
5. **Hallazgos.** NC mayor, NC menor, observación u oportunidad. La NC exige requisito, evidencia objetiva y enunciado (y justificación de gravedad si es mayor). Quedan abiertos: el tratamiento es del módulo de no conformidades. Se anulan con motivo, no se borran.
6. **Cobertura y prerrequisito.** «No verificado» y «no aplica» sin justificación no cuentan. El prerrequisito de la Etapa 2 se cumple con al menos una auditoría cerrada con informe y cobertura de las cláusulas 4 a 10, los procesos del alcance y los controles aplicables de la Declaración; lo que falte se muestra como brecha. El módulo calcula y muestra el dato, **no decide la etapa**.
7. **Informe congelado e inmutable** (copia con equipo, excepciones, conteos, hallazgos, cobertura, conclusión y limitaciones). Un error se corrige con una auditoría complementaria o una nota posterior. Word desde la copia congelada, con la exportación en la bitácora **antes** de entregarla.
8. **Permisos** (ADR 029): `auditoria.ver`, `auditoria.planificar`, `auditoria.ejecutar`, `auditoria.aprobar` y `auditoria.gestionar`. Administrador SIG: todos; auditor interno: ver y ejecutar solo en las auditorías donde está designado; colaborador: ver.
9. **Datos y RLS.** Tablas con `empresa_id`, RLS forzada, claves foráneas compuestas y una prueba de aislamiento por tabla; nada se borra y los cambios son por columnas de estado. Migraciones `0023` a `0025`.
10. **Bitácora** (misma transacción): `proceso.*`, `relacion.*`, `programa.*`, `auditoria.*`, `equipo.*`, `lista.generada`, `item.evaluado`, `hallazgo.*`. Objetos de forma exacta; nunca nombres, notas, evidencias ni enunciados.

## Alternativas

- **Independencia solo por declaración del auditor:** descartada, no es comprobable. **Bloqueo por repetición:** descartado, la rotación es buena práctica y no un requisito (se corrige la regla 9 del modelo de dominio). **Tratar las NC aquí:** descartado, es otro módulo. **Una fila común para las cláusulas 4 a 10 de varias normas:** pospuesta hasta que la librería traiga el mapeo común.

## Consecuencias

- El informe congelado puede contener datos personales de un texto libre sin vía de rectificación; es insumo nuevo para el asesor legal (ADR 028). Solo datos de prueba hasta entonces.
- Contratar a una persona externa para auditar y el auditor externo con acceso limitado en el tiempo quedan fuera (roles múltiples, M3 de la revisión de calidad).
- «Gestión de riesgos completa» pasa a usar las migraciones desde la `0026`.

### Límites conocidos del prerrequisito de la Etapa 2 (a decidir por el responsable de producto)

Surgieron en la revisión experto-iso y **no se cambiaron** porque modifican lo que significa el prerrequisito; el panel solo informa, no decide la etapa:

1. **Revisión por la dirección (9.3):** hoy solo cuenta como una cláusula que puede quedar «no verificada»; no es un requisito propio ni hay un dato de «revisión realizada». Propuesta: una brecha explícita `revisionDireccion` cuando exista el módulo correspondiente.
2. **Cobertura de procesos:** mide lo **incluido en el alcance** de una auditoría cerrada, no lo verificado con evidencia por proceso.
3. **Ventana de tiempo:** el prerrequisito suma las auditorías cerradas de cualquier año y el panel muestra el programa del año; conviene una sola regla (programa vigente más 12 a 24 meses).
4. Una fila «conforme» no exige nota de evidencia; la excepción de independencia autoautorizada se muestra en el equipo y en el informe, pero no se señala como brecha en el panel.

Corregido en este PR: la Declaración de Aplicabilidad solo se exige si alguna norma del programa tiene controles (una empresa solo 9001 o 42001 no queda sin poder cumplir).
