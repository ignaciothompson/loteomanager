import {
  AfterViewInit,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  HostListener,
  ViewChild,
  input,
  output
} from '@angular/core';

@Component({
  selector: 'app-organizar-panel',
  standalone: true,
  changeDetection: ChangeDetectionStrategy.OnPush,
  template: `
    <aside class="org-abm-panel" [class.org-abm-panel--leaving]="leaving()" role="complementary">
      <header class="org-abm-panel__head">
        <h2 #titleEl class="org-abm-panel__title" tabindex="-1">{{ title() }}</h2>
        <button
          type="button"
          class="org-abm-panel__close"
          aria-label="Cerrar panel"
          (click)="close.emit()"
        >
          <i class="pi pi-times" aria-hidden="true"></i>
        </button>
      </header>
      <div class="org-abm-panel__body">
        <ng-content />
      </div>
    </aside>
  `
})
export class OrganizarPanelComponent implements AfterViewInit {
  title = input.required<string>();
  leaving = input(false);
  close = output<void>();

  @ViewChild('titleEl') private titleEl?: ElementRef<HTMLElement>;

  ngAfterViewInit(): void {
    this.titleEl?.nativeElement.focus();
  }

  @HostListener('document:keydown.escape', ['$event'])
  onEscape(ev: Event): void {
    if (document.querySelector('.p-confirmdialog .p-dialog-mask, .p-dialog-mask')) return;
    ev.preventDefault();
    this.close.emit();
  }
}
