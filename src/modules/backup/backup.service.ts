import { Injectable } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import { ZipArchive } from 'archiver';
import { createReadStream, existsSync, statSync } from 'fs';
import { readdir } from 'fs/promises';
import { join } from 'path';
import { resolveUploadDir } from '../../common/utils/upload-dir.util';

type ZipArchiveInstance = InstanceType<typeof ZipArchive>;

/**
 * Contenu d'un fichier/branche à ajouter au zip.
 */
interface ArchiveEntry {
  /** Nom dans l'archive (ex. `uploads/news/x.webp`). */
  name: string;
  /** Chemin absolu sur le disque (fichier ou répertoire). */
  path: string;
  isDirectory: boolean;
  size: number;
}

export interface BackupFile {
  /** Flux en lecture du zip. */
  stream: NodeJS.ReadableStream;
  /** Nom du fichier téléchargé (ex. BackupWebsite_2026-10-06_15-30.zip). */
  filename: string;
}

const DATABASE_DIR = 'database';
const UPLOADS_DIR = 'uploads';
const CONTEXT_DIR = 'context_udm';

@Injectable()
export class BackupService {
  constructor(@InjectConnection() private readonly connection: Connection) {}

  /** Construit l'archive BackupWebsite_<date>_<heure>.zip en streaming. */
  async createBackup(): Promise<BackupFile> {
    const timestamp = this.timestamp();
    const filename = `BackupWebsite_${timestamp}.zip`;

    const archive = new ZipArchive({
      zlib: { level: 9 },
    });

    // ── 1. Base de données : un fichier JSON par collection ─────────────────
    const listResult = (await this.connection.db!
      .listCollections()
      .toArray()) as Array<{ name: string }> | undefined;
    const rawCollections = listResult ?? [];
    for (const { name } of rawCollections) {
      if (!name) continue;
      const docs = (await this.connection.db!
        .collection(name)
        .find()
        .toArray()) as unknown[];
      archive.append(JSON.stringify(docs ?? [], null, 2), {
        name: `${DATABASE_DIR}/${name}.json`,
      });

      // Exporter les indexes (nécessaires à une restauration fidèle).
      const indexes = (await this.connection.db!
        .collection(name)
        .listIndexes()
        .toArray()) as Array<unknown>;
      if (indexes && indexes.length > 0) {
        archive.append(JSON.stringify(indexes, null, 2), {
          name: `${DATABASE_DIR}/${name}.indexes.json`,
        });
      }
    }

    // ── 2. Fichiers uploadés (hors whatsapp-session) ────────────────────────
    const uploadRoot = resolveUploadDir();
    if (existsSync(uploadRoot)) {
      await this.appendDirectory(archive, uploadRoot, UPLOADS_DIR);
    }

    // ── 3. Contexte Orizia (context_udm) ────────────────────────────────────
    const contextRoot = this.resolveContextDir();
    if (existsSync(contextRoot)) {
      await this.appendDirectory(archive, contextRoot, CONTEXT_DIR);
    }

    archive.finalize();

    return { stream: archive, filename };
  }

  /** Ajoute récursivement les FICHIERS d'un répertoire à l'archive. */
  private async appendDirectory(
    archive: ZipArchiveInstance,
    sourceDir: string,
    zipRoot: string,
  ): Promise<void> {
    // N'ajoute que les fichiers : les dossiers parent du zip sont créés de
    // façon implicite par les chemins. Évite les doublons (ne pas appeler
    // archive.directory() qui recrée toute l'arborescence en plus).
    const entries = await this.collectEntries(sourceDir, zipRoot);
    for (const entry of entries) {
      if (!entry.isDirectory) {
        archive.append(createReadStream(entry.path), {
          name: entry.name,
        });
      }
    }
  }

  /**
   * Parcours récursif d'un répertoire (fichiers + dossiers non vides),
   * en convertissant les chemins absolus en chemins d'archive relatifs.
   */
  private async collectEntries(
    rootDir: string,
    prefix = '',
  ): Promise<ArchiveEntry[]> {
    const entries: ArchiveEntry[] = [];
    const items = await readdir(rootDir, { withFileTypes: true });

    for (const item of items) {
      if (item.name === 'whatsapp-session') continue; // exclu
      if (item.name.startsWith('.') && item.name !== '.') continue; // dotfiles

      const absolutePath = join(rootDir, item.name);
      const archiveName = prefix ? `${prefix}/${item.name}` : item.name;

      if (item.isDirectory()) {
        // N'ajoute le dossier que s'il contient quelque chose (évite les vides).
        const children = await readdir(absolutePath, { withFileTypes: true });
        const hasContent = children.some((c) => c.name !== 'whatsapp-session');
        if (hasContent) {
          entries.push({
            name: archiveName,
            path: absolutePath,
            isDirectory: true,
            size: 0,
          });
          entries.push(...(await this.collectEntries(absolutePath, archiveName)));
        }
      } else {
        const size = existsSync(absolutePath) ? statSync(absolutePath).size : 0;
        entries.push({ name: archiveName, path: absolutePath, isDirectory: false, size });
      }
    }
    return entries;
  }

  /** Résout le répertoire de contexte d'Orizia (défaut `{cwd}/context_udm`). */
  private resolveContextDir(): string {
    const configured =
      process.env.ORIZIA_CONTEXT_DIR?.replace(/^\.\//, '') || 'context_udm';
    return join(process.cwd(), configured);
  }

  /** Nom de fichier horodaté : YYYY-MM-DD_HH-mm. */
  private timestamp(): string {
    const pad = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    return [
      now.getFullYear(),
      pad(now.getMonth() + 1),
      pad(now.getDate()),
    ].join('-') + '_' + [pad(now.getHours()), pad(now.getMinutes())].join('-');
  }
}