// pnpm web:verify-documentos — comprueba con todo REAL (Keycloak, API, PostgreSQL y web) el control documental (ADR 039): crear un
// documento, subir una versión con su archivo, enviarla a revisión, la separación de funciones (el autor no la aprueba y solo la
// aprueba quien fue nombrado), una sola versión vigente, la lectura confirmada, la nueva versión que deja la anterior obsoleta, la
// descarga íntegra y como adjunto, la revisión sin cambios, el vínculo con una entrada de una norma adoptada y la cobertura documental,
// la retención, permisos por rol, Origin y aislamiento con la empresa B.
// Requiere: Keycloak, API (pnpm dev api), web (pnpm dev web), pnpm db:migrate, pnpm db:seed y el Anexo A de 27001 adoptado por A.
// OJO: escribe en tu base local de desarrollo. Repetible y limpio: todo lo que crea lleva la marca «VERIF-» y al terminar QUITA el
// vínculo y RETIRA el documento (conserva su historia, sus versiones y sus archivos: por diseño nada se borra). Queda también la
// retención del tipo «Procedimiento» (años y motivo de prueba) y la distribución del documento retirado.
// Va despacio a propósito: la API limita a 120 peticiones por minuto por persona.
import { readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { descargarWeb, enviarWeb, iniciarSesionWeb, paginaWeb, type EntornoWeb } from './lib/sesion-web.ts';

const raiz = join(dirname(fileURLToPath(import.meta.url)), '..');
const redirectUri = process.env.OIDC_REDIRECT_URI ?? 'http://localhost:3000/auth/callback';
const entorno: EntornoWeb = {
  web: new URL(redirectUri).origin,
  emisor: (process.env.OIDC_ISSUER_URL ?? 'http://127.0.0.1:8080/realms/sigiso').replace(/\/+$/, ''),
  claves: JSON.parse(readFileSync(join(raiz, '.local', 'secretos-keycloak.json'), 'utf8')).usuarios,
};

let fallos = 0;
const comprobar = (descripcion: string, ok: boolean, detalle = '') => {
  if (!ok) fallos += 1;
  console.log(`${ok ? '✔' : '✖'} ${descripcion}${ok || !detalle ? '' : ` — ${detalle}`}`);
};

const MARCA = `VERIF-${Date.now().toString(36)}`;
const A = '/e/empresa-a';
const B = '/e/empresa-b';
const UUID_RE = '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}';
const PDF = new Uint8Array(Buffer.from('%PDF-1.7\n1 0 obj\n<<>>\nendobj\ntrailer\n%%EOF\n'));
const EXE = Uint8Array.from([0x4d, 0x5a, 0x90, 0x00, ...new Array(200).fill(0)]);
const aviso = (r: { estado: number; parametros: URLSearchParams }) => (r.estado === 303 ? r.parametros.get('aviso') : `HTTP ${r.estado}`);
const archivo = (bytes: Uint8Array, nombre = 'politica.pdf') => new File([bytes as BlobPart], nombre);
const formulario = (nota: string, bytes: Uint8Array, nombre?: string) => {
  const f = new FormData();
  f.append('nota', nota);
  f.append('archivo', archivo(bytes, nombre));
  return f;
};
/** Las opciones (id y nombre) de un <select> de la página. */
const opciones = (html: string, id: string): { id: string; nombre: string }[] => {
  const s = new RegExp(`<select[^>]*id="${id}"[\\s\\S]*?</select>`).exec(html)?.[0] ?? '';
  return [...s.matchAll(new RegExp(`<option value="(${UUID_RE})"[^>]*>([^<]*)</option>`, 'g'))].map((m) => ({ id: m[1]!, nombre: m[2]! }));
};
/** Ids de las versiones del detalle, de la más nueva a la más antigua. */
const versiones = (html: string): string[] => [
  ...new Set([...html.matchAll(new RegExp(`href="${A}/documentos/versiones/(${UUID_RE})/descargar"`, 'g'))].map((m) => m[1]!)),
];
const campoOculto = (html: string, accion: string, nombre: string): string | null => {
  const f = new RegExp(`<form[^>]*action="[^"]*${accion}"[^>]*>([\\s\\S]*?)</form>`).exec(html)?.[1] ?? '';
  return (
    new RegExp(`name="${nombre}"[^>]*value="([^"]*)"`).exec(f)?.[1] ??
    new RegExp(`value="([^"]*)"[^>]*name="${nombre}"`).exec(f)?.[1] ??
    null
  );
};

let documentoId: string | null = null;
let vinculado = false;

try {
  const sesion = {
    adminA: await iniciarSesionWeb(entorno, 'admin-a', `${A}/documentos`),
    consultor: await iniciarSesionWeb(entorno, 'consultor', `${A}/documentos`),
    colabA: await iniciarSesionWeb(entorno, 'colab-a', `${A}/documentos`),
    adminB: await iniciarSesionWeb(entorno, 'admin-b', `${B}/documentos`),
  };
  type Quien = keyof typeof sesion;
  const ver = (quien: Quien, ruta: string) => paginaWeb(entorno, ruta, sesion[quien]);
  const enviar = (
    quien: Quien,
    ruta: string,
    o: { origen?: string | null; metodo?: string; cuerpo?: Record<string, string>; formulario?: FormData } = {},
  ) => enviarWeb(entorno, ruta, sesion[quien], o);
  const bajar = (quien: Quien, ruta: string) => descargarWeb(entorno, ruta, sesion[quien]);
  const detalle = () => ver('adminA', `${A}/documentos/${documentoId}`);

  // ---- Lectura, permisos y aislamiento antes de escribir nada
  const lista0 = await ver('adminA', `${A}/documentos`);
  comprobar(
    'el administrador abre Documentos: 200 y sin caché',
    lista0.estado === 200 && /no-store/.test(lista0.cabeceras.get('cache-control') ?? ''),
    `respuesta ${lista0.estado}`,
  );
  comprobar(
    'la navegación ofrece «Documentos» como página actual',
    /href="\/e\/empresa-a\/documentos"[^>]*aria-current="page"/.test(lista0.texto) ||
      /aria-current="page"[^>]*href="\/e\/empresa-a\/documentos"/.test(lista0.texto),
  );
  const formAlta = /<form[^>]*action="\/e\/empresa-a\/documentos\/crear"[^>]*>([\s\S]*?)<\/form>/.exec(lista0.texto)?.[1];
  comprobar(
    'el formulario de alta es POST, sin campos de empresa, código ni estado',
    /<form[^>]*action="\/e\/empresa-a\/documentos\/crear"/.test(lista0.texto) && !!formAlta && !/name="(empresa|empresaId|codigo|estado)"/.test(formAlta),
  );
  const personas = opciones(lista0.texto, 'nuevo-responsable');
  comprobar('el formulario ofrece personas de la empresa como responsables', personas.length >= 3, `${personas.length}`);
  const colab0 = await ver('colabA', `${A}/documentos`);
  comprobar(
    'el colaborador ve Documentos y puede redactar, pero NO ve la retención',
    colab0.estado === 200 && colab0.texto.includes('/documentos/crear') && !colab0.texto.includes('/documentos/retencion'),
  );
  comprobar('AISLAMIENTO: la sesión de B pidiendo los documentos de A recibe 404', (await ver('adminB', `${A}/documentos`)).estado === 404);
  comprobar('la empresa B abre sus propios documentos', (await ver('adminB', `${B}/documentos`)).estado === 200);

  const datos = {
    tipo: 'procedimiento',
    titulo: `${MARCA} Procedimiento de acceso`,
    clasificacion: 'interna',
    responsableId: personas[0]!.id,
    area: 'Seguridad',
  };
  for (const [origen, nombre] of [
    [null, 'sin Origin'],
    ['null', 'con Origin «null»'],
    ['https://evil.example', 'con Origin de otro sitio'],
  ] as const)
    comprobar(`crear ${nombre}: 403`, (await enviar('colabA', `${A}/documentos/crear`, { origen, cuerpo: datos })).estado === 403);
  comprobar(
    'un GET a la ruta de crear no hace nada (405)',
    (await enviar('colabA', `${A}/documentos/crear`, { metodo: 'GET' })).estado === 405,
  );
  comprobar(
    'AISLAMIENTO: B enviando «crear» a la ruta de A recibe 404',
    (await enviar('adminB', `${A}/documentos/crear`, { cuerpo: datos })).estado === 404,
  );
  comprobar(
    'sin sesión, crear lleva a ingresar',
    await (async () => {
      const r = await enviarWeb(entorno, `${A}/documentos/crear`, new Map(), { cuerpo: datos });
      return r.estado === 303 && (r.destino ?? '').startsWith('/auth/login');
    })(),
  );
  comprobar(
    'un formulario con un tipo fuera de lista no llega a la API (no válido)',
    aviso(await enviar('colabA', `${A}/documentos/crear`, { cuerpo: { ...datos, tipo: 'carta' } })) === 'no_valido',
  );

  // ---- El colaborador redacta un documento
  const creado = await enviar('colabA', `${A}/documentos/crear`, { cuerpo: datos });
  comprobar('el colaborador crea un documento: aviso «documento_creado»', aviso(creado) === 'documento_creado', creado.destino ?? '');
  const lista1 = await ver('colabA', `${A}/documentos`);
  const fila =
    lista1.texto
      .split('<tr')
      .map((f) => f.split('</tr>')[0] ?? f)
      .find((f) => f.includes(MARCA)) ?? '';
  documentoId = new RegExp(`/e/empresa-a/documentos/(${UUID_RE})`).exec(fila)?.[1] ?? null;
  comprobar(
    'el documento aparece en la lista con su código y «Sin versión vigente»',
    !!documentoId && /PRO-\d{3}/.test(fila) && fila.includes('Sin versión vigente'),
  );
  if (!documentoId) throw new Error('No se pudo leer el identificador del documento');
  const aislado = await paginaWeb(entorno, `${B}/documentos/${documentoId}`, sesion.adminB);
  comprobar(
    'AISLAMIENTO: B abriendo el documento de A por su dirección recibe 404',
    aislado.estado === 404 || (aislado.estado === 200 && !aislado.texto.includes(MARCA)),
  );

  // ---- Distribución (antes de aprobar: la primera versión crea las lecturas pendientes)
  const dist = await enviar('adminA', `${A}/documentos/${documentoId}/distribuir`, { cuerpo: { roles: 'colaborador' } });
  comprobar(
    'el administrador define la distribución (todas las personas de un rol): aviso «distribucion_guardada»',
    aviso(dist) === 'distribucion_guardada',
  );
  comprobar(
    'el colaborador NO puede definir la distribución (sin permiso)',
    aviso(await enviar('colabA', `${A}/documentos/${documentoId}/distribuir`, { cuerpo: { roles: 'colaborador' } })) === 'sin_permiso',
  );

  // ---- Subir, enviar y aprobar (separación de funciones)
  comprobar(
    'un archivo que no es de un tipo permitido se rechaza (tipo no permitido)',
    aviso(await enviar('colabA', `${A}/documentos/${documentoId}/subir`, { formulario: formulario('x', EXE, 'politica.pdf') })) ===
      'tipo_no_permitido',
  );
  const subida = await enviar('colabA', `${A}/documentos/${documentoId}/subir`, { formulario: formulario('versión inicial', PDF) });
  comprobar(
    'el colaborador sube la primera versión como borrador: aviso «version_subida»',
    aviso(subida) === 'version_subida',
    subida.destino ?? '',
  );
  comprobar(
    'mientras hay una versión abierta no se puede subir otra (conflicto)',
    aviso(await enviar('colabA', `${A}/documentos/${documentoId}/subir`, { formulario: formulario('otra', PDF) })) === 'conflicto',
  );
  let d = await detalle();
  const [v1] = versiones(d.texto);
  comprobar(
    'el detalle muestra la versión 1 en «Borrador», con su huella y «No vigente»',
    !!v1 && d.texto.includes('Borrador') && d.texto.includes('Huella SHA-256') && d.texto.includes('No vigente'),
  );
  const aprobadores = opciones(d.texto, `env-${v1}`);
  comprobar(
    'quien envía puede elegir entre las personas que aprueban (no el colaborador)',
    aprobadores.length >= 2,
    `${aprobadores.length}`,
  );
  const adminAId = aprobadores.find((p) => /Administradora A/.test(p.nombre))?.id ?? aprobadores[0]!.id;
  const consultorId = aprobadores.find((p) => /Consultor/.test(p.nombre))?.id ?? aprobadores[1]!.id;
  const envio = await enviar('colabA', `${A}/documentos/versiones/${v1}/enviar`, {
    cuerpo: { documento: documentoId, aprobadorId: consultorId },
  });
  comprobar(
    'el autor envía la versión a revisión nombrando a quien la aprueba: aviso «version_enviada»',
    aviso(envio) === 'version_enviada',
  );
  comprobar(
    'SEPARACIÓN: quien no fue nombrado no puede aprobar (conflicto) y el colaborador no tiene permiso',
    aviso(await enviar('adminA', `${A}/documentos/versiones/${v1}/aprobar`, { cuerpo: { documento: documentoId } })) === 'conflicto' &&
      aviso(await enviar('colabA', `${A}/documentos/versiones/${v1}/aprobar`, { cuerpo: { documento: documentoId } })) === 'sin_permiso',
  );
  const devuelta = await enviar('consultor', `${A}/documentos/versiones/${v1}/devolver`, {
    cuerpo: { documento: documentoId, motivo: 'incompleta', nota: 'falta el alcance' },
  });
  comprobar('quien aprueba puede devolverla a borrador con un motivo', aviso(devuelta) === 'version_devuelta');
  d = await detalle();
  comprobar('el historial muestra la devolución con su motivo', d.texto.includes('Devuelta: Está incompleta'));
  await enviar('colabA', `${A}/documentos/versiones/${v1}/enviar`, { cuerpo: { documento: documentoId, aprobadorId: consultorId } });
  const aprobada = await enviar('consultor', `${A}/documentos/versiones/${v1}/aprobar`, { cuerpo: { documento: documentoId } });
  comprobar('la persona nombrada aprueba: aviso «version_aprobada»', aviso(aprobada) === 'version_aprobada');
  d = await detalle();
  comprobar(
    'queda UNA versión vigente («Aprobada (vigente)») con su próxima revisión, y no es «por su autor»',
    d.texto.includes('Aprobada (vigente)') && d.texto.includes('Próxima revisión') && !d.texto.includes('Aprobada por su propio autor'),
  );

  // ---- Lectura confirmada y descarga
  const lista2 = await ver('colabA', `${A}/documentos`);
  comprobar(
    'el colaborador ve «Mis lecturas pendientes» con el documento',
    lista2.texto.includes('Mis lecturas pendientes') && lista2.texto.includes(MARCA),
  );
  const descarga = await bajar('colabA', `/e/empresa-a/documentos/versiones/${v1}/descargar`);
  comprobar(
    'la descarga es un adjunto íntegro, con el tipo detectado, sin caché y sin interpretar',
    descarga.estado === 200 &&
      /^attachment;/.test(descarga.cabeceras.get('content-disposition') ?? '') &&
      descarga.cabeceras.get('x-content-type-options') === 'nosniff' &&
      /no-store/.test(descarga.cabeceras.get('cache-control') ?? '') &&
      Buffer.compare(Buffer.from(descarga.bytes), Buffer.from(PDF)) === 0,
  );
  comprobar(
    'AISLAMIENTO: B descargando el archivo de A recibe 404',
    (await bajar('adminB', `/e/empresa-a/documentos/versiones/${v1}/descargar`)).estado === 404,
  );
  const lectura = await enviar('colabA', `${A}/documentos/versiones/${v1}/confirmar`);
  comprobar('el colaborador confirma su lectura: aviso «lectura_confirmada»', aviso(lectura) === 'lectura_confirmada');
  comprobar(
    'confirmar otra vez, o confirmar por otra persona, no es posible (conflicto)',
    aviso(await enviar('colabA', `${A}/documentos/versiones/${v1}/confirmar`)) === 'conflicto' &&
      aviso(await enviar('adminA', `${A}/documentos/versiones/${v1}/confirmar`)) === 'conflicto',
  );
  const lista3 = await ver('colabA', `${A}/documentos`);
  comprobar('ya no tiene la lectura pendiente', !lista3.texto.includes('Mis lecturas pendientes'));
  comprobar('el administrador ve el avance de lecturas («1 de …»)', (await detalle()).texto.includes('1 de '));

  // ---- Nueva versión: la anterior queda obsoleta
  await enviar('colabA', `${A}/documentos/${documentoId}/subir`, { formulario: formulario('cambia el alcance', PDF) });
  d = await detalle();
  const v2 = versiones(d.texto).find((id) => id !== v1) as string; // el primer enlace de la página es el de la versión vigente (la 1)
  await enviar('colabA', `${A}/documentos/versiones/${v2}/enviar`, { cuerpo: { documento: documentoId, aprobadorId: adminAId } });
  const aprobada2 = await enviar('adminA', `${A}/documentos/versiones/${v2}/aprobar`, {
    cuerpo: { documento: documentoId, requiereLectura: 'on' },
  });
  comprobar('la versión 2 se aprueba pidiendo una lectura nueva', aviso(aprobada2) === 'version_aprobada');
  d = await detalle();
  comprobar(
    'la versión 1 quedó «Obsoleta» y solo hay una vigente',
    d.texto.includes('Obsoleta') && (d.texto.match(/>Aprobada \(vigente\)</g) ?? []).length === 1,
    `obsoleta=${d.texto.includes('Obsoleta')} vigentes=${(d.texto.match(/>Aprobada \(vigente\)</g) ?? []).length} v1=${v1} v2=${v2}`,
  );
  const vieja = await bajar('colabA', `/e/empresa-a/documentos/versiones/${v1}/descargar`);
  comprobar(
    'la versión obsoleta se sigue descargando (historial), rotulada «No vigente» en la pantalla',
    vieja.estado === 200 && d.texto.includes('No vigente'),
  );
  comprobar(
    'la lectura de la versión nueva vuelve a quedar pendiente',
    (await ver('colabA', `${A}/documentos`)).texto.includes('Mis lecturas pendientes'),
  );

  // ---- Revisión sin cambios, vínculo, cobertura y retención
  comprobar(
    'el responsable o el administrador registra «revisado sin cambios»',
    aviso(await enviar('adminA', `${A}/documentos/${documentoId}/revisar`, { cuerpo: { motivo: 'auditoria' } })) === 'documento_revisado',
  );
  const vincular = await enviar('adminA', `${A}/documentos/${documentoId}/vincular`, {
    cuerpo: { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1' },
  });
  vinculado = aviso(vincular) === 'documento_vinculado';
  comprobar('se liga a una entrada de una norma adoptada', vinculado, `${aviso(vincular)}`);
  comprobar(
    'una entrada que no existe o no está adoptada responde «no encontrado»',
    aviso(
      await enviar('adminA', `${A}/documentos/${documentoId}/vincular`, { cuerpo: { libreriaCodigo: 'otra-libreria', idEstable: 'x-1' } }),
    ) === 'no_encontrado',
  );
  const cob = await ver('colabA', `${A}/documentos/cobertura`);
  comprobar(
    'la cobertura documental muestra la entrada con el documento vigente',
    cob.estado === 200 && cob.texto.includes('Con documento vigente') && /PRO-\d{3}/.test(cob.texto),
  );
  const ret = await enviar('adminA', `${A}/documentos/retencion`, {
    cuerpo: {
      tipo: 'procedimiento',
      anios: '5',
      motivo: `${MARCA} política de la empresa`,
      ...(await (async () => {
        const v = campoOculto((await ver('adminA', `${A}/documentos`)).texto, 'documentos/retencion', 'version');
        return v ? { version: v } : {};
      })()),
    },
  });
  comprobar(
    'el administrador fija la retención por tipo (años y motivo)',
    ['retencion_guardada', 'conflicto'].includes(aviso(ret) ?? ''),
    `${aviso(ret)}`,
  );
  comprobar(
    'el colaborador no puede fijar la retención ni retirar documentos (sin permiso)',
    aviso(await enviar('colabA', `${A}/documentos/retencion`, { cuerpo: { tipo: 'manual', anios: '5', motivo: 'x' } })) === 'sin_permiso' &&
      aviso(await enviar('colabA', `${A}/documentos/${documentoId}/retirar`)) === 'sin_permiso',
  );

  // ---- Privacidad: la página no revela correos
  comprobar('la página del documento no trae correos de las personas', !/@example\.test/.test((await detalle()).texto));
} catch (e) {
  fallos += 1;
  console.error(`✖ la verificación se interrumpió: ${e instanceof Error ? e.message : String(e)}`);
} finally {
  // ---- Limpieza: quita el vínculo y retira el documento (conserva su historia)
  try {
    if (documentoId) {
      const admin = await iniciarSesionWeb(entorno, 'admin-a', `${A}/documentos`);
      if (vinculado)
        await enviarWeb(entorno, `${A}/documentos/${documentoId}/desvincular`, admin, {
          cuerpo: { libreriaCodigo: 'iso-27001-2022-anexo-a', idEstable: 'a27-5-1' },
        });
      const r = await enviarWeb(entorno, `${A}/documentos/${documentoId}/retirar`, admin);
      comprobar('limpieza: el documento de prueba se retira (conserva su historia)', r.parametros.get('aviso') === 'documento_retirado');
    }
  } catch (e) {
    console.error(`✖ no se pudo limpiar: ${e instanceof Error ? e.message : String(e)}`);
  }
}
console.log(fallos === 0 ? '\nTodo en orden.' : `\n${fallos} comprobación(es) fallaron.`);
process.exit(fallos === 0 ? 0 : 1);
