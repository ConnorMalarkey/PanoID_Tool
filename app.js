document.addEventListener('DOMContentLoaded', function() {
    const iframe = document.getElementById('matterport-iframe');
    const sweepIdInput = document.getElementById('sweepId');
    const navigateButton = document.getElementById('navigateToSweep');
    const feedbackElement = document.getElementById('feedback');
    const currentSweepIdElement = document.getElementById('current-sweep-id');
    const legacySweepIdElement = document.getElementById('legacy-sweep-id');
    const idMapTableBody = document.querySelector('#id-map-table tbody');
    // The current-sweep-label element might not exist in the new HTML
    const currentSweepLabelElement = document.createElement('div');
    currentSweepLabelElement.id = 'current-sweep-label';
    currentSweepLabelElement.className = 'sweep-info-item';
    document.querySelector('.sweep-info').appendChild(currentSweepLabelElement);

    // Legacy Navigation Elements
    const legacySweepIdInput = document.getElementById('legacySweepId');
    const navigateToLegacySweepButton = document.getElementById('navigateToLegacySweep');
    const legacyFeedbackElement = document.getElementById('legacyFeedback');

    // Model Change Elements
    const modelIdInput = document.getElementById('modelId');
    const changeModelButton = document.getElementById('changeModel');
    const modelFeedbackElement = document.getElementById('modelFeedback');

    // SDK Key Elements
    const sdkKeyButton = document.getElementById('sdkKeyButton');
    const sdkKeyModal = document.getElementById('sdkKeyModal');
    const sdkKeyInput = document.getElementById('sdkKeyInput');
    const saveSdkKey = document.getElementById('saveSdkKey');
    const cancelSdkKey = document.getElementById('cancelSdkKey');

    // Help button
    const helpButton = document.getElementById('helpButton');

    let showcaseSdk = null;
    let idMap = null;
    let sweepLabels = {};
    let currentModelSid = 'YeNsHyWcrMM'; // Initial model SID
    let sdkKey = null;

    // Cookie functions for SDK Key
    function setSdkKeyCookie(key, expiryDays = 30) {
        const date = new Date();
        date.setTime(date.getTime() + (expiryDays * 24 * 60 * 60 * 1000));
        const expires = "expires=" + date.toUTCString();
        document.cookie = "matterportSdkKey=" + key + ";" + expires + ";path=/;SameSite=Strict";
    }

    function getSdkKeyCookie() {
        const name = "matterportSdkKey=";
        const decodedCookie = decodeURIComponent(document.cookie);
        const cookieArray = decodedCookie.split(';');
        for(let i = 0; i < cookieArray.length; i++) {
            let cookie = cookieArray[i];
            while (cookie.charAt(0) === ' ') {
                cookie = cookie.substring(1);
            }
            if (cookie.indexOf(name) === 0) {
                return cookie.substring(name.length, cookie.length);
            }
        }
        return "";
    }

    // Check for existing SDK key cookie
    sdkKey = getSdkKeyCookie();
    
    // Initialize Matterport showcase
    let showcaseUrl = `https://my.matterport.com/show/?m=${currentModelSid}&qs=1&play=1`;
    iframe.src = showcaseUrl;

    // Only initialize if we have an SDK key
    if (sdkKey) {
        iframe.onload = async () => {
            await initializeSdkAndData();
        };
    } else {
        // If no SDK key is found, show the modal immediately
        sdkKeyModal.style.display = "flex";
    }

    async function initializeSdkAndData() {
        if (!sdkKey) {
            showFeedback(feedbackElement, 'Please enter your Matterport SDK key to continue.', 'error');
            sdkKeyModal.style.display = "flex";
            return;
        }
        
        try {
            showcaseSdk = await window.MP_SDK.connect(iframe, sdkKey, "");
            console.log('Matterport SDK connected:', showcaseSdk);

            const urlParams = new URLSearchParams(showcaseUrl.split('?')[1]);
            currentModelSid = urlParams.get('m');
            if (!currentModelSid) {
                console.error('Model SID not found in the showcase URL.');
                showFeedback(feedbackElement, 'Error: Model SID not found.', 'error');
                return;
            }

            showFeedback(feedbackElement, 'Matterport Showcase loaded.', 'success');

            try {
                idMap = await showcaseSdk.Sweep.Conversion.createIdMap();
                console.log("ID Map created:", idMap);

                // Fetch sweep labels using getLabelFromId
                try {
                    for (const currentId in idMap) {
                        if (idMap.hasOwnProperty(currentId)) {
                            try {
                                const label = await showcaseSdk.Sweep.Conversion.getLabelFromId(currentId);
                                sweepLabels[currentId] = label || "N/A";
                            } catch (labelError) {
                                console.error(`Error getting label for ${currentId}:`, labelError);
                                sweepLabels[currentId] = "Error";
                            }
                        }
                    }
                    console.log("Sweep Labels:", sweepLabels);
                } catch (labelFetchError) {
                    console.error("Error fetching sweep labels:", labelFetchError);
                    showFeedback(feedbackElement, "Error: Could not fetch sweep labels.", 'error');
                    sweepLabels = {};
                }

                displayIdMapTable();

            } catch (mapError) {
                console.error("Error creating ID map:", mapError);
                showFeedback(feedbackElement, "Error: Could not create ID map.", 'error');
                return;
            }

            if (showcaseSdk) {
                try {
                    const currentSweep = await showcaseSdk.Sweep.getCurrent();
                    console.log("Initial current sweep:", currentSweep);
                    if (currentSweep && currentSweep.id) {
                        updateSweepInfo(currentSweep.id);
                    }
                } catch (error) {
                    console.error("Error in initial sweep fetch:", error);
                }
            }

            showcaseSdk.Sweep.current.subscribe(async currentSweep => {
                console.log("Sweep changed to:", currentSweep);
                if (currentSweep && currentSweep.id) {
                    updateSweepInfo(currentSweep.id);
                }
            });

        } catch (e) {
            console.error('Error connecting to Matterport SDK:', e);
            showFeedback(feedbackElement, 'Error loading Matterport Showcase.', 'error');
        }
    }

    async function updateSweepInfo(sweepId) {
        currentSweepIdElement.innerHTML = `<span>Sweep ID:</span> ${sweepId}`;
        const legacyId = idMap[sweepId] || "N/A";
        legacySweepIdElement.innerHTML = `<span>Pano ID:</span> ${legacyId}`;
        try {
            const currentLabel = await showcaseSdk.Sweep.Conversion.getLabelFromId(sweepId);
            console.log("Updated sweep label:", currentLabel);
            currentSweepLabelElement.innerHTML = `<span>Scan #:</span> ${currentLabel || 'N/A'}`;
        } catch (labelErr) {
            console.error("Error fetching label during sweep change:", labelErr);
            currentSweepLabelElement.innerHTML = `<span>Scan #:</span> Error`;
        }
    }

    function showFeedback(element, message, type) {
        element.textContent = message;
        element.className = `feedback ${type}`;
        
        // Auto-hide feedback after 5 seconds
        setTimeout(() => {
            element.className = 'feedback';
        }, 5000);
    }

    navigateButton.addEventListener('click', async () => {
        if (!showcaseSdk) {
            showFeedback(feedbackElement, 'Matterport Showcase not yet loaded.', 'error');
            return;
        }

        const sweepId = sweepIdInput.value.trim();
        if (!sweepId) {
            showFeedback(feedbackElement, 'Please enter a Sweep ID.', 'error');
            return;
        }

        try {
            await showcaseSdk.Sweep.moveTo(sweepId, {
                transition: "transition.fly"
            });
            showFeedback(feedbackElement, `Navigated to sweep: ${sweepId}`, 'success');
            sweepIdInput.value = '';
        } catch (error) {
            console.error('Error navigating to sweep:', error);
            showFeedback(feedbackElement, `Error navigating to sweep: ${error.message || 'Invalid Sweep ID'}`, 'error');
        }
    });

    function displayIdMapTable() {
        if (!idMap || Object.keys(idMap).length === 0) {
            idMapTableBody.innerHTML = '<tr><td colspan="3">No sweep ID conversions available.</td></tr>';
            return;
        }

        let tableRows = [];
        for (const currentId in idMap) {
            if (idMap.hasOwnProperty(currentId)) {
                const legacyId = idMap[currentId];
                const label = sweepLabels[currentId] || "N/A";
                tableRows.push({ label: label, currentId: currentId, legacyId: legacyId });
            }
        }

        tableRows.sort((a, b) => {
            const labelA = a.label.toLowerCase();
            const labelB = b.label.toLowerCase();

            const extractNumber = (str) => {
                const match = str.match(/(\d+)/);
                return match ? parseInt(match[0], 10) : Infinity;
            };

            const numA = extractNumber(labelA);
            const numB = extractNumber(labelB);

            if (numA !== Infinity && numB !== Infinity) {
                return numA - numB;
            } else if (numA === numB) {
                return labelA.localeCompare(labelB);
            } else {
                return numA === Infinity ? -1 : 1;
            }
        });

        let tableHTML = '';
        tableRows.forEach(row => {
            tableHTML += `<tr><td>${row.label}</td><td>${row.currentId}</td><td>${row.legacyId}</td></tr>`;
        });

        idMapTableBody.innerHTML = tableHTML;
    }

    // --- Legacy Navigation Functionality ---
    navigateToLegacySweepButton.addEventListener('click', async () => {
        if (!showcaseSdk) {
            showFeedback(legacyFeedbackElement, 'Matterport Showcase not yet loaded.', 'error');
            return;
        }

        const legacyId = legacySweepIdInput.value.trim();
        if (!legacyId) {
            showFeedback(legacyFeedbackElement, 'Please enter a Pano ID.', 'error');
            return;
        }

        // Reverse lookup in idMap
        let currentId = null;
        for (const curr in idMap) {
            if (idMap.hasOwnProperty(curr) && idMap[curr] === legacyId) {
                currentId = curr;
                break;
            }
        }

        if (!currentId) {
            showFeedback(legacyFeedbackElement, `Legacy Sweep ID "${legacyId}" not found.`, 'error');
            return;
        }

        try {
            await showcaseSdk.Sweep.moveTo(currentId, {
                transition: "transition.fly"
            });
            showFeedback(legacyFeedbackElement, `Navigated to sweep with Legacy ID: ${legacyId}`, 'success');
            legacySweepIdInput.value = '';

        } catch (error) {
            console.error('Error navigating to sweep:', error);
            showFeedback(legacyFeedbackElement, `Error navigating: ${error.message || 'Invalid Sweep ID'}`, 'error');
        }
    });

    // --- Model Change Functionality ---
    changeModelButton.addEventListener('click', async () => {
        const newModelId = modelIdInput.value.trim();
        if (!newModelId) {
            showFeedback(modelFeedbackElement, 'Please enter a Model ID.', 'error');
            return;
        }

        currentModelSid = newModelId;
        showcaseUrl = `https://my.matterport.com/show/?m=${currentModelSid}&qs=1&play=1`;
        iframe.src = showcaseUrl; // Reload the iframe with the new model

        // Re-initialize SDK and data after model change
        iframe.onload = async () => {
            await initializeSdkAndData();
        };

        showFeedback(modelFeedbackElement, `Model changed to: ${newModelId}`, 'success');
        modelIdInput.value = '';
    });

    // Create Downloadable CSV file from the sweep map table
    document.getElementById('exportCsvButton').addEventListener('click', () => {
        const rows = [['Sweep #', 'Sweep ID', 'Pano ID']];

        for (const currentId in idMap) {
            if (idMap.hasOwnProperty(currentId)) {
                const legacyId = idMap[currentId];
                const label = sweepLabels[currentId] || 'N/A';
                rows.push([label, currentId, legacyId]);
            }
        }

        const csvContent = rows.map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
        const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
        const url = URL.createObjectURL(blob);

        const link = document.createElement('a');
        link.setAttribute('href', url);
        const fileName = `sweep_id_map_${currentModelSid}.csv`;
        link.setAttribute('download', fileName);
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    });

    // Help button functionality
    helpButton.addEventListener('click', () => {
        const helpText = `
            <h3>Sweep ID Tool Help</h3>
            <p><strong>SDK Key:</strong> You need a valid Matterport SDK key to use this tool. Click "Set SDK Key" to enter or update your key.</p>
            <p><strong>Navigate to Location:</strong> Enter either a Sweep ID or a Pano ID to jump to that location in the model.</p>
            <p><strong>Change Model:</strong> Enter a different Matterport Model ID to load a new model.</p>
            <p><strong>Sweep ID Conversion Table:</strong> Shows the relationship between Sweep IDs and Pano IDs. You can export this as a CSV file.</p>
            <p><strong>Current Location:</strong> Shows details about your current position in the model.</p>
        `;
        
        // Create a simple modal
        const modal = document.createElement('div');
        modal.style.position = 'fixed';
        modal.style.top = '0';
        modal.style.left = '0';
        modal.style.width = '100%';
        modal.style.height = '100%';
        modal.style.backgroundColor = 'rgba(0,0,0,0.5)';
        modal.style.display = 'flex';
        modal.style.justifyContent = 'center';
        modal.style.alignItems = 'center';
        modal.style.zIndex = '1000';
        
        const modalContent = document.createElement('div');
        modalContent.style.backgroundColor = 'white';
        modalContent.style.padding = '20px';
        modalContent.style.borderRadius = '8px';
        modalContent.style.maxWidth = '500px';
        modalContent.style.boxShadow = '0 4px 6px rgba(0,0,0,0.1)';
        modalContent.innerHTML = helpText;
        
        const closeButton = document.createElement('button');
        closeButton.textContent = 'Close';
        closeButton.style.backgroundColor = '#14232E';
        closeButton.style.color = 'white';
        closeButton.style.border = 'none';
        closeButton.style.padding = '8px 16px';
        closeButton.style.borderRadius = '4px';
        closeButton.style.marginTop = '15px';
        closeButton.style.cursor = 'pointer';
        
        closeButton.addEventListener('click', () => {
            document.body.removeChild(modal);
        });
        
        modalContent.appendChild(closeButton);
        modal.appendChild(modalContent);
        document.body.appendChild(modal);
    });

    // SDK Key button functionality
    sdkKeyButton.addEventListener('click', () => {
        sdkKeyInput.value = sdkKey || '';
        sdkKeyModal.style.display = "flex";
    });

    // Cancel SDK Key button
    cancelSdkKey.addEventListener('click', () => {
        sdkKeyModal.style.display = "none";
    });

    // Save SDK Key button
    saveSdkKey.addEventListener('click', () => {
        const newSdkKey = sdkKeyInput.value.trim();
        if (newSdkKey) {
            sdkKey = newSdkKey;
            setSdkKeyCookie(sdkKey);
            sdkKeyModal.style.display = "none";
            
            // If showcase is already loaded, refresh it with the new key
            if (iframe.contentWindow) {
                iframe.onload = async () => {
                    await initializeSdkAndData();
                };
                iframe.src = showcaseUrl;
            } else {
                initializeSdkAndData();
            }
            
            showFeedback(feedbackElement, 'SDK Key saved successfully!', 'success');
        } else {
            alert('Please enter a valid SDK Key');
        }
    });
});
