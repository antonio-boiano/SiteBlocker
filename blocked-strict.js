document.addEventListener('DOMContentLoaded', function() {
    const params = new URLSearchParams(window.location.search);
    const originalUrl = params.get('url');
    const blockedUrlElement = document.getElementById('blockedUrl');
    
    if (originalUrl) {
        try {
            blockedUrlElement.textContent = decodeURIComponent(originalUrl);
        } catch (error) {
            console.error('Error decoding URL:', error);
            blockedUrlElement.textContent = 'Blocked Website';
        }
    } else {
        blockedUrlElement.textContent = 'Blocked Website';
    }

    // Update current time every second
    function updateTime() {
        const now = new Date();
        const timeString = now.toLocaleTimeString('en-US', { 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit',
            hour12: true 
        });
        document.getElementById('currentTime').textContent = timeString;
    }
    
    updateTime();
    setInterval(updateTime, 1000);
});