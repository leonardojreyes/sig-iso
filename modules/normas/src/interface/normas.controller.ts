import { Controller, Get, Inject } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { ListarNormasUseCase } from '../application/listar-normas.use-case.js';

export class NormaResponse {
  @ApiProperty({ type: String, example: 'ISO 9001' }) codigo!: string;
  @ApiProperty({ type: String, example: 'Gestión de la calidad' }) nombre!: string;
  @ApiProperty({ type: String, example: '2015' }) edicion!: string;
}

export const LISTAR_NORMAS = Symbol('LISTAR_NORMAS');

@ApiTags('normas')
@Controller('normas')
export class NormasController {
  constructor(@Inject(LISTAR_NORMAS) private readonly listarNormas: ListarNormasUseCase) {}

  @Get()
  @ApiOkResponse({ type: [NormaResponse] })
  listar(): Promise<NormaResponse[]> {
    return this.listarNormas.ejecutar();
  }
}
