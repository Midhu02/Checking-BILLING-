// Global App Configuration and Utilities
class BillingApp {
    constructor() {
        // Get CSRF token from meta tag or hidden input
        this.csrfToken = document.querySelector('meta[name="csrf-token"]')?.content || 
                         document.querySelector('[name=csrfmiddlewaretoken]')?.value || '';
        this.currentUser = null;
        this.init();
    }
    
    init() {
        this.setupEventListeners();
        this.setupOfflineDetection();
    }

    setupEventListeners() {
        const hamburger = document.querySelector('.hamburger');
        const navMenu = document.querySelector('.nav-menu');
        if (hamburger && navMenu) {
            hamburger.addEventListener('click', () => navMenu.classList.toggle('active'));
            document.querySelectorAll('.nav-link').forEach(link => {
                link.addEventListener('click', () => navMenu.classList.remove('active'));
            });
        }
    }

    async apiRequest(endpoint, options = {}) {
        const defaultOptions = {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': this.csrfToken,
            },
            credentials: 'include', // <--- MUST have this
            ...options
        };

        const response = await fetch(endpoint, defaultOptions);

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            // Build detailed error message from API response
            let errorMessage = errorData.message || `HTTP error! status: ${response.status}`;
            if (typeof errorData === 'object') {
                const errorMessages = [];
                for (const [key, value] of Object.entries(errorData)) {
                    if (Array.isArray(value)) {
                        errorMessages.push(`${key}: ${value.join(', ')}`);
                    } else if (typeof value === 'object') {
                        errorMessages.push(`${key}: ${JSON.stringify(value)}`);
                    } else {
                        errorMessages.push(`${key}: ${value}`);
                    }
                }
                if (errorMessages.length > 0) {
                    errorMessage = errorMessages.join('; ');
                }
            }
            console.error('API Error Details:', errorData); // Log full error for debugging
            throw new Error(errorMessage);
        }

        return response.json();
    }

    showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast ${type}`;
        toast.textContent = message;
        document.body.appendChild(toast);

        setTimeout(() => toast.classList.add('show'), 100);
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3000);
    }

    setupOfflineDetection() {
        window.addEventListener('online', () => this.showToast('Back online!', 'success'));
        window.addEventListener('offline', () => this.showToast('You are offline.', 'warning'));
    }
}

// Initialize app
document.addEventListener('DOMContentLoaded', () => {
    window.billingApp = new BillingApp();
});
