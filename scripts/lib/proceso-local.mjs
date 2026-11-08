// Utilidades mínimas para procesos de desarrollo lanzados en segundo plano (pid en un archivo). Solo Node.
import { readFileSync } from 'node:fs';

export const leerPid = (archivo) => {
  try {
    const texto = readFileSync(archivo, 'utf8').trim();
    if (!/^\d+$/.test(texto)) return null;
    const pid = Number(texto);
    return pid > 1 ? pid : null;
  } catch {
    return null;
  }
};

export const procesoVivo = (pid) => {
  try {
    process.kill(pid, 0);
    return true;
  } catch (e) {
    return e.code === 'EPERM';
  }
};
