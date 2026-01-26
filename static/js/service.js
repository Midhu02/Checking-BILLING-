class ReportsManager {
    constructor() {
        this.init();
    }

    init() {
        this.cacheElements();
        this.attachEvents();
        this.loadReports(); // Load today's stats on page open
    }

    cacheElements() {
        this.el = {
            totalSales: document.getElementById('totalSales'),
            serviceIncome: document.getElementById('serviceIncome'),
            totalRevenue: document.getElementById('totalRevenue'),
            dailySales: document.getElementById('dailySales'),
            monthlySales: document.getElementById('monthlySales'),
            startDate: document.getElementById('startDate'),
            endDate: document.getElementById('endDate'),
            generateBtn: document.getElementById('generateReportBtn')
        };
    }

    attachEvents() {
        this.el.generateBtn?.addEventListener('click', () => {
            const start = this.el.startDate.value;
            const end = this.el.endDate.value;
            
            if (start && end) {
                this.loadReports({ start, end });
            } else {
                alert("Please select both dates to filter.");
            }
        });
    }

    async loadReports(range = null) {
        try {
            let url = '/api/reports/';
            if (range) {
                url += `?start=${range.start}&end=${range.end}`;
            }

            const data = await window.billingApp.apiRequest(url);
            this.renderSummary(data);
        } catch (e) {
            console.error("Report Error:", e);
        }
    }

    renderSummary(data) {
        const fmt = v => '₹' + Number(v || 0).toLocaleString('en-IN', { 
            minimumFractionDigits: 2,
            maximumFractionDigits: 2 
        });

        // Set the card values
        this.el.totalSales.textContent = fmt(data.total_sales);
        this.el.serviceIncome.textContent = fmt(data.service_income);
        this.el.totalRevenue.textContent = fmt(data.total_revenue);
        this.el.dailySales.textContent = fmt(data.daily_sales);
        this.el.monthlySales.textContent = fmt(data.monthly_sales);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.reports-page')) {
        new ReportsManager();
    }
});
