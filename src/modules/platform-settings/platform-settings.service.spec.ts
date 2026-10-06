import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { PlatformSettingsService } from './platform-settings.service';
import { CryptService } from '../crypt/crypt.service';

describe('PlatformSettingsService (translation)', () => {
  let service: PlatformSettingsService;
  let cryptService: { encrypt: jest.Mock; decrypt: jest.Mock };

  const mockDoc = {
    key: 'public',
    whatsappGateway: {},
    translation: {},
  };

  const modelMock = {
    findOne: jest.fn(),
    create: jest.fn(),
    findOneAndUpdate: jest.fn(),
  };

  beforeEach(async () => {
    cryptService = {
      encrypt: jest.fn((v: string) => `enc:${v}`),
      decrypt: jest.fn((v: string) =>
        typeof v === 'string' && v.startsWith('enc:') ? v.slice(4) : '',
      ),
    };

    const moduleRef = await Test.createTestingModule({
      providers: [
        PlatformSettingsService,
        { provide: getModelToken('PlatformSettings'), useValue: modelMock },
        { provide: CryptService, useValue: cryptService },
      ],
    }).compile();

    service = moduleRef.get(PlatformSettingsService);
  });

  beforeEach(() => {
    jest.resetAllMocks();
    modelMock.findOne.mockResolvedValue({ ...mockDoc });
    // Re-définir le mock crypt après resetAllMocks.
    cryptService.encrypt.mockImplementation((v: string) => `enc:${v}`);
    cryptService.decrypt.mockImplementation((v: string) =>
      typeof v === 'string' && v.startsWith('enc:') ? v.slice(4) : '',
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns default translation settings when none are configured', async () => {
    const result = await service.getTranslationSettings();
    expect(result).toEqual({
      enabled: false,
      defaultLanguage: 'fr',
      provider: 'google',
      hasDeeplKey: false,
    });
  });

  it('never exposes the DeepL key, only hasDeeplKey', async () => {
    modelMock.findOne.mockResolvedValue({
      ...mockDoc,
      translation: { enabled: true, provider: 'deepl', encryptedDeeplApiKey: 'enc:secret' },
    });

    const result = await service.getTranslationSettings();
    expect(result.hasDeeplKey).toBe(true);
    expect(JSON.stringify(result)).not.toContain('secret');
    expect(JSON.stringify(result)).not.toContain('enc:');
  });

  it('encrypts the DeepL key on update and reports hasDeeplKey', async () => {
    modelMock.findOneAndUpdate.mockResolvedValue({
      ...mockDoc,
      translation: { enabled: true, defaultLanguage: 'en', provider: 'deepl', encryptedDeeplApiKey: 'enc:mykey' },
    });

    const result = await service.updateTranslationSettings({
      enabled: true,
      defaultLanguage: 'en',
      provider: 'deepl',
      deeplApiKey: 'mykey',
    });

    expect(cryptService.encrypt).toHaveBeenCalledWith('mykey');
    expect(result.hasDeeplKey).toBe(true);
    expect(result.provider).toBe('deepl');
  });

  it('keeps existing key when deeplApiKey is empty', async () => {
    await service.updateTranslationSettings({ provider: 'deepl', deeplApiKey: '' });
    // CryptService ne doit pas être appelé pour une clé vide.
    expect(cryptService.encrypt).not.toHaveBeenCalled();
  });

  it('decrypts the key for internal usage', async () => {
    modelMock.findOne.mockResolvedValue({
      ...mockDoc,
      translation: { enabled: true, provider: 'deepl', encryptedDeeplApiKey: 'enc:secret-key' },
    });

    const result = await service.getTranslationConfigWithKeyFromDb();
    expect(result.deeplApiKey).toBe('secret-key');
    expect(result.provider).toBe('deepl');
  });

  it('returns public settings without any secret', async () => {
    modelMock.findOne.mockResolvedValue({
      ...mockDoc,
      translation: { enabled: true, provider: 'deepl', encryptedDeeplApiKey: 'enc:secret' },
    });

    const result = await service.getPublicTranslationSettings();
    expect(result).toEqual({ enabled: true, defaultLanguage: 'fr', provider: 'deepl' });
    expect(JSON.stringify(result)).not.toContain('secret');
  });

  // ── Authentification ──────────────────────────────────────────────────────

  it('returns default auth settings (2FA + Google on) when none configured', async () => {
    const result = await service.getAuthSettings();
    expect(result).toEqual({
      twoFactorEnabled: true,
      googleLoginEnabled: true,
      hasGoogleClientId: false,
    });
  });

  it('never exposes the Google client id, only hasGoogleClientId', async () => {
    modelMock.findOne.mockResolvedValue({
      ...mockDoc,
      auth: { twoFactorEnabled: true, googleLoginEnabled: true, encryptedGoogleClientId: 'enc:sensitive-id' },
    });

    const result = await service.getAuthSettings();
    expect(result.hasGoogleClientId).toBe(true);
    expect(JSON.stringify(result)).not.toContain('sensitive-id');
    expect(JSON.stringify(result)).not.toContain('enc:');
  });

  it('encrypts the Google client id on update with the dedicated key', async () => {
    modelMock.findOneAndUpdate.mockResolvedValue({
      ...mockDoc,
      auth: { googleLoginEnabled: true, encryptedGoogleClientId: 'enc:new-id' },
    });

    const result = await service.updateAuthSettings({
      googleLoginEnabled: true,
      googleClientId: 'new-id',
    });

    expect(cryptService.encrypt).toHaveBeenCalledWith('new-id', expect.any(String));
    expect(result.googleLoginEnabled).toBe(true);
    expect(result.hasGoogleClientId).toBe(true);
  });

  it('refuses to enable Google without a client id (server-side guard)', async () => {
    modelMock.findOne.mockResolvedValue({ ...mockDoc, auth: {} });

    await expect(
      service.updateAuthSettings({ googleLoginEnabled: true }),
    ).rejects.toThrow(/GOOGLE_CLIENT_ID/i);
  });

  it('allows enabling Google when a client id is already stored', async () => {
    modelMock.findOne.mockResolvedValue({
      ...mockDoc,
      auth: { googleLoginEnabled: true, encryptedGoogleClientId: 'enc:existing' },
    });

    await expect(
      service.updateAuthSettings({ googleLoginEnabled: true }),
    ).resolves.toBeDefined();
  });

  it('decrypts the Google client id for internal usage', async () => {
    modelMock.findOne.mockResolvedValue({
      ...mockDoc,
      auth: { encryptedGoogleClientId: 'enc:my-google-id' },
    });

    const result = await service.getAuthConfigWithKeyFromDb();
    expect(result.googleClientId).toBe('my-google-id');
    expect(result.twoFactorEnabled).toBe(true);
  });
});