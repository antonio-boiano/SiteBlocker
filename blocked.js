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

    let triviaQuestions = [];
    let currentQuestionIndex = 0;
    let correctAnswers = 0;
    let selectedAnswer = null;
    
    function decodeHTML(html) {
        const txt = document.createElement('textarea');
        txt.innerHTML = html;
        return txt.value;
    }
    
    async function fetchTriviaQuestions() {
        try {
            // Get settings from storage or use defaults
            const challengeSettings = await chrome.storage.sync.get(['challengeSettings', 'triviaSettings']);
            const triviaConfig = challengeSettings.triviaSettings || {
                amount: 3,
                category: 'any',
                difficulty: 'medium',
                type: 'multiple'
            };
            
            let apiUrl = `https://opentdb.com/api.php?amount=${triviaConfig.amount}&difficulty=${triviaConfig.difficulty}&type=${triviaConfig.type}`;
            if (triviaConfig.category !== 'any') {
                apiUrl += `&category=${triviaConfig.category}`;
            }
            
            const response = await fetch(apiUrl);
            const data = await response.json();
            
            if (data.response_code === 0) {
                triviaQuestions = data.results.map(q => ({
                    question: decodeHTML(q.question),
                    correct_answer: decodeHTML(q.correct_answer),
                    incorrect_answers: q.incorrect_answers.map(a => decodeHTML(a)),
                    category: decodeHTML(q.category),
                    difficulty: q.difficulty
                }));
                return true;
            } else {
                throw new Error('Failed to fetch trivia questions');
            }
        } catch (error) {
            console.error('Error fetching trivia:', error);
            return false;
        }
    }
    
    function shuffleArray(array) {
        const shuffled = [...array];
        for (let i = shuffled.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
        }
        return shuffled;
    }
    
    function displayCurrentQuestion() {
        if (currentQuestionIndex >= triviaQuestions.length) {
            finishChallenge();
            return;
        }
        
        const question = triviaQuestions[currentQuestionIndex];
        const progressText = `Question ${currentQuestionIndex + 1} of ${triviaQuestions.length}`;
        document.getElementById('questionProgress').textContent = progressText;
        document.getElementById('questionText').textContent = question.question;
        
        // Combine and shuffle answers
        const allAnswers = shuffleArray([question.correct_answer, ...question.incorrect_answers]);
        
        const optionsContainer = document.getElementById('answerOptions');
        optionsContainer.innerHTML = '';
        
        allAnswers.forEach((answer, index) => {
            const button = document.createElement('button');
            button.className = 'answer-option';
            button.textContent = answer;
            button.dataset.answer = answer;
            button.addEventListener('click', () => selectAnswer(button, answer, question.correct_answer));
            optionsContainer.appendChild(button);
        });
        
        selectedAnswer = null;
        document.getElementById('nextQuestion').style.display = 'none';
        document.getElementById('restartChallenge').style.display = 'inline-block';
        document.getElementById('challengeResult').textContent = '';
    }
    
    function selectAnswer(button, selected, correct) {
        if (selectedAnswer !== null) return; // Already answered
        
        selectedAnswer = selected;
        const isCorrect = selected === correct;
        
        if (isCorrect) {
            correctAnswers++;
            button.classList.add('correct');
        } else {
            button.classList.add('incorrect');
            // Highlight the correct answer
            document.querySelectorAll('.answer-option').forEach(opt => {
                if (opt.dataset.answer === correct) {
                    opt.classList.add('correct');
                }
            });
        }
        
        // Disable all buttons
        document.querySelectorAll('.answer-option').forEach(opt => {
            opt.style.pointerEvents = 'none';
        });
        
        // Hide restart button while processing answer
        document.getElementById('restartChallenge').style.display = 'none';
        
        document.getElementById('challengeResult').textContent = isCorrect ? '✅ Correct!' : '❌ Incorrect';
        document.getElementById('challengeResult').style.color = isCorrect ? '#4CAF50' : '#f44336';
        
        setTimeout(() => {
            currentQuestionIndex++;
            if (currentQuestionIndex >= triviaQuestions.length) {
                finishChallenge();
            } else {
                displayCurrentQuestion();
            }
        }, 2000);
    }
    
    async function finishChallenge() {
        const requiredCorrect = triviaQuestions.length; // 100% correct required
        const passed = correctAnswers >= requiredCorrect;
        
        const resultContainer = document.getElementById('challengeResult');
        if (passed) {
            // Hide restart button on success
            document.getElementById('restartChallenge').style.display = 'none';
            
            // Get unlock duration from settings
            const challengeSettings = await chrome.storage.sync.get(['triviaSettings']);
            const unlockDuration = challengeSettings.triviaSettings?.unlockDuration || 10;
            
            resultContainer.innerHTML = `🎉 Perfect Score!<br>All ${triviaQuestions.length} questions correct!<br>Site unblocked for ${unlockDuration} minutes...`;
            resultContainer.style.color = '#4CAF50';
            
            // Set temporary unblock for configured duration
            const unblockUntil = Date.now() + (unlockDuration * 60 * 1000);
            const urlToUnblock = originalUrl ? decodeURIComponent(originalUrl) : window.location.href;
            
            try {
                const hostname = new URL(urlToUnblock).hostname;
                const normalizedHostname = hostname.replace(/^www\./, ''); // Remove www prefix
                
                console.log(`Setting temporary unblock for: ${normalizedHostname} until ${new Date(unblockUntil).toLocaleTimeString()}`);
                console.log(`Original hostname: ${hostname}, normalized: ${normalizedHostname}`);
                
                // Store temporary unblock with error handling
                const storageData = {};
                storageData[`temp_unblock_${normalizedHostname}`] = unblockUntil;
                
                // Also store for www version
                if (!hostname.startsWith('www.')) {
                    storageData[`temp_unblock_www.${normalizedHostname}`] = unblockUntil;
                }
                
                console.log('Storing temp unblock data:', storageData);
                
                // Try to store directly first
                try {
                    await chrome.storage.local.set(storageData);
                    console.log('Direct storage successful');
                    
                    // Verify storage worked
                    const verification = await chrome.storage.local.get(Object.keys(storageData));
                    console.log('Verification - stored data:', verification);
                } catch (storageError) {
                    console.log('Direct storage failed:', storageError);
                }
                
                // Also send to background script to handle storage
                try {
                    await chrome.runtime.sendMessage({ 
                        action: 'setTempUnblock',
                        domain: normalizedHostname,
                        unblockUntil: unblockUntil
                    });
                    console.log('Sent temp unblock message to background');
                } catch (messageError) {
                    console.warn('Failed to send temp unblock message:', messageError);
                }
                
                // Force background script to update rules immediately
                try {
                    await chrome.runtime.sendMessage({ action: 'updateRules' });
                    console.log('Sent message to update blocking rules');
                    // Wait a moment for the background script to process the rules update
                    await new Promise(resolve => setTimeout(resolve, 1000));
                } catch (messageError) {
                    console.warn('Failed to send message to background, relying on storage listener:', messageError);
                    // The storage change listener will trigger the update anyway
                    await new Promise(resolve => setTimeout(resolve, 2000));
                }
                
                // Also store in localStorage as backup
                try {
                    localStorage.setItem(`site_blocker_temp_unblock_${normalizedHostname}`, unblockUntil.toString());
                    console.log('Backup stored in localStorage');
                } catch (localStorageError) {
                    console.warn('Failed to store in localStorage:', localStorageError);
                }
                
            } catch (error) {
                console.error('Failed to set temporary unblock:', error);
                // Even if storage fails, still redirect - better than blocking forever
            }
            
            // Redirect after rules have been updated
            setTimeout(() => {
                if (originalUrl) {
                    console.log('Redirecting to:', decodeURIComponent(originalUrl));
                    window.location.href = decodeURIComponent(originalUrl);
                } else {
                    // If no original URL, just reload the current page
                    window.location.reload();
                }
            }, 500); // Short delay since we already waited above
        } else {
            resultContainer.innerHTML = `❌ Challenge Failed<br>Score: ${correctAnswers}/${triviaQuestions.length}<br>You need all answers correct to pass.`;
            resultContainer.style.color = '#f44336';
            
            // Show restart button after failure
            document.getElementById('restartChallenge').style.display = 'inline-block';
            document.getElementById('restartChallenge').textContent = '🔄 Try Again with New Questions';
        }
    }

    async function startTriviaChallenge() {
        document.getElementById('challengeSection').style.display = 'block';
        document.getElementById('showChallenge').style.display = 'none';
        document.getElementById('loadingIndicator').style.display = 'block';
        document.getElementById('questionContainer').style.display = 'none';
        
        const success = await fetchTriviaQuestions();
        
        if (success && triviaQuestions.length > 0) {
            document.getElementById('loadingIndicator').style.display = 'none';
            document.getElementById('questionContainer').style.display = 'block';
            
            currentQuestionIndex = 0;
            correctAnswers = 0;
            displayCurrentQuestion();
        } else {
            // Fallback if trivia API fails
            document.getElementById('loadingIndicator').style.display = 'none';
            document.getElementById('challengeResult').innerHTML = '❌ Failed to load trivia questions.<br>Redirecting to site...';
            document.getElementById('challengeResult').style.color = '#f44336';
            
            setTimeout(() => {
                if (originalUrl) {
                    window.location.href = decodeURIComponent(originalUrl);
                }
            }, 2000);
        }
    }

    function restartChallenge() {
        // Reset variables
        triviaQuestions = [];
        currentQuestionIndex = 0;
        correctAnswers = 0;
        selectedAnswer = null;
        
        // Show loading and hide question container
        document.getElementById('loadingIndicator').style.display = 'block';
        document.getElementById('questionContainer').style.display = 'none';
        document.getElementById('challengeResult').textContent = '';
        
        // Start new challenge
        startTriviaChallenge();
    }

    document.getElementById('showChallenge').addEventListener('click', startTriviaChallenge);
    document.getElementById('restartChallenge').addEventListener('click', restartChallenge);
});