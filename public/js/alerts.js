// Alerts page JavaScript

async function verifyAlert(id, verified) {
    try {
        await apiRequest(`/api/results/${id}/verify`, {
            method: 'PUT',
            body: JSON.stringify({ verified })
        });
        showNotification(verified ? 'Alerte vérifiée' : 'Alerte rejetée', 'success');
        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function resolveAlert(id) {
    if (!confirm('Marquer cette alerte comme résolue ?')) return;
    
    try {
        await apiRequest(`/api/results/${id}/resolve`, { method: 'PUT' });
        showNotification('Alerte marquée comme résolue', 'success');
        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function viewAlertImage(imageId) {
    const modal = document.getElementById('imageModal');
    const img = document.getElementById('alertImage');
    
    img.src = `/api/images/${imageId}`;
    modal.classList.add('active');
}

function closeImageModal() {
    document.getElementById('imageModal').classList.remove('active');
}

function filterAlerts() {
    const typeFilter = document.getElementById('typeFilter').value;
    const statusFilter = document.getElementById('statusFilter').value;
    const verificationFilter = document.getElementById('verificationFilter').value;

    const alertItems = document.querySelectorAll('.alert-item');

    alertItems.forEach(item => {
        const type = item.dataset.type || '';
        const resolvedRaw = item.dataset.resolved;
        const verifiedRaw = item.dataset.verified;

        const resolved = String(resolvedRaw).toLowerCase();
        const verified = String(verifiedRaw).toLowerCase();

        const resolvedNormalized = (resolved === 'true' || resolved === '1' || resolved === 'yes' || resolved === 'on') ? 'true'
                                : (resolved === 'false' || resolved === '0' || resolved === 'no' || resolved === 'off') ? 'false'
                                : resolved;

        const verifiedNormalized = (verified === 'true' || verified === '1' || verified === 'yes' || verified === 'on') ? 'true'
                                : (verified === 'false' || verified === '0' || verified === 'no' || verified === 'off') ? 'false'
                                : verified;

        let show = true;

        if (typeFilter && type !== typeFilter) show = false;
        if (statusFilter !== '' && resolvedNormalized !== statusFilter) show = false;
        if (verificationFilter !== '' && verifiedNormalized !== verificationFilter) show = false;

        const link = item.closest('.alert-link') || item;
        link.style.display = show ? '' : 'none';
    });
}

function meetsPositiveThreshold(sourceEl) {
    const item = sourceEl && sourceEl.closest ? sourceEl.closest('.alert-item') : null;
    const fromEl = (el) => el ? {
        pc: Number(el.dataset.positiveCount ?? 0),
        th: Number(el.dataset.threshold ?? 1)
    } : { pc: 0, th: 1 };

    const btnData = fromEl(sourceEl);
    const itemData = fromEl(item);

    const positiveCount = Number.isFinite(btnData.pc) && btnData.pc > 0 ? btnData.pc : itemData.pc;
    const threshold = Number.isFinite(btnData.th) && btnData.th > 0 ? btnData.th : itemData.th;

    return positiveCount >= threshold;
}

function updateVerifyButtonsState() {
    document.querySelectorAll('.btn-verify').forEach(btn => {
        const ok = meetsPositiveThreshold(btn);
        btn.disabled = !ok;
        btn.title = ok ? '' : 'Nombre de positifs insuffisant pour valider cette alerte';
        btn.classList.toggle('disabled', !ok);
    });
}

window.onclick = function(event) {
    const modal = document.getElementById('imageModal');
    if (event.target === modal) {
        closeImageModal();
    }
};

document.addEventListener('DOMContentLoaded', function() {
    document.querySelectorAll('.btn-verify').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();

            const id = this.dataset.id;
            const verify = this.dataset.verify === 'true';
            verifyAlert(id, verify);
        });
    });

    document.querySelectorAll('.btn-resolve').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const id = this.dataset.id;
            resolveAlert(id);
        });
    });

    document.querySelectorAll('.btn-image').forEach(button => {
        button.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            const imageId = this.dataset.id;
            viewAlertImage(imageId);
        });
    });

    const closeBtn = document.getElementById('closeImageModalBtn');
    if (closeBtn) {
        closeBtn.addEventListener('click', closeImageModal);
    }

    const filters = ['typeFilter', 'statusFilter', 'verificationFilter'];
    filters.forEach(filterId => {
        const filter = document.getElementById(filterId);
        if (filter) {
            filter.addEventListener('change', () => {
                filterAlerts();
                updateVerifyButtonsState();
            });
        }
    });

    if (document.getElementById('typeFilter')) {
        filterAlerts();
        updateVerifyButtonsState();
    }
});
