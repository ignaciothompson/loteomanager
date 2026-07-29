import {
  Component,
  signal,
  inject,
  ViewChild,
  ElementRef,
  PLATFORM_ID,
  AfterViewInit,
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
import { TextareaModule } from 'primeng/textarea';
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
  selector: 'contacto-form',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, ButtonModule, InputTextModule, TextareaModule],
  template: `
    <form (ngSubmit)="enviar()" [formGroup]="form" class="space-y-4">
      <input
        type="text"
        formControlName="website"
        tabindex="-1"
        autocomplete="off"
        style="display:none"
        aria-hidden="true"
      />

      <div>
        <label class="block text-sm font-medium mb-1" for="cf-nombre">Nombre *</label>
        <input pInputText id="cf-nombre" formControlName="nombre" class="w-full" autocomplete="name" />
        @if (form.get('nombre')?.invalid && form.get('nombre')?.touched) {
          <small class="text-red-500 text-xs mt-1 block">Nombre requerido</small>
        }
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="cf-email">Email</label>
        <input
          pInputText
          id="cf-email"
          type="email"
          formControlName="email"
          class="w-full"
          autocomplete="email"
        />
      </div>

      <div>
        <label class="block text-sm font-medium mb-1" for="cf-tel">Teléfono</label>
        <input pInputText id="cf-tel" formControlName="telefono" class="w-full" autocomplete="tel" />
      </div>

      @if (form.hasError('contactoRequerido') && (form.get('email')?.touched || form.get('telefono')?.touched)) {
        <small class="text-red-500 text-xs block">Indicá email o teléfono</small>
      }

      <div>
        <label class="block text-sm font-medium mb-1" for="cf-msg">Mensaje</label>
        <textarea
          pTextarea
          id="cf-msg"
          formControlName="mensaje"
          rows="4"
          class="w-full"
          placeholder="Contame qué te interesa..."
        ></textarea>
      </div>

      <div #turnstileContainer></div>

      @if (estado() === 'exito') {
        <p class="text-sm text-green-700 dark:text-green-300">¡Gracias! Nos pondremos en contacto pronto.</p>
      }
      @if (estado() === 'error') {
        <p class="text-sm text-red-500">Hubo un problema. Intentá de nuevo.</p>
      }

      <div class="flex justify-end pt-2">
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
export class ContactoFormComponent implements AfterViewInit {
  private fb = inject(FormBuilder);
  private http = inject(HttpClient);
  private platformId = inject(PLATFORM_ID);

  @ViewChild('turnstileContainer') turnstileContainer!: ElementRef<HTMLElement>;

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
      mensaje: [''],
    },
    { validators: emailOrTelefonoValidator },
  );

  ngAfterViewInit(): void {
    if (isPlatformBrowser(this.platformId)) {
      setTimeout(() => this.loadTurnstile(), 100);
    }
  }

  private loadTurnstile(): void {
    if (!isPlatformBrowser(this.platformId)) return;
    const siteKey = resolveTurnstileSiteKey();
    if (!siteKey) {
      console.log('[contacto-form] no site key → dev-bypass');
      this.turnstileToken.set('dev-bypass');
      return;
    }
    if (!this.turnstileContainer?.nativeElement) {
      console.warn('[contacto-form] turnstile container missing');
      return;
    }

    console.log('[contacto-form] loading Turnstile widget...');
    if (typeof turnstile === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://challenges.cloudflare.com/turnstile/v0/api.js';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('[contacto-form] turnstile script loaded');
        this.renderTurnstile(siteKey);
      };
      script.onerror = () => {
        console.error('[contacto-form] turnstile script failed → bypass');
        this.turnstileToken.set('dev-bypass');
      };
      document.head.appendChild(script);
    } else {
      this.renderTurnstile(siteKey);
    }
  }

  private renderTurnstile(siteKey: string): void {
    if (!this.turnstileContainer?.nativeElement) return;
    this.turnstileWidgetId = turnstile.render(this.turnstileContainer.nativeElement, {
      sitekey: siteKey,
      callback: (token: string) => {
        console.log('[contacto-form] turnstile token ok len=', token.length);
        this.turnstileToken.set(token);
      },
    });
  }

  async enviar(): Promise<void> {
    console.log('[contacto-form] enviar', {
      valid: this.form.valid,
      errors: this.form.errors,
      token: this.turnstileToken(),
      value: { ...this.form.value, website: '(hidden)' },
    });
    if (this.form.invalid || this.enviando()) {
      console.warn('[contacto-form] blocked', {
        invalid: this.form.invalid,
        enviando: this.enviando(),
      });
      return;
    }
    this.enviando.set(true);
    this.estado.set('enviando');

    try {
      const body = {
        ...this.form.value,
        'cf-turnstile-response': this.turnstileToken(),
      };
      console.log('[contacto-form] POST /api/leads', body);
      const res = await firstValueFrom(this.http.post('/api/leads', body));
      console.log('[contacto-form] success', res);
      this.estado.set('exito');
      this.form.reset({ website: '', nombre: '', email: '', telefono: '', mensaje: '' });
      if (!resolveTurnstileSiteKey()) this.turnstileToken.set('dev-bypass');
    } catch (err) {
      console.error('[contacto-form] POST failed', err);
      this.estado.set('error');
      if (this.turnstileWidgetId) {
        turnstile.reset(this.turnstileWidgetId);
        this.turnstileToken.set(null);
      } else if (!resolveTurnstileSiteKey()) {
        this.turnstileToken.set('dev-bypass');
      }
    } finally {
      this.enviando.set(false);
      console.log('[contacto-form] done estado=', this.estado());
    }
  }
}
