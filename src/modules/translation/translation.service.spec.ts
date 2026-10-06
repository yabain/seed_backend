import { Test } from '@nestjs/testing';
import { TranslationService } from './translation.service';
import { PlatformSettingsService } from '../platform-settings/platform-settings.service';

describe('TranslationService', () => {
  let service: TranslationService;
  let settingsService: { getTranslationConfigWithKeyFromDb: jest.Mock };

  beforeEach(async () => {
    settingsService = {
      getTranslationConfigWithKeyFromDb: jest.fn(),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        TranslationService,
        { provide: PlatformSettingsService, useValue: settingsService },
      ],
    }).compile();

    service = moduleRef.get(TranslationService);
  });

  it('is defined', () => {
    expect(service).toBeDefined();
  });

  it('refuses translation when the feature is disabled', async () => {
    settingsService.getTranslationConfigWithKeyFromDb.mockResolvedValue({
      enabled: false,
      defaultLanguage: 'fr',
      provider: 'deepl',
      deeplApiKey: 'dummy:free',
    });

    await expect(
      service.translate({ targetLang: 'en', texts: ['Bonjour'] }),
    ).rejects.toThrow(/désactivée/i);
  });

  it('rejects an oversized request volume', async () => {
    settingsService.getTranslationConfigWithKeyFromDb.mockResolvedValue({
      enabled: true,
      defaultLanguage: 'fr',
      provider: 'google',
      deeplApiKey: '',
    });

    const big = 'a'.repeat(60000);
    await expect(
      service.translate({ targetLang: 'en', texts: [big] }),
    ).rejects.toThrow(/trop important/i);
  });

  describe('translate via DeepL', () => {
    beforeEach(() => {
      settingsService.getTranslationConfigWithKeyFromDb.mockResolvedValue({
        enabled: true,
        defaultLanguage: 'fr',
        provider: 'deepl',
        deeplApiKey: 'dummy:free',
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => ({
          translations: [{ text: 'Hello' }, { text: 'World' }],
        }),
      }) as unknown as typeof fetch;
    });

    it('throws a clear error when DeepL key is missing', async () => {
      settingsService.getTranslationConfigWithKeyFromDb.mockResolvedValue({
        enabled: true,
        defaultLanguage: 'fr',
        provider: 'deepl',
        deeplApiKey: '',
      });

      await expect(
        service.translate({ targetLang: 'en', texts: ['Bonjour'] }),
      ).rejects.toThrow(/clé API DeepL/i);
    });

    it('calls DeepL and returns aligned translations', async () => {
      const result = await service.translate({
        targetLang: 'en',
        texts: ['Bonjour', 'Monde'],
      });

      expect(result.translations).toEqual(['Hello', 'World']);
      expect(global.fetch).toHaveBeenCalled();
    });
  });

  describe('translate via Google (libre)', () => {
    beforeEach(() => {
      settingsService.getTranslationConfigWithKeyFromDb.mockResolvedValue({
        enabled: true,
        defaultLanguage: 'fr',
        provider: 'google',
        deeplApiKey: '',
      });

      global.fetch = jest.fn().mockResolvedValue({
        ok: true,
        json: async () => [[ ['Hello', 'Bonjour', null, null, 1], null, 'en'] ],
      }) as unknown as typeof fetch;
    });

    it('returns translations aligned on input', async () => {
      const result = await service.translate({
        targetLang: 'en',
        texts: ['Bonjour'],
      });

      expect(result.translations).toEqual(['Hello']);
    });

    it('falls back to the original text when the request fails', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 429,
      }) as unknown as typeof fetch;

      const result = await service.translate({
        targetLang: 'en',
        texts: ['Bonjour'],
      });

      expect(result.translations).toEqual(['Bonjour']);
    });
  });

  it('filters out empty texts and preserves alignment', async () => {
    settingsService.getTranslationConfigWithKeyFromDb.mockResolvedValue({
      enabled: true,
      defaultLanguage: 'fr',
      provider: 'google',
      deeplApiKey: '',
    });

    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => [[ ['Salut', 'Bonjour', null, null, 1], null, 'en'] ],
    }) as unknown as typeof fetch;

    const result = await service.translate({
      targetLang: 'en',
      texts: ['Bonjour', '', '   '],
    });

    expect(result.translations.length).toBe(3);
    expect(result.translations[0]).toBe('Salut');
  });
});