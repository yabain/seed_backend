import { Body, Controller, Get, Put } from '@nestjs/common';
import { SectionsService } from './sections.service';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { UpdateSectionTextDto, UpdateIdentityDto, UpdateSocialDto, UpdateSegmentsDto, UpdateNavVisibilityDto, UpdateHoverMenuDto } from './dto/update-section-text.dto';

@Roles('admin', 'superadmin')
@Controller()
export class SectionsController {
  constructor(private readonly sectionsService: SectionsService) {}

  @Public() @Get('events-section') getEvents() { return this.sectionsService.getEvents(); }
  @Put('events-section') updateEvents(@Body() dto: UpdateSectionTextDto) { return this.sectionsService.updateEvents(dto); }

  @Public() @Get('news-section') getNews() { return this.sectionsService.getNews(); }
  @Put('news-section') updateNews(@Body() dto: UpdateSectionTextDto) { return this.sectionsService.updateNews(dto); }

  @Public() @Get('programs-section') getPrograms() { return this.sectionsService.getPrograms(); }
  @Put('programs-section') updatePrograms(@Body() dto: UpdateSectionTextDto) { return this.sectionsService.updatePrograms(dto); }

  @Public() @Get('partners-section') getPartners() { return this.sectionsService.getPartners(); }
  @Put('partners-section') updatePartners(@Body() dto: UpdateSectionTextDto) { return this.sectionsService.updatePartners(dto); }

  @Public() @Get('resources-section') getResources() { return this.sectionsService.getResources(); }
  @Put('resources-section') updateResources(@Body() dto: UpdateSectionTextDto) { return this.sectionsService.updateResources(dto); }

  @Public() @Get('team-section') getTeam() { return this.sectionsService.getTeam(); }
  @Put('team-section') updateTeam(@Body() dto: UpdateSectionTextDto) { return this.sectionsService.updateTeam(dto); }

  @Public() @Get('donations-section') getDonations() { return this.sectionsService.getDonations(); }
  @Put('donations-section') updateDonations(@Body() dto: UpdateSectionTextDto) { return this.sectionsService.updateDonations(dto); }

  @Public() @Get('recruitments-section') getRecruitments() { return this.sectionsService.getRecruitments(); }
  @Put('recruitments-section') updateRecruitments(@Body() dto: UpdateSectionTextDto) { return this.sectionsService.updateRecruitments(dto); }

  @Public() @Get('newsletter-section') getNewsletter() { return this.sectionsService.getNewsletter(); }
  @Put('newsletter-section') updateNewsletter(@Body() dto: UpdateSectionTextDto) { return this.sectionsService.updateNewsletter(dto); }

  @Public() @Get('faq-section') getFaq() { return this.sectionsService.getFaq(); }
  @Put('faq-section') updateFaq(@Body() dto: UpdateSectionTextDto) { return this.sectionsService.updateFaq(dto); }

  @Public() @Get('avis-section') getAvis() { return this.sectionsService.getAvis(); }
  @Put('avis-section') updateAvis(@Body() dto: UpdateSectionTextDto) { return this.sectionsService.updateAvis(dto); }

  @Public() @Get('identity-section') getIdentity() { return this.sectionsService.getIdentity(); }
  @Put('identity-section') updateIdentity(@Body() dto: UpdateIdentityDto) { return this.sectionsService.updateIdentity(dto); }

  @Public() @Get('social-section') getSocial() { return this.sectionsService.getSocial(); }
  @Put('social-section') updateSocial(@Body() dto: UpdateSocialDto) { return this.sectionsService.updateSocial(dto); }

  @Public() @Get('segments-section') getSegments() { return this.sectionsService.getSegments(); }
  @Put('segments-section') updateSegments(@Body() dto: UpdateSegmentsDto) { return this.sectionsService.updateSegments(dto); }

  @Public() @Get('nav-visibility-section') getNavVisibility() { return this.sectionsService.getNavVisibility(); }
  @Put('nav-visibility-section') updateNavVisibility(@Body() dto: UpdateNavVisibilityDto) { return this.sectionsService.updateNavVisibility(dto); }

  @Public() @Get('hover-menu-section') getHoverMenu() { return this.sectionsService.getHoverMenu(); }
  @Put('hover-menu-section') updateHoverMenu(@Body() dto: UpdateHoverMenuDto) { return this.sectionsService.updateHoverMenu(dto); }

  @Roles('admin', 'superadmin')
  @Put('rebuild-site-config')
  async triggerRebuild(): Promise<{ success: true }> {
    await this.sectionsService.rebuildSiteConfig();
    return { success: true };
  }
}