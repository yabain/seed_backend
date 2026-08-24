import { Injectable, Logger } from '@nestjs/common';
import { Interval } from '@nestjs/schedule';
import { AnnouncementsService } from './announcements.service';

/**
 * Processeur périodique des annonces : traite les envois programmés arrivés
 * à échéance et poursuit les vagues d'envoi en cours, avec verrou
 * distribué pour éviter tout double traitement.
 */
@Injectable()
export class AnnouncementsCronService {
  private readonly logger = new Logger(AnnouncementsCronService.name);
  private running = false;

  constructor(private readonly announcements: AnnouncementsService) {}

  @Interval('announcements-wave-processor', 10_000)
  async handleInterval() {
    if (this.running) return;
    this.running = true;
    try {
      await this.announcements.processScheduledAndSending();
    } catch (error) {
      this.logger.warn(
        'Cycle du processeur d’annonces en échec :',
        error instanceof Error ? error.message : error,
      );
    } finally {
      this.running = false;
    }
  }
}
