import { Test } from '@nestjs/testing';
import { getConnectionToken } from '@nestjs/mongoose';

// archiver est un module ESM ; on le mocke pour le test unitaire.
jest.mock('archiver', () => {
  class MockZipArchive {
    private data: Array<{ name: string }> = [];
    append(content: unknown, opts: { name: string }) {
      this.data.push({ name: opts.name });
    }
    directory(path: string, name: string) {
      this.data.push({ name });
    }
    finalize() {}
  }
  return { ZipArchive: MockZipArchive };
});

import { BackupService } from './backup.service';

describe('BackupService', () => {
  let service: BackupService;

  const connectionMock = {
    db: {
      listCollections: jest.fn(),
      collection: jest.fn(),
    },
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        BackupService,
        { provide: getConnectionToken(), useValue: connectionMock },
      ],
    }).compile();

    service = moduleRef.get(BackupService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('builds a zip containing database JSON and produces a timestamped filename', async () => {
    connectionMock.db.listCollections.mockReturnValue({
      toArray: async () => [{ name: 'news' }, { name: 'admins' }],
    });
    connectionMock.db.collection.mockReturnValue({
      find: () => ({ toArray: async () => [{ _id: '1', title: 'A' }] }),
      listIndexes: () => ({
        toArray: async () => [{ v: 2, key: { _id: 1 }, name: '_id_' }],
      }),
    });

    const backup = await service.createBackup();

    expect(backup.filename).toMatch(
      /^BackupWebsite_\d{4}-\d{2}-\d{2}_\d{2}-\d{2}\.zip$/,
    );
    expect(backup.stream).toBeDefined();
  });

  it('handles empty collections and missing uploads dir gracefully', async () => {
    connectionMock.db.listCollections.mockReturnValue({
      toArray: async () => [],
    });

    const backup = await service.createBackup();
    expect(backup.filename).toContain('BackupWebsite_');
    expect(backup.stream).toBeDefined();
  });
});