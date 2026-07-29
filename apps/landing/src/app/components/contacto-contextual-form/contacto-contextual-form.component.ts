import {
  Component,
  input,
  output,
  signal,
  inject,
  ViewChild,
  ElementRef,
  PLATFORM_ID,
} from '@angular/core';
import { CommonModule, isPlatformBrowser } from '@angular/common';
import {
  ReactiveFormsModule,
  FormBuilder,
  Validators,
  AbstractControl,
  ValidationErrors,
} from '@angular/forms';
import { HttpClient } from '@angular/common/http';
import { firstValueFrom } from 'rxjs';
import { ButtonModule } from 'primeng/button';
import { InputTextModule } from 'primeng/inputtext';
import { resolveTurnstileSiteKey } from '../../utils/turnstile-site-key';

declare const turnstile: {
  render(el: HTMLElement, opts: { sitekey: string; callback: (token: string) => void }): string;
  reset(widgetId: string): void;
};

function emailOrTelefonoValidator(group: AbstractControl): ValidationErrors | null {
  const email = String(group.get('email')?.value ?? '').trim();
  const telefono = String(group.get('telefono')?.value ?? '').trim();
  return email || telefono ? null : { contactoRequerido: true };
}

@Component({
  selector: 'contacto-contextual-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule],
  template: `
    <form (ngSubmit)="enviar()" [formGroup]="form" class="space-y-4 pt-2">
      <input
        type="text"
        formControlName="website"
        tabindex="-1"
        autocomplete="off"
        style="display:none"
        aria-hidden="true"
      />

      <div>
        <label class="block text-sm font-medium mb-1" [attr.for]="idPrefix + '-nombre'">Nombre *</label>
        <input
          pInputText
          [id]="idPrefix + '-nombre'"
          formControlName="nombre"
          class="w-full"
          autocomplete="name"
        />
        @if (form.get('nombre')?.invalid && form.get('nombre')?.touched) {
          <small class="text-red-500 text-xs mt-1 block">Nombre requerido</small>
        }
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" [attr.for]="idPrefix + '-email'">Email</label>
        <input
          pInputText
          [id]="idPrefix + '-email'"
          type="email"
          formControlName="email"
          class="w-full"
          autocomplete="email"
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" [attr.for]="idPrefix + '-tel'">Teléfono</label>
        <input
          pInputText
          [id]="idPrefix + '-tel'"
          formControlName="telefono"
          class="w-full"
          autocomplete="tel"
        />
      </div>

      @if (form.hasError('contactoRequerido') && (form.get('email')?.touched || form.get('telefono')?.touched)) {
        <small class="text-red-500 text-xs block">Indicá email o teléfono</small>
      }

      <div #turnstileContainer></div>

      @if (estado() === 'exito') {
        <p class="text-sm text-green-700 dark:text-green-300">¡Gracias! Nos pondremos en contacto pronto.</p>
      }
      @if (estado() === 'error') {
        <p class="text-sm text-red-500">Hubo un problema. Intentá de nuevo.</p>
      }

      <div class="flex justify-end gap-2 pt-2">
        @if (showCancel()) {
          <button
            type="button"
            pButton
            severity="secondary"
            (click)="cancel.emit()"
            [disabled]="enviando()"
            label="Cancelar"
          ></button>
        }
        <button
          type="submit"
          pButton
          [disabled]="form.invalid || enviando() || !turnstileToken()"
          [loading]="enviando()"
          label="Enviar"
        ></button>
      </div>
    </form>
  `,
})
export class ContactoContextualFormComponent {
  readonly barrioId = input<string | undefined>(undefined);
  readonly unidadId = input<string | undefined>(undefined);
  readonly comparativaId = input<string | undefined>(undefined);
  readonly showCancel = input(false);

  readonly cancel = output<void>();
  readonly success = output<void>();

  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  @ViewChild('turnstileContainer') turnstileContainer!: ElementRef<HTMLElement>;

  readonly idPrefix = `ccf-${Math.random().toString(36).slice(2, 8)}`;
  readonly enviando = signal(false);
  readonly estado = signal<'idle' | 'enviando' | 'exito' | 'error'>('idle');
  readonly turnstileToken = signal<string | null>(null);
  private turnstileWidgetId: string | null = null;

  readonly form = this.fb.group(
    {
      website: [''],
      nombre: ['', Validators.required],
      email: ['', Validators.email],
      telefono: [''],
    },
    { validators: emailOrTelefonoValidator },
  );

  /** Parent FAB calls when opening dialog. */
  prepareTurnstile(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.loadTurnstile(), 300);
    }
  }

  /** Inline mount (página barrio /contacto context). */
  initInline(): void {
    this.prepareTurnstile();
  }

  resetForm(): void {
    this.form.reset({ website: '', nombre: '', email: '', telefono: '' });
    this.turnstileToken.set(resolveTurnstileSiteKey() ? null : 'dev-bypass');
    this.estado.set('idle');
    console.log('[contacto-contextual] resetForm token=', this.turnstileToken());
  }

  private loadTurnstile(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const siteKey = resolveTurnstileSiteKey();
    if (!siteKey) {
      console.log('[contacto-contextual] no site key → dev-bypass');
      this.turnstileToken.set('dev-bypass');
      return;
    }
    if (!this.turnstileContainer?.nativeElement) {
      console.warn('[contacto-contextual] container missing');
      return;
    }

    console.log('[contacto-contextual] loading Turnstile...');
    if (typeof turnstile === 'undefined') {
      const existing = document.querySelector(
        'script[src*="challenges.cloudflare.com/turnstile"]',
      ) as HTMLScriptElement | null;
      if (existing) {
        if ((window as unknown as { turnstile?: unknown }).turnstile) {
          this.renderTurnstile(siteKey);
        } else {
          existing.addEventListener('load', () => this.renderTurnstile(siteKey));
        }
        return;
      }
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => this.renderTurnstile(siteKey);
      script.onerror = () => {
        console.error('[contacto-contextual] script fail → bypass');
        this.turnstileToken.set('dev-bypass');
      };
      document.head.appendChild(script);
    } else {
      this.renderTurnstile(siteKey);
    }
  }

  private renderTurnstile(siteKey: string): void {
    if (!this.turnstileContainer?.nativeElement) return;
    this.turnstileContainer.nativeElement.innerHTML = '';
    this.turnstileWidgetId = turnstile.render(this.turnstileContainer.nativeElement, {
      sitekey: siteKey,
      callback: (token: string) => {
        console.log('[contacto-contextual] token ok len=', token.length);
        this.turnstileToken.set(token);
      },
    });
  }

  async enviar(): Promise<void> {
    console.log('[contacto-contextual] enviar', {
      valid: this.form.valid,
      token: this.turnstileToken(),
      barrioId: this.barrioId(),
      unidadId: this.unidadId(),
      comparativaId: this.comparativaId(),
    });
    if (this.form.invalid || this.enviando()) {
      console.warn('[contacto-contextual] blocked');
      return;
    }
    this.enviando.set(true);
    this.estado.set('enviando');

    try {
      const body = {
        ...this.form.value,
        barrio_id: this.barrioId() || undefined,
        unidad_id: this.unidadId() || undefined,
        comparativa_id: this.comparativaId() || undefined,
        'cf-turnstile-response': this.turnstileToken(),
      };
      console.log('[contacto-contextual] POST /api/leads', body);
      const res = await firstValueFrom(this.http.post('/api/leads', body));
      console.log('[contacto-contextual] success', res);
      this.estado.set('exito');
      this.form.reset({ website: '', nombre: '', email: '', telefono: '' });
      this.success.emit();
    } catch (err) {
      console.error('[contacto-contextual] POST failed', err);
      this.estado.set('error');
      if (this.turnstileWidgetId) {
        turnstile.reset(this.turnstileWidgetId);
        this.turnstileToken.set(null);
      } else if (!resolveTurnstileSiteKey()) {
        this.turnstileToken.set('dev-bypass');
      }
    } finally {
      this.enviando.set(false);
    }
  }
}
