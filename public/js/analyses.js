// Analyses page JavaScript

async function toggleAnalysis(id, isActive) {
    try {
        await apiRequest(`/api/analyses/${id}`, {
            method: 'PUT',
            body: JSON.stringify({ is_active: isActive })
        });
        showNotification(
            isActive ? 'Analyse activée' : 'Analyse désactivée', 
            'success'
        );
    } catch (error) {
        showNotification(error.message, 'error');
        // Revert checkbox state on error
        event.target.checked = !isActive;
    }
}

async function editAnalysis(id) {
    try {
        const analysis = await apiRequest(`/api/analyses/${id}`);
        
        document.getElementById('analysisModal').classList.add('active');
        document.getElementById('analysisId').value = analysis.id;
        document.getElementById('detection_threshold').value = (analysis.detection_threshold * 100);
        updateThresholdValue(analysis.detection_threshold * 100);
        document.getElementById('nbr_positive_necessary').value = analysis.nbr_positive_necessary;
        document.getElementById('image_extraction_interval').value = analysis.image_extraction_interval;
    } catch (error) {
        showNotification(error.message, 'error');
    }
}

function closeAnalysisModal() {
    document.getElementById('analysisModal').classList.remove('active');
}

function updateThresholdValue(value) {
    document.getElementById('thresholdValue').textContent = value + '%';
}

async function submitAnalysis(event) {
    event.preventDefault();
    
    const formData = new FormData(event.target);
    const data = Object.fromEntries(formData.entries());
    const analysisId = data.id;
    delete data.id;
    
    // Convert threshold from percentage to decimal
    data.detection_threshold = parseFloat(data.detection_threshold) / 100;
    data.nbr_positive_necessary = parseInt(data.nbr_positive_necessary);
    data.image_extraction_interval = parseInt(data.image_extraction_interval);
    
    try {
        await apiRequest(`/api/analyses/${analysisId}`, {
            method: 'PUT',
            body: JSON.stringify(data)
        });
        showNotification('Configuration mise à jour', 'success');
        closeAnalysisModal();
        setTimeout(() => window.location.reload(), 1000);
    } catch (error) {
        showNotification(error.message, 'error');
    }
}


// DOMContentLoaded pour lier les événements sans inline handlers
document.addEventListener('DOMContentLoaded', function () {
    // Lier les boutons "Configurer"
    document.querySelectorAll('.btn-edit-analysis').forEach(btn => {
        btn.addEventListener('click', function (e) {
            e.stopPropagation();
            editAnalysis(btn.dataset.id);
        });
    });

    // Lier les switches d'activation
    document.querySelectorAll('.toggle-analysis').forEach((checkbox, idx) => {
        checkbox.addEventListener('change', function (e) {
            // Trouver l'id de l'analyse associée
            // On suppose que l'ordre des .toggle-analysis correspond à analyses
            // ou bien il faut stocker l'id dans un data-attribute
            // Pour plus de robustesse, on peut ajouter data-id dans le HTML
            // Ici, on tente de récupérer l'id via le DOM
            let card = checkbox.closest('.analysis-card');
            let id = card ? card.querySelector('.btn-edit-analysis')?.dataset.id : null;
            if (id) toggleAnalysis(id, checkbox.checked);
        });
    });

    // Lier le slider de seuil
    const thresholdInput = document.querySelector('.threshold-input');
    if (thresholdInput) {
        thresholdInput.addEventListener('input', function (e) {
            updateThresholdValue(e.target.value);
        });
    }

    // Lier le bouton Annuler
    const cancelBtn = document.getElementById('cancelAnalysisModalBtn');
    if (cancelBtn) cancelBtn.addEventListener('click', closeAnalysisModal);

    // Lier la croix de fermeture
    const closeBtn = document.getElementById('closeAnalysisModalBtn');
    if (closeBtn) closeBtn.addEventListener('click', closeAnalysisModal);

    // Lier le formulaire
    const form = document.getElementById('analysisForm');
    if (form) form.addEventListener('submit', submitAnalysis);

    // Fermer le modal en cliquant à l'extérieur
    window.addEventListener('click', function(event) {
        const modal = document.getElementById('analysisModal');
        if (event.target === modal) {
            closeAnalysisModal();
        }
    });
});
