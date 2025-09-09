function sanitizeHtml(unsafe) {
    return unsafe
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#039;");
}

function validateTime(time) {
    const timeRegex = /^([01]?[0-9]|2[0-3]):[0-5][0-9]$/;
    return timeRegex.test(time);
}

function validateSettings(settings) {
    if (typeof settings !== 'object' || settings === null) return false;
    
    if (settings.hasOwnProperty('enableSchedule') && typeof settings.enableSchedule !== 'boolean') return false;
    
    if (settings.hasOwnProperty('days') && (!Array.isArray(settings.days) || 
        !settings.days.every(day => typeof day === 'number' && day >= 0 && day <= 6))) return false;
    
    if (settings.hasOwnProperty('startTime') && !validateTime(settings.startTime)) return false;
    
    if (settings.hasOwnProperty('endTime') && !validateTime(settings.endTime)) return false;
    
    if (settings.hasOwnProperty('blockPolicy') && 
        !['strict', 'difficult'].includes(settings.blockPolicy)) return false;
    
    return true;
}

function sanitizeWebsiteList(websites) {
    if (!Array.isArray(websites)) return [];
    
    return websites
        .filter(site => typeof site === 'string' && site.length > 0 && site.length <= 100)
        .slice(0, 100)
        .map(site => site.toLowerCase().trim());
}