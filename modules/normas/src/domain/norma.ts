export interface NormaProps {
  readonly codigo: string; // p. ej. "ISO 9001"
  readonly nombre: string;
  readonly edicion: string; // p. ej. "2015"
}

/** Entidad de dominio pura: sin frameworks, sin BD, sin proveedores de IA. */
export class Norma {
  private constructor(private readonly props: NormaProps) {}

  static crear(props: NormaProps): Norma {
    if (!props.codigo.trim()) throw new Error('El código de la norma es obligatorio');
    if (!/^\d{4}$/.test(props.edicion)) throw new Error('La edición debe ser un año de 4 dígitos');
    return new Norma({ ...props, codigo: props.codigo.trim() });
  }

  get codigo(): string { return this.props.codigo; }
  get nombre(): string { return this.props.nombre; }
  get edicion(): string { return this.props.edicion; }
}
