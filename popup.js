document.addEventListener('DOMContentLoaded', async function () {
    const errorMessage = document.getElementById('error-message');
    const toggleExtensionBtn = document.getElementById('toggleExtension');
    const extensionContent = document.getElementById('extensionContent');
    const loadingSpinner = document.getElementById('loading-spinner');
    let aiSession = null;
    let summarizer = null;
    let extensionActive = false;

    async function startExtension() {
        if (!self.ai?.languageModel) {
            errorMessage.textContent = "This extension requires Chrome's AI features. Please enable them in chrome://flags/#enable-web-ai";
            errorMessage.style.display = 'block';
            return;
        }

        // Show the loading spinner
        loadingSpinner.style.display = 'block';
        errorMessage.style.display = 'none';

        // Initialize AI session
        const sessionInitialized = await initAI();

        // Hide the loading spinner
        loadingSpinner.style.display = 'none';

        if (sessionInitialized) {
            extensionContent.style.display = 'block';
            toggleExtensionBtn.textContent = 'ON';
            extensionActive = true;
        } else {
            errorMessage.textContent = 'Failed to initialize AI session. Please try again.';
            errorMessage.style.display = 'block';
        }
    }


    // Stop the extension
    async function stopExtension() {
        if (aiSession) {
            aiSession.destroy(); // Destroy AI session
            aiSession = null;
        }
        if (summarizer) {
            summarizer.destroy(); // Destroy summarizer if active
            summarizer = null;
        }
        extensionContent.style.display = 'none';
        toggleExtensionBtn.textContent = 'OFF';
        extensionActive = false;
    }

    // Toggle button event listener
    toggleExtensionBtn.addEventListener('click', async () => {
        if (extensionActive) {
            await stopExtension();
        } else {
            await startExtension();
        }
    });

    // Initialize AI session function
    async function initAI() {
        try {
            aiSession = await self.ai.languageModel.create({
                temperature: 0.7,
                topK: 3,
                systemPrompt: "You are my personal assistant, and your role is to help me stay organized, productive, and informed by giving me short and concise answers. I may ask you for help with tasks such as scheduling, reminders, planning, research, or learning new things. When I ask questions, please respond with clear, concise and short answers. If I need guidance on a topic, break it down into actionable steps. Keep a polite and professional tone but add a friendly, supportive touch. If I forget something I’ve previously mentioned, remind me of any relevant information to make things easier. Your goal is to help me achieve my personal and professional goals efficiently."
            });
            return true;
        } catch (error) {
            console.error('AI initialization error:', error);
            return false;
        }
    }

    // Function to create and manage the summarizer
    async function createSummarizer() {
        try {
            const canSummarize = await ai.summarizer.capabilities();
            if (canSummarize && canSummarize.available !== 'no') {
                if (canSummarize.available === 'readily') {
                    summarizer = await ai.summarizer.create();
                } else {
                    summarizer = await ai.summarizer.create();
                    summarizer.addEventListener('downloadprogress', (e) => {
                        console.log(`Download progress: ${e.loaded} of ${e.total}`);
                    });
                    await summarizer.ready;
                }
                return true;
            } else {
                console.warn("Summarizer capabilities unavailable.");
                errorMessage.textContent = 'Summarization not supported on this device.';
                errorMessage.style.display = 'block';
                return false;
            }
        } catch (error) {
            console.error('Error creating summarizer:', error);
            errorMessage.textContent = 'Failed to initialize summarizer. Some features may be unavailable.';
            errorMessage.style.display = 'block';
            return false;
        }
    }

    // Try to initialize summarizer, but don't block other features if it fails
    // await createSummarizer();

    // Function to convert markup to plain text
    function convertMarkdownToHTML(text) {
        if (!text) return " ";

        const headingRegex = /^(#{1,6})\s+(.*)$/gm;
        const boldRegex = /\*\*(.*?)\*\*/g;
        const italicRegex = /\*(.*?)\*/g;
        const codeBlockRegex = /```([\s\S]*?)```/g;
        const listItemRegex = /^(\d+\.\s+|[-*]\s+)(.*)/gm;
        const linkRegex = /\[(.*?)\]\((.*?)\)/g;
        const imageRegex = /!\[(.*?)\]\((.*?)\)/g;
        const horizontalRuleRegex = /^---+$/gm;

        // Process headings
        text = text.replace(headingRegex, (match, hashes, content) => {
            const level = hashes.length;
            return `<h${level}>${content}</h${level}>`;
        });

        // Process bold, italic, and code blocks
        text = text.replace(boldRegex, '<strong>$1</strong>');
        text = text.replace(italicRegex, '<em>$1</em>');
        text = text.replace(codeBlockRegex, (match, code) => {
            const formattedCode = code.trim().replace(/</g, '&lt;').replace(/>/g, '&gt;');
            return `<pre><code>${formattedCode}</code></pre>`;
        });

        // Process unordered lists
        text = text.replace(listItemRegex, (match, marker, content) => {
            return `<ul><li>${content}</li></ul>`;
        });

        // Process links, images, and horizontal rules
        text = text.replace(linkRegex, '<a href="$2" target="_blank">$1</a>');
        text = text.replace(imageRegex, '<img src="$2" alt="$1" />');
        text = text.replace(horizontalRuleRegex, '<hr>');

        // Add line breaks for new lines that are not part of other HTML elements
        text = text.replace(/\n(?!<\/?(ul|li|h\d|pre|code|hr|a|img))/g, '<br>');

        // Merge consecutive `<ul></ul>` tags into one list
        text = text.replace(/<\/ul>\s*<ul>/g, '');

        return text;
    }


    // Tab switching logic
    const tabBtns = document.querySelectorAll('.tab-btn');
    const tabContents = document.querySelectorAll('.tab-content');
    tabBtns.forEach(btn => {
        btn.addEventListener('click', async () => {
            const tabName = btn.dataset.tab;
            tabBtns.forEach(b => b.classList.remove('active'));
            tabContents.forEach(c => c.classList.remove('active'));
            btn.classList.add('active');
            document.getElementById(tabName).classList.add('active');
            if (tabName == 'summarize') {
                await createSummarizer();
            }
        });
    });

    // Summarize tab logic
    const summarizeBtn = document.getElementById('summarizeBtn');
    const summaryResult = document.getElementById('summaryResult');

    async function summarizeText(text) {
        if (!summarizer) {
            console.warn("Summarizer is not initialized.");
            summaryResult.innerText = "Summarization not supported on this device.";
            return null;
        }

        try {
            const result = await summarizer.summarize(text);
            return result;
        } catch (error) {
            console.log('Summarization error:', error);
            summaryResult.innerText = 'Failed to summarize the page. Please try again.';
            return null;
        }
    }

    summarizeBtn.addEventListener('click', async () => {
        if (!aiSession && !(await initAI())) return;
        summaryResult.innerText = 'Summarizing...';

        try {
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

            // Execute script to retrieve the page content
            chrome.scripting.executeScript(
                {
                    target: { tabId: tab.id },
                    function: () => {
                        // Attempt to fetch the text content from the root element to capture more text
                        return document.documentElement.innerText || document.documentElement.outerText || document.body.textContent;
                    }
                },
                async (result) => {
                    if (chrome.runtime.lastError) {
                        console.error(chrome.runtime.lastError.message);
                        summaryResult.innerText = 'Failed to retrieve page content. Permission might be restricted.';
                        return;
                    }

                    const pageText = result[0]?.result;
                    if (!pageText) {
                        summaryResult.innerText = "Content access restricted on this page.";
                        return;
                    }

                    // Summarize the page text
                    const summary = await summarizeText(pageText);
                    if (summary) {
                        summaryResult.innerHTML = convertMarkdownToHTML(summary);
                    } else {
                        summaryResult.innerText = 'Could not generate summary. Please try again.';
                    }
                }
            );
        } catch (error) {
            console.error('Error generating summary:', error);
            summaryResult.innerText = 'An error occurred. Please try another page or refresh.';
        }
    });

    // Simplify tab logic
    const simplifyBtn = document.getElementById('simplifyBtn');
    const textToSimplify = document.getElementById('textToSimplify');
    const simplificationLevel = document.getElementById('simplificationLevel');
    const simplifyResult = document.getElementById('simplifyResult');

    simplifyBtn.addEventListener('click', async () => {
        if (!aiSession && !(await initAI())) return;
        const text = textToSimplify.value.trim();
        if (!text) return;

        simplifyResult.innerText = 'Simplifying...';
        const level = simplificationLevel.value;
        const prompt = `${level === 'basic' ? 'Simplify in very basic language ' : 'Explain technically in very technical and professional language'} ,the given text:\n\n${text}`;

        try {
            const stream = await aiSession.promptStreaming(prompt);
            let response = ''; // Initialize response variable

            for await (const chunk of stream) {
                response = chunk.trim();
                simplifyResult.innerHTML = convertMarkdownToHTML(response);
            }
        } catch (error) {
            console.error('Error simplifying text:', error);
            simplifyResult.innerText = 'Failed to simplify the text. Please try again.';
        }
    });


    // Quiz tab logic
    const generateQuizBtn = document.getElementById('generateQuizBtn');
    const quizType = document.getElementById('quizType');
    const quizArea = document.getElementById('quizArea');

    generateQuizBtn.addEventListener('click', async () => {
        if (!aiSession && !(await initAI())) return;
        quizArea.innerText = 'Generating quiz...';

        const quizTypeSelected = quizType.value;
        const prompt = `Generate a ${quizTypeSelected === 'multiChoice' ? 'multiple-choice' : quizTypeSelected === 'fillBlank' ? 'fill-in-the-blank' : 'true/false'} quiz.`;

        try {
            const stream = await aiSession.promptStreaming(prompt);
            let response = '';

            for await (const chunk of stream) {
                response = chunk.trim();


                const formattedQuizResponse = convertMarkdownToHTML(response);
                quizArea.innerHTML = formattedQuizResponse;
            }
        } catch (error) {
            console.error('Error generating quiz:', error);
            quizArea.innerText = 'Failed to generate quiz.';
        }
    });




    //Chat Functionality

    const chatMessages = document.getElementById('chatMessages');
    const chatInput = document.getElementById('chatInput');
    const sendChatBtn = document.getElementById('sendChatBtn');

    let abortController = null; // To manage aborting the API request

    async function handleChatInput() {
        const question = chatInput.value.trim();
        if (!question) return;

        // Clear the input
        chatInput.value = '';
        appendMessage('user', question);

        if (!aiSession && !(await initAI())) {
            sendChatBtn.disabled = false;
            return;
        }

        // Set the button to "Stop" while processing
        sendChatBtn.textContent = 'Stop';
        sendChatBtn.onclick = stopResponse;

        // Make the API call and handle the response
        try {
            await generateChatResponse(question);
        } catch (error) {
            console.error('Error generating response:', error);
            appendMessage('alert', 'Failed to get response. Please try again.');
        } finally {
            // Reset the button back to "Send"
            resetSendButton();
            chatInput.focus();
        }
    }

    function stopResponse() {
        if (abortController) {
            abortController.abort(); // Abort the current request
            appendMessage('alert', 'Response generation stopped.');
        }
        resetSendButton();
    }

    function resetSendButton() {
        sendChatBtn.textContent = 'Send';
        sendChatBtn.onclick = handleChatInput;
        sendChatBtn.disabled = false;
        abortController = null; // Reset the abort controller for the next question
    }

    async function generateChatResponse(userMessage) {
        const prompt = `Student: ${userMessage}\nTeacher:`;

        let response = '';
        const messageEl = appendMessage('robot', 'Generating...');

        abortController = new AbortController();
        const signal = abortController.signal;

        try {
            const stream = await aiSession.promptStreaming(prompt, { signal });

            // Process each chunk from the stream
            for await (const chunk of stream) {
                response = chunk;
                updateMessageContent(messageEl, convertMarkdownToHTML(response));
            }

            addCopyButton(messageEl); // Add a copy button after the full response is received
        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('Request was aborted');
            } else {
                console.error('Error during stream:', error);
                appendMessage('alert', 'An error occurred while generating the response.');
            }
        } finally {
            abortController = null; // Ensure the abort controller is reset after completion
        }

        return response.trim();
    }

    // Function to append a new message element
    function appendMessage(role, msg) {
        const messageEl = document.createElement('div');
        messageEl.className = `chat-message ${role}`;

        const messageContent = document.createElement('span');
        messageContent.innerHTML = msg;

        messageEl.appendChild(messageContent);
        chatMessages.style.display = 'block';
        chatMessages.appendChild(messageEl);
        chatMessages.scrollTop = chatMessages.scrollHeight;

        return messageEl;
    }

    // Function to update the content of an existing message element
    function updateMessageContent(messageEl, msg) {
        const messageContent = messageEl.querySelector('span');
        messageContent.innerHTML = msg;
    }

    // Function to add a copy button to each robot message
    function addCopyButton(messageEl) {
        const copyBtn = document.createElement('button');
        copyBtn.innerText = 'Copy';
        copyBtn.className = 'copy-btn';
        copyBtn.onclick = () => copyToClipboard(messageEl.querySelector('span').innerText);

        messageEl.appendChild(copyBtn);
    }

    // Copy text to clipboard
    function copyToClipboard(text) {
        navigator.clipboard.writeText(text).then(() => {
            alert('Response copied to clipboard!');
        }).catch((error) => {
            console.error('Failed to copy text:', error);
        });
    }

    sendChatBtn.addEventListener('click', handleChatInput);
    chatInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleChatInput();
    });

});

