import { Body, Controller, Get, HttpCode, Inject, Param, Post, Put, Res } from '@nestjs/common';
import { ApiBearerAuth, ApiBody, ApiCreatedResponse, ApiNoContentResponse, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import type { IdentidadVerificada } from '@sig/autenticacion';
import type {
  AprobarSolicitudUseCase,
  CambiarRolUseCase,
  DarDeBajaUseCase,
  DescartarSolicitudUseCase,
  ListarPersonasUseCase,
  PersonaDto,
  SolicitarAccesoUseCase,
} from '@sig/empresas';
import { Identidad } from '../autenticacion/identidad.js';
import { ParametroIdRuta, RespuestasProblema } from '../documentacion.js';
import { AprobacionSolicitudRequest, CambioDeRolRequest, PersonaResponse, PersonasResponse, PersonaVersionRequest, SolicitudAccesoResponse } from './dto.js';
import { APROBAR_SOLICITUD, CAMBIAR_ROL, DAR_DE_BAJA, DESCARTAR_SOLICITUD, LISTAR_PERSONAS, RELOJ_PERSONAS, SOLICITAR_ACCESO } from './tokens.js';

// Lectura TOLERANTE del cuerpo: solo se extraen los campos conocidos y qué es válido lo decide el caso de uso DESPUÉS de comprobar el
// permiso (orden 401 → 403 → 400 → 404 → 409). La empresa y la persona que actúa salen SOLO del token verificado.
const campos = (cuerpo: unknown): Record<string, unknown> => (typeof cuerpo === 'object' && cuerpo !== null && !Array.isArray(cuerpo) ? (cuerpo as Record<string, unknown>) : {});

const persona = (p: PersonaDto): PersonaResponse => ({
  id: p.id,
  nombre: p.nombre,
  correo: p.correo,
  rol: p.rol,
  bajaEn: p.bajaEn === null ? null : p.bajaEn.toISOString(),
  version: p.version,
});

/**
 * Personas de la empresa y solicitudes de acceso (ADR 036). Los 403, 404 y 409 los traduce el filtro global. Solo composición: las
 * reglas (permiso, validación, último administrador, versión) viven en los casos de uso.
 */
@ApiBearerAuth('bearerAuth')
@ApiTags('personas')
@Controller()
export class PersonasController {
  constructor(
    @Inject(SOLICITAR_ACCESO) private readonly solicitarAcceso: SolicitarAccesoUseCase,
    @Inject(LISTAR_PERSONAS) private readonly listarPersonas: ListarPersonasUseCase,
    @Inject(APROBAR_SOLICITUD) private readonly aprobarSolicitud: AprobarSolicitudUseCase,
    @Inject(DESCARTAR_SOLICITUD) private readonly descartarSolicitud: DescartarSolicitudUseCase,
    @Inject(CAMBIAR_ROL) private readonly cambiarRol: CambiarRolUseCase,
    @Inject(DAR_DE_BAJA) private readonly darDeBaja: DarDeBajaUseCase,
    @Inject(RELOJ_PERSONAS) private readonly reloj: () => Date,
  ) {}

  /** 201 la primera vez; 200 si ya había una vigente (no es un error). No exige permiso: la persona aún no tiene rol. */
  @Post('acceso/solicitud')
  @ApiOperation({ operationId: 'solicitarAcceso' })
  @ApiCreatedResponse({ type: SolicitudAccesoResponse })
  @ApiOkResponse({ type: SolicitudAccesoResponse, description: 'Ya había una solicitud vigente; es la misma.' })
  @RespuestasProblema(401, 409, 429, 500)
  async solicitar(@Identidad() identidad: IdentidadVerificada, @Res({ passthrough: true }) respuesta: { status(codigo: number): unknown }): Promise<SolicitudAccesoResponse> {
    const r = await this.solicitarAcceso.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ahora: this.reloj() });
    respuesta.status(r.nueva ? 201 : 200);
    return { codigo: r.codigo, venceEn: r.venceEn.toISOString() };
  }

  @Get('personas')
  @ApiOperation({ operationId: 'listarPersonas' })
  @ApiOkResponse({ type: PersonasResponse })
  @RespuestasProblema(401, 403, 429, 500)
  async listar(@Identidad() identidad: IdentidadVerificada): Promise<PersonasResponse> {
    const r = await this.listarPersonas.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, ahora: this.reloj() });
    return {
      personas: r.personas.map(persona),
      solicitudes: r.solicitudes.map((s) => ({ id: s.id, usuarioId: s.usuarioId, codigo: s.codigo, creadaEn: s.creadaEn.toISOString(), venceEn: s.venceEn.toISOString() })),
    };
  }

  @Post('personas/solicitudes/:id/aprobacion')
  @ApiOperation({ operationId: 'aprobarSolicitudAcceso' })
  @ParametroIdRuta()
  @ApiBody({ type: AprobacionSolicitudRequest })
  @ApiCreatedResponse({ type: PersonaResponse })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async aprobar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<PersonaResponse> {
    const o = campos(cuerpo);
    return persona(
      await this.aprobarSolicitud.ejecutar({
        empresaId: identidad.empresaId,
        usuarioId: identidad.usuarioId,
        solicitudId: id,
        nombre: o['nombre'],
        correo: o['correo'],
        rol: o['rol'],
        ahora: this.reloj(),
      }),
    );
  }

  @Post('personas/solicitudes/:id/descarte')
  @HttpCode(204)
  @ApiOperation({ operationId: 'descartarSolicitudAcceso' })
  @ParametroIdRuta()
  @ApiNoContentResponse({ description: 'La solicitud se descartó.' })
  @RespuestasProblema(400, 401, 403, 404, 429, 500)
  async descartar(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada): Promise<void> {
    await this.descartarSolicitud.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, solicitudId: id, ahora: this.reloj() });
  }

  @Put('personas/:id/rol')
  @HttpCode(200)
  @ApiOperation({ operationId: 'cambiarRolPersona' })
  @ParametroIdRuta()
  @ApiBody({ type: CambioDeRolRequest })
  @ApiOkResponse({ type: PersonaResponse })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async rol(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<PersonaResponse> {
    const o = campos(cuerpo);
    return persona(await this.cambiarRol.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, personaId: id, rol: o['rol'], versionEsperada: o['versionEsperada'] }));
  }

  @Post('personas/:id/baja')
  @HttpCode(200)
  @ApiOperation({ operationId: 'darDeBajaPersona' })
  @ParametroIdRuta()
  @ApiBody({ type: PersonaVersionRequest })
  @ApiOkResponse({ type: PersonaResponse })
  @RespuestasProblema(400, 401, 403, 404, 409, 429, 500)
  async baja(@Param('id') id: string, @Identidad() identidad: IdentidadVerificada, @Body() cuerpo: unknown): Promise<PersonaResponse> {
    return persona(
      await this.darDeBaja.ejecutar({ empresaId: identidad.empresaId, usuarioId: identidad.usuarioId, personaId: id, versionEsperada: campos(cuerpo)['versionEsperada'], ahora: this.reloj() }),
    );
  }
}
