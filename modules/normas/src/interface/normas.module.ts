import { Module } from '@nestjs/common';
import { ListarNormasUseCase } from '../application/listar-normas.use-case.js';
import { NORMAS_REPOSITORY } from '../application/normas-repository.port.js';
import { NormasEnMemoriaRepository } from '../infrastructure/normas-en-memoria.repository.js';
import { LISTAR_NORMAS, NormasController } from './normas.controller.js';

@Module({
  controllers: [NormasController],
  providers: [
    { provide: NORMAS_REPOSITORY, useClass: NormasEnMemoriaRepository },
    {
      provide: LISTAR_NORMAS,
      inject: [NORMAS_REPOSITORY],
      useFactory: (repo: NormasEnMemoriaRepository) => new ListarNormasUseCase(repo),
    },
  ],
})
export class NormasModule {}
