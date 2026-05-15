import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { BarriosResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class BarriosService extends BaseCollectionService<BarriosResponse> {
  protected override collectionName = 'barrios';
}
