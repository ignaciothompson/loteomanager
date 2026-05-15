import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { ComparativasResponse, ComparativasRecord } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class ComparativasService extends BaseCollectionService<ComparativasResponse> {
  protected override collectionName = 'comparativas';

  async crear(payload: Partial<ComparativasRecord>): Promise<{ record: ComparativasResponse; url: string }> {
    const record = await this.create(payload);
    // Assuming publicBaseUrl is configured somewhere, for now hardcoding localhost or using window origin
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : 'http://localhost:4200';
    const publicUrl = `${baseUrl}/c/${record.token_publico}`;
    return { record, url: publicUrl };
  }

  async generarPdf(comparativaId: string): Promise<string> {
    // TODO: Llamar al endpoint PDF
    // Mock for now
    console.log(`Simulando generación de PDF para la comparativa ${comparativaId}`);
    return Promise.resolve(`http://localhost:8080/api/files/comparativas/${comparativaId}/mock.pdf`);
  }
}
