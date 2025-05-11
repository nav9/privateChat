$(document).ready(function() {
    console.log("Chat App Initialized");

    // --- Global State ---
    let chats = {}; // Stores Chat objects { chatName: ChatInstance }
    let activeChatName = null;
    let defaultChatNameCounter = 1;
    let currentTheme = 'dark'; // Default theme
    let confirmationCallback = null; // For confirmation modal

    // --- Chat Class ---
    class Chat {
        constructor(name, algorithm, password, smsOptimized = false) {
            if (!name || !algorithm || !password) {
                throw new Error("Chat name, algorithm, and password are required.");
            }
            this.name = name;
            this.algorithm = algorithm;
            this.password = password; // Store password in memory (Note: insecure for real apps)
            this.smsOptimized = smsOptimized;
            this.isHidden = false;
            this.messages = []; // Array of { type: 'sender'/'receiver', originalText: '', encryptedText: '', timestamp: Date.now() }
            console.log(`Chat "${name}" created with algorithm "${algorithm}".`);
        }

        addMessage(type, originalText, encryptedText) {
            const timestamp = Date.now();
            this.messages.push({ type, originalText, encryptedText, timestamp });
            console.log(`Message added to chat "${this.name}" (Timestamp: ${timestamp})`);
            // Optional: Limit message history size
            // if (this.messages.length > 100) { this.messages.shift(); }
        }

        deleteMessage(timestamp) {
             try {
                const initialLength = this.messages.length;
                this.messages = this.messages.filter(msg => msg.timestamp !== timestamp);
                if (this.messages.length < initialLength) {
                     console.log(`Message with timestamp ${timestamp} deleted from chat "${this.name}".`);
                    return true;
                }
                 console.warn(`Message with timestamp ${timestamp} not found for deletion in chat "${this.name}".`);
                return false;
            } catch (error) {
                console.error(`Error deleting message in chat "${this.name}":`, error);
                return false;
            }
        }

        getMessages() {
            return this.isHidden ? [] : [...this.messages]; // Return copy or empty if hidden
        }

        clearMessages() {
            this.messages = [];
             console.log(`Messages cleared for chat "${this.name}".`);
        }

        verifyPassword(pwd) {
            const passwordsMatch = this.password === pwd;
            console.log(`Password verification for chat "${this.name}": ${passwordsMatch ? 'Success' : 'Failure'}`);
            return passwordsMatch;
        }

        hide() {
            this.isHidden = true;
            console.log(`Chat "${this.name}" hidden.`);
        }

        show() {
            this.isHidden = false;
             console.log(`Chat "${this.name}" shown.`);
        }

        export() {
            try {
                const dataToExport = {
                    name: this.name,
                    algorithm: this.algorithm,
                    smsOptimized: this.smsOptimized,
                    // Password is NOT exported
                    messages: this.messages.map(msg => ({ // Don't export sensitive parts if needed
                        type: msg.type,
                        originalText: msg.originalText, // Decide if original should be exported
                        encryptedText: msg.encryptedText,
                        timestamp: msg.timestamp
                    }))
                };
                console.log(`Exporting chat "${this.name}" data (password excluded).`);
                return JSON.stringify(dataToExport, null, 2); // Pretty print JSON
            } catch (error) {
                console.error(`Error exporting chat "${this.name}":`, error);
                showNotification(`Error exporting chat: ${error.message}`, 'error');
                return null;
            }
        }

        // Note: Import requires external handling for password prompt
        static importData(jsonData, newPassword) {
             try {
                 const data = JSON.parse(jsonData);
                 if (!data.name || !data.algorithm || !data.messages || !newPassword) {
                     throw new Error("Imported data is missing required fields or no password provided.");
                 }

                 // Basic validation for uniqueness could happen here before creating
                 const newChat = new Chat(data.name, data.algorithm, newPassword, data.smsOptimized || false);
                 newChat.messages = data.messages.map(msg => ({ // Basic validation of imported messages
                     type: msg.type === 'sender' || msg.type === 'receiver' ? msg.type : 'receiver', // Default to receiver if invalid
                     originalText: msg.originalText || '',
                     encryptedText: msg.encryptedText || '',
                     timestamp: msg.timestamp || Date.now() // Provide fallback timestamp
                 }));

                console.log(`Chat "${data.name}" imported successfully.`);
                 return newChat;
            } catch (error) {
                console.error("Error during chat import:", error);
                showNotification(`Import Error: ${error.message}`, 'error');
                return null;
            }
        }
    }
    
    //----------------------------------------------
    //----------------------------------------------
    // --- Dummy Encryption/Decryption Functions ---
    //----------------------------------------------
    //----------------------------------------------

    //----------------------------------------------
    //--- NAV CIPHER
    //----------------------------------------------
    
    const cipherArray = Array.from(
        'abcdefghijklmnopqrstuvwxyz ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()_+-=~`[]{};:",.<>?/\\'
    );

    async function hashPassword(password) {
        const encoder = new TextEncoder();
        const data = encoder.encode(password);
        const hashBuffer = await crypto.subtle.digest('SHA-512', data);
        return new Uint8Array(hashBuffer);
    }

    function getNonce() {
        return Math.floor(Math.random() * 90) + 10; // Generates a two-digit nonce
    }

    async function encryptNavCipher(text, pwd) { 
        try {
            let hash = await hashPassword(pwd);
            let nonce = getNonce();
            let cipherMap = new Map();
            let indicesMap = new Set();            
            let i = 0;
            for (let char of cipherArray) {
                let index = (hash[i % hash.length] % 10) + nonce; // Add nonce to index
                // Convert 10-35 --> a-z or A-Z
                if (hash[i % hash.length] >= 97 && hash[i % hash.length] <= 122) {
                    index = (hash[i % hash.length] - 87 + nonce) % cipherArray.length;
                } else if (hash[i % hash.length] >= 65 && hash[i % hash.length] <= 90) {
                    index = (hash[i % hash.length] - 29 + nonce) % cipherArray.length;
                } else {
                    index = (hash[i % hash.length] + nonce) % cipherArray.length;
                }
                //console.log(indicesMap);
                while (indicesMap.has(index)) {                    
                    index = (index + 1) % cipherArray.length;
                }
                indicesMap.add(index);
                cipherMap.set(char, cipherArray[index]);
                i++;
            }

            let encryptedText = Array.from(text).map(ch => cipherMap.get(ch) || ch).join('');
            return nonce.toString()[0] + encryptedText + nonce.toString()[1];
        } catch (error) {
            console.error('Encryption failed:', error);
        }
    }
    async function decryptNavCipher(encryptedText, pwd) { 
        try {
            let nonce = parseInt(encryptedText[0] + encryptedText[encryptedText.length - 1]) % 100; // Get nonce
            let hash = await hashPassword(pwd);
            let cipherMap = new Map();
            let indicesMap = new Set();
            
            let i = 0;
            for (let char of cipherArray) {
                let index = (hash[i % hash.length] % 10) + nonce; // Add nonce to index
                
                // Convert 10-35 --> a-z or A-Z
                if (hash[i % hash.length] >= 97 && hash[i % hash.length] <= 122) {
                    index = (hash[i % hash.length] - 87 + nonce) % cipherArray.length;
                } else if (hash[i % hash.length] >= 65 && hash[i % hash.length] <= 90) {
                    index = (hash[i % hash.length] - 29 + nonce) % cipherArray.length;
                } else {
                    index = (hash[i % hash.length] + nonce) % cipherArray.length;
                }

                while (indicesMap.has(index)) {
                    index = (index + 1) % cipherArray.length;
                }
                indicesMap.add(index);
                cipherMap.set(cipherArray[index], char);
                i++;
            }

            let decryptedText = Array.from(encryptedText.slice(1, encryptedText.length - 1)).map(ch => cipherMap.get(ch) || ch).join('');
            return decryptedText;
        } catch (error) {
            console.error('Decryption failed:', error);
        }        
    }

    // function encryptChaCha20(text, pwd) { return pwd ? `ChaCha20Encrypted(${text})` : null; }
    // function decryptChaCha20(text, pwd) { return pwd && text.startsWith('ChaCha20Encrypted(') ? text.slice(18, -1) : null; }

    //----------------------------------------------
    //--- Custom Caesar cipher
    //----------------------------------------------
    // --- Helper Function for Caesar Cipher Offsets ---
    function getCaesarCipherOffsets(password) {
        let passwordAsciiSum = 0;
        for (let i = 0; i < password.length; i++) {
            passwordAsciiSum += password.charCodeAt(i);
        }

        let offsetUpper = passwordAsciiSum % 26;
        if (offsetUpper === 0) {
            offsetUpper = 1; // Ensure offset is at least 1
        }

        // Separate offsets are needed for small and capital, implying the sum is re-evaluated or used the same way.
        // If it meant an independent sum based on properties of lowercase chars in password, the logic would differ.
        // Assuming the same sum applies its modulo logic independently.
        let offsetLower = passwordAsciiSum % 26;
        if (offsetLower === 0) {
            offsetLower = 1;
        }

        let offsetDigit = passwordAsciiSum % 10;
        if (offsetDigit === 0) {
            offsetDigit = 1;
        }
        // console.log(`Caesar Offsets: Upper=${offsetUpper}, Lower=${offsetLower}, Digit=${offsetDigit} from Sum=${passwordAsciiSum}`);
        return { offsetUpper, offsetLower, offsetDigit };
    }


    /**
     * Encrypts text using the custom Caesar cipher.
     * - Uppercase letters (A-Z) are shifted.
     * - Lowercase letters (a-z) are shifted independently.
     * - Digits (0-9) are shifted.
     * - Other characters remain unchanged.
     * @param {string} text - The plaintext to encrypt.
     * @param {string} pwd - The password to derive the shift amount.
     * @returns {string|null} The encrypted text, or null if input is invalid.
     */
    function encryptCaesarCipher(text, pwd) {
        if (typeof text !== 'string' || typeof pwd !== 'string' || pwd.length === 0) {
            console.error("Caesar Encrypt: Invalid input text or password.");
            return null;
        }
        try {
            const { offsetUpper, offsetLower, offsetDigit } = getCaesarCipherOffsets(pwd);
            let encryptedText = "";

            for (let i = 0; i < text.length; i++) {
                let char = text[i];
                let charCode = text.charCodeAt(i);

                if (charCode >= 65 && charCode <= 90) { // Uppercase A-Z
                    char = String.fromCharCode(((charCode - 65 + offsetUpper) % 26) + 65);
                } else if (charCode >= 97 && charCode <= 122) { // Lowercase a-z
                    char = String.fromCharCode(((charCode - 97 + offsetLower) % 26) + 97);
                } else if (charCode >= 48 && charCode <= 57) { // Digits 0-9
                    char = String.fromCharCode(((charCode - 48 + offsetDigit) % 10) + 48);
                }
                // Other characters (including spaces, symbols) remain unchanged
                encryptedText += char;
            }
            return encryptedText;
        } catch (error) {
            console.error("Error during Caesar encryption:", error);
            return null;
        }
    }

    /**
     * Decrypts text encrypted with the custom Caesar cipher.
     * @param {string} text - The encrypted text.
     * @param {string} pwd - The password used for encryption.
     * @returns {string|null} The decrypted plaintext, or null if input is invalid.
     */
    function decryptCaesarCipher(text, pwd) {
        if (typeof text !== 'string' || typeof pwd !== 'string' || pwd.length === 0) {
            console.error("Caesar Decrypt: Invalid input text or password.");
            return null;
        }
        try {
            const { offsetUpper, offsetLower, offsetDigit } = getCaesarCipherOffsets(pwd);
            let decryptedText = "";

            for (let i = 0; i < text.length; i++) {
                let char = text[i];
                let charCode = text.charCodeAt(i);

                if (charCode >= 65 && charCode <= 90) { // Uppercase A-Z
                    // Ensure positive result before modulo for decryption
                    char = String.fromCharCode(((charCode - 65 - offsetUpper + 26) % 26) + 65);
                } else if (charCode >= 97 && charCode <= 122) { // Lowercase a-z
                    char = String.fromCharCode(((charCode - 97 - offsetLower + 26) % 26) + 97);
                } else if (charCode >= 48 && charCode <= 57) { // Digits 0-9
                    char = String.fromCharCode(((charCode - 48 - offsetDigit + 10) % 10) + 48);
                }
                // Other characters remain unchanged
                decryptedText += char;
            }
            return decryptedText;
        } catch (error) {
            console.error("Error during Caesar decryption:", error);
            return null;
        }
    }

    //----------------------------------------------
    //--- AES
    //----------------------------------------------
    function encryptAES(text, pwd) { 
        const encrypted = CryptoJS.AES.encrypt(text, pwd);
        return encrypted.toString();
    }
    
    function decryptAES(text, pwd) { 
        const decrypted = CryptoJS.AES.decrypt(text, pwd);
        return decrypted.toString(CryptoJS.enc.Utf8); // Convert from word array to string
    }

    // function encryptRSA(text, pwd) { return pwd ? `RSAEncrypted<${text}>` : null; }
    // function decryptRSA(text, pwd) { return pwd && text.startsWith('RSAEncrypted<') ? text.slice(13, -1) : null; }

    function encrypt(text, algorithm, password) {
        try {
            if (!text || !algorithm || !password) return null;
            console.log(`Encrypting with ${algorithm}...`);
            switch (algorithm) {
                case 'Nav Cipher': return encryptNavCipher(text, password);
                case 'Caesar Cipher': return encryptCaesarCipher(text, password); 
                //case 'ChaCha20': return encryptChaCha20(text, password);
                case 'AES': return encryptAES(text, password);
                //case 'RSA': return encryptRSA(text, password);
                default:
                     console.warn(`Unknown encryption algorithm: ${algorithm}`);
                    return null;
            }
        } catch (error) {
            console.error(`Encryption error with ${algorithm}:`, error);
            showNotification(`Encryption Error: ${error.message}`, 'error');
            return null;
        }
    }

    async function decrypt(text, algorithm, password) {
         try {
             if (!text || !algorithm || !password) return null;
            console.log(`Decrypting with ${algorithm}...`);
             switch (algorithm) {
                 case 'Nav Cipher': return decryptNavCipher(text, password);
                 case 'Caesar Cipher': return decryptCaesarCipher(text, password);
                 //case 'ChaCha20': return decryptChaCha20(text, password);
                 case 'AES': return decryptAES(text, password);
                 //case 'RSA': return decryptRSA(text, password);
                 default:
                    console.warn(`Unknown decryption algorithm: ${algorithm}`);
                    return null;
             }
         } catch (error) {
             console.error(`Decryption error with ${algorithm}:`, error);
             showNotification(`Decryption Error: ${error.message}`, 'error');
             return null;
         }
    }

    // --- UI Update Functions ---

    function renderChatList() {
        const $switcher = $('#chat-switcher');
        $switcher.empty(); // Clear existing options
        const chatNames = Object.keys(chats);

        if (chatNames.length === 0) {
            $switcher.hide();
            return;
        }

        $switcher.append($('<option>', { value: '', text: '-- Select Chat --', disabled: activeChatName === null, selected: activeChatName === null }));

        chatNames.sort().forEach(name => {
             const chat = chats[name];
             const displayName = name + (chat.isHidden ? ' (Hidden)' : '');
            $switcher.append($('<option>', {
                value: name,
                text: displayName,
                selected: name === activeChatName
            }));
        });
        $switcher.show();
    }

    function renderChatMessages(chatName) {
        const $chatBox = $('#chat-box');
        $chatBox.empty(); // Clear previous messages

        const chat = chats[chatName];
        if (!chat) {
            console.error(`Chat "${chatName}" not found for rendering.`);
            $chatBox.append('<div class="welcome-message">Error: Chat not found.</div>');
             return;
        }
        if (chat.isHidden) {
            $chatBox.append('<div class="welcome-message">Chat is hidden. Enter password to view.</div>');
             $('#input-area').hide(); // Hide input for hidden chat
            return;
        }
        if (chat.messages.length === 0) {
             $chatBox.append('<div class="welcome-message">No messages yet.</div>');
             $('#input-area').show(); // Show input for empty active chat
            return;
        }

        const messages = chat.getMessages(); // Get messages (handles isHidden internally now)
        messages.forEach(msg => {
            const $messageDiv = $('<div>').addClass(`chat-message ${msg.type}`).attr('data-timestamp', msg.timestamp);
            let contentHTML = '';

            if (msg.type === 'sender') {
                 // Sender: Original text shown, encrypted below
                 contentHTML = `
                    <div class="message-content">${escapeHtml(msg.originalText)}</div>
                    <div class="message-below-text">Above text in encrypted form below:</div>
                    <div class="message-content encrypted-part" style="font-style: italic; color: var(--text-secondary);">${escapeHtml(msg.encryptedText)}</div>
                 `;
            } else { // Receiver
                // Receiver: Received (encrypted) text shown, decrypted below
                 contentHTML = `
                    <div class="message-content">${escapeHtml(msg.encryptedText)}</div>
                     <div class="message-below-text">The above text decrypted is below:</div>
                     <div class="message-content decrypted-part">${escapeHtml(msg.originalText) || '[Decryption Failed or No Original]'}</div>
                 `;
            }

             const $actions = $('<div>').addClass('message-actions');
             // Add Copy Button (Copy ENCRYPTED text for sender, DECRYPTED for receiver simulation)
             const textToCopy = msg.type === 'sender' ? msg.encryptedText : msg.originalText;
             $actions.append(
                 $('<button>')
                     .addClass('copy-msg-btn')
                     .attr('title', 'Copy Text')
                     .attr('data-text', textToCopy) // Store text to copy directly
                     .html('<i class="fas fa-copy"></i>')
             );
             // Add Delete Button
             $actions.append(
                 $('<button>')
                     .addClass('delete-msg-btn')
                     .attr('title', 'Delete Message')
                     .html('<i class="fas fa-trash-alt"></i>')
             );

            $messageDiv.html(contentHTML).append($actions);
            $chatBox.append($messageDiv);
        });

        $('#input-area').show(); // Ensure input area is visible
        scrollToBottom($chatBox);
    }

    function scrollToBottom($element) {
        $element.scrollTop($element[0].scrollHeight);
    }

    function updateHeaderControls() {
        if (activeChatName && chats[activeChatName]) {
             const chat = chats[activeChatName];
            $('#delete-chat-btn, #export-chat-btn, #hide-show-chat-btn').show();
            $('#chat-switcher').val(activeChatName);

             // Update Hide/Show button
             if (chat.isHidden) {
                 $('#hide-show-chat-btn').html('<i class="fas fa-eye"></i> Show').attr('title', 'Show Current Chat');
             } else {
                 $('#hide-show-chat-btn').html('<i class="fas fa-eye-slash"></i> Hide').attr('title', 'Hide Current Chat');
             }

        } else {
            $('#delete-chat-btn, #export-chat-btn, #hide-show-chat-btn').hide();
             // Maybe select the '-- Select Chat --' option if no chat is active
             if ($('#chat-switcher').find('option[value=""]').length > 0) {
                 $('#chat-switcher').val('');
             } else if (Object.keys(chats).length === 0){
                 $('#chat-switcher').hide(); // Hide switcher if no chats exist
             }
        }
        // Always show Import and New Chat buttons
        $('#import-chat-btn, #new-chat-btn').show();
    }

    function switchChat(chatName) {
         console.log(`Attempting to switch to chat: ${chatName}`);
        if (!chatName || !chats[chatName]) {
             console.warn(`Switch failed: Chat "${chatName}" does not exist.`);
             activeChatName = null;
             $('#chat-box').empty().append('<div class="welcome-message">Use the buttons above to either import a saved chat or create a chat. Use the menu at the top left to view an explanation of how to use this app and to change preferences.</div>');
             $('#input-area').hide();
        } else {
            const chat = chats[chatName];
             activeChatName = chatName; // Set active chat *before* potentially prompting for password

             if (chat.isHidden) {
                 // Prompt for password
                 showPasswordPrompt(`Enter password for chat "${chatName}"`, (password) => {
                    if (chat.verifyPassword(password)) {
                        chat.show(); // Mark as shown
                        renderChatMessages(chatName); // Render the now visible chat
                        updateHeaderControls(); // Update button text (e.g., "Hide")
                    } else {
                        showNotification("Incorrect password.", "error");
                        activeChatName = null; // Deselect chat if password fails
                        renderChatList(); // Update dropdown to reflect deselection
                        $('#chat-box').empty().append('<div class="welcome-message">Incorrect password. Select another chat or try again.</div>');
                        $('#input-area').hide();
                        updateHeaderControls(); // Update header for no active chat
                    }
                }, () => {
                     // Cancelled password prompt
                     activeChatName = null; // Deselect chat
                     renderChatList(); // Update dropdown to reflect deselection
                     $('#chat-box').empty().append('<div class="welcome-message">Password entry cancelled. Select another chat.</div>');
                     $('#input-area').hide();
                     updateHeaderControls(); // Update header for no active chat
                 });
                 // Show placeholder while waiting for password
                 $('#chat-box').empty().append('<div class="welcome-message">Chat is hidden. Enter password to view.</div>');
                 $('#input-area').hide();
             } else {
                renderChatMessages(chatName); // Render immediately if not hidden
             }
        }
         renderChatList(); // Ensure dropdown reflects the current state
        updateHeaderControls(); // Update buttons based on activeChatName
    }

    function clearChatDisplay() {
        $('#chat-box').empty().append('<div class="welcome-message">Chat hidden or cleared.</div>');
        $('#input-area').hide();
         console.log("Chat display area cleared.");
    }


    // --- Modal Handling ---
    function showModal(modalId) {
         console.log(`Showing modal: ${modalId}`);
        $('#modal-overlay').addClass('active');
        $(`#${modalId}`).addClass('active');
         // Add listener to close modal on ESC key press
        $(document).on('keydown.modal', function(e) {
            if (e.key === "Escape") {
                hideModal(modalId);
            }
        });
    }

    function hideModal(modalId) {
        console.log(`Hiding modal: ${modalId}`);
        $('#modal-overlay').removeClass('active');
        $(`#${modalId}`).removeClass('active');
        // Clean up confirmation callback if it's the confirmation modal
        if (modalId === 'confirmation-modal') {
            confirmationCallback = null;
        }
        // Remove ESC key listener specific to this modal
        $(document).off('keydown.modal');
    }

    // Close modal if overlay is clicked
    $('#modal-overlay').on('click', function() {
        $('.modal.active').each(function() {
             hideModal($(this).attr('id'));
        });
    });

     // Close modal via generic close/cancel buttons
     $('.modal').on('click', '.close-modal-btn, .cancel-btn, .close-btn', function() {
        hideModal($(this).closest('.modal').attr('id'));
     });


    // --- Notification Handling ---
    function showNotification(message, type = 'info', duration = 2000) {
        const $notificationArea = $('#notification-area');
        $notificationArea.text(message);
        $notificationArea.removeClass('error success info').addClass(type); // Add type class if needed for styling
        $notificationArea.fadeIn();

        setTimeout(() => {
            $notificationArea.fadeOut();
        }, duration);
         console.log(`Notification: ${message} (Type: ${type})`);
    }

     // --- Confirmation Modal ---
    function showConfirmation(message, onConfirm) {
        $('#confirmation-message').text(message);
        confirmationCallback = onConfirm; // Store the callback
        showModal('confirmation-modal');
    }

    $('#confirm-action-btn').on('click', function() {
        if (typeof confirmationCallback === 'function') {
             try {
                confirmationCallback(); // Execute the stored action
             } catch (error) {
                 console.error("Error executing confirmation callback:", error);
                 showNotification("An error occurred.", "error");
             }
        }
        hideModal('confirmation-modal');
    });

    $('#confirm-cancel-btn').on('click', function() {
        hideModal('confirmation-modal');
    });

     // --- Password Prompt Modal ---
     let passwordPromptConfirmCallback = null;
     let passwordPromptCancelCallback = null;

     function showPasswordPrompt(message, onConfirm, onCancel, title = "Enter Password") {
         $('#password-prompt-title').text(title);
         $('#password-prompt-message').text(message);
         $('#password-prompt-input').val(''); // Clear previous input
         passwordPromptConfirmCallback = onConfirm;
         passwordPromptCancelCallback = onCancel;
         showModal('password-prompt-modal');
         $('#password-prompt-input').focus(); // Focus input field
     }

     $('#password-prompt-submit').on('click', function() {
         const password = $('#password-prompt-input').val();
         if (typeof passwordPromptConfirmCallback === 'function') {
             passwordPromptConfirmCallback(password);
         }
         hideModal('password-prompt-modal');
     });

     $('#password-prompt-cancel').on('click', function() {
         if (typeof passwordPromptCancelCallback === 'function') {
             passwordPromptCancelCallback();
         }
         hideModal('password-prompt-modal');
     });
     // Allow submitting password prompt with Enter key
    $('#password-prompt-input').on('keypress', function(e) {
        if (e.key === 'Enter') {
            e.preventDefault(); // Prevent form submission if it were in a form
            $('#password-prompt-submit').click(); // Trigger the submit button click
        }
    });


    // --- Utility Functions ---
    function escapeHtml(unsafe) {
        if (unsafe === null || unsafe === undefined) return '';
        return String(unsafe)
             .replace(/&/g, "&amp;")
             .replace(/</g, "&lt;")
             .replace(/>/g, "&gt;")
             .replace(/"/g, "&quot;")
             .replace(/'/g, "&#039;");
    }

    function generateDefaultChatName() {
        let name;
        do {
            name = `Chat${defaultChatNameCounter++}`;
        } while (chats[name]); // Ensure name is unique
        return name;
    }

    // --- Event Listeners ---

    // Hamburger Menu Toggle
    $('#menu-toggle').on('click', function() {
        $('#sidebar').toggleClass('active');
        $('#modal-overlay').toggleClass('active'); // Show overlay when sidebar is open
    });
    $('#close-sidebar-btn').on('click', function() {
         $('#sidebar').removeClass('active');
         $('#modal-overlay').removeClass('active');
    });
    // Close sidebar if overlay is clicked
    $('#modal-overlay').on('click', function() {
        if ($('#sidebar').hasClass('active')) {
            $('#sidebar').removeClass('active');
            $('#modal-overlay').removeClass('active');
        }
    });

    // Sidebar Links
    $('#explanation-link').on('click', function(e) {
        e.preventDefault();
        showModal('explanation-modal');
         $('#sidebar').removeClass('active'); // Close sidebar
         $('#modal-overlay').removeClass('active');
    });
    $('#preferences-link').on('click', function(e) {
        e.preventDefault();
        showModal('preferences-modal');
         $('#sidebar').removeClass('active'); // Close sidebar
         $('#modal-overlay').removeClass('active');
    });

    // Theme Toggle
    $('#theme-toggle').on('click', function() {
        $('body').toggleClass('dark-theme light-theme');
        currentTheme = $('body').hasClass('dark-theme') ? 'dark' : 'light';
        const $icon = $(this).find('i');
        if (currentTheme === 'dark') {
            $(this).html('<i class="fas fa-moon"></i> Light Mode');
             console.log("Switched to Dark Theme");
        } else {
            $(this).html('<i class="fas fa-sun"></i> Dark Mode');
             console.log("Switched to Light Theme");
        }
    });

    // New Chat Button
    $('#new-chat-btn').on('click', function() {
        $('#chat-name').val(generateDefaultChatName()); // Pre-fill default name
        $('#chat-password').val('');
        $('#chat-algorithm').val('Nav Cipher'); // Reset to default
        $('#sms-optimization').prop('checked', false);
        showModal('new-chat-modal');
    });

    // New Chat Form Submission
    $('#new-chat-form').on('submit', function(e) {
        e.preventDefault();
        const name = $('#chat-name').val().trim();
        const algorithm = $('#chat-algorithm').val();
        const password = $('#chat-password').val(); // Get password
        const smsOptimized = $('#sms-optimization').is(':checked');

        if (!name) {
            showNotification("Chat name cannot be empty.", "error");
            return;
        }
        if (chats[name]) {
            showNotification(`Chat name "${name}" already exists.`, "error");
            return;
        }
        if (!password) {
            showNotification("Password cannot be empty.", "error");
            return;
        }

        try {
            const newChat = new Chat(name, algorithm, password, smsOptimized);
            chats[name] = newChat;
             console.log(`Chat "${name}" successfully created and added to chats object.`);
            renderChatList();
            switchChat(name); // Switch to the newly created chat
            hideModal('new-chat-modal');
            showNotification(`Chat "${name}" created.`, "success");
        } catch (error) {
            console.error("Error creating new chat:", error);
            showNotification(`Error: ${error.message}`, "error");
        }
    });

    // Chat Switcher
    $('#chat-switcher').on('change', function() {
        const selectedChatName = $(this).val();
        if (selectedChatName) {
            switchChat(selectedChatName);
        }
    });

    // Message Input Character Count
    $('#message-input').on('input', function() {
        const count = $(this).val().length;
        $('#char-count').text(`${count} character${count !== 1 ? 's' : ''}`);
    });

    // Encrypt Button
    $('#encrypt-btn').on('click', async function() {
        const originalText = $('#message-input').val();
        if (!originalText || !activeChatName || !chats[activeChatName]) {
            if (!activeChatName) showNotification("Select a chat first.", "error");
            return;
        }
        const chat = chats[activeChatName];
         if (chat.isHidden) {
             showNotification("Cannot send messages in a hidden chat.", "error");
             return;
         }

        const encryptedText = await encrypt(originalText, chat.algorithm, chat.password);

        if (encryptedText !== null) {
            try {
                 chat.addMessage('sender', originalText, encryptedText);
                 renderChatMessages(activeChatName); // Re-render
                 $('#message-input').val(''); // Clear input
                 $('#char-count').text('0 characters'); // Reset count
                 $('#message-input').focus(); // Keep focus on input
            } catch (error) {
                 console.error("Error adding encrypted message:", error);
                 showNotification("Error adding message.", "error");
            }

        } else {
            showNotification("Encryption failed. Check console for details.", "error");
        }
    });

    // Decrypt Button
    $('#decrypt-btn').on('click', async function() {
        const encryptedText = $('#message-input').val(); // Text to decrypt is from input
         if (!encryptedText || !activeChatName || !chats[activeChatName]) {
             if (!activeChatName) showNotification("Select a chat first.", "error");
             return;
         }
         const chat = chats[activeChatName];
         if (chat.isHidden) {
             showNotification("Cannot decrypt messages in a hidden chat.", "error");
             return;
         }

        const decryptedText = await decrypt(encryptedText, chat.algorithm, chat.password);

        if (decryptedText !== null) {
             try {
                // Add as a 'receiver' message pair: original = decrypted, encrypted = input
                chat.addMessage('receiver', decryptedText, encryptedText);
                renderChatMessages(activeChatName); // Re-render
                $('#message-input').val(''); // Clear input
                $('#char-count').text('0 characters'); // Reset count
                 $('#message-input').focus(); // Keep focus on input
             } catch (error) {
                console.error("Error adding decrypted message:", error);
                showNotification("Error adding message.", "error");
             }
        } else {
            showNotification("Decryption failed. Check console for details or ensure text format matches algorithm.", "error");
            // Optionally, add a failed decryption message
             try {
                 chat.addMessage('receiver', '[Decryption Failed]', encryptedText);
                 renderChatMessages(activeChatName);
                 $('#message-input').val('');
                 $('#char-count').text('0 characters');
                  $('#message-input').focus();
             } catch (error) {
                  console.error("Error adding failed decryption message:", error);
             }
        }
    });

    // Paste Button
    $('#paste-btn').on('click', function() {
        // Check if Clipboard API is available
        if (!navigator.clipboard || !navigator.clipboard.readText) {
            showNotification("Clipboard API not supported or permission denied by your browser.", "error");
            console.warn("Clipboard API (readText) not available.");
            return;
        }

        navigator.clipboard.readText()
            .then(text => {
                const $messageInput = $('#message-input');
                const currentVal = $messageInput.val(); // Get current value if you want to append instead of replace

                // Option 1: Replace existing text
                $messageInput.val(text);

                // Option 2: Append to existing text (Uncomment if preferred)
                // $messageInput.val(currentVal + text);

                console.log("Text pasted from clipboard.");
                showNotification("Text pasted.", "success", 1000); // Short notification

                // !! Crucial: Trigger the input event to update the character count !!
                $messageInput.trigger('input');

                // Optional: Focus the input area and move cursor to the end
                $messageInput.focus();
                // Set cursor position to the end of the pasted text
                const len = $messageInput.val().length;
                $messageInput[0].selectionStart = len;
                $messageInput[0].selectionEnd = len;

            })
            .catch(err => {
                console.error('Failed to read clipboard contents: ', err);
                // Don't show error if permission was denied, browser usually shows a message.
                // Show error for other issues.
                if (err.name !== 'NotAllowedError') {
                     showNotification('Failed to paste text. Clipboard might be empty or contain non-text content.', 'error');
                } else {
                    showNotification('Clipboard permission denied.', 'error');
                }
            });
    });

     // Message Actions (Copy/Delete) using Event Delegation
    $('#chat-box').on('click', '.copy-msg-btn', function() {
        const textToCopy = $(this).data('text'); // Retrieve text from data attribute
        if (!textToCopy) {
            console.warn("No text found to copy for this button.");
            showNotification("Cannot copy empty text.", "error", 1000);
            return;
        }
        navigator.clipboard.writeText(textToCopy)
            .then(() => {
                showNotification("Text copied to clipboard", "success", 1000);
            })
            .catch(err => {
                console.error('Failed to copy text: ', err);
                showNotification("Failed to copy text", "error", 1000);
            });
    });

    $('#chat-box').on('click', '.delete-msg-btn', function() {
        const $messageDiv = $(this).closest('.chat-message');
        const timestamp = parseInt($messageDiv.data('timestamp'), 10); // Ensure it's a number

        if (!activeChatName || !chats[activeChatName] || isNaN(timestamp)) {
             console.error("Cannot delete message: Invalid state or timestamp.", { activeChatName, timestamp });
            return;
        }
         const chat = chats[activeChatName];
         if (chat.isHidden) {
             showNotification("Cannot delete messages in a hidden chat.", "error");
             return;
         }

        showConfirmation("Are you sure you want to delete this message?", () => {
             if (chat.deleteMessage(timestamp)) {
                $messageDiv.fadeOut(300, function() {
                     $(this).remove();
                     // Check if chat box becomes empty after deletion
                     if ($('#chat-box').children('.chat-message').length === 0) {
                         renderChatMessages(activeChatName); // Re-render to show "No messages"
                     }
                 });
                 showNotification("Message deleted", "success", 1000);
             } else {
                 showNotification("Failed to delete message.", "error");
             }
         });
    });


    // Chat Delete Button
    $('#delete-chat-btn').on('click', function() {
        if (!activeChatName || !chats[activeChatName]) return;

         showConfirmation(`Are you sure you want to delete the chat "${activeChatName}"? This cannot be undone.`, () => {
             try {
                 const deletedChatName = activeChatName;
                 delete chats[deletedChatName];
                 activeChatName = null; // Deactivate chat
                 console.log(`Chat "${deletedChatName}" deleted.`);

                 renderChatList(); // Update dropdown
                 updateHeaderControls(); // Hide chat-specific buttons
                 $('#chat-box').empty().append('<div class="welcome-message">Chat deleted. Import, select or create a chat.</div>');
                 $('#input-area').hide();
                 showNotification(`Chat "${deletedChatName}" deleted successfully.`, 'success');
             } catch (error) {
                 console.error("Error deleting chat:", error);
                 showNotification("Error deleting chat.", "error");
             }
         });
    });

     // Hide/Show Chat Button
     $('#hide-show-chat-btn').on('click', function() {
         if (!activeChatName || !chats[activeChatName]) return;
         const chat = chats[activeChatName];

         if (chat.isHidden) {
             // Try to show: Prompt for password
             showPasswordPrompt(`Enter password to show chat "${activeChatName}"`, (password) => {
                 if (chat.verifyPassword(password)) {
                     chat.show();
                     renderChatMessages(activeChatName); // Render content
                     updateHeaderControls(); // Update button text to "Hide"
                     showNotification(`Chat "${activeChatName}" is now visible.`, 'success');
                 } else {
                     showNotification("Incorrect password.", "error");
                     // Keep chat hidden, no change in UI state needed other than the notification
                 }
             });
         } else {
             // Hide the chat
             showConfirmation(`Are you sure you want to hide the chat "${activeChatName}"? You'll need the password to see it again.`, () => {
                 chat.hide();
                 clearChatDisplay(); // Clear the view
                 updateHeaderControls(); // Update button text to "Show"
                 renderChatList(); // Update chat list to show "(Hidden)"
                 showNotification(`Chat "${activeChatName}" is now hidden.`, 'success');
             });
         }
     });


    // Chat Export Button
    $('#export-chat-btn').on('click', function() {
        if (!activeChatName || !chats[activeChatName]) return;

        const chat = chats[activeChatName];
        if (chat.isHidden) {
            showNotification("Cannot export a hidden chat. Please show it first.", "error");
            return;
        }

        const chatDataJson = chat.export();
        if (!chatDataJson) return; // Export function handles errors/notifications

        try {
            const blob = new Blob([chatDataJson], { type: 'application/json' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            // Sanitize filename slightly
            const filename = `${chat.name.replace(/[^a-z0-9_\-\.]/gi, '_')}_export.json`;
            a.download = filename;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
            showNotification(`Chat "${chat.name}" exported as ${filename}.`, 'success');
             console.log(`Export initiated for ${filename}`);
        } catch (error) {
            console.error("Error creating download link for export:", error);
            showNotification("Error creating export file.", "error");
        }
    });

    // Chat Import Button - Triggers hidden file input
    $('#import-chat-btn').on('click', function() {
        $('#import-file-input').click(); // Open file dialog
    });

    // Handle File Input Change (Import)
    $('#import-file-input').on('change', function(event) {
        const file = event.target.files[0];
        if (!file) {
            return; // No file selected
        }

        console.log(`Importing file: ${file.name}`);
        const reader = new FileReader();

        reader.onload = function(e) {
            const jsonData = e.target.result;
            try {
                // Attempt to parse slightly to get the name for the prompt
                 const potentialData = JSON.parse(jsonData);
                 const chatName = potentialData.name;

                 if (!chatName) {
                     throw new Error("Imported file does not contain a chat name.");
                 }

                if (chats[chatName]) {
                     showNotification(`A chat named "${chatName}" already exists. Cannot import duplicate.`, "error");
                     $('#import-file-input').val(''); // Reset file input
                     return;
                 }

                // Prompt for a NEW password for the imported chat
                 showPasswordPrompt(`Enter a NEW password for the imported chat "${chatName}"`, (newPassword) => {
                     if (!newPassword) {
                         showNotification("Import cancelled: Password is required.", "error");
                         $('#import-file-input').val(''); // Reset file input
                         return;
                     }

                     const importedChat = Chat.importData(jsonData, newPassword);

                     if (importedChat) {
                         chats[importedChat.name] = importedChat;
                         renderChatList();
                         switchChat(importedChat.name); // Switch to the newly imported chat
                         showNotification(`Chat "${importedChat.name}" imported successfully.`, 'success');
                     } else {
                         // ImportData function should show specific error notification
                         console.error(`Import failed for file ${file.name}. Chat.importData returned null.`);
                     }
                     $('#import-file-input').val(''); // Reset file input
                 }, () => {
                     showNotification("Import cancelled.", "info");
                     $('#import-file-input').val(''); // Reset file input
                 }, "Set Import Password"); // Custom title for password prompt

            } catch (error) {
                console.error("Error reading or parsing import file:", error);
                showNotification(`Import Error: ${error.message}. Ensure file is valid JSON.`, "error");
                $('#import-file-input').val(''); // Reset file input
            }
        };

        reader.onerror = function(e) {
            console.error("Error reading file:", e);
            showNotification("Error reading import file.", "error");
            $('#import-file-input').val(''); // Reset file input
        };

        reader.readAsText(file); // Read the file as text
    });


    // --- Initial Setup ---
    renderChatList(); // Initial render (likely empty)
    updateHeaderControls(); // Set initial header state
    $('#input-area').hide(); // Start with input hidden
     $('#chat-box').empty().append('<div class="welcome-message">Use the buttons above to either import a saved chat or create a chat. Use the menu at the top left to view an explanation of how to use this app and to change preferences.</div>');
     // Set initial theme button state based on body class
    if ($('body').hasClass('dark-theme')) {
        $('#theme-toggle').html('<i class="fas fa-moon"></i> Light Mode');
    } else {
        $('#theme-toggle').html('<i class="fas fa-sun"></i> Dark Mode');
    }

     console.log("Chat App Ready.");

}); // End of $(document).ready
