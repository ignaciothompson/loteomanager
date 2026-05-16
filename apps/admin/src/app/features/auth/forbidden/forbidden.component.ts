import { Component, inject } from '@angular/core';
import { Router } from '@angular/router';
import { ButtonModule } from 'primeng/button';
import { CardModule } from 'primeng/card';

@Component({
  selector: 'app-forbidden',
  standalone: true,
  imports: [ButtonModule, CardModule],
  templateUrl: './forbidden.component.html',
  styleUrls: ['./forbidden.component.css'],
})
export class ForbiddenComponent {
  readonly router = inject(Router);
}
