import { responderContexto } from '../../../../src/auth/contexto';

export const dynamic = 'force-dynamic';
export const GET = async (peticion: Request, { params }: { params: Promise<{ empresa: string }> }) =>
  responderContexto((await params).empresa, peticion.headers);
