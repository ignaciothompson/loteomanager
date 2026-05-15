import { Injectable, signal, Signal } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { AuditLogResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class AuditLogService extends BaseCollectionService<AuditLogResponse> {
  protected override collectionName = 'audit_log';

  // Solo lectura: override create, update, delete para prevenir su uso
  override async create(data: Partial<AuditLogResponse>): Promise<AuditLogResponse> {
    throw new Error('AuditLog es de solo lectura.');
  }

  override async update(id: string, data: Partial<AuditLogResponse>): Promise<AuditLogResponse> {
    throw new Error('AuditLog es de solo lectura.');
  }

  override async delete(id: string): Promise<void> {
    throw new Error('AuditLog es de solo lectura.');
  }
}
