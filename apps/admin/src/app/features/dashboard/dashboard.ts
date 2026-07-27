import { Component, inject, OnInit, computed, effect, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import {
  UnidadesService,
  InteresadosService,
  AuthService,
  VendedorAccesoService,
  type ReloadableSignal,
} from '@loteomanager/shared-pb-client';
import { ChartModule } from 'primeng/chart';

@Component({
    selector: 'app-dashboard',
    standalone: true,
    imports: [CommonModule, ChartModule],
    templateUrl: './dashboard.html',
    styleUrls: ['./dashboard.css']
})
export class Dashboard implements OnInit {
    private unidadesService = inject(UnidadesService);
    private interesadosService = inject(InteresadosService);
    private authService = inject(AuthService);
    private vendedorAcceso = inject(VendedorAccesoService);

    disponibles = this.createAccesoList((ids) =>
        this.unidadesService.listByBarrios(ids, 'estado = "disponible"')
    );
    reservadas = this.createAccesoList((ids) =>
        this.unidadesService.listByBarrios(ids, 'estado = "reservado" || estado = "sena"')
    );
    ventas = this.createAccesoList((ids) =>
        this.unidadesService.listByBarrios(ids, 'estado = "vendido" || estado = "escriturado"')
    );

    leadsNuevos = this.createAccesoList((ids) =>
        this.interesadosService.listVisibles(ids).then((rows) =>
            rows.filter((r) => r.estado === 'nuevo')
        )
    );

    chartOptions: any;

    chartData = computed(() => {
        return {
            labels: ['Disponibles', 'Reservadas/Señadas', 'Vendidas/Escrituradas'],
            datasets: [
                {
                    data: [
                        this.disponibles().length,
                        this.reservadas().length,
                        this.ventas().length
                    ],
                    backgroundColor: ['#3b82f6', '#f97316', '#a855f7'],
                    hoverBackgroundColor: ['#2563eb', '#ea580c', '#9333ea']
                }
            ]
        };
    });

    constructor() {
        effect(() => {
            this.vendedorAcceso.barriosVisibles();
            this.vendedorAcceso.accesoReady();
            this.authService.currentUser();
            this.disponibles.reload();
            this.reservadas.reload();
            this.ventas.reload();
            this.leadsNuevos.reload();
        });
    }

    ngOnInit() {
        this.initChartOptions();
    }

    initChartOptions() {
        const documentStyle = getComputedStyle(document.documentElement);
        const textColor = documentStyle.getPropertyValue('--text-color');

        this.chartOptions = {
            plugins: {
                legend: {
                    labels: {
                        color: textColor
                    }
                }
            }
        };
    }

    private createAccesoList<T>(
        loader: (barrioIds: string[] | null) => Promise<T[]>
    ): ReloadableSignal<T[]> {
        const data = signal<T[]>([]) as ReloadableSignal<T[]>;
        const load = async () => {
            const { barrioIds, waiting } = this.vendedorAcceso.resolveBarrioIds();
            if (waiting) {
                data.set([]);
                return;
            }
            data.set(await loader(barrioIds));
        };
        data.reload = () => {
            void load();
        };
        void load();
        return data;
    }
}
