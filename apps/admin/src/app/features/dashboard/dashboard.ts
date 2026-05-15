import { Component, inject, OnInit, computed } from '@angular/core';
import { CommonModule } from '@angular/common';
import { UnidadesService, InteresadosService } from '@loteomanager/shared-pb-client';
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

    disponibles = this.unidadesService.list('estado = "disponible"');
    reservadas = this.unidadesService.list('estado = "reservado" || estado = "sena"');
    ventas = this.unidadesService.list('estado = "vendido" || estado = "escriturado"');
    
    leadsNuevos = this.interesadosService.list('estado = "nuevo"');

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
}
