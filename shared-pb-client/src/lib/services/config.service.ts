import { Injectable, signal, Signal } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { ConfigResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class ConfigService extends BaseCollectionService<ConfigResponse> {
  protected override collectionName = 'config';
  
  private _current = signal<ConfigResponse | null>(null);

  get current(): Signal<ConfigResponse | null> {
    return this._current;
  }

  async loadCurrent(): Promise<ConfigResponse> {
    try {
      const record = await this.collection.getFirstListItem('');
      this._current.set(record as unknown as ConfigResponse);
      this.error.set(null);
      return record as unknown as ConfigResponse;
    } catch (err) {
      this.error.set(err as Error);
      throw err;
    }
  }

  override async update(id: string, data: Partial<ConfigResponse>): Promise<ConfigResponse> {
    const updated = await super.update(id, data);
    this._current.set(updated);
    return updated;
  }
}
