class BillingManager {
    constructor() {
        this.items = [];
        this.products = [];
        this.lastSavedInvoice = null;
        this.init();
    }

    init() {
        this.cacheDOM();
        this.setupEventListeners();
        this.loadProducts();
        this.generateInvoiceNumber();
        this.createSuggestionDropdown();
    }

    cacheDOM() {
        this.productSearch = document.getElementById('productSearch');
        this.priceInput = document.getElementById('price');
        this.qtyInput = document.getElementById('quantity');
        this.itemsList = document.getElementById('itemsList');
        this.subtotalEl = document.getElementById('subtotal');
        this.gstEl = document.getElementById('gst');
        this.totalEl = document.getElementById('grandTotal');
        this.customerName = document.getElementById('customerName');
        this.customerPhone = document.getElementById('customerPhone');
        this.stockDisplay = document.getElementById('stockDisplay');
    }

    setupEventListeners() {
        document.getElementById('addItemBtn').onclick = () => this.addItem();
        document.getElementById('saveBillBtn').onclick = () => this.saveBill();
        document.getElementById('clearBillBtn').onclick = () => this.clearBill();

        document.getElementById('confirmSaveBtn').onclick = () => {
            if (document.getElementById('printCheckbox').checked) {
                this.printThermalInvoice(this.lastSavedInvoice);
            }

            document.getElementById('saveConfirmModal').style.display = 'none';
            document.getElementById('printCheckbox').checked = true;

            this.clearBill();
            this.generateInvoiceNumber();
        };

        this.productSearch.addEventListener('input', e =>
            this.showProductSuggestions(e.target.value)
        );

        document.addEventListener('click', e => {
            if (!this.productSearch.contains(e.target)) {
                this.dropdown.style.display = 'none';
            }
        });
    }

    async loadProducts() {
        const res = await window.billingApp.apiRequest('/api/products/');
        this.products = res.results || res;
    }

    createSuggestionDropdown() {
        this.dropdown = document.createElement('div');
        this.dropdown.id = 'suggestionDropdown';
        document.body.appendChild(this.dropdown);
    }

    showProductSuggestions(term) {
        this.dropdown.innerHTML = '';

        if (!term.trim()) {
            this.dropdown.style.display = 'none';
            return;
        }

        const matches = this.products
            .filter(p => p.name.toLowerCase().includes(term.toLowerCase()))
            .slice(0, 6);

        if (!matches.length) {
            this.dropdown.style.display = 'none';
            return;
        }

        matches.forEach(p => {
            const category =
                p.category_name || p.category || 'General';

            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.innerHTML = `
                <div class="suggestion-left">
                    <span class="name">${p.name}</span>
                    <span class="category">${category}</span>
                </div>
                <span class="price">₹${p.selling_price}</span>
            `;

            div.onclick = () => this.selectProduct(p);
            this.dropdown.appendChild(div);
        });

        const r = this.productSearch.getBoundingClientRect();
        this.dropdown.style.top = `${r.bottom + window.scrollY + 6}px`;
        this.dropdown.style.left = `${r.left}px`;
        this.dropdown.style.width = `${r.width}px`;
        this.dropdown.style.display = 'block';
    }


    selectProduct(p) {
        if (p.stock <= 0) {
            alert(`🚫 Out of Stock: ${p.name} cannot be added.`);
            this.productSearch.value = '';
            this.dropdown.style.display = 'none';
            return;
        }

        if (p.stock < 4) {
            alert(`⚠️ Low Stock Alert: Only ${p.stock} units remaining for ${p.name}.`);
        }

        this.productSearch.value = p.name;
        this.priceInput.value = p.selling_price;
        this.stockDisplay.value = p.stock; // Display the stock count
        this.productSearch.dataset.pid = p.id;
        this.productSearch.dataset.stock = p.stock;
        this.dropdown.style.display = 'none';
    }

    addItem() {
        const pid = this.productSearch.dataset.pid;
        const availableStock = Number(this.productSearch.dataset.stock);
        
        if (!pid) return alert('Select a product');

        const qty = Number(this.qtyInput.value);
        const price = Number(this.priceInput.value);
        const name = this.productSearch.value;

        // 🔍 Check if same product already exists in cart to calculate total requested qty
        const existingItem = this.items.find(i => i.product_id == pid);
        const currentCartQty = existingItem ? existingItem.quantity : 0;
        const totalRequestedQty = currentCartQty + qty;

        // 🛑 Final validation: Ensure total quantity doesn't exceed available stock
        if (totalRequestedQty > availableStock) {
            alert(`❌ Cannot add more. Only ${availableStock} units available in total.`);
            return;
        }

        if (existingItem) {
            existingItem.quantity += qty;
        } else {
            this.items.push({
                product_id: pid,
                product_name: name,
                quantity: qty,
                price
            });
        }

        this.renderItems();
        this.calculateTotals();

        // Reset inputs
        this.productSearch.value = '';
        this.priceInput.value = '';
        this.qtyInput.value = 1;
        // Inside addItem() and clearBill() reset sections:
        this.stockDisplay.value = '';
        delete this.productSearch.dataset.pid;
        delete this.productSearch.dataset.stock;
    }


    renderItems() {
        this.itemsList.innerHTML = '';
        this.items.forEach(i => {
            this.itemsList.innerHTML += `
                <div class="item-row">
                    <span>${i.product_name} × ${i.quantity}</span>
                    <b>₹${(i.price * i.quantity).toFixed(2)}</b>
                </div>
            `;
        });
    }

    calculateTotals() {
        const subtotal = this.items.reduce((s, i) => s + i.price * i.quantity, 0);
        const gst = subtotal * 0.18;
        const total = subtotal + gst;

        this.subtotalEl.textContent = `₹${subtotal.toFixed(2)}`;
        this.gstEl.textContent = `₹${gst.toFixed(2)}`;
        this.totalEl.textContent = `₹${total.toFixed(2)}`;
    }

    generateInvoiceNumber() {
        document.getElementById('invoiceNo').value =
            `INV-${Date.now().toString().slice(-6)}`;
    }

    async saveBill() {
        if (!this.items.length) return alert('Add items first');

        const res = await window.billingApp.apiRequest('/api/bills/create/', {
            method: 'POST',
            body: JSON.stringify({
                customer_name: this.customerName.value,
                customer_phone: this.customerPhone.value,
                items: this.items.map(i => ({
                    product_id: i.product_id,
                    quantity: i.quantity
                }))
            })
        });

        this.lastSavedInvoice = {
            invoice_no: res.invoice_no,
            grand_total: res.grand_total,
            items: this.items
        };

        document.getElementById('saveConfirmModal').style.display = 'flex';
    }

    clearBill() {
        this.items = [];
        this.itemsList.innerHTML = '';
        this.subtotalEl.textContent = '₹0.00';
        this.gstEl.textContent = '₹0.00';
        this.totalEl.textContent = '₹0.00';
        this.customerName.value = '';
        this.customerPhone.value = '';
        this.productSearch.value = '';
        this.priceInput.value = '';
        this.qtyInput.value = 1;
        this.dropdown.style.display = 'none';
        this.stockDisplay.value = '';
    }

    printThermalInvoice(inv) {

        const subtotal = inv.items.reduce(
            (s, i) => s + i.price * i.quantity, 0
        );
        const gst = subtotal * 0.18;
        const total = subtotal + gst;

        const itemsHtml = inv.items.map(i => `
            <tr>
                <td>${i.product_name}</td>
                <td style="text-align:center">${i.quantity}</td>
                <td style="text-align:right">₹${i.price.toFixed(2)}</td>
                <td style="text-align:right">₹${(i.price * i.quantity).toFixed(2)}</td>
            </tr>
        `).join('');

        const html = `
    <!DOCTYPE html>
    <html>
    <head>
    <meta charset="UTF-8">
    <title>Invoice ${inv.invoice_no}</title>
    <style>
    body {
        width: 58mm;
        font-family: monospace;
        font-size: 12px;
        margin: 0;
        padding: 0;
    }
    .center { text-align: center; }
    .heading { font-weight: bold; }
    hr {
        border: none;
        border-top: 1px dashed #000;
        margin: 6px 0;
    }
    table {
        width: 100%;
        border-collapse: collapse;
        margin-bottom: 6px;
    }
    th, td {
        font-size: 11px;
        padding: 2px 0;
    }
    th {
        text-align: left;
    }
    .totals td {
        text-align: right;
        font-weight: bold;
        font-size: 12px;
    }
    .footer {
        margin-top: 6px;
        font-size: 11px;
    }
    </style>
    </head>

    <body>
    <div class="receipt">

        <div class="heading center">
            AGS MOBILES & ACCESSORIES<br>
            Punnaiyakonam, Oorambu<br>
            Ph: 9876543210
        </div>

        <hr>

        <div class="center">Product Invoice</div>

        <hr>

        <div>Invoice: ${inv.invoice_no}</div>
        <div>Date: ${new Date().toLocaleString()}</div>
        <div>Customer: ${this.customerName.value || '-'}</div>

        <hr>

        <table>
            <thead>
                <tr>
                    <th>Item</th>
                    <th style="text-align:center">Qty</th>
                    <th style="text-align:right">Rate</th>
                    <th style="text-align:right">Amt</th>
                </tr>
            </thead>
            <tbody>
                ${itemsHtml}
            </tbody>
        </table>

        <table class="totals">
            <tr>
                <td>Subtotal</td>
                <td>₹${subtotal.toFixed(2)}</td>
            </tr>
            <tr>
                <td>GST (18%)</td>
                <td>₹${gst.toFixed(2)}</td>
            </tr>
            <tr>
                <td>Total</td>
                <td>₹${total.toFixed(2)}</td>
            </tr>
        </table>

        <hr>

        <div class="footer center">
            Thank you! Visit Again 🙏
        </div>

    </div>

    <script>
        window.print();
        window.onafterprint = () => window.close();
    </script>
    </body>
    </html>
    `;

        const w = window.open('', '', 'width=300,height=600');
        w.document.write(html);
        w.document.close();
    }

}

document.addEventListener('DOMContentLoaded', () => {
    window.billingManager = new BillingManager();
});
