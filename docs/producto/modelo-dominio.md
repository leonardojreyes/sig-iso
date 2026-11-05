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
        string clausula
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
    }
    SISTEMA_IA {
        string id PK
        string proposito
        string proveedor
        string nivel_impacto
    }
```

## Reglas de dominio clave

1. **Un requisito común, una evidencia, varias normas:** la Evidencia cuelga del Control; el Mapeo conecta el Control con los Requisitos de cualquier Edición.
2. **Ciclo de 3 años (E8):** Seguimiento 1 ≤ 12 meses desde la decisión de certificación; Seguimiento 2; Recertificación antes del vencimiento.
3. **Etapa 2 exige** al menos una Auditoría interna y una Revisión por la dirección completadas.
4. **Declaración de Aplicabilidad** se deriva de Controles y Mapeos reales (27001 y 42001).
5. **Bitácora inmutable (P15):** transversal; toda creación, cambio, aprobación y eliminación se registra (quién, qué, cuándo, antes/después).
6. **Revisión por la dirección** y **Declaración de Aplicabilidad** son documentos generados; se modelarán en `/spec` de sus módulos.
