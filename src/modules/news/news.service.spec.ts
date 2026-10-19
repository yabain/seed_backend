import { BadRequestException, NotFoundException } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';

// Les suppressions de fichiers sont mockées : aucun accès disque réel.
jest.mock('../../common/utils/upload-file.util', () => ({
  deleteUploadFile: jest.fn(),
}));

import {
  cleanupRemovedFiles,
  mediaKey,
  normalizeGallery,
  NewsService,
} from './news.service';
import { deleteUploadFile } from '../../common/utils/upload-file.util';

const deleteUploadFileMock = deleteUploadFile as jest.MockedFunction<
  typeof deleteUploadFile
>;

const ID = '507f1f77bcf86cd799439011';
const OTHER_ID = '507f1f77bcf86cd799439012';

const existingExec = (value: unknown) => ({
  exec: jest.fn().mockResolvedValue(value),
});

const leanExec = (value: unknown) => ({
  lean: jest.fn().mockReturnValue(existingExec(value)),
});

describe('news helpers', () => {
  describe('normalizeGallery', () => {
    it('trims, drops empty and non-string entries, and dedupes preserving order', () => {
      const input = [
        '  /uploads/a.webp  ',
        '',
        '   ',
        '/uploads/b.webp',
        '/uploads/a.webp',
        null,
        42,
        '/uploads/b.webp',
      ] as unknown as string[];

      expect(normalizeGallery(input)).toEqual([
        '/uploads/a.webp',
        '/uploads/b.webp',
      ]);
    });

    it('caps the gallery at 4 entries', () => {
      expect(
        normalizeGallery([
          '/uploads/1.webp',
          '/uploads/2.webp',
          '/uploads/3.webp',
          '/uploads/4.webp',
          '/uploads/5.webp',
        ]),
      ).toEqual([
        '/uploads/1.webp',
        '/uploads/2.webp',
        '/uploads/3.webp',
        '/uploads/4.webp',
      ]);
    });

    it('returns an empty array for undefined, null and non-array values', () => {
      expect(normalizeGallery(undefined)).toEqual([]);
      expect(normalizeGallery(null as unknown as string[])).toEqual([]);
      expect(
        normalizeGallery('/uploads/a.webp' as unknown as string[]),
      ).toEqual([]);
    });
  });

  describe('mediaKey', () => {
    it.each([
      ['/uploads/a.webp', '/uploads/a.webp'],
      ['uploads/a.webp', '/uploads/a.webp'],
      ['https://host/uploads/a.webp?t=1#x', '/uploads/a.webp'],
      ['/uploads/a.webp?t=1', '/uploads/a.webp'],
      ['  /uploads/a.webp  ', '/uploads/a.webp'],
      ['https://cdn.example.com/a.webp', ''],
      ['data:image/png;base64,iVBORw0KGgo=', ''],
      ['a.webp', ''],
      ['', ''],
      [undefined, ''],
    ])('%s → %s', (input, expected) => {
      expect(mediaKey(input)).toBe(expected);
    });
  });

  describe('cleanupRemovedFiles', () => {
    beforeEach(() => {
      deleteUploadFileMock.mockReset();
      deleteUploadFileMock.mockResolvedValue(undefined);
    });

    it('deletes only files that disappeared and keeps retained ones', async () => {
      await cleanupRemovedFiles(
        ['/uploads/remove.webp', '/uploads/keep.webp'],
        ['/uploads/keep.webp'],
      );

      expect(deleteUploadFileMock).toHaveBeenCalledTimes(1);
      expect(deleteUploadFileMock).toHaveBeenCalledWith('/uploads/remove.webp');
    });

    it('never deletes an external URL from the previous list', async () => {
      await cleanupRemovedFiles(
        ['https://cdn.example.com/external.webp', '/uploads/keep.webp'],
        [],
      );

      expect(deleteUploadFileMock).toHaveBeenCalledTimes(1);
      expect(deleteUploadFileMock).toHaveBeenCalledWith('/uploads/keep.webp');
    });

    it('deletes a key appearing in several forms only once', async () => {
      await cleanupRemovedFiles(
        [
          '/uploads/a.webp',
          'uploads/a.webp',
          'https://host/uploads/a.webp?t=1',
        ],
        [],
      );

      expect(deleteUploadFileMock).toHaveBeenCalledTimes(1);
      expect(deleteUploadFileMock).toHaveBeenCalledWith('/uploads/a.webp');
    });

    it('resolves even when deleteUploadFile rejects', async () => {
      deleteUploadFileMock.mockRejectedValueOnce(new Error('EACCES'));

      await expect(
        cleanupRemovedFiles(['/uploads/a.webp'], []),
      ).resolves.toBeUndefined();
      expect(deleteUploadFileMock).toHaveBeenCalledTimes(1);
    });
  });
});

describe('NewsService', () => {
  let service: NewsService;

  const modelMock = {
    findById: jest.fn(),
    findByIdAndUpdate: jest.fn(),
    findByIdAndDelete: jest.fn(),
  };

  const lastUpdatePayload = (): Record<string, unknown> => {
    const call = modelMock.findByIdAndUpdate.mock.calls[0] as unknown[];
    return call[1] as Record<string, unknown>;
  };

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        NewsService,
        { provide: getModelToken('News'), useValue: modelMock },
      ],
    }).compile();

    service = moduleRef.get(NewsService);
    jest.clearAllMocks();
    deleteUploadFileMock.mockReset();
    deleteUploadFileMock.mockResolvedValue(undefined);
  });

  describe('update', () => {
    it('does not write a gallery key when the PATCH body omits it', async () => {
      modelMock.findById.mockReturnValue(
        existingExec({
          _id: ID,
          image: '/uploads/main.webp',
          gallery: ['/uploads/kept.webp'],
          slug: 'article',
        }),
      );
      modelMock.findByIdAndUpdate.mockReturnValue(
        leanExec({
          _id: ID,
          title: 'Nouveau titre',
          image: '/uploads/main.webp',
          gallery: ['/uploads/kept.webp'],
        }),
      );

      await service.update(ID, { title: 'Nouveau titre' });

      const payload = lastUpdatePayload();
      expect(Object.prototype.hasOwnProperty.call(payload, 'gallery')).toBe(
        false,
      );
      expect(payload.title).toBe('Nouveau titre');
    });

    it('normalizes the gallery and removes the primary image from it', async () => {
      modelMock.findById.mockReturnValue(
        existingExec({
          _id: ID,
          image: '/uploads/main.webp',
          gallery: [],
          slug: 'article',
        }),
      );
      modelMock.findByIdAndUpdate.mockReturnValue(
        leanExec({
          _id: ID,
          image: '/uploads/main.webp',
          gallery: ['/uploads/g1.webp', '/uploads/g2.webp'],
        }),
      );

      await service.update(ID, {
        gallery: [
          '  /uploads/g1.webp  ',
          '/uploads/main.webp',
          '/uploads/g1.webp',
          '/uploads/g2.webp',
        ],
      });

      const payload = lastUpdatePayload();
      expect(payload.gallery).toEqual(['/uploads/g1.webp', '/uploads/g2.webp']);
      expect(payload.gallery).not.toContain('/uploads/main.webp');
    });

    it.each([[[]], [null]])(
      'clears the gallery when gallery is %p',
      async (gallery) => {
        modelMock.findById.mockReturnValue(
          existingExec({
            _id: ID,
            image: '/uploads/main.webp',
            gallery: ['/uploads/old.webp'],
            slug: 'article',
          }),
        );
        modelMock.findByIdAndUpdate.mockReturnValue(
          leanExec({ _id: ID, image: '/uploads/main.webp', gallery: [] }),
        );

        await service.update(ID, { gallery } as never);

        const payload = lastUpdatePayload();
        expect(payload.gallery).toEqual([]);
        expect(deleteUploadFileMock).toHaveBeenCalledWith('/uploads/old.webp');
      },
    );

    it('rejects a null primary image with BadRequestException', async () => {
      modelMock.findById.mockReturnValue(
        existingExec({
          _id: ID,
          image: '/uploads/main.webp',
          gallery: [],
          slug: 'article',
        }),
      );

      await expect(
        service.update(ID, { image: null } as never),
      ).rejects.toBeInstanceOf(BadRequestException);
      expect(modelMock.findByIdAndUpdate).not.toHaveBeenCalled();
    });

    it.each(['', '   '])(
      'rejects an empty or whitespace-only primary image (%p) with BadRequestException',
      async (image) => {
        modelMock.findById.mockReturnValue(
          existingExec({
            _id: ID,
            image: '/uploads/main.webp',
            gallery: [],
            slug: 'article',
          }),
        );

        await expect(service.update(ID, { image })).rejects.toBeInstanceOf(
          BadRequestException,
        );
        expect(modelMock.findByIdAndUpdate).not.toHaveBeenCalled();
      },
    );

    it('deletes the removed gallery file only, not the retained one', async () => {
      modelMock.findById.mockReturnValue(
        existingExec({
          _id: ID,
          image: '/uploads/main.webp',
          gallery: ['/uploads/removed.webp', '/uploads/kept.webp'],
          slug: 'article',
        }),
      );
      modelMock.findByIdAndUpdate.mockReturnValue(
        leanExec({
          _id: ID,
          image: '/uploads/main.webp',
          gallery: ['/uploads/kept.webp', '/uploads/new.webp'],
        }),
      );

      await service.update(ID, {
        gallery: ['/uploads/kept.webp', '/uploads/new.webp'],
      });

      expect(deleteUploadFileMock).toHaveBeenCalledTimes(1);
      expect(deleteUploadFileMock).toHaveBeenCalledWith(
        '/uploads/removed.webp',
      );
      expect(deleteUploadFileMock).not.toHaveBeenCalledWith(
        '/uploads/kept.webp',
      );
      expect(deleteUploadFileMock).not.toHaveBeenCalledWith(
        '/uploads/new.webp',
      );
    });

    it('does not throw for a legacy document with gallery undefined', async () => {
      const legacy = {
        _id: ID,
        image: '/uploads/main.webp',
        gallery: undefined,
        slug: 'article',
      };
      modelMock.findById.mockReturnValue(existingExec(legacy));
      modelMock.findByIdAndUpdate.mockReturnValue(
        leanExec({ ...legacy, title: 'Titre mis à jour' }),
      );

      await expect(
        service.update(ID, { title: 'Titre mis à jour' }),
      ).resolves.toMatchObject({ title: 'Titre mis à jour' });

      const payload = lastUpdatePayload();
      expect(Object.prototype.hasOwnProperty.call(payload, 'gallery')).toBe(
        false,
      );
      expect(deleteUploadFileMock).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when the document does not exist', async () => {
      modelMock.findById.mockReturnValue(existingExec(null));

      await expect(
        service.update(OTHER_ID, { title: 'x' }),
      ).rejects.toBeInstanceOf(NotFoundException);
      expect(modelMock.findByIdAndUpdate).not.toHaveBeenCalled();
    });
  });

  describe('remove', () => {
    it('deletes the primary image and every gallery entry', async () => {
      modelMock.findByIdAndDelete.mockReturnValue(
        existingExec({
          _id: ID,
          image: '/uploads/main.webp',
          gallery: [
            '/uploads/g1.webp',
            'uploads/g2.webp',
            'https://cdn.example.com/external.webp',
          ],
        }),
      );

      await expect(service.remove(ID)).resolves.toEqual({ deleted: true });

      expect(modelMock.findByIdAndDelete).toHaveBeenCalledWith(ID);
      // L'URL externe est ignorée ; les trois fichiers locaux sont supprimés.
      expect(deleteUploadFileMock).toHaveBeenCalledTimes(3);
      const deleted = deleteUploadFileMock.mock.calls
        .map(([key]) => key)
        .sort();
      expect(deleted).toEqual([
        '/uploads/g1.webp',
        '/uploads/g2.webp',
        '/uploads/main.webp',
      ]);
    });

    it('throws NotFoundException for an unknown valid id', async () => {
      modelMock.findByIdAndDelete.mockReturnValue(existingExec(null));

      await expect(service.remove(OTHER_ID)).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(deleteUploadFileMock).not.toHaveBeenCalled();
    });

    it('throws NotFoundException for an invalid ObjectId without touching the model', async () => {
      await expect(service.remove('not-an-object-id')).rejects.toBeInstanceOf(
        NotFoundException,
      );
      expect(modelMock.findByIdAndDelete).not.toHaveBeenCalled();
    });
  });
});
