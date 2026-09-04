import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Put,
  Query,
} from '@nestjs/common';
import { TeamService } from './team.service';
import { UpdateTeamDto } from './dto/create-team.dto';
import { CreateTeamSectionDto } from './dto/create-team-section.dto';
import { UpdateTeamSectionDto } from './dto/update-team-section.dto';
import { Roles } from '../../common/decorators/roles.decorator';
import { Public } from '../../common/decorators/public.decorator';
import { CreateTeamMemberDto } from './dto/create-team-member.dto';
import { UpdateTeamMemberDto } from './dto/update-team-member.dto';

@Roles('admin', 'superadmin')
@Controller('team')
export class TeamController {
  constructor(private readonly teamService: TeamService) {}

  @Public()
  @Get()
  getPage() {
    return this.teamService.getPage();
  }

  @Put()
  update(@Body() dto: UpdateTeamDto) {
    return this.teamService.update(dto);
  }

  @Delete()
  remove() {
    return this.teamService.remove();
  }

  /* ============== Sections ============== */

  @Get('sections')
  listSections() {
    return this.teamService.listSections();
  }

  @Post('sections')
  createSection(@Body() dto: CreateTeamSectionDto) {
    return this.teamService.createSection(dto);
  }

  @Patch('sections/:id')
  updateSection(
    @Param('id') id: string,
    @Body() dto: UpdateTeamSectionDto,
  ) {
    return this.teamService.updateSection(id, dto);
  }

  @Delete('sections/:id')
  removeSection(@Param('id') id: string) {
    return this.teamService.removeSection(id);
  }

  /* ============== Membres ============== */

  @Get('members')
  listMembers(
    @Query('search') search?: string,
    @Query('sectionId') sectionId?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.teamService.listMembers({
      search,
      sectionId,
      page: page ? Number(page) : undefined,
      limit: limit ? Number(limit) : undefined,
    });
  }

  @Get('members/:id')
  findMember(@Param('id') id: string) {
    return this.teamService.findMember(id);
  }

  @Post('members')
  createMember(@Body() dto: CreateTeamMemberDto) {
    return this.teamService.createMember(dto);
  }

  @Patch('members/:id')
  updateMember(@Param('id') id: string, @Body() dto: UpdateTeamMemberDto) {
    return this.teamService.updateMember(id, dto);
  }

  @Delete('members/:id')
  removeMember(@Param('id') id: string) {
    return this.teamService.removeMember(id);
  }
}