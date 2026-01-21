// static/js/invoice.js

// --------------------
// Debounce utility
// --------------------
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// --------------------
// PRINT HELPER (NEW)
// --------------------
/**
 * Call this after saving invoice
 * or from anywhere using invoice number
 */
function printInvoiceByNo(invoiceNo) {
    if (typeof printInvoice !== 'function') {
        console.error('printInvoice() not found');
        return;
    }

    // If invoices are stored in localStorage
    const allInvoices = JSON.parse(localStorage.getItem('ms_invoices_v1')) || [];
    const inv = allInvoices.find(i => i.id === invoiceNo || i.invoice_no === invoiceNo);

    if (!inv) {
        alert('Invoice not found for printing');
        return;
    }

    // Use SAME thermal print layout you already created
    printInvoice(inv.id || inv.invoice_no);
}

// --------------------
// Invoice Manager
// --------------------
class InvoiceManager {
    constructor() {
        this.currentTab = 'product';
        this.invoices = [];
        this.services = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.setupServiceCreationListener();
        this.loadData();
    }

    setupServiceCreationListener() {
        window.addEventListener('serviceCreated', () => {
            if (this.currentTab === 'service') this.loadData();
        });
    }

    setupEventListeners() {

        const productTabBtn = document.getElementById('productTabBtn');
        productTabBtn?.addEventListener('click', () => this.switchTab('product'));

        const serviceTabBtn = document.getElementById('serviceTabBtn');
        serviceTabBtn?.addEventListener('click', () => this.switchTab('service'));

        document.getElementById('dateFilter')
            ?.addEventListener('change', () => this.applyFilters());

        document.getElementById('customerFilter')
            ?.addEventListener('input', debounce(() => this.applyFilters(), 300));

        document.getElementById('clearFilters')
            ?.addEventListener('click', () => this.clearFilters());

        document.getElementById('exportBtn')
            ?.addEventListener('click', () => this.exportToCSV());

        document.getElementById('prevInvoicePage')
            ?.addEventListener('click', () => this.changePage(-1));

        document.getElementById('nextInvoicePage')
            ?.addEventListener('click', () => this.changePage(1));

        // View button delegation
        const invoicesBody = document.getElementById('invoicesBody');
        invoicesBody?.addEventListener('click', (e) => {
            if (e.target.classList.contains('btn') && e.target.textContent.trim() === 'View') {
                const invoiceNo = e.target.closest('tr')
                    .querySelector('td:first-child').textContent.trim();

                this.currentTab === 'product'
                    ? this.viewInvoice(invoiceNo)
                    : this.viewService(invoiceNo);
            }
        });
    }

    switchTab(tab) {
        this.currentTab = tab;
        this.currentPage = 1;
        this.displayedInvoices = null;
        this.displayedServices = null;

        document.getElementById('productTabBtn')?.classList.toggle('active', tab === 'product');
        document.getElementById('serviceTabBtn')?.classList.toggle('active', tab === 'service');
        document.getElementById('listTitle').textContent =
            tab === 'product' ? 'Product Invoice List' : 'Service Invoice List';

        this.loadData();
    }

    async loadData() {
        try {
            if (this.currentTab === 'product') {
                const data = await window.billingApp.apiRequest('/api/bills/');
                this.invoices = data.results || data;
                this.applyFilters();
            } else {
                const data = await window.billingApp.apiRequest('/api/services/');
                this.services = data.results || data;
                this.applyFilters();
            }
        } catch (e) {
            console.error(e);
            window.billingApp.showToast('Failed to load invoices', 'error');
        }
    }

    // --------------------
    // PRINT AFTER SAVE (CALL FROM BILLING PAGE)
    // --------------------
    autoPrintAfterSave(invoiceNo) {
        setTimeout(() => {
            printInvoiceByNo(invoiceNo);
        }, 300);
    }

    renderInvoices() {
        const body = document.getElementById('invoicesBody');
        if (!body) return;

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const paginated = (this.displayedInvoices || this.invoices).slice(start, end);

        body.innerHTML = paginated.map(inv => `
            <tr>
                <td>${inv.invoice_no}</td>
                <td>${new Date(inv.created_at).toLocaleDateString('en-IN')}</td>
                <td>${inv.customer_name}</td>
                <td>₹${parseFloat(inv.grand_total).toFixed(2)}</td>
                <td>
                    <button class="btn btn-sm btn-info">View</button>
                </td>
            </tr>
        `).join('');
        
        this.updatePaginationControls(this.displayedInvoices?.length || this.invoices.length);
    }

    renderServices() {
        const body = document.getElementById('invoicesBody');
        if (!body) return;

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const data = this.displayedServices || this.services;
        const paginated = data.slice(start, end);

        body.innerHTML = paginated.map(ser => {
            // Smart fallback for total
            const total = ser.service_price || 0;
            
            return `
                <tr>
                    <td>${ser.service_invoice_no || ser.service_id}</td>
                    <td>${new Date(ser.created_at).toLocaleDateString('en-IN')}</td>
                    <td>${ser.customer_name}</td>
                    <td style="font-weight: bold; color: #fff;">₹${parseFloat(total).toFixed(2)}</td>
                    <td>
                        <button class="btn btn-sm btn-info">View</button>
                    </td>
                </tr>
            `;
        }).join('');

        this.updatePaginationControls(data.length);
    }

    updatePaginationControls(totalItems) {
        const totalPages = Math.ceil(totalItems / this.itemsPerPage);
        const pageInfo = document.getElementById('invoicePageInfo');
        if (pageInfo) pageInfo.textContent = `Page ${this.currentPage} of ${totalPages || 1}`;
        
        const prevBtn = document.getElementById('prevInvoicePage');
        const nextBtn = document.getElementById('nextInvoicePage');
        if (prevBtn) prevBtn.disabled = this.currentPage <= 1;
        if (nextBtn) nextBtn.disabled = this.currentPage >= totalPages;
    }
    
    changePage(step) {
        this.currentPage += step;
        this.currentTab === 'product' ? this.renderInvoices() : this.renderServices();
    }

    // --------------------
    // EXISTING VIEW LOGIC (UNCHANGED)
    // --------------------
    // Helper to create the popup structure
    showCustomPopup(title, detailsHtml) {
        // Remove existing modal if any
        const existing = document.querySelector('.invoice-modal-overlay');
        if (existing) existing.remove();

        const modalHtml = `
            <div class="invoice-modal-overlay">
                <div class="invoice-modal-content">
                    <div class="invoice-modal-header">
                        <h4 style="margin:0; color:#333;">${title}</h4>
                    </div>
                    <div class="invoice-modal-body">
                        ${detailsHtml}
                    </div>
                    <div class="invoice-modal-footer">
                        <button class="btn-close-modal" onclick="this.closest('.invoice-modal-overlay').remove()">Close</button>
                    </div>
                </div>
            </div>
        `;
        document.body.insertAdjacentHTML('beforeend', modalHtml);
    }

    viewInvoice(invoiceNo) {
        const inv = this.invoices.find(i => i.invoice_no === invoiceNo);
        if (!inv) return window.billingApp.showToast('Invoice not found', 'error');

        // Log to console for debugging
        console.log("Processing Items:", inv.items);

        const itemsHtml = (inv.items || []).map(item => {
    const productName = item.product ? item.product.name : 'Unknown Product';
    const itemTotal = parseFloat(item.total || item.price || 0).toFixed(2);
    const unitPrice = parseFloat(item.price || 0).toFixed(2);

    return `
        <div class="invoice-item" style="padding: 10px 0; border-bottom: 1px solid #eee; display: flex; flex-direction: column; gap: 4px;">
            <div style="display: flex; justify-content: space-between; align-items: flex-start;">
                <span style="font-weight: 600; color: #333; font-size: 14px; flex: 1; padding-right: 10px;">
                    ${productName.toUpperCase()}
                </span>
                <span style="font-weight: 700; color: #2c3e50; font-size: 14px; white-space: nowrap;">
                    ₹${itemTotal}
                </span>
            </div>

            <div style="display: flex; justify-content: flex-start; gap: 15px; font-size: 12px; color: #7f8c8d;">
                <span style="background: #f0f0f0; padding: 2px 6px; border-radius: 4px; font-family: monospace;">
                    QTY: ${item.quantity}
                </span>
                <span>@ ₹${unitPrice} each</span>
            </div>
        </div>
    `;
}).join('');

        const content = `
            <div style="background: white;">
                <div class="invoice-info-row"><span>Invoice No:</span> <strong>${inv.invoice_no}</strong></div>
                <div class="invoice-info-row"><span>Customer:</span> <strong>${inv.customer_name}</strong></div>
                <div class="invoice-info-row"><span>Phone:</span> <strong>${inv.customer_phone || 'N/A'}</strong></div>
                <div class="invoice-info-row"><span>Date:</span> <strong>${new Date(inv.created_at).toLocaleDateString('en-IN')}</strong></div>
                
                <div class="invoice-items-list" style="margin-top: 15px; background: #fafafa; padding: 12px; border-radius: 8px; border: 1px solid #eee;">
                    <div style="font-size: 11px; color: #999; text-transform: uppercase; margin-bottom: 8px; border-bottom: 1px solid #ddd; padding-bottom: 4px;">Items Purchased</div>
                    ${itemsHtml || '<div style="text-align:center; color:#999;">No items listed</div>'}
                </div>

                <div style="margin-top: 15px; padding: 10px; background: #fff9f0; border-radius: 8px;">
                    <div class="invoice-info-row" style="font-size: 13px; margin-bottom: 4px;">
                        <span>Subtotal:</span> <span>₹${parseFloat(inv.subtotal).toFixed(2)}</span>
                    </div>
                    <div class="invoice-info-row" style="font-size: 13px; margin-bottom: 4px;">
                        <span>GST Amount:</span> <span>₹${parseFloat(inv.gst_amount).toFixed(2)}</span>
                    </div>
                    <div class="invoice-info-row" style="font-size: 18px; color: #d35400; border-top: 1px solid #ffd8a8; margin-top: 8px; padding-top: 8px;">
                        <span>Grand Total:</span> <strong>₹${parseFloat(inv.grand_total).toFixed(2)}</strong>
                    </div>
                </div>
            </div>
        `;

        this.showCustomPopup('Invoice Details', content);
    }

    viewService(identifier) {
        const ser = this.services.find(s => 
            (s.service_invoice_no === identifier) || 
            (s.service_id === identifier) || 
            (s.invoice_no === identifier)
        );
        if (!ser) return window.billingApp.showToast('Service not found', 'error');

        // SMART MAPPING: Tries to find the right data in your API response
        const totalValue = ser.service_price || 0;
        const serviceDesc = ser.issue || 'No description provided.';
        const serviceType = ser.service_type || ser.category || ser.type || 'General Service';

        const content = `
            <div style="font-family: sans-serif; color: #333;">
                <div style="background: #f8fafc; border: 1px solid #e2e8f0; padding: 12px; border-radius: 8px; margin-bottom: 15px;">
                    <div class="invoice-info-row"><span>Service ID:</span> <strong>${ser.service_invoice_no || ser.service_id || ser.invoice_no}</strong></div>
                    <div class="invoice-info-row"><span>Customer:</span> <strong>${ser.customer_name}</strong></div>
                    <div class="invoice-info-row"><span>Date:</span> <strong>${new Date(ser.created_at).toLocaleDateString('en-IN')}</strong></div>
                </div>

                <div style="margin-bottom: 20px; padding: 15px; background: #f0f7ff; border-left: 5px solid #3b82f6; border-radius: 4px;">
                    <div style="margin-bottom: 8px;">
                        <span style="font-size: 11px; font-weight: 700; color: #3b82f6; text-transform: uppercase; display: block;">Service Type</span>
                        <span style="font-size: 15px; font-weight: 600;">${serviceType.toUpperCase()}</span>
                    </div>
                    <div>
                        <span style="font-size: 11px; font-weight: 700; color: #3b82f6; text-transform: uppercase; display: block;">Work Details / Description</span>
                        <p style="margin: 5px 0 0 0; font-size: 14px; color: #475569; line-height: 1.5;">
                            ${serviceDesc}
                        </p>
                    </div>
                </div>

                <div style="margin-top: 20px; padding: 15px; background: #1e293b; border-radius: 8px; color: white; display: flex; justify-content: space-between; align-items: center;">
                    <span style="font-size: 14px; font-weight: 500; opacity: 0.9;">Total Charge</span>
                    <span style="font-weight: 700; font-size: 22px;">₹${parseFloat(totalValue).toFixed(2)}</span>
                </div>
            </div>
        `;

        this.showCustomPopup('Service Details', content);
    }

    applyFilters() {
        const dateFilter = document.getElementById('dateFilter').value;
        const customerFilter = document.getElementById('customerFilter').value.toLowerCase();

        const filterFn = (item, dateKey) => {
            if (customerFilter && !item.customer_name.toLowerCase().includes(customerFilter)) return false;
            if (dateFilter) {
                return new Date(item[dateKey]).toLocaleDateString('en-IN') ===
                       new Date(dateFilter).toLocaleDateString('en-IN');
            }
            return true;
        };

        if (this.currentTab === 'product') {
            this.displayedInvoices = this.invoices.filter(i => filterFn(i, 'created_at'));
            this.renderInvoices();
        } else {
            this.displayedServices = this.services.filter(s => filterFn(s, 'created_at'));
            this.renderServices();
        }
    }

    clearFilters() {
        document.getElementById('dateFilter').value = '';
        document.getElementById('customerFilter').value = '';
        this.applyFilters();
    }

    exportToCSV() {
        console.log('Export CSV:', this.currentTab);
    }
}

// --------------------
// INIT
// --------------------
let invoiceManager;
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.invoice-page')) {
        invoiceManager = new InvoiceManager();
        window.invoiceManager = invoiceManager;
    }
});
