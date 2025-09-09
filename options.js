let blockLists = [];
let currentEditingList = null;
let currentSchedule = { days: [], intervals: [] };
let currentBlockModeSchedule = { enabled: false, days: [], intervals: [] };
let settings = {
    blockingEnabled: true,
    dailyLimit: 60,
    focusDuration: 25,
    stats: { attemptCount: 0, timesSaved: 0 },
    darkMode: true
};

let challengeSettings = {
    challengeType: 'trivia'
};

let triviaSettings = {
    amount: 3,
    category: 'any',
    difficulty: 'medium',
    type: 'multiple',
    unlockDuration: 10
};

document.addEventListener('DOMContentLoaded', function() {
    console.log('DOM loaded, initializing...');
    
    // Debug: Check which key elements exist
    const keyElements = [
        'masterToggle', 'themeToggle', 'activeBlockListSelector', 
        'createNewBlockListFromMain', 'addToActiveBlockList', 
        'configureTimingBtn', 'configureRedirectFromMain', 'toggleAdvanced'
    ];
    
    keyElements.forEach(id => {
        const element = document.getElementById(id);
        console.log(`Element ${id}: ${element ? 'found' : 'NOT FOUND'}`);
    });
    
    initializeNavigation();
    loadAllSettings();
    setupEventListeners();
    setupInAppBlocking();
    loadInsights();
    
    // Initialize new features
    setTimeout(() => {
        initializeUsageLimits();
        initializeInsights();
        initializeDisableBlockingDialog();
    }, 100);
    
    console.log('Initialization complete');
});

function initializeNavigation() {
    const navItems = document.querySelectorAll('.nav-item');
    const sections = document.querySelectorAll('.content-section');
    
    navItems.forEach(item => {
        item.addEventListener('click', () => {
            navItems.forEach(nav => nav.classList.remove('active'));
            sections.forEach(section => section.classList.add('hidden'));
            
            item.classList.add('active');
            const sectionId = item.dataset.section + '-section';
            const targetSection = document.getElementById(sectionId);
            
            if (targetSection) {
                targetSection.classList.remove('hidden');
                targetSection.classList.add('fade-in');
            }
        });
    });
}

function setupEventListeners() {
    console.log('Setting up event listeners...');
    
    // Master toggle
    const masterToggle = document.getElementById('masterToggle');
    if (masterToggle) {
        masterToggle.addEventListener('change', function() {
            if (!this.checked) {
                // User is trying to disable blocking - show dialog
                this.checked = true; // Keep it on until user confirms
                showDisableBlockingDialog();
            } else {
                // User is enabling blocking
                settings.blockingEnabled = true;
                saveSettings();
                console.log('Blocking enabled:', this.checked);
            }
        });
    } else {
        console.error('masterToggle element not found');
    }
    
    // Theme toggle
    const themeToggle = document.getElementById('themeToggle');
    if (themeToggle) {
        themeToggle.addEventListener('click', function() {
            settings.darkMode = !settings.darkMode;
            updateTheme();
            saveSettings();
            console.log('Theme toggled:', settings.darkMode ? 'dark' : 'light');
        });
    } else {
        console.error('themeToggle element not found');
    }
    
    // Optional buttons - these might not exist on all pages
    const createNewBlockListBtn = document.getElementById('createNewBlockListBtn');
    if (createNewBlockListBtn) {
        createNewBlockListBtn.addEventListener('click', createNewBlockList);
    }
    
    const saveUsageBtn = document.getElementById('saveUsageBtn');
    if (saveUsageBtn) {
        saveUsageBtn.addEventListener('click', saveUsageSettings);
    }
    
    const startFocusBtn = document.getElementById('startFocusBtn');
    if (startFocusBtn) {
        startFocusBtn.addEventListener('click', startFocusMode);
    }
    
    const stopFocusBtn = document.getElementById('stopFocusBtn');
    if (stopFocusBtn) {
        stopFocusBtn.addEventListener('click', stopFocusMode);
    }
    
    const saveChallengeBtn = document.getElementById('saveChallengeBtn');
    if (saveChallengeBtn) {
        saveChallengeBtn.addEventListener('click', saveChallengeSettings);
    }
    
    const testTriviaBtn = document.getElementById('testTriviaBtn');
    if (testTriviaBtn) {
        testTriviaBtn.addEventListener('click', testTriviaAPI);
    }
    
    const challengeType = document.getElementById('challengeType');
    if (challengeType) {
        challengeType.addEventListener('change', toggleTriviaSettings);
    }
    
    // Schedule popup listeners
    const closeScheduleBtn = document.getElementById('closeScheduleBtn');
    if (closeScheduleBtn) {
        closeScheduleBtn.addEventListener('click', closeSchedulePopup);
    }
    
    const addTimeBtn = document.getElementById('addTimeBtn');
    if (addTimeBtn) {
        addTimeBtn.addEventListener('click', addNewTimeInterval);
    }
    
    const saveScheduleBtn = document.getElementById('saveScheduleBtn');
    if (saveScheduleBtn) {
        saveScheduleBtn.addEventListener('click', saveSchedule);
    }
    
    const scheduleEnabled = document.getElementById('scheduleEnabled');
    if (scheduleEnabled) {
        scheduleEnabled.addEventListener('change', toggleScheduleContent);
    }
    
    // Redirect dialog event listeners
    const closeRedirectBtn = document.getElementById('closeRedirectBtn');
    if (closeRedirectBtn) {
        closeRedirectBtn.addEventListener('click', closeRedirectPopup);
    }
    
    const redirectType = document.getElementById('redirectType');
    if (redirectType) {
        redirectType.addEventListener('change', updateRedirectPreview);
    }
    
    const customRedirectUrl = document.getElementById('customRedirectUrl');
    if (customRedirectUrl) {
        customRedirectUrl.addEventListener('input', updateRedirectPreview);
    }
    
    const clearRedirectBtn = document.getElementById('clearRedirectBtn');
    if (clearRedirectBtn) {
        clearRedirectBtn.addEventListener('click', clearRedirect);
    }
    
    const saveRedirectBtn = document.getElementById('saveRedirectBtn');
    if (saveRedirectBtn) {
        saveRedirectBtn.addEventListener('click', saveRedirect);
    }
    
    // Add to Block List dialog event listeners
    const addToBlockListBtn = document.getElementById('addToBlockListBtn');
    if (addToBlockListBtn) {
        addToBlockListBtn.addEventListener('click', openAddToBlockPopup);
    }
    
    const closeAddToBlockBtn = document.getElementById('closeAddToBlockBtn');
    if (closeAddToBlockBtn) {
        closeAddToBlockBtn.addEventListener('click', closeAddToBlockPopup);
    }
    
    const websiteSearchInput = document.getElementById('websiteSearchInput');
    if (websiteSearchInput) {
        websiteSearchInput.addEventListener('input', handleSearchInput);
    }
    
    const clearSelectionBtn = document.getElementById('clearSelectionBtn');
    if (clearSelectionBtn) {
        clearSelectionBtn.addEventListener('click', clearSelectedItems);
    }
    
    const addSelectedItemsBtn = document.getElementById('addSelectedItemsBtn');
    if (addSelectedItemsBtn) {
        console.log('addSelectedItemsBtn found, attaching event listener');
        addSelectedItemsBtn.addEventListener('click', addSelectedItemsToBlockList);
    } else {
        console.error('addSelectedItemsBtn not found');
    }
    
    // Main configuration interface
    // activeBlockListSelector removed - functionality moved to dialog system
    
    // createNewBlockListFromMain was removed - functionality moved to dialog
    
    // Remove old schedule configuration buttons - they no longer exist
    
    // List management buttons
    const editActiveListBtn = document.getElementById('editActiveListBtn');
    if (editActiveListBtn) {
        editActiveListBtn.addEventListener('click', openEditListDialog);
    } else {
        console.error('editActiveListBtn not found');
    }
    
    // Block page selector
    const blockPageSelector = document.getElementById('blockPageSelector');
    if (blockPageSelector) {
        blockPageSelector.addEventListener('change', handleBlockPageChange);
    }
    
    const configureBlockPageBtn = document.getElementById('configureBlockPageBtn');
    if (configureBlockPageBtn) {
        configureBlockPageBtn.addEventListener('click', configureBlockPage);
    }
    
    // Bottom block mode controls
    const challengeModeToggleBottom = document.getElementById('challengeModeToggleBottom');
    if (challengeModeToggleBottom) {
        challengeModeToggleBottom.addEventListener('change', handleBlockModeToggleBottom);
    }
    
    const blockModeTimerBtnBottom = document.getElementById('blockModeTimerBtnBottom');
    if (blockModeTimerBtnBottom) {
        blockModeTimerBtnBottom.addEventListener('click', handleTimerButtonClick);
    }
    
    // Removed the left side buttons - no longer needed
    
    // Add time interval button
    const addTimeIntervalBtn = document.getElementById('addTimeIntervalBtn');
    if (addTimeIntervalBtn) {
        addTimeIntervalBtn.addEventListener('click', addTimeInterval);
    }
    
    // Main schedule button
    const configureMainScheduleBtn = document.getElementById('configureMainScheduleBtn');
    if (configureMainScheduleBtn) {
        configureMainScheduleBtn.addEventListener('click', function(e) {
            e.preventDefault();
            e.stopPropagation();
            openMainScheduleDialog();
        });
    } else {
        console.error('configureMainScheduleBtn not found');
    }
    
    // Dialog close buttons
    const closeCustomRedirectBtn = document.getElementById('closeCustomRedirectBtn');
    if (closeCustomRedirectBtn) {
        closeCustomRedirectBtn.addEventListener('click', closeCustomRedirectDialog);
    }
    
    const closeBlockModeTimerBtn = document.getElementById('closeBlockModeTimerBtn');
    if (closeBlockModeTimerBtn) {
        closeBlockModeTimerBtn.addEventListener('click', closeBlockModeTimerDialog);
    }
    
    // Dialog action buttons
    const saveCustomRedirectBtn = document.getElementById('saveCustomRedirectBtn');
    if (saveCustomRedirectBtn) {
        saveCustomRedirectBtn.addEventListener('click', saveCustomRedirect);
    }
    
    const saveBlockModeTimerBtn = document.getElementById('saveBlockModeTimerBtn');
    if (saveBlockModeTimerBtn) {
        saveBlockModeTimerBtn.addEventListener('click', saveBlockModeTimer);
    }
    
    const cancelBlockModeTimerBtn = document.getElementById('cancelBlockModeTimerBtn');
    if (cancelBlockModeTimerBtn) {
        cancelBlockModeTimerBtn.addEventListener('click', closeBlockModeTimerDialog);
    }
    
    const addBlockModeTimeBtn = document.getElementById('addBlockModeTimeBtn');
    if (addBlockModeTimeBtn) {
        addBlockModeTimeBtn.addEventListener('click', addBlockModeTimeInterval);
    }

    // Create list dialog events
    const closeCreateListBtn = document.getElementById('closeCreateListBtn');
    if (closeCreateListBtn) {
        closeCreateListBtn.addEventListener('click', closeCreateListDialog);
    }
    
    const cancelCreateListBtn = document.getElementById('cancelCreateListBtn');
    if (cancelCreateListBtn) {
        cancelCreateListBtn.addEventListener('click', closeCreateListDialog);
    }
    
    const confirmCreateListBtn = document.getElementById('confirmCreateListBtn');
    if (confirmCreateListBtn) {
        confirmCreateListBtn.addEventListener('click', confirmCreateList);
    }
    
    // Edit list dialog events
    const closeEditListBtn = document.getElementById('closeEditListBtn');
    if (closeEditListBtn) {
        closeEditListBtn.addEventListener('click', closeEditListDialog);
    }
    
    const closeEditListActionBtn = document.getElementById('closeEditListActionBtn');
    if (closeEditListActionBtn) {
        closeEditListActionBtn.addEventListener('click', closeEditListDialog);
    }
    
    const renameListAction = document.getElementById('renameListAction');
    if (renameListAction) {
        renameListAction.addEventListener('click', renameActiveList);
    }
    
    const toggleListTypeAction = document.getElementById('toggleListTypeAction');
    if (toggleListTypeAction) {
        toggleListTypeAction.addEventListener('click', toggleActiveListType);
    }
    
    const deleteListAction = document.getElementById('deleteListAction');
    if (deleteListAction) {
        deleteListAction.addEventListener('click', deleteActiveList);
    }
    
    const addToActiveBlockList = document.getElementById('addToActiveBlockList');
    if (addToActiveBlockList) {
        addToActiveBlockList.addEventListener('click', openAddToActiveBlockList);
    } else {
        console.error('addToActiveBlockList not found');
    }
    
    // Collapsible list management interface
    const listManagementHeader = document.getElementById('listManagementHeader');
    if (listManagementHeader) {
        listManagementHeader.addEventListener('click', toggleListManagement);
    }
    
    const deleteActiveListBtn = document.getElementById('deleteActiveListBtn');
    if (deleteActiveListBtn) {
        deleteActiveListBtn.addEventListener('click', deleteCurrentActiveList);
    }
    
    // List management dialog event listeners
    const closeListManagementBtn = document.getElementById('closeListManagementBtn');
    if (closeListManagementBtn) {
        closeListManagementBtn.addEventListener('click', closeListManagementDialog);
    }
    
    const createNewListBtn = document.getElementById('createNewListBtn');
    if (createNewListBtn) {
        createNewListBtn.addEventListener('click', function() {
            closeListManagementDialog();
            openCreateListDialog();
        });
    }
    
    // Main schedule enable/disable toggle
    
    // List type toggle
    const listTypeToggle = document.getElementById('listTypeToggle');
    if (listTypeToggle) {
        listTypeToggle.addEventListener('change', handleListTypeToggle);
    } else {
        console.error('listTypeToggle not found');
    }
    
    // Quick keyword add
    const addKeywordQuickBtn = document.getElementById('addKeywordQuickBtn');
    if (addKeywordQuickBtn) {
        addKeywordQuickBtn.addEventListener('click', addKeywordQuick);
    }
    
    const keywordQuickInput = document.getElementById('keywordQuickInput');
    if (keywordQuickInput) {
        keywordQuickInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addKeywordQuick();
            }
        });
    }
    
    // Block mode selector - removed since it's now handled by left panel toggle
    
    // Block type radio buttons - removed as no longer needed
    
    const keywordInput = document.getElementById('keywordInput');
    if (keywordInput) {
        keywordInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') {
                addKeywordToSelection();
            }
        });
    }
    
    // Day selection for new interface
    const dayCircles = document.querySelectorAll('.day-circle');
    if (dayCircles.length > 0) {
        dayCircles.forEach(circle => {
            circle.addEventListener('click', function() {
                const day = parseInt(this.dataset.day);
                const index = currentSchedule.days.indexOf(day);
                
                if (index === -1) {
                    currentSchedule.days.push(day);
                    this.classList.add('selected');
                } else {
                    currentSchedule.days.splice(index, 1);
                    this.classList.remove('selected');
                }
            });
        });
    }
    
    // Usage Limits event listeners
    const addWebsiteLimitBtn = document.getElementById('addWebsiteLimitBtn');
    if (addWebsiteLimitBtn) {
        addWebsiteLimitBtn.addEventListener('click', addWebsiteLimit);
    }
    
    const addKeywordLimitBtn = document.getElementById('addKeywordLimitBtn');
    if (addKeywordLimitBtn) {
        addKeywordLimitBtn.addEventListener('click', addKeywordLimit);
    }
    
    // Insights event listeners
    const enableHistoryBtn = document.getElementById('enableHistoryBtn');
    if (enableHistoryBtn) {
        enableHistoryBtn.addEventListener('click', requestHistoryPermission);
    }
    
    const dismissHistoryBtn = document.getElementById('dismissHistoryBtn');
    if (dismissHistoryBtn) {
        dismissHistoryBtn.addEventListener('click', dismissHistoryBanner);
    }
    
    const prevMonthBtn = document.getElementById('prevMonth');
    if (prevMonthBtn) {
        prevMonthBtn.addEventListener('click', () => navigateCalendar(-1));
    }
    
    const nextMonthBtn = document.getElementById('nextMonth');
    if (nextMonthBtn) {
        nextMonthBtn.addEventListener('click', () => navigateCalendar(1));
    }
    
    // Disable blocking dialog event listeners
    const disableOptionBtns = document.querySelectorAll('.disable-option-btn');
    disableOptionBtns.forEach(btn => {
        btn.addEventListener('click', function() {
            const duration = parseInt(this.dataset.duration);
            handleDisableBlocking(duration);
        });
    });
    
    const closeDisableBtn = document.getElementById('closeDisableBlockingBtn');
    if (closeDisableBtn) {
        closeDisableBtn.addEventListener('click', hideDisableBlockingDialog);
    }
    
    const cancelDisableBtn = document.getElementById('cancelDisableBlockingBtn');
    if (cancelDisableBtn) {
        cancelDisableBtn.addEventListener('click', hideDisableBlockingDialog);
    }
    
    console.log('Event listeners setup complete');
}

async function loadAllSettings() {
    try {
        const result = await chrome.storage.sync.get(['blockLists', 'settings', 'challengeSettings', 'triviaSettings']);
        
        if (result.blockLists && Array.isArray(result.blockLists)) {
            blockLists = result.blockLists;
            
            // Migrate old single schedule format to dual schedule format
            blockLists.forEach(list => {
                // Ensure dual schedules exist
                if (!list.strictSchedule && !list.challengeSchedule) {
                    // If old single schedule exists, use it as basis for strict schedule
                    if (list.schedule) {
                        list.strictSchedule = {
                            enabled: list.schedule.enabled || false,
                            days: list.schedule.days || [0, 1, 2, 3, 4, 5, 6],
                            intervals: list.schedule.intervals || [{ start: '09:00', end: '17:00' }]
                        };
                        list.challengeSchedule = { 
                            enabled: false,
                            days: [0, 1, 2, 3, 4, 5, 6],
                            intervals: [{ start: '18:00', end: '22:00' }] 
                        };
                    } else {
                        // No existing schedule, create defaults
                        list.strictSchedule = { 
                            enabled: false,
                            days: [0, 1, 2, 3, 4, 5, 6],
                            intervals: [{ start: '09:00', end: '17:00' }] 
                        };
                        list.challengeSchedule = { 
                            enabled: false,
                            days: [0, 1, 2, 3, 4, 5, 6],
                            intervals: [{ start: '18:00', end: '22:00' }] 
                        };
                        // Keep old schedule for backward compatibility
                        list.schedule = { enabled: false, days: [], intervals: [] };
                    }
                }
            });
        } else {
            blockLists = [{
                id: 'default',
                name: 'Default Block List',
                websites: [],
                strictSchedule: { 
                    enabled: false,
                    days: [0, 1, 2, 3, 4, 5, 6],
                    intervals: [{ start: '09:00', end: '17:00' }] 
                },
                challengeSchedule: { 
                    enabled: false,
                    days: [0, 1, 2, 3, 4, 5, 6],
                    intervals: [{ start: '18:00', end: '22:00' }] 
                },
                blockPolicy: 'strict',
                customRedirect: '',
                enabled: true,
                listType: 'block'
            }];
            await saveBlockLists();
        }
        
        if (result.settings) {
            settings = { ...settings, ...result.settings };
        }
        
        if (result.challengeSettings) {
            challengeSettings = { ...challengeSettings, ...result.challengeSettings };
        }
        
        if (result.triviaSettings) {
            triviaSettings = { ...triviaSettings, ...result.triviaSettings };
        }
        
        // Set values safely with null checks
        const masterToggle = document.getElementById('masterToggle');
        if (masterToggle) {
            masterToggle.checked = settings.blockingEnabled;
        }
        
        const dailyLimit = document.getElementById('dailyLimit');
        if (dailyLimit) {
            dailyLimit.value = settings.dailyLimit;
        }
        
        const focusDuration = document.getElementById('focusDuration');
        if (focusDuration) {
            focusDuration.value = settings.focusDuration;
        }
        
        // Load challenge settings safely
        const challengeTypeSelect = document.getElementById('challengeType');
        if (challengeTypeSelect) {
            challengeTypeSelect.value = challengeSettings.challengeType;
        }
        
        const triviaAmount = document.getElementById('triviaAmount');
        if (triviaAmount) {
            triviaAmount.value = triviaSettings.amount;
        }
        
        const triviaCategory = document.getElementById('triviaCategory');
        if (triviaCategory) {
            triviaCategory.value = triviaSettings.category;
        }
        
        const triviaDifficulty = document.getElementById('triviaDifficulty');
        if (triviaDifficulty) {
            triviaDifficulty.value = triviaSettings.difficulty;
        }
        
        const triviaType = document.getElementById('triviaType');
        if (triviaType) {
            triviaType.value = triviaSettings.type;
        }
        
        const unlockDuration = document.getElementById('unlockDuration');
        if (unlockDuration) {
            unlockDuration.value = triviaSettings.unlockDuration;
        }
        
        updateTheme();
        setupMainConfigInterface();
        toggleTriviaSettings();
        
    } catch (error) {
        console.error('Error loading settings:', error);
        console.error('Error details:', error.message, error.stack);
        showStatus(`Error loading settings: ${error.message}`, 'error');
        
        // Still try to initialize with defaults
        if (!blockLists || blockLists.length === 0) {
            console.log('Initializing with default block list due to error');
            blockLists = [{
                id: 'default',
                name: 'Default Block List',
                websites: [],
                strictSchedule: { 
                    enabled: false,
                    days: [0, 1, 2, 3, 4, 5, 6],
                    intervals: [{ start: '09:00', end: '17:00' }] 
                },
                challengeSchedule: { 
                    enabled: false,
                    days: [0, 1, 2, 3, 4, 5, 6],
                    intervals: [{ start: '18:00', end: '22:00' }] 
                },
                blockPolicy: 'strict',
                customRedirect: '',
                enabled: true,
                listType: 'block'
            }];
        }
        setupMainConfigInterface();
    }
}

function displayBlockLists() {
    console.log('displayBlockLists called - this should update the list management dialog');
    populateListManagementDialog();
}

function createInlineEditForm(list, index) {
    return `
        <div class="inline-form">
            <div class="form-row">
                <div class="form-group">
                    <label>List Name</label>
                    <input type="text" class="input-field" id="inline-name-${index}" value="${list.name}" placeholder="List Name">
                </div>
                <div class="form-group">
                    <label>Block Policy</label>
                    <select class="input-field" id="inline-policy-${index}" data-action="policy-change" data-index="${index}">
                        <option value="strict" ${list.blockPolicy === 'strict' ? 'selected' : ''}>Strict Block</option>
                        <option value="difficult" ${list.blockPolicy === 'difficult' ? 'selected' : ''}>Make it Harder</option>
                        <option value="scheduled" ${list.blockPolicy === 'scheduled' ? 'selected' : ''}>Scheduled Policy</option>
                    </select>
                </div>
            </div>

            <div class="form-group">
                <label>Custom Redirect Page</label>
                <button class="btn btn-secondary" data-action="configure-redirect" data-index="${index}" style="width: 100%; text-align: left;">
                    🔗 ${list.customRedirect ? 'Edit Custom Redirect' : 'Configure Custom Redirect'}
                </button>
            </div>
            
            <div class="policy-schedule" id="policy-schedule-${index}" style="display: ${list.blockPolicy === 'scheduled' ? 'block' : 'none'};">
                <div class="form-group">
                    <label>Strict Mode Schedule</label>
                    <div class="schedule-config">
                        <div class="time-range">
                            <input type="time" class="time-input" id="strict-start-${index}" value="${list.strictSchedule?.start || '09:00'}">
                            <span style="color: white; margin: 0 10px;">to</span>
                            <input type="time" class="time-input" id="strict-end-${index}" value="${list.strictSchedule?.end || '17:00'}">
                        </div>
                        <small style="color: rgba(255,255,255,0.7); display: block; margin-top: 5px;">
                            During these hours, strict blocking applies (no challenges allowed)
                        </small>
                    </div>
                </div>
                
                <div style="background: rgba(33, 150, 243, 0.2); border: 1px solid rgba(33, 150, 243, 0.5); border-radius: 8px; padding: 15px; margin-top: 15px;">
                    <strong style="color: #64B5F6;">ℹ️ Challenge Mode</strong><br>
                    <small style="color: rgba(255,255,255,0.8); font-size: 0.85em;">
                        All times outside the strict schedule will use challenge mode, where users can complete trivia questions to gain temporary access.
                    </small>
                </div>
            </div>
            
            <div class="form-row">
                <div class="form-group">
                    <label>Add Website</label>
                    <input type="text" class="input-field" id="inline-website-${index}" placeholder="example.com">
                </div>
                <button class="btn btn-primary btn-small" data-action="add-website" data-index="${index}" style="height: 42px;">Add</button>
            </div>
            
            <div class="inline-website-list" id="inline-websites-${index}">
                ${list.websites.map((website, webIndex) => 
                    `<div class="website-item">
                        <span>${sanitizeText(website)}</span>
                        <button class="btn btn-danger btn-small" data-action="remove-website" data-index="${index}" data-web-index="${webIndex}">×</button>
                    </div>`
                ).join('')}
            </div>
            
            <div class="form-row">
                <button class="btn btn-secondary btn-small" data-action="configure-schedule" data-index="${index}">📅 Set Schedule</button>
                <button class="btn btn-primary" data-action="save-list" data-index="${index}">Save Changes</button>
                <button class="btn btn-danger" data-action="delete-list" data-index="${index}">Delete List</button>
            </div>
        </div>
    `;
}

function createNewBlockList() {
    // Open the create list dialog
    openCreateListDialog();
}

function openCreateListDialog() {
    // Reset the form
    const nameInput = document.getElementById('newListName');
    const blockRadio = document.querySelector('input[name="newListType"][value="block"]');
    
    if (nameInput) nameInput.value = '';
    if (blockRadio) blockRadio.checked = true;
    
    // Show dialog
    const dialog = document.getElementById('createListDialog');
    if (dialog) {
        dialog.style.display = 'flex';
        // Focus on name input
        setTimeout(() => {
            if (nameInput) nameInput.focus();
        }, 100);
    }
}

function closeCreateListDialog() {
    const dialog = document.getElementById('createListDialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

function confirmCreateList() {
    const nameInput = document.getElementById('newListName');
    const listName = nameInput?.value.trim();
    
    if (!listName) {
        alert('Please enter a name for the list.');
        if (nameInput) nameInput.focus();
        return;
    }
    
    // Check if name already exists
    if (blockLists.some(list => list.name.toLowerCase() === listName.toLowerCase())) {
        alert('A list with this name already exists. Please choose a different name.');
        if (nameInput) nameInput.focus();
        return;
    }
    
    // Create the new list
    const newList = {
        id: 'list_' + Date.now(),
        name: listName,
        websites: [],
        strictSchedule: { 
            enabled: false,
            days: [0, 1, 2, 3, 4, 5, 6],
            intervals: [{ start: '09:00', end: '17:00' }] 
        },
        challengeSchedule: { 
            enabled: false,
            days: [0, 1, 2, 3, 4, 5, 6],
            intervals: [{ start: '18:00', end: '22:00' }] 
        },
        blockPolicy: 'strict',
        customRedirect: '',
        enabled: true,
        listType: 'block'
    };
    
    blockLists.push(newList);
    
    // Update the interface
    currentActiveListIndex = blockLists.length - 1;
    setupMainConfigInterface();
    updateMainConfigDisplay();
    saveBlockLists();
    
    // Close dialog
    closeCreateListDialog();
    
    console.log('Created new list:', listName, 'Type:', listType);
}

function toggleEditBlockList(index) {
    const content = document.getElementById(`block-list-content-${index}`);
    const editBtn = document.querySelector(`#block-list-${index} .btn:first-of-type`);
    const blockListContainer = document.getElementById('blockLists');
    const blockListItem = document.getElementById(`block-list-${index}`);
    
    if (content.classList.contains('expanded')) {
        content.classList.remove('expanded');
        editBtn.textContent = 'Edit';
        blockListContainer.classList.remove('editing');
        blockListItem.classList.remove('editing');
    } else {
        // Close all other expanded lists
        document.querySelectorAll('.block-list-content.expanded').forEach(el => {
            el.classList.remove('expanded');
        });
        document.querySelectorAll('.block-list-item .btn:first-of-type').forEach(btn => {
            btn.textContent = 'Edit';
        });
        blockListContainer.classList.remove('editing');
        document.querySelectorAll('.block-list-item').forEach(item => {
            item.classList.remove('editing');
        });
        
        content.classList.add('expanded');
        editBtn.textContent = 'Close';
        blockListContainer.classList.add('editing');
        blockListItem.classList.add('editing');
        
        // Setup event listeners for inline form
        setupInlineEventListeners(index);
    }
}

function setupInlineEventListeners(index) {
    // Add website functionality
    const addBtn = document.querySelector(`[data-action="add-website"][data-index="${index}"]`);
    const websiteInput = document.getElementById(`inline-website-${index}`);
    
    addBtn.addEventListener('click', () => addWebsiteInline(index));
    websiteInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') addWebsiteInline(index);
    });
    
    // Remove website buttons
    document.querySelectorAll(`[data-action="remove-website"][data-index="${index}"]`).forEach(btn => {
        btn.addEventListener('click', () => {
            const webIndex = parseInt(btn.dataset.webIndex);
            removeWebsiteInline(index, webIndex);
        });
    });
    
    // Policy change handler
    document.querySelector(`[data-action="policy-change"][data-index="${index}"]`)
        .addEventListener('change', () => togglePolicySchedule(index));
    
    // Other action buttons
    document.querySelector(`[data-action="configure-schedule"][data-index="${index}"]`)
        .addEventListener('click', () => openScheduleForList(index));
    document.querySelector(`[data-action="configure-redirect"][data-index="${index}"]`)
        .addEventListener('click', () => openRedirectForList(index));
    document.querySelector(`[data-action="save-list"][data-index="${index}"]`)
        .addEventListener('click', () => saveInlineBlockList(index));
    document.querySelector(`[data-action="delete-list"][data-index="${index}"]`)
        .addEventListener('click', () => deleteBlockList(index));
}

function addWebsiteInline(index) {
    const input = document.getElementById(`inline-website-${index}`);
    const website = input.value.trim().toLowerCase();
    
    if (!website) {
        showStatus('Please enter a website URL', 'error');
        return;
    }
    
    const cleanWebsite = website.replace(/^https?:\/\//, '').replace(/^www\./, '');
    
    if (!isValidUrl(cleanWebsite)) {
        showStatus('Please enter a valid website URL', 'error');
        return;
    }
    
    if (blockLists[index].websites.includes(cleanWebsite)) {
        showStatus('Website already in this list', 'error');
        return;
    }
    
    blockLists[index].websites.push(cleanWebsite);
    input.value = '';
    
    // Refresh the website list display
    const websiteContainer = document.getElementById(`inline-websites-${index}`);
    websiteContainer.innerHTML = blockLists[index].websites.map((website, webIndex) => 
        `<div class="website-item">
            <span>${sanitizeText(website)}</span>
            <button class="btn btn-danger btn-small" data-action="remove-website" data-index="${index}" data-web-index="${webIndex}">×</button>
        </div>`
    ).join('');
    
    // Re-setup event listeners for new remove buttons
    websiteContainer.querySelectorAll('[data-action="remove-website"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const webIndex = parseInt(btn.dataset.webIndex);
            removeWebsiteInline(index, webIndex);
        });
    });
    
    showStatus('Website added successfully', 'success');
}

function removeWebsiteInline(index, webIndex) {
    blockLists[index].websites.splice(webIndex, 1);
    
    // Refresh the website list display
    const websiteContainer = document.getElementById(`inline-websites-${index}`);
    websiteContainer.innerHTML = blockLists[index].websites.map((website, webIndex) => 
        `<div class="website-item">
            <span>${sanitizeText(website)}</span>
            <button class="btn btn-danger btn-small" data-action="remove-website" data-index="${index}" data-web-index="${webIndex}">×</button>
        </div>`
    ).join('');
    
    // Re-setup event listeners for remove buttons
    websiteContainer.querySelectorAll('[data-action="remove-website"]').forEach(btn => {
        btn.addEventListener('click', () => {
            const webIndex = parseInt(btn.dataset.webIndex);
            removeWebsiteInline(index, webIndex);
        });
    });
    
    showStatus('Website removed', 'success');
}

function togglePolicySchedule(index) {
    const policySelect = document.getElementById(`inline-policy-${index}`);
    const scheduleDiv = document.getElementById(`policy-schedule-${index}`);
    
    if (policySelect.value === 'scheduled') {
        scheduleDiv.style.display = 'block';
    } else {
        scheduleDiv.style.display = 'none';
    }
}

function saveInlineBlockList(index) {
    const list = blockLists[index];
    list.name = document.getElementById(`inline-name-${index}`).value || 'Unnamed List';
    list.blockPolicy = document.getElementById(`inline-policy-${index}`).value;
    
    // Save scheduled policy times if applicable
    if (list.blockPolicy === 'scheduled') {
        list.strictSchedule = {
            start: document.getElementById(`strict-start-${index}`).value || '09:00',
            end: document.getElementById(`strict-end-${index}`).value || '17:00'
        };
        // Remove any existing difficult schedule since it's no longer used
        delete list.difficultSchedule;
    }
    
    saveBlockLists();
    displayBlockLists();
    showStatus('Block list saved successfully', 'success');
}

function openScheduleForList(index) {
    currentEditingList = index;
    openSchedulePopup();
}

function deleteBlockList(index) {
    if (blockLists.length <= 1) {
        showStatus('Cannot delete the last block list', 'error');
        return;
    }
    
    if (confirm('Are you sure you want to delete this block list?')) {
        blockLists.splice(index, 1);
        saveBlockLists();
        displayBlockLists();
        showStatus('Block list deleted', 'success');
    }
}



function toggleBlockList(index) {
    blockLists[index].enabled = !blockLists[index].enabled;
    saveBlockLists();
    displayBlockLists();
    showStatus(`Block list ${blockLists[index].enabled ? 'enabled' : 'disabled'}`, 'success');
}

function openSchedulePopup() {
    if (currentEditingList === null) return;
    
    const list = blockLists[currentEditingList];
    
    // Handle both old single schedule and new dual schedule systems
    if (!list.schedule && !list.strictSchedule && !list.challengeSchedule) {
        // Initialize default schedules if none exist
        list.schedule = { enabled: false, days: [] };
    }
    
    // Ensure backward compatibility for existing lists
    if (list.schedule) {
        if (typeof list.schedule.enabled === 'undefined') {
            list.schedule.enabled = false;
        }
        if (!list.schedule.days) {
            list.schedule.days = [];
        }
        if (!list.schedule.intervals) {
            list.schedule.intervals = [];
        }
        currentSchedule = { 
            enabled: list.schedule.enabled,
            days: [...list.schedule.days], 
            intervals: [...list.schedule.intervals] 
        };
    }
    
    // Set the schedule enabled toggle
    document.getElementById('scheduleEnabled').checked = currentSchedule.enabled;
    
    // Update day selection for new interface
    document.querySelectorAll('.day-circle').forEach(circle => {
        const day = parseInt(circle.dataset.day);
        if (currentSchedule.days.includes(day)) {
            circle.classList.add('selected');
        } else {
            circle.classList.remove('selected');
        }
    });
    
    updateTimeIntervalsList();
    toggleScheduleContent(); // Update the UI based on enabled state
    document.getElementById('schedulePopup').style.display = 'flex';
}

function closeSchedulePopup() {
    document.getElementById('schedulePopup').style.display = 'none';
}


function addNewTimeInterval() {
    const startInput = document.getElementById('newIntervalStart');
    const endInput = document.getElementById('newIntervalEnd');
    
    const start = startInput.value;
    const end = endInput.value;
    
    if (!start || !end) {
        showStatus('Please set both start and end times', 'error');
        return;
    }
    
    if (start >= end) {
        showStatus('Start time must be before end time', 'error');
        return;
    }
    
    // Check for overlapping intervals
    const newStartMinutes = timeToMinutes(start);
    const newEndMinutes = timeToMinutes(end);
    
    const hasOverlap = currentSchedule.intervals.some(interval => {
        const existingStart = timeToMinutes(interval.start);
        const existingEnd = timeToMinutes(interval.end);
        
        return (newStartMinutes < existingEnd && newEndMinutes > existingStart);
    });
    
    if (hasOverlap) {
        showStatus('Time interval overlaps with existing interval', 'error');
        return;
    }
    
    currentSchedule.intervals.push({ start, end });
    updateTimeIntervalsList();
    
    // Reset inputs
    startInput.value = '09:00';
    endInput.value = '17:00';
    
    showStatus('Time interval added', 'success');
}

function removeTimeInterval(index) {
    currentSchedule.intervals.splice(index, 1);
    updateTimeIntervalsList();
    showStatus('Time interval removed', 'success');
}

function timeToMinutes(timeString) {
    const [hours, minutes] = timeString.split(':').map(Number);
    return hours * 60 + minutes;
}

function toggleScheduleContent() {
    const enabled = document.getElementById('scheduleEnabled').checked;
    const scheduleContent = document.getElementById('scheduleContent');
    const statusText = document.getElementById('scheduleStatusText');
    
    currentSchedule.enabled = enabled;
    
    if (enabled) {
        scheduleContent.classList.remove('disabled');
        statusText.textContent = '✅ Enabled';
        statusText.style.color = 'rgba(34, 197, 94, 0.9)';
    } else {
        scheduleContent.classList.add('disabled');
        statusText.textContent = '❌ Disabled';
        statusText.style.color = 'rgba(240, 246, 252, 0.6)';
    }
}

function saveSchedule() {
    if (currentEditingList === null) return;
    
    blockLists[currentEditingList].schedule = {
        enabled: currentSchedule.enabled,
        days: [...currentSchedule.days],
        intervals: [...currentSchedule.intervals]
    };
    
    saveBlockLists();
    displayBlockLists();
    closeSchedulePopup();
    showStatus('Schedule saved successfully', 'success');
}

// Redirect dialog functions
let currentEditingRedirect = null;

function openRedirectForList(index) {
    currentEditingRedirect = index;
    openRedirectPopup();
}

function openRedirectPopup() {
    if (currentEditingRedirect === null) return;
    
    const list = blockLists[currentEditingRedirect];
    const redirectUrl = list.customRedirect || '';
    
    // Determine redirect type based on current value
    let redirectType = 'default';
    if (redirectUrl) {
        if (redirectUrl === 'about:blank') {
            redirectType = 'blank';
        } else if (redirectUrl === 'homepage') {
            redirectType = 'homepage';
        } else if (redirectUrl.startsWith('http')) {
            redirectType = 'custom';
        }
    }
    
    // Set form values
    document.getElementById('redirectType').value = redirectType;
    document.getElementById('customRedirectUrl').value = redirectType === 'custom' ? redirectUrl : '';
    
    // Update UI and preview
    updateRedirectPreview();
    document.getElementById('redirectPopup').style.display = 'flex';
}

function closeRedirectPopup() {
    document.getElementById('redirectPopup').style.display = 'none';
    currentEditingRedirect = null;
}

function updateRedirectPreview() {
    const redirectType = document.getElementById('redirectType').value;
    const customUrl = document.getElementById('customRedirectUrl').value;
    const customUrlSection = document.getElementById('customUrlSection');
    const previewText = document.getElementById('previewText');
    
    // Show/hide custom URL section
    if (redirectType === 'custom') {
        customUrlSection.style.display = 'block';
    } else {
        customUrlSection.style.display = 'none';
    }
    
    // Update preview text
    switch (redirectType) {
        case 'default':
            previewText.textContent = 'Default block page will be used';
            break;
        case 'custom':
            if (customUrl) {
                previewText.textContent = customUrl;
            } else {
                previewText.textContent = 'Enter a custom URL above';
            }
            break;
        case 'blank':
            previewText.textContent = 'about:blank (blank page)';
            break;
        case 'homepage':
            previewText.textContent = 'Browser homepage will be used';
            break;
    }
}

function clearRedirect() {
    document.getElementById('redirectType').value = 'default';
    document.getElementById('customRedirectUrl').value = '';
    updateRedirectPreview();
}

function saveRedirect() {
    if (currentEditingRedirect === null) return;
    
    const redirectType = document.getElementById('redirectType').value;
    const customUrl = document.getElementById('customRedirectUrl').value;
    let redirectValue = '';
    
    switch (redirectType) {
        case 'custom':
            if (!customUrl) {
                showStatus('Please enter a custom URL', 'error');
                return;
            }
            if (!customUrl.startsWith('http://') && !customUrl.startsWith('https://')) {
                showStatus('Custom URL must start with http:// or https://', 'error');
                return;
            }
            redirectValue = customUrl;
            break;
        case 'blank':
            redirectValue = 'about:blank';
            break;
        case 'homepage':
            redirectValue = 'homepage';
            break;
        case 'default':
        default:
            redirectValue = '';
            break;
    }
    
    blockLists[currentEditingRedirect].customRedirect = redirectValue;
    saveBlockLists();
    displayBlockLists();
    closeRedirectPopup();
    showStatus('Redirect configuration saved', 'success');
}

// Add to Block List dialog functions
let selectedItems = [];
let searchTimeout = null;

// Common website suggestions
const popularWebsites = [
    { name: 'YouTube', domain: 'youtube.com', category: 'Video' },
    { name: 'Facebook', domain: 'facebook.com', category: 'Social' },
    { name: 'Instagram', domain: 'instagram.com', category: 'Social' },
    { name: 'Twitter/X', domain: 'twitter.com', category: 'Social' },
    { name: 'TikTok', domain: 'tiktok.com', category: 'Social' },
    { name: 'Reddit', domain: 'reddit.com', category: 'Social' },
    { name: 'LinkedIn', domain: 'linkedin.com', category: 'Professional' },
    { name: 'Netflix', domain: 'netflix.com', category: 'Entertainment' },
    { name: 'Amazon', domain: 'amazon.com', category: 'Shopping' },
    { name: 'eBay', domain: 'ebay.com', category: 'Shopping' },
    { name: 'Pinterest', domain: 'pinterest.com', category: 'Social' },
    { name: 'Discord', domain: 'discord.com', category: 'Communication' },
    { name: 'Twitch', domain: 'twitch.tv', category: 'Gaming' },
    { name: 'Steam', domain: 'store.steampowered.com', category: 'Gaming' },
    { name: 'ESPN', domain: 'espn.com', category: 'Sports' },
    { name: 'CNN', domain: 'cnn.com', category: 'News' },
    { name: 'BBC', domain: 'bbc.com', category: 'News' },
    { name: 'Wikipedia', domain: 'wikipedia.org', category: 'Reference' }
];

function openAddToBlockPopup() {
    openAddToBlockForList(0); // Default to first list
}

function openAddToBlockForList(listIndex) {
    console.log('openAddToBlockForList called with listIndex:', listIndex);
    console.log('Setting currentActiveListIndex to:', listIndex);
    
    // Set the current active list context
    currentActiveListIndex = listIndex;
    
    // Reset form
    selectedItems = [];
    console.log('Reset selectedItems array');
    
    const websiteSearchInput = document.getElementById('websiteSearchInput');
    const keywordQuickInput = document.getElementById('keywordQuickInput');
    const searchSuggestions = document.getElementById('searchSuggestions');
    
    console.log('Form elements found:', {
        websiteSearchInput: !!websiteSearchInput,
        keywordQuickInput: !!keywordQuickInput,
        searchSuggestions: !!searchSuggestions
    });
    
    if (websiteSearchInput) websiteSearchInput.value = '';
    if (keywordQuickInput) keywordQuickInput.value = '';
    if (searchSuggestions) searchSuggestions.style.display = 'none';
    
    updateSelectedItemsDisplay();
    updateAddDialogText();
    
    const popup = document.getElementById('addToBlockPopup');
    console.log('addToBlockPopup found:', !!popup);
    
    if (popup) {
        popup.style.display = 'flex';
        console.log('Popup made visible');
    } else {
        console.error('addToBlockPopup element not found');
    }
}

function closeAddToBlockPopup() {
    console.log('Closing add to block popup');
    const popup = document.getElementById('addToBlockPopup');
    if (popup) {
        popup.style.display = 'none';
    }
    selectedItems = [];
    updateSelectedItemsDisplay();
}

function handleSearchInput(e) {
    const query = e.target.value.trim();
    
    // Clear previous timeout
    if (searchTimeout) {
        clearTimeout(searchTimeout);
    }
    
    if (query.length === 0) {
        document.getElementById('searchSuggestions').style.display = 'none';
        return;
    }
    
    // Debounce search
    searchTimeout = setTimeout(() => {
        showSearchSuggestions(query);
    }, 300);
}

function showSearchSuggestions(query) {
    console.log('showSearchSuggestions called with query:', query);
    
    const suggestionsContainer = document.getElementById('searchSuggestions');
    console.log('searchSuggestions container found:', !!suggestionsContainer);
    
    if (!suggestionsContainer) {
        console.error('searchSuggestions container not found');
        return;
    }
    
    suggestionsContainer.innerHTML = '';
    
    // Filter popular websites based on query
    const filteredSuggestions = popularWebsites.filter(site => 
        site.name.toLowerCase().includes(query.toLowerCase()) ||
        site.domain.toLowerCase().includes(query.toLowerCase()) ||
        site.category.toLowerCase().includes(query.toLowerCase())
    );
    
    console.log('Filtered suggestions:', filteredSuggestions.length, 'results');
    
    // Add direct URL/domain suggestion if it looks like a URL
    const urlRegex = /^[a-zA-Z0-9][a-zA-Z0-9-]{1,61}[a-zA-Z0-9]\.[a-zA-Z]{2,}$/;
    const domainRegex = /^[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/;
    
    if (domainRegex.test(query) || query.startsWith('http')) {
        const cleanDomain = query.replace(/^https?:\/\//, '').replace(/^www\./, '').split('/')[0];
        filteredSuggestions.unshift({
            name: cleanDomain,
            domain: cleanDomain,
            category: 'Direct Entry',
            isDirect: true
        });
    }
    
    if (filteredSuggestions.length > 0) {
        console.log('Displaying suggestions for:', filteredSuggestions.slice(0, 8).map(s => s.name));
        filteredSuggestions.slice(0, 8).forEach(site => {
            const item = createSuggestionItem(site);
            suggestionsContainer.appendChild(item);
        });
        
        suggestionsContainer.style.display = 'block';
        console.log('Suggestions container made visible');
    } else {
        console.log('No suggestions found, hiding container');
        suggestionsContainer.style.display = 'none';
    }
}

function createSuggestionItem(site) {
    const item = document.createElement('div');
    item.className = 'suggestion-item';
    item.addEventListener('click', () => addWebsiteToSelection(site));
    
    const logo = document.createElement('div');
    logo.className = 'suggestion-logo';
    
    // Try to load favicon
    const favicon = document.createElement('img');
    favicon.src = `https://www.google.com/s2/favicons?sz=32&domain=${site.domain}`;
    favicon.width = 20;
    favicon.height = 20;
    favicon.style.borderRadius = '2px';
    favicon.onerror = () => {
        // Fallback to emoji based on category
        const categoryEmojis = {
            'Social': '👥',
            'Video': '🎥',
            'Gaming': '🎮',
            'News': '📰',
            'Shopping': '🛒',
            'Entertainment': '🎭',
            'Sports': '⚽',
            'Professional': '💼',
            'Communication': '💬',
            'Reference': '📚',
            'Direct Entry': '🌐'
        };
        logo.textContent = categoryEmojis[site.category] || '🌐';
    };
    logo.appendChild(favicon);
    
    const content = document.createElement('div');
    content.className = 'suggestion-content';
    
    const title = document.createElement('div');
    title.className = 'suggestion-title';
    title.textContent = site.name;
    
    const url = document.createElement('div');
    url.className = 'suggestion-url';
    url.textContent = site.domain;
    
    content.appendChild(title);
    content.appendChild(url);
    
    item.appendChild(logo);
    item.appendChild(content);
    
    return item;
}

function addWebsiteToSelection(site) {
    console.log('addWebsiteToSelection called with:', site);
    
    // Check if already selected
    const exists = selectedItems.some(item => 
        item.type === 'website' && item.domain === site.domain
    );
    
    console.log('Site already exists in selection:', exists);
    
    if (!exists) {
        selectedItems.push({
            type: 'website',
            name: site.name,
            domain: site.domain,
            category: site.category
        });
        
        console.log('Added site to selection. selectedItems now:', selectedItems);
        updateSelectedItemsDisplay();
        document.getElementById('websiteSearchInput').value = '';
        document.getElementById('searchSuggestions').style.display = 'none';
    } else {
        console.log('Site already in selection, not adding:', site.domain);
    }
}

// New functions for enhanced schedule and list management

function openEditListDialog() {
    const activeList = blockLists[currentActiveListIndex];
    if (!activeList) return;
    
    // Update dialog content
    const icon = document.getElementById('editListIcon');
    const title = document.getElementById('editListTitle');
    const stats = document.getElementById('editListStats');
    
    if (icon) icon.textContent = activeList.listType === 'allow' ? '✅' : '🚫';
    if (title) title.textContent = activeList.name;
    if (stats) {
        const itemCount = activeList.websites.length;
        const itemText = itemCount === 1 ? 'item' : 'items';
        const typeText = activeList.listType === 'allow' ? 'allowed' : 'blocked';
        stats.textContent = `${itemCount} ${itemText} ${typeText}`;
    }
    
    // Show dialog
    const dialog = document.getElementById('editListDialog');
    if (dialog) {
        dialog.style.display = 'flex';
    }
}

function closeEditListDialog() {
    const dialog = document.getElementById('editListDialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

function renameActiveList() {
    const activeList = blockLists[currentActiveListIndex];
    if (!activeList) return;
    
    const newName = prompt('Enter new name for the list:', activeList.name);
    if (newName && newName.trim() && newName.trim() !== activeList.name) {
        // Check if name already exists
        const trimmedName = newName.trim();
        if (blockLists.some((list, index) => 
            index !== currentActiveListIndex && 
            list.name.toLowerCase() === trimmedName.toLowerCase()
        )) {
            alert('A list with this name already exists. Please choose a different name.');
            return;
        }
        
        activeList.name = trimmedName;
        saveBlockLists();
        setupMainConfigInterface();
        updateMainConfigDisplay();
        updateListManagementHeader();
        
        // Update edit dialog if it's open
        const title = document.getElementById('editListTitle');
        if (title) title.textContent = trimmedName;
        
        console.log('Renamed list to:', trimmedName);
    }
}

function toggleActiveListType() {
    const activeList = blockLists[currentActiveListIndex];
    if (!activeList) return;
    
    const newType = activeList.listType === 'block' ? 'allow' : 'block';
    const confirmMessage = `Change this from a ${activeList.listType} list to an ${newType} list?\n\nThis will change how the items in this list are treated.`;
    
    if (confirm(confirmMessage)) {
        activeList.listType = newType;
        saveBlockLists();
        updateMainConfigDisplay();
        
        // Update edit dialog if it's open
        const icon = document.getElementById('editListIcon');
        const stats = document.getElementById('editListStats');
        
        if (icon) icon.textContent = newType === 'allow' ? '✅' : '🚫';
        if (stats) {
            const itemCount = activeList.websites.length;
            const itemText = itemCount === 1 ? 'item' : 'items';
            const typeText = newType === 'allow' ? 'allowed' : 'blocked';
            stats.textContent = `${itemCount} ${itemText} ${typeText}`;
        }
        
        console.log('Changed list type to:', newType);
    }
}

function deleteActiveList() {
    if (blockLists.length <= 1) {
        alert('Cannot delete the last remaining list.');
        return;
    }
    
    const activeList = blockLists[currentActiveListIndex];
    if (!activeList) return;
    
    if (confirm(`Are you sure you want to delete "${activeList.name}"? This action cannot be undone.`)) {
        blockLists.splice(currentActiveListIndex, 1);
        
        // Adjust current index if needed
        if (currentActiveListIndex >= blockLists.length) {
            currentActiveListIndex = blockLists.length - 1;
        }
        
        saveBlockLists();
        setupMainConfigInterface();
        updateMainConfigDisplay();
        
        // Close the edit dialog
        closeEditListDialog();
        
        console.log('Deleted list:', activeList.name);
    }
}

function configureSchedule(scheduleType) {
    // Open schedule popup with context for strict or challenge schedule
    currentScheduleType = scheduleType;
    const activeList = blockLists[currentActiveListIndex];
    
    if (!activeList) return;
    
    const scheduleData = scheduleType === 'strict' ? activeList.strictSchedule : activeList.challengeSchedule;
    
    // Set up the schedule popup with current data
    setupSchedulePopup(scheduleData, scheduleType);
    document.getElementById('schedulePopup').style.display = 'flex';
}

function updateScheduleDisplays() {
    updateStrictScheduleInfo();
    updateChallengeScheduleInfo();
}

function updateStrictScheduleInfo() {
    const container = document.getElementById('strictScheduleInfo');
    const activeList = blockLists[currentActiveListIndex];
    
    if (!activeList || !container) return;
    
    const schedule = activeList.strictSchedule || { enabled: false, days: [], intervals: [] };
    container.innerHTML = '';
    
    const status = document.createElement('div');
    status.className = 'schedule-status';
    
    const icon = document.createElement('div');
    icon.className = 'schedule-status-icon';
    icon.textContent = '🚫';
    
    const text = document.createElement('div');
    text.className = 'schedule-status-text';
    
    if (!schedule.enabled) {
        text.textContent = 'Always Strict';
    } else if (schedule.days.length === 0) {
        text.textContent = 'Never Strict';
    } else {
        text.textContent = 'Scheduled Strict Mode';
    }
    
    status.appendChild(icon);
    status.appendChild(text);
    container.appendChild(status);
    
    if (schedule.enabled && schedule.days.length > 0) {
        const details = document.createElement('div');
        details.className = 'schedule-details';
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const activeDays = schedule.days.map(d => dayNames[d]).join(', ');
        
        details.innerHTML = `
            <div><strong>Days:</strong> ${activeDays}</div>
            <div><strong>Times:</strong> ${schedule.intervals.map(i => `${i.start}-${i.end}`).join(', ')}</div>
        `;
        container.appendChild(details);
    }
}

function updateChallengeScheduleInfo() {
    const container = document.getElementById('challengeScheduleInfo');
    const activeList = blockLists[currentActiveListIndex];
    
    if (!activeList || !container) return;
    
    const schedule = activeList.challengeSchedule || { enabled: false, days: [], intervals: [] };
    container.innerHTML = '';
    
    const status = document.createElement('div');
    status.className = 'schedule-status';
    
    const icon = document.createElement('div');
    icon.className = 'schedule-status-icon';
    icon.textContent = '🎯';
    
    const text = document.createElement('div');
    text.className = 'schedule-status-text';
    
    if (!schedule.enabled) {
        text.textContent = 'Always Challenge';
    } else if (schedule.days.length === 0) {
        text.textContent = 'Never Challenge';
    } else {
        text.textContent = 'Scheduled Challenge Mode';
    }
    
    status.appendChild(icon);
    status.appendChild(text);
    container.appendChild(status);
    
    if (schedule.enabled && schedule.days.length > 0) {
        const details = document.createElement('div');
        details.className = 'schedule-details';
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const activeDays = schedule.days.map(d => dayNames[d]).join(', ');
        
        details.innerHTML = `
            <div><strong>Days:</strong> ${activeDays}</div>
            <div><strong>Times:</strong> ${schedule.intervals.map(i => `${i.start}-${i.end}`).join(', ')}</div>
        `;
        container.appendChild(details);
    }
}

let currentScheduleType = 'strict'; // Track which schedule we're editing

function setupSchedulePopup(scheduleData, scheduleType) {
    // Update popup title based on schedule type
    const title = document.querySelector('#schedulePopup .popup-title');
    if (title) {
        if (scheduleType === 'strict') {
            title.textContent = 'Set Strict Mode Schedule';
        } else if (scheduleType === 'challenge') {
            title.textContent = 'Set Challenge Mode Schedule';
        } else {
            title.textContent = 'Set Blocking Schedule';
        }
    }
    
    // Set the schedule enabled state
    const enabledCheckbox = document.getElementById('scheduleEnabled');
    if (enabledCheckbox) {
        enabledCheckbox.checked = scheduleData.enabled;
    }
    
    // Clear and populate time intervals
    currentSchedule = {
        enabled: scheduleData.enabled,
        days: [...scheduleData.days],
        intervals: scheduleData.intervals.map(i => ({...i}))
    };
    
    // Update day selection
    updateDaySelection();
    updateTimeIntervalsList();
    
    // Update status text
    updateScheduleStatusText();
}

function updateDaySelection() {
    const dayCircles = document.querySelectorAll('#schedulePopup .day-circle-small');
    
    // Clear all selected states and add click listeners
    dayCircles.forEach(circle => {
        circle.classList.remove('selected');
        circle.onclick = (e) => {
            e.preventDefault();
            const day = parseInt(circle.getAttribute('data-day'));
            toggleMainScheduleDay(day);
        };
    });
    
    // Mark selected days based on currentSchedule.days
    if (currentSchedule && currentSchedule.days) {
        currentSchedule.days.forEach(dayIndex => {
            const dayCircle = document.querySelector(`#schedulePopup .day-circle-small[data-day="${dayIndex}"]`);
            if (dayCircle) {
                dayCircle.classList.add('selected');
            }
        });
    }
    
    console.log('Day selection updated. Selected days:', currentSchedule.days);
}

function toggleMainScheduleDay(day) {
    const dayIndex = currentSchedule.days.indexOf(day);
    
    if (dayIndex === -1) {
        currentSchedule.days.push(day);
    } else {
        currentSchedule.days.splice(dayIndex, 1);
    }
    
    updateDaySelection();
}

function updateTimeIntervalsList() {
    const container = document.getElementById('timeIntervalsList');
    if (!container) {
        console.warn('timeIntervalsList container not found');
        return;
    }
    
    container.innerHTML = '';
    
    if (!currentSchedule.intervals || currentSchedule.intervals.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(34, 197, 94, 0.8); font-style: italic;">✅ Always Active (00:00 - 23:59)</div>';
        return;
    }
    
    currentSchedule.intervals.forEach((interval, index) => {
        const item = document.createElement('div');
        item.className = 'time-interval-item';
        
        const timeText = document.createElement('span');
        timeText.className = 'time-interval-text';
        timeText.textContent = `${interval.start} - ${interval.end}`;
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'remove-interval-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.addEventListener('click', () => removeTimeInterval(deleteBtn));
        
        item.appendChild(timeText);
        item.appendChild(deleteBtn);
        container.appendChild(item);
    });
    
    console.log('Time intervals list updated. Intervals:', currentSchedule.intervals);
}

function updateScheduleStatusText() {
    const statusText = document.getElementById('scheduleStatusText');
    if (statusText) {
        const isEnabled = document.getElementById('scheduleEnabled')?.checked;
        
        statusText.textContent = isEnabled ? '✅ Enabled' : '❌ Disabled';
        statusText.style.color = isEnabled ? 'rgba(34, 197, 94, 0.9)' : 'rgba(240, 246, 252, 0.6)';
    }
}

// Update the save schedule function to work with new structure
function saveSchedule() {
    const activeList = blockLists[currentActiveListIndex];
    if (!activeList) return;
    
    // Save to the appropriate schedule (strict, challenge, or main)
    if (currentScheduleType === 'strict') {
        activeList.strictSchedule = {
            enabled: currentSchedule.enabled,
            days: [...currentSchedule.days],
            intervals: currentSchedule.intervals.map(i => ({...i}))
        };
    } else if (currentScheduleType === 'challenge') {
        activeList.challengeSchedule = {
            enabled: currentSchedule.enabled,
            days: [...currentSchedule.days],
            intervals: currentSchedule.intervals.map(i => ({...i}))
        };
    } else if (currentScheduleType === 'main') {
        activeList.schedule = {
            enabled: currentSchedule.enabled,
            days: [...currentSchedule.days],
            intervals: currentSchedule.intervals.map(i => ({...i}))
        };
    }
    
    saveBlockLists();
    updateMainConfigDisplay();
    closeSchedulePopup();
    
    console.log(`${currentScheduleType} schedule saved for list "${activeList.name}"`);
}

function updateAddDialogText() {
    const activeList = blockLists[currentActiveListIndex];
    const dialogTitle = document.querySelector('#addToBlockPopup .popup-title');
    
    if (activeList && dialogTitle) {
        const isAllow = activeList.listType === 'allow';
        dialogTitle.textContent = isAllow ? 'Add to Allow List' : 'Add to Block List';
    }
}

function updateSelectedItemsDisplay() {
    console.log('updateSelectedItemsDisplay called');
    console.log('selectedItems:', selectedItems);
    
    const container = document.getElementById('selectedItemsList');
    console.log('selectedItemsList container found:', !!container);
    
    if (!container) {
        console.error('selectedItemsList container not found');
        return;
    }
    
    if (selectedItems.length === 0) {
        console.log('No items selected, showing empty state');
        container.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon">🎯</div>
                <div class="empty-text">No items selected</div>
                <div class="empty-desc">Search and select websites or keywords to block</div>
            </div>
        `;
        return;
    }
    
    console.log('Displaying', selectedItems.length, 'selected items');
    
    container.innerHTML = '';
    
    selectedItems.forEach((item, index) => {
        const itemElement = document.createElement('div');
        itemElement.className = 'selected-item';
        
        const logo = document.createElement('div');
        logo.className = 'selected-item-logo';
        
        if (item.type === 'website') {
            const favicon = document.createElement('img');
            favicon.src = `https://www.google.com/s2/favicons?sz=32&domain=${item.domain}`;
            favicon.width = 24;
            favicon.height = 24;
            favicon.style.borderRadius = '4px';
            favicon.onerror = () => {
                logo.textContent = '🌐';
                logo.style.fontSize = '16px';
                logo.style.display = 'flex';
                logo.style.alignItems = 'center';
                logo.style.justifyContent = 'center';
            };
            logo.appendChild(favicon);
        } else {
            logo.textContent = '🔤';
            logo.style.fontSize = '16px';
            logo.style.display = 'flex';
            logo.style.alignItems = 'center';
            logo.style.justifyContent = 'center';
            logo.style.background = 'rgba(255, 152, 0, 0.2)';
        }
        
        const content = document.createElement('div');
        content.className = 'selected-item-content';
        
        const title = document.createElement('div');
        title.className = 'selected-item-title';
        title.textContent = item.name;
        
        const type = document.createElement('div');
        type.className = 'selected-item-type';
        type.textContent = item.type === 'website' ? `Website: ${item.domain}` : `Keyword: ${item.keyword}`;
        
        content.appendChild(title);
        content.appendChild(type);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-item-btn';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', () => removeSelectedItem(index));
        
        itemElement.appendChild(logo);
        itemElement.appendChild(content);
        itemElement.appendChild(removeBtn);
        
        container.appendChild(itemElement);
        console.log('Added item element to container:', item.name);
    });
    
    console.log('updateSelectedItemsDisplay completed. Container children count:', container.children.length);
}

function removeSelectedItem(index) {
    selectedItems.splice(index, 1);
    updateSelectedItemsDisplay();
}

function clearSelectedItems() {
    selectedItems = [];
    updateSelectedItemsDisplay();
}

function addSelectedItemsToBlockList() {
    console.log('addSelectedItemsToBlockList called');
    console.log('selectedItems:', selectedItems);
    console.log('currentActiveListIndex:', currentActiveListIndex);
    console.log('blockLists length:', blockLists.length);
    console.log('blockLists:', blockLists);
    
    if (selectedItems.length === 0) {
        showStatus('Please select items to add to the list', 'error');
        return;
    }
    
    // Validate currentActiveListIndex
    if (currentActiveListIndex < 0 || currentActiveListIndex >= blockLists.length) {
        console.error('Invalid currentActiveListIndex:', currentActiveListIndex);
        showStatus('Invalid active list. Please select a valid list.', 'error');
        return;
    }
    
    const targetList = blockLists[currentActiveListIndex];
    console.log('targetList:', targetList);
    
    if (!targetList) {
        showStatus('No active block list found. Please create a block list first.', 'error');
        return;
    }
    
    if (!targetList.websites) {
        console.log('Target list has no websites array, creating one');
        targetList.websites = [];
    }
    
    let addedCount = 0;
    
    selectedItems.forEach(item => {
        console.log('Processing item:', item);
        if (item.type === 'website') {
            // Check if domain already exists
            console.log('Checking if website exists:', item.domain);
            console.log('Current websites in list:', targetList.websites);
            const exists = targetList.websites.includes(item.domain);
            console.log('Domain exists:', exists);
            
            if (!exists) {
                targetList.websites.push(item.domain);
                addedCount++;
                console.log('Added website:', item.domain);
            } else {
                console.log('Website already exists:', item.domain);
            }
        } else if (item.type === 'keyword') {
            // For keywords, we'll store them with a special prefix
            const keywordEntry = `*${item.keyword}*`;
            console.log('Checking if keyword exists:', keywordEntry);
            console.log('Current websites in list:', targetList.websites);
            const exists = targetList.websites.includes(keywordEntry);
            console.log('Keyword exists:', exists);
            
            if (!exists) {
                targetList.websites.push(keywordEntry);
                addedCount++;
                console.log('Added keyword:', keywordEntry);
            } else {
                console.log('Keyword already exists:', keywordEntry);
            }
        }
    });
    
    if (addedCount > 0) {
        console.log('Added', addedCount, 'items to the list');
        saveBlockLists();
        displayBlockLists();
        updateMainConfigDisplay();
        closeAddToBlockPopup();
        showStatus(`Successfully added ${addedCount} item${addedCount === 1 ? '' : 's'} to the list`, 'success');
    } else {
        console.log('No new items were added (all already existed)');
        showStatus('All selected items were already in the list', 'info');
    }
}

function handleListTypeToggle() {
    const toggle = document.getElementById('listTypeToggle');
    const activeList = blockLists[currentActiveListIndex];
    
    if (toggle && activeList) {
        activeList.listType = toggle.checked ? 'allow' : 'block';
        saveBlockLists();
        updateListTypeDisplay();
        console.log('List type changed to:', activeList.listType);
    }
}

function updateListTypeDisplay() {
    const activeList = blockLists[currentActiveListIndex];
    const listTypeHeader = document.getElementById('listTypeHeader');
    const listTypeLabel = document.getElementById('listTypeLabel');
    const listTypeToggle = document.getElementById('listTypeToggle');
    const emptyStateDescription = document.getElementById('emptyStateDescription');
    
    if (activeList) {
        const isAllow = activeList.listType === 'allow';
        
        if (listTypeToggle) {
            listTypeToggle.checked = isAllow;
        }
        
        if (listTypeLabel) {
            listTypeLabel.textContent = isAllow ? 'Allow' : 'Block';
        }
        
        if (listTypeHeader) {
            listTypeHeader.innerHTML = isAllow ? '✅ Allow List' : '🚫 Block List';
        }
        
        if (emptyStateDescription) {
            emptyStateDescription.textContent = isAllow ? 
                'Add websites and keywords to allow access' : 
                'Add websites and keywords to block access';
        }
    }
}

function addKeywordQuick() {
    console.log('addKeywordQuick called');
    
    const input = document.getElementById('keywordQuickInput');
    const keyword = input.value.trim();
    
    console.log('Keyword input value:', keyword);
    
    if (keyword && keyword.length > 1) {
        // Check if already selected
        const exists = selectedItems.some(item => 
            item.type === 'keyword' && item.keyword === keyword
        );
        
        console.log('Keyword already exists:', exists);
        
        if (!exists) {
            selectedItems.push({
                type: 'keyword',
                name: `Keyword: ${keyword}`,
                keyword: keyword
            });
            
            console.log('Added keyword to selection. selectedItems now:', selectedItems);
            updateSelectedItemsDisplay();
            input.value = '';
        } else {
            console.log('Keyword already in selection, not adding:', keyword);
        }
    } else {
        console.log('Invalid keyword (empty or too short):', keyword);
    }
}

function handleBlockModeChange() {
    const modeSelector = document.getElementById('blockModeSelector');
    const activeList = blockLists[currentActiveListIndex];
    
    if (modeSelector && activeList) {
        activeList.blockPolicy = modeSelector.value;
        saveBlockLists();
        updateActiveModeInfo();
        console.log('Block mode changed to:', activeList.blockPolicy);
    }
}

function updateActiveModeInfo() {
    const container = document.getElementById('activeModeInfo');
    const activeList = blockLists[currentActiveListIndex];
    const modeSelector = document.getElementById('blockModeSelector');
    
    if (!activeList || !container) return;
    
    // Update selector value
    if (modeSelector) {
        modeSelector.value = activeList.blockPolicy || 'strict';
    }
    
    container.innerHTML = '';
    
    const modeInfo = document.createElement('div');
    modeInfo.className = 'mode-info';
    
    const icon = document.createElement('div');
    icon.className = 'mode-icon';
    
    const description = document.createElement('div');
    description.className = 'mode-description';
    
    switch (activeList.blockPolicy) {
        case 'strict':
            icon.textContent = '🚫';
            description.innerHTML = `
                <div class="mode-title">Strict Blocking</div>
                <div class="mode-desc">Complete blocking with no bypass options</div>
            `;
            break;
        case 'difficult':
            icon.textContent = '🎯';
            description.innerHTML = `
                <div class="mode-title">Challenge Mode</div>
                <div class="mode-desc">Users can complete trivia challenges to gain temporary access</div>
            `;
            break;
        case 'scheduled':
            icon.textContent = '📅';
            description.innerHTML = `
                <div class="mode-title">Scheduled Mode</div>
                <div class="mode-desc">Strict blocking during set hours, challenge mode otherwise</div>
            `;
            break;
        default:
            icon.textContent = '🚫';
            description.innerHTML = `
                <div class="mode-title">Strict Blocking</div>
                <div class="mode-desc">Complete blocking with no bypass options</div>
            `;
    }
    
    modeInfo.appendChild(icon);
    modeInfo.appendChild(description);
    container.appendChild(modeInfo);
}

// Main Configuration Interface Functions
let currentActiveListIndex = 0;

function setupMainConfigInterface() {
    console.log('setupMainConfigInterface called');
    console.log('blockLists:', blockLists);
    console.log('currentActiveListIndex:', currentActiveListIndex);
    
    // Ensure we have at least one block list
    if (!blockLists || blockLists.length === 0) {
        console.log('No block lists found, creating default list');
        blockLists = [{
            id: 'default',
            name: 'Default Block List',
            websites: [],
            strictSchedule: { 
                enabled: false,
                days: [0, 1, 2, 3, 4, 5, 6],
                intervals: [{ start: '09:00', end: '17:00' }] 
            },
            challengeSchedule: { 
                enabled: false,
                days: [0, 1, 2, 3, 4, 5, 6],
                intervals: [{ start: '18:00', end: '22:00' }] 
            },
            blockPolicy: 'strict',
            customRedirect: '',
            enabled: true,
            listType: 'block'
        }];
        saveBlockLists();
    }
    
    // Ensure currentActiveListIndex is valid
    if (currentActiveListIndex >= blockLists.length) {
        currentActiveListIndex = 0;
    }
    
    displayBlockLists();
    updateMainConfigDisplay();
    updateListManagementHeader();
}

function toggleListManagement() {
    const dialog = document.getElementById('listManagementDialog');
    if (dialog) {
        populateListManagementDialog();
        dialog.style.display = 'flex';
    }
}

function populateListManagementDialog() {
    const container = document.getElementById('listSelectorContainer');
    if (!container) return;
    
    container.innerHTML = '';
    
    blockLists.forEach((list, index) => {
        const listItem = document.createElement('div');
        listItem.className = `list-selector-item ${index === currentActiveListIndex ? 'active' : ''}`;
        
        listItem.innerHTML = `
            <div class="list-item-info">
                <div class="list-item-name">${list.name}</div>
                <div class="list-item-details">${list.websites.length} websites • ${list.enabled ? 'Enabled' : 'Disabled'}</div>
            </div>
            <div class="list-item-actions">
                <button class="list-item-action edit" data-action="edit" data-index="${index}">✏️</button>
                <button class="list-item-action delete" data-action="delete" data-index="${index}">🗑️</button>
            </div>
        `;
        
        // Add click handler for selecting the list
        listItem.addEventListener('click', function(e) {
            if (!e.target.closest('.list-item-actions')) {
                selectList(index);
            }
        });
        
        // Add handlers for action buttons
        const editBtn = listItem.querySelector('[data-action="edit"]');
        const deleteBtn = listItem.querySelector('[data-action="delete"]');
        
        editBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            renameListInDialog(index);
        });
        
        deleteBtn.addEventListener('click', function(e) {
            e.stopPropagation();
            deleteListFromDialog(index);
        });
        
        container.appendChild(listItem);
    });
}

function selectList(index) {
    currentActiveListIndex = index;
    updateMainConfigDisplay();
    updateListManagementHeader();
    closeListManagementDialog();
}

function renameListInDialog(index) {
    const list = blockLists[index];
    if (!list) return;
    
    const newName = prompt('Enter new name for the list:', list.name);
    if (newName && newName.trim() && newName.trim() !== list.name) {
        const trimmedName = newName.trim();
        if (blockLists.some((otherList, otherIndex) => 
            otherIndex !== index && 
            otherList.name.toLowerCase() === trimmedName.toLowerCase()
        )) {
            alert('A list with this name already exists. Please choose a different name.');
            return;
        }
        
        list.name = trimmedName;
        saveBlockLists();
        populateListManagementDialog();
        updateListManagementHeader();
        showStatus('List renamed successfully', 'success');
    }
}

function deleteListFromDialog(index) {
    if (blockLists.length <= 1) {
        alert('Cannot delete the last block list');
        return;
    }
    
    const list = blockLists[index];
    if (confirm(`Are you sure you want to delete "${list.name}"? This action cannot be undone.`)) {
        blockLists.splice(index, 1);
        
        // Adjust current index if needed
        if (currentActiveListIndex >= blockLists.length) {
            currentActiveListIndex = blockLists.length - 1;
        } else if (currentActiveListIndex > index) {
            currentActiveListIndex--;
        }
        
        saveBlockLists();
        populateListManagementDialog();
        updateListManagementHeader();
        updateMainConfigDisplay();
        showStatus('List deleted successfully', 'success');
    }
}

function closeListManagementDialog() {
    const dialog = document.getElementById('listManagementDialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

function updateListManagementHeader() {
    const currentListNameElement = document.getElementById('currentListName');
    const activeList = blockLists[currentActiveListIndex];
    
    if (currentListNameElement && activeList) {
        currentListNameElement.textContent = activeList.name;
    }
}

function deleteCurrentActiveList() {
    if (blockLists.length <= 1) {
        showStatus('Cannot delete the last block list', 'error');
        return;
    }
    
    const activeList = blockLists[currentActiveListIndex];
    if (!activeList) return;
    
    if (confirm(`Are you sure you want to delete "${activeList.name}"? This action cannot be undone.`)) {
        blockLists.splice(currentActiveListIndex, 1);
        
        // Adjust current index if needed
        if (currentActiveListIndex >= blockLists.length) {
            currentActiveListIndex = blockLists.length - 1;
        }
        
        saveBlockLists();
        setupMainConfigInterface();
        showStatus('Block list deleted successfully', 'success');
    }
}

// populateActiveBlockListSelector removed - functionality moved to dialog system

// handleActiveListChange removed - functionality moved to dialog selectList function

function updateMainConfigDisplay() {
    updateActiveBlockedItemsDisplay();
    updateMainScheduleInfo();
    updateBottomBlockModeDisplay();
}

function updateActiveBlockedItemsDisplay() {
    const container = document.getElementById('activeBlockedItems');
    
    if (!container) {
        console.error('activeBlockedItems container not found in DOM');
        return;
    }
    
    const activeList = blockLists[currentActiveListIndex];
    console.log('updateActiveBlockedItemsDisplay: activeList:', activeList);
    
    if (!activeList || activeList.websites.length === 0) {
        const isAllow = activeList && activeList.listType === 'allow';
        console.log('No items in active list, showing empty state');
        container.innerHTML = `
            <div class="empty-blocked-items">
                <div class="empty-icon">${isAllow ? '✅' : '🎯'}</div>
                <div class="empty-title">No items in list yet</div>
                <div class="empty-subtitle">${isAllow ? 'Add websites and keywords to allow access' : 'Add websites and keywords to block access'}</div>
            </div>
        `;
        return;
    }
    
    container.innerHTML = '';
    
    activeList.websites.forEach((website, index) => {
        const item = document.createElement('div');
        item.className = 'blocked-item';
        
        const logo = document.createElement('div');
        logo.className = 'blocked-item-logo';
        
        // Determine if it's a keyword or website
        const isKeyword = website.startsWith('*') && website.endsWith('*');
        
        if (isKeyword) {
            logo.textContent = '🔤';
            logo.style.fontSize = '16px';
            logo.style.display = 'flex';
            logo.style.alignItems = 'center';
            logo.style.justifyContent = 'center';
            logo.style.background = 'rgba(255, 152, 0, 0.2)';
        } else {
            const favicon = document.createElement('img');
            favicon.src = `https://www.google.com/s2/favicons?sz=32&domain=${website}`;
            favicon.width = 24;
            favicon.height = 24;
            favicon.style.borderRadius = '4px';
            favicon.onerror = () => {
                logo.textContent = '🌐';
                logo.style.fontSize = '16px';
                logo.style.display = 'flex';
                logo.style.alignItems = 'center';
                logo.style.justifyContent = 'center';
            };
            logo.appendChild(favicon);
        }
        
        const content = document.createElement('div');
        content.className = 'blocked-item-content';
        
        const name = document.createElement('div');
        name.className = 'blocked-item-name';
        name.textContent = isKeyword ? `Keyword: ${website.slice(1, -1)}` : website;
        
        const type = document.createElement('div');
        type.className = 'blocked-item-type';
        const activeList = blockLists[currentActiveListIndex];
        const isAllow = activeList && activeList.listType === 'allow';
        
        if (isKeyword) {
            type.textContent = isAllow ? 'URLs containing this keyword are allowed' : 'URLs containing this keyword are blocked';
        } else {
            type.textContent = isAllow ? 'Website access allowed' : 'Website access blocked';
        }
        
        content.appendChild(name);
        content.appendChild(type);
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'remove-item-btn';
        removeBtn.innerHTML = '×';
        removeBtn.addEventListener('click', () => removeWebsiteFromActiveList(index));
        
        item.appendChild(logo);
        item.appendChild(content);
        item.appendChild(removeBtn);
        
        container.appendChild(item);
    });
}

function updateActiveScheduleInfo() {
    const container = document.getElementById('activeScheduleInfo');
    const activeList = blockLists[currentActiveListIndex];
    
    if (!activeList) return;
    
    const schedule = activeList.schedule || { enabled: false, days: [], intervals: [] };
    const isScheduleEnabled = schedule.enabled !== false;
    
    container.innerHTML = '';
    
    const status = document.createElement('div');
    status.className = 'schedule-status';
    
    const icon = document.createElement('div');
    icon.className = 'schedule-status-icon';
    icon.textContent = isScheduleEnabled ? '✅' : '🚫';
    
    const text = document.createElement('div');
    text.className = 'schedule-status-text';
    text.textContent = isScheduleEnabled ? 'Schedule Active' : 'Always Blocking';
    
    status.appendChild(icon);
    status.appendChild(text);
    
    const details = document.createElement('div');
    details.className = 'schedule-details';
    
    if (isScheduleEnabled) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const scheduledDays = schedule.days.map(day => days[day]).join(', ');
        const intervals = schedule.intervals.map(interval => `${interval.start}-${interval.end}`).join(', ');
        
        details.innerHTML = `
            <div><strong>Days:</strong> ${scheduledDays || 'None'}</div>
            <div><strong>Times:</strong> ${intervals || 'All day'}</div>
            <div><strong>Policy:</strong> ${activeList.blockPolicy || 'Strict'}</div>
        `;
    } else {
        details.innerHTML = `
            <div><strong>Mode:</strong> Blocks 24/7, no time restrictions</div>
            <div><strong>Policy:</strong> ${activeList.blockPolicy || 'Strict'}</div>
        `;
    }
    
    container.appendChild(status);
    container.appendChild(details);
}

function openAddToActiveBlockList() {
    openAddToBlockForList(currentActiveListIndex);
}

function configureActiveTiming() {
    openScheduleForList(currentActiveListIndex);
}

function configureActiveRedirect() {
    openRedirectForList(currentActiveListIndex);
}

function removeWebsiteFromActiveList(index) {
    const activeList = blockLists[currentActiveListIndex];
    activeList.websites.splice(index, 1);
    saveBlockLists();
    displayBlockLists();
    updateMainConfigDisplay();
}

function updateActiveRedirectInfo() {
    const container = document.getElementById('activeRedirectInfo');
    const activeList = blockLists[currentActiveListIndex];
    
    if (!activeList || !container) return;
    
    const redirectUrl = activeList.customRedirect || '';
    
    container.innerHTML = '';
    
    const status = document.createElement('div');
    status.className = 'redirect-status';
    
    const icon = document.createElement('div');
    icon.className = 'redirect-status-icon';
    
    const text = document.createElement('div');
    text.className = 'redirect-status-text';
    
    if (!redirectUrl) {
        icon.textContent = '📄';
        text.textContent = 'Default Block Page';
    } else if (redirectUrl === 'about:blank') {
        icon.textContent = '⬜';
        text.textContent = 'Blank Page';
    } else if (redirectUrl === 'homepage') {
        icon.textContent = '🏠';
        text.textContent = 'Browser Homepage';
    } else if (redirectUrl.startsWith('http')) {
        icon.textContent = '🔗';
        text.textContent = 'Custom URL';
    }
    
    status.appendChild(icon);
    status.appendChild(text);
    
    if (redirectUrl.startsWith('http')) {
        const url = document.createElement('div');
        url.className = 'redirect-details';
        url.innerHTML = `<strong>URL:</strong> ${redirectUrl}`;
        container.appendChild(status);
        container.appendChild(url);
    } else {
        container.appendChild(status);
    }
}

// toggleAdvancedSection removed - advanced section no longer exists


async function saveBlockLists() {
    console.log('saveBlockLists called with:', blockLists);
    try {
        await chrome.storage.sync.set({ blockLists: blockLists });
        console.log('Block lists saved successfully to storage');
        chrome.runtime.sendMessage({ action: 'updateRules' });
        console.log('Sent updateRules message to background script');
    } catch (error) {
        console.error('Error saving block lists:', error);
        showStatus('Error saving settings', 'error');
    }
}

async function saveSettings() {
    try {
        await chrome.storage.sync.set({ settings: settings });
    } catch (error) {
        console.error('Error saving settings:', error);
    }
}

function saveUsageSettings() {
    settings.dailyLimit = parseInt(document.getElementById('dailyLimit').value) || 60;
    saveSettings();
    showStatus('Usage settings saved', 'success');
}

function startFocusMode() {
    const duration = parseInt(document.getElementById('focusDuration').value) || 25;
    settings.focusDuration = duration;
    
    const endTime = Date.now() + (duration * 60 * 1000);
    settings.focusEndTime = endTime;
    settings.focusMode = true;
    
    saveSettings();
    showStatus(`Focus mode started for ${duration} minutes`, 'success');
}

function stopFocusMode() {
    settings.focusMode = false;
    delete settings.focusEndTime;
    saveSettings();
    showStatus('Focus mode stopped', 'success');
}

function loadInsights() {
    const totalSites = blockLists.reduce((sum, list) => sum + list.websites.length, 0);
    
    const blockedCount = document.getElementById('blockedCount');
    if (blockedCount) {
        blockedCount.textContent = totalSites;
    }
    
    const attemptCount = document.getElementById('attemptCount');
    if (attemptCount) {
        attemptCount.textContent = settings.stats.attemptCount || 0;
    }
    
    const timesSaved = document.getElementById('timesSaved');
    if (timesSaved) {
        timesSaved.textContent = settings.stats.timesSaved || 0;
    }
}

function showStatus(message, type, force = false) {
    // Only show status for important messages or when forced
    if (!force && (type === 'success' || message.includes('saved') || message.includes('Settings'))) {
        return;
    }
    
    const statusElement = document.getElementById('status-message');
    if (statusElement) {
        statusElement.textContent = message;
        statusElement.className = `status-message status-${type}`;
        statusElement.style.display = 'block';
        
        setTimeout(() => {
            statusElement.style.display = 'none';
        }, 3000);
    }
}

function sanitizeText(text) {
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

function updateTheme() {
    const body = document.body;
    const themeButton = document.getElementById('themeToggle');
    
    if (settings.darkMode) {
        body.classList.remove('light-mode');
        themeButton.innerHTML = '🌙 Dark Mode';
    } else {
        body.classList.add('light-mode');
        themeButton.innerHTML = '☀️ Light Mode';
    }
}

function isValidUrl(url) {
    const urlPattern = /^[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?(\.[a-zA-Z0-9]([a-zA-Z0-9\-]{0,61}[a-zA-Z0-9])?)*$/;
    return urlPattern.test(url) && url.length <= 253;
}

function toggleTriviaSettings() {
    const challengeType = document.getElementById('challengeType').value;
    const triviaSettingsDiv = document.getElementById('triviaSettings');
    const triviaInputs = document.querySelectorAll('#triviaAmount, #triviaCategory, #triviaDifficulty, #triviaType');
    const testBtn = document.getElementById('testTriviaBtn');
    
    if (challengeType === 'trivia') {
        triviaSettingsDiv.style.display = 'block';
        triviaInputs.forEach(input => input.parentElement.style.display = 'block');
        testBtn.style.display = 'inline-flex';
    } else {
        triviaSettingsDiv.style.display = 'none';
        triviaInputs.forEach(input => input.parentElement.style.display = 'none');
        testBtn.style.display = 'none';
    }
}

async function saveChallengeSettings() {
    try {
        challengeSettings.challengeType = document.getElementById('challengeType').value;
        
        triviaSettings.amount = parseInt(document.getElementById('triviaAmount').value);
        triviaSettings.category = document.getElementById('triviaCategory').value;
        triviaSettings.difficulty = document.getElementById('triviaDifficulty').value;
        triviaSettings.type = document.getElementById('triviaType').value;
        triviaSettings.unlockDuration = parseInt(document.getElementById('unlockDuration').value);
        
        await chrome.storage.sync.set({ 
            challengeSettings: challengeSettings,
            triviaSettings: triviaSettings
        });
        
        showStatus('Challenge settings saved successfully', 'success');
    } catch (error) {
        console.error('Error saving challenge settings:', error);
        showStatus('Error saving challenge settings', 'error');
    }
}

async function testTriviaAPI() {
    const testBtn = document.getElementById('testTriviaBtn');
    const originalText = testBtn.textContent;
    
    testBtn.textContent = 'Testing...';
    testBtn.disabled = true;
    
    try {
        const amount = document.getElementById('triviaAmount').value;
        const category = document.getElementById('triviaCategory').value;
        const difficulty = document.getElementById('triviaDifficulty').value;
        const type = document.getElementById('triviaType').value;
        
        let url = `https://opentdb.com/api.php?amount=${amount}&difficulty=${difficulty}&type=${type}`;
        
        if (category && category !== 'any') {
            url += `&category=${category}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.response_code === 0 && data.results && data.results.length > 0) {
            showStatus(`✓ API test successful! Retrieved ${data.results.length} question${data.results.length > 1 ? 's' : ''}.`, 'success');
            console.log('Test questions:', data.results);
        } else {
            let errorMsg = 'API test failed: ';
            switch(data.response_code) {
                case 1:
                    errorMsg += 'No results found. Try different settings.';
                    break;
                case 2:
                    errorMsg += 'Invalid parameter.';
                    break;
                case 3:
                    errorMsg += 'Token not found.';
                    break;
                case 4:
                    errorMsg += 'Token empty.';
                    break;
                default:
                    errorMsg += 'Unknown error.';
            }
            showStatus(errorMsg, 'error');
        }
    } catch (error) {
        console.error('Error testing trivia API:', error);
        showStatus('Error testing API: Network or server error', 'error');
    }
    
    testBtn.textContent = originalText;
    testBtn.disabled = false;
}

// New functions for the improved UI

function handleBlockPageChange() {
    const selector = document.getElementById('blockPageSelector');
    const selectedValue = selector.value;
    
    // Update the active list's block policy based on selection
    const activeList = blockLists[currentActiveListIndex];
    if (!activeList) return;
    
    switch (selectedValue) {
        case 'strict':
            activeList.blockPolicy = 'strict';
            break;
        case 'challenge':
            activeList.blockPolicy = 'difficult';
            break;
        case 'custom':
            activeList.blockPolicy = 'redirect';
            break;
    }
    
    saveBlockLists();
    showStatus('Block page updated', 'success');
}

function configureBlockPage() {
    const activeList = blockLists[currentActiveListIndex];
    if (!activeList) return;
    
    // Open the redirect configuration if custom is selected
    if (activeList.blockPolicy === 'redirect') {
        configureActiveRedirect();
    } else {
        showStatus('Block page settings updated', 'info');
    }
}

function switchScheduleTab(scheduleType) {
    // Update active tab
    document.querySelectorAll('.schedule-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelector(`[data-schedule-type="${scheduleType}"]`).classList.add('active');
    
    // Update active panel
    document.querySelectorAll('.schedule-panel').forEach(panel => {
        panel.classList.remove('active');
    });
    document.getElementById(`${scheduleType}ScheduleContent`).classList.add('active');
}

function updateBlockPageSelector() {
    const selector = document.getElementById('blockPageSelector');
    const activeList = blockLists[currentActiveListIndex];
    
    if (!selector || !activeList) return;
    
    // Set selector value based on block policy
    switch (activeList.blockPolicy) {
        case 'strict':
            selector.value = 'strict';
            break;
        case 'difficult':
            selector.value = 'challenge';
            break;
        case 'redirect':
            selector.value = 'custom';
            break;
        default:
            selector.value = 'strict';
    }
}

function updateBottomBlockModeDisplay() {
    const activeList = blockLists[currentActiveListIndex];
    if (!activeList) return;
    
    const toggle = document.getElementById('challengeModeToggleBottom');
    const currentModeLabel = document.getElementById('currentModeLabel');
    const timerBtn = document.getElementById('blockModeTimerBtnBottom');
    const timerIcon = timerBtn?.querySelector('.timer-btn-icon');
    
    if (!toggle || !currentModeLabel) return;
    
    // Update toggle state and label based on block policy
    const isChallenge = activeList.blockPolicy === 'difficult';
    const isStrict = activeList.blockPolicy === 'strict';
    const isCustom = activeList.blockPolicy === 'redirect';
    
    toggle.checked = isChallenge;
    
    // Animate mode label transition
    currentModeLabel.classList.add('transitioning');
    setTimeout(() => {
        currentModeLabel.classList.remove('transitioning');
    }, 600);
    
    // Update current mode label
    if (isCustom) {
        currentModeLabel.textContent = 'Custom';
        currentModeLabel.classList.remove('challenge');
    } else if (isChallenge) {
        currentModeLabel.textContent = 'Challenge';
        currentModeLabel.classList.add('challenge');
    } else {
        currentModeLabel.textContent = 'Strict';
        currentModeLabel.classList.remove('challenge');
    }
    
    // Update timer button based on mode
    if (timerBtn && timerIcon) {
        // Remove all mode classes
        timerBtn.classList.remove('active', 'redirect-mode');
        
        if (isStrict) {
            // In Strict mode: button becomes redirect configurator
            timerBtn.classList.add('redirect-mode');
            timerBtn.title = 'Configure Redirect Page';
            timerIcon.textContent = '📄';
        } else if (isChallenge) {
            // In Challenge mode: button becomes scheduler
            const hasSchedule = activeList.strictSchedule?.enabled || activeList.challengeSchedule?.enabled;
            timerBtn.classList.toggle('active', hasSchedule);
            timerBtn.title = 'Configure Schedule';
            timerIcon.textContent = '⏰';
        } else {
            // Custom mode: neutral state
            timerBtn.title = 'Configure Settings';
            timerIcon.textContent = '⚙️';
        }
    }
}

function updateMainScheduleInfo() {
    const container = document.getElementById('mainScheduleInfo');
    const activeList = blockLists[currentActiveListIndex];
    
    if (!activeList || !container) return;
    
    // Use the old single schedule for main schedule display
    const schedule = activeList.schedule || { enabled: false, days: [], intervals: [] };
    container.innerHTML = '';
    
    const status = document.createElement('div');
    status.className = 'schedule-status';
    
    const icon = document.createElement('div');
    icon.className = 'schedule-status-icon';
    icon.textContent = schedule.enabled ? '✅' : '🚫';
    
    const text = document.createElement('div');
    text.className = 'schedule-status-text';
    
    if (!schedule.enabled) {
        text.textContent = 'Always Active';
    } else if (schedule.days.length === 0) {
        text.textContent = 'Never Active';
    } else {
        text.textContent = 'Scheduled';
    }
    
    status.appendChild(icon);
    status.appendChild(text);
    container.appendChild(status);
    
    if (schedule.enabled && schedule.days.length > 0) {
        const details = document.createElement('div');
        details.className = 'schedule-details';
        
        const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const activeDays = schedule.days.map(d => dayNames[d]).join(', ');
        
        details.innerHTML = `
            <div><strong>Days:</strong> ${activeDays}</div>
            <div><strong>Times:</strong> ${schedule.intervals?.map(i => `${i.start}-${i.end}`).join(', ') || 'All day'}</div>
        `;
        
        container.appendChild(details);
    }
}

function handleBlockModeToggleBottom() {
    const toggle = document.getElementById('challengeModeToggleBottom');
    const activeList = blockLists[currentActiveListIndex];
    
    if (!toggle || !activeList) return;
    
    activeList.blockPolicy = toggle.checked ? 'difficult' : 'strict';
    saveBlockLists();
    updateBottomBlockModeDisplay();
    showStatus(`Switched to ${toggle.checked ? 'Challenge' : 'Strict'} mode`, 'success');
}

function openBlockModeTimerDialog() {
    const dialog = document.getElementById('blockModeTimerDialog');
    const activeList = blockLists[currentActiveListIndex];
    
    if (!dialog || !activeList) return;
    
    // Populate dialog with current strict schedule
    const strictSchedule = activeList.strictSchedule || { enabled: false, days: [], intervals: [] };
    
    // Set up schedule toggle
    const scheduleToggle = document.getElementById('blockModeScheduleEnabled');
    const scheduleStatus = document.getElementById('blockModeScheduleStatus');
    if (scheduleToggle && scheduleStatus) {
        scheduleToggle.checked = strictSchedule.enabled || false;
        scheduleStatus.textContent = scheduleToggle.checked ? '✅ Enabled' : '❌ Disabled';
        scheduleStatus.style.color = scheduleToggle.checked ? 'rgba(34, 197, 94, 0.9)' : 'rgba(240, 246, 252, 0.6)';
        
        scheduleToggle.onchange = () => {
            const enabled = scheduleToggle.checked;
            const scheduleContent = document.getElementById('blockModeScheduleContent');
            
            scheduleStatus.textContent = enabled ? '✅ Enabled' : '❌ Disabled';
            scheduleStatus.style.color = enabled ? 'rgba(34, 197, 94, 0.9)' : 'rgba(240, 246, 252, 0.6)';
            
            if (enabled) {
                scheduleContent.classList.remove('disabled');
            } else {
                scheduleContent.classList.add('disabled');
            }
        };
    }
    
    // Set up current schedule data for block mode
    currentBlockModeSchedule = {
        enabled: strictSchedule.enabled,
        days: [...(strictSchedule.days || [])],
        intervals: (strictSchedule.intervals || []).map(i => ({...i}))
    };
    
    // Update day selection and intervals
    updateBlockModeDaySelection();
    updateBlockModeTimeIntervalsList();
    
    // Set schedule content enabled/disabled state
    const scheduleContent = document.getElementById('blockModeScheduleContent');
    if (strictSchedule.enabled) {
        scheduleContent.classList.remove('disabled');
    } else {
        scheduleContent.classList.add('disabled');
    }
    
    dialog.style.display = 'flex';
}

function closeBlockModeTimerDialog() {
    const dialog = document.getElementById('blockModeTimerDialog');
    if (dialog) dialog.style.display = 'none';
}

function saveBlockModeTimer() {
    const activeList = blockLists[currentActiveListIndex];
    if (!activeList) return;
    
    // Get schedule enabled state
    const scheduleToggle = document.getElementById('blockModeScheduleEnabled');
    const enabled = scheduleToggle ? scheduleToggle.checked : false;
    
    // Update strict schedule from currentBlockModeSchedule
    activeList.strictSchedule = {
        enabled: enabled,
        days: [...currentBlockModeSchedule.days],
        intervals: currentBlockModeSchedule.intervals.map(i => ({...i}))
    };
    
    saveBlockLists();
    updateBottomBlockModeDisplay();
    closeBlockModeTimerDialog();
    showStatus('Block mode schedule saved', 'success');
}


function updateBlockModeDaySelection() {
    const dayCircles = document.querySelectorAll('#blockModeTimerDialog .day-circle-small');
    
    // Clear all selected states first
    dayCircles.forEach(circle => {
        circle.classList.remove('selected');
        circle.onclick = (e) => {
            e.preventDefault();
            const day = parseInt(circle.getAttribute('data-day'));
            toggleBlockModeDay(day);
        };
    });
    
    // Mark selected days based on currentBlockModeSchedule.days
    if (currentBlockModeSchedule && currentBlockModeSchedule.days) {
        currentBlockModeSchedule.days.forEach(dayIndex => {
            const dayCircle = document.querySelector(`#blockModeTimerDialog .day-circle-small[data-day="${dayIndex}"]`);
            if (dayCircle) {
                dayCircle.classList.add('selected');
            }
        });
    }
}

function toggleBlockModeDay(day) {
    const dayIndex = currentBlockModeSchedule.days.indexOf(day);
    
    if (dayIndex === -1) {
        currentBlockModeSchedule.days.push(day);
    } else {
        currentBlockModeSchedule.days.splice(dayIndex, 1);
    }
    
    updateBlockModeDaySelection();
}

function updateBlockModeTimeIntervalsList() {
    const container = document.getElementById('blockModeTimeIntervalsList');
    if (!container) return;
    
    container.innerHTML = '';
    
    if (!currentBlockModeSchedule.intervals || currentBlockModeSchedule.intervals.length === 0) {
        container.innerHTML = '<div style="text-align: center; padding: 20px; color: rgba(34, 197, 94, 0.8); font-style: italic;">✅ Always Active (00:00 - 23:59)</div>';
        return;
    }
    
    currentBlockModeSchedule.intervals.forEach((interval, index) => {
        const intervalItem = document.createElement('div');
        intervalItem.className = 'time-interval-item';
        
        const startTime = interval.start || '09:00';
        const endTime = interval.end || '17:00';
        
        const deleteBtn = document.createElement('button');
        deleteBtn.className = 'remove-interval-btn';
        deleteBtn.innerHTML = '🗑️';
        deleteBtn.addEventListener('click', () => removeBlockModeIntervalFromList(index));
        
        intervalItem.innerHTML = `
            <div class="time-input-row">
                <input type="time" data-type="start" value="${startTime}" class="time-input compact">
                <span class="time-separator">to</span>
                <input type="time" data-type="end" value="${endTime}" class="time-input compact">
            </div>
        `;
        
        // Add event listeners for inputs
        const startInput = intervalItem.querySelector('input[data-type="start"]');
        const endInput = intervalItem.querySelector('input[data-type="end"]');
        
        if (startInput) {
            startInput.addEventListener('change', (e) => updateBlockModeInterval(index, 'start', e.target.value));
        }
        if (endInput) {
            endInput.addEventListener('change', (e) => updateBlockModeInterval(index, 'end', e.target.value));
        }
        
        intervalItem.querySelector('.time-input-row').appendChild(deleteBtn);
        container.appendChild(intervalItem);
    });
}

function removeBlockModeIntervalFromList(index) {
    currentBlockModeSchedule.intervals.splice(index, 1);
    updateBlockModeTimeIntervalsList();
    showStatus(currentBlockModeSchedule.intervals.length === 0 ? 'All intervals removed - now always active' : 'Time interval removed', 'success');
}

function updateBlockModeInterval(index, type, value) {
    if (currentBlockModeSchedule.intervals[index]) {
        currentBlockModeSchedule.intervals[index][type] = value;
    }
}

function addBlockModeTimeInterval() {
    const startInput = document.getElementById('newBlockModeIntervalStart');
    const endInput = document.getElementById('newBlockModeIntervalEnd');
    
    const start = startInput?.value || '09:00';
    const end = endInput?.value || '17:00';
    
    if (!start || !end) {
        showStatus('Please set both start and end times', 'error');
        return;
    }
    
    if (start >= end) {
        showStatus('Start time must be before end time', 'error');
        return;
    }
    
    // Check for overlapping intervals
    const newStartMinutes = timeToMinutes(start);
    const newEndMinutes = timeToMinutes(end);
    
    const hasOverlap = currentBlockModeSchedule.intervals.some(interval => {
        const existingStart = timeToMinutes(interval.start);
        const existingEnd = timeToMinutes(interval.end);
        
        return (newStartMinutes < existingEnd && newEndMinutes > existingStart);
    });
    
    if (hasOverlap) {
        showStatus('Time interval overlaps with existing interval', 'error');
        return;
    }
    
    currentBlockModeSchedule.intervals.push({ start, end });
    updateBlockModeTimeIntervalsList();
    
    // Reset inputs
    if (startInput) startInput.value = '09:00';
    if (endInput) endInput.value = '17:00';
    
    showStatus('Time interval added', 'success');
}

function openCustomRedirectDialog() {
    const dialog = document.getElementById('customRedirectDialog');
    const activeList = blockLists[currentActiveListIndex];
    
    if (!dialog || !activeList) return;
    
    const urlInput = document.getElementById('customRedirectUrl');
    if (urlInput) {
        urlInput.value = activeList.customRedirect || '';
    }
    
    dialog.style.display = 'flex';
}

function closeCustomRedirectDialog() {
    const dialog = document.getElementById('customRedirectDialog');
    if (dialog) dialog.style.display = 'none';
}

function saveCustomRedirect() {
    const activeList = blockLists[currentActiveListIndex];
    const urlInput = document.getElementById('customRedirectUrl');
    
    if (!activeList || !urlInput) return;
    
    const url = urlInput.value.trim();
    if (url && !url.match(/^https?:\/\//)) {
        alert('Please enter a valid URL starting with http:// or https://');
        return;
    }
    
    activeList.customRedirect = url;
    // Keep existing block policy (don't change to 'redirect')
    if (!activeList.blockPolicy) {
        activeList.blockPolicy = 'strict';
    }
    
    saveBlockLists();
    updateBottomBlockModeDisplay();
    closeCustomRedirectDialog();
    showStatus('Custom redirect saved', 'success');
}

// Helper functions for scheduler dialog





function removeTimeInterval(button) {
    const intervalItem = button.closest('.time-interval-item');
    const container = document.getElementById('timeIntervalsList');
    
    if (!container) return;
    
    // Find the interval index to remove from currentSchedule
    const timeText = intervalItem.querySelector('.time-interval-text')?.textContent;
    if (!timeText) return;
    
    const intervalIndex = currentSchedule.intervals.findIndex(interval => 
        `${interval.start} - ${interval.end}` === timeText
    );
    
    if (intervalIndex !== -1) {
        currentSchedule.intervals.splice(intervalIndex, 1);
        updateTimeIntervalsList();
        showStatus(currentSchedule.intervals.length === 0 ? 'All intervals removed - now always active' : 'Time interval removed', 'success');
    }
}

// Removed old animation functions - no longer needed

// Main schedule dialog function
function openMainScheduleDialog() {
    console.log('Opening main schedule dialog');
    
    const activeList = blockLists[currentActiveListIndex];
    if (!activeList) {
        console.error('No active list found');
        showStatus('Error: No active list found', 'error');
        return;
    }
    
    // Use the schedule from the active list
    const scheduleData = activeList.schedule || { enabled: false, days: [], intervals: [] };
    console.log('Opening schedule for list:', activeList.name);
    
    // Set up the schedule popup
    currentScheduleType = 'main';
    setupSchedulePopup(scheduleData, 'main');
    
    const popup = document.getElementById('schedulePopup');
    if (popup) {
        popup.style.display = 'flex';
        console.log('Schedule popup displayed');
    } else {
        console.error('schedulePopup element not found');
        showStatus('Error: Schedule dialog not found', 'error');
    }
}

// Timer button click handler - routes based on current mode
function handleTimerButtonClick() {
    const activeList = blockLists[currentActiveListIndex];
    if (!activeList) return;
    
    const isStrict = activeList.blockPolicy === 'strict';
    const isChallenge = activeList.blockPolicy === 'difficult';
    
    if (isStrict) {
        // In Strict mode: open redirect dialog
        openCustomRedirectDialog();
    } else if (isChallenge) {
        // In Challenge mode: open schedule dialog
        openBlockModeTimerDialog();
    } else {
        // Custom mode: show message or open settings
        showStatus('Custom redirect already configured', 'info');
    }
}

// In-App Blocking functionality
let inAppSettings = {
    youtube: {
        enabled: false,
        features: {
            hideHome: false,
            hideShorts: false,
            hideComments: false,
            hideRecommended: false,
            hideSubscriptions: false,
            hideExplore: false,
            hideTrends: false,
            hideTopBar: false,
            disableEndCards: false,
            bwMode: false,
            disableAutoplay: false
        },
        allowedChannels: []
    },
    tiktok: {
        enabled: false,
        features: {
            hideExplore: false,
            hideLive: false,
            hideComments: false,
            hideSearch: false,
            bwMode: false
        }
    },
    instagram: {
        enabled: false,
        features: {
            hideStories: false,
            hideReels: false,
            hideExplore: false,
            hideComments: false,
            bwMode: false
        }
    },
    facebook: {
        enabled: false,
        features: {
            hideStories: false,
            hideReels: false,
            hideMarketplace: false,
            bwMode: false
        }
    },
    twitter: {
        enabled: false,
        features: {
            hideExplore: false,
            hideTrends: false,
            hideNotifications: false,
            hideLists: false,
            hideCommunities: false,
            bwMode: false
        }
    },
    snapchat: {
        enabled: false,
        features: {
            hideStories: false,
            hideSpotlight: false,
            hideChat: false,
            bwMode: false
        }
    }
};

function setupInAppBlocking() {
    // Setup app header click handlers
    document.querySelectorAll('.app-header').forEach(header => {
        header.addEventListener('click', (e) => {
            if (e.target.closest('.app-toggle')) return; // Don't toggle if clicking on toggle switch
            
            const appCard = header.closest('.app-card');
            toggleAppExpansion(appCard);
        });
    });
    
    // Setup app master toggle switches
    Object.keys(inAppSettings).forEach(app => {
        const masterToggle = document.getElementById(`${app}-enabled`);
        if (masterToggle) {
            masterToggle.addEventListener('change', (e) => {
                inAppSettings[app].enabled = e.target.checked;
                saveInAppSettings();
                updateAppCardState(app);
            });
        }
        
        // Setup feature toggles
        const features = inAppSettings[app].features;
        Object.keys(features).forEach(feature => {
            const featureToggle = document.getElementById(`${app}-${feature.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
            if (featureToggle) {
                featureToggle.addEventListener('change', (e) => {
                    inAppSettings[app].features[feature] = e.target.checked;
                    saveInAppSettings();
                });
            }
        });
    });
    
    // Setup YouTube channel management
    const addChannelBtn = document.getElementById('youtube-add-channel');
    const channelInput = document.getElementById('youtube-channel-input');
    
    if (addChannelBtn && channelInput) {
        addChannelBtn.addEventListener('click', () => addYouTubeChannel());
        channelInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') addYouTubeChannel();
        });
    }
    
    loadInAppSettings();
}

function toggleAppExpansion(appCard) {
    const isExpanded = appCard.classList.contains('expanded');
    
    // Close all other app cards
    document.querySelectorAll('.app-card').forEach(card => {
        card.classList.remove('expanded');
    });
    
    // Toggle this card
    if (!isExpanded) {
        appCard.classList.add('expanded');
    }
}

function updateAppCardState(app) {
    const appCard = document.querySelector(`[data-app="${app}"]`);
    const toggle = document.getElementById(`${app}-enabled`);
    
    if (appCard && toggle) {
        if (inAppSettings[app].enabled) {
            appCard.classList.add('enabled');
        } else {
            appCard.classList.remove('enabled');
        }
    }
}

function addYouTubeChannel() {
    const input = document.getElementById('youtube-channel-input');
    const channel = input.value.trim();
    
    if (!channel) {
        showStatus('Please enter a channel URL or name', 'error');
        return;
    }
    
    if (inAppSettings.youtube.allowedChannels.includes(channel)) {
        showStatus('Channel already added', 'error');
        return;
    }
    
    inAppSettings.youtube.allowedChannels.push(channel);
    input.value = '';
    saveInAppSettings();
    updateYouTubeAllowedList();
    showStatus('Channel added successfully', 'success');
}

function removeYouTubeChannel(channel) {
    const index = inAppSettings.youtube.allowedChannels.indexOf(channel);
    if (index > -1) {
        inAppSettings.youtube.allowedChannels.splice(index, 1);
        saveInAppSettings();
        updateYouTubeAllowedList();
        showStatus('Channel removed', 'success');
    }
}

function updateYouTubeAllowedList() {
    const container = document.getElementById('youtube-allowed-list');
    if (!container) return;
    
    container.innerHTML = '';
    
    inAppSettings.youtube.allowedChannels.forEach(channel => {
        const item = document.createElement('div');
        item.className = 'allowed-item';
        item.innerHTML = `
            <span>${channel}</span>
            <button onclick="removeYouTubeChannel('${channel}')">Remove</button>
        `;
        container.appendChild(item);
    });
}

function saveInAppSettings() {
    console.log('Saving in-app settings:', inAppSettings);
    
    chrome.storage.sync.set({ inAppSettings }, () => {
        if (chrome.runtime.lastError) {
            console.error('Failed to save in-app settings:', chrome.runtime.lastError);
        } else {
            console.log('In-app settings saved successfully');
            // Send message to content scripts to update blocking
            chrome.tabs.query({}, (tabs) => {
                console.log('Sending updateInAppBlocking message to', tabs.length, 'tabs');
                tabs.forEach(tab => {
                    // Only send to http/https tabs
                    if (tab.url && (tab.url.startsWith('http://') || tab.url.startsWith('https://'))) {
                        chrome.tabs.sendMessage(tab.id, {
                            type: 'updateInAppBlocking',
                            settings: inAppSettings
                        }).then(response => {
                            console.log('Message sent to tab', tab.id, 'response:', response);
                        }).catch(error => {
                            console.log('Failed to send message to tab', tab.id, ':', error.message);
                        });
                    }
                });
            });
        }
    });
}

function loadInAppSettings() {
    chrome.storage.sync.get(['inAppSettings'], (result) => {
        if (result.inAppSettings) {
            inAppSettings = { ...inAppSettings, ...result.inAppSettings };
        }
        
        // Update UI
        Object.keys(inAppSettings).forEach(app => {
            const toggle = document.getElementById(`${app}-enabled`);
            if (toggle) {
                toggle.checked = inAppSettings[app].enabled;
                updateAppCardState(app);
            }
            
            // Update feature toggles
            const features = inAppSettings[app].features;
            Object.keys(features).forEach(feature => {
                const featureToggle = document.getElementById(`${app}-${feature.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
                if (featureToggle) {
                    featureToggle.checked = features[feature];
                }
            });
        });
        
        updateYouTubeAllowedList();
    });
}

// Add in-app blocking setup to the existing setupEventListeners function
function setupInAppBlockingEventListeners() {
    setupInAppBlocking();
}

// ===== USAGE LIMITS FUNCTIONALITY =====

let usageLimits = {
    websites: {},
    keywords: {},
    dailyUsage: {},
    todayStats: {
        totalUsage: 0,
        limitExceeded: 0,
        sitesBlocked: 0
    }
};

// setupUsageLimitsEventListeners is now integrated into main setupEventListeners

function showNotification(message, type = 'info') {
    // Create notification element if it doesn't exist
    let notification = document.getElementById('notification-message');
    if (!notification) {
        notification = document.createElement('div');
        notification.id = 'notification-message';
        notification.style.cssText = `
            position: fixed;
            top: 20px;
            right: 20px;
            padding: 12px 20px;
            border-radius: 8px;
            color: white;
            font-weight: 500;
            z-index: 10000;
            transition: all 0.3s ease;
            max-width: 300px;
            word-wrap: break-word;
        `;
        document.body.appendChild(notification);
    }
    
    // Set color based on type
    const colors = {
        success: '#10b981',
        error: '#ef4444',
        info: '#3b82f6',
        warning: '#f59e0b'
    };
    
    notification.style.backgroundColor = colors[type] || colors.info;
    notification.textContent = message;
    notification.style.opacity = '1';
    notification.style.transform = 'translateX(0)';
    
    // Hide after 3 seconds
    setTimeout(() => {
        notification.style.opacity = '0';
        notification.style.transform = 'translateX(100%)';
    }, 3000);
}

function addWebsiteLimit() {
    const urlInput = document.getElementById('newWebsiteUrl');
    const limitInput = document.getElementById('newWebsiteLimit');
    
    if (!urlInput || !limitInput) return;
    
    const url = urlInput.value.trim();
    const limit = parseInt(limitInput.value);
    
    if (!url || !limit || limit <= 0) {
        showNotification('Please enter a valid website URL and time limit', 'error');
        return;
    }
    
    // Clean URL (remove protocol, www, etc.)
    const cleanUrl = url.replace(/^(https?:\/\/)?(www\.)?/, '').replace(/\/$/, '');
    
    if (usageLimits.websites[cleanUrl]) {
        showNotification('Website already has a time limit set', 'error');
        return;
    }
    
    usageLimits.websites[cleanUrl] = {
        limit: limit,
        used: 0,
        createdAt: Date.now()
    };
    
    saveUsageLimits();
    updateWebsiteLimitsList();
    
    // Clear inputs
    urlInput.value = '';
    limitInput.value = '';
    
    showNotification(`Time limit added for ${cleanUrl}`, 'success');
}

function addKeywordLimit() {
    const keywordInput = document.getElementById('newKeyword');
    const limitInput = document.getElementById('newKeywordLimit');
    
    if (!keywordInput || !limitInput) return;
    
    const keyword = keywordInput.value.trim().toLowerCase();
    const limit = parseInt(limitInput.value);
    
    if (!keyword || !limit || limit <= 0) {
        showNotification('Please enter a valid keyword and time limit', 'error');
        return;
    }
    
    if (usageLimits.keywords[keyword]) {
        showNotification('Keyword already has a time limit set', 'error');
        return;
    }
    
    usageLimits.keywords[keyword] = {
        limit: limit,
        used: 0,
        createdAt: Date.now()
    };
    
    saveUsageLimits();
    updateKeywordLimitsList();
    
    // Clear inputs
    keywordInput.value = '';
    limitInput.value = '';
    
    showNotification(`Time limit added for "${keyword}"`, 'success');
}

function updateWebsiteLimitsList() {
    const listElement = document.getElementById('website-limits-list');
    if (!listElement) return;
    
    listElement.innerHTML = '';
    
    if (Object.keys(usageLimits.websites).length === 0) {
        listElement.innerHTML = '<p style="color: rgba(255, 255, 255, 0.6); text-align: center; padding: 20px;">No website limits set</p>';
        return;
    }
    
    Object.entries(usageLimits.websites).forEach(([url, data]) => {
        const usagePercent = (data.used / data.limit) * 100;
        const progressClass = usagePercent >= 90 ? 'danger' : usagePercent >= 70 ? 'warning' : '';
        
        const item = document.createElement('div');
        item.className = 'usage-item';
        item.innerHTML = `
            <div class="usage-item-info">
                <div class="usage-item-name">${url}</div>
                <div class="usage-item-limit">${data.used}/${data.limit} minutes used</div>
                <div class="progress-bar" style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 4px;">
                    <div class="progress-fill ${progressClass}" style="width: ${Math.min(usagePercent, 100)}%; height: 100%;"></div>
                </div>
            </div>
            <div class="usage-item-actions">
                <button class="usage-item-edit" onclick="editWebsiteLimit('${url}')">Edit</button>
                <button class="usage-item-delete" onclick="deleteWebsiteLimit('${url}')">Delete</button>
            </div>
        `;
        listElement.appendChild(item);
    });
}

function updateKeywordLimitsList() {
    const listElement = document.getElementById('keyword-limits-list');
    if (!listElement) return;
    
    listElement.innerHTML = '';
    
    if (Object.keys(usageLimits.keywords).length === 0) {
        listElement.innerHTML = '<p style="color: rgba(255, 255, 255, 0.6); text-align: center; padding: 20px;">No keyword limits set</p>';
        return;
    }
    
    Object.entries(usageLimits.keywords).forEach(([keyword, data]) => {
        const usagePercent = (data.used / data.limit) * 100;
        const progressClass = usagePercent >= 90 ? 'danger' : usagePercent >= 70 ? 'warning' : '';
        
        const item = document.createElement('div');
        item.className = 'usage-item';
        item.innerHTML = `
            <div class="usage-item-info">
                <div class="usage-item-name">"${keyword}"</div>
                <div class="usage-item-limit">${data.used}/${data.limit} minutes used</div>
                <div class="progress-bar" style="width: 100%; height: 4px; background: rgba(255,255,255,0.1); border-radius: 2px; margin-top: 4px;">
                    <div class="progress-fill ${progressClass}" style="width: ${Math.min(usagePercent, 100)}%; height: 100%;"></div>
                </div>
            </div>
            <div class="usage-item-actions">
                <button class="usage-item-edit" onclick="editKeywordLimit('${keyword}')">Edit</button>
                <button class="usage-item-delete" onclick="deleteKeywordLimit('${keyword}')">Delete</button>
            </div>
        `;
        listElement.appendChild(item);
    });
}

function deleteWebsiteLimit(url) {
    if (confirm(`Are you sure you want to remove the time limit for ${url}?`)) {
        delete usageLimits.websites[url];
        saveUsageLimits();
        updateWebsiteLimitsList();
        updateUsageOverview();
        showNotification(`Time limit removed for ${url}`, 'success');
    }
}

function deleteKeywordLimit(keyword) {
    if (confirm(`Are you sure you want to remove the time limit for "${keyword}"?`)) {
        delete usageLimits.keywords[keyword];
        saveUsageLimits();
        updateKeywordLimitsList();
        updateUsageOverview();
        showNotification(`Time limit removed for "${keyword}"`, 'success');
    }
}

function editWebsiteLimit(url) {
    const newLimit = prompt(`Enter new daily limit (minutes) for ${url}:`, usageLimits.websites[url].limit);
    if (newLimit && !isNaN(newLimit) && newLimit > 0) {
        usageLimits.websites[url].limit = parseInt(newLimit);
        saveUsageLimits();
        updateWebsiteLimitsList();
        showNotification(`Limit updated for ${url}`, 'success');
    }
}

function editKeywordLimit(keyword) {
    const newLimit = prompt(`Enter new daily limit (minutes) for "${keyword}":`, usageLimits.keywords[keyword].limit);
    if (newLimit && !isNaN(newLimit) && newLimit > 0) {
        usageLimits.keywords[keyword].limit = parseInt(newLimit);
        saveUsageLimits();
        updateKeywordLimitsList();
        showNotification(`Limit updated for "${keyword}"`, 'success');
    }
}

function updateUsageOverview() {
    // Update stats
    const totalUsageEl = document.getElementById('totalUsageToday');
    const limitExceededEl = document.getElementById('limitExceeded');
    const sitesBlockedEl = document.getElementById('sitesBlocked');
    
    if (totalUsageEl) totalUsageEl.textContent = `${usageLimits.todayStats.totalUsage}m`;
    if (limitExceededEl) limitExceededEl.textContent = usageLimits.todayStats.limitExceeded;
    if (sitesBlockedEl) sitesBlockedEl.textContent = usageLimits.todayStats.sitesBlocked;
    
    // Update progress bars
    updateUsageProgressBars();
}

function updateUsageProgressBars() {
    const progressList = document.getElementById('usage-progress-list');
    if (!progressList) return;
    
    progressList.innerHTML = '';
    
    // Combine websites and keywords for progress display
    const allLimits = [];
    
    Object.entries(usageLimits.websites).forEach(([url, data]) => {
        allLimits.push({ name: url, used: data.used, limit: data.limit, type: 'website' });
    });
    
    Object.entries(usageLimits.keywords).forEach(([keyword, data]) => {
        allLimits.push({ name: `"${keyword}"`, used: data.used, limit: data.limit, type: 'keyword' });
    });
    
    if (allLimits.length === 0) {
        progressList.innerHTML = '<p style="color: rgba(255, 255, 255, 0.6); text-align: center;">No active limits to display</p>';
        return;
    }
    
    allLimits.forEach(limit => {
        const usagePercent = Math.min((limit.used / limit.limit) * 100, 100);
        const progressClass = usagePercent >= 90 ? 'danger' : usagePercent >= 70 ? 'warning' : '';
        
        const progressItem = document.createElement('div');
        progressItem.className = 'progress-item';
        progressItem.innerHTML = `
            <div class="progress-label">${limit.name}</div>
            <div class="progress-bar">
                <div class="progress-fill ${progressClass}" style="width: ${usagePercent}%"></div>
            </div>
            <div class="progress-text">${limit.used}/${limit.limit}m</div>
        `;
        progressList.appendChild(progressItem);
    });
}

function saveUsageLimits() {
    chrome.storage.sync.set({ usageLimits }, () => {
        console.log('Usage limits saved');
    });
}

function loadUsageLimits() {
    chrome.storage.sync.get(['usageLimits'], (result) => {
        if (result.usageLimits) {
            usageLimits = { ...usageLimits, ...result.usageLimits };
        }
        updateWebsiteLimitsList();
        updateKeywordLimitsList();
        updateUsageOverview();
    });
}

function initializeUsageLimits() {
    loadUsageLimits();
    
    // Simulate some usage data for demonstration
    setTimeout(() => {
        // Add some demo data if no limits exist
        if (Object.keys(usageLimits.websites).length === 0 && Object.keys(usageLimits.keywords).length === 0) {
            usageLimits.websites['youtube.com'] = { limit: 60, used: 45, createdAt: Date.now() };
            usageLimits.websites['facebook.com'] = { limit: 30, used: 28, createdAt: Date.now() };
            usageLimits.keywords['gaming'] = { limit: 120, used: 90, createdAt: Date.now() };
            usageLimits.todayStats = { totalUsage: 163, limitExceeded: 1, sitesBlocked: 12 };
            
            updateWebsiteLimitsList();
            updateKeywordLimitsList();
            updateUsageOverview();
        }
    }, 500);
}

// Usage limits initialization is now handled in main DOMContentLoaded

// ===== INSIGHTS FUNCTIONALITY =====

let insightsData = {
    calendar: {},
    browserUsage: {},
    siteUsage: {},
    recentActivity: [],
    historyPermission: false
};

let currentCalendarDate = new Date();

// setupInsightsEventListeners is now integrated into main setupEventListeners

function requestHistoryPermission() {
    if (typeof chrome !== 'undefined' && chrome.permissions) {
        chrome.permissions.request({
            permissions: ['history']
        }, (granted) => {
            if (granted) {
                insightsData.historyPermission = true;
                dismissHistoryBanner();
                loadHistoryData();
                showNotification('History access granted! Loading insights...', 'success');
            } else {
                showNotification('History permission denied', 'error');
            }
        });
    } else {
        // For development/testing - simulate granting permission
        insightsData.historyPermission = true;
        dismissHistoryBanner();
        generateDemoInsightsData();
        showNotification('Demo mode: History access simulated', 'success');
    }
}

function dismissHistoryBanner() {
    const banner = document.getElementById('history-permission-banner');
    if (banner) {
        banner.style.display = 'none';
    }
}

function navigateCalendar(direction) {
    currentCalendarDate.setMonth(currentCalendarDate.getMonth() + direction);
    updateCalendar();
}

function updateCalendar() {
    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'
    ];
    
    const currentMonthEl = document.getElementById('currentMonth');
    if (currentMonthEl) {
        currentMonthEl.textContent = `${monthNames[currentCalendarDate.getMonth()]} ${currentCalendarDate.getFullYear()}`;
    }
    
    const calendarDays = document.getElementById('calendarDays');
    if (!calendarDays) return;
    
    calendarDays.innerHTML = '';
    
    const year = currentCalendarDate.getFullYear();
    const month = currentCalendarDate.getMonth();
    
    // Get first day of month and number of days
    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const daysInPrevMonth = new Date(year, month, 0).getDate();
    
    // Add days from previous month
    for (let i = firstDay - 1; i >= 0; i--) {
        const day = daysInPrevMonth - i;
        const dayEl = createCalendarDay(day, true);
        calendarDays.appendChild(dayEl);
    }
    
    // Add days of current month
    for (let day = 1; day <= daysInMonth; day++) {
        const dayEl = createCalendarDay(day, false);
        calendarDays.appendChild(dayEl);
    }
    
    // Add days from next month to fill grid
    const totalCells = calendarDays.children.length;
    const remainingCells = 42 - totalCells; // 6 rows × 7 days
    for (let day = 1; day <= remainingCells; day++) {
        const dayEl = createCalendarDay(day, true);
        calendarDays.appendChild(dayEl);
    }
}

function createCalendarDay(day, otherMonth) {
    const dayEl = document.createElement('div');
    dayEl.className = 'calendar-day';
    dayEl.textContent = day;
    
    if (otherMonth) {
        dayEl.classList.add('other-month');
        return dayEl;
    }
    
    // Check if it's today
    const today = new Date();
    const isToday = (
        currentCalendarDate.getFullYear() === today.getFullYear() &&
        currentCalendarDate.getMonth() === today.getMonth() &&
        day === today.getDate()
    );
    
    if (isToday) {
        dayEl.classList.add('today');
    }
    
    // Add usage data if available
    const dateKey = `${currentCalendarDate.getFullYear()}-${currentCalendarDate.getMonth() + 1}-${day}`;
    const usage = insightsData.calendar[dateKey];
    
    if (usage) {
        if (usage >= 120) {
            dayEl.classList.add('high');
        } else if (usage >= 30) {
            dayEl.classList.add('medium');
        } else {
            dayEl.classList.add('low');
        }
        
        dayEl.title = `${usage} minutes of usage`;
    }
    
    return dayEl;
}

function loadHistoryData() {
    if (typeof chrome !== 'undefined' && chrome.history && insightsData.historyPermission) {
        // Get history from last 30 days
        const thirtyDaysAgo = Date.now() - (30 * 24 * 60 * 60 * 1000);
        
        chrome.history.search({
            text: '',
            startTime: thirtyDaysAgo,
            maxResults: 1000
        }, (historyItems) => {
            processHistoryData(historyItems);
        });
    } else {
        // Generate demo data for testing
        generateDemoInsightsData();
    }
}

function processHistoryData(historyItems) {
    // Process browser usage
    insightsData.browserUsage = { Chrome: historyItems.length };
    
    // Process site usage
    const siteVisits = {};
    const dailyUsage = {};
    
    historyItems.forEach(item => {
        try {
            const url = new URL(item.url);
            const domain = url.hostname.replace('www.', '');
            
            // Count site visits
            siteVisits[domain] = (siteVisits[domain] || 0) + item.visitCount;
            
            // Calculate daily usage (approximate)
            const date = new Date(item.lastVisitTime);
            const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
            dailyUsage[dateKey] = (dailyUsage[dateKey] || 0) + Math.min(item.visitCount * 2, 30); // Estimate 2 min per visit, max 30 min per site per day
            
        } catch (e) {
            console.log('Invalid URL:', item.url);
        }
    });
    
    insightsData.siteUsage = Object.entries(siteVisits)
        .sort(([,a], [,b]) => b - a)
        .slice(0, 10)
        .reduce((obj, [key, value]) => ({ ...obj, [key]: value }), {});
    
    insightsData.calendar = dailyUsage;
    
    updateInsightsDisplay();
}

function generateDemoInsightsData() {
    // Generate demo calendar data
    for (let i = 0; i < 30; i++) {
        const date = new Date();
        date.setDate(date.getDate() - i);
        const dateKey = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
        insightsData.calendar[dateKey] = Math.floor(Math.random() * 200) + 10;
    }
    
    // Demo browser usage
    insightsData.browserUsage = {
        'Chrome': 45,
        'Work': 25,
        'Entertainment': 20,
        'Social': 10
    };
    
    // Demo site usage
    insightsData.siteUsage = {
        'youtube.com': 120,
        'github.com': 85,
        'stackoverflow.com': 65,
        'twitter.com': 45,
        'reddit.com': 35,
        'facebook.com': 25
    };
    
    // Demo recent activity
    insightsData.recentActivity = [
        { icon: '🚫', text: 'Blocked access to facebook.com', time: '2 minutes ago' },
        { icon: '⏰', text: 'Usage limit reached for youtube.com', time: '15 minutes ago' },
        { icon: '🎯', text: 'Focus mode activated', time: '1 hour ago' },
        { icon: '📊', text: 'Daily usage report generated', time: '3 hours ago' },
        { icon: '🔒', text: 'New website added to block list', time: '5 hours ago' }
    ];
    
    updateInsightsDisplay();
}

function updateInsightsDisplay() {
    updateCalendar();
    updatePieCharts();
    updateRecentActivity();
    updateInsightsStats();
}

function updatePieCharts() {
    // Browser usage pie chart
    drawPieChart('browserPieChart', insightsData.browserUsage, 'browserLegend', [
        '#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6', '#06b6d4'
    ]);
    
    // Site usage pie chart
    drawPieChart('sitesPieChart', insightsData.siteUsage, 'sitesLegend', [
        '#ef4444', '#f59e0b', '#10b981', '#3b82f6', '#8b5cf6', '#06b6d4'
    ]);
}

function drawPieChart(canvasId, data, legendId, colors) {
    const canvas = document.getElementById(canvasId);
    const legend = document.getElementById(legendId);
    
    if (!canvas || !legend) return;
    
    const ctx = canvas.getContext('2d');
    const centerX = canvas.width / 2;
    const centerY = canvas.height / 2;
    const radius = Math.min(centerX, centerY) - 20;
    
    // Clear canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // Calculate total and percentages
    const entries = Object.entries(data);
    const total = entries.reduce((sum, [, value]) => sum + value, 0);
    
    if (total === 0) {
        // Draw empty state
        ctx.fillStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        ctx.fill();
        
        ctx.fillStyle = 'rgba(255, 255, 255, 0.6)';
        ctx.font = '14px Arial';
        ctx.textAlign = 'center';
        ctx.fillText('No data available', centerX, centerY);
        
        legend.innerHTML = '<p style="color: rgba(255, 255, 255, 0.6);">No data to display</p>';
        return;
    }
    
    // Draw pie slices
    let startAngle = -Math.PI / 2; // Start at top
    legend.innerHTML = '';
    
    entries.forEach(([label, value], index) => {
        const percentage = (value / total);
        const endAngle = startAngle + (percentage * 2 * Math.PI);
        const color = colors[index % colors.length];
        
        // Draw slice
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.moveTo(centerX, centerY);
        ctx.arc(centerX, centerY, radius, startAngle, endAngle);
        ctx.closePath();
        ctx.fill();
        
        // Add legend entry
        const legendEntry = document.createElement('div');
        legendEntry.className = 'legend-entry';
        legendEntry.innerHTML = `
            <div class="legend-dot" style="background-color: ${color}"></div>
            <span>${label} (${Math.round(percentage * 100)}%)</span>
        `;
        legend.appendChild(legendEntry);
        
        startAngle = endAngle;
    });
}

function updateRecentActivity() {
    const activityList = document.getElementById('recentActivity');
    if (!activityList) return;
    
    activityList.innerHTML = '';
    
    if (insightsData.recentActivity.length === 0) {
        activityList.innerHTML = '<p style="color: rgba(255, 255, 255, 0.6); text-align: center; padding: 20px;">No recent activity</p>';
        return;
    }
    
    insightsData.recentActivity.forEach(activity => {
        const activityItem = document.createElement('div');
        activityItem.className = 'activity-item';
        activityItem.innerHTML = `
            <div class="activity-icon">${activity.icon}</div>
            <div class="activity-text">${activity.text}</div>
            <div class="activity-time">${activity.time}</div>
        `;
        activityList.appendChild(activityItem);
    });
}

function updateInsightsStats() {
    // Update the existing stats in the insights section
    const totalUsageEl = document.getElementById('totalUsageTime');
    if (totalUsageEl) {
        const totalUsage = Object.values(insightsData.calendar).reduce((sum, usage) => sum + usage, 0);
        totalUsageEl.textContent = `${Math.round(totalUsage / 30)}m avg`;
    }
}

function initializeInsights() {
    // Check if we already have history permission
    if (typeof chrome !== 'undefined' && chrome.permissions) {
        chrome.permissions.contains({
            permissions: ['history']
        }, (hasPermission) => {
            if (hasPermission) {
                insightsData.historyPermission = true;
                dismissHistoryBanner();
                loadHistoryData();
            }
        });
    } else {
        // For development - generate demo data
        setTimeout(generateDemoInsightsData, 500);
    }
    
    updateCalendar();
}

// Insights initialization is now handled in main DOMContentLoaded

// ===== DISABLE BLOCKING DIALOG FUNCTIONALITY =====

// setupDisableBlockingEventListeners is now integrated into main setupEventListeners

function showDisableBlockingDialog() {
    const dialog = document.getElementById('disableBlockingDialog');
    if (dialog) {
        dialog.style.display = 'flex';
    }
}

function hideDisableBlockingDialog() {
    const dialog = document.getElementById('disableBlockingDialog');
    if (dialog) {
        dialog.style.display = 'none';
    }
}

function handleDisableBlocking(durationSeconds) {
    hideDisableBlockingDialog();
    
    if (durationSeconds === 0) {
        // Permanently disable
        if (confirm('Are you sure you want to permanently disable blocking? You can re-enable it anytime from the settings.')) {
            disableBlockingPermanently();
        }
    } else {
        // Temporarily disable
        disableBlockingTemporarily(durationSeconds);
    }
}

function disableBlockingPermanently() {
    const masterToggle = document.getElementById('masterToggle');
    if (masterToggle) {
        masterToggle.checked = false;
    }
    
    settings.blockingEnabled = false;
    settings.blockingDisabledUntil = null;
    saveSettings();
    
    showNotification('Blocking disabled permanently', 'success');
    updateBlockingStatus();
}

function disableBlockingTemporarily(durationSeconds) {
    const masterToggle = document.getElementById('masterToggle');
    if (masterToggle) {
        masterToggle.checked = false;
    }
    
    const disableUntil = Date.now() + (durationSeconds * 1000);
    
    settings.blockingEnabled = false;
    settings.blockingDisabledUntil = disableUntil;
    saveSettings();
    
    const hours = Math.floor(durationSeconds / 3600);
    const minutes = Math.floor((durationSeconds % 3600) / 60);
    
    let timeString = '';
    if (durationSeconds === 86400) {
        timeString = 'until midnight';
    } else if (hours > 0) {
        timeString = `for ${hours} hour${hours > 1 ? 's' : ''}`;
        if (minutes > 0) {
            timeString += ` and ${minutes} minute${minutes > 1 ? 's' : ''}`;
        }
    } else {
        timeString = `for ${minutes} minute${minutes > 1 ? 's' : ''}`;
    }
    
    showNotification(`Blocking disabled ${timeString}`, 'success');
    updateBlockingStatus();
    
    // Set up automatic re-enable
    setTimeout(() => {
        checkBlockingReenableTime();
    }, 1000);
}

function checkBlockingReenableTime() {
    if (settings.blockingDisabledUntil && Date.now() >= settings.blockingDisabledUntil) {
        // Re-enable blocking
        const masterToggle = document.getElementById('masterToggle');
        if (masterToggle) {
            masterToggle.checked = true;
        }
        
        settings.blockingEnabled = true;
        settings.blockingDisabledUntil = null;
        saveSettings();
        
        showNotification('Blocking has been automatically re-enabled', 'success');
        updateBlockingStatus();
    } else if (settings.blockingDisabledUntil) {
        // Check again in 1 minute
        setTimeout(checkBlockingReenableTime, 60000);
    }
}

function updateBlockingStatus() {
    // Update UI to show current blocking status
    const masterToggle = document.getElementById('masterToggle');
    if (!masterToggle) return;
    
    if (settings.blockingDisabledUntil && Date.now() < settings.blockingDisabledUntil) {
        // Show countdown or status
        const remainingMs = settings.blockingDisabledUntil - Date.now();
        const remainingHours = Math.floor(remainingMs / (1000 * 60 * 60));
        const remainingMinutes = Math.floor((remainingMs % (1000 * 60 * 60)) / (1000 * 60));
        
        // You could add a status element to show remaining time
        console.log(`Blocking disabled for ${remainingHours}h ${remainingMinutes}m`);
    }
}

function initializeDisableBlockingDialog() {
    // Check if blocking should be re-enabled on startup
    if (settings.blockingDisabledUntil) {
        checkBlockingReenableTime();
    }
}

// Disable blocking dialog initialization is now handled in main DOMContentLoaded