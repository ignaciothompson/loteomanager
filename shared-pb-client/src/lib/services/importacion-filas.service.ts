import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { ImportacionFilasResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class ImportacionFilasService extends BaseCollectionService<ImportacionFilasResponse> {
  protected override collectionName = 'importacion_filas';
}
