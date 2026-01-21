document.addEventListener('DOMContentLoaded', () => {
    const printBtn = document.getElementById('printServiceInvoice');
    if (printBtn) {
        printBtn.addEventListener('click', () => {
            window.print();
        });
    }
});