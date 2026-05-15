import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { ArquitectosResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class ArquitectosService extends BaseCollectionService<ArquitectosResponse> {
  protected override collectionName = 'arquitectos';
}
