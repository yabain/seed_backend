import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as fs from 'fs';
import * as path from 'path';
import * as zlib from 'zlib';
import * as XLSX from 'xlsx';

/** Extensions lues telles quelles (texte brut). */
const TEXT_EXTENSIONS = new Set(['.md', '.markdown', '.txt', '.csv', '.json', '.yml', '.yaml']);

/** Extensions prises en charge via un extracteur dédié. */
const SPREADSHEET_EXTENSIONS = new Set(['.xlsx', '.xls']);
const DOCX_EXTENSIONS = new Set(['.docx']);

const SUPPORTED = [...TEXT_EXTENSIONS, ...SPREADSHEET_EXTENSIONS, ...DOCX_EXTENSIONS].join(', ');

/**
 * Charge les fichiers de contexte d'Orizia depuis le répertoire pointé par
 * `ORIZIA_CONTEXT_DIR` (par défaut `./context_udm`).
 *
 * Les fichiers sont lus **une seule fois** au démarrage puis mis en cache : le
 * contexte est stable et ne provoque aucun accès disque par question. Ajouter ou
 * modifier un document nécessite donc un redémarrage du backend.
 */
@Injectable()
export class OriziaContextLoader {
  private readonly logger = new Logger(OriziaContextLoader.name);
  private cachedContext = '';
  private loadedFiles: string[] = [];
  private skippedFiles: string[] = [];

  constructor(private readonly config: ConfigService) {}

  /** Répertoire absolu des fichiers de contexte. */
  resolveDirectory(): string {
    const configured = this.config.get<string>('ORIZIA_CONTEXT_DIR') || './context_udm';
    return path.isAbsolute(configured) ? configured : path.resolve(process.cwd(), configured);
  }

  /** Fichiers effectivement injectés dans le contexte (diagnostic). */
  getLoadedFiles(): string[] {
    return [...this.loadedFiles];
  }

  /** Fichiers ignorés (format non pris en charge, illisible ou budget dépassé). */
  getSkippedFiles(): string[] {
    return [...this.skippedFiles];
  }

  /** Contexte mis en cache (chargé au démarrage du module). */
  get(): string {
    return this.cachedContext;
  }

  /** Charge (ou recharge) l'intégralité du répertoire de contexte. */
  load(): string {
    const dir = this.resolveDirectory();
    this.loadedFiles = [];
    this.skippedFiles = [];

    if (!fs.existsSync(dir)) {
      this.logger.warn(
        `Répertoire de contexte introuvable : ${dir}. Orizia répondra sans contexte documentaire.`,
      );
      this.cachedContext = '';
      return this.cachedContext;
    }

    const maxTotal = this.numberFromEnv('ORIZIA_CONTEXT_MAX_CHARS', 120_000);
    const maxPerFile = this.numberFromEnv('ORIZIA_CONTEXT_MAX_CHARS_PER_FILE', 40_000);

    const entries = fs
      .readdirSync(dir, { withFileTypes: true })
      .filter((entry) => entry.isFile())
      .map((entry) => entry.name)
      // Le préfixe numérique permet de maîtriser l'ordre de lecture.
      .sort((a, b) => a.localeCompare(b, 'fr', { numeric: true }));

    const blocks: string[] = [];
    let used = 0;

    for (const name of entries) {
      const extension = path.extname(name).toLowerCase();

      if (name.startsWith('.') || name.toLowerCase() === 'readme.md') {
        continue;
      }

      if (
        !TEXT_EXTENSIONS.has(extension) &&
        !SPREADSHEET_EXTENSIONS.has(extension) &&
        !DOCX_EXTENSIONS.has(extension)
      ) {
        this.skippedFiles.push(name);
        this.logger.warn(
          `Fichier de contexte ignoré : ${name} (formats acceptés : ${SUPPORTED}). Un PDF doit être converti en .docx, .md ou .txt.`,
        );
        continue;
      }

      let content = '';
      try {
        content = this.extract(path.join(dir, name), extension).trim();
      } catch (error) {
        this.skippedFiles.push(name);
        this.logger.warn(`Fichier de contexte illisible : ${name} (${(error as Error).message})`);
        continue;
      }

      if (!content) {
        continue;
      }

      if (content.length > maxPerFile) {
        this.logger.warn(
          `Fichier de contexte tronqué : ${name} (${content.length} > ${maxPerFile} caractères)`,
        );
        content = `${content.slice(0, maxPerFile)}\n[... contenu tronqué ...]`;
      }

      if (used + content.length > maxTotal) {
        this.skippedFiles.push(name);
        this.logger.warn(`Fichier de contexte ignoré (budget global atteint) : ${name}`);
        continue;
      }

      used += content.length;
      this.loadedFiles.push(name);
      blocks.push(`===== DOCUMENT : ${name} =====\n${content}\n===== FIN DOCUMENT : ${name} =====`);
    }

    this.cachedContext = blocks.join('\n\n');
    this.logger.log(
      `Contexte Orizia : ${this.loadedFiles.length} document(s), ${used} caractères (${dir})`,
    );
    if (this.skippedFiles.length) {
      this.logger.warn(`Fichiers de contexte ignorés : ${this.skippedFiles.join(', ')}`);
    }
    return this.cachedContext;
  }

  // --------------------------------------------------------------- extraction

  private extract(fullPath: string, extension: string): string {
    if (SPREADSHEET_EXTENSIONS.has(extension)) {
      return this.readSpreadsheet(fullPath);
    }
    if (DOCX_EXTENSIONS.has(extension)) {
      return this.readDocx(fullPath);
    }
    return fs.readFileSync(fullPath, 'utf-8');
  }

  private readSpreadsheet(fullPath: string): string {
    const workbook = XLSX.readFile(fullPath);
    const parts: string[] = [];
    for (const sheetName of workbook.SheetNames) {
      const sheet = workbook.Sheets[sheetName];
      if (!sheet) continue;
      const csv = XLSX.utils.sheet_to_csv(sheet, { blankrows: false });
      if (csv.trim()) {
        parts.push(`--- Feuille : ${sheetName} ---\n${csv.trim()}`);
      }
    }
    return parts.join('\n\n');
  }

  /**
   * Extraction du texte d'un `.docx` : un fichier Word est une archive ZIP
   * contenant `word/document.xml`. On lit l'entrée via le répertoire central du
   * ZIP puis on la décompresse avec `zlib` — sans ajouter de dépendance.
   */
  private readDocx(fullPath: string): string {
    const xml = this.readZipEntry(fs.readFileSync(fullPath), 'word/document.xml');
    if (!xml) {
      return '';
    }
    return xml
      .replace(/<w:tab\b[^>]*\/?>/g, '\t')
      .replace(/<w:br\b[^>]*\/?>/g, '\n')
      .replace(/<\/w:p>/g, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&lt;/g, '<')
      .replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"')
      .replace(/&#39;/g, "'")
      .replace(/&amp;/g, '&')
      .replace(/[ \t]+\n/g, '\n')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  }

  /** Lit une entrée d'une archive ZIP en mémoire (sans dépendance externe). */
  private readZipEntry(buffer: Buffer, entryName: string): string | null {
    // End Of Central Directory (signature 0x06054b50), recherché depuis la fin.
    let eocd = -1;
    const lowest = Math.max(0, buffer.length - 66_000);
    for (let i = buffer.length - 22; i >= lowest; i--) {
      if (buffer.readUInt32LE(i) === 0x06054b50) {
        eocd = i;
        break;
      }
    }
    if (eocd < 0) return null;

    const entryCount = buffer.readUInt16LE(eocd + 10);
    let cursor = buffer.readUInt32LE(eocd + 16);

    for (let index = 0; index < entryCount; index++) {
      if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== 0x02014b50) {
        return null;
      }
      const method = buffer.readUInt16LE(cursor + 10);
      const compressedSize = buffer.readUInt32LE(cursor + 20);
      const nameLength = buffer.readUInt16LE(cursor + 28);
      const extraLength = buffer.readUInt16LE(cursor + 30);
      const commentLength = buffer.readUInt16LE(cursor + 32);
      const localOffset = buffer.readUInt32LE(cursor + 42);
      const name = buffer.toString('utf-8', cursor + 46, cursor + 46 + nameLength);

      if (name === entryName) {
        if (buffer.readUInt32LE(localOffset) !== 0x04034b50) {
          return null;
        }
        const localNameLength = buffer.readUInt16LE(localOffset + 26);
        const localExtraLength = buffer.readUInt16LE(localOffset + 28);
        const dataStart = localOffset + 30 + localNameLength + localExtraLength;
        const data = buffer.subarray(dataStart, dataStart + compressedSize);
        const inflated = method === 0 ? data : zlib.inflateRawSync(data);
        return inflated.toString('utf-8');
      }

      cursor += 46 + nameLength + extraLength + commentLength;
    }
    return null;
  }

  private numberFromEnv(key: string, fallback: number): number {
    const parsed = Number(this.config.get<string>(key));
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  }
}
