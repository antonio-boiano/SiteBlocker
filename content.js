let isBlocked = false;
let settings = {};
let blockLists = [];

function getCurrentDomain() {
    return window.location.hostname.replace(/^www\./, '');
}

// Helper function to check if current domain is temporarily unblocked
async function checkTemporaryUnblockContent(domain) {
    // Check if extension is ready before proceeding
    if (!isExtensionReady()) {
        console.log('Site Blocker: Extension not ready, skipping temp unblock check');
        return false;
    }
    
    // Double-check extension context is valid
    try {
        if (!chrome?.runtime?.id) {
            console.log('Site Blocker: Extension context invalid, skipping temp unblock check');
            return false;
        }
    } catch (error) {
        console.log('Site Blocker: Extension context check failed, skipping temp unblock check');
        return false;
    }
    
    const currentTime = Date.now();
    const originalDomain = window.location.hostname;
    
    // Check chrome.storage.local first
    const tempUnblockKeys = [`temp_unblock_${domain}`, `temp_unblock_${originalDomain}`];
    if (originalDomain !== domain) {
        tempUnblockKeys.push(`temp_unblock_www.${domain}`);
    }
    
    console.log(`Site Blocker: Checking temp unblock keys:`, tempUnblockKeys);
    
    try {
        const tempUnblockResult = await chrome.storage.local.get(tempUnblockKeys);
        console.log(`Site Blocker: Storage result:`, tempUnblockResult);
        
        const expiredKeys = [];
        
        for (const key of tempUnblockKeys) {
            const unblockUntil = tempUnblockResult[key];
            if (unblockUntil) {
                const timeLeft = unblockUntil - currentTime;
                console.log(`Site Blocker: ${key} expires at ${new Date(unblockUntil).toLocaleTimeString()}, time left: ${Math.round(timeLeft / 1000)}s`);
                
                if (currentTime < unblockUntil) {
                    console.log(`Site Blocker: Found active temp unblock for ${key}`);
                    return true;
                } else {
                    console.log(`Site Blocker: ${key} has expired`);
                    expiredKeys.push(key);
                }
            } else {
                console.log(`Site Blocker: ${key} not found in storage`);
            }
        }
        
        // Clean up expired keys
        if (expiredKeys.length > 0) {
            console.log(`Site Blocker: Cleaning up expired keys:`, expiredKeys);
            await chrome.storage.local.remove(expiredKeys);
        }
    } catch (error) {
        // Handle extension context invalidated specifically
        try {
            if (error && error.message && error.message.includes('Extension context invalidated')) {
                console.log('Site Blocker: Extension context invalidated in temp unblock check, returning false');
                return false;
            }
        } catch (nestedError) {
            console.log('Site Blocker: Error in temp unblock check, returning false');
            return false;
        }
        
        console.log(`Site Blocker: Chrome storage failed, trying localStorage:`, error);
        
        // Fallback to localStorage if chrome.storage fails
        try {
            const backupKey = `site_blocker_temp_unblock_${domain}`;
            const backupValue = localStorage.getItem(backupKey);
            console.log(`Site Blocker: localStorage ${backupKey}:`, backupValue);
            
            if (backupValue) {
                const unblockUntil = parseInt(backupValue);
                if (currentTime < unblockUntil) {
                    console.log(`Site Blocker: Found active temp unblock in localStorage`);
                    return true;
                } else {
                    console.log(`Site Blocker: localStorage backup has expired`);
                    localStorage.removeItem(backupKey);
                }
            }
        } catch (localStorageError) {
            console.log(`Site Blocker: localStorage also failed:`, localStorageError);
        }
    }
    
    console.log(`Site Blocker: No active temp unblock found for ${domain}`);
    return false;
}

async function setTemporaryUnblock() {
    if (!isExtensionReady()) {
        console.log('Site Blocker: Extension not ready, cannot set temp unblock');
        return;
    }
    
    try {
        // Get unlock duration from settings
        const result = await chrome.storage.sync.get(['triviaSettings']);
        const unlockDuration = result.triviaSettings?.unlockDuration || 10;
        
        const currentDomain = getCurrentDomain();
        const unblockUntil = Date.now() + (unlockDuration * 60 * 1000);
        
        console.log(`Site Blocker: Setting temporary unblock for ${currentDomain} for ${unlockDuration} minutes`);
        
        // Send message to background script to handle storage
        await chrome.runtime.sendMessage({ 
            action: 'setTempUnblock',
            domain: currentDomain,
            unblockUntil: unblockUntil
        });
        
        console.log('Site Blocker: Temporary unblock message sent to background');
        
    } catch (error) {
        console.error('Site Blocker: Failed to set temporary unblock:', error);
    }
}

function isCurrentSiteBlocked() {
    const currentDomain = getCurrentDomain();
    if (!currentDomain || currentDomain.length === 0) return false;
    
    for (const list of blockLists) {
        if (!list.enabled) continue;
        
        const isInList = list.websites.some(site => {
            if (!site || site.length === 0) return false;
            return currentDomain === site || currentDomain.endsWith('.' + site) || site.endsWith('.' + currentDomain);
        });
        
        if (isInList) {
            return { blocked: true, list: list };
        }
    }
    
    return { blocked: false };
}

function isWithinBlockedTime(blockList) {
    if (!blockList || !blockList.schedule || !blockList.schedule.days) return true;
    
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // If no days are scheduled, block all the time
    if (blockList.schedule.days.length === 0) return true;
    
    if (!blockList.schedule.days.includes(currentDay)) return false;
    
    // If no intervals are set, block all day
    if (!blockList.schedule.intervals || blockList.schedule.intervals.length === 0) return true;
    
    return blockList.schedule.intervals.some(interval => {
        if (!interval.start || !interval.end) return false;
        
        try {
            const [startHour, startMin] = interval.start.split(':').map(Number);
            const [endHour, endMin] = interval.end.split(':').map(Number);
            const startMinutes = startHour * 60 + startMin;
            const endMinutes = endHour * 60 + endMin;
            
            return currentTime >= startMinutes && currentTime <= endMinutes;
        } catch (error) {
            console.error('Error parsing time interval:', error);
            return false;
        }
    });
}

function getScheduledBlockPolicy(blockList) {
    // Return the appropriate block policy based on scheduled times
    if (!blockList || blockList.blockPolicy !== 'scheduled') {
        return blockList ? blockList.blockPolicy : 'strict';
    }
    
    const now = new Date();
    const currentDay = now.getDay();
    const currentTime = now.getHours() * 60 + now.getMinutes();
    
    // Check if we're in a scheduled day
    if (!blockList.schedule || !blockList.schedule.days || !blockList.schedule.days.includes(currentDay)) {
        return 'strict'; // Default to strict if not in scheduled days
    }
    
    // Check strict mode schedule
    if (blockList.strictSchedule && blockList.strictSchedule.length > 0) {
        const inStrictTime = blockList.strictSchedule.some(interval => {
            if (!interval.start || !interval.end) return false;
            
            try {
                const [startHour, startMin] = interval.start.split(':').map(Number);
                const [endHour, endMin] = interval.end.split(':').map(Number);
                const startMinutes = startHour * 60 + startMin;
                const endMinutes = endHour * 60 + endMin;
                
                return currentTime >= startMinutes && currentTime <= endMinutes;
            } catch (error) {
                console.error('Error parsing strict schedule interval:', error);
                return false;
            }
        });
        
        if (inStrictTime) return 'strict';
    }
    
    // Check difficult mode schedule
    if (blockList.difficultSchedule && blockList.difficultSchedule.length > 0) {
        const inDifficultTime = blockList.difficultSchedule.some(interval => {
            if (!interval.start || !interval.end) return false;
            
            try {
                const [startHour, startMin] = interval.start.split(':').map(Number);
                const [endHour, endMin] = interval.end.split(':').map(Number);
                const startMinutes = startHour * 60 + startMin;
                const endMinutes = endHour * 60 + endMin;
                
                return currentTime >= startMinutes && currentTime <= endMinutes;
            } catch (error) {
                console.error('Error parsing difficult schedule interval:', error);
                return false;
            }
        });
        
        if (inDifficultTime) return 'difficult';
    }
    
    // Default to no blocking if not in any scheduled time
    return null;
}

function generateTypingChallenge() {
    const challenges = [
        "The quick brown fox jumps over the lazy dog and runs through the forest.",
        "Programming requires patience, practice, and persistence to master effectively.",
        "Technology advances rapidly in our modern digital world of innovation.",
        "Creative thinking helps solve complex problems with elegant solutions.",
        "Learning new skills takes dedication and consistent daily practice sessions.",
        "Success comes from hard work, determination, and never giving up hope.",
        "Focus your mind and concentrate on achieving your important goals today.",
        "Challenge yourself to grow beyond your current comfort zone limits.",
        "Mindfulness and meditation can improve your mental clarity and focus.",
        "Reading books expands knowledge and develops critical thinking abilities."
    ];
    
    return challenges[Math.floor(Math.random() * challenges.length)];
}

async function fetchTriviaQuestions(amount = 1, category = 'any', difficulty = 'medium', type = 'multiple') {
    try {
        let url = `https://opentdb.com/api.php?amount=${amount}&difficulty=${difficulty}&type=${type}`;
        
        if (category && category !== 'any') {
            url += `&category=${category}`;
        }
        
        const response = await fetch(url);
        const data = await response.json();
        
        if (data.response_code === 0 && data.results && data.results.length > 0) {
            return data.results;
        } else {
            console.error('Trivia API error or no results:', data);
            return null;
        }
    } catch (error) {
        console.error('Error fetching trivia questions:', error);
        return null;
    }
}

function decodeHtmlEntities(text) {
    const textArea = document.createElement('textarea');
    textArea.innerHTML = text;
    return textArea.value;
}

function shuffleArray(array) {
    const shuffled = [...array];
    for (let i = shuffled.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
    }
    return shuffled;
}

function createBlockPage() {
    const blockPage = document.createElement('div');
    blockPage.id = 'site-blocker-overlay';
    
    const outerDiv = document.createElement('div');
    outerDiv.style.cssText = `
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: linear-gradient(135deg, #667eea 0%, #764ba2 100%);
        z-index: 999999;
        display: flex;
        justify-content: center;
        align-items: center;
        font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif;
        color: white;
    `;
    
    const innerDiv = document.createElement('div');
    innerDiv.style.cssText = `
        background: rgba(255,255,255,0.1);
        backdrop-filter: blur(10px);
        padding: 40px;
        border-radius: 20px;
        text-align: center;
        box-shadow: 0 8px 32px rgba(31, 38, 135, 0.37);
        border: 1px solid rgba(255, 255, 255, 0.18);
        max-width: 500px;
        width: 90%;
    `;
    
    const title = document.createElement('h1');
    title.style.cssText = 'margin: 0 0 20px 0; font-size: 2.5em;';
    title.textContent = '🚫 Site Blocked';
    
    const message = document.createElement('p');
    message.style.cssText = 'font-size: 1.2em; margin-bottom: 30px;';
    message.textContent = 'This website is currently blocked according to your settings.';
    
    const challengeSection = document.createElement('div');
    challengeSection.id = 'challenge-section';
    challengeSection.style.display = 'none';
    
    const challengeText = document.createElement('p');
    challengeText.id = 'challenge-text';
    challengeText.style.cssText = 'font-size: 1.1em; margin-bottom: 20px;';
    challengeText.textContent = 'Type the following text exactly to continue:';
    
    const challengeContainer = document.createElement('div');
    challengeContainer.id = 'challenge-container';
    challengeContainer.style.cssText = `
        background: rgba(255,255,255,0.2);
        padding: 20px;
        border-radius: 10px;
        margin: 20px 0;
        text-align: center;
    `;
    
    const challengePrompt = document.createElement('div');
    challengePrompt.id = 'challenge-prompt';
    challengePrompt.style.cssText = `
        font-size: 1.3em;
        font-weight: bold;
        color: #FFD700;
        background: rgba(0,0,0,0.3);
        padding: 15px;
        border-radius: 8px;
        margin-bottom: 15px;
        word-break: break-word;
        font-family: monospace;
    `;
    challengeContainer.appendChild(challengePrompt);
    
    const challengeAnswer = document.createElement('input');
    challengeAnswer.type = 'text';
    challengeAnswer.id = 'challenge-answer';
    challengeAnswer.placeholder = 'Type the text above exactly';
    challengeAnswer.style.cssText = `
        padding: 15px;
        font-size: 1.1em;
        border: none;
        border-radius: 10px;
        width: 80%;
        max-width: 400px;
        text-align: center;
        margin: 10px;
        font-family: monospace;
    `;
    
    const submitButton = document.createElement('button');
    submitButton.id = 'submit-answer';
    submitButton.textContent = 'Submit Answer';
    submitButton.style.cssText = `
        background: #4CAF50;
        color: white;
        padding: 15px 30px;
        border: none;
        border-radius: 10px;
        font-size: 1.1em;
        cursor: pointer;
        margin-top: 15px;
        transition: background 0.3s;
    `;
    
    const feedback = document.createElement('div');
    feedback.id = 'answer-feedback';
    feedback.style.cssText = `
        margin-top: 15px;
        font-weight: bold;
        font-size: 1.1em;
    `;
    
    challengeSection.appendChild(challengeText);
    challengeSection.appendChild(challengeContainer);
    challengeSection.appendChild(document.createElement('br'));
    challengeSection.appendChild(challengeAnswer);
    challengeSection.appendChild(document.createElement('br'));
    challengeSection.appendChild(submitButton);
    challengeSection.appendChild(feedback);
    
    const settingsNote = document.createElement('div');
    settingsNote.style.cssText = 'margin-top: 20px; font-size: 0.9em; opacity: 0.8;';
    settingsNote.textContent = 'You can modify your blocking settings in the extension options.';
    
    innerDiv.appendChild(title);
    innerDiv.appendChild(message);
    innerDiv.appendChild(challengeSection);
    innerDiv.appendChild(settingsNote);
    
    outerDiv.appendChild(innerDiv);
    blockPage.appendChild(outerDiv);
    
    return blockPage;
}

function showTypingChallenge() {
    console.log('Attempting to show typing challenge...');
    
    const challengeSection = document.getElementById('challenge-section');
    const challengePrompt = document.getElementById('challenge-prompt');
    const challengeAnswer = document.getElementById('challenge-answer');
    const submitButton = document.getElementById('submit-answer');
    const feedback = document.getElementById('answer-feedback');
    
    if (!challengeSection || !challengePrompt || !challengeAnswer || !submitButton || !feedback) {
        console.error('Typing challenge elements not found:', {
            challengeSection: !!challengeSection,
            challengePrompt: !!challengePrompt,
            challengeAnswer: !!challengeAnswer,
            submitButton: !!submitButton,
            feedback: !!feedback
        });
        return;
    }
    
    console.log('Typing challenge elements found, generating challenge...');
    
    const challengeText = generateTypingChallenge();
    challengePrompt.textContent = challengeText;
    challengeSection.style.display = 'block';
    
    console.log('Typing challenge displayed:', challengeText);
    
    const checkAnswer = () => {
        const currentAnswer = document.getElementById('challenge-answer');
        const currentFeedback = document.getElementById('answer-feedback');
        const currentPrompt = document.getElementById('challenge-prompt');
        
        const userText = currentAnswer.value.trim();
        const correctText = currentPrompt.textContent.trim();
        
        console.log('User text:', userText);
        console.log('Correct text:', correctText);
        console.log('Match:', userText === correctText);
        
        if (userText === correctText) {
            currentFeedback.style.color = '#4CAF50';
            currentFeedback.textContent = 'Perfect! You may proceed.';
            
            // Set temporary unblock for this domain
            setTemporaryUnblock().then(() => {
                setTimeout(() => {
                    const overlay = document.getElementById('site-blocker-overlay');
                    if (overlay) overlay.remove();
                    isBlocked = false;
                }, 1500);
            });
        } else {
            currentFeedback.style.color = '#ff6b6b';
            currentFeedback.textContent = 'Text doesn\'t match exactly. Try again.';
            const newChallenge = generateTypingChallenge();
            currentPrompt.textContent = newChallenge;
            currentAnswer.value = '';
            currentAnswer.focus();
        }
    };
    
    submitButton.addEventListener('click', checkAnswer);
    challengeAnswer.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') checkAnswer();
    });
    
    // Real-time feedback as user types
    challengeAnswer.addEventListener('input', (e) => {
        const userText = e.target.value;
        const correctText = challengePrompt.textContent;
        const isMatching = correctText.startsWith(userText);
        
        e.target.style.borderColor = isMatching ? '#4CAF50' : '#ff6b6b';
        e.target.style.borderWidth = '2px';
        e.target.style.borderStyle = 'solid';
    });
    
    challengeAnswer.focus();
}

async function showTriviaChallenge() {
    console.log('Attempting to show trivia challenge...');
    
    const challengeSection = document.getElementById('challenge-section');
    const challengeText = document.getElementById('challenge-text');
    const challengeContainer = document.getElementById('challenge-container');
    const challengeAnswer = document.getElementById('challenge-answer');
    const submitButton = document.getElementById('submit-answer');
    const feedback = document.getElementById('answer-feedback');
    
    if (!challengeSection || !challengeText || !challengeContainer || !challengeAnswer || !submitButton || !feedback) {
        console.error('Trivia challenge elements not found:', {
            challengeSection: !!challengeSection,
            challengeText: !!challengeText,
            challengeContainer: !!challengeContainer,
            challengeAnswer: !!challengeAnswer,
            submitButton: !!submitButton,
            feedback: !!feedback
        });
        // Try falling back to typing challenge
        showTypingChallenge();
        return;
    }
    
    // Get trivia settings from storage
    let triviaSettings = { amount: 1, category: 'any', difficulty: 'medium', type: 'multiple' };
    try {
        const result = await chrome.storage.sync.get(['triviaSettings']);
        if (result.triviaSettings) {
            triviaSettings = { ...triviaSettings, ...result.triviaSettings };
        }
    } catch (error) {
        console.error('Error loading trivia settings:', error);
    }
    
    console.log('Trivia settings:', triviaSettings);
    
    // Show loading message
    challengeText.textContent = 'Loading trivia questions...';
    challengeSection.style.display = 'block';
    challengeContainer.innerHTML = '<div style="color: #FFD700; padding: 20px;">🎯 Getting your questions ready...</div>';
    
    // Fetch trivia questions
    const questions = await fetchTriviaQuestions(
        triviaSettings.amount, 
        triviaSettings.category, 
        triviaSettings.difficulty, 
        triviaSettings.type
    );
    
    if (!questions || questions.length === 0) {
        console.error('Failed to fetch trivia questions, falling back to typing challenge');
        showTypingChallenge();
        return;
    }
    
    console.log('Trivia questions fetched:', questions);
    
    let currentQuestionIndex = 0;
    let correctAnswers = 0;
    const totalQuestions = questions.length;
    
    function displayQuestion() {
        const question = questions[currentQuestionIndex];
        
        challengeText.innerHTML = `
            <div style="display: flex; justify-content: space-between; align-items: center;">
                <span>Answer the trivia question to continue:</span>
                <span style="color: #FFD700; font-weight: bold;">${currentQuestionIndex + 1}/${totalQuestions}</span>
            </div>
        `;
        
        challengeContainer.innerHTML = '';
        
        // Question text
        const questionDiv = document.createElement('div');
        questionDiv.style.cssText = `
            font-size: 1.2em;
            font-weight: bold;
            color: #FFD700;
            background: rgba(0,0,0,0.3);
            padding: 20px;
            border-radius: 8px;
            margin-bottom: 20px;
            word-break: break-word;
            text-align: left;
        `;
        questionDiv.innerHTML = `
            <div style="color: #FFF; font-size: 0.9em; margin-bottom: 10px; text-transform: capitalize;">
                ${question.category} • ${question.difficulty} • ${question.type === 'multiple' ? 'Multiple Choice' : 'True/False'}
            </div>
            ${decodeHtmlEntities(question.question)}
        `;
        challengeContainer.appendChild(questionDiv);
        
        if (question.type === 'multiple') {
            // Multiple choice options
            const answers = shuffleArray([...question.incorrect_answers, question.correct_answer]);
            const optionsDiv = document.createElement('div');
            optionsDiv.style.cssText = 'display: grid; gap: 10px; margin-top: 15px;';
            
            answers.forEach((answer, index) => {
                const optionButton = document.createElement('button');
                optionButton.textContent = decodeHtmlEntities(answer);
                optionButton.style.cssText = `
                    background: rgba(255,255,255,0.1);
                    border: 2px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 15px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 1em;
                    transition: all 0.3s;
                    text-align: left;
                `;
                
                optionButton.addEventListener('mouseenter', () => {
                    optionButton.style.background = 'rgba(255,255,255,0.2)';
                    optionButton.style.borderColor = '#4CAF50';
                });
                
                optionButton.addEventListener('mouseleave', () => {
                    optionButton.style.background = 'rgba(255,255,255,0.1)';
                    optionButton.style.borderColor = 'rgba(255,255,255,0.3)';
                });
                
                optionButton.addEventListener('click', () => {
                    handleAnswer(answer === question.correct_answer);
                });
                
                optionsDiv.appendChild(optionButton);
            });
            
            challengeContainer.appendChild(optionsDiv);
            
            // Hide the text input and submit button for multiple choice
            challengeAnswer.style.display = 'none';
            submitButton.style.display = 'none';
        } else {
            // True/False question
            const tfDiv = document.createElement('div');
            tfDiv.style.cssText = 'display: flex; gap: 20px; justify-content: center; margin-top: 15px;';
            
            ['True', 'False'].forEach(answer => {
                const tfButton = document.createElement('button');
                tfButton.textContent = answer;
                tfButton.style.cssText = `
                    background: rgba(255,255,255,0.1);
                    border: 2px solid rgba(255,255,255,0.3);
                    color: white;
                    padding: 15px 30px;
                    border-radius: 8px;
                    cursor: pointer;
                    font-size: 1.1em;
                    font-weight: bold;
                    transition: all 0.3s;
                `;
                
                tfButton.addEventListener('mouseenter', () => {
                    tfButton.style.background = 'rgba(255,255,255,0.2)';
                    tfButton.style.borderColor = '#4CAF50';
                });
                
                tfButton.addEventListener('mouseleave', () => {
                    tfButton.style.background = 'rgba(255,255,255,0.1)';
                    tfButton.style.borderColor = 'rgba(255,255,255,0.3)';
                });
                
                tfButton.addEventListener('click', () => {
                    handleAnswer(answer === question.correct_answer);
                });
                
                tfDiv.appendChild(tfButton);
            });
            
            challengeContainer.appendChild(tfDiv);
            
            // Hide the text input and submit button for true/false
            challengeAnswer.style.display = 'none';
            submitButton.style.display = 'none';
        }
    }
    
    function handleAnswer(isCorrect) {
        const question = questions[currentQuestionIndex];
        
        if (isCorrect) {
            correctAnswers++;
            feedback.style.color = '#4CAF50';
            feedback.textContent = '✓ Correct!';
        } else {
            feedback.style.color = '#ff6b6b';
            feedback.textContent = `✗ Wrong! The correct answer was: ${decodeHtmlEntities(question.correct_answer)}`;
        }
        
        currentQuestionIndex++;
        
        if (currentQuestionIndex >= totalQuestions) {
            // All questions answered
            const percentage = Math.round((correctAnswers / totalQuestions) * 100);
            const requiredPercentage = 70; // Can be configurable later
            
            setTimeout(() => {
                if (percentage >= requiredPercentage) {
                    feedback.style.color = '#4CAF50';
                    feedback.textContent = `🎉 Excellent! You scored ${correctAnswers}/${totalQuestions} (${percentage}%). You may proceed.`;
                    
                    // Set temporary unblock for this domain
                    setTemporaryUnblock().then(() => {
                        setTimeout(() => {
                            const overlay = document.getElementById('site-blocker-overlay');
                            if (overlay) overlay.remove();
                            isBlocked = false;
                        }, 2000);
                    });
                } else {
                    feedback.style.color = '#ff6b6b';
                    feedback.textContent = `You scored ${correctAnswers}/${totalQuestions} (${percentage}%). You need at least ${requiredPercentage}% to continue. Try again!`;
                    setTimeout(() => {
                        showTriviaChallenge(); // Restart the challenge
                    }, 3000);
                }
            }, 2000);
        } else {
            // More questions to go
            setTimeout(() => {
                feedback.textContent = '';
                displayQuestion();
            }, 2000);
        }
    }
    
    // Start with first question
    displayQuestion();
}

async function checkAndBlock() {
    // Check if extension is ready before proceeding
    if (!isExtensionReady()) {
        console.log('Site Blocker: Extension not ready, skipping check');
        return;
    }
    
    try {
        // Early exit if we're already blocked
        if (isBlocked) return;
        
        // Check if this is a valid domain to block
        const currentDomain = getCurrentDomain();
        if (!currentDomain || currentDomain === 'localhost' || currentDomain.includes('chrome-extension://')) {
            return;
        }
        
        // Check if temporarily unblocked first - if so, don't block at all
        let isTemporarilyUnblocked = false;
        try {
            isTemporarilyUnblocked = await checkTemporaryUnblockContent(currentDomain);
            console.log(`Site Blocker: Temp unblock check for ${currentDomain}: ${isTemporarilyUnblocked}`);
        } catch (error) {
            // For any error during temp unblock check, just assume not unblocked and continue
            console.log('Site Blocker: Temp unblock check failed, assuming not unblocked');
            isTemporarilyUnblocked = false;
        }
        
        if (isTemporarilyUnblocked) {
            console.log('Site Blocker: Domain is temporarily unblocked, skipping content script block');
            const existingOverlay = document.getElementById('site-blocker-overlay');
            if (existingOverlay) existingOverlay.remove();
            isBlocked = false; // Make sure isBlocked is false
            return; // Don't proceed with any blocking logic
        }
        
        const result = await chrome.storage.sync.get(['blockLists', 'settings']);
        
        blockLists = result.blockLists || [];
        settings = result.settings || { blockingEnabled: true };
        
        if (!document.body) {
            return;
        }
        
        if (settings.blockingEnabled !== false) {
            const blockResult = isCurrentSiteBlocked();
            
            if (blockResult.blocked && isWithinBlockedTime(blockResult.list)) {
                // Get the effective block policy (considering scheduled policies)
                const effectivePolicy = getScheduledBlockPolicy(blockResult.list);
                
                // If scheduled policy returns null, don't block at this time
                if (effectivePolicy === null) {
                    return;
                }
                
                // Background tab checking now handles all policies with URL parameters
                // Content script is just a fallback - let background do the work
                console.log(`Site Blocker: Letting background tab checking handle '${effectivePolicy}' policy`);
                return;
                
                console.log('Site Blocker: Content script blocking site with difficult policy');
                isBlocked = true;
                
                const existingOverlay = document.getElementById('site-blocker-overlay');
                if (existingOverlay) existingOverlay.remove();
                
                if (blockResult.list.customRedirect && blockResult.list.customRedirect.startsWith('http')) {
                    window.location.href = blockResult.list.customRedirect;
                    return;
                }
                
                const blockPage = createBlockPage();
                if (document.body) {
                    document.body.appendChild(blockPage);
                    
                    // Use effective policy to determine which challenge should be shown
                    if (effectivePolicy === 'difficult') {
                        // Get challenge settings to determine if trivia or typing challenge
                        chrome.storage.sync.get(['challengeSettings']).then(result => {
                            const challengeSettings = result.challengeSettings || { challengeType: 'trivia' };
                            
                            setTimeout(() => {
                                if (challengeSettings.challengeType === 'trivia') {
                                    showTriviaChallenge();
                                } else {
                                    showTypingChallenge();
                                }
                            }, 1000); // Increased delay to ensure DOM is ready
                        }).catch(error => {
                            try {
                                if (error && error.message && error.message.includes('Extension context invalidated')) {
                                    console.log('Site Blocker: Extension context invalidated while getting challenge settings');
                                    return;
                                }
                                console.log('Site Blocker: Failed to get challenge settings, using trivia as default');
                            } catch (nestedError) {
                                console.log('Site Blocker: Error getting challenge settings, using trivia as default');
                            }
                            setTimeout(() => {
                                showTriviaChallenge();
                            }, 1000);
                        });
                    }
                }
                
                incrementBlockAttempts();
            }
        }
    } catch (error) {
        // Handle extension context invalidated by stopping all operations
        // Don't try to access error.message as it might throw another error
        try {
            if (error && error.message && error.message.includes('Extension context invalidated')) {
                console.log('Site Blocker: Extension context invalidated, stopping operations');
                return;
            }
            if (error && error.message) {
                console.warn('Site Blocker:', error.message);
            }
        } catch (nestedError) {
            // If even accessing the error properties fails, just log and exit
            console.log('Site Blocker: Error occurred but cannot access error details, stopping operations');
        }
    }
}

async function incrementBlockAttempts() {
    try {
        const result = await chrome.storage.sync.get(['settings']);
        const currentSettings = result.settings || {};
        
        if (!currentSettings.stats) {
            currentSettings.stats = { attemptCount: 0, timesSaved: 0 };
        }
        
        currentSettings.stats.attemptCount = (currentSettings.stats.attemptCount || 0) + 1;
        currentSettings.stats.timesSaved = (currentSettings.stats.timesSaved || 0) + 5; // Assume 5 minutes saved per block
        
        await chrome.storage.sync.set({ settings: currentSettings });
    } catch (error) {
        // Silently handle stats update errors
    }
}

// Check if chrome extension APIs are available
function isExtensionReady() {
    try {
        return !!(chrome && chrome.storage && chrome.storage.sync && chrome.runtime);
    } catch (error) {
        return false;
    }
}

// Wait for extension to be ready before initializing
async function waitForExtensionReady() {
    return new Promise((resolve) => {
        const checkReady = () => {
            if (isExtensionReady()) {
                resolve(true);
            } else {
                setTimeout(checkReady, 100);
            }
        };
        checkReady();
    });
}

// Content script should only run as a fallback when declarative rules fail
// and only on sites with 'difficult' policy that need challenges
if ((window.location.protocol === 'http:' || window.location.protocol === 'https:') && 
    !window.location.href.includes('blocked.html')) {
    
    // Wait for extension to be ready before starting
    waitForExtensionReady().then(() => {
        console.log('Site Blocker: Extension ready, initializing content script');
        
        // Only run initial check on page load
        if (document.readyState === 'loading') {
            document.addEventListener('DOMContentLoaded', () => {
                setTimeout(checkAndBlock, 2000); // Give extension more time to fully initialize
            });
        } else {
            // Longer delay to let extension and declarative rules fully initialize
            setTimeout(checkAndBlock, 3000);
        }

        // Listen for storage changes (but don't check too aggressively)
        try {
            chrome.storage.onChanged.addListener((changes) => {
                if (changes.blockLists || changes.settings) {
                    setTimeout(checkAndBlock, 2000);
                }
            });
        } catch (error) {
            console.warn('Site Blocker: Failed to setup storage listener:', error);
        }
        
        // Much less frequent checking - let declarative rules do the heavy lifting
        setInterval(async () => {
            if (!isExtensionReady()) {
                console.log('Site Blocker: Extension context lost, stopping interval checks');
                return;
            }
            
            // Only check if there's no overlay and we're not temporarily unblocked
            if (!document.getElementById('site-blocker-overlay')) {
                try {
                    const currentDomain = getCurrentDomain();
                    const isTemporarilyUnblocked = await checkTemporaryUnblockContent(currentDomain);
                    if (!isTemporarilyUnblocked) {
                        checkAndBlock();
                    }
                } catch (error) {
                    try {
                        if (error && error.message && error.message.includes('Extension context invalidated')) {
                            console.log('Site Blocker: Extension context invalidated during interval check');
                            return;
                        }
                    } catch (nestedError) {
                        console.log('Site Blocker: Error during interval check, stopping');
                        return;
                    }
                }
            }
        }, 120000); // Check every 2 minutes instead of 1 minute
        
    }).catch((error) => {
        console.warn('Site Blocker: Failed to initialize extension:', error);
    });
}

// In-App Blocking functionality
let inAppSettings = {};
let appliedStyles = null;

// Listen for in-app blocking updates from options page
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (!isExtensionReady()) {
        console.log('Site Blocker: Extension not ready for message handling');
        return;
    }
    
    try {
        if (message.type === 'updateInAppBlocking') {
            console.log('Site Blocker: Received updateInAppBlocking message:', message.settings);
            inAppSettings = message.settings || {};
            applyInAppBlocking();
            sendResponse({ success: true });
        }
    } catch (error) {
        console.error('Site Blocker: Error handling updateInAppBlocking message:', error);
        sendResponse({ success: false, error: error.message });
    }
});

// Load and apply in-app blocking on page load
async function loadInAppBlocking() {
    if (!isExtensionReady()) {
        console.log('Site Blocker: Extension not ready for loading in-app settings');
        return;
    }
    
    try {
        const result = await chrome.storage.sync.get(['inAppSettings']);
        console.log('Site Blocker: Loaded in-app settings:', result.inAppSettings);
        
        if (result.inAppSettings) {
            inAppSettings = result.inAppSettings;
            applyInAppBlocking();
        } else {
            console.log('Site Blocker: No in-app settings found, using defaults');
        }
    } catch (error) {
        console.warn('Site Blocker: Failed to load in-app settings:', error);
    }
}

function applyInAppBlocking() {
    const domain = getCurrentDomain();
    let appKey = null;
    
    console.log('Site Blocker: Applying in-app blocking for domain:', domain);
    
    // Map domains to app keys
    if (domain.includes('youtube.com')) appKey = 'youtube';
    else if (domain.includes('tiktok.com')) appKey = 'tiktok';
    else if (domain.includes('instagram.com')) appKey = 'instagram';
    else if (domain.includes('facebook.com') || domain.includes('fb.com')) appKey = 'facebook';
    else if (domain.includes('twitter.com') || domain.includes('x.com')) appKey = 'twitter';
    else if (domain.includes('snapchat.com')) appKey = 'snapchat';
    
    console.log('Site Blocker: Mapped to app:', appKey);
    console.log('Site Blocker: In-app settings:', inAppSettings);
    
    if (!appKey || !inAppSettings[appKey] || !inAppSettings[appKey].enabled) {
        console.log('Site Blocker: App not found or not enabled, removing any existing blocking');
        removeInAppBlocking();
        return;
    }
    
    const app = inAppSettings[appKey];
    console.log('Site Blocker: Applying blocking for', appKey, 'with settings:', app);
    
    // Remove existing styles first
    removeInAppBlocking();
    
    // Apply blocking based on app
    switch (appKey) {
        case 'youtube':
            applyYouTubeBlocking(app);
            break;
        case 'tiktok':
            applyTikTokBlocking(app);
            break;
        case 'instagram':
            applyInstagramBlocking(app);
            break;
        case 'facebook':
            applyFacebookBlocking(app);
            break;
        case 'twitter':
            applyTwitterBlocking(app);
            break;
        case 'snapchat':
            applySnapchatBlocking(app);
            break;
    }
}

function applyYouTubeBlocking(app) {
    let css = '';
    const features = app.features;
    
    if (features.hideHome) {
        css += 'ytd-browse[page-subtype="home"] { display: none !important; }';
    }
    
    if (features.hideShorts) {
        css += 'ytd-rich-section-renderer:has(#dismissible[is-shorts]), ytd-reel-shelf-renderer, [is-shorts] { display: none !important; }';
        css += 'a[href*="/shorts/"] { display: none !important; }';
    }
    
    if (features.hideComments) {
        css += 'ytd-comments, #comments { display: none !important; }';
    }
    
    if (features.hideRecommended) {
        css += 'ytd-watch-next-secondary-results-renderer, #related { display: none !important; }';
        css += '.ytp-endscreen-content, .ytp-ce-element { display: none !important; }';
    }
    
    if (features.hideSubscriptions) {
        css += 'ytd-guide-entry-renderer:has([title="Subscriptions"]) { display: none !important; }';
    }
    
    if (features.hideExplore) {
        css += 'ytd-guide-entry-renderer:has([title="Explore"]) { display: none !important; }';
    }
    
    if (features.hideTrends) {
        css += 'ytd-guide-entry-renderer:has([title="Trending"]) { display: none !important; }';
    }
    
    if (features.hideTopBar) {
        css += 'ytd-masthead, #masthead-container { display: none !important; }';
        css += 'ytd-page-manager { margin-top: 0 !important; padding-top: 0 !important; }';
    }
    
    if (features.disableEndCards) {
        css += '.ytp-endscreen-content, .ytp-ce-element, .ytp-cards-button { display: none !important; }';
    }
    
    if (features.bwMode) {
        css += `
            * {
                filter: grayscale(100%) !important;
                -webkit-filter: grayscale(100%) !important;
            }
            
            video {
                filter: grayscale(100%) !important;
                -webkit-filter: grayscale(100%) !important;
            }
        `;
    }
    
    if (features.disableAutoplay) {
        // This requires JavaScript intervention
        setTimeout(() => {
            const video = document.querySelector('video');
            if (video) {
                video.loop = false;
                video.autoplay = false;
            }
            
            // Disable autoplay button
            const autoplayButton = document.querySelector('.ytp-autonav-toggle-button');
            if (autoplayButton && autoplayButton.getAttribute('aria-pressed') === 'true') {
                autoplayButton.click();
            }
        }, 1000);
    }
    
    if (css) {
        injectCSS(css);
    }
}

function applyTikTokBlocking(app) {
    let css = '';
    const features = app.features;
    
    if (features.hideExplore) {
        css += '[data-e2e="explore-card"], [href*="/explore"], [data-e2e="discover-card"] { display: none !important; }';
    }
    
    if (features.hideLive) {
        css += '[data-e2e="live-card"], [href*="/live"], [data-e2e="live-tab"] { display: none !important; }';
    }
    
    if (features.hideComments) {
        css += '[data-e2e="comment-item"], [data-e2e="comment-list"], [data-e2e="comment-input"] { display: none !important; }';
    }
    
    if (features.hideSearch) {
        css += '[data-e2e="search-box"], [placeholder*="Search"], .search-container { display: none !important; }';
    }
    
    if (features.bwMode) {
        css += `
            * {
                filter: grayscale(100%) !important;
                -webkit-filter: grayscale(100%) !important;
            }
            
            video {
                filter: grayscale(100%) !important;
                -webkit-filter: grayscale(100%) !important;
            }
        `;
    }
    
    if (css) {
        injectCSS(css);
    }
}

function applyInstagramBlocking(app) {
    let css = '';
    const features = app.features;
    
    if (features.hideStories) {
        css += '[role="menuitem"]:has([data-testid="1565776713665233"]) { display: none !important; }';
        css += 'section:has([aria-label*="Stories"]), [data-testid="stories-tray"] { display: none !important; }';
    }
    
    if (features.hideReels) {
        css += '[href*="/reels/"], [href="/reels/"] { display: none !important; }';
        css += 'article:has([href*="/reel/"]), [data-testid="reels-tab"] { display: none !important; }';
    }
    
    if (features.hideExplore) {
        css += '[href="/explore/"], [aria-label*="Explore"], [data-testid="explore-tab"] { display: none !important; }';
    }
    
    if (features.hideComments) {
        css += 'section:has([aria-label*="Comment"]), [data-testid="comment-input"] { display: none !important; }';
    }
    
    if (features.bwMode) {
        css += `
            * {
                filter: grayscale(100%) !important;
                -webkit-filter: grayscale(100%) !important;
            }
            
            img, video {
                filter: grayscale(100%) !important;
                -webkit-filter: grayscale(100%) !important;
            }
        `;
    }
    
    if (css) {
        injectCSS(css);
    }
}

function applyFacebookBlocking(app) {
    let css = '';
    const features = app.features;
    
    if (features.hideStories) {
        css += '[data-pagelet="FeedStories"], [aria-label*="Stories"], [data-testid="stories-tray"] { display: none !important; }';
    }
    
    if (features.hideReels) {
        css += '[href*="/reel/"], [aria-label*="Reels"], [data-testid="reels-tab"] { display: none !important; }';
    }
    
    if (features.hideMarketplace) {
        css += '[href*="/marketplace"], [aria-label*="Marketplace"], [data-testid="marketplace-tab"] { display: none !important; }';
    }
    
    if (features.bwMode) {
        css += `
            * {
                filter: grayscale(100%) !important;
                -webkit-filter: grayscale(100%) !important;
            }
            
            img, video {
                filter: grayscale(100%) !important;
                -webkit-filter: grayscale(100%) !important;
            }
        `;
    }
    
    if (css) {
        injectCSS(css);
    }
}

function applyTwitterBlocking(app) {
    let css = '';
    const features = app.features;
    
    if (features.hideExplore) {
        css += '[href="/explore"], [data-testid="AppTabBar_Explore_Link"], [aria-label*="Explore"] { display: none !important; }';
    }
    
    if (features.hideTrends) {
        css += '[data-testid="sidebarColumn"] section:has([data-testid="trend"]) { display: none !important; }';
        css += '[aria-label*="Trending"], [data-testid="trend"] { display: none !important; }';
    }
    
    if (features.hideNotifications) {
        css += '[href="/notifications"], [data-testid="AppTabBar_Notifications_Link"], [aria-label*="Notifications"] { display: none !important; }';
    }
    
    if (features.hideLists) {
        css += '[href*="/lists"], [aria-label*="Lists"], [data-testid="lists"] { display: none !important; }';
    }
    
    if (features.hideCommunities) {
        css += '[href*="/communities"], [aria-label*="Communities"], [data-testid="communities"] { display: none !important; }';
    }
    
    if (features.bwMode) {
        css += `
            * {
                filter: grayscale(100%) !important;
                -webkit-filter: grayscale(100%) !important;
            }
            
            img, video {
                filter: grayscale(100%) !important;
                -webkit-filter: grayscale(100%) !important;
            }
        `;
    }
    
    if (css) {
        injectCSS(css);
    }
}

function applySnapchatBlocking(app) {
    let css = '';
    const features = app.features;
    
    if (features.hideStories) {
        css += '[data-testid="stories"], .stories, [aria-label*="Stories"] { display: none !important; }';
    }
    
    if (features.hideSpotlight) {
        css += '[data-testid="spotlight"], .spotlight, [aria-label*="Spotlight"] { display: none !important; }';
    }
    
    if (features.hideChat) {
        css += '[data-testid="chat"], .chat, [aria-label*="Chat"] { display: none !important; }';
    }
    
    if (features.bwMode) {
        css += `
            * {
                filter: grayscale(100%) !important;
                -webkit-filter: grayscale(100%) !important;
            }
            
            img, video {
                filter: grayscale(100%) !important;
                -webkit-filter: grayscale(100%) !important;
            }
        `;
    }
    
    if (css) {
        injectCSS(css);
    }
}

function injectCSS(css) {
    appliedStyles = document.createElement('style');
    appliedStyles.id = 'site-blocker-in-app-styles';
    appliedStyles.textContent = css;
    document.head.appendChild(appliedStyles);
}

function removeInAppBlocking() {
    if (appliedStyles) {
        appliedStyles.remove();
        appliedStyles = null;
    }
}

// Initialize in-app blocking when content script loads
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', loadInAppBlocking);
} else {
    loadInAppBlocking();
}

// Re-apply blocking when page changes (for SPAs)
let lastUrl = location.href;
new MutationObserver(() => {
    const url = location.href;
    if (url !== lastUrl) {
        lastUrl = url;
        setTimeout(applyInAppBlocking, 1000); // Delay to let page load
    }
}).observe(document, { subtree: true, childList: true });