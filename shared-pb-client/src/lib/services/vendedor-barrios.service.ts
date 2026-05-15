import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { VendedorBarriosResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class VendedorBarriosService extends BaseCollectionService<VendedorBarriosResponse> {
  protected override collectionName = 'vendedor_barrios';
}
