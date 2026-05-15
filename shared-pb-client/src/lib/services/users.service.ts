import { Injectable } from '@angular/core';
import { BaseCollectionService } from '../base-collection.service';
import { UsersResponse } from '@loteomanager/shared-types';

@Injectable({
  providedIn: 'root'
})
export class UsersService extends BaseCollectionService<UsersResponse> {
  protected override collectionName = 'users';
}
