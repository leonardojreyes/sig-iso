import clsx, { type ClassValue } from 'clsx';

export const cn = (...entradas: ClassValue[]): string => clsx(entradas);
