import { inject, signal, Signal } from '@angular/core';
import { POCKETBASE } from './pocketbase.config';
import { RecordService } from 'pocketbase';

export abstract class BaseCollectionService<T> {
  protected pb = inject(POCKETBASE);
  protected abstract collectionName: string;

  public error = signal<Error | null>(null);

  protected get collection(): RecordService {
    return this.pb.collection(this.collectionName);
  }

  list(filter?: string): Signal<T[]> {
    const data = signal<T[]>([]);
    this.collection
      .getFullList({ filter })
      .then((records) => {
        data.set(records as unknown as T[]);
        this.error.set(null);
      })
      .catch((err) => this.error.set(err));
    return data;
  }

  get(id: string): Signal<T | null> {
    const data = signal<T | null>(null);
    this.collection
      .getOne(id)
      .then((record) => {
        data.set(record as unknown as T);
        this.error.set(null);
      })
      .catch((err) => this.error.set(err));
    return data;
  }

  async create(data: Partial<T>): Promise<T> {
    try {
      const record = await this.collection.create(data);
      this.error.set(null);
      return record as unknown as T;
    } catch (err) {
      this.error.set(err as Error);
      throw err;
    }
  }

  async update(id: string, data: Partial<T>): Promise<T> {
    try {
      const record = await this.collection.update(id, data);
      this.error.set(null);
      return record as unknown as T;
    } catch (err) {
      this.error.set(err as Error);
      throw err;
    }
  }

  async delete(id: string): Promise<void> {
    try {
      await this.collection.delete(id);
      this.error.set(null);
    } catch (err) {
      this.error.set(err as Error);
      throw err;
    }
  }
}
