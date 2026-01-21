class ServiceManager {
    constructor() {
        this.services = [];
        this.currentPage = 1;
        this.itemsPerPage = 10;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.loadServices();
        // Generate invoice number after a small delay to ensure DOM is ready
        setTimeout(() => {
            this.generateServiceInvoiceNumber();
        }, 100);
    }
    
    setupEventListeners() {
        // Form submission
        document.getElementById('serviceForm').addEventListener('submit', (e) => {
            e.preventDefault();
            this.createService();
        });
        
        // Clear form
        document.getElementById('clearServiceForm').addEventListener('click', () => {
            this.clearForm();
        });
        
        // Pagination
        document.getElementById('prevPage')?.addEventListener('click', () => {
            if (this.currentPage > 1) {
                this.loadServices(this.currentPage - 1);
            }
        });
        
        document.getElementById('nextPage')?.addEventListener('click', () => {
            this.loadServices(this.currentPage + 1);
        });
    }
    
    async loadServices(page = 1) {
        try {
            this.currentPage = page;
            const response = await window.billingApp.apiRequest(`/api/services/?page=${page}`);
            this.services = response.results || response;
            this.renderServicesTable();
            this.updatePagination();
        } catch (error) {
            console.error('Failed to load services:', error);
            window.billingApp.showToast('Failed to load services', 'error');
        }
    }
    
    renderServicesTable() {
        const tbody = document.querySelector('#servicesTable tbody');
        if (!tbody) return;
        
        tbody.innerHTML = '';
        
        this.services.forEach(service => {
            const row = document.createElement('tr');
            const serviceDate = new Date(service.created_at).toLocaleDateString('en-IN');
            row.innerHTML = `
                <td>${service.service_id}</td>
                <td>${service.service_invoice_no || 'N/A'}</td>
                <td>${service.customer_name}</td>
                <td>${service.customer_phone}</td>
                <td>${service.service_type}</td>
                <td>₹${service.service_price.toFixed(2)}</td>
                <td>${serviceDate}</td>
                <td>
                    <button onclick="window.serviceManager.viewServiceDetails('${service.service_id}')" 
                            class="btn-secondary" 
                            style="padding: 0.25rem 0.5rem; font-size: 0.8rem; margin-right: 0.5rem;">
                        View
                    </button>
                    <button onclick="window.serviceManager.deleteService('${service.service_id}')" 
                            class="btn-danger" 
                            style="padding: 0.25rem 0.5rem; font-size: 0.8rem;">
                        Delete
                    </button>
                </td>
            `;
            tbody.appendChild(row);
        });
        
        if (this.services.length === 0) {
            const row = document.createElement('tr');
            row.innerHTML = '<td colspan="8" style="text-align: center; padding: 2rem;">No services found</td>';
            tbody.appendChild(row);
        }
    }
    
    async createService() {
        const formData = {
            customer_name: document.getElementById('serviceCustomerName').value.trim(),
            customer_phone: document.getElementById('serviceCustomerPhone').value.trim(),
            service_type: document.getElementById('serviceType').value.trim(),
            service_price: parseFloat(document.getElementById('servicePrice').value),
            issue: document.getElementById('serviceIssue').value.trim()
        };
        
        // Validation
        if (!formData.customer_name || !formData.service_type || isNaN(formData.service_price) || formData.service_price <= 0) {
            window.billingApp.showToast('Please fill all required fields correctly', 'error');
            return;
        }
        
        try {
            const response = await window.billingApp.apiRequest('/api/services/create/', {
                method: 'POST',
                body: JSON.stringify(formData)
            });
            
            console.log('Service creation response:', response);
            
            // Get the display invoice number from form (client-side generated)
            const displayInvoiceNo = document.getElementById('serviceInvoiceNo').value;
            
            // Show success alert with Service Invoice Number
            this.showSuccessAlert(response.service_id, displayInvoiceNo);
            
            this.loadServices();
            
            // Clear form and generate new invoice number for next service
            setTimeout(() => {
                this.clearForm();
            }, 2000);
            
            // Notify other pages (like Invoice) that a new service was created
            window.dispatchEvent(new CustomEvent('serviceCreated', {
                detail: { serviceId: response.service_id, serviceInvoiceNo: displayInvoiceNo }
            }));
        } catch (error) {
            console.error('Failed to create service:', error);
            window.billingApp.showToast('Failed to create service', 'error');
        }
    }
    
    showSuccessAlert(serviceId, serviceInvoiceNo) {
        // Create a success alert similar to Invoice page
        const alertDiv = document.createElement('div');
        alertDiv.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            background: linear-gradient(135deg, #4CAF50 0%, #45a049 100%);
            color: white;
            padding: 20px 25px;
            border-radius: 8px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.15);
            z-index: 10000;
            font-size: 14px;
            max-width: 400px;
            animation: slideIn 0.3s ease-out;
        `;
        
        alertDiv.innerHTML = `
            <div style="font-weight: 600; margin-bottom: 8px;">✓ Service Saved Successfully!</div>
            <div>Service ID: <strong>${serviceId}</strong></div>
            <div>Service Invoice No: <strong>${serviceInvoiceNo}</strong></div>
        `;
        
        document.body.appendChild(alertDiv);
        
        // Add animation keyframes if not already added
        if (!document.getElementById('slideInAnimation')) {
            const style = document.createElement('style');
            style.id = 'slideInAnimation';
            style.innerHTML = `
                @keyframes slideIn {
                    from {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                    to {
                        transform: translateX(0);
                        opacity: 1;
                    }
                }
                @keyframes slideOut {
                    from {
                        transform: translateX(0);
                        opacity: 1;
                    }
                    to {
                        transform: translateX(400px);
                        opacity: 0;
                    }
                }
            `;
            document.head.appendChild(style);
        }
        
        // Auto-remove after 5 seconds
        setTimeout(() => {
            alertDiv.style.animation = 'slideOut 0.3s ease-out';
            setTimeout(() => alertDiv.remove(), 300);
        }, 5000);
    }
    
    clearForm() {
        document.getElementById('serviceForm').reset();
        this.generateServiceInvoiceNumber();
        document.getElementById('serviceCustomerName').focus();
    }
    
    generateServiceInvoiceNumber() {
        const timestamp = Date.now();
        const random = Math.random().toString(36).substr(2, 4).toUpperCase();
        const serviceInvoiceNo = `SIN-${timestamp.toString().slice(-6)}${random}`;
        const field = document.getElementById('serviceInvoiceNo');
        if (field) {
            field.value = serviceInvoiceNo;
            console.log('Generated Service Invoice Number:', serviceInvoiceNo);
        } else {
            console.warn('Service Invoice Number field not found');
        }
    }
    
    async deleteService(serviceId) {
        if (!confirm('Are you sure you want to delete this service record?')) {
            return;
        }
        
        try {
            // Note: You'll need to implement a delete endpoint in your Django views
            await window.billingApp.apiRequest(`/api/services/${serviceId}/delete/`, {
                method: 'DELETE'
            });
            
            this.loadServices();
            window.billingApp.showToast('Service record deleted successfully', 'success');
        } catch (error) {
            console.error('Failed to delete service:', error);
            window.billingApp.showToast('Failed to delete service', 'error');
        }
    }
    
    viewServiceDetails(serviceId) {
        const service = this.services.find(s => s.service_id === serviceId);
        if (!service) {
            window.billingApp.showToast('Service not found', 'error');
            return;
        }
        
        // Create a simple modal or navigate to details page
        const modal = document.createElement('div');
        modal.className = 'modal';
        modal.style.display = 'block';
        modal.innerHTML = `
            <div class="modal-content" style="max-width: 500px;">
                <h3>Service Details</h3>
                <div style="margin-bottom: 1rem;">
                    <strong>Service ID:</strong> ${service.service_id}<br>
                    <strong>Service Invoice No:</strong> ${service.service_invoice_no || 'N/A'}<br>
                    <strong>Customer:</strong> ${service.customer_name}<br>
                    <strong>Phone:</strong> ${service.customer_phone}<br>
                    <strong>Service Type:</strong> ${service.service_type}<br>
                    <strong>Price:</strong> ₹${service.service_price.toFixed(2)}<br>
                    <strong>Date:</strong> ${new Date(service.created_at).toLocaleString('en-IN')}<br>
                    <strong>Issue:</strong><br>${service.issue || 'N/A'}
                </div>
                <div class="modal-actions">
                    <button onclick="this.closest('.modal').style.display='none'" class="btn-secondary">Close</button>
                </div>
            </div>
        `;
        
        document.body.appendChild(modal);
    }
    
    updatePagination() {
        const totalPages = Math.ceil(this.services.length / this.itemsPerPage);
        const pageInfo = document.getElementById('pageInfo');
        const prevBtn = document.getElementById('prevPage');
        const nextBtn = document.getElementById('nextPage');
        
        if (pageInfo) {
            pageInfo.textContent = `Page ${this.currentPage} of ${totalPages}`;
        }
        
        if (prevBtn) {
            prevBtn.disabled = this.currentPage <= 1;
        }
        
        if (nextBtn) {
            nextBtn.disabled = this.currentPage >= totalPages;
        }
    }
}

// Initialize service manager
document.addEventListener('DOMContentLoaded', () => {
    if (document.querySelector('.service-container')) {
        window.serviceManager = new ServiceManager();
    }
});