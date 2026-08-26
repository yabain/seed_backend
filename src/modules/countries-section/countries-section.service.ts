import { Injectable } from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model } from 'mongoose';
import { CountriesSection, CountriesSectionDocument, CountryItem } from './schemas/countries-section.schema';
import { UpdateCountriesSectionDto } from './dto/update-countries-section.dto';

@Injectable()
export class CountriesSectionService {
  constructor(
    @InjectModel(CountriesSection.name)
    private readonly countriesSectionModel: Model<CountriesSectionDocument>,
  ) {}

  private async getOrCreate(): Promise<CountriesSectionDocument> {
    let section = await this.countriesSectionModel.findOne().sort({ createdAt: 1 }).exec();
    if (!section) {
      section = await this.countriesSectionModel.create({ countries: undefined });
    }
    return section;
  }

  async getPublic(): Promise<CountriesSection> {
    const section = await this.getOrCreate();
    return section.toObject();
  }

  async update(dto: UpdateCountriesSectionDto): Promise<CountriesSection> {
    const section = await this.getOrCreate();
    if (dto.title !== undefined) section.title = dto.title;
    if (dto.backgroundImage !== undefined) section.backgroundImage = dto.backgroundImage;
    if (dto.visible !== undefined) section.visible = dto.visible;
    if (dto.countries !== undefined) {
      section.countries = dto.countries.map((c): CountryItem => ({
        image: c.image ?? '',
        title: c.title ?? '',
        subtitle: c.subtitle ?? '',
      }));
    }
    await section.save();
    return section.toObject();
  }
}