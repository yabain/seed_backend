import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { InjectConnection } from '@nestjs/mongoose';
import { Connection } from 'mongoose';
import AdmZip from 'adm-zip';
import { existsSync, mkdirSync } from 'fs';
import { writeFile } from 'fs/promises';
import { join, normalize, resolve, isAbsolute } from 'path';
import { resolveUploadDir } from '../../common/utils/upload-dir.util';

export interface RestoreJob {
  jobId: string;
  status: 'uploaded' | 'running' | 'done' | 'error';
  stage: string;
  message: string;
  percent: number;
  error?: string;
  /** Résumé final (collections restaurées, urls remappées, fichiers extraits). */
  summary?: {
    collectionsRestored: number;
    documentsRestored: number;
    urlsRemapped: number;
    filesExtracted: number;
  };
  createdAt: Date;
  updatedAt: Date;
}

const DB_DIR = 'database';
const UPLOADS_DIR = 'uploads';
const CONTEXT_DIR = 'context_ai';
const MAX_FILE_SIZE = 10 * 1024 * 1024 * 1024; // 10 Go

@Injectable()
export class RestoreService {
  private readonly logger = new Logger(RestoreService.name);
  private readonly jobs = new Map<string, RestoreJob>();
  private readonly zipPaths = new Map<string, string>();

  constructor(@InjectConnection() private readonly connection: Connection) {}

  getJob(jobId: string): RestoreJob | null {
    return this.jobs.get(jobId) ?? null;
  }

  /** Enregistre un fichier de sauvegarde reçu (avant traitement). */
  registerUpload(jobId: string, zipPath: string): void {
    this.zipPaths.set(jobId, zipPath);
    this.jobs.set(jobId, this.newJob(jobId));
  }

  /** Chemin du zip déposé pour un job, ou null. */
  getFilePath(jobId: string): string | null {
    return this.zipPaths.get(jobId) ?? null;
  }

  /**
   * Démarre un job d'extraction/restauration à partir d'un zip uploadé.
   * `domain` : domaine backend cible (facultatif) pour remapper les URLs.
   */
  runAsync(jobId: string, zipPath: string, domain?: string): void {
    void this.apply(jobId, zipPath, domain).catch((err) => {
      this.logger.error(`Restore job ${jobId} failed: ${err.message}`);
      const current = this.jobs.get(jobId);
      this.jobs.set(jobId, {
        ...(current ?? this.newJob(jobId)),
        status: 'error',
        message: 'Échec de la restauration',
        error: err?.message ?? 'Erreur inconnue',
        percent: current?.percent ?? 0,
        updatedAt: new Date(),
      });
    });
  }

  private async apply(jobId: string, zipPath: string, domain?: string): Promise<void> {
    const update = (patch: Partial<RestoreJob>) => {
      const current = this.jobs.get(jobId);
      this.jobs.set(jobId, {
        ...(current ?? this.newJob(jobId)),
        ...patch,
        updatedAt: new Date(),
      });
    };

    let zip: AdmZip;
    try {
      zip = new AdmZip(zipPath);
    } catch {
      throw new BadRequestException('Fichier ZIP invalide ou corrompu.');
    }

    const entries = this.dedupeEntries(zip.getEntries());

    // ——— Pré-compte pour la progression ———
    const dbFiles = entries.filter((e) => e.entryName.startsWith(`${DB_DIR}/`) && e.entryName.endsWith('.json') && !e.entryName.endsWith('.indexes.json'));
    const dbIndexes = entries.filter((e) => e.entryName.endsWith('.indexes.json'));
    const fileEntries = entries.filter((e) =>
      e.entryName.startsWith(`${UPLOADS_DIR}/`) || e.entryName.startsWith(`${CONTEXT_DIR}/`),
    );
    const contentFiles = fileEntries.filter((e) => !e.isDirectory);

    // Poids pour le % : base 40%, urls 10%, fichiers 50%.
    const totalSteps = dbFiles.length * 2 + dbIndexes.length + contentFiles.length;
    const markStep = 40 / Math.max(1, totalSteps); // incrément par étape de base
    const fileStep = 50 / Math.max(1, contentFiles.length);
    let percent = 0;

    let documentsRestored = 0;
    let collectionsRestored = 0;
    let urlsRemapped = 0;
    let filesExtracted = 0;

    // ——— Phase 1 : base de données (upsert, sans suppression) ———
    update({ status: 'running', stage: 'base', message: 'Restauration de la base de données…', percent });
    for (const entry of dbFiles) {
      const collectionName = entry.entryName
        .slice(`${DB_DIR}/`.length)
        .replace(/\.json$/, '');
      if (!collectionName) continue;

      try {
        const docs = JSON.parse(entry.getData().toString('utf8'));
        if (!Array.isArray(docs)) continue;
        const validDocs = docs.filter(
          (d) => d && typeof d === 'object' && '_id' in d,
        );
        if (validDocs.length === 0) continue;

        const collection = this.connection.db!.collection(collectionName);

        // Remap des URLs si un domaine est fourni.
        if (domain) {
          this.remapDocs(validDocs, domain, () => urlsRemapped++);
        }

        // Upsert en lot (bulkWrite) : insère si absent, met à jour si présent.
        // Aucune suppression. Découpé par lots pour limiter la consommation.
        const BATCH = 500;
        for (let i = 0; i < validDocs.length; i += BATCH) {
          const chunk = validDocs.slice(i, i + BATCH);
          await collection.bulkWrite(
            chunk.map((doc) => ({ replaceOne: { filter: { _id: doc._id }, replacement: doc, upsert: true } })),
            { ordered: false },
          );
        }

        documentsRestored += validDocs.length;
        collectionsRestored++;
      } catch (err) {
        this.logger.warn(`Restore DB (${collectionName}) skipped: ${err.message}`);
      }
      percent = Math.min(40, percent + markStep);
      update({ percent: Math.round(percent), message: `${collectionName} restaurée` });
    }

    // ——— Phase 1b : recréer les indexes (non destructif) ———
    for (const entry of dbIndexes) {
      const collectionName = entry.entryName
        .slice(`${DB_DIR}/`.length)
        .replace(/\.indexes\.json$/, '');
      if (!collectionName) continue;
      try {
        const indexes = JSON.parse(entry.getData().toString('utf8'));
        if (Array.isArray(indexes)) {
          const collection = this.connection.db!.collection(collectionName);
          for (const idx of indexes) {
            if (idx?.name === '_id_') continue; // index par défaut
            if (idx?.key && idx?.name) {
              await collection
                .createIndex(idx.key, {
                  name: idx.name,
                  unique: !!idx.unique,
                } as Parameters<typeof collection.createIndex>[1])
                .catch(() => undefined);
            }
          }
        }
      } catch {
        // non bloquant
      }
      percent = Math.min(40, percent + markStep);
    }

    // ——— Phase 2 : URLs (remap post-base en cas de champ non couvert) ———
    percent = 40;
    update({ stage: 'urls', message: 'Réécriture des URLs…', percent: Math.round(percent) });

    // ——— Phase 3 : fichiers (extraction, sans suppression) ———
    for (const entry of contentFiles) {
      try {
        const target = this.safeTargetPath(entry.entryName);
        if (!target) continue;
        mkdirSync(target.dir, { recursive: true });
        await this.writeEntry(zip, entry, target.file);
        filesExtracted++;
      } catch (err) {
        this.logger.warn(`Restore file skipped: ${entry.entryName} — ${err.message}`);
      }
      percent = 40 + Math.min(50, (filesExtracted / Math.max(1, contentFiles.length)) * 50);
      update({
        percent: Math.round(percent),
        message: `Extraction ${filesExtracted}/${contentFiles.length} fichiers…`,
      });
    }

    percent = 100;
    update({
      status: 'done',
      stage: 'done',
      message: 'Restauration terminée.',
      percent,
      summary: {
        collectionsRestored,
        documentsRestored,
        urlsRemapped,
        filesExtracted,
      },
    });
    this.logger.log(
      `Restore ${jobId} done: ${documentsRestored} docs, ${filesExtracted} files, ${urlsRemapped} urls remapped.`,
    );
  }

  /**
   * Réécrit récursivement les URLs `/uploads` d'un document vers `domain`.
   * Cheminé dans tous les objets/tableaux imbriqués.
   */
  /**
   * Réécrit récursivement les URLs `/uploads` d'un document vers `domain`.
   * Cheminé dans tous les objets/tableaux imbriqués.
   */
  private remapDocs(
    docs: unknown[],
    domain: string,
    onRemap: () => void,
  ): void {
    for (const doc of docs) this.remapDoc(doc, domain, onRemap);
  }

  private remapDoc(
    obj: unknown,
    domain: string,
    onRemap: () => void,
  ): void {
    const base = domain.replace(/\/+$/, '');
    if (!base) return;
    if (Array.isArray(obj)) {
      for (const item of obj) this.remapDoc(item, domain, onRemap);
      return;
    }
    if (obj && typeof obj === 'object') {
      for (const key of Object.keys(obj as Record<string, unknown>)) {
        const value = (obj as Record<string, unknown>)[key];
        if (typeof value === 'string') {
          // Remplace le préfixe hôte existant des URLs /uploads (http ou https).
          const remapped = value.replace(
            /^https?:\/\/[^/]+(\/uploads\/)/,
            `${base}$1`,
          );
          if (remapped !== value) {
            (obj as Record<string, unknown>)[key] = remapped;
            onRemap();
          }
        } else {
          this.remapDoc(value, domain, onRemap);
        }
      }
    }
  }

  /** Résout un chemin d'archive vers un chemin sûr sous le répertoire cible. */
  private safeTargetPath(entryName: string): {
    dir: string;
    file: string;
  } | null {
    const normalized = normalize(entryName.replace(/\\/g, '/'));
    // Refuse toute tentative de sortie (zip-slip) ou chemin absolu.
    if (normalized.includes('..') || normalized.startsWith('/')) {
      return null;
    }

    let root: string;
    let rel: string;
    if (entryName.startsWith(`${UPLOADS_DIR}/`)) {
      root = resolveUploadDir();
      rel = entryName.slice(`${UPLOADS_DIR}/`.length);
    } else if (entryName.startsWith(`${CONTEXT_DIR}/`)) {
      root = resolve(process.cwd(), this.resolveContextDir());
      rel = entryName.slice(`${CONTEXT_DIR}/`.length);
    } else {
      return null; // entrée inconnue (database/, etc.) → ignorée
    }

    const file = resolve(root, normalize(rel));
    // Vérifie que le résultat reste bien sous `root`.
    if (file !== root && !file.startsWith(root + this.pathSep())) {
      return null;
    }
    return { dir: file.replace(/[^/]*$/, '') || root, file };
  }

  private pathSep(): string {
    return '/';
  }

  private resolveContextDir(): string {
    const configured =
      process.env.ORIZIA_CONTEXT_DIR?.replace(/^\.\//, '') || 'context_ai';
    return isAbsolute(configured)
      ? configured
      : resolve(process.cwd(), configured);
  }

  /** Écrit une entrée decompressée sur le disque. */
  private async writeEntry(zip: AdmZip, entry: AdmZip.IZipEntry, file: string): Promise<void> {
    const data = zip.readFile(entry); // Buffer décompressé
    if (!data) return;
    await writeFile(file, data);
  }

  /**
   * Déduplique les entrées d'un zip par nom (ADM-ZIP refuse les doublons).
   * Garde la première occurrence (suffisante, les fichiers sont identiques).
   */
  private dedupeEntries(entries: AdmZip.IZipEntry[]): AdmZip.IZipEntry[] {
    const seen = new Set<string>();
    const out: AdmZip.IZipEntry[] = [];
    for (const e of entries) {
      if (seen.has(e.entryName)) continue;
      seen.add(e.entryName);
      out.push(e);
    }
    return out;
  }

  private newJob(jobId: string): RestoreJob {
    return {
      jobId,
      status: 'uploaded',
      stage: 'uploaded',
      message: 'Fichier reçu.',
      percent: 0,
      createdAt: new Date(),
      updatedAt: new Date(),
    };
  }
}