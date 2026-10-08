import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { InjectConnection, InjectModel } from '@nestjs/mongoose';
import { SectionText } from './schemas/section-text.schema';
import { Identity, IdentityDocument } from './schemas/identity.schema';
import { Social, SocialDocument } from './schemas/social.schema';
import { Segments, SegmentsDocument } from './schemas/segments.schema';
import { NavVisibility, NavVisibilityDocument } from './schemas/nav-visibility.schema';
import { HoverMenu, HoverMenuDocument } from './schemas/hover-menu.schema';
import { UpdateSectionTextDto, UpdateIdentityDto, UpdateSocialDto, UpdateSegmentsDto, UpdateNavVisibilityDto, UpdateHoverMenuDto } from './dto/update-section-text.dto';

@Injectable()
export class SectionsService {
  constructor(
    @InjectModel('EventsSection') private ev: any,
    @InjectModel('NewsSection') private nw: any,
    @InjectModel('ProgramsSection') private pr: any,
    @InjectModel('PartnersSection') private pt: any,
    @InjectModel('ResourcesSection') private rs: any,
    @InjectModel('TeamSection') private tm: any,
    @InjectModel('DonationsSection') private dn: any,
    @InjectModel('RecruitmentsSection') private rc: any,
    @InjectModel('NewsletterSection') private nl: any,
    @InjectModel('FaqSection') private fq: any,
    @InjectModel('AvisSection') private av: any,
    @InjectModel(Identity.name) private id: any,
    @InjectModel(Social.name) private sc: any,
    @InjectModel(Segments.name) private sg: any,
    @InjectModel(NavVisibility.name) private nv: any,
    @InjectModel(HoverMenu.name) private hm: any,
    @InjectConnection() private connection: any,
  ) {}

  private go(m: any) { return m.findOne().exec().then((d: any) => d || m.create({} as any).then((x: any) => x)); }
  private obj(d: any) { return (d as any).toObject(); }
  private saveDoc(doc: any) { return (doc as any).save().then(() => doc); }
  private apply(doc: any, dto: Record<string, unknown>) {
    Object.entries(dto).forEach(([k, v]) => { if (v !== undefined) (doc as any)[k] = v; });
    return doc;
  }

  private up(m: any, d: UpdateSectionTextDto) {
    return this.go(m).then(doc => {
      this.apply(doc, d as any);
      return this.saveDoc(doc);
    });
  }

  /** Met à jour la section ET synchronise immédiatement avec site_config. */
  private async upAndSync(m: any, d: UpdateSectionTextDto, sectionName: string) {
    // 1. Mettre à jour la section individuelle
    const doc = await this.go(m);
    this.apply(doc, d as any);
    await this.saveDoc(doc);
    
    // 2. Synchroniser avec site_config.landingSections
    const sectionData = (doc as any).toObject();
    const collection = this.connection.collection('site_config');
    await collection.updateOne({}, {
      $set: {
        [`landingSections.${sectionName}`]: sectionData
      }
    }, { upsert: true });
    
    return doc;
  }

getEvents() { return this.go(this.ev).then(this.obj); }
  updateEvents(d: UpdateSectionTextDto) { return this.upAndSync(this.ev, d, 'events'); }
  getNews() { return this.go(this.nw).then(this.obj); }
  updateNews(d: UpdateSectionTextDto) { return this.upAndSync(this.nw, d, 'news'); }
  getPrograms() { return this.go(this.pr).then(this.obj); }
  updatePrograms(d: UpdateSectionTextDto) { return this.upAndSync(this.pr, d, 'programs'); }
  getPartners() { return this.go(this.pt).then(this.obj); }
  updatePartners(d: UpdateSectionTextDto) { return this.upAndSync(this.pt, d, 'partners'); }
  getResources() { return this.go(this.rs).then(this.obj); }
  updateResources(d: UpdateSectionTextDto) { return this.upAndSync(this.rs, d, 'resources'); }
  getTeam() { return this.go(this.tm).then(this.obj); }
  updateTeam(d: UpdateSectionTextDto) { return this.upAndSync(this.tm, d, 'team'); }
  getDonations() { return this.go(this.dn).then(this.obj); }
  updateDonations(d: UpdateSectionTextDto) { return this.upAndSync(this.dn, d, 'donations'); }
  getRecruitments() { return this.go(this.rc).then(this.obj); }
  updateRecruitments(d: UpdateSectionTextDto) { return this.upAndSync(this.rc, d, 'recruitments'); }
  getNewsletter() { return this.go(this.nl).then(this.obj); }
  updateNewsletter(d: UpdateSectionTextDto) { return this.upAndSync(this.nl, d, 'newsletter'); }
  getFaq() { return this.go(this.fq).then(this.obj); }
  updateFaq(d: UpdateSectionTextDto) { return this.upAndSync(this.fq, d, 'faq'); }
  getAvis() { return this.go(this.av).then(this.obj); }
  updateAvis(d: UpdateSectionTextDto) { return this.upAndSync(this.av, d, 'avis'); }
  getIdentity() { return this.go(this.id); }
  async updateIdentity(d: UpdateIdentityDto) {
    const doc = await this.go(this.id);
    this.apply(doc, d as any);
    await this.saveDoc(doc);
    
    // Synchroniser avec site_config
    const collection = this.connection.collection('site_config');
    await collection.updateOne({}, {
      $set: { orgName: doc.orgName ?? '' }
    }, { upsert: true });
    
    return doc;
  }
  
  getSocial() { return this.go(this.sc); }
  async updateSocial(d: UpdateSocialDto) {
    const doc = await this.go(this.sc);
    this.apply(doc, d as any);
    await this.saveDoc(doc);
    
    // Synchroniser avec site_config
    const socialData = (doc as any).toObject();
    const collection = this.connection.collection('site_config');
    await collection.updateOne({}, {
      $set: { social: socialData }
    }, { upsert: true });
    
    return doc;
  }
  
  getSegments() { return this.go(this.sg); }
  async updateSegments(d: UpdateSegmentsDto) {
    const doc = await this.go(this.sg);
    this.apply(doc, d as any);
    await this.saveDoc(doc);
    
    // Synchroniser avec site_config
    const segmentsData = (doc as any).toObject();
    const collection = this.connection.collection('site_config');
    await collection.updateOne({}, {
      $set: { segments: segmentsData }
    }, { upsert: true });
    
    return doc;
  }
  
  getNavVisibility() { return this.go(this.nv); }
  async updateNavVisibility(d: UpdateNavVisibilityDto) {
    const doc = await this.go(this.nv);
    this.apply(doc, d as any);
    await this.saveDoc(doc);
    
    // Synchroniser avec site_config
    const navData = (doc as any).toObject();
    const collection = this.connection.collection('site_config');
    await collection.updateOne({}, {
      $set: { navVisibility: navData }
    }, { upsert: true });
    
    return doc;
  }
  
  getHoverMenu() { return this.go(this.hm); }
  async updateHoverMenu(d: UpdateHoverMenuDto) {
    const doc = await this.go(this.hm);
    this.apply(doc, d as any);
    await this.saveDoc(doc);
    
    // Synchroniser avec site_config
    const hoverData = (doc as any).toObject();
    const collection = this.connection.collection('site_config');
    await collection.updateOne({}, {
      $set: { hoverMenu: hoverData }
    }, { upsert: true });
    
    return doc;
  }
/** Reconstruit la configuration site-config à partir de toutes les sections. */
  @Cron('0 */5 * * *')
  async rebuildSiteConfig(): Promise<void> {
    const landingSections: Record<string, unknown> = {};

    // Lire les 10 sections textuelles (modèles par nom de propriété)
    const results = await Promise.all([
      this.ev.findOne().exec(), this.nw.findOne().exec(), this.pr.findOne().exec(),
      this.pt.findOne().exec(), this.rs.findOne().exec(), this.tm.findOne().exec(),
      this.dn.findOne().exec(), this.rc.findOne().exec(), this.nl.findOne().exec(),
      this.fq.findOne().exec(), this.av.findOne().exec(),
    ]);
    const names = ['events', 'news', 'programs', 'partners', 'resources', 'team',
                   'donations', 'recruitments', 'newsletter', 'faq', 'avis'];
    for (let i = 0; i < results.length; i++) {
      if (results[i]) landingSections[names[i]] = (results[i] as any).toObject();
    }

    const identity = await this.id.findOne().exec();
    const social = await this.sc.findOne().exec();
    const segments = await this.sg.findOne().exec();
    const navVisibility = await this.nv.findOne().exec();
    const hoverMenu = await this.hm.findOne().exec();

    const collection = this.connection.collection('site_config');
    await collection.updateOne({}, {
      $set: {
        landingSections,
        orgName: identity?.orgName ?? '',
        social: social ? (social as any).toObject() : {},
        segments: segments ? (segments as any).toObject() : {},
        navVisibility: navVisibility ? (navVisibility as any).toObject() : {},
        hoverMenu: hoverMenu ? (hoverMenu as any).toObject() : {},
      },
    }, { upsert: true });
  }
}
