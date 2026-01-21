// static/js/pwa.js
// Only offline/online detection + install prompt – NO registration

class PWAManager {
    constructor() {
        this.deferredPrompt = null;
        this.init();
    }

    init() {
        this.setupInstallPrompt();
        this.setupOnlineOffline();
    }

    setupInstallPrompt() {
        window.addEventListener('beforeinstallprompt', (e) => {
            e.preventDefault();
            this.deferredPrompt = e;
            // You can show your custom install button here if you want
            console.log('Install prompt ready (but registration is in base.html)');
        });
    }

    setupOnlineOffline() {
        window.addEventListener('online', () => {
            console.log('Back online');
            // billingApp.showToast?.('Back online', 'success');
        });

        window.addEventListener('offline', () => {
            console.log('Offline now');
            // billingApp.showToast?.('You are offline', 'warning');
        });
    }
}

document.addEventListener('DOMContentLoaded', () => {
    window.pwaManager = new PWAManager();
});