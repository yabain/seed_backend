import { Test } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AvisService } from './avis.service';

describe('AvisService', () => {
  let service: AvisService;

const modelMock = jest.fn().mockImplementation((dto) => ({
  ...dto,
  save: jest.fn().mockResolvedValue(dto),
})) as unknown as {
  find: jest.Mock;
  findById: jest.Mock;
  findByIdAndUpdate: jest.Mock;
  findByIdAndDelete: jest.Mock;
  countDocuments: jest.Mock;
};
modelMock.find = jest.fn();
modelMock.findById = jest.fn();
modelMock.findByIdAndUpdate = jest.fn();
modelMock.findByIdAndDelete = jest.fn();
modelMock.countDocuments = jest.fn();

  beforeEach(async () => {
    const moduleRef = await Test.createTestingModule({
      providers: [
        AvisService,
        { provide: getModelToken('Avis'), useValue: modelMock },
      ],
    }).compile();

    service = moduleRef.get(AvisService);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('findAllPublic returns only active avis sorted', async () => {
    const cursor = { lean: jest.fn().mockReturnThis(), sort: jest.fn().mockReturnThis(), exec: jest.fn().mockResolvedValue([{ name: 'A' }]) };
    modelMock.find.mockReturnValue(cursor);

    const result = await service.findAllPublic();
    expect(result).toEqual([{ name: 'A' }]);
    expect(modelMock.find).toHaveBeenCalledWith({ isActive: true });
  });

  it('throws NotFoundException for invalid id', async () => {
    await expect(service.findOne('bad')).rejects.toThrow('Avis introuvable');
  });

  it('creates an avis', async () => {
    const result = await service.create({ name: 'Test', rating: 5 });
    expect(result).toMatchObject({ name: 'Test', rating: 5 });
    expect(modelMock).toHaveBeenCalledWith({ name: 'Test', rating: 5 });
  });
});