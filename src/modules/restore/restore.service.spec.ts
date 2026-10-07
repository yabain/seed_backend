import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';

// adm-zip importé par le service ; on mocke pour le test unitaire du job.
jest.mock('adm-zip');

import { RestoreService } from './restore.service';

describe('RestoreService', () => {
  let service: RestoreService;

  const connectionMock = {
    db: {
      collection: jest.fn(),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        RestoreService,
        { provide: getConnectionToken(), useValue: connectionMock },
      ],
    }).compile();

    service = moduleRef.get(RestoreService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('registerUpload sets a job and getFilePath returns it', () => {
    service.registerUpload('job1', '/tmp/x.zip');
    expect(service.getFilePath('job1')).toBe('/tmp/x.zip');
    expect(service.getJob('job1')?.status).toBe('uploaded');
  });

  it('returns null for unknown job path', () => {
    expect(service.getFilePath('nope')).toBeNull();
    expect(service.getJob('nope')).toBeNull();
  });
});