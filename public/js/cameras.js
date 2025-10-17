// Cameras page JavaScript

function showAddCameraModal() {
    document.getElementById('cameraModal').classList.add('active');
    document.getElementById('modalTitle').textContent = 'Ajouter une caméra';
    document.getElementById('cameraForm').reset();
    document.getElementById('cameraId').value = '';
}

function closeModal() {
    document.getElementById('cameraModal').classList.remove('active');
}

async function submitCamera(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    const cameraId = data.id;
    delete data.id;
    
    // Valider le port
    if (data.port) {
        data.port = parseInt(data.port);
        if (isNaN(data.port) || data.port < 1 || data.port > 65535) {
            showNotification('Le port doit être entre 1 et 65535', 'error');
            return;
        }
    } else {
        data.port = 554; // Port par défaut
    }
    
    // Valider le path
    if (!data.path || data.path.trim() === '') {
        data.path = '/live0'; // Path par défaut
    }
    
    // Valider les coordonnées GPS
    if (data.latitude && data.longitude) {
        data.latitude = parseFloat(data.latitude);
        data.longitude = parseFloat(data.longitude);
        
        if (isNaN(data.latitude) || isNaN(data.longitude)) {
            showNotification('Les coordonnées GPS sont invalides', 'error');
            return;
        }
        
        if (data.latitude < -90 || data.latitude > 90) {
            showNotification('La latitude doit être entre -90 et 90', 'error');
            return;
        }
        
        if (data.longitude < -180 || data.longitude > 180) {
            showNotification('La longitude doit être entre -180 et 180', 'error');
            return;
        }
    }
    
    try {
        if (cameraId) {
            // Update existing camera
            await apiRequest(`/api/cameras/${cameraId}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            showNotification('Caméra mise à jour avec succès', 'success');
        } else {
            // Create new camera
            await apiRequest('/api/cameras', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            showNotification('Caméra ajoutée avec succès', 'success');
        }
        
        closeModal();
        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function startCamera(id) {
    if (!confirm('Voulez-vous démarrer cette caméra ?')) return;
    
    try {
        await apiRequest(`/api/cameras/${id}/start`, { method: 'POST' });
        showNotification('Caméra démarrée', 'success');
        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function stopCamera(id) {
    if (!confirm('Voulez-vous arrêter cette caméra ?')) return;
    
    try {
        await apiRequest(`/api/cameras/${id}/stop`, { method: 'POST' });
        showNotification('Caméra arrêtée', 'success');
        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function editCamera(id) {
    try {
        const camera = await apiRequest(`/api/cameras/${id}`);
        
        document.getElementById('cameraModal').classList.add('active');
        document.getElementById('modalTitle').textContent = 'Modifier la caméra';
        document.getElementById('cameraId').value = camera.id;
        document.getElementById('ip').value = camera.ip;
        document.getElementById('port').value = camera.port || 554;
        document.getElementById('path').value = camera.path || '/live0';
        document.getElementById('username').value = camera.username;
        document.getElementById('password').value = camera.password;
        document.getElementById('model').value = camera.model || '';
        
        // Load position data if exists
        if (camera.fk_position) {
            const position = await apiRequest(`/api/positions/${camera.fk_position}`);
            document.getElementById('latitude').value = position.latitude;
            document.getElementById('longitude').value = position.longitude;
            document.getElementById('label').value = position.label || '';
        }
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

async function deleteCamera(id) {
    if (!confirm('Voulez-vous vraiment supprimer cette caméra ?')) return;
    
    try {
        await apiRequest(`/api/cameras/${id}`, { method: 'DELETE' });
        showNotification('Caméra supprimée', 'success');
        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function filterCameras() {
    const status = document.getElementById('statusFilter').value;
    const cards = document.querySelectorAll('.camera-card');
    
    cards.forEach(card => {
        if (!status || card.dataset.status === status) {
            card.style.display = 'block';
        } else {
            card.style.display = 'none';
        }
    });
}


// DOMContentLoaded pour lier les événements sans inline handlers
document.addEventListener('DOMContentLoaded', function () {
    // Bouton ajouter caméra
    const addBtn = document.getElementById('addCameraBtn');
    if (addBtn) addBtn.addEventListener('click', showAddCameraModal);

    // Filtre statut
    const statusFilter = document.getElementById('statusFilter');
    if (statusFilter) statusFilter.addEventListener('change', filterCameras);

    // Actions sur chaque carte caméra
    document.querySelectorAll('.btn-stop').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            stopCamera(btn.dataset.id);
        });
    });
    document.querySelectorAll('.btn-start').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            startCamera(btn.dataset.id);
        });
    });
    document.querySelectorAll('.btn-edit').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            editCamera(btn.dataset.id);
        });
    });
    document.querySelectorAll('.btn-delete').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            deleteCamera(btn.dataset.id);
        });
    });

    // Modal close (croix)
    const closeModalBtn = document.getElementById('closeModalBtn');
    if (closeModalBtn) closeModalBtn.addEventListener('click', closeModal);

    // Modal cancel (bouton Annuler)
    const cancelModalBtn = document.getElementById('cancelModalBtn');
    if (cancelModalBtn) cancelModalBtn.addEventListener('click', closeModal);

    // Formulaire caméra
    const cameraForm = document.getElementById('cameraForm');
    if (cameraForm) cameraForm.addEventListener('submit', submitCamera);

    // Fermer le modal en cliquant à l'extérieur
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('cameraModal');
        if (event.target === modal) {
            closeModal();
        }
    });
});
