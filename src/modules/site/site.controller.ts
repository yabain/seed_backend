import { Body, Controller, Get, Put } from '@nestjs/common';
import { SiteService } from './site.service';
import { Roles } from '../../common/decorators/roles.decorator';
import {
  FaqSectionDto,
  HoverMenuDto,
  LandingSectionTextDto,
  NavVisibilityDto,
  SegmentsDto,
  SocialDto,
  UpdateSiteConfigDto,
} from './dto/update-site-config.dto';
import { Public } from '../../common/decorators/public.decorator';

@Roles('admin', 'superadmin')
@Controller('site-config')
export class SiteController {
  constructor(private readonly siteService: SiteService) {}

  @Public()
  @Get()
  getPublicConfig() {
    return this.siteService.getPublicConfig();
  }

  /** Mise à jour globale (rétro-compatible). */
  @Put()
  update(@Body() dto: UpdateSiteConfigDto) {
    return this.siteService.update(dto);
  }

  @Put('identity')
  updateIdentity(@Body() dto: UpdateSiteConfigDto) {
    return this.siteService.updateIdentity(dto);
  }

  @Put('social')
  updateSocial(@Body() dto: SocialDto) {
    return this.siteService.updateSocial(dto);
  }

  @Put('segments')
  updateSegments(@Body() dto: SegmentsDto) {
    return this.siteService.updateSegments(dto);
  }

  @Put('nav-visibility')
  updateNavVisibility(@Body() dto: NavVisibilityDto) {
    return this.siteService.updateNavVisibility(dto);
  }

  @Put('hover-menu')
  updateHoverMenu(@Body() dto: HoverMenuDto) {
    return this.siteService.updateHoverMenu(dto);
  }

  @Put('events')
  updateEvents(@Body() dto: LandingSectionTextDto) {
    return this.siteService.updateLandingSection('events', dto);
  }

  @Put('news')
  updateNews(@Body() dto: LandingSectionTextDto) {
    return this.siteService.updateLandingSection('news', dto);
  }

  @Put('programs')
  updatePrograms(@Body() dto: LandingSectionTextDto) {
    return this.siteService.updateLandingSection('programs', dto);
  }

  @Put('partners')
  updatePartners(@Body() dto: LandingSectionTextDto) {
    return this.siteService.updateLandingSection('partners', dto);
  }

  @Put('resources')
  updateResources(@Body() dto: LandingSectionTextDto) {
    return this.siteService.updateLandingSection('resources', dto);
  }

  @Put('team')
  updateTeam(@Body() dto: LandingSectionTextDto) {
    return this.siteService.updateLandingSection('team', dto);
  }

  @Put('donations')
  updateDonations(@Body() dto: LandingSectionTextDto) {
    return this.siteService.updateLandingSection('donations', dto);
  }

  @Put('recruitments')
  updateRecruitments(@Body() dto: LandingSectionTextDto) {
    return this.siteService.updateLandingSection('recruitments', dto);
  }

  @Put('newsletter')
  updateNewsletter(@Body() dto: LandingSectionTextDto) {
    return this.siteService.updateLandingSection('newsletter', dto);
  }

  @Put('faq')
  updateFaq(@Body() dto: FaqSectionDto) {
    return this.siteService.updateLandingSection('faq', dto);
  }
}
