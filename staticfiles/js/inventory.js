class InventoryManager {
    constructor() {
        this.products = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.init();
    }

    init() {
        this.setupEventListeners();
        this.loadProducts();
    }

    setupEventListeners() {
        document.getElementById('addProductForm')?.addEventListener('submit', e => {
            e.preventDefault();
            this.createOrUpdateProduct();
        });

        document.getElementById('clearProductBtn')?.addEventListener('click', () => this.clearForm());
    }

    async loadProducts(page = 1) {
        try {
            this.currentPage = page;
            const response = await window.billingApp.apiRequest(`/api/products/?page=${page}`);
            this.products = response.results || response;
            this.renderProductsTable();
            this.updatePagination();
        } catch (error) {
            console.error('Failed to load products:', error);
            window.billingApp.showToast('Failed to load products', 'error');
        }
    }

    renderProductsTable() {
        const tbody = document.querySelector('#productsTable tbody');
        if (!tbody) return;
        tbody.innerHTML = '';

        // --- NEW: Filter out products with 0 stock ---
        const activeProducts = this.products.filter(p => p.stock > 0);

        if (!activeProducts.length) {
            tbody.innerHTML = '<tr><td colspan="9" style="text-align:center;">No items in stock</td></tr>';
            return;
        }

        const grouped = {};
        // Use activeProducts instead of this.products
        activeProducts.forEach(p => {
            const agency = p.agency_name || 'Other';
            if (!grouped[agency]) grouped[agency] = [];
            grouped[agency].push(p);
        });

        Object.keys(grouped).forEach(agency => {
            const agencyRow = document.createElement('tr');
            agencyRow.innerHTML = `<td colspan="9" style="background:#000; color:#fff; font-weight:bold; padding: 10px;">Agency: ${agency}</td>`;
            tbody.appendChild(agencyRow);

            grouped[agency].forEach(product => {
                const row = document.createElement('tr');
                const sellingPrice = parseFloat(product.selling_price || 0);
                const purchasePrice = parseFloat(product.purchase_price || 0);
                
                // Optional: Highlight low stock items (e.g., stock less than 5)
                const stockStyle = product.stock < 5 ? 'color: #e67e22; font-weight: bold;' : '';

                row.innerHTML = `
                    <td>${product.name}</td>
                    <td>${product.imei || 'N/A'}</td>
                    <td>${product.gst_percentage}%</td>
                    <td>₹${sellingPrice.toFixed(2)}</td>
                    <td>₹${purchasePrice.toFixed(2)}</td>
                    <td>${product.category || 'Uncategorized'}</td>
                    <td style="${stockStyle}">${product.stock}</td>
                    <td>${product.agency_name || 'N/A'}</td>
                    <td>
                        <button onclick="window.inventoryManager.editProduct(${product.id})" class="btn-secondary">Edit</button>
        
                    </td>
                `;
                tbody.appendChild(row);
            });
        });
    }

    async createOrUpdateProduct(productId = null) {
        // Check if productId is stored in form for editing
        const form = document.getElementById('addProductForm');
        const storedProductId = form?.dataset.productId;
        const id = productId || (storedProductId ? parseInt(storedProductId) : null);

        const formData = {
            name: document.getElementById('productName').value.trim(),
            imei: document.getElementById('imei').value.trim(),
            gst_percentage: parseFloat(document.getElementById('gst').value) || 0,
            selling_price: parseFloat(document.getElementById('sellingPrice').value),
            purchase_price: parseFloat(document.getElementById('purchasePrice').value),
            category: document.getElementById('productCategory')?.value.trim() || null,
            stock: parseInt(document.getElementById('initialStock').value) || 0,
            agency_name: document.getElementById('agencyName').value.trim()
        };

        if (!formData.name || isNaN(formData.selling_price) || isNaN(formData.purchase_price)) {
            return window.billingApp.showToast('Please fill required fields correctly', 'error');
        }

        const url = id ? `/api/products/${id}/` : '/api/products/create/';
        const method = id ? 'PUT' : 'POST';

        try {
            await window.billingApp.apiRequest(url, { method, body: JSON.stringify(formData) });
            this.loadProducts();
            window.billingApp.showToast(id ? 'Product updated successfully' : 'Product created successfully', 'success');
            
            // Clear stored productId after update
            if (form) form.dataset.productId = '';
            
            this.clearForm();
        } catch (error) {
            console.error(error);
            window.billingApp.showToast('Failed to save product', 'error');
        }
    }

    clearForm() {
        ['productName', 'imei', 'gst', 'sellingPrice', 'purchasePrice', 'productCategory', 'initialStock', 'agencyName']
        .forEach(id => {
            const elem = document.getElementById(id);
            if (elem) elem.value = '';
        });
    }

    async editProduct(productId) {
        const product = this.products.find(p => p.id === productId);
        if (!product) {
            window.billingApp.showToast('Product not found', 'error');
            return;
        }

        // Fill form with product data
        document.getElementById('productName').value = product.name;
        document.getElementById('imei').value = product.imei || '';
        document.getElementById('gst').value = product.gst_percentage || 0;
        document.getElementById('sellingPrice').value = product.selling_price;
        document.getElementById('purchasePrice').value = product.purchase_price;
        document.getElementById('productCategory').value = product.category || '';
        document.getElementById('initialStock').value = product.stock;
        document.getElementById('agencyName').value = product.agency_name || '';

        // Store product ID for update
        document.getElementById('addProductForm').dataset.productId = productId;
        
        // Scroll to form
        document.querySelector('.card').scrollIntoView({ behavior: 'smooth' });
        
        window.billingApp.showToast('Edit product - Make changes and click Add/Update', 'info');
    }

    async deleteProduct(productId) {
        if (!confirm('Are you sure you want to delete this product?')) {
            return;
        }

        try {
            await window.billingApp.apiRequest(`/api/products/${productId}/delete/`, { method: 'DELETE' });
            this.loadProducts();
            window.billingApp.showToast('Product deleted successfully', 'success');
        } catch (error) {
            console.error(error);
            window.billingApp.showToast('Failed to delete product', 'error');
        }
    }

    updatePagination() {
        const totalPages = Math.ceil(this.products.length / this.itemsPerPage);
        document.getElementById('pageInfo').textContent = `Page ${this.currentPage} of ${totalPages}`;
    }
}

// Initialize Inventory
document.addEventListener('DOMContentLoaded', () => {
    window.inventoryManager = new InventoryManager();
});
