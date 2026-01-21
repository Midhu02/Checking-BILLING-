// static/js/proforma.js
// Proforma Invoice Logic (Fixed & Production Ready)

class ProformaManager {
    constructor() {
        this.items = [];
        this.products = [];
        this.proformas = [];
        this.GST_RATE = 0.18;
        this.init();
    }

    init() {
        this.setupTabNavigation();
        this.setupEventListeners();
        this.loadProducts();
        this.generateProformaNumber();
        this.calculateTotals();
    }

    /* ---------------- TABS ---------------- */
    setupTabNavigation() {
        const buttons = document.querySelectorAll('.tab-btn');
        const tabs = document.querySelectorAll('.tab-content');

        buttons.forEach(btn => {
            btn.addEventListener('click', () => {
                buttons.forEach(b => b.classList.remove('active'));
                tabs.forEach(t => t.style.display = 'none');

                btn.classList.add('active');
                const tab = document.getElementById(btn.dataset.tab);
                if (tab) tab.style.display = 'block';

                if (btn.dataset.tab === 'list-tab') {
                    this.loadProformas();
                }
            });
        });
    }

    /* ---------------- PROFORMA LIST ---------------- */
    async loadProformas() {
        const tbody = document.getElementById('proformaListBody');
        if (!tbody) return;

        tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">Loading...</td></tr>';

        try {
            const res = await window.billingApp.apiRequest('/api/proforma/list/');
            this.proformas = res.results || res;
            this.renderProformaList();
        } catch (e) {
            console.error(e);
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center; color:red;">Failed to load list</td></tr>';
        }
    }

    renderProformaList() {
        const tbody = document.getElementById('proformaListBody');
        if (!tbody || !this.proformas.length) {
            tbody.innerHTML = '<tr><td colspan="5" style="text-align:center;">No proforma invoices found</td></tr>';
            return;
        }

        tbody.innerHTML = this.proformas.map(p => `
            <tr>
                <td>${p.proforma_no || p.invoice_no}</td>
                <td>${p.customer_name}</td>
                <td>${new Date(p.created_at).toLocaleDateString('en-IN')}</td>
                <td>₹${parseFloat(p.grand_total).toFixed(2)}</td>
                <td>
                    <button class="btn btn-sm btn-info" onclick="proformaManager.viewProforma('${p.proforma_no}')">View</button>
                </td>
            </tr>
        `).join('');
    }

    viewProforma(no) {
        const pro = this.proformas.find(p => p.proforma_no === no);
        if (!pro) return;

        // Set items and data for preview
        this.items = pro.items;
        document.getElementById('proCustomerName').value = pro.customer_name;
        document.getElementById('proValidUntil').value = pro.valid_until;
        
        this.renderItems();
        this.calculateTotals();
        this.showPrintPreview();
    }

    /* ---------------- EVENTS ---------------- */
    setupEventListeners() {
        document.getElementById('proAddItemBtn')?.addEventListener('click', () => this.addItem());
        document.getElementById('saveProformaBtn')?.addEventListener('click', () => this.saveProforma());
        document.getElementById('printProformaBtn')?.addEventListener('click', () => this.showPrintPreview());
        document.getElementById('proClosePrintBtn')?.addEventListener('click', () => {
            document.getElementById('proPrintModal').style.display = 'none';
        });
        document.getElementById('proPrintBtn')?.addEventListener('click', () => window.print());

        ['discountAmount', 'shippingCharge', 'insuranceCharge'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => this.calculateTotals());
        });

        document.getElementById('proProductSearch')?.addEventListener('change', e => {
            const option = [...document.getElementById('proProductList').options]
                .find(o => o.value === e.target.value);
            document.getElementById('proProductId').value = option?.dataset.id || '';
        });
    }

    /* ---------------- PRODUCTS ---------------- */
    async loadProducts() {
        try {
            const res = await window.billingApp.apiRequest('/api/products/');
            this.products = res.results || res;
            this.populateProductList();
        } catch {
            window.billingApp.showToast('Failed to load products', 'error');
        }
    }

    populateProductList() {
        const list = document.getElementById('proProductList');
        list.innerHTML = '';
        this.products.forEach(p => {
            const opt = document.createElement('option');
            opt.value = `${p.name} - ₹${p.selling_price}`;
            opt.dataset.id = p.id;
            opt.dataset.price = p.selling_price;
            list.appendChild(opt);
        });
    }

    /* ---------------- ITEMS ---------------- */
    addItem() {
        const search = document.getElementById('proProductSearch').value;
        const qty = parseInt(document.getElementById('proQuantity').value);
        const productId = document.getElementById('proProductId').value;

        const option = [...document.getElementById('proProductList').options]
            .find(o => o.value === search);

        if (!option || !productId || qty <= 0) {
            return window.billingApp.showToast('Select valid product & quantity', 'error');
        }

        const price = parseFloat(option.dataset.price);
        const existing = this.items.find(i => i.product_id == productId);

        if (existing) {
            existing.quantity += qty;
            existing.total = existing.quantity * existing.price;
        } else {
            this.items.push({
                product_id: productId,
                name: search.split(' - ')[0],
                quantity: qty,
                price: price,
                total: qty * price
            });
        }

        this.renderItems();
        this.calculateTotals();
        this.clearItemForm();
    }

    renderItems() {
        const list = document.getElementById('proItemsList');
        list.innerHTML = '';

        this.items.forEach((item, i) => {
            list.innerHTML += `
                <div class="item-row">
                    <div class="item-info">
                        <strong>${item.name}</strong><br>
                        Qty: ${item.quantity} × ₹${item.price.toFixed(2)}
                    </div>
                    <div class="item-price">₹${item.total.toFixed(2)}</div>
                    <button class="remove-item" onclick="proformaManager.removeItem(${i})">✕</button>
                </div>
            `;
        });
    }

    removeItem(index) {
        this.items.splice(index, 1);
        this.renderItems();
        this.calculateTotals();
    }

    clearItemForm() {
        document.getElementById('proProductSearch').value = '';
        document.getElementById('proProductId').value = '';
        document.getElementById('proQuantity').value = 1;
    }

    /* ---------------- TOTALS ---------------- */
    calculateTotals() {
        const subtotal = this.items.reduce((s, i) => s + i.total, 0);
        const discount = +document.getElementById('discountAmount').value || 0;
        const shipping = +document.getElementById('shippingCharge').value || 0;
        const insurance = +document.getElementById('insuranceCharge').value || 0;

        const taxable = Math.max(subtotal - discount, 0);
        const gst = taxable * this.GST_RATE;
        const grand = taxable + gst + shipping + insurance;

        document.getElementById('proSubtotal').textContent = `₹${subtotal.toFixed(2)}`;
        document.getElementById('proGst').textContent = `₹${gst.toFixed(2)}`;
        document.getElementById('proGrandTotal').textContent = `₹${grand.toFixed(2)}`;
    }

    /* ---------------- SAVE ---------------- */
    async saveProforma() {
        if (!this.items.length) {
            return window.billingApp.showToast('Add at least one item', 'error');
        }

        const data = {
            customer_name: document.getElementById('proCustomerName').value,
            customer_phone: document.getElementById('proCustomerPhone').value,
            valid_until: document.getElementById('proValidUntil').value,
            items: this.items,
            subtotal: this.getNumber('proSubtotal'),
            gst_amount: this.getNumber('proGst'),
            grand_total: this.getNumber('proGrandTotal')
        };

        try {
            await window.billingApp.apiRequest('/api/proforma/create/', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            window.billingApp.showToast('Proforma saved successfully', 'success');
            this.clearAll();
        } catch {
            window.billingApp.showToast('Save failed', 'error');
        }
    }

    clearAll() {
        this.items = [];
        this.renderItems();
        this.calculateTotals();
        this.generateProformaNumber();
    }

    /* ---------------- PRINT ---------------- */
    showPrintPreview() {
        const preview = document.getElementById('proPrintPreview');
        preview.innerHTML = `
            <h2 style="text-align:center;">PROFORMA INVOICE</h2>
            <p><strong>Customer:</strong> ${document.getElementById('proCustomerName').value}</p>
            <p><strong>Valid Until:</strong> ${document.getElementById('proValidUntil').value || 'N/A'}</p>
            <hr>
            ${this.items.map(i => `
                <p>${i.name} — ${i.quantity} × ₹${i.price} = ₹${i.total.toFixed(2)}</p>
            `).join('')}
            <hr>
            <p><strong>Total:</strong> ${document.getElementById('proGrandTotal').textContent}</p>
        `;
        document.getElementById('proPrintModal').style.display = 'flex';
    }

    generateProformaNumber() {
        document.getElementById('proInvoiceNo').value =
            'PF-' + Date.now().toString().slice(-6);
    }

    getNumber(id) {
        return parseFloat(document.getElementById(id).textContent.replace('₹', ''));
    }
}

/* INIT */
let proformaManager;
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.proforma-container')) {
        proformaManager = new ProformaManager();
    }
});
