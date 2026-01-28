function getCookie(name) {
    let cookieValue = null;
    if (document.cookie && document.cookie !== '') {
        const cookies = document.cookie.split(';');
        for (let i = 0; i < cookies.length; i++) {
            const cookie = cookies[i].trim();
            if (cookie.startsWith(name + '=')) {
                cookieValue = decodeURIComponent(cookie.substring(name.length + 1));
                break;
            }
        }
    }
    return cookieValue;
}

/* =============================
   GLOBAL (IMPORTANT)
============================= */
let activeList = null;

function clearSuggestions() {
    if (activeList) {
        activeList.remove();
        activeList = null;
    }
}

document.addEventListener('DOMContentLoaded', function () {

    const input = document.getElementById('returnProductName');
    const productIdField = document.getElementById('returnProductId');
    const imeiField = document.getElementById('returnImei');
    const stockField = document.getElementById('returnStock');
    const sellingField = document.getElementById('returnSelling');
    const purchaseField = document.getElementById('returnPurchase');
    const form = document.getElementById('returnForm');

    let timer = null;

    /* =============================
       AUTOCOMPLETE
    ============================== */
    function showSuggestions(items) {
        clearSuggestions();

        // ❌ Remove zero-stock products
        const filtered = items.filter(it => it.stock > 0);

        if (!filtered.length) return;

        const list = document.createElement('div');
        list.className = 'autocomplete-list';

        filtered.forEach(it => {
            const el = document.createElement('div');
            el.className = 'suggestion-item';
            el.textContent = `${it.name} (Stock: ${it.stock})`;

            el.onclick = () => {
                input.value = it.name;
                productIdField.value = it.id;
                imeiField.value = it.imei || '';
                stockField.value = it.stock;
                sellingField.value = it.selling_price;
                purchaseField.value = it.purchase_price;
                clearSuggestions();
            };

            list.appendChild(el);
        });

        input.parentNode.appendChild(list);
        activeList = list;
    }


    input.addEventListener('input', () => {
        const q = input.value.trim();

        productIdField.value = '';
        imeiField.value = '';
        stockField.value = '';
        sellingField.value = '';
        purchaseField.value = '';

        clearTimeout(timer);
        if (!q) return clearSuggestions();

        timer = setTimeout(() => {
            fetch(`${SUGGEST_URL}?q=${encodeURIComponent(q)}`)
                .then(r => r.json())
                .then(d => showSuggestions(d.results || []))
                .catch(clearSuggestions);
        }, 250);
    });

    document.addEventListener('click', e => {
        if (activeList && !activeList.contains(e.target) && e.target !== input) {
            clearSuggestions();
        }
    });

    /* =============================
       FORM SUBMIT
    ============================== */
    form.addEventListener('submit', function (e) {
        e.preventDefault();

        const payload = {
            product_id: productIdField.value || null,
            name: input.value.trim() || null,
            quantity: +document.getElementById('returnQuantity').value,
            reason: document.getElementById('returnReason').value,
            return_type: document.getElementById('returnType').value || 'refund'
        };

        if (!payload.quantity || (!payload.product_id && !payload.name)) {
            alert('Please select a product and valid quantity');
            return;
        }

        fetch(PROCESS_RETURN_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-CSRFToken': getCookie('csrftoken')
            },
            body: JSON.stringify(payload)
        })
        .then(r => r.json())
        .then(data => {

            if (confirm('Return successful.\n') && data.invoice) {
                window.open(data.invoice, '_blank');
            }

            clearReturnForm();
        })
        .catch(() => alert('Failed to process return'));
    });
});

/* =============================
   CLEAR FORM
============================= */
function clearReturnForm() {
    document.getElementById('returnForm').reset();
    document.getElementById('returnProductId').value = '';
    document.getElementById('returnStock').value = '';
    document.getElementById('returnSelling').value = '';
    document.getElementById('returnPurchase').value = '';
    document.getElementById('returnImei').value = '';
    clearSuggestions();
}
