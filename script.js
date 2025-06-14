// This script contains the core logic for the NIC Prevention application.

// Application state to hold risk scores
let appState = { preRiskScore: 0, postRiskScore: 0 };

// Event listener to initialize the application when the DOM is fully loaded.
document.addEventListener('DOMContentLoaded', () => {
    // --- Attaching Event Listeners ---

    // Tab Navigation Buttons
    document.getElementById('btn-tab-generateur').addEventListener('click', () => showTab('generateur'));
    document.getElementById('nav-fiche').addEventListener('click', () => showTab('fiche'));
    document.getElementById('btn-tab-outils').addEventListener('click', () => showTab('outils'));
    document.getElementById('btn-tab-protocoles').addEventListener('click', () => showTab('protocoles'));
    document.getElementById('btn-tab-references').addEventListener('click', () => showTab('references'));

    // Action Buttons
    document.getElementById('btn-goto-outils').addEventListener('click', () => showTab('outils'));
    document.getElementById('btn-calculate-pre-risk').addEventListener('click', calculatePreRisk);
    document.getElementById('btn-generate-summary').addEventListener('click', generateSummarySheet);
    document.getElementById('btn-use-ckd').addEventListener('click', useCkdValue);
    document.getElementById('btn-toggle-lvedp').addEventListener('click', () => toggleDetails('lvedp-details'));
    document.getElementById('btn-toggle-renalguard').addEventListener('click', () => toggleDetails('renalguard-details'));
    
    // Real-time calculation for tool inputs
    document.querySelectorAll('.ckd-input').forEach(el => el.addEventListener('input', calculateCkdEpi));
    document.querySelectorAll('.macd-input-tool').forEach(el => el.addEventListener('input', calculateMACDTool));
    
    // --- Initial Application Setup ---
    // The initial active tab is already set in the HTML, so no need to call showTab on load.
    populateReferences();
});

/**
 * Shows a specific tab and hides others by managing 'active' classes.
 * @param {string} tabId - The ID of the tab content to display.
 */
function showTab(tabId) {
    // Do not proceed if the target is a disabled button (like the initial state of 'Fiche')
    const ficheButton = document.getElementById('nav-fiche');
    if (tabId === 'fiche' && ficheButton.disabled) {
        return;
    }

    // Hide all tab content by removing 'active' class
    document.querySelectorAll('.tab-content').forEach(tab => {
        tab.classList.remove('active');
    });

    // Show the selected tab content by adding 'active' class
    const tabElement = document.getElementById(tabId);
    if (tabElement) {
        tabElement.classList.add('active');
    }

    // Update active state for navigation buttons
    document.querySelectorAll('.nav-btn').forEach(btn => {
        btn.classList.remove('active');
    });

    // Map tabId to buttonId
    const btnIdMap = {
        'generateur': 'btn-tab-generateur',
        'fiche': 'nav-fiche',
        'outils': 'btn-tab-outils',
        'protocoles': 'btn-tab-protocoles',
        'references': 'btn-tab-references',
    };
    const activeBtn = document.getElementById(btnIdMap[tabId]);
    if (activeBtn) {
        activeBtn.classList.add('active');
    }
}


/**
 * Toggles the visibility of detailed information sections.
 * @param {string} elementId - The ID of the details element to toggle.
 */
function toggleDetails(elementId) { 
    const element = document.getElementById(elementId); 
    const button = element.previousElementSibling; 
    if (element.style.display === 'block') { 
        element.style.display = 'none'; 
        button.innerHTML = `<i class="fa-solid fa-plus-circle mr-2"></i>Plus de détails`; 
    } else { 
        element.style.display = 'block'; 
        button.innerHTML = `<i class="fa-solid fa-minus-circle mr-2"></i>Moins de détails`; 
    } 
}

/**
 * Calculates the initial pre-intervention risk score based on the Mehran model.
 */
function calculatePreRisk() {
    let score = 0;
    document.querySelectorAll('.mehran-input:checked').forEach(cb => score += parseInt(cb.dataset.points));
    score += parseInt(document.getElementById('egfr').value);
    const contrast = parseFloat(document.getElementById('contrast').value) || 0;
    if (contrast > 0) {
        score += Math.floor(contrast / 100);
    }
    appState.preRiskScore = score;
    
    const { level, riskColor } = getRiskDetails(score);
    const resultEl = document.getElementById('pre-risk-result');
    resultEl.innerHTML = `<p class="font-semibold text-blue-800">Risque Initial Calculé</p><p class="text-3xl font-bold ${riskColor}">${level}</p>`;
    resultEl.style.display = 'block';
    
    document.getElementById('post-intervention-section').style.display = 'block';
    document.getElementById('nav-fiche').disabled = false;
}

/**
 * Generates the final summary sheet after post-intervention re-evaluation.
 */
function generateSummarySheet() {
    let postScore = appState.preRiskScore;
    document.querySelectorAll('.post-input:checked').forEach(cb => postScore += parseInt(cb.dataset.riskIncrease));
    appState.postRiskScore = postScore;

    const finalScore = Math.max(appState.preRiskScore, appState.postRiskScore);
    const { level: finalLevel, riskColor: finalRiskColor } = getRiskDetails(finalScore);
    const preRiskDetails = getRiskDetails(appState.preRiskScore);
    const postRiskDetails = getRiskDetails(appState.postRiskScore);

    const weight = parseFloat(document.getElementById('poids').value) || 0;
    const creatinineMgL = parseFloat(document.getElementById('creatinine').value) || 0;
    const creatinineMgDL = creatinineMgL / 10;
    const dfgeVal = parseInt(document.getElementById('egfr').options[document.getElementById('egfr').selectedIndex].dataset.dfgeVal);
    const contrast = parseFloat(document.getElementById('contrast').value) || 0;
    const macd = (weight > 0 && creatinineMgDL > 0) ? `${Math.round((5 * weight) / creatinineMgDL)} mL` : 'N/A';
    const ratio = (contrast > 0 && dfgeVal > 0) ? (contrast / dfgeVal).toFixed(2) : 'N/A';

    let contemporaryAlerts = [];
    document.querySelectorAll('.contemporary-input:checked, .post-input:checked').forEach(cb => contemporaryAlerts.push(cb.dataset.alert));
    
    const id = { patientName: document.getElementById('patient-name').value || 'Non spécifié', doctorName: document.getElementById('doctor-name').value || 'Non spécifié' };
    
    let summaryHTML = buildSummaryHTML(appState.preRiskScore, appState.postRiskScore, preRiskDetails, postRiskDetails, macd, ratio, contemporaryAlerts, id);
    document.getElementById('summary-sheet-content').innerHTML = summaryHTML;
    
    let checklistHTML = buildChecklistHTML(finalLevel, finalRiskColor, macd, ratio);
    const checklistElement = document.getElementById('summary-sheet-content').querySelector('#checklist');
    if (checklistElement) {
        checklistElement.innerHTML = checklistHTML;
    }
    
    highlightProtocol(finalLevel);
    showTab('fiche');
}
        
/**
 * Highlights the recommended protocol based on the final risk level.
 * @param {string} level - The final risk level ('Faible', 'Modéré', 'Élevé', 'Très Élevé').
 */
function highlightProtocol(level) {
    document.querySelectorAll('.protocol-box').forEach(box => box.classList.remove('highlight'));
    let elementId;
    if (level === 'Faible') elementId = 'proto-low';
    else if (level === 'Modéré') elementId = 'proto-moderate';
    else if (level === 'Élevé' || level === 'Très Élevé') elementId = 'proto-high';
    
    const el = document.getElementById(elementId);
    if(el) {
        el.classList.add('highlight');
    }
}

/**
 * Determines the risk level and corresponding color from a score.
 * @param {number} score - The risk score.
 * @returns {{level: string, riskColor: string}} An object with the risk level and color class.
 */
function getRiskDetails(score) { 
    if (score <= 5) return { level: 'Faible', riskColor: 'risk-color-low' }; 
    if (score <= 10) return { level: 'Modéré', riskColor: 'risk-color-moderate' }; 
    if (score <= 15) return { level: 'Élevé', riskColor: 'risk-color-high' }; 
    return { level: 'Très Élevé', riskColor: 'risk-color-very-high' }; 
}

/**
 * Builds the HTML for the summary sheet content.
 * @returns {string} The HTML string for the summary.
 */
function buildSummaryHTML(preScore, postScore, preDetails, postDetails, macd, ratio, alerts, id) { 
    return `
        <h2 class="text-3xl font-bold text-blue-900 mb-2 text-center">Fiche de Synthèse Finale</h2>
        <p class="text-center text-slate-500 mb-6">Date: ${new Date().toLocaleDateString('fr-FR')}</p>
        <div class="bg-slate-100 p-4 rounded-xl mb-6 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
            <div><strong>Patient:</strong> ${id.patientName}</div>
            <div><strong>Médecin:</strong> ${id.doctorName}</div>
        </div>
        <div class="bg-white p-6 rounded-2xl mb-8 shadow">
            <h3 class="text-xl font-bold text-slate-800 mb-4">Évolution du Risque</h3>
            <div class="grid md:grid-cols-2 gap-4 text-center">
                <div class="bg-slate-100 p-3 rounded-lg"><p class="text-sm text-slate-500">Risque Initial (Score: ${preScore})</p><p class="text-2xl font-bold ${preDetails.riskColor}">${preDetails.level}</p></div>
                <div class="bg-slate-100 p-3 rounded-lg"><p class="text-sm text-slate-500">Risque Final Ajusté (Score: ${postScore})</p><p class="text-2xl font-bold ${postDetails.riskColor}">${postDetails.level}</p></div>
            </div>
        </div>
        ${alerts.length > 0 ? `<div class="mb-8"><h4 class="font-semibold text-lg text-red-600 mb-2"><i class="fa-solid fa-flag mr-2"></i>Facteurs de Risque Additionnels</h4><div class="bg-red-50 border-l-4 border-red-500 p-4 rounded-r-lg"><ul class="list-disc list-inside text-red-800">${alerts.map(a => `<li>${a}</li>`).join('')}</ul></div></div>` : ''}
        <div class="protocol-section">
            <h4><i class="fa-solid fa-list-check mr-2"></i>Protocole de Prise en Charge (basé sur le risque final)</h4>
            <div id="checklist"></div>
        </div>
    `; 
}

/**
 * Builds the HTML for the protocol checklist.
 * @returns {string} The HTML string for the checklist.
 */
function buildChecklistHTML(level, color, macd, ratio) { 
    let html = ''; 
    let hydrationHTML = `<strong>Hydratation:</strong> Se référer à l'onglet "Algorithme des Protocoles" pour choisir le protocole adapté au niveau de risque <strong>(${level})</strong>.`; 
    html += `<div class="protocol-item"><i class="fa-solid fa-droplet icon ${color}"></i><div>${hydrationHTML}</div></div>`; 
    
    let contrastHTML = `<strong>Gestion Contraste:</strong> Volume max: <strong>${macd}</strong>.`; 
    if (parseFloat(ratio) > 2.0) {
        contrastHTML += `<div class="text-sm mt-2 p-2 bg-red-100 rounded-lg"><strong>Alerte:</strong> Le ratio Vol/DFGe prévu (${ratio}) est élevé.</div>`; 
    }
    html += `<div class="protocol-item"><i class="fa-solid fa-bottle-droplet icon ${color}"></i><div>${contrastHTML}</div></div>`; 
    
    let medsHTML = (level === 'Faible') ? '<strong>Médicaments:</strong> Pas de modification systématique.' : `<strong>Arrêt néphrotoxiques</strong> 48h avant.<br>${(level === 'Élevé' || level === 'Très Élevé') ? '<strong>Statines haute dose</strong> fortement recommandées.' : '<strong>Statines</strong> à considérer.'}`; 
    html += `<div class="protocol-item"><i class="fa-solid fa-pills icon ${color}"></i><div>${medsHTML}</div></div>`; 
    
    if (level === 'Très Élevé') {
        html += `<div class="protocol-item"><i class="fa-solid fa-triangle-exclamation icon ${color}"></i><div><strong>Considérations Avancées:</strong> Discuter imagerie alternative ou protocole guidé (voir "Algorithme des Protocoles").</div></div>`; 
    }
    
    html += `<div class="protocol-item"><i class="fa-solid fa-arrow-down-short-wide icon ${color}"></i><div><strong>Pendant la procédure:</strong> Privilégier un <strong>accès radial</strong>.</div></div>`; 
    html += `<div class="protocol-item"><i class="fa-solid fa-vial-circle-check icon ${color}"></i><div><strong>Après la procédure:</strong> Surveillance <strong>créatinine à 48-72h</strong>.</div></div>`; 
    
    return html; 
}

/**
 * Calculates eGFR using the CKD-EPI 2021 formula.
 */
function calculateCkdEpi() {
    const creatinineMgL = parseFloat(document.getElementById('creatinine-tool-ckd').value);
    const creatinineMgDL = creatinineMgL / 10;
    const age = parseInt(document.getElementById('age-tool-ckd').value);
    const sex = document.getElementById('sex-tool-ckd').value;
    const resultContainer = document.getElementById('ckd-result-container');
    const resultEl = document.getElementById('ckd-result');
    
    if (!creatinineMgDL || !age || creatinineMgDL <= 0 || age <= 0) { 
        resultContainer.style.display = 'none'; 
        return; 
    }
    
    let k = (sex === 'female') ? 0.7 : 0.9;
    let egfr = 142 * Math.pow(Math.min(creatinineMgDL / k, 1), (sex === 'female' ? -0.241 : -0.302)) * Math.pow(Math.max(creatinineMgDL / k, 1), -1.200) * Math.pow(0.9938, age) * (sex === 'female' ? 1.012 : 1);
    
    resultEl.textContent = `${Math.round(egfr)} mL/min/1.73m²`;
    resultContainer.style.display = 'block';
}

/**
 * Uses the calculated eGFR value in the main generator form.
 */
function useCkdValue() {
    const egfrResultText = document.getElementById('ckd-result').textContent;
    if (!egfrResultText) return;
    
    const egfrResult = parseFloat(egfrResultText);
    const egfrSelect = document.getElementById('egfr');
    
    if (egfrResult >= 60) egfrSelect.value = '0';
    else if (egfrResult >= 40) egfrSelect.value = '2';
    else if (egfrResult >= 20) egfrSelect.value = '4';
    else egfrSelect.value = '6';
    
    showTab('generateur');
}

/**
 * Calculates the Maximum Acceptable Contrast Dose (MACD) in the tools section.
 */
function calculateMACDTool() {
    const weight = parseFloat(document.getElementById('poids-tool').value);
    const creatinineMgL = parseFloat(document.getElementById('creatinine-tool-macd').value);
    const creatinineMgDL = creatinineMgL / 10;
    const resultContainer = document.getElementById('macd-result-container');
    const resultEl = document.getElementById('macd-result');
    
    if (weight > 0 && creatinineMgDL > 0) { 
        resultEl.textContent = `${Math.round((5 * weight) / creatinineMgDL)} mL`; 
        resultContainer.style.display = 'block'; 
    } else { 
        resultContainer.style.display = 'none'; 
    }
}

/**
 * Populates the references list from a predefined array of strings.
 */
function populateReferences() { 
    const references = ["Mehran R, et al. J Am Coll Cardiol. 2004;44:1393-9.","Briguori C, et al. JACC Cardiovasc Interv. 2020;13:2065-74.","Briguori C, et al. Catheter Cardiovasc Interv. 2020;95:895-903.","Brar SS, et al. Lancet. 2014;383:1814-23.","McDonald JS, et al. Radiology. 2014;271:65-73.","Cosmai L, et al. ESMO Open. 2020;5:e000618.","van der Molen AJ, et al. Eur Radiol. 2018;28:2845-55.","Nijssen EC, et al. Lancet. 2017;389:1312-22.","Wei L, et al. BMJ Open. 2021;11:e043436.","Huang X, et al. J Cardiovasc Pharm. 2022;79:904-13.","Meregildo-Rodriguez ED, et al. Front Endocrinol. 2023;14:1307715.","Zuo T, et al. Int J Cardiol. 2016;224:286-94.","Watanabe M, et al. Circ J. 2022;86:1005-14.","Zhu G, et al. Clin Exp Nephrol. 2021;25:1022-32.","Macdonald DB, et al. Can J Kidney Health Dis. 2022:9:1-15.","Rudnick MR, et al. Am J Kidney Dis. 2020:75:105-13.","Zhang F, et al. Life Sci. 2020;259:118379.","Lu Z, et al. EBioMedicine. 2017;17:101-7.","Wong GT, et al. Br J Anaesth. 2016;117 Suppl 2:ii63-73.","Li Y, et al. BMC Nephrol. 2024;25:140.","Nicola R, et al. Curr Probl Diagn Radiol. 2015;44:501-4.","Mehran R, et al. N Engl J Med. 2019;380:2146-55.","Cousin F, et al. Rev Med Liège. 2014;69:500-5.","Dapagliflozin Attenuates Contrast-induced Acute Kidney Injury by Regulating the HIF. J Cardiovasc Pharmacol. 2022;79:904-13.","Inorganic nitrate benefits contrast-induced nephropathy... Eur Heart J. 2024;45:1647-58.","Utilisation d'acétylcystéine pour la prévention... - Revue Médicale Suisse, 2005"]; 
    const referencesList = document.querySelector("#references-list"); 
    if(referencesList) {
        referencesList.innerHTML = references.map(ref => `<li>${ref}</li>`).join('');
    }
}
