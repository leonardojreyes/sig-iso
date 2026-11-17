/**
 * El código de una solicitud de acceso (ADR 036), legible para quien usa lector de pantalla: lo que se VE es `K7F2-9QXM` (seleccionable
 * de un clic, para copiarlo) y lo que se LEE es carácter por carácter, con «guion» (un lector puede decir «K7F2» como una palabra).
 */
export const CodigoSolicitud = ({ codigo }: { codigo: string }) => (
  <>
    <span aria-hidden="true">{codigo}</span>
    <span className="sr-only">
      {[...codigo].map((c) => (c === '-' ? 'guion' : c)).join(', ')}
    </span>
  </>
);
