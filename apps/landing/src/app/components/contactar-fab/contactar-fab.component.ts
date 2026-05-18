import {
  Component, Input, signal, inject, OnInit,
  ViewChild, ElementRef, PLATFORM_ID, AfterViewInit,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, Validators } from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { DialogModule } from 'primeng/dialog';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { TextareaModule } from 'primeng/textarea';
import { ToastModule } from 'primeng/toast';
import { MessageService } from 'primeng/api';

declare const turnstile: {
  render(el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }): string;
  reset(widgetId: string): void;
};

@Component({
  selector: 'contactar-fab',
  standalone: true,
  imports: [
    CommonModule,
    ReactiveFormsModule,
    DialogModule,
    ButtonModule,
    InputTextModule,
    TextareaModule,
    ToastModule,
  ],
  providers: [MessageService],
  template: `
    <button (click)="abrirModal()"
            class="contactar-fab fixed bottom-6 right-6 lg:bottom-8 lg:right-8 z-50
                   px-5 py-3 lg:px-6 lg:py-4
                   bg-primary text-white rounded-full shadow-2xl
                   flex items-center gap-2
                   hover:scale-105 active:scale-95 transition-transform"
            aria-label="Contactar">
      <i class="pi pi-comments text-lg"></i>
      <span class="font-medium">Contactar</span>
    </button>

    <p-dialog [(visible)]="modalAbierto"
              [modal]="true"
              [draggable]="false"
              [resizable]="false"
              [closable]="!enviando()"
              [style]="{ width: '90vw', maxWidth: '500px' }">
      <ng-template pTemplate="header">
        <h2 class="text-xl font-semibold">Solicitar más información</h2>
      </ng-template>

      <form (ngSubmit)="enviar()" [formGroup]="form" class="space-y-4 pt-2">
        <!-- Honeypot -->
        <input type="text" formControlName="website" tabindex="-1"
               autocomplete="off" style="display:none" aria-hidden="true" />

        <div>
          <label class="block text-sm font-medium mb-1" for="cf-nombre">Nombre *</label>
          <input pInputText id="cf-nombre" formControlName="nombre" class="w-full"
                 autocomplete="name" />
          @if (form.get('nombre')?.invalid && form.get('nombre')?.touched) {
            <small class="text-red-500 text-xs mt-1 block">Nombre requerido</small>
          }
        </div>

        <div>
          <label class="block text-sm font-medium mb-1" for="cf-email">Email *</label>
          <input pInputText id="cf-email" type="email" formControlName="email" class="w-full"
                 autocomplete="email" />
          @if (form.get('email')?.invalid && form.get('email')?.touched) {
            <small class="text-red-500 text-xs mt-1 block">Email inválido</small>
          }
        </div>

        <div>
          <label class="block text-sm font-medium mb-1" for="cf-tel">Teléfono (opcional)</label>
          <input pInputText id="cf-tel" formControlName="telefono" class="w-full"
                 autocomplete="tel" />
        </div>

        <div>
          <label class="block text-sm font-medium mb-1" for="cf-msg">Mensaje</label>
          <textarea pInputTextarea id="cf-msg" formControlName="mensaje" rows="3" class="w-full"
                    placeholder="Contame qué te interesa..."></textarea>
        </div>

        <!-- Turnstile widget -->
        <div #turnstileContainer></div>

        <div class="flex justify-end gap-2 pt-2">
          <button type="button" pButton severity="secondary"
                  (click)="cerrarModal()"
                  [disabled]="enviando()"
                  label="Cancelar"></button>
          <button type="submit" pButton
                  [disabled]="form.invalid || enviando() || !turnstileToken()"
                  [loading]="enviando()"
                  label="Enviar"></button>
        </div>
      </form>
    </p-dialog>

    <p-toast position="top-center" />
  `,
})
export class ContactarFabComponent implements AfterViewInit {
  @Input({ required: true }) comparativaId!: string;
  @ViewChild('turnstileContainer') turnstileContainer!: ElementRef<HTMLElement>;

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private toast = inject(MessageService);
  private platformId = inject(PLATFORM_ID);

  modalAbierto = false;
  readonly enviando = signal(false);
  readonly turnstileToken = signal<string | null>(null);
  private turnstileWidgetId: string | null = null;

  readonly form = this.fb.group({
    website: [''],
    nombre: ['', Validators.required],
    email: ['', [Validators.required, Validators.email]],
    telefono: [''],
    mensaje: [''],
  });

  ngAfterViewInit() {}

  abrirModal() {
    this.modalAbierto = true;
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.loadTurnstile(), 300);
    }
  }

  cerrarModal() {
    this.modalAbierto = false;
    this.form.reset();
    this.turnstileToken.set(null);
  }

  private loadTurnstile() {
    if (!isPlatformBrowser(this.platformId)) return;
    const siteKey = ((window as unknown) as Record<string, unknown>)['TURNSTILE_SITE_KEY'] as string
      ?? '';
    if (!siteKey || !this.turnstileContainer?.nativeElement) return;

    if (typeof turnstile === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => this.renderTurnstile(siteKey);
      document.head.appendChild(script);
    } else {
      this.renderTurnstile(siteKey);
    }
  }

  private renderTurnstile(siteKey: string) {
    if (!this.turnstileContainer?.nativeElement) return;
    this.turnstileWidgetId = turnstile.render(this.turnstileContainer.nativeElement, {
      sitekey: siteKey,
      callback: (token: string) => this.turnstileToken.set(token),
    });
  }

  async enviar() {
    if (this.form.invalid || this.enviando()) return;
    this.enviando.set(true);

    try {
      await firstValueFrom(
        this.http.post('/api/leads/from-comparativa', {
          ...this.form.value,
          comparativa_id: this.comparativaId,
          'cf-turnstile-response': this.turnstileToken(),
        }),
      );
      this.toast.add({
        severity: 'success',
        summary: '¡Gracias!',
        detail: 'Nos pondremos en contacto pronto.',
        life: 4000,
      });
      this.cerrarModal();
    } catch {
      this.toast.add({
        severity: 'error',
        summary: 'Error',
        detail: 'Hubo un problema. Intentá de nuevo.',
        life: 4000,
      });
      if (this.turnstileWidgetId) {
        turnstile.reset(this.turnstileWidgetId);
        this.turnstileToken.set(null);
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
