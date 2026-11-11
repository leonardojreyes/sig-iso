# Modelo de dominio inicial

Diagrama de entidades (Mermaid). Toda entidad de negocio lleva `empresa_id` (RLS), salvo las librerías globales de normas (Norma, Edición, Requisito), que son de solo lectura para las empresas. Las claves y atributos finales se definen en cada `/spec`.

```mermaid
erDiagram
    EMPRESA ||--o{ PROYECTO_CERTIFICACION : tiene
    EMPRESA ||--o{ PROCESO : define
    EMPRESA ||--o{ CONTROL : mantiene
    EMPRESA ||--o{ DOCUMENTO : gestiona
    EMPRESA ||--o{ RIESGO : gestiona
    EMPRESA ||--o{ SISTEMA_IA : inventaria
    EMPRESA ||--o{ INDICADOR : mide

    NORMA ||--o{ EDICION : "se publica en"
    EDICION ||--o{ REQUISITO : contiene
    REQUISITO }o--o{ CONTROL : "MAPEO (muchos a muchos)"
    CONTROL ||--o{ EVIDENCIA : "demuestra con"
    PROCESO ||--o{ CONTROL : opera
    PROCESO ||--o{ INDICADOR : "se mide con"
    PROCESO ||--o{ RIESGO : expone
    RIESGO }o--o{ CONTROL : "se trata con"
    DOCUMENTO }o--o{ EVIDENCIA : respalda

    PROYECTO_CERTIFICACION }o--o{ EDICION : "alcanza"
    PROYECTO_CERTIFICACION ||--|{ ETAPA_CERTIFICACION : "recorre E0-E8"
    PROYECTO_CERTIFICACION }o--o| ORGANISMO_CERTIFICADOR : "certifica con"
    PROYECTO_CERTIFICACION ||--o{ AUDITORIA : programa

    AUDITORIA }o--o{ EDICION : "audita (combinada)"
    AUDITORIA ||--o{ HALLAZGO : produce
    HALLAZGO }o--o| REQUISITO : "referido a"
    HALLAZGO ||--o| NO_CONFORMIDAD : "puede originar"
    NO_CONFORMIDAD ||--o{ ACCION : "se corrige con"
    INDICADOR ||--o{ NO_CONFORMIDAD : "puede originar"
    SISTEMA_IA }o--o{ CONTROL : "se gobierna con"
    SISTEMA_IA }o--o{ RIESGO : "evalúa impacto"

    %% --- v2 (spec modelo-dominio-v2). MVP: Alcance, Sede, Exclusión y la jerarquía de la librería. El resto, después. ---
    REQUISITO }o--o| REQUISITO : "tiene como padre"
    EMPRESA ||--o{ ALCANCE : define
    ALCANCE }o--|| EDICION : "de una norma y edición"
    ALCANCE ||--o{ SEDE : incluye
    ALCANCE ||--o{ EXCLUSION : justifica
    EXCLUSION }o--|| REQUISITO : excluye
    EMPRESA ||--o{ CERTIFICADO : obtiene
    CERTIFICADO }o--|| EDICION : certifica
    CERTIFICADO }o--o| CERTIFICADO : "reemplaza al del ciclo anterior"
    PROYECTO_CERTIFICACION ||--o{ CERTIFICADO : "termina en"
    EMPRESA ||--o{ ACTIVO_INFORMACION : inventaria
    PROCESO }o--o{ ACTIVO_INFORMACION : usa
    SISTEMA_IA ||--o{ EVALUACION_IMPACTO_IA : "se evalúa con"
    EMPRESA ||--o{ USUARIO : emplea
    USUARIO ||--o{ ASIGNACION_ROL : tiene
    USUARIO ||--o{ PERSONA_PROCESO : "se relaciona con"
    PROCESO ||--o{ PERSONA_PROCESO : "tiene personas"
    AUDITORIA }o--o{ PROCESO : audita

    NORMA {
        string id PK
        string nombre
        bool global
    }
    EDICION {
        string id PK
        string norma_id FK
        string version
        date vigente_desde
    }
    REQUISITO {
        string id PK
        string edicion_id FK
        string tipo "clausula|control|agrupador"
        string subtipo "tema|objetivo_control|capitulo (solo agrupador)"
        string padre_id FK "jerarquía de hasta 4 niveles"
        string identificador_en_norma "p. ej. 4.3 o A.5.1"
        string titulo_breve
        string guia_propia
    }
    CONTROL {
        string id PK
        string empresa_id FK
        string nombre
        string responsable
        string estado
    }
    EVIDENCIA {
        string id PK
        string control_id FK
        string sha256
        date vigente_hasta
        string responsable
    }
    PROYECTO_CERTIFICACION {
        string id PK
        string empresa_id FK
        string estado
    }
    ETAPA_CERTIFICACION {
        string id PK
        string codigo "E0..E8"
        date fecha_objetivo
        string criterio_salida
    }
    AUDITORIA {
        string id PK
        string tipo "interna|etapa1|etapa2|seguimiento|recertificacion"
        date fecha
    }
    HALLAZGO {
        string id PK
        string tipo "NC mayor|NC menor|observacion|oportunidad"
        string etapa_origen "etapa1|etapa2|seguimiento|recertificacion|interna"
        string estado "abierto|plan_propuesto|plan_aceptado|verificado|cerrado"
        date fecha_limite_cierre "la fija el organismo"
    }
    NO_CONFORMIDAD {
        string id PK
        string origen "auditoria_interna|auditoria_externa|indicador|queja|incidente|revision_direccion|riesgo|proveedor"
    }
    SISTEMA_IA {
        string id PK
        string proposito
        string proveedor
        string nivel_impacto
    }
    ALCANCE {
        string id PK
        string empresa_id FK
        string edicion_id FK
        string descripcion
        string interfaces_dependencias "27001 y 42001"
        string rol_organizacion "42001"
    }
    SEDE {
        string id PK
        string alcance_id FK
        string nombre
    }
    EXCLUSION {
        string id PK
        string alcance_id FK
        string requisito_id FK "solo clausulas que la norma permite no aplicar"
        string justificacion
    }
    CERTIFICADO {
        string id PK
        string empresa_id FK
        string edicion_id FK
        string numero
        date decision_certificacion
        date vence
        string estado "vigente|suspendido|alcance_reducido|vencido|retirado"
    }
    ACTIVO_INFORMACION {
        string id PK
        string empresa_id FK
        string nombre
        string responsable
        string clasificacion
    }
    EVALUACION_IMPACTO_IA {
        string id PK
        string sistema_ia_id FK
        date fecha
        string responsable
    }
    USUARIO {
        string id PK
        string empresa_id FK
    }
    ASIGNACION_ROL {
        string id PK
        string usuario_id FK
        string rol
        date desde
        date hasta "obligatoria para auditor externo"
    }
    PERSONA_PROCESO {
        string usuario_id FK
        string proceso_id FK
        string relacion "duena|participa|diseno|supervisa"
    }
```

## Reglas de dominio clave

1. **Un requisito común, una evidencia, varias normas:** la Evidencia cuelga del Control; el Mapeo conecta el Control con los Requisitos de cualquier Edición.
2. **Ciclo de 3 años (E8):** Seguimiento 1 ≤ 12 meses desde la decisión de certificación; Seguimiento 2; Recertificación antes del vencimiento.
3. **Etapa 2 exige** al menos una Auditoría interna y una Revisión por la dirección completadas.
4. **Declaración de Aplicabilidad** se deriva de Controles y Mapeos reales (27001 y 42001).
5. **Bitácora inmutable (P15):** transversal; toda creación, cambio, aprobación y eliminación se registra (quién, qué, cuándo, antes/después).
6. **Revisión por la dirección** y **Declaración de Aplicabilidad** son documentos generados; se modelarán en `/spec` de sus módulos.
7. **Entradas de librería:** una entrada es de tipo cláusula, control o agrupador (tema, objetivo de control o capítulo), con un padre opcional. Es solo una referencia: identificador, título breve y guía propia, nunca el texto de la norma.
8. **Control de la norma frente a control de la empresa:** la Declaración de Aplicabilidad se arma por **control de la norma** (27001 y 42001); el **control de la empresa** puede ser adicional y no tener equivalente en el Anexo A.
9. **Independencia del auditor:** nadie audita un proceso con el que tiene relación (dueña, participa, diseñó, supervisa) ni uno que auditó recientemente; se evalúa por auditoría y por proceso.

## Marcas del MVP (spec `docs/specs/modelo-dominio-v2/spec.md`)

| Entrada | Marca |
| --- | --- |
| Jerarquía y tipos de la librería, identificador por norma, Anexo A | **MVP** |
| Alcance, Sede, Exclusión | **MVP** |
| Certificado, Activo de información, Evaluación de impacto de IA, origen de NC, estados y plazos de hallazgos | después |
| Asignación de rol con vigencia, Persona–proceso | después (antes de la primera auditoría interna) |
| Diagnóstico y Declaración de Aplicabilidad | se modelan en el spec del MVP |
