import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectModel } from '@nestjs/mongoose';
import { Model, isValidObjectId } from 'mongoose';
import { Admin, AdminDocument } from '../auth/schemas/admin.schema';
import {
  RecruitmentCampaign,
  RecruitmentCampaignDocument,
  type RecruitmentCampaignStatus,
  type RecruitmentFieldType,
  type RecruitmentFileKind,
  type RecruitmentFormField,
} from './schemas/recruitment-campaign.schema';
import {
  RecruitmentApplication,
  RecruitmentApplicationDocument,
  type RecruitmentApplicationStatus,
} from './schemas/recruitment-application.schema';
import { CreateRecruitmentCampaignDto } from './dto/create-recruitment-campaign.dto';
import { UpdateRecruitmentCampaignDto } from './dto/update-recruitment-campaign.dto';
import {
  CreateRecruitmentApplicationDto,
  type RecruitmentApplicationFieldInputDto,
} from './dto/create-recruitment-application.dto';
import { UpdateRecruitmentApplicationStatusDto } from './dto/update-recruitment-application-status.dto';
import { MailService } from '../mail/mail.service';
import {
  recruitmentApplicationApprovedTemplate,
  recruitmentApplicationReceivedForAdminTemplate,
  recruitmentApplicationReceivedForApplicantTemplate,
  recruitmentApplicationRejectedTemplate,
} from '../mail/templates/recruitment.templates';
import { SiteService } from '../site/site.service';
import {
  emailSocialFromSiteConfig,
  emailLogoFromSiteConfig,
} from '../../common/utils/email-social.util';

const DEFAULT_FIELD_KEYS = new Set(['email', 'last_name', 'first_name']);

const ALLOWED_DOCUMENT_EXTENSIONS = [
  'pdf',
  'doc',
  'docx',
  'ppt',
  'pptx',
  'xls',
  'xlsx',
] as const;

const ALLOWED_IMAGE_EXTENSIONS = [
  'jpg',
  'jpeg',
  'png',
  'webp',
  'gif',
] as const;

const FILE_KIND_MIME_RULES: Record<
  RecruitmentFileKind,
  { mimePrefixes: string[]; extensions: readonly string[] }
> = {
  any: {
    mimePrefixes: ['application/', 'image/'],
    extensions: [...ALLOWED_DOCUMENT_EXTENSIONS, ...ALLOWED_IMAGE_EXTENSIONS],
  },
  image: {
    mimePrefixes: ['image/'],
    extensions: ALLOWED_IMAGE_EXTENSIONS,
  },
  document: {
    mimePrefixes: ['application/'],
    extensions: ALLOWED_DOCUMENT_EXTENSIONS,
  },
};

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

@Injectable()
export class RecruitmentsService {
  constructor(
    @InjectModel(RecruitmentCampaign.name)
    private readonly campaignModel: Model<RecruitmentCampaignDocument>,
    @InjectModel(RecruitmentApplication.name)
    private readonly applicationModel: Model<RecruitmentApplicationDocument>,
    @InjectModel(Admin.name)
    private readonly adminModel: Model<AdminDocument>,
    private readonly mailService: MailService,
    private readonly siteService: SiteService,
    private readonly configService: ConfigService,
  ) {}

  async findPublicCampaigns(query: {
    page?: number;
    limit?: number;
    search?: string;
  }): Promise<{
    items: RecruitmentCampaign[];
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);

    const filter: Record<string, unknown> = {
      status: 'published',
      endsAt: { $gte: new Date() },
    };

    const search = (query.search ?? '').trim();
    if (search) {
      const regex = { $regex: escapeRegExp(search), $options: 'i' };
      filter.$or = [{ title: regex }, { description: regex }];
    }

    const [items, total] = await Promise.all([
      this.campaignModel
        .find(filter)
        .sort({ startsAt: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.campaignModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async findVisibleOnLanding(limit = 10): Promise<RecruitmentCampaign[]> {
    return this.campaignModel
      .find({ status: 'published', isVisibleOnLanding: true })
      .sort({ startsAt: -1, createdAt: -1 })
      .limit(limit)
      .lean()
      .exec();
  }

  async findAdminCampaigns(query: {
    page?: number;
    limit?: number;
    search?: string;
    status?: RecruitmentCampaignStatus | 'all';
  }): Promise<{
    items: Array<
      RecruitmentCampaign & {
        totalApplications: number;
        processedApplications: number;
      }
    >;
    total: number;
    page: number;
    limit: number;
  }> {
    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 10, 1), 100);
    const filter: Record<string, unknown> = {};

    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }
    const search = (query.search ?? '').trim();
    if (search) {
      const regex = { $regex: escapeRegExp(search), $options: 'i' };
      filter.$or = [{ title: regex }, { description: regex }];
    }

    const [items, total] = await Promise.all([
      this.campaignModel
        .find(filter)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .lean()
        .exec(),
      this.campaignModel.countDocuments(filter).exec(),
    ]);

    const campaignIds = items.map((item) => String(item._id));
    const stats = campaignIds.length
      ? await this.applicationModel
          .aggregate<{
            _id: string;
            total: number;
            processed: number;
          }>([
            { $match: { campaignId: { $in: campaignIds } } },
            {
              $group: {
                _id: '$campaignId',
                total: { $sum: 1 },
                processed: {
                  $sum: {
                    $cond: [{ $eq: ['$status', 'pending'] }, 0, 1],
                  },
                },
              },
            },
          ])
          .exec()
      : [];

    const statsByCampaign = new Map(stats.map((entry) => [entry._id, entry]));

    const enriched = items.map((item) => {
      const campaignId = String(item._id);
      const stat = statsByCampaign.get(campaignId);
      return {
        ...item,
        totalApplications: stat?.total ?? 0,
        processedApplications: stat?.processed ?? 0,
      };
    });

    return { items: enriched, total, page, limit };
  }

  async findCampaignById(id: string): Promise<RecruitmentCampaign> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Campagne introuvable.');
    }
    const campaign = await this.campaignModel.findById(id).lean().exec();
    if (!campaign) {
      throw new NotFoundException('Campagne introuvable.');
    }
    return campaign;
  }

  async findPublicCampaignById(id: string): Promise<RecruitmentCampaign> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Campagne introuvable.');
    }
    const campaign = await this.campaignModel
      .findOne({ _id: id, status: 'published', endsAt: { $gte: new Date() } })
      .lean()
      .exec();
    if (!campaign) {
      throw new NotFoundException('Campagne introuvable.');
    }
    return campaign;
  }

  async createCampaign(
    dto: CreateRecruitmentCampaignDto,
  ): Promise<RecruitmentCampaign> {
    this.ensureDateRange(dto.startsAt, dto.endsAt);

    const formFields = this.normalizeAndValidateFormFields(dto.formFields);
    const campaign = new this.campaignModel({
      title: dto.title.trim(),
      description: (dto.description ?? '').trim(),
      contentHtml: (dto.contentHtml ?? '').trim(),
      image: (dto.image ?? '').trim(),
      startsAt: new Date(dto.startsAt),
      endsAt: new Date(dto.endsAt),
      status: dto.status ?? 'published',
      formFields,
      downloadableFile: this.normalizeDownloadableFile(dto),
      archivedAt: dto.status === 'archived' ? new Date() : null,
    });

    return campaign.save();
  }

  async updateCampaign(
    id: string,
    dto: UpdateRecruitmentCampaignDto,
  ): Promise<RecruitmentCampaign> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Campagne introuvable.');
    }
    const current = await this.campaignModel.findById(id).exec();
    if (!current) {
      throw new NotFoundException('Campagne introuvable.');
    }

    const startsAt = dto.startsAt ? new Date(dto.startsAt) : current.startsAt;
    const endsAt = dto.endsAt ? new Date(dto.endsAt) : current.endsAt;
    this.ensureDateRange(startsAt.toISOString(), endsAt.toISOString());

    if (dto.title !== undefined) current.title = dto.title.trim();
    if (dto.description !== undefined)
      current.description = dto.description.trim();
    if (dto.contentHtml !== undefined)
      current.contentHtml = dto.contentHtml.trim();
    if (dto.image !== undefined) current.image = dto.image.trim();
    if (dto.startsAt !== undefined) current.startsAt = startsAt;
    if (dto.endsAt !== undefined) current.endsAt = endsAt;

    if (dto.formFields) {
      current.formFields = this.normalizeAndValidateFormFields(dto.formFields);
    }

    if (dto.downloadableFile !== undefined) {
      current.downloadableFile = this.normalizeDownloadableFile(dto);
    }

    if (dto.status !== undefined) {
      current.status = dto.status;
      current.archivedAt = dto.status === 'archived' ? new Date() : null;
    }

    await current.save();
    return current.toObject();
  }

  async toggleCampaignStatus(id: string): Promise<RecruitmentCampaign> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Campagne introuvable.');
    }
    const campaign = await this.campaignModel.findById(id).exec();
    if (!campaign) {
      throw new NotFoundException('Campagne introuvable.');
    }
    campaign.status = campaign.status === 'published' ? 'archived' : 'published';
    campaign.archivedAt = campaign.status === 'archived' ? new Date() : null;
    await campaign.save();
    return campaign.toObject();
  }

  async duplicateCampaign(id: string): Promise<RecruitmentCampaign> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Campagne introuvable.');
    }
    const source = await this.campaignModel.findById(id).lean().exec();
    if (!source) {
      throw new NotFoundException('Campagne introuvable.');
    }

    const duplicate = new this.campaignModel({
      ...source,
      _id: undefined,
      title: `${source.title} (copie)`,
      status: 'archived',
      archivedAt: new Date(),
      duplicatedFrom: String(source._id),
    });

    return duplicate.save();
  }

  async removeCampaign(id: string): Promise<{ deleted: boolean }> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Campagne introuvable.');
    }

    const campaign = await this.campaignModel.findByIdAndDelete(id).exec();
    if (!campaign) {
      throw new NotFoundException('Campagne introuvable.');
    }

    await this.applicationModel.deleteMany({ campaignId: id }).exec();
    return { deleted: true };
  }

  async createApplication(
    campaignId: string,
    dto: CreateRecruitmentApplicationDto,
  ): Promise<RecruitmentApplication> {
    const campaign = await this.findCampaignById(campaignId);
    if (campaign.status !== 'published') {
      throw new BadRequestException(
        'Cette campagne est archivée et n’accepte plus de candidatures.',
      );
    }

    const now = new Date();
    if (now < new Date(campaign.startsAt) || now > new Date(campaign.endsAt)) {
      throw new BadRequestException(
        'Cette campagne est fermée pour le moment.',
      );
    }

    const email = dto.email.toLowerCase().trim();
    const alreadyExists = await this.applicationModel
      .findOne({ campaignId, email })
      .lean()
      .exec();
    if (alreadyExists) {
      throw new BadRequestException(
        'Cet e-mail a déjà été utilisé pour cette campagne.',
      );
    }

    const fields = this.validateApplicationFields(campaign, dto.fields);

    const application = await this.applicationModel.create({
      campaignId,
      campaignTitle: campaign.title,
      email,
      firstName: dto.firstName.trim(),
      lastName: dto.lastName.trim(),
      status: 'pending',
      fields,
      reviewedBy: '',
      reviewedByRole: '',
      reviewedAt: null,
      reviewNote: '',
    });

    await this.sendApplicationCreatedEmails(
      campaign,
      application.toObject() as RecruitmentApplication,
    );

    return application;
  }

  async findCampaignApplications(
    campaignId: string,
    query: {
      page?: number;
      limit?: number;
      search?: string;
      status?: RecruitmentApplicationStatus | 'all';
    },
  ): Promise<{
    items: RecruitmentApplication[];
    total: number;
    page: number;
    limit: number;
  }> {
    await this.findCampaignById(campaignId);

    const page = Math.max(Number(query.page) || 1, 1);
    const limit = Math.min(Math.max(Number(query.limit) || 20, 1), 100);
    const filter: Record<string, unknown> = { campaignId };

    if (query.status && query.status !== 'all') {
      filter.status = query.status;
    }

    const search = (query.search ?? '').trim();
    if (search) {
      filter.$or = [
        { email: { $regex: escapeRegExp(search), $options: 'i' } },
        { firstName: { $regex: escapeRegExp(search), $options: 'i' } },
        { lastName: { $regex: escapeRegExp(search), $options: 'i' } },
      ];
    }

    const [items, total] = await Promise.all([
      this.applicationModel
        .aggregate<RecruitmentApplication>([
          { $match: filter },
          {
            $addFields: {
              statusSort: {
                $switch: {
                  branches: [
                    { case: { $eq: ['$status', 'pending'] }, then: 0 },
                    { case: { $eq: ['$status', 'approved'] }, then: 1 },
                    { case: { $eq: ['$status', 'rejected'] }, then: 2 },
                  ],
                  default: 99,
                },
              },
            },
          },
          { $sort: { statusSort: 1, createdAt: 1, reviewedAt: 1 } },
          { $skip: (page - 1) * limit },
          { $limit: limit },
          { $project: { statusSort: 0 } },
        ])
        .exec(),
      this.applicationModel.countDocuments(filter).exec(),
    ]);

    return { items, total, page, limit };
  }

  async findApplicationById(id: string): Promise<RecruitmentApplication> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Candidature introuvable.');
    }
    const application = await this.applicationModel.findById(id).lean().exec();
    if (!application) {
      throw new NotFoundException('Candidature introuvable.');
    }
    return application;
  }

  async updateApplicationStatus(
    id: string,
    dto: UpdateRecruitmentApplicationStatusDto,
    actor?: { id?: string; role?: string },
  ): Promise<RecruitmentApplication> {
    if (!isValidObjectId(id)) {
      throw new NotFoundException('Candidature introuvable.');
    }
    const application = await this.applicationModel.findById(id).exec();
    if (!application) {
      throw new NotFoundException('Candidature introuvable.');
    }

    const previousStatus = application.status;
    application.status = dto.status;
    application.reviewedAt = new Date();
    application.reviewedBy = actor?.id ?? '';
    application.reviewedByRole = actor?.role ?? '';
    application.reviewNote = (dto.note ?? '').trim();

    await application.save();

    if (previousStatus !== dto.status) {
      const campaign = await this.findCampaignById(application.campaignId);
      await this.sendApplicationDecisionEmail(
        campaign,
        application.toObject() as RecruitmentApplication,
      );
    }

    return application.toObject();
  }

  private ensureDateRange(startsAt: string, endsAt: string): void {
    const start = new Date(startsAt);
    const end = new Date(endsAt);
    if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
      throw new BadRequestException('Dates invalides.');
    }
    if (start >= end) {
      throw new BadRequestException(
        'La date de fin doit être postérieure à la date de début.',
      );
    }
  }

  private normalizeAndValidateFormFields(
    input: CreateRecruitmentCampaignDto['formFields'],
  ): RecruitmentCampaign['formFields'] {
    const normalized = (input ?? []).map((field) => {
      const key = field.key.trim().toLowerCase();
      const label = field.label.trim();
      const type = field.type as RecruitmentFieldType;
      const required = DEFAULT_FIELD_KEYS.has(key) ? true : !!field.required;
      const fileKind =
        type === 'file' ? (field.fileKind ?? 'document') : 'any';
      const maxSizeMb =
        type === 'file'
          ? Math.max(1, Math.min(50, Number(field.maxSizeMb ?? 10)))
          : 10;

      return {
        key,
        label,
        type,
        required,
        placeholder: (field.placeholder ?? '').trim(),
        helpText: (field.helpText ?? '').trim(),
        fileKind,
        maxSizeMb,
      };
    });

    if (!normalized.length) {
      throw new BadRequestException(
        'Le formulaire doit contenir au moins un champ.',
      );
    }

    const requiredDefaults = ['email', 'last_name', 'first_name'];
    const byKey = new Map(normalized.map((field) => [field.key, field]));

    for (const key of requiredDefaults) {
      const field = byKey.get(key);
      if (!field) {
        throw new BadRequestException(
          `Le champ obligatoire « ${key} » est manquant dans le formulaire.`,
        );
      }
      if (!field.required) {
        field.required = true;
      }
    }

    if (byKey.get('email')?.type !== 'email') {
      throw new BadRequestException(
        'Le champ « email » doit être de type e-mail.',
      );
    }

    if (byKey.get('last_name')?.type !== 'text') {
      throw new BadRequestException(
        'Le champ « last_name » doit être de type texte.',
      );
    }

    if (byKey.get('first_name')?.type !== 'text') {
      throw new BadRequestException(
        'Le champ « first_name » doit être de type texte.',
      );
    }

    const duplicate = normalized.find(
      (field, index) => normalized.findIndex((it) => it.key === field.key) !== index,
    );
    if (duplicate) {
      throw new BadRequestException(
        `Clé de champ dupliquée : ${duplicate.key}.`,
      );
    }

    return normalized;
  }

  private normalizeDownloadableFile(
    dto: {
      downloadableFile?: {
        url?: string;
        name?: string;
        type?: string;
        size?: number;
      };
    },
  ) {
    if (!dto.downloadableFile) {
      return null;
    }

    const url = (dto.downloadableFile.url ?? '').trim();
    const name = (dto.downloadableFile.name ?? '').trim();
    const type = (dto.downloadableFile.type ?? '').trim();
    const size = Number(dto.downloadableFile.size ?? 0);

    if (!url) {
      return null;
    }

    return {
      url,
      name,
      type,
      size: Number.isFinite(size) ? Math.max(0, size) : 0,
    };
  }

  private validateApplicationFields(
    campaign: RecruitmentCampaign,
    inputFields: RecruitmentApplicationFieldInputDto[],
  ): RecruitmentApplication['fields'] {
    const payloadByKey = new Map(inputFields.map((field) => [field.key, field]));

    const validated = campaign.formFields.map((definition) => {
      const payload = payloadByKey.get(definition.key);

      if (!payload) {
        if (definition.required) {
          throw new BadRequestException(
            `Le champ « ${definition.label} » est obligatoire.`,
          );
        }
        return {
          key: definition.key,
          label: definition.label,
          type: definition.type,
          value: '',
          fileUrl: '',
          fileName: '',
          fileType: '',
          fileSize: 0,
        };
      }

      if (definition.type === 'file') {
        return this.validateFileField(definition, payload);
      }

      const value = (payload.value ?? '').trim();
      if (!value && definition.required) {
        throw new BadRequestException(
          `Le champ « ${definition.label} » est obligatoire.`,
        );
      }

      this.validateTextValue(definition.type, definition.label, value);

      return {
        key: definition.key,
        label: definition.label,
        type: definition.type,
        value,
        fileUrl: '',
        fileName: '',
        fileType: '',
        fileSize: 0,
      };
    });

    return validated;
  }

  private validateTextValue(
    type: RecruitmentFieldType,
    label: string,
    value: string,
  ): void {
    if (!value) {
      return;
    }

    if (type === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
      if (!emailRegex.test(value)) {
        throw new BadRequestException(`Le champ « ${label} » doit être un e-mail valide.`);
      }
      return;
    }

    if (type === 'number') {
      if (Number.isNaN(Number(value))) {
        throw new BadRequestException(
          `Le champ « ${label} » doit être une valeur numérique.`,
        );
      }
      return;
    }

    if (type === 'url') {
      try {
        const url = new URL(value);
        if (!['http:', 'https:'].includes(url.protocol)) {
          throw new Error('protocol');
        }
      } catch {
        throw new BadRequestException(
          `Le champ « ${label} » doit être une URL valide.`,
        );
      }
      return;
    }

    if (type === 'tel') {
      const phoneRegex = /^(\+[1-9][0-9]{7,14}|00[1-9][0-9]{7,14}|[0-9]{8,15})$/;
      const normalized = value.replace(/[\s().-]/g, '');
      if (!phoneRegex.test(normalized)) {
        throw new BadRequestException(
          `Le champ « ${label} » doit être un numéro valide.`,
        );
      }
      return;
    }

    if (type === 'date') {
      const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
      if (!dateRegex.test(value) || Number.isNaN(new Date(value).getTime())) {
        throw new BadRequestException(
          `Le champ « ${label} » doit être une date valide.`,
        );
      }
    }
  }

  private validateFileField(
    definition: RecruitmentFormField,
    payload: RecruitmentApplicationFieldInputDto,
  ) {
    const file = payload.file;
    if (!file) {
      if (definition.required) {
        throw new BadRequestException(
          `Le champ fichier « ${definition.label} » est obligatoire.`,
        );
      }
      return {
        key: definition.key,
        label: definition.label,
        type: definition.type,
        value: '',
        fileUrl: '',
        fileName: '',
        fileType: '',
        fileSize: 0,
      };
    }

    const fileName = file.fileName.trim();
    const fileType = file.fileType.trim().toLowerCase();
    const fileUrl = file.fileUrl.trim();
    const fileSize = Number(file.fileSize ?? 0);

    if (!fileName || !fileType || !fileUrl) {
      throw new BadRequestException(
        `Le fichier du champ « ${definition.label} » est invalide.`,
      );
    }

    const maxBytes = Math.max(1, definition.maxSizeMb) * 1024 * 1024;
    if (!Number.isFinite(fileSize) || fileSize <= 0 || fileSize > maxBytes) {
      throw new BadRequestException(
        `Le fichier « ${definition.label} » dépasse la taille maximale autorisée (${definition.maxSizeMb} Mo).`,
      );
    }

    this.assertFileTypeAllowed(definition.fileKind, fileName, fileType, definition.label);

    return {
      key: definition.key,
      label: definition.label,
      type: definition.type,
      value: '',
      fileUrl,
      fileName,
      fileType,
      fileSize,
    };
  }

  private assertFileTypeAllowed(
    kind: RecruitmentFileKind,
    fileName: string,
    mimeType: string,
    label: string,
  ): void {
    const rule = FILE_KIND_MIME_RULES[kind] ?? FILE_KIND_MIME_RULES.any;
    const extension = fileName.split('.').pop()?.toLowerCase() ?? '';

    const mimeOk = rule.mimePrefixes.some((prefix) => mimeType.startsWith(prefix));
    const extensionOk = rule.extensions.includes(
      extension as (typeof rule.extensions)[number],
    );

    if (!mimeOk || !extensionOk) {
      if (kind === 'image') {
        throw new BadRequestException(
          `Le fichier « ${label} » doit être une image valide (jpg, png, webp, gif).`,
        );
      }
      if (kind === 'document') {
        throw new BadRequestException(
          `Le fichier « ${label} » doit être un document valide (pdf, doc, docx, ppt, pptx, xls, xlsx).`,
        );
      }
      throw new BadRequestException(
        `Le type de fichier fourni pour « ${label} » n'est pas autorisé.`,
      );
    }
  }

  private async sendApplicationCreatedEmails(
    campaign: RecruitmentCampaign,
    application: RecruitmentApplication,
  ): Promise<void> {
    const siteConfig = await this.siteService.getPublicConfig();
    const branding = {
      logo: this.siteService.resolveMediaUrl(emailLogoFromSiteConfig(siteConfig, this.configService)),
      orgName: siteConfig.orgName,
      social: emailSocialFromSiteConfig(siteConfig, this.configService),
    };
    const colors = {
      primary: siteConfig.primaryColor,
      secondary: siteConfig.secondaryColor,
    };

    const applicant = {
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
    };

    const recapFields = application.fields
      .filter((field) => field.key !== 'email')
      .map((field) => ({
        label: field.label,
        value:
          field.type === 'file'
            ? field.fileName || 'Fichier transmis'
            : field.value || '—',
      }));

    await this.mailService.send({
      to: application.email,
      subject: `Candidature reçue — ${campaign.title}`,
      html: recruitmentApplicationReceivedForApplicantTemplate({
        campaignTitle: campaign.title,
        applicant,
        fields: recapFields,
        colors,
        branding,
      }),
    });

    const recipients = await this.resolveRecruitmentRecipients();
    if (recipients.length) {
      await this.mailService.send({
        to: recipients,
        subject: `Nouvelle candidature — ${campaign.title}`,
        html: recruitmentApplicationReceivedForAdminTemplate({
          campaignTitle: campaign.title,
          applicant,
          fields: recapFields,
          colors,
          branding,
        }),
      });
    }
  }

  private async sendApplicationDecisionEmail(
    campaign: RecruitmentCampaign,
    application: RecruitmentApplication,
  ): Promise<void> {
    if (application.status !== 'approved' && application.status !== 'rejected') {
      return;
    }

    const siteConfig = await this.siteService.getPublicConfig();
    const branding = {
      logo: this.siteService.resolveMediaUrl(emailLogoFromSiteConfig(siteConfig, this.configService)),
      orgName: siteConfig.orgName,
      social: emailSocialFromSiteConfig(siteConfig, this.configService),
    };
    const colors = {
      primary: siteConfig.primaryColor,
      secondary: siteConfig.secondaryColor,
    };

    const applicant = {
      firstName: application.firstName,
      lastName: application.lastName,
      email: application.email,
    };

    const html =
      application.status === 'approved'
        ? recruitmentApplicationApprovedTemplate({
            campaignTitle: campaign.title,
            applicant,
            colors,
            branding,
          })
        : recruitmentApplicationRejectedTemplate({
            campaignTitle: campaign.title,
            applicant,
            colors,
            branding,
          });

    await this.mailService.send({
      to: application.email,
      subject:
        application.status === 'approved'
          ? `Candidature approuvée — ${campaign.title}`
          : `Mise à jour de candidature — ${campaign.title}`,
      html,
    });
  }

  private async resolveRecruitmentRecipients(): Promise<string[]> {
    const admins = await this.adminModel
      .find({
        isActive: true,
        role: { $in: ['admin', 'superadmin'] },
        email: { $exists: true, $ne: '' },
      })
      .select('email')
      .lean()
      .exec();

    const envRecipients =
      this.configService
        .get<string>('RECRUITMENT_RECIPIENT_EMAIL')
        ?.split(',')
        .map((email) => email.trim())
        .filter(Boolean) ?? [];

    const unique = new Set<string>();
    for (const admin of admins) {
      if (admin.email) {
        unique.add(admin.email.trim());
      }
    }
    for (const email of envRecipients) {
      unique.add(email);
    }

    const siteEmail = (await this.siteService.getPublicConfig()).email?.trim();
    if (siteEmail) {
      unique.add(siteEmail);
    }

    return Array.from(unique);
  }

}
