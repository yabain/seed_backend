import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { Team, TeamDocument } from './schemas/team.schema';
import { CreateTeamDto } from './dto/create-team.dto';
import { CreateTeamSectionDto } from './dto/create-team-section.dto';
import { UpdateTeamSectionDto } from './dto/update-team-section.dto';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';
import { deleteUploadFile } from '../../common/utils/upload-file.util';

export interface TeamMemberListFilters {
  search?: string;
  sectionId?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class TeamService {
  constructor(
    @InjectModel(Team.name) private readonly teamModel: Model<TeamDocument>,
  ) {}

  private async getOrCreate(): Promise<TeamDocument> {
    let team = await this.teamModel.findOne().exec();
    if (!team) {
      team = await this.teamModel.create({ sections: [], members: [] });
    }
    return team;
  }

  /** Contenu public de la page « Équipe » (membres actifs uniquement). */
  async getPage(): Promise<Team> {
    const team = await this.getOrCreate();
    const obj = team.toObject();
    obj.sections = obj.sections ?? [];
    obj.members = (obj.members ?? []).filter((m: any) => m.isActive !== false);
    return obj;
  }

  /* ============== Sections ============== */

  async listSections() {
    const team = await this.getOrCreate();
    return team.sections;
  }

  async createSection(dto: CreateTeamSectionDto) {
    const team = await this.getOrCreate();
    const section = {
      title: dto.title.trim(),
      subtitle: dto.subtitle?.trim() ?? '',
      isActive: dto.isActive ?? true,
    };
    team.sections.push(section as any);
    await team.save();
    return team.sections[team.sections.length - 1];
  }

  async updateSection(id: string, dto: UpdateTeamSectionDto) {
    const team = await this.getOrCreate();
    const index = team.sections.findIndex((s) => (s as any)._id?.toString() === id);
    if (index === -1) {
      throw new NotFoundException('Section introuvable');
    }
    if (dto.title !== undefined) team.sections[index].title = dto.title.trim();
    if (dto.subtitle !== undefined) team.sections[index].subtitle = dto.subtitle?.trim() ?? '';
    if (dto.isActive !== undefined) team.sections[index].isActive = dto.isActive;
    await team.save();
    return team.sections[index];
  }

  async removeSection(id: string): Promise<{ deleted: boolean }> {
    const team = await this.getOrCreate();
    const initialLength = team.sections.length;
    team.sections = team.sections.filter((s) => (s as any)._id?.toString() !== id);
    if (team.sections.length === initialLength) {
      throw new NotFoundException('Section introuvable');
    }
    // Détacher les membres liés à la section supprimée
    await this.detachSectionFromMembers(team, id);
    await team.save();
    return { deleted: true };
  }

  private async detachSectionFromMembers(team: TeamDocument, sectionId: string): Promise<void> {
    for (const member of team.members || []) {
      if (member.sectionIds?.includes(sectionId)) {
        member.sectionIds = member.sectionIds.filter((s) => s !== sectionId);
      }
    }
  }

  /* ============== Membres ============== */

  /** Liste paginée des membres, avec recherche textuelle et filtre par section. */
  async listMembers(filters: TeamMemberListFilters) {
    const team = await this.getOrCreate();
    const members = (team.members ?? []) as any[];

    const keyword = filters.search?.trim().toLowerCase();
    let result = members;
    if (keyword) {
      result = result.filter((m) => {
        const haystack = [m.name, m.role, m.photo]
          .filter(Boolean)
          .map((v) => String(v).toLowerCase())
          .join(' ');
        return haystack.includes(keyword);
      });
    }
    if (filters.sectionId) {
      result = result.filter((m) =>
        (m.sectionIds ?? []).includes(filters.sectionId),
      );
    }

    const safePage = Number.isFinite(filters.page)
      ? Math.max(1, Number(filters.page))
      : 1;
    const safeLimit = Number.isFinite(filters.limit)
      ? Math.min(100, Math.max(1, Number(filters.limit)))
      : 10;
    const totalItems = result.length;
    const totalPages = Math.max(1, Math.ceil(totalItems / safeLimit));
    const start = (safePage - 1) * safeLimit;

    return {
      data: result.slice(start, start + safeLimit),
      pagination: {
        currentPage: safePage,
        totalPages,
        totalItems,
        hasNextPage: safePage * safeLimit < totalItems,
        hasPrevPage: safePage > 1,
        limit: safeLimit,
      },
    };
  }

  async findMember(id: string) {
    const team = await this.getOrCreate();
    const member = (team.members ?? []).find(
      (m) => (m as any)._id?.toString() === id,
    );
    if (!member) {
      throw new NotFoundException('Membre introuvable');
    }
    return member;
  }

  async createMember(dto: CreateTeamMemberDto) {
    const team = await this.getOrCreate();
    const member: any = {
      photo: dto.photo ?? '',
      name: dto.name.trim(),
      role: dto.role?.trim() ?? '',
      isActive: dto.isActive ?? true,
      socialLinks: {
        facebook: dto.socialLinks?.facebook?.trim() ?? '',
        twitter: dto.socialLinks?.twitter?.trim() ?? '',
        x: dto.socialLinks?.x?.trim() ?? '',
        linkedin: dto.socialLinks?.linkedin?.trim() ?? '',
        instagram: dto.socialLinks?.instagram?.trim() ?? '',
      },
      sectionIds: dto.sectionIds ?? [],
    };
    team.members.push(member);
    await team.save();
    return team.members[team.members.length - 1];
  }

  async updateMember(id: string, dto: UpdateTeamMemberDto) {
    const team = await this.getOrCreate();
    const index = team.members.findIndex(
      (m) => (m as any)._id?.toString() === id,
    );
    if (index === -1) {
      throw new NotFoundException('Membre introuvable');
    }
    const member: any = team.members[index];
    if (dto.photo !== undefined) member.photo = dto.photo;
    if (dto.name !== undefined) member.name = dto.name.trim();
    if (dto.role !== undefined) member.role = dto.role?.trim() ?? '';
    if (dto.isActive !== undefined) member.isActive = dto.isActive;
    if (dto.socialLinks !== undefined) {
      if (!member.socialLinks) member.socialLinks = {};
      if (dto.socialLinks.facebook !== undefined)
        member.socialLinks.facebook = dto.socialLinks.facebook.trim();
      if (dto.socialLinks.twitter !== undefined)
        member.socialLinks.twitter = dto.socialLinks.twitter.trim();
      if (dto.socialLinks.x !== undefined)
        member.socialLinks.x = dto.socialLinks.x.trim();
      if (dto.socialLinks.linkedin !== undefined)
        member.socialLinks.linkedin = dto.socialLinks.linkedin.trim();
      if (dto.socialLinks.instagram !== undefined)
        member.socialLinks.instagram = dto.socialLinks.instagram.trim();
    }
    if (dto.sectionIds !== undefined) member.sectionIds = dto.sectionIds;
    await team.save();
    return team.members[index];
  }

  async removeMember(id: string): Promise<{ deleted: boolean }> {
    const team = await this.getOrCreate();
    const previous = team.members.find(
      (m) => (m as any)._id?.toString() === id,
    );
    const initialLength = team.members.length;
    team.members = team.members.filter(
      (m) => (m as any)._id?.toString() !== id,
    );
    if (team.members.length === initialLength) {
      throw new NotFoundException('Membre introuvable');
    }
    if (previous?.photo) {
      await deleteUploadFile(previous.photo);
    }
    await team.save();
    return { deleted: true };
  }

  /* ============== Page (mise à jour globale) ============== */

  /** Remplace intégralement les sections et membres. */
  async update(dto: CreateTeamDto): Promise<Team> {
    const team = await this.getOrCreate();

    const previousPhotos = (team.members || []).map((m) => m.photo ?? '');

    if (dto.sections !== undefined) {
      team.sections = dto.sections.map((s) => ({
        title: s.title.trim(),
        subtitle: s.subtitle?.trim() ?? '',
        isActive: s.isActive ?? true,
      }));
    }

    if (dto.members !== undefined) {
      team.members = dto.members.map((m) => ({
        photo: m.photo ?? '',
        name: m.name.trim(),
        role: m.role?.trim() ?? '',
        isActive: m.isActive ?? true,
        socialLinks: {
          facebook: m.socialLinks?.facebook?.trim() ?? '',
          twitter: m.socialLinks?.twitter?.trim() ?? '',
          x: m.socialLinks?.x?.trim() ?? '',
          linkedin: m.socialLinks?.linkedin?.trim() ?? '',
          instagram: m.socialLinks?.instagram?.trim() ?? '',
        },
        sectionIds: m.sectionIds ?? [],
      }));

      await this.cleanupRemovedPhotos(previousPhotos, team.members);
    }

    await team.save();
    return team.toObject();
  }

  private async cleanupRemovedPhotos(
    previousPhotos: string[],
    currentMembers: Array<{ photo?: string }>,
  ): Promise<void> {
    const current = new Set(
      currentMembers.map((m) => (m.photo || '').trim()).filter(Boolean),
    );
    for (const photo of previousPhotos) {
      const trimmed = (photo || '').trim();
      if (trimmed && !current.has(trimmed)) {
        await deleteUploadFile(trimmed);
      }
    }
  }

  async remove(): Promise<{ deleted: boolean }> {
    const team = await this.teamModel.findOne().exec();
    if (team) {
      for (const member of team.members || []) {
        await deleteUploadFile(member.photo);
      }
      await team.deleteOne();
    }
    return { deleted: true };
  }
}
