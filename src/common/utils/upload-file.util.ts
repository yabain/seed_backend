import { promises as fs } from 'fs';
import { isAbsolute, join, relative } from 'path';
import { resolveUploadDir } from './upload-dir.util';

const SAFE_SEGMENT = /^[a-z0-9._-]+$/i;

/**
 * Supprime un fichier uploadé à partir du chemin tel que stocké
 * ('/uploads/name.ext', '/uploads/announcements/name.ext',
 * URL complète 'https://…/uploads/name.ext' ou nom nu 'name.ext').
 * Ignore silencieusement les valeurs vides, data: URLs, chemins
 * externes et fichiers inexistants. Ne jette jamais.
 */
export async function deleteUploadFile(storedPath?: string): Promise<void> {
  if (!storedPath || typeof storedPath !== 'string') {
    return;
  }
  let value = storedPath.trim();

  // URLs complètes : ne garder que la partie /uploads/...
  if (/^https?:\/\//i.test(value)) {
    try {
      value = new URL(value).pathname;
    } catch {
      return;
    }
  }

  if (!value || value.startsWith('data:')) {
    return;
  }

  value = value.replace(/^\//, '');
  if (value.startsWith('uploads/')) {
    value = value.slice('uploads/'.length);
  } else if (value === 'uploads') {
    return;
  }
  if (!value) {
    return;
  }

  const segments = value.split('/');
  if (
    segments.some((s) => !s || s === '.' || s === '..' || !SAFE_SEGMENT.test(s))
  ) {
    return;
  }

  const root = resolveUploadDir();
  const target = isAbsolute(value) ? value : join(root, value);
  if (relative(root, target).startsWith('..')) {
    return;
  }

  try {
    await fs.unlink(target);
  } catch {
    // Fichier déjà absent — ignoré
  }
}
