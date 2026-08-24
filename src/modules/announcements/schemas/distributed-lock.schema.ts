import { Prop, Schema, SchemaFactory } from '@nestjs/mongoose';
import { HydratedDocument } from 'mongoose';

export type DistributedLockDocument = HydratedDocument<DistributedLock>;

@Schema({
  timestamps: true,
  collection: 'distributed_locks',
})
export class DistributedLock {
  @Prop({ required: true })
  key!: string;

  @Prop({ type: Date, required: true, index: { expires: 0 } })
  expiresAt!: Date;
}

export const DistributedLockSchema =
  SchemaFactory.createForClass(DistributedLock);
