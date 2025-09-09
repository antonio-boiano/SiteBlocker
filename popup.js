document.addEventListener('DOMContentLoaded', async () => {
    const currentUrlElement = document.getElementById('currentUrl');
    const blockStatusElement = document.getElementById('blockStatus');
    const toggleButton = document.getElementById('toggleSite');
    const openSettingsButton = document.getElementById('openSettings');
    const blockedCountElement = document.getElementById('blockedCount');
    const currentPolicyElement = document.getElementById('currentPolicy');
    
    let currentDomain = '';
    let blockLists = [];
    let settings = {};
    
    try {
        const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
        if (tab.url) {
            const url = new URL(tab.url);
            currentDomain = url.hostname.replace(/^www\./, '');
            currentUrlElement.textContent = currentDomain;
        }
    } catch (error) {
        currentUrlElement.textContent = 'Unable to access current site';
        console.error('Error getting current tab:', error);
    }
    
    async function loadData() {
        try {
            const result = await chrome.storage.sync.get(['blockLists', 'settings']);
            blockLists = result.blockLists || [];
            settings = result.settings || { blockingEnabled: true };
            
            updateUI();
        } catch (error) {
            console.error('Error loading data:', error);
        }
    }
    
    // Improved domain matching function
    function isdomainMatch(currentDomain, blockedSite) {
        // Handle exact matches
        if (currentDomain === blockedSite) return true;
        
        // Handle www variations
        const normalizedCurrent = currentDomain.replace(/^www\./, '');
        const normalizedBlocked = blockedSite.replace(/^www\./, '');
        if (normalizedCurrent === normalizedBlocked) return true;
        
        // Handle subdomain matching (blocked site is parent domain)
        if (currentDomain.endsWith('.' + normalizedBlocked)) return true;
        if (normalizedCurrent.endsWith('.' + normalizedBlocked)) return true;
        
        // Handle keyword blocking (entries wrapped with *)
        if (blockedSite.startsWith('*') && blockedSite.endsWith('*')) {
            const keyword = blockedSite.slice(1, -1).toLowerCase();
            return currentDomain.toLowerCase().includes(keyword);
        }
        
        return false;
    }
    
    function updateUI() {
        let isBlocked = false;
        let blockingList = null;
        
        for (const list of blockLists) {
            if (list.enabled && list.websites.some(site => 
                isdomainMatch(currentDomain, site)
            )) {
                isBlocked = true;
                blockingList = list;
                break;
            }
        }
        
        if (isBlocked) {
            blockStatusElement.textContent = 'BLOCKED';
            blockStatusElement.className = 'status blocked';
            toggleButton.textContent = 'Remove from Block Lists';
            toggleButton.className = 'secondary-btn';
        } else {
            blockStatusElement.textContent = 'ALLOWED';
            blockStatusElement.className = 'status allowed';
            toggleButton.textContent = 'Add to Default Block List';
            toggleButton.className = 'primary-btn';
        }
        
        const totalSites = blockLists.reduce((sum, list) => sum + list.websites.length, 0);
        blockedCountElement.textContent = totalSites;
        
        const activePolicy = blockingList ? blockingList.blockPolicy : 'strict';
        currentPolicyElement.textContent = activePolicy === 'strict' ? 'Strict Block' : 'Make it Harder';
        
        if (!currentDomain || currentDomain.includes('chrome://') || currentDomain.includes('chrome-extension://')) {
            toggleButton.disabled = true;
            toggleButton.textContent = 'Cannot block this page';
        }
    }
    
    toggleButton.addEventListener('click', async () => {
        if (!currentDomain) return;
        
        try {
            let isCurrentlyBlocked = false;
            
            // Check if site is currently blocked and remove from all lists
            for (const list of blockLists) {
                const siteIndex = list.websites.findIndex(site => 
                    isdomainMatch(currentDomain, site)
                );
                if (siteIndex !== -1) {
                    list.websites.splice(siteIndex, 1);
                    isCurrentlyBlocked = true;
                }
            }
            
            // If not blocked, add to default list
            if (!isCurrentlyBlocked) {
                if (blockLists.length === 0) {
                    blockLists.push({
                        id: 'default',
                        name: 'Default Block List',
                        websites: [currentDomain],
                        schedule: { days: [], intervals: [{ start: '09:00', end: '17:00' }] },
                        blockPolicy: 'strict',
                        customRedirect: '',
                        enabled: true
                    });
                } else {
                    blockLists[0].websites.push(currentDomain);
                }
            }
            
            await chrome.storage.sync.set({ blockLists });
            chrome.runtime.sendMessage({ action: 'updateRules' });
            
            updateUI();
        } catch (error) {
            console.error('Error toggling site block:', error);
        }
    });
    
    openSettingsButton.addEventListener('click', () => {
        chrome.runtime.openOptionsPage();
        window.close();
    });
    
    await loadData();
});