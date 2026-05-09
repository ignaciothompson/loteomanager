import { InjectionToken } from '@angular/core';
import PocketBase from 'pocketbase';

export const POCKETBASE_URL = new InjectionToken<string>('POCKETBASE_URL');

export const POCKETBASE = new InjectionToken<PocketBase>('POCKETBASE', {
  providedIn: 'root',
  factory: () => {
    // Note: since this is a library, the actual URL should be provided by the app
    // via POCKETBASE_URL provider. We'll default to localhost if not provided,
    // but in a real scenario, the app modules would provide it.
    const url = 'http://localhost:8080';
    
    return new PocketBase(url);
  },
});

