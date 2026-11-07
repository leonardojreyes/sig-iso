import { Controller, Get } from '@nestjs/common';
import { ApiOkResponse, ApiProperty, ApiTags } from '@nestjs/swagger';
import { Publico } from './autenticacion/publico.decorator.js';

export class HealthResponse {
  @ApiProperty({ type: String, example: 'ok' }) status!: string;
  @ApiProperty({ type: String, example: '2026-11-04T12:00:00.000Z' }) time!: string;
}

@ApiTags('salud')
@Publico()
@Controller('health')
export class HealthController {
  @Get()
  @ApiOkResponse({ type: HealthResponse })
  check(): HealthResponse {
    return { status: 'ok', time: new Date().toISOString() };
  }
}
