chrome.runtime.onInstalled.addListener(() => {
    console.log('Site Blocker extension installed');
    setTimeout(updateBlockingRules, 1000); // Give extension time to initialize
});

// Helper function to check if a domain is temporarily unblocked
async function checkTemporaryUnblock(domain, originalDomain) {
    const currentTime = Date.now();
    
    // Check chrome.storage.local first
    const tempUnblockKeys = [`temp_unblock_${domain}`, `temp_unblock_${originalDomain}`];
    if (originalDomain !== domain) {
        tempUnblockKeys.push(`temp_unblock_www.${domain}`);
    }
    
    try {
        const tempUnblockResult = await chrome.storage.local.get(tempUnblockKeys);
        const expiredKeys = [];
        
        for (const key of tempUnblockKeys) {
            const unblockUntil = tempUnblockResult[key];
            if (unblockUntil) {
                if (currentTime < unblockUntil) {
                    console.log(`Domain ${originalDomain} temporarily unblocked via chrome.storage until ${new Date(unblockUntil).toLocaleTimeString()}`);
                    return true;
                } else {
                    expiredKeys.push(key);
                }
            }
        }
        
        // Clean up expired keys
        if (expiredKeys.length > 0) {
            await chrome.storage.local.remove(expiredKeys);
        }
    } catch (error) {
        console.warn('Failed to check chrome.storage.local for temporary unblock:', error);
    }
    
    return false;
}

let updateTimeout = null;

function debouncedUpdateBlockingRules() {
    if (updateTimeout) {
        clearTimeout(updateTimeout);
    }
    updateTimeout = setTimeout(updateBlockingRules, 500);
}

chrome.runtime.onMessage.addListener(async (request, sender, sendResponse) => {
    if (request.action === 'updateRules') {
        debouncedUpdateBlockingRules();
    } else if (request.action === 'setTempUnblock') {
        try {
            const storageData = {};
            storageData[`temp_unblock_${request.domain}`] = request.unblockUntil;
            storageData[`temp_unblock_www.${request.domain}`] = request.unblockUntil;
            
            await chrome.storage.local.set(storageData);
            console.log('Background: Temporary unblock stored:', storageData);
            
            // Trigger rule update
            debouncedUpdateBlockingRules();
        } catch (error) {
            console.error('Background: Failed to store temp unblock:', error);
        }
    }
});

chrome.storage.onChanged.addListener((changes) => {
    if (changes.blockLists || changes.settings) {
        debouncedUpdateBlockingRules();
    }
});

let isUpdatingRules = false;

async function updateBlockingRules() {
    if (isUpdatingRules) {
        console.log('Rules update already in progress, skipping...');
        return;
    }
    
    isUpdatingRules = true;
    try {
        const result = await chrome.storage.sync.get(['blockLists', 'settings']);
        
        const blockLists = result.blockLists || [];
        const settings = result.settings || { blockingEnabled: true };
        
        // We'll check temporary unblocks per website in the loop below
        
        const existingRules = await chrome.declarativeNetRequest.getDynamicRules();
        const ruleIds = existingRules.map(rule => rule.id);
        
        if (ruleIds.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                removeRuleIds: ruleIds
            });
        }
        
        if (!settings.blockingEnabled) {
            console.log('Blocking disabled, rules cleared');
            return;
        }
        
        const rules = [];
        let ruleId = 1;
        
        for (const list of blockLists) {
            if (!list.enabled) continue;
            
            for (const website of list.websites) {
                if (!website || typeof website !== 'string') continue;
                
                // Check if this domain has temporary unblock
                const normalizedWebsite = website.replace(/^www\./, '');
                const isTemporarilyUnblocked = await checkTemporaryUnblock(normalizedWebsite, website);
                
                if (isTemporarilyUnblocked) {
                    console.log(`Skipping rule for ${website} - temporarily unblocked`);
                    continue; // Skip adding rule for this domain
                }
                
                // Skip creating declarative rules if custom redirect is configured
                // Let the tab-based logic handle custom redirects
                if (list.customRedirect && list.customRedirect.startsWith('http')) {
                    console.log(`Skipping declarative rule for ${website} - custom redirect configured`);
                    continue;
                }
                
                // Create declarative rule for this website
                // Note: We'll use a simple redirect to our blocked page
                // The tab checking will still handle complex logic like schedules and temporary unblocks
                const blockPage = list.blockPolicy === 'difficult' ? 'blocked-challenge.html' : 'blocked-strict.html';
                
                const rule = {
                    id: ruleId++,
                    priority: 1,
                    action: {
                        type: 'redirect',
                        redirect: {
                            url: chrome.runtime.getURL(blockPage)
                        }
                    },
                    condition: {
                        urlFilter: `||${normalizedWebsite}`,
                        resourceTypes: ['main_frame']
                    }
                };
                
                rules.push(rule);
                
                // Handle www variations (only if no custom redirect)
                if (!normalizedWebsite.startsWith('www.')) {
                    rules.push({
                        id: ruleId++,
                        priority: 1,
                        action: {
                            type: 'redirect',
                            redirect: {
                                url: chrome.runtime.getURL(`${blockPage}?url={url}`)
                            }
                        },
                        condition: {
                            urlFilter: `||www.${normalizedWebsite}`,
                            resourceTypes: ['main_frame']
                        }
                    });
                }
                
                console.log(`Created blocking rule for ${website} (rule ID: ${rule.id})`)
                
                if (rules.length >= 100) break;
            }
            if (rules.length >= 100) break;
        }
        
        if (rules.length > 0) {
            await chrome.declarativeNetRequest.updateDynamicRules({
                addRules: rules
            });
        }
        
        console.log(`Blocking rules updated: ${rules.length} rules active`);
    } catch (error) {
        console.error('Error updating blocking rules:', error);
    } finally {
        isUpdatingRules = false;
    }
}

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.status === 'complete' && tab.url) {
        checkTabBlocking(tab);
    }
});

async function checkTabBlocking(tab) {
    try {
        console.log(`Background: Checking tab blocking for: ${tab.url}`);
        const result = await chrome.storage.sync.get(['blockLists', 'settings']);
        const blockLists = result.blockLists || [];
        const settings = result.settings || { blockingEnabled: true };
        
        console.log(`Background: Found ${blockLists.length} block lists, blocking enabled: ${settings.blockingEnabled}`);
        
        if (!settings.blockingEnabled) {
            console.log(`Background: Blocking is disabled globally`);
            return;
        }
        
        const url = new URL(tab.url);
        const originalDomain = url.hostname;
        const domain = originalDomain.replace(/^www\./, '');
        
        console.log(`Background: Checking domain: ${domain} (original: ${originalDomain})`);
        
        // Check if domain has temporary unblock
        const isTemporarilyUnblocked = await checkTemporaryUnblock(domain, originalDomain);
        
        if (isTemporarilyUnblocked) {
            console.log(`Domain ${originalDomain} is temporarily unblocked`);
            return; // Skip blocking
        }
        
        for (const list of blockLists) {
            if (!list.enabled || !list.websites) continue;
            
            console.log(`Background: Checking list "${list.name}" with policy "${list.blockPolicy}"`);
            console.log(`Background: List websites:`, list.websites);
            
            const isBlocked = list.websites.some(site => {
                // Handle keyword blocking (entries wrapped with *)
                if (site.startsWith('*') && site.endsWith('*')) {
                    const keyword = site.slice(1, -1).toLowerCase();
                    return tab.url.toLowerCase().includes(keyword);
                }
                
                // Handle regular domain blocking
                return domain === site || domain.endsWith('.' + site) || site.endsWith('.' + domain);
            });
            
            if (isBlocked && isWithinBlockedTimeForTab(list)) {
                console.log(`Background: Blocking ${originalDomain} by list "${list.name}" with policy ${list.blockPolicy || 'default'}`);
                
                let redirectUrl;
                if (list.customRedirect && list.customRedirect.startsWith('http')) {
                    redirectUrl = list.customRedirect;
                } else {
                    // Determine which block page to use based on policy
                    const blockPolicy = list.blockPolicy || 'strict';
                    let blockPageFile;
                    
                    switch (blockPolicy) {
                        case 'strict':
                            blockPageFile = 'blocked-strict.html';
                            break;
                        case 'difficult':
                            blockPageFile = 'blocked-challenge.html';
                            break;
                        case 'scheduled':
                            // For scheduled policy, determine current mode based on time
                            blockPageFile = getCurrentScheduledBlockMode(list);
                            break;
                        default:
                            blockPageFile = 'blocked-strict.html';
                    }
                    
                    redirectUrl = chrome.runtime.getURL(`${blockPageFile}?url=${encodeURIComponent(tab.url)}`);
                }
                
                console.log(`Background: Redirecting to ${redirectUrl} (policy: ${list.blockPolicy || 'default'})`);
                    
                chrome.tabs.update(tab.id, { url: redirectUrl });
                break;
            }
        }
    } catch (error) {
        console.error('Error checking tab blocking:', error);
    }
}

function getCurrentScheduledBlockMode(blockList) {
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Check if current time falls within strict schedule
    if (blockList.strictSchedule) {
        const [startHour, startMin] = (blockList.strictSchedule.start || '09:00').split(':').map(Number);
        const [endHour, endMin] = (blockList.strictSchedule.end || '17:00').split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        if (currentTime >= startMinutes && currentTime <= endMinutes) {
            return 'blocked-strict.html';
        }
    }
    
    // Default to challenge mode for all other times (outside strict schedule)
    return 'blocked-challenge.html';
}

function isWithinBlockedTimeForTab(blockList) {
    console.log(`Background: Checking schedule for list "${blockList.name}"`);
    console.log(`Background: Schedule:`, blockList.schedule);
    
    if (!blockList || !blockList.schedule) {
        console.log(`Background: No schedule found, blocking allowed`);
        return true;
    }
    
    // If schedule is disabled, always block
    if (blockList.schedule.enabled === false) {
        console.log(`Background: Schedule is disabled, blocking allowed`);
        return true;
    }
    
    // If no days are configured, block all the time
    if (!blockList.schedule.days || blockList.schedule.days.length === 0) {
        console.log(`Background: No days configured, blocking allowed`);
        return true;
    }
    
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    console.log(`Background: Current day: ${currentDay}, current time: ${Math.floor(currentTime/60)}:${String(currentTime%60).padStart(2,'0')}`);
    console.log(`Background: Scheduled days: ${blockList.schedule.days}`);
    
    if (!blockList.schedule.days.includes(currentDay)) {
        console.log(`Background: Current day not in schedule, blocking not allowed`);
        return false;
    }
    
    // If no intervals are set, block all day
    if (!blockList.schedule.intervals || blockList.schedule.intervals.length === 0) {
        console.log(`Background: No time intervals configured, blocking allowed all day`);
        return true;
    }
    
    console.log(`Background: Checking time intervals:`, blockList.schedule.intervals);
    
    const withinTime = blockList.schedule.intervals.some(interval => {
        if (!interval.start || !interval.end) return false;
        
        const [startHour, startMin] = interval.start.split(':').map(Number);
        const [endHour, endMin] = interval.end.split(':').map(Number);
        const startMinutes = startHour * 60 + startMin;
        const endMinutes = endHour * 60 + endMin;
        
        const isWithin = currentTime >= startMinutes && currentTime <= endMinutes;
        console.log(`Background: Interval ${interval.start}-${interval.end}: within time = ${isWithin}`);
        
        return isWithin;
    });
    
    console.log(`Background: Final result - blocking allowed: ${withinTime}`);
    return withinTime;
}

chrome.action.onClicked.addListener(() => {
    chrome.runtime.openOptionsPage();
});

// Listen for temporary unblock changes
chrome.storage.onChanged.addListener((changes, areaName) => {
    if (areaName === 'local') {
        // Check if any temp_unblock keys were modified
        const tempUnblockChanged = Object.keys(changes).some(key => key.startsWith('temp_unblock_'));
        if (tempUnblockChanged) {
            console.log('Temporary unblock status changed, updating rules...');
            debouncedUpdateBlockingRules();
        }
    }
});

// Clean up expired temporary unblocks every minute
setInterval(async () => {
    try {
        const tempUnblocks = await chrome.storage.local.get();
        const currentTime = Date.now();
        const expiredKeys = [];
        
        for (const [key, value] of Object.entries(tempUnblocks)) {
            if (key.startsWith('temp_unblock_') && currentTime >= value) {
                expiredKeys.push(key);
            }
        }
        
        if (expiredKeys.length > 0) {
            await chrome.storage.local.remove(expiredKeys);
            console.log(`Cleaned up ${expiredKeys.length} expired temporary unblocks`);
            debouncedUpdateBlockingRules(); // Update rules after cleanup
        }
    } catch (error) {
        console.error('Error cleaning up temporary unblocks:', error);
    }
}, 60000); // Check every minute