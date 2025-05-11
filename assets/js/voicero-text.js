/**
 * VoiceroAI Text Module
 * Handles text chat functionality
 */

// Text interface variables
const VoiceroText = {
  // debounce visibility toggles
  _isChatVisible: false, // tracks whether messages+header+input are up
  _lastChatToggle: 0, // timestamp of last minimize/maximize
  CHAT_TOGGLE_DEBOUNCE_MS: 200, // minimum time between toggles

  isWaitingForResponse: false,
  typingTimeout: null,
  typingIndicator: null,
  currentThreadId: null,
  apiBaseUrl: null, // Will be set by VoiceroCore after API connection
  visibilityGuardInterval: null,
  websiteData: null, // Store the website data including popup questions
  customInstructions: null, // Store custom instructions from API
  messages: [], // Initialize messages array
  initialized: false, // Initialize initialized flag
  lastProductUrl: null, // Store the last product URL for redirect
  isInterfaceBuilt: false, // Flag to check if interface is already built
  websiteColor: "#882be6", // Default color if not provided by VoiceroCore
  colorVariants: {
    main: "#882be6",
    light: "#9370db",
    dark: "#7a5abf",
    superlight: "#d5c5f3",
    superdark: "#5e3b96",
  },

  // Initialize the text module
  init: function () {
    // Apply global welcome styles immediately
    this.forceGlobalWelcomeStyles();

    // Check if already initialized to prevent double initialization
    if (this.initialized) {
      return;
    }
    // Initialize messages array
    this.messages = [];
    // Mark as initialized early to prevent initialization loops
    this.initialized = true;

    // Get API URL and color from Core if available
    if (window.VoiceroCore) {
      if (window.VoiceroCore.getApiBaseUrl) {
        this.apiBaseUrl = VoiceroCore.getApiBaseUrl();
      }

      // Get website color from VoiceroCore
      if (window.VoiceroCore.websiteColor) {
        this.websiteColor = window.VoiceroCore.websiteColor;

        // Generate color variants
        this.getColorVariants(this.websiteColor);
      } else {
        // Use default color and generate variants

        this.getColorVariants(this.websiteColor);
      }

      // SECURITY: Direct API access and accessKey handling removed - now using server-side proxy
    } else {
      // Use default color and generate variants

      this.getColorVariants(this.websiteColor);
    }

    // Create HTML structure for the chat interface but keep it hidden
    this.createChatInterface();

    // Make sure all UI elements have the correct colors
    setTimeout(() => this.applyDynamicColors(), 100);

    // Hide the shadow host if it exists
    const shadowHost = document.getElementById("voicero-shadow-host");
    if (shadowHost) {
      shadowHost.style.display = "none";
    }
  },

  // Apply dynamic colors to all relevant elements
  applyDynamicColors: function () {
    if (!this.shadowRoot) return;

    // Make sure we have color variants
    if (!this.colorVariants) {
      this.getColorVariants(this.websiteColor);
    }

    // Get the main color - USE WEBSITE COLOR DIRECTLY INSTEAD OF VARIANTS
    const mainColor = this.websiteColor || "#882be6"; // Use website color directly

    // Update send button color
    const sendButton = this.shadowRoot.getElementById("send-message-btn");
    if (sendButton) {
      sendButton.style.backgroundColor = mainColor;
    }

    // Update user message bubbles
    const userMessages = this.shadowRoot.querySelectorAll(
      ".user-message .message-content"
    );
    userMessages.forEach((msg) => {
      msg.style.backgroundColor = mainColor;
    });

    // Update read status color
    const readStatuses = this.shadowRoot.querySelectorAll(".read-status");
    readStatuses.forEach((status) => {
      if (status.textContent === "Read") {
        status.style.color = mainColor;
      }
    });

    // Update suggestions
    const suggestions = this.shadowRoot.querySelectorAll(".suggestion");
    suggestions.forEach((suggestion) => {
      suggestion.style.backgroundColor = mainColor;
    });

    // Update welcome message highlight
    const highlights = this.shadowRoot.querySelectorAll(".welcome-highlight");
    highlights.forEach((highlight) => {
      highlight.style.cssText = `color: ${mainColor} !important`;
    });

    // IMPORTANT: Force colors for welcome-title elements
    const welcomeTitles = this.shadowRoot.querySelectorAll(".welcome-title");
    welcomeTitles.forEach((title) => {
      // Apply gradient using direct style property
      title.style.background = `linear-gradient(90deg, ${mainColor}, ${mainColor}) !important`;
      title.style.webkitBackgroundClip = "text !important";
      title.style.backgroundClip = "text !important";
      title.style.webkitTextFillColor = "transparent !important";
    });

    // IMPORTANT: Force colors for welcome-pulse elements
    const welcomePulses = this.shadowRoot.querySelectorAll(".welcome-pulse");
    welcomePulses.forEach((pulse) => {
      pulse.style.backgroundColor = mainColor;
    });

    // Also force global welcome styles for maximum compatibility
    this.forceGlobalWelcomeStyles();
  },

  // Open text chat interface
  openTextChat: function () {
    // Check if thread has messages
    const hasMessages = this.messages && this.messages.length > 0;

    // Check if welcome message should be shown based on session data
    let shouldShowWelcome = !hasMessages;

    // If we have a session with textWelcome defined, use that value instead
    if (this.session && typeof this.session.textWelcome !== "undefined") {
      shouldShowWelcome = this.session.textWelcome;
    }

    // Get current state of textOpenWindowUp if available
    let shouldBeMaximized = true;

    // Check if there's already a session with textOpenWindowUp defined
    if (this.session && typeof this.session.textOpenWindowUp !== "undefined") {
      shouldBeMaximized = this.session.textOpenWindowUp;
    }

    // Update window state if it hasn't been done already
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      window.VoiceroCore.updateWindowState({
        textOpen: true,
        textOpenWindowUp: true, // Always start maximized
        textWelcome: shouldShowWelcome, // Keep the existing welcome message state
        coreOpen: false, // Always false when opening chat
        voiceOpen: false,
        voiceOpenWindowUp: false,
      });
    }

    // Close voice interface if it's open
    const voiceInterface = document.getElementById("voice-chat-interface");
    if (voiceInterface && voiceInterface.style.display === "block") {
      if (window.VoiceroVoice && window.VoiceroVoice.closeVoiceChat) {
        window.VoiceroVoice.closeVoiceChat();
      } else {
        voiceInterface.style.display = "none";
      }
    }

    // Hide the toggle container when opening the chat interface
    const toggleContainer = document.getElementById("voice-toggle-container");
    if (toggleContainer) {
      toggleContainer.style.display = "none";
      toggleContainer.style.visibility = "hidden";
      toggleContainer.style.opacity = "0";
    }

    // Also hide the main button explicitly
    const mainButton = document.getElementById("chat-website-button");
    if (mainButton) {
      mainButton.style.display = "none";
      mainButton.style.visibility = "hidden";
      mainButton.style.opacity = "0";
    }

    // Hide the chooser popup (handled by VoiceroCore now)
    if (
      window.VoiceroCore &&
      typeof window.VoiceroCore.hideMainButton === "function"
    ) {
      window.VoiceroCore.hideMainButton();
    }

    // Check if we already initialized
    if (!this.initialized) {
      this.init();
      // If still not initialized after trying, report error and stop
      if (!this.initialized) {
        return;
      }
    }

    // Create isolated chat frame if not exists
    if (!this.shadowRoot) {
      this.createIsolatedChatFrame();
    }

    // Apply dynamic colors to all elements
    this.applyDynamicColors();

    // Also force welcome message colors directly
    this.forceWelcomeMessageColors();

    // Show the shadow host (which contains the chat interface)
    const shadowHost = document.getElementById("voicero-text-chat-container");
    if (shadowHost) {
      shadowHost.style.display = "block";

      // Position in lower middle of screen to match voice interface
      shadowHost.style.position = "fixed";
      shadowHost.style.left = "50%";
      shadowHost.style.bottom = "20px";
      shadowHost.style.transform = "translateX(-50%)";
      shadowHost.style.zIndex = "9999999";
      shadowHost.style.width = "85%";
      shadowHost.style.maxWidth = "480px";
      shadowHost.style.minWidth = "280px";
    }

    // Make sure the header has high z-index
    if (this.shadowRoot) {
      const headerContainer = this.shadowRoot.getElementById(
        "chat-controls-header"
      );
      if (headerContainer) {
        headerContainer.style.zIndex = "9999999";
      }
    }

    // Set up input and button listeners
    this.setupEventListeners();

    // Set up button event handlers (ensure minimize/maximize work)
    this.setupButtonHandlers();

    // Load existing messages from session
    this.loadMessagesFromSession();

    // If shouldShowWelcome is true, add the welcome message
    if (shouldShowWelcome) {
      const messagesContainer = this.shadowRoot
        ? this.shadowRoot.getElementById("chat-messages")
        : document.getElementById("chat-messages");

      if (messagesContainer) {
        // Clear existing messages if any
        const children = Array.from(messagesContainer.children);
        for (const child of children) {
          if (child.id !== "initial-suggestions") {
            messagesContainer.removeChild(child);
          }
        }

        // Add welcome message
        this.addMessage(
          `
          <div class="welcome-message" style="width: 90% !important; max-width: 400px !important; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08) !important; background: linear-gradient(135deg, #f5f7fa 0%, #e6e9f0 100%) !important; border: none !important;">
            <div class="welcome-title" style="background: linear-gradient(90deg, rgb(99, 102, 241), rgb(99, 102, 241)) text; -webkit-text-fill-color: transparent;">Aura, your website concierge</div>
            <div class="welcome-subtitle">Text me like your best friend and I'll solve any problem you may have.</div>
            <div class="welcome-note"><span class="welcome-pulse" style="background-color: rgb(99, 102, 241);"></span>Ask me anything about this site!</div>
          </div>
          `,
          "ai",
          false,
          true
        );

        // Force colors on the welcome message
        this.forceWelcomeMessageColors();
      }
    }

    // Initialize visibility state
    this._isChatVisible = true;
    this._lastChatToggle = Date.now();

    // After the interface is fully loaded and visible, check if it should be minimized
    // based on the previous session state (delayed to prevent race conditions)
    setTimeout(() => {
      // Now check if we should be minimized according to session preferences
      // We only check this AFTER ensuring the interface is visible
      if (
        window.VoiceroCore &&
        window.VoiceroCore.session &&
        window.VoiceroCore.session.textOpenWindowUp === false
      ) {
        this.minimizeChat();
      }
    }, 1500);
  },

  // Load existing messages from session and display them
  loadMessagesFromSession: function () {
    // Check if we have a session with threads
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.threads &&
      window.VoiceroCore.session.threads.length > 0
    ) {
      // Find the most recent thread by sorting the threads by lastMessageAt or createdAt
      const threads = [...window.VoiceroCore.session.threads];
      const sortedThreads = threads.sort((a, b) => {
        // First try to sort by lastMessageAt if available
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
        }
        // Fall back to createdAt if lastMessageAt is not available
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      // Use the most recent thread (first after sorting)
      const currentThread = sortedThreads[0];

      if (
        currentThread &&
        currentThread.messages &&
        currentThread.messages.length > 0
      ) {
        // Sort messages by createdAt (oldest first)
        const sortedMessages = [...currentThread.messages].sort((a, b) => {
          return new Date(a.createdAt) - new Date(b.createdAt);
        });

        // Clear existing messages if any
        const messagesContainer = this.shadowRoot
          ? this.shadowRoot.getElementById("chat-messages")
          : document.getElementById("chat-messages");

        if (messagesContainer) {
          // Keep the container but remove children (except initial suggestions)
          const children = Array.from(messagesContainer.children);
          for (const child of children) {
            if (child.id !== "initial-suggestions") {
              messagesContainer.removeChild(child);
            }
          }
        }

        // Add each message to the UI
        sortedMessages.forEach((msg) => {
          if (msg.role === "user") {
            // Add user message
            this.addMessage(msg.content, "user", true); // true = skip adding to messages array
          } else if (msg.role === "assistant") {
            try {
              // Parse the content which is a JSON string
              let content = msg.content;
              let aiMessage = "";

              try {
                // Try to parse as JSON
                const parsedContent = JSON.parse(content);
                if (parsedContent.answer) {
                  aiMessage = parsedContent.answer;
                }
              } catch (e) {
                // If parsing fails, use the raw content

                aiMessage = content;
              }

              // Add AI message
              this.addMessage(aiMessage, "ai", true); // true = skip adding to messages array
            } catch (e) {}
          }
        });

        // Store the complete message objects with metadata in the local array
        this.messages = sortedMessages.map((msg) => ({
          ...msg, // Keep all original properties (id, createdAt, threadId, etc.)
          // Ensure 'content' is properly formatted for assistant messages
          content:
            msg.role === "assistant"
              ? this.extractAnswerFromJson(msg.content)
              : msg.content,
        }));

        // Store the thread ID
        this.currentThreadId = currentThread.threadId;

        // Scroll to bottom
        if (messagesContainer) {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
      } else {
        // Still store the thread ID even if no messages
        this.currentThreadId = currentThread.threadId;
      }
    }
  },

  // Helper to extract answer from JSON string
  extractAnswerFromJson: function (jsonString) {
    try {
      const parsed = JSON.parse(jsonString);
      return parsed.answer || jsonString;
    } catch (e) {
      return jsonString;
    }
  },

  // Add a message to the chat
  addMessage: function (text, role, skipAddToMessages = false) {
    // Create message element
    const message = document.createElement("div");
    message.className = role === "user" ? "user-message" : "ai-message";

    // Create message content
    const messageContent = document.createElement("div");
    messageContent.className = "message-content";

    // Set the content (handle HTML if needed)
    if (role === "ai") {
      messageContent.innerHTML = this.formatContent(text);
    } else {
      messageContent.textContent = text;
    }

    // Append content to message
    message.appendChild(messageContent);

    // Find messages container
    const messagesContainer = this.shadowRoot
      ? this.shadowRoot.getElementById("chat-messages")
      : document.getElementById("chat-messages");

    if (messagesContainer) {
      // Append message to container
      messagesContainer.appendChild(message);
      // Scroll to bottom
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }

    // Store message locally for context (unless skipAddToMessages is true)
    if (!skipAddToMessages) {
      // Add with metadata similar to what comes from the server
      const messageObj = {
        role: role,
        content: text,
        createdAt: new Date().toISOString(), // Add timestamp
        id: this.generateId(), // Generate a temporary ID
        type: "text",
      };

      // Add threadId if available
      if (this.currentThreadId) {
        messageObj.threadId = this.currentThreadId;
      } else if (
        window.VoiceroCore &&
        window.VoiceroCore.thread &&
        window.VoiceroCore.thread.threadId
      ) {
        messageObj.threadId = window.VoiceroCore.thread.threadId;
      }

      this.messages.push(messageObj);

      // Set message ID as data attribute on the DOM element for reporting
      message.dataset.messageId = messageObj.id;
    }

    // If this is an AI message, attach the support/report button using VoiceroSupport
    if (
      role === "ai" &&
      window.VoiceroSupport &&
      typeof window.VoiceroSupport.attachReportButtonToMessage === "function"
    ) {
      try {
        // Small delay to ensure the message is fully rendered
        setTimeout(() => {
          window.VoiceroSupport.attachReportButtonToMessage(message, "text");
        }, 50);
      } catch (e) {
        console.error("Failed to attach report button:", e);
      }
    }

    return message;
  },

  // Generate a temporary ID for messages
  generateId: function () {
    return (
      "temp-" +
      Math.random().toString(36).substring(2, 15) +
      Math.random().toString(36).substring(2, 15)
    );
  },

  // Fetch website data from /api/connect endpoint
  fetchWebsiteData: function () {
    // SECURITY: Direct API access removed - now using server-side proxy through WordPress AJAX
    if (!window.voiceroConfig || !window.voiceroConfig.ajaxUrl) {
      this.createFallbackPopupQuestions();
      return;
    }

    // Use WordPress AJAX endpoint instead of direct API access
    const ajaxUrl = window.voiceroConfig.ajaxUrl;
    const nonce = window.voiceroConfig.nonce || "";

    fetch(ajaxUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: new URLSearchParams({
        action: "voicero_get_info",
        nonce: nonce,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Website data fetch failed: ${response.status}`);
        }
        return response.json();
      })
      .then((response) => {
        if (!response || !response.success || !response.data) {
          throw new Error("Invalid response structure");
        }

        // Use the website data from the response
        this.websiteData = { website: response.data };

        // Store custom instructions if available
        if (response.data.customInstructions) {
          this.customInstructions = response.data.customInstructions;
        }

        // Update popup questions in the interface if it exists
        this.updatePopupQuestions();
      })
      .catch((error) => {
        this.createFallbackPopupQuestions();
      });
  },

  // Helper method for creating fallback popup questions
  createFallbackPopupQuestions: function () {
    // Create fallback popup questions if they don't exist
    if (
      !this.websiteData ||
      !this.websiteData.website ||
      !this.websiteData.website.popUpQuestions
    ) {
      this.websiteData = this.websiteData || {};
      this.websiteData.website = this.websiteData.website || {};
      this.websiteData.website.popUpQuestions = [
        { question: "What products do you offer?" },
        { question: "How can I contact customer support?" },
        { question: "Do you ship internationally?" },
      ];
      this.updatePopupQuestions();
    }
  },

  // Update popup questions in the interface with data from API
  updatePopupQuestions: function () {
    if (
      !this.websiteData ||
      !this.websiteData.website ||
      !this.websiteData.website.popUpQuestions
    ) {
      return;
    }

    const popupQuestions = this.websiteData.website.popUpQuestions;

    // Store reference to this for event handlers
    const self = this;

    // Debug function to log DOM structure of suggestions
    const debugSuggestions = function (container, context) {
      if (!container) {
        return;
      }
      const initialSuggestions = container.querySelector(
        "#initial-suggestions"
      );
      if (!initialSuggestions) {
        return;
      }

      const suggestionContainer =
        initialSuggestions.querySelector("div:nth-child(2)");
      if (!suggestionContainer) {
        return;
      }
      const suggestions = suggestionContainer.querySelectorAll(".suggestion");
      suggestions.forEach(function (s, i) {});
    };

    // Find initial suggestions container in both shadow DOM and regular DOM
    const updateSuggestions = function (container) {
      if (!container) {
        return;
      }
      const suggestionsContainer = container.querySelector(
        "#initial-suggestions"
      );
      if (!suggestionsContainer) {
        // Debug the container's HTML to help diagnose issues

        return;
      }
      // Get the div that contains the suggestions
      const suggestionsDiv =
        suggestionsContainer.querySelector("div:nth-child(2)");
      if (!suggestionsDiv) {
        return;
      }
      // Clear existing suggestions
      suggestionsDiv.innerHTML = "";

      // Add new suggestions from API
      popupQuestions.forEach(function (item, index) {
        const questionText = item.question || "Ask me a question";

        // Get the main color for styling
        const mainColor = self.colorVariants
          ? self.colorVariants.main
          : "#882be6";

        suggestionsDiv.innerHTML +=
          '<div class="suggestion" style="' +
          "background: " +
          mainColor +
          ";" +
          "padding: 10px 15px;" +
          "border-radius: 17px;" +
          "cursor: pointer;" +
          "transition: all 0.2s ease;" +
          "color: white;" +
          "font-weight: 400;" +
          "text-align: left;" +
          "font-size: 14px;" +
          "margin-bottom: 8px;" +
          "box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);" +
          '">' +
          questionText +
          "</div>";
      });

      // Re-attach event listeners to the new suggestions
      const suggestions = suggestionsDiv.querySelectorAll(".suggestion");
      suggestions.forEach(function (suggestion) {
        suggestion.addEventListener("click", function () {
          const text = this.textContent.trim();
          // Use self to reference the VoiceroText object
          if (self.sendChatMessage) {
            self.sendChatMessage(text);
          } else {
          }
          // Hide suggestions
          suggestionsContainer.style.display = "none";
        });
      });

      // Make sure suggestions are visible
      suggestionsContainer.style.display = "block";
      suggestionsContainer.style.opacity = "1";
      suggestionsContainer.style.height = "auto";
    };

    // Update in regular DOM
    updateSuggestions(document);
    debugSuggestions(document, "regular DOM");

    // Update in shadow DOM if it exists
    if (this.shadowRoot) {
      updateSuggestions(this.shadowRoot);
      debugSuggestions(this.shadowRoot, "shadow DOM");
    } else {
    }
  },

  // Create the chat interface HTML structure
  createChatInterface: function () {
    try {
      // First check if elements already exist
      const existingInterface = document.getElementById("text-chat-interface");
      if (existingInterface) {
        const messagesContainer = document.getElementById("chat-messages");
        if (messagesContainer) {
          return;
        } else {
          // Remove existing interface to rebuild it completely
          existingInterface.remove();
        }
      }

      // Make sure we have color variants
      if (!this.colorVariants) {
        this.getColorVariants(this.websiteColor);
      }

      // Get colors for styling
      const mainColor = this.colorVariants.main;
      const lightColor = this.colorVariants.light;
      const darkColor = this.colorVariants.dark;
      const superlightColor = this.colorVariants.superlight;
      const superdarkColor = this.colorVariants.superdark;

      // Add CSS styles
      const styleEl = document.createElement("style");
      styleEl.innerHTML = `
        @keyframes gradientMove {
          0% { background-position: 0% 50%; }
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        @keyframes gradientBorder {
          0% { background-position: 0% 50%; }
          25% { background-position: 25% 50%; }
          50% { background-position: 50% 50%; }
          75% { background-position: 75% 50%; }
          100% { background-position: 100% 50%; }
        }
        
        @keyframes colorRotate {
          0% { 
            box-shadow: 0 0 20px 5px rgba(${parseInt(
              mainColor.slice(1, 3),
              16
            )}, ${parseInt(mainColor.slice(3, 5), 16)}, ${parseInt(
        mainColor.slice(5, 7),
        16
      )}, 0.7);
            background: radial-gradient(circle, rgba(${parseInt(
              mainColor.slice(1, 3),
              16
            )}, ${parseInt(mainColor.slice(3, 5), 16)}, ${parseInt(
        mainColor.slice(5, 7),
        16
      )}, 0.8) 0%, rgba(${parseInt(mainColor.slice(1, 3), 16)}, ${parseInt(
        mainColor.slice(3, 5),
        16
      )}, ${parseInt(mainColor.slice(5, 7), 16)}, 0.4) 70%);
          }
          20% { 
            box-shadow: 0 0 20px 5px rgba(68, 124, 242, 0.7);
            background: radial-gradient(circle, rgba(68, 124, 242, 0.8) 0%, rgba(68, 124, 242, 0.4) 70%);
          }
          33% { 
            box-shadow: 0 0 20px 5px rgba(0, 204, 255, 0.7);
            background: radial-gradient(circle, rgba(0, 204, 255, 0.8) 0%, rgba(0, 204, 255, 0.4) 70%);
          }
          50% { 
            box-shadow: 0 0 20px 5px rgba(0, 220, 180, 0.7);
            background: radial-gradient(circle, rgba(0, 220, 180, 0.8) 0%, rgba(0, 220, 180, 0.4) 70%);
          }
          66% { 
            box-shadow: 0 0 20px 5px rgba(0, 230, 118, 0.7);
            background: radial-gradient(circle, rgba(0, 230, 118, 0.8) 0%, rgba(0, 230, 118, 0.4) 70%);
          }
          83% { 
            box-shadow: 0 0 20px 5px rgba(92, 92, 237, 0.7);
            background: radial-gradient(circle, rgba(92, 92, 237, 0.8) 0%, rgba(92, 92, 237, 0.4) 70%);
          }
          100% { 
            box-shadow: 0 0 20px 5px rgba(${parseInt(
              mainColor.slice(1, 3),
              16
            )}, ${parseInt(mainColor.slice(3, 5), 16)}, ${parseInt(
        mainColor.slice(5, 7),
        16
      )}, 0.7);
            background: radial-gradient(circle, rgba(${parseInt(
              mainColor.slice(1, 3),
              16
            )}, ${parseInt(mainColor.slice(3, 5), 16)}, ${parseInt(
        mainColor.slice(5, 7),
        16
      )}, 0.8) 0%, rgba(${parseInt(mainColor.slice(1, 3), 16)}, ${parseInt(
        mainColor.slice(3, 5),
        16
      )}, ${parseInt(mainColor.slice(5, 7), 16)}, 0.4) 70%);
          }
        }
        
        .siri-active {
          position: relative !important;
          animation: colorRotate 8s ease-in-out infinite !important;
          border: none !important;
          overflow: visible !important;
        }
        
        .siri-active::before {
          content: "" !important;
          position: absolute !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          bottom: 0 !important;
          border-radius: 50% !important;
          z-index: -1 !important;
          background: rgba(255, 255, 255, 0.15) !important;
          animation: pulseSize 2s ease-in-out infinite !important;
        }
        
        @keyframes pulseSize {
          0% { transform: scale(1); opacity: 0.7; }
          50% { transform: scale(1.2); opacity: 0.3; }
          100% { transform: scale(1); opacity: 0.7; }
        }
        
        @keyframes welcomePulse {
          0% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.3); opacity: 0.7; }
          100% { transform: scale(1); opacity: 1; }
        }

         .welcome-message {
          text-align: center;
          background: linear-gradient(135deg, #f5f7fa 0%, #e6e9f0 100%);
          border-radius: 18px;
          padding: 12px 15px;
          margin: 12px auto;
          width: 85%;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
          position: relative;
          overflow: hidden;
          border: 1px solid rgba(${parseInt(
            mainColor.slice(1, 3),
            16
          )}, ${parseInt(mainColor.slice(3, 5), 16)}, ${parseInt(
        mainColor.slice(5, 7),
        16
      )}, 0.1);
        }
        
        .welcome-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 5px;
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          background: linear-gradient(90deg, ${
            this.websiteColor || "#882be6"
          }, ${this.websiteColor || "#882be6"});
          -webkit-background-clip: text;
          background-clip: text;
          -webkit-text-fill-color: transparent;
          letter-spacing: 0.5px;
        }
        
        .welcome-subtitle {
          font-size: 14px;
          line-height: 1.4;
          color: #666;
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          margin-bottom: 3px;
        }
        
        .welcome-highlight {
          color: ${this.websiteColor || "#882be6"} !important;
          font-weight: 600;
        }
        
        .welcome-note {
          font-size: 12px;
          opacity: 0.75;
          font-style: italic;
          margin-top: 5px;
          color: #888;
        }
        
        .welcome-pulse {
          display: inline-block;
          width: 8px;
          height: 8px;
          background-color: ${this.websiteColor || "#882be6"};
          border-radius: 50%;
          margin-right: 4px;
          animation: welcomePulse 1.5s infinite;
        }

        /* Hide scrollbar for different browsers */
        #chat-messages {
          scrollbar-width: none !important; /* Firefox */
          -ms-overflow-style: none !important; /* IE and Edge */
          padding: 15px !important; 
          padding-top: 10px !important;
          margin: 0 !important;
          background-color: #f2f2f7 !important;
          border-radius: 12px 12px 0 0 !important;
          transition: max-height 0.25s ease, opacity 0.25s ease !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          max-height: 35vh !important;
          height: auto !important;
          position: relative !important;
        }
        
        #chat-messages::-webkit-scrollbar {
          display: none !important; /* Chrome, Safari, Opera */
        }
        
        #chat-controls-header {
          margin-bottom: 15px !important;
          margin-top: 0 !important;
          background-color: #f2f2f7 !important;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
          border-radius: 0 !important;
          padding: 10px 15px !important;
          width: 100% !important;
          left: 0 !important;
          right: 0 !important;
          z-index: 9999999 !important; /* Very high z-index to ensure it stays on top */
        }

        .typing-indicator {
          display: flex !important;
          gap: 4px;
          padding: 8px 12px;
          background: #e5e5ea;
          border-radius: 18px;
          width: fit-content;
          opacity: 1 !important;
          margin-bottom: 12px; /* Increased from 0px */
          margin-left: 5px;
        }

        .typing-dot {
          width: 7px;
          height: 7px;
          background: #999999;
          border-radius: 50%;
          animation: typingAnimation 1s infinite;
          opacity: 1;
        }

        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typingAnimation {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }

        .user-message {
          display: flex;
          justify-content: flex-end;
          margin-bottom: 16px; /* Increased from default */
          position: relative;
          padding-right: 8px;
          padding-top: 2px;
        }

        .user-message .message-content {
          background: ${mainColor};
          color: white;
          border-radius: 18px;
          padding: 10px 15px;
          max-width: 70%;
          word-wrap: break-word;
          font-size: 15px;
          line-height: 1.4;
          text-align: left;
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
        }

        .ai-message {
          display: flex;
          justify-content: flex-start;
          margin-bottom: 16px; /* Increased from default */
          position: relative;
          padding-left: 8px;
        }

        .ai-message .message-content {
          background: #e5e5ea;
          color: #333;
          border-radius: 18px;
          padding: 10px 15px;
          max-width: 70%;
          word-wrap: break-word;
          font-size: 15px;
          line-height: 1.4;
          text-align: left;
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
        }
        
        /* iPhone-style message grouping */
        .user-message:not(:last-child) .message-content {
          margin-bottom: 3px;
        }
        
        .ai-message:not(:last-child) .message-content {
          margin-bottom: 3px;
        }
        
        /* Message delivery status */
        .read-status {
          font-size: 11px;
          color: #8e8e93;
          text-align: right;
          margin-top: 2px;
          margin-right: 8px;
        }

        .chat-link {
          color: #2196F3;
          text-decoration: none;
          font-weight: 500;
          position: relative;
          transition: all 0.2s ease;
        }

        .chat-link:hover {
          text-decoration: underline;
          opacity: 0.9;
        }
        
        .voice-prompt {
          text-align: center;
          color: #666;
          font-size: 14px;
          margin: 15px auto;
          padding: 10px 15px;
          background: #e5e5ea;
          border-radius: 18px;
          width: 80%;
          transition: all 0.3s ease;
        }
        
        .suggestion {
          background: ${this.websiteColor || "#882be6"} !important;
          padding: 10px 15px !important;
          border-radius: 17px !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          color: white !important;
          font-weight: 400 !important;
          text-align: left !important;
          font-size: 14px !important;
          margin-bottom: 8px !important;
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05) !important;
        }
        
        .suggestion:hover {
          opacity: 0.9 !important;
        }
      `;
      document.head.appendChild(styleEl);

      // Create interface container
      const interfaceContainer = document.createElement("div");
      interfaceContainer.id = "text-chat-interface";

      // Apply styles directly to match voice chat interface
      Object.assign(interfaceContainer.style, {
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "85%",
        maxWidth: "480px",
        minWidth: "280px",
        display: "none",
        zIndex: "2147483647",
        userSelect: "none",
        margin: "0",
        borderRadius: "12px",
        boxShadow: "0 4px 20px rgba(0, 0, 0, 0.1)",
        overflow: "hidden",
      });

      // Create shadow DOM host element
      let shadowHost = document.createElement("div");
      shadowHost.id = "voicero-text-chat-container";

      // Apply styles to match voice chat interface
      Object.assign(shadowHost.style, {
        position: "fixed",
        bottom: "20px",
        left: "50%",
        transform: "translateX(-50%)",
        width: "85%",
        maxWidth: "480px",
        minWidth: "280px",
        zIndex: "2147483646",
        borderRadius: "12px",
        boxShadow: "none", // Remove box shadow
        overflow: "hidden",
        margin: "0",
        display: "none",
        background: "transparent",
        padding: "0",
        border: "none",
        backdropFilter: "none", // Remove any backdrop filter
        webkitBackdropFilter: "none", // Safari support
        opacity: "1", // Ensure full opacity
        position: "relative", // <-- Make parent relative for absolute child
      });
      document.body.appendChild(shadowHost);

      // Create shadow root
      this.shadowRoot = shadowHost.attachShadow({ mode: "open" });

      // Add styles and HTML content to shadow root
      this.shadowRoot.innerHTML = `
        <style>
          /* Same styles as in createChatInterface, but inside shadow DOM */
          @keyframes gradientMove {
            0% { background-position: 0% 50%; }
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
          }

          @keyframes gradientBorder {
            0% { background-position: 0% 50%; }
            25% { background-position: 25% 50%; }
            50% { background-position: 50% 50%; }
            75% { background-position: 75% 50%; }
            100% { background-position: 100% 50%; }
          }
          
          @keyframes colorRotate {
            0% { 
              box-shadow: 0 0 20px 5px rgba(${parseInt(
                mainColor.slice(1, 3),
                16
              )}, ${parseInt(mainColor.slice(3, 5), 16)}, ${parseInt(
        mainColor.slice(5, 7),
        16
      )}, 0.7);
              background: radial-gradient(circle, rgba(${parseInt(
                mainColor.slice(1, 3),
                16
              )}, ${parseInt(mainColor.slice(3, 5), 16)}, ${parseInt(
        mainColor.slice(5, 7),
        16
      )}, 0.8) 0%, rgba(${parseInt(mainColor.slice(1, 3), 16)}, ${parseInt(
        mainColor.slice(3, 5),
        16
      )}, ${parseInt(mainColor.slice(5, 7), 16)}, 0.4) 70%);
            }
            20% { 
              box-shadow: 0 0 20px 5px rgba(68, 124, 242, 0.7);
              background: radial-gradient(circle, rgba(68, 124, 242, 0.8) 0%, rgba(68, 124, 242, 0.4) 70%);
            }
            33% { 
              box-shadow: 0 0 20px 5px rgba(0, 204, 255, 0.7);
              background: radial-gradient(circle, rgba(0, 204, 255, 0.8) 0%, rgba(0, 204, 255, 0.4) 70%);
            }
            50% { 
              box-shadow: 0 0 20px 5px rgba(0, 220, 180, 0.7);
              background: radial-gradient(circle, rgba(0, 220, 180, 0.8) 0%, rgba(0, 220, 180, 0.4) 70%);
            }
            66% { 
              box-shadow: 0 0 20px 5px rgba(0, 230, 118, 0.7);
              background: radial-gradient(circle, rgba(0, 230, 118, 0.8) 0%, rgba(0, 230, 118, 0.4) 70%);
            }
            83% { 
              box-shadow: 0 0 20px 5px rgba(92, 92, 237, 0.7);
              background: radial-gradient(circle, rgba(92, 92, 237, 0.8) 0%, rgba(92, 92, 237, 0.4) 70%);
            }
            100% { 
              box-shadow: 0 0 20px 5px rgba(${parseInt(
                mainColor.slice(1, 3),
                16
              )}, ${parseInt(mainColor.slice(3, 5), 16)}, ${parseInt(
        mainColor.slice(5, 7),
        16
      )}, 0.7);
              background: radial-gradient(circle, rgba(${parseInt(
                mainColor.slice(1, 3),
                16
              )}, ${parseInt(mainColor.slice(3, 5), 16)}, ${parseInt(
        mainColor.slice(5, 7),
        16
      )}, 0.8) 0%, rgba(${parseInt(mainColor.slice(1, 3), 16)}, ${parseInt(
        mainColor.slice(3, 5),
        16
      )}, ${parseInt(mainColor.slice(5, 7), 16)}, 0.4) 70%);
            }
          }
          
          .siri-active {
            position: relative !important;
            animation: colorRotate 8s ease-in-out infinite !important;
            border: none !important;
            overflow: visible !important;
          }
          
          .siri-active::before {
            content: "" !important;
            position: absolute !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            bottom: 0 !important;
            border-radius: 50% !important;
            z-index: -1 !important;
            background: rgba(255, 255, 255, 0.15) !important;
            animation: pulseSize 2s ease-in-out infinite !important;
          }
          
          @keyframes pulseSize {
            0% { transform: scale(1); opacity: 0.7; }
            50% { transform: scale(1.2); opacity: 0.3; }
            100% { transform: scale(1); opacity: 0.7; }
          }
          
          @keyframes welcomePulse {
            0% { transform: scale(1); opacity: 1; }
            50% { transform: scale(1.3); opacity: 0.7; }
            100% { transform: scale(1); opacity: 1; }
          }
          
          .welcome-message {
            text-align: center;
            background: linear-gradient(135deg, #f5f7fa 0%, #e6e9f0 100%);
            border-radius: 18px;
            padding: 12px 15px;
            margin: 12px auto;
            width: 85%;
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
            position: relative;
            overflow: hidden;
            border: 1px solid rgba(${parseInt(
              mainColor.slice(1, 3),
              16
            )}, ${parseInt(mainColor.slice(3, 5), 16)}, ${parseInt(
        mainColor.slice(5, 7),
        16
      )}, 0.1);
          }
          
          .welcome-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 5px;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(90deg, ${
              this.websiteColor || "#882be6"
            }, ${this.websiteColor || "#882be6"});
            -webkit-background-clip: text;
            background-clip: text;
            -webkit-text-fill-color: transparent;
            letter-spacing: 0.5px;
          }
          
          .welcome-subtitle {
            font-size: 14px;
            line-height: 1.4;
            color: #666;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            margin-bottom: 3px;
          }
          
          .welcome-highlight {
            color: ${this.websiteColor || "#882be6"} !important;
            font-weight: 600;
          }
          
          .welcome-note {
            font-size: 12px;
            opacity: 0.75;
            font-style: italic;
            margin-top: 5px;
            color: #888;
          }
          
          .welcome-pulse {
            display: inline-block;
            width: 8px;
            height: 8px;
            background-color: ${this.websiteColor || "#882be6"};
            border-radius: 50%;
            margin-right: 4px;
            animation: welcomePulse 1.5s infinite;
          }

          /* Hide scrollbar for different browsers */
          #chat-messages {
            scrollbar-width: none !important; /* Firefox */
            -ms-overflow-style: none !important; /* IE and Edge */
            padding: 15px !important; 
            padding-top: 10px !important;
            margin: 0 !important;
            background-color: #f2f2f7 !important;
            border-radius: 12px 12px 0 0 !important;
            transition: max-height 0.25s ease, opacity 0.25s ease !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            max-height: 35vh !important;
            height: auto !important;
            position: relative !important;
          }
          
          #chat-messages::-webkit-scrollbar {
            display: none !important; /* Chrome, Safari, Opera */
          }
          
          #chat-controls-header {
            margin-bottom: 15px !important;
            margin-top: 0 !important;
            background-color: #f2f2f7 !important;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
            border-radius: 0 !important;
            padding: 10px 15px !important;
            width: 100% !important;
            left: 0 !important;
            right: 0 !important;
            z-index: 9999999 !important; /* Very high z-index to ensure it stays on top */
          }

          .typing-indicator {
            display: flex !important;
            gap: 4px;
            padding: 8px 12px;
            background: #e5e5ea;
            border-radius: 18px;
            width: fit-content;
            opacity: 1 !important;
            margin-bottom: 12px; /* Increased from 0px */
            margin-left: 5px;
          }

          .typing-dot {
            width: 7px;
            height: 7px;
            background: #999999;
            border-radius: 50%;
            animation: typingAnimation 1s infinite;
            opacity: 1;
          }

          .typing-dot:nth-child(2) { animation-delay: 0.2s; }
          .typing-dot:nth-child(3) { animation-delay: 0.4s; }

          @keyframes typingAnimation {
            0%, 60%, 100% { transform: translateY(0); }
            30% { transform: translateY(-6px); }
          }

          .user-message {
            display: flex;
            justify-content: flex-end;
            margin-bottom: 16px; /* Increased from default */
            position: relative;
            padding-right: 8px;
          }

          .user-message .message-content {
            background: ${mainColor};
            color: white;
            border-radius: 18px;
            padding: 10px 15px;
            max-width: 70%;
            word-wrap: break-word;
            font-size: 15px;
            line-height: 1.4;
            text-align: left;
            box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
          }

          .ai-message {
            display: flex;
            justify-content: flex-start;
            margin-bottom: 16px; /* Increased from default */
            position: relative;
            padding-left: 8px;
          }

          .ai-message .message-content {
            background: #e5e5ea;
            color: #333;
            border-radius: 18px;
            padding: 10px 15px;
            max-width: 70%;
            word-wrap: break-word;
            font-size: 15px;
            line-height: 1.4;
            text-align: left;
            box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
          }
          
          /* iPhone-style message grouping */
          .user-message:not(:last-child) .message-content {
            margin-bottom: 3px;
          }
          
          .ai-message:not(:last-child) .message-content {
            margin-bottom: 3px;
          }
          
          /* Message delivery status */
          .read-status {
            font-size: 11px;
            color: #8e8e93;
            text-align: right;
            margin-top: 2px;
            margin-right: 8px;
          }

          .chat-link {
            color: #2196F3;
            text-decoration: none;
            font-weight: 500;
            position: relative;
            transition: all 0.2s ease;
          }

          .chat-link:hover {
            text-decoration: underline;
            opacity: 0.9;
          }
          
          .voice-prompt {
            text-align: center;
            color: #666;
            font-size: 14px;
            margin: 15px auto;
            padding: 10px 15px;
            background: #e5e5ea;
            border-radius: 18px;
            width: 80%;
            transition: all 0.3s ease;
          }
          
          .suggestion {
            background: ${this.websiteColor || "#882be6"} !important;
            padding: 10px 15px !important;
            border-radius: 17px !important;
            cursor: pointer !important;
            transition: all 0.2s ease !important;
            color: white !important;
            font-weight: 400 !important;
            text-align: left !important;
            font-size: 14px !important;
            margin-bottom: 8px !important;
            box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05) !important;
          }
          
          .suggestion:hover {
            opacity: 0.9 !important;
          }
        </style>

        <!-- IMPORTANT: Restructured layout - Maximize button first in the DOM order -->
        <!-- This is critical so it won't be affected by the messages container collapse -->
        <div 
          id="maximize-chat"
          style="display: none; position: fixed; bottom: 100px; left: 50%; transform: translateX(-50%); z-index: 999999;"
        >
          <button style="
            position: relative;
            background: rgb(99, 102, 241);
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 20px 20px 0 0;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            display: flex;
            align-items: center;
            justify-content: center;
            min-width: 160px;
            margin-bottom: -30px;
            height: 40px;
            overflow: visible;
            box-shadow: none;
            width: auto;
          ">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
            Open Messages
          </button>
        </div>

        <div id="chat-controls-header" style="
          position: sticky !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          height: 40px !important;
          background: rgb(242, 242, 247) !important;
          z-index: 9999999 !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;
          padding: 10px 15px !important;
          border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
          border-radius: 12px 12px 0 0 !important;
          margin: 0 !important;
          width: 100% !important;
          box-shadow: none !important;
          box-sizing: border-box !important;
          transform: translateZ(0);
        ">
          <button id="clear-text-chat" title="Clear Chat History" style="
            background: none;
            border: none;
            cursor: pointer;
            padding: 5px 8px;
            border-radius: 15px;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            background-color: rgba(0, 0, 0, 0.07);
            font-size: 12px;
            color: #666;
          ">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" style="margin-right: 4px;">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Clear</span>
          </button>
          
          <div style="
            display: flex !important;
            gap: 5px !important;
            align-items: center !important;
            margin: 0 !important;
            padding: 0 !important;
            height: 28px !important;
          ">
            <button id="minimize-chat" style="
              background: none;
              border: none;
              cursor: pointer;
              padding: 5px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s ease;
            " title="Minimize">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
                <line x1="5" y1="12" x2="19" y2="12"></line>
              </svg>
            </button>
            
            <button id="toggle-to-voice-chat" style="
              background: none;
              border: none;
              cursor: pointer;
              padding: 5px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s ease;
            " title="Switch to Voice Chat">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
                <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
                <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
                <path d="M12 19v4"/>
                <path d="M8 23h8"/>
              </svg>
            </button>
            
            <button id="close-text-chat" style="
              background: none;
              border: none;
              cursor: pointer;
              padding: 5px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s ease;
            " title="Close">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
                <path d="M18 6L6 18M6 6l12 12"></path>
              </svg>
            </button>
          </div>
        </div>

        <div id="chat-messages" style="
          background: #f2f2f7 !important;
          border-radius: 0 !important;
          padding: 0 !important;
          margin: 0 !important;
          max-height: 35vh;
          overflow-y: auto;
          overflow-x: hidden;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          position: relative;
          transition: all 0.3s ease, max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
        ">
          <div id="loading-bar" style="
            position: absolute;
            top: 0;
            left: 0;
            height: 3px;
            width: 0%;
            background: linear-gradient(90deg, ${
              this.colorVariants.main
            }, #ff4444, ${this.colorVariants.main});
            background-size: 200% 100%;
            border-radius: 3px;
            display: none;
            animation: gradientMove 2s linear infinite;
            z-index: 9999999;
          "></div>
          
          <div style="padding-top: 20px;">
            <div id="initial-suggestions" style="
              padding: 10px 0;
              opacity: 1;
              transition: all 0.3s ease;
            ">
              <!-- Initial suggestions will be dynamically added here -->
            </div>
          </div>
        </div>

        <div id="chat-input-wrapper" style="
          position: relative;
          padding: 2px;
          background: linear-gradient(90deg, 
            ${this.adjustColor(
              `var(--voicero-theme-color, ${this.websiteColor || "#882be6"})`,
              -0.4
            )}, 
            ${this.adjustColor(
              `var(--voicero-theme-color, ${this.websiteColor || "#882be6"})`,
              -0.2
            )}, 
            var(--voicero-theme-color, ${this.websiteColor || "#882be6"}),
            ${this.adjustColor(
              `var(--voicero-theme-color, ${this.websiteColor || "#882be6"})`,
              0.2
            )}, 
            ${this.adjustColor(
              `var(--voicero-theme-color, ${this.websiteColor || "#882be6"})`,
              0.4
            )}
          );
          background-size: 500% 100%;
          border-radius: 0 0 12px 12px;
          animation: gradientBorder 15s linear infinite;
          transition: all 0.3s ease;
          box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
          margin-top: 0;
          border-top: 0;
        ">
          <div style="
            display: flex;
            align-items: center;
            background: white;
            border-radius: 0 0 10px 10px;
            padding: 8px 12px;
            min-height: 45px;
            width: calc(100% - 24px);
          ">
            <input
              type="text"
              id="chat-input"
              placeholder="Message"
              style="
                flex: 1;
                border: none;
                padding: 8px 12px;
                font-size: 16px;
                outline: none;
                background: rgba(0, 0, 0, 0.05);
                border-radius: 20px;
                margin: 0 8px;
                overflow: hidden;
                text-overflow: ellipsis;
                resize: none;
                height: auto;
                min-height: 36px;
                line-height: 20px;
              "
            >
            <button id="send-message-btn" style="
              width: 36px;
              height: 36px;
              border-radius: 50%;
              background: ${this.websiteColor || "#882be6"};
              border: none;
              display: flex;
              align-items: center;
              justify-content: center;
              cursor: pointer;
              transition: all 0.3s ease;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
              position: relative;
            ">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
              </svg>
            </button>
          </div>
          <div style="
            position: absolute;
            bottom: 2px;
            left: 0;
            right: 0;
            text-align: center;
            line-height: 1;
          ">
          </div>
        </div>
      `;

      // Show initial suggestions
      const initialSuggestions = this.shadowRoot.getElementById(
        "initial-suggestions"
      );
      if (initialSuggestions) {
        initialSuggestions.style.display = "block";
        initialSuggestions.style.opacity = "1";
      }

      if (
        this.websiteData &&
        this.websiteData.website &&
        this.websiteData.website.popUpQuestions
      ) {
        this.updatePopupQuestions();
      }

      // Add initial suggestions again
      this.updatePopupQuestions();

      // Set up button event handlers
      this.setupButtonHandlers();

      return this.shadowRoot;
    } catch (error) {}
  },

  // Set up button event handlers
  setupButtonHandlers: function () {
    const shadowRoot = document.getElementById(
      "voicero-text-chat-container"
    ).shadowRoot;
    if (!shadowRoot) return;

    // Get all control buttons
    const minimizeBtn = shadowRoot.getElementById("minimize-chat");
    const maximizeBtn = shadowRoot.getElementById("maximize-chat");
    const closeBtn = shadowRoot.getElementById("close-text-chat");
    const clearBtn = shadowRoot.getElementById("clear-text-chat");
    const toggleBtn = shadowRoot.getElementById("toggle-to-voice-chat");

    // Remove onclick attributes and add event listeners
    if (minimizeBtn) {
      minimizeBtn.removeAttribute("onclick");
      minimizeBtn.addEventListener("click", () => this.minimizeChat());
    }

    if (maximizeBtn) {
      maximizeBtn.removeAttribute("onclick");
      maximizeBtn.addEventListener("click", () => this.maximizeChat());

      // We don't need to set the background color here anymore as it's already set in the HTML
      // Just ensure the button has display:flex for the icon alignment
      const maximizeButton = maximizeBtn.querySelector("button");
      if (maximizeButton) {
        maximizeButton.style.display = "flex";
        maximizeButton.style.alignItems = "center";
        maximizeButton.style.justifyContent = "center";
      }
    }

    if (closeBtn) {
      closeBtn.removeAttribute("onclick");
      closeBtn.addEventListener("click", () => this.closeTextChat());
    }

    if (clearBtn) {
      clearBtn.removeAttribute("onclick");
      clearBtn.addEventListener("click", () => this.clearChatHistory());
    }

    if (toggleBtn) {
      toggleBtn.removeAttribute("onclick");
      toggleBtn.addEventListener("click", () => this.toggleToVoiceChat());
    }

    // Force all welcome message elements to use theme color
    this.forceWelcomeMessageColors();
  },

  // Force all welcome message elements to use website color
  forceWelcomeMessageColors: function () {
    if (!this.shadowRoot) return;

    const mainColor = "rgb(99, 102, 241)";

    // Force welcome message border color
    const welcomeMessages =
      this.shadowRoot.querySelectorAll(".welcome-message");
    welcomeMessages.forEach((msg) => {
      // Explicitly remove border
      msg.style.border = "none";
    });

    // Force welcome title colors
    const welcomeTitles = this.shadowRoot.querySelectorAll(".welcome-title");
    welcomeTitles.forEach((title) => {
      title.style.background = `linear-gradient(90deg, ${mainColor}, ${mainColor})`;
      title.style.webkitBackgroundClip = "text";
      title.style.backgroundClip = "text";
      title.style.webkitTextFillColor = "transparent";
    });

    // Force welcome highlight colors
    const welcomeHighlights =
      this.shadowRoot.querySelectorAll(".welcome-highlight");
    welcomeHighlights.forEach((highlight) => {
      highlight.style.color = `${mainColor} !important`;
    });

    // Force welcome pulse colors
    const welcomePulses = this.shadowRoot.querySelectorAll(".welcome-pulse");
    welcomePulses.forEach((pulse) => {
      pulse.style.backgroundColor = mainColor;
    });
  },

  // Clear chat history
  clearChatHistory: function () {
    // Call the session/clear API endpoint
    if (window.VoiceroCore && window.VoiceroCore.sessionId) {
      // Use the WordPress proxy endpoint
      fetch("/wp-json/voicero/v1/session_clear", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          sessionId: window.VoiceroCore.sessionId,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Session clear failed: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          // Update the session and thread in VoiceroCore
          if (data.session) {
            if (window.VoiceroCore) {
              window.VoiceroCore.session = data.session;

              // Set the new thread (should be the first one in the array)
              if (data.session.threads && data.session.threads.length > 0) {
                // Get the most recent thread (first in the array since it's sorted by lastMessageAt desc)
                window.VoiceroCore.thread = data.session.threads[0];
                window.VoiceroCore.currentThreadId =
                  data.session.threads[0].threadId;

                // IMPORTANT: Also update this component's currentThreadId to ensure new requests use the new thread
                this.currentThreadId = data.session.threads[0].threadId;
              }
            }
          }
        })
        .catch((error) => {
          // console.error("Failed to clear chat history:", error);
        });
    }

    // Also update the UI if the chat is currently open
    const messagesContainer = this.shadowRoot
      ? this.shadowRoot.getElementById("chat-messages")
      : document.getElementById("chat-messages");
    if (messagesContainer) {
      const existingMessages = messagesContainer.querySelectorAll(
        ".user-message, .ai-message"
      );
      existingMessages.forEach((el) => el.remove());
      // Reset height and padding after clearing
      messagesContainer.style.height = "auto";
      messagesContainer.style.paddingTop = "35px";

      // Show initial suggestions again
      const initialSuggestions = messagesContainer.querySelector(
        "#initial-suggestions"
      );
      if (initialSuggestions) {
        initialSuggestions.style.display = "block";
        initialSuggestions.style.opacity = "1";
        initialSuggestions.style.height = "auto";
        initialSuggestions.style.margin = "";
        initialSuggestions.style.padding = "";
        initialSuggestions.style.overflow = "visible";
      }

      // Force global welcome styles BEFORE adding the welcome message
      this.forceGlobalWelcomeStyles();

      // Add welcome message again
      this.addMessage(
        `
        <div class="welcome-message" style="width: 90% !important; max-width: 400px !important; box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08) !important; background: linear-gradient(135deg, #f5f7fa 0%, #e6e9f0 100%) !important; border: none !important;">
          <div class="welcome-title" style="background: linear-gradient(90deg, rgb(99, 102, 241), rgb(99, 102, 241)) text; -webkit-text-fill-color: transparent;">Aura, your website concierge</div>
          <div class="welcome-subtitle">Text me like your best friend and I'll solve any problem you may have.</div>
          <div class="welcome-note"><span class="welcome-pulse" style="background-color: rgb(99, 102, 241);"></span>Ask me anything about this site!</div>
        </div>
        `,
        "ai",
        false,
        true
      );

      // Force colors on the welcome message
      this.forceWelcomeMessageColors();
    }

    // Reset messages array
    this.messages = [];
  },

  // Send chat message to API
  sendChatToApi: function (messageText, threadId) {
    // SECURITY: Direct API access removed - now using WordPress proxy
    if (!window.voiceroConfig || !window.voiceroConfig.ajaxUrl) {
      return Promise.reject("WordPress configuration not available");
    }

    // Show loading indicator
    this.setLoadingIndicator(true);

    // Format the request body according to the NextJS API's expected structure
    const requestBody = {
      message: messageText,
      type: "text",
    };

    // Add thread ID if available (priority order: passed in > current instance > most recent from session)
    if (threadId) {
      requestBody.threadId = threadId;
    } else if (this.currentThreadId) {
      requestBody.threadId = this.currentThreadId;
    } else if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.threads &&
      window.VoiceroCore.session.threads.length > 0
    ) {
      // Find the most recent thread by sorting the threads
      const threads = [...window.VoiceroCore.session.threads];
      const sortedThreads = threads.sort((a, b) => {
        // First try to sort by lastMessageAt if available
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
        }
        // Fall back to createdAt if lastMessageAt is not available
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      // Use the most recent thread ID
      requestBody.threadId = sortedThreads[0].threadId;
    } else if (
      window.VoiceroCore &&
      window.VoiceroCore.thread &&
      window.VoiceroCore.thread.threadId
    ) {
      requestBody.threadId = window.VoiceroCore.thread.threadId;
    }

    // Add website ID if available
    if (window.VoiceroCore && window.VoiceroCore.websiteId) {
      requestBody.websiteId = window.VoiceroCore.websiteId;
    }

    // Add current page URL and collect page data
    requestBody.currentPageUrl = window.location.href;

    // Collect page data for context
    requestBody.pageData = this.collectPageData();

    // Initialize pastContext array
    requestBody.pastContext = [];

    // Check if we have session thread messages available
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.threads &&
      window.VoiceroCore.session.threads.length > 0
    ) {
      // Find the most recent thread with the same approach
      const threads = [...window.VoiceroCore.session.threads];
      const sortedThreads = threads.sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      const recentThread = sortedThreads[0];

      // Check if this thread has messages
      if (recentThread.messages && recentThread.messages.length > 0) {
        const threadMessages = recentThread.messages;

        // Sort messages by creation time to ensure proper order
        const sortedMessages = [...threadMessages].sort((a, b) => {
          return new Date(a.createdAt) - new Date(b.createdAt);
        });

        // Get last 5 user questions and last 5 AI responses in chronological order
        const userMessages = sortedMessages
          .filter((msg) => msg.role === "user")
          .slice(-5);

        const aiMessages = sortedMessages
          .filter((msg) => msg.role === "assistant")
          .slice(-5);

        // Combine all messages in chronological order
        const lastMessages = [...userMessages, ...aiMessages].sort(
          (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
        );

        // Add each message to pastContext with all metadata
        lastMessages.forEach((msg) => {
          if (msg.role === "user") {
            requestBody.pastContext.push({
              question: msg.content,
              role: "user",
              createdAt: msg.createdAt,
              pageUrl: msg.pageUrl || window.location.href,
              id: msg.id,
              threadId: msg.threadId,
            });
          } else if (msg.role === "assistant") {
            requestBody.pastContext.push({
              answer: msg.content,
              role: "assistant",
              createdAt: msg.createdAt,
              id: msg.id,
              threadId: msg.threadId,
            });
          }
        });
      }
    }
    // Fallback to local messages array if session data isn't available
    else if (this.messages && this.messages.length > 0) {
      // Get last 5 user questions and last 5 AI responses
      const userMessages = this.messages
        .filter((msg) => msg.role === "user")
        .slice(-5);

      const aiMessages = this.messages
        .filter((msg) => msg.role === "assistant")
        .slice(-5);

      // Combine all messages in chronological order
      const lastMessages = [...userMessages, ...aiMessages].sort((a, b) => {
        // Use createdAt if available, otherwise use order in array
        if (a.createdAt && b.createdAt) {
          return new Date(a.createdAt) - new Date(b.createdAt);
        }
        return this.messages.indexOf(a) - this.messages.indexOf(b);
      });

      // Add each message to pastContext
      lastMessages.forEach((msg) => {
        if (msg.role === "user") {
          requestBody.pastContext.push({
            question: msg.content,
            role: "user",
            createdAt: msg.createdAt || new Date().toISOString(),
            pageUrl: msg.pageUrl || window.location.href,
            id: msg.id || this.generateId(),
          });
        } else if (msg.role === "assistant") {
          requestBody.pastContext.push({
            answer: msg.content,
            role: "assistant",
            createdAt: msg.createdAt || new Date().toISOString(),
            id: msg.id || this.generateId(),
          });
        }
      });
    }

    // Console log pastContext to verify implementation
    console.log(
      "Past Context (Last 5 messages from each role):",
      requestBody.pastContext
    );
    console.log(requestBody);

    // Use WordPress proxy endpoint instead of direct API call
    return fetch("/wp-json/voicero/v1/wordpress/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
      },
      body: JSON.stringify(requestBody),
    });
  },

  // Create typing indicator for AI messages
  createTypingIndicator: function () {
    // Create typing indicator
    const typingIndicator = document.createElement("div");
    typingIndicator.className = "typing-indicator";
    typingIndicator.style.cssText = `
      display: flex;
      gap: 4px;
      padding: 8px 12px;
      background: #e5e5ea;
      border-radius: 18px;
      width: fit-content;
      margin-bottom: 10px;
      margin-left: 5px;
    `;

    // Create typing dots
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("div");
      dot.className = "typing-dot";
      dot.style.cssText = `
        width: 7px;
        height: 7px;
        background: #999999;
        border-radius: 50%;
        animation: typingAnimation 1s infinite;
      `;
      if (i === 1) dot.style.animationDelay = "0.2s";
      if (i === 2) dot.style.animationDelay = "0.4s";
      typingIndicator.appendChild(dot);
    }
    return typingIndicator;
  },

  // Set loading indicator state
  setLoadingIndicator: function (isLoading) {
    // Find loading bar in shadow DOM or regular DOM
    const getLoadingBar = () => {
      if (this.shadowRoot) {
        return this.shadowRoot.getElementById("loading-bar");
      }
      return document.getElementById("loading-bar");
    };
    const loadingBar = getLoadingBar();
    if (!loadingBar) {
      return;
    }

    if (isLoading) {
      // Show loading animation
      loadingBar.style.display = "block";
      loadingBar.style.width = "100%";
    } else {
      // Hide loading animation
      loadingBar.style.display = "none";
      loadingBar.style.width = "0%";
    }
  },

  // Send a chat message from the suggestion or input
  sendChatMessage: function (text) {
    // If no text provided, get from input field
    if (!text) {
      if (this.shadowRoot) {
        const chatInput = this.shadowRoot.getElementById("chat-input");
        if (chatInput) {
          text = chatInput.value.trim();
          chatInput.value = "";
        }
      }
    }
    // Exit if no text to send
    if (!text || text.length === 0) {
      return;
    }

    // Add user message to UI
    this.addMessage(text, "user");

    // Hide suggestions if visible
    if (this.shadowRoot) {
      const suggestions = this.shadowRoot.getElementById("initial-suggestions");
      if (suggestions) {
        suggestions.style.display = "none";
      }
    }

    // Send message to API
    this.sendMessageToAPI(text);
  },

  // Send message to API (extracted for clarity)
  sendMessageToAPI: function (text) {
    // Set loading state
    this.isWaitingForResponse = true;

    // Apply rainbow animation to send button while waiting for response
    if (this.shadowRoot) {
      const sendButton = this.shadowRoot.getElementById("send-message-btn");
      if (sendButton) {
        sendButton.classList.add("siri-active");
      }
    }

    // Show typing indicator
    const typingIndicator = this.createTypingIndicator();
    let typingWrapper = null;
    if (this.shadowRoot) {
      const messagesContainer = this.shadowRoot.getElementById("chat-messages");
      if (messagesContainer) {
        typingWrapper = document.createElement("div");
        typingWrapper.className = "ai-message typing-wrapper";
        typingWrapper.appendChild(typingIndicator);
        messagesContainer.appendChild(typingWrapper);
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }

    // Function to remove typing indicator and animations
    const removeTypingIndicator = () => {
      if (typingWrapper) {
        typingWrapper.remove();
      }
      const typingElements = document.querySelectorAll(".typing-wrapper");
      typingElements.forEach((el) => el.remove());

      // Remove rainbow animation when response is received
      if (this.shadowRoot) {
        const sendButton = this.shadowRoot.getElementById("send-message-btn");
        if (sendButton) {
          sendButton.classList.remove("siri-active");
        }
      }
    };

    // Send to API
    if (this.sendChatToApi) {
      this.sendChatToApi(text)
        .then((response) => {
          if (!response.ok) {
            throw new Error(`API error: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          // Turn off loading indicator
          this.setLoadingIndicator(false);

          // Remove typing indicator before showing response
          removeTypingIndicator();

          // Log the complete response data

          // Extract message from new response format
          let message = "";
          let action = null;
          let url = null;
          let actionContext = null;

          // Check for the nested response object structure
          if (data && data.response && data.response.answer) {
            message = data.response.answer;

            // Get action and check for action_context
            if (data.response.action) {
              action = data.response.action;

              // Get action_context if available
              if (data.response.action_context) {
                actionContext = data.response.action_context;

                // For redirect actions, get URL from action_context
                if (action === "redirect" && actionContext.url) {
                  url = actionContext.url;
                }
              }
            }

            // Fallback to old format if action_context is not available
            if (!url && data.response.url) {
              url = data.response.url;
            }
          }
          // Fall back to previous format with direct 'answer' field
          else if (data && data.answer) {
            message = data.answer;

            if (data.action) {
              action = data.action;

              // Get action_context if available
              if (data.action_context) {
                actionContext = data.action_context;

                // For redirect actions, get URL from action_context
                if (action === "redirect" && actionContext.url) {
                  url = actionContext.url;
                }
              }
            }

            // Fallback to old format if action_context is not available
            if (!url && data.url) {
              url = data.url;
            }
          }
          // Fall back to direct 'response' string
          else if (data && data.response && typeof data.response === "string") {
            message = data.response;
          }
          // Default fallback
          else {
            message = "I'm sorry, I couldn't process that request.";
          }

          // Add AI response to chat
          this.addMessage(message, "ai");

          // Save the thread ID if provided - AFTER receiving response
          if (data.threadId) {
            this.currentThreadId = data.threadId;

            // Update window state after receiving response
            if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
              window.VoiceroCore.updateWindowState({
                textWelcome: false, // Don't show welcome again
                threadId: data.threadId, // Update with the latest thread ID
              });
            }

            // Ensure VoiceroCore.thread is updated with the new thread
            if (
              window.VoiceroCore &&
              window.VoiceroCore.session &&
              window.VoiceroCore.session.threads
            ) {
              // Find the matching thread in the threads array
              const matchingThread = window.VoiceroCore.session.threads.find(
                (thread) => thread.threadId === data.threadId
              );

              if (matchingThread) {
                // Update VoiceroCore.thread reference
                window.VoiceroCore.thread = matchingThread;

                // Update local messages array with the complete message objects
                if (
                  matchingThread.messages &&
                  matchingThread.messages.length > 0
                ) {
                  this.messages = matchingThread.messages.map((msg) => ({
                    ...msg,
                    content:
                      msg.role === "assistant"
                        ? this.extractAnswerFromJson(msg.content)
                        : msg.content,
                  }));
                }
              }
            }
          }

          if (data.response && window.VoiceroActionHandler) {
            window.VoiceroActionHandler.handle(data.response);
          }

          // Handle redirect if needed
          if (action === "redirect" && url) {
            setTimeout(() => {
              window.location.href = url;
            }, 1000); // Small delay to let the user see the message
          }

          // Reset waiting state
          this.isWaitingForResponse = false;
        })
        .catch((error) => {
          // Turn off loading indicator
          this.setLoadingIndicator(false);
          // Remove typing indicator
          removeTypingIndicator();
          // Add error message
          let errorMessage =
            "I'm sorry, there was an error processing your request. Please try again later.";
          if (error.message && error.message.includes("500")) {
            errorMessage =
              "I'm sorry, but there was a server error. The website's content might not be accessible currently. Please try again in a moment.";
          }
          this.addMessage(errorMessage, "ai");
          this.isWaitingForResponse = false;
        });
    } else {
      // Turn off loading indicator
      this.setLoadingIndicator(false);
      // Remove typing indicator
      removeTypingIndicator();
      this.addMessage(
        "I'm sorry, I'm having trouble connecting to the server. Please try again later.",
        "ai"
      );
      this.isWaitingForResponse = false;
    }
  },

  // Send message from input field
  sendMessage: function () {
    this.sendMessageLogic();
  },

  // Create a new helper function to contain the send logic
  sendMessageLogic: function () {
    // Forward to sendChatMessage to handle the logic
    if (this.shadowRoot) {
      const chatInput = this.shadowRoot.getElementById("chat-input");
      if (chatInput) {
        const text = chatInput.value.trim();
        chatInput.value = "";
        if (text.length > 0) {
          this.sendChatMessage(text);
        }
      }
    }
  },

  // Update the sendChatMessage function to auto-maximize
  sendChatMessage: function (text) {
    this.sendChatMessageLogic(text);
  },

  // Create a new helper function for sendChatMessage logic
  sendChatMessageLogic: function (text) {
    // If no text provided, get from input field
    if (!text) {
      if (this.shadowRoot) {
        const chatInput = this.shadowRoot.getElementById("chat-input");
        if (chatInput) {
          text = chatInput.value.trim();
          chatInput.value = "";
        }
      }
    }
    // Exit if no text to send
    if (!text || text.length === 0) {
      return;
    }

    // Force maximize the chat window
    this.maximizeChat();

    // Add user message to UI
    this.addMessage(text, "user");

    // Hide suggestions if visible
    if (this.shadowRoot) {
      const suggestions = this.shadowRoot.getElementById("initial-suggestions");
      if (suggestions) {
        suggestions.style.display = "none";
      }
    }

    // Send message to API
    this.sendMessageToAPI(text);
  },

  // Close the text chat interface
  closeTextChat: function () {
    console.log("VoiceroText: Closing text chat");

    // Set closing flag
    this.isClosingTextChat = true;

    // First create reliable references to the elements we need
    const textInterface = document.getElementById("text-chat-interface");
    const shadowHost = document.getElementById("voicero-text-chat-container");

    // Update window state first - this is critical
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      // First update to close text chat
      window.VoiceroCore.updateWindowState({
        textOpen: false,
        textOpenWindowUp: false,
        coreOpen: true,
        voiceOpen: false,
        autoMic: false,
        voiceOpenWindowUp: false,
        suppressChooser: true,
      });

      // Small delay to ensure state updates are processed
      setTimeout(() => {
        // Then ensure core is visible
        if (window.VoiceroCore) {
          window.VoiceroCore.ensureMainButtonVisible();
        }
      }, 100);
    }

    // Hide both the interface and shadow host
    if (textInterface) {
      textInterface.style.display = "none";
    }
    if (shadowHost) {
      shadowHost.style.display = "none";
    }

    // Reset closing flag
    this.isClosingTextChat = false;
  },

  // Minimize the chat interface
  minimizeChat: function () {
    const now = Date.now();
    if (
      !this._isChatVisible ||
      now - this._lastChatToggle < this.CHAT_TOGGLE_DEBOUNCE_MS
    ) {
      return; // either already minimized or called too soon
    }
    this._lastChatToggle = now;
    this._isChatVisible = false;

    // Update window state first (text open but window down)
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      window.VoiceroCore.updateWindowState({
        textOpen: true,
        textOpenWindowUp: false, // Set to false when minimized
        coreOpen: false,
        voiceOpen: false,
        voiceOpenWindowUp: false,
      });
    } else {
    }

    // Get the necessary elements from shadow root
    const shadowRoot = document.getElementById(
      "voicero-text-chat-container"
    )?.shadowRoot;
    if (!shadowRoot) return;

    const messagesContainer = shadowRoot.getElementById("chat-messages");
    const headerContainer = shadowRoot.getElementById("chat-controls-header");
    const inputWrapper = shadowRoot.getElementById("chat-input-wrapper");
    const maximizeBtn = shadowRoot.getElementById("maximize-chat");

    // Make the maximize button visible first
    if (maximizeBtn) {
      // Important: Force visible the maximize button with fixed positioning
      maximizeBtn.style.display = "block";
      maximizeBtn.style.position = "fixed";
      maximizeBtn.style.bottom = "100px";
      maximizeBtn.style.left = "50%";
      maximizeBtn.style.transform = "translateX(-50%)";
      maximizeBtn.style.zIndex = "9999999";

      // Ensure the button's style is applied correctly
      const maximizeButton = maximizeBtn.querySelector("button");
      if (maximizeButton) {
        // Reapply the main styling to ensure it's consistent
        maximizeButton.style.position = "relative";
        maximizeButton.style.background = "rgb(99, 102, 241)"; // Use color from voice chat
        maximizeButton.style.border = "none";
        maximizeButton.style.color = "white";
        maximizeButton.style.padding = "10px 20px";
        maximizeButton.style.borderRadius = "20px 20px 0 0";
        maximizeButton.style.fontSize = "14px";
        maximizeButton.style.fontWeight = "500";
        maximizeButton.style.cursor = "pointer";
        maximizeButton.style.display = "flex";
        maximizeButton.style.alignItems = "center";
        maximizeButton.style.justifyContent = "center";
        maximizeButton.style.minWidth = "160px";
        maximizeButton.style.marginBottom = "-30px"; // Updated to match the HTML creation
        maximizeButton.style.height = "40px";
        maximizeButton.style.overflow = "visible";
        maximizeButton.style.boxShadow = "none";
        maximizeButton.style.width = "auto";
      }
    }

    if (messagesContainer) {
      // Hide all message content
      const allMessages = messagesContainer.querySelectorAll(
        ".user-message, .ai-message, #initial-suggestions"
      );
      allMessages.forEach((msg) => {
        msg.style.display = "none";
      });

      // Just adjust maxHeight and opacity without removing from DOM
      messagesContainer.style.maxHeight = "0";
      messagesContainer.style.minHeight = "0";
      messagesContainer.style.height = "0";
      messagesContainer.style.padding = "0";
      messagesContainer.style.margin = "0";
      messagesContainer.style.overflow = "hidden";
      messagesContainer.style.border = "none";
      messagesContainer.style.opacity = "0"; // Make fully transparent

      // Also hide padding container inside
      const paddingContainer = messagesContainer.querySelector(
        "div[style*='padding-top']"
      );
      if (paddingContainer) {
        paddingContainer.style.display = "none";
        paddingContainer.style.height = "0";
        paddingContainer.style.padding = "0";
        paddingContainer.style.margin = "0";
      }
    }

    // Hide the header when minimized
    if (headerContainer) {
      headerContainer.style.display = "none";
    }

    // Adjust input wrapper
    if (inputWrapper) {
      inputWrapper.style.borderRadius = "12px";
      inputWrapper.style.marginTop = "40px"; // Add space above the input wrapper for the button
      inputWrapper.style.position = "relative";
    }
  },

  // Maximize the chat interface
  maximizeChat: function () {
    const now = Date.now();
    if (
      this._isChatVisible ||
      now - this._lastChatToggle < this.CHAT_TOGGLE_DEBOUNCE_MS
    ) {
      return; // either already maximized or called too soon
    }
    this._lastChatToggle = now;
    this._isChatVisible = true;

    // Update window state first (text open with window up)
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      window.VoiceroCore.updateWindowState({
        textOpen: true,
        textOpenWindowUp: true, // Set to true when maximized
        coreOpen: false,
        voiceOpen: false,
        voiceOpenWindowUp: false,
      });
    } else {
    }

    // Get the necessary elements from shadow root
    const shadowRoot = document.getElementById(
      "voicero-text-chat-container"
    )?.shadowRoot;
    if (!shadowRoot) return;

    const messagesContainer = shadowRoot.getElementById("chat-messages");
    const headerContainer = shadowRoot.getElementById("chat-controls-header");
    const inputWrapper = shadowRoot.getElementById("chat-input-wrapper");
    const maximizeBtn = shadowRoot.getElementById("maximize-chat");

    // Hide maximize button first
    if (maximizeBtn) {
      maximizeBtn.style.display = "none";
    }

    if (messagesContainer) {
      // Restore proper scrolling functionality
      messagesContainer.style.maxHeight = "35vh";
      messagesContainer.style.minHeight = "auto";
      messagesContainer.style.height = "auto";
      messagesContainer.style.padding = "15px";
      messagesContainer.style.paddingTop = "0";
      messagesContainer.style.margin = "0";
      messagesContainer.style.overflow = "auto";
      messagesContainer.style.overflowY = "scroll";
      messagesContainer.style.border = "";
      messagesContainer.style.opacity = "1";

      // Show padding container
      const paddingContainer = messagesContainer.querySelector(
        "div[style*='padding-top']"
      );
      if (paddingContainer) {
        paddingContainer.style.display = "block";
        paddingContainer.style.height = "auto";
        paddingContainer.style.paddingTop = "15px";
      }

      // Show all message content
      const allMessages = messagesContainer.querySelectorAll(
        ".user-message, .ai-message"
      );
      allMessages.forEach((msg) => {
        msg.style.display = "flex";
      });

      // Scroll to bottom after maximizing
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 100);
    }

    // Show the header
    if (headerContainer) {
      headerContainer.style.display = "flex";
      headerContainer.style.zIndex = "9999999";
    }

    // Restore input wrapper styling
    if (inputWrapper) {
      inputWrapper.style.borderRadius = "0 0 12px 12px";
      inputWrapper.style.marginTop = "0";
    }

    // Ensure welcome message colors are applied
    this.forceWelcomeMessageColors();
  },

  // Add message to the chat interface (used for both user and AI messages)
  addMessage: function (text, role, isLoading = false, isInitial = false) {
    if (!text) return;

    // Format message if needed
    if (
      window.VoiceroCore &&
      window.VoiceroCore.formatMarkdown &&
      role === "ai"
    ) {
      text = window.VoiceroCore.formatMarkdown(text);
    }

    // Create message element
    const messageDiv = document.createElement("div");
    messageDiv.className = role === "user" ? "user-message" : "ai-message";

    // Generate a unique ID for this message
    const messageId =
      "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    messageDiv.dataset.messageId = messageId;

    // Create message content
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.innerHTML = text;

    // If this is the welcome message, add special iPhone message styling
    if (isInitial) {
      contentDiv.style.background = "#e5e5ea";
      contentDiv.style.color = "#333";
      contentDiv.style.textAlign = "center";
      contentDiv.style.margin = "15px auto";
      contentDiv.style.width = "80%";
      contentDiv.style.borderRadius = "18px";
      messageDiv.style.justifyContent = "center";

      // Clean up the welcome message to ensure it looks good
      if (text.includes("voice-prompt")) {
        // Extract the actual text content
        const tempDiv = document.createElement("div");
        tempDiv.innerHTML = text;
        const promptContent = tempDiv.querySelector(".voice-prompt");
        if (promptContent) {
          const promptText = promptContent.textContent.trim();
          contentDiv.innerHTML = promptText;
        }
      }
    } else if (role === "user") {
      // Apply the main color to user messages - use website color directly
      contentDiv.style.backgroundColor = this.websiteColor || "#882be6";

      // Add delivery status for user messages (iPhone-style)
      const statusDiv = document.createElement("div");
      statusDiv.className = "read-status";
      statusDiv.textContent = "Delivered";
      messageDiv.appendChild(statusDiv);
    }

    // Add to message div
    messageDiv.appendChild(contentDiv);

    // Add to messages container in both shadow DOM and regular DOM
    if (this.shadowRoot) {
      const messagesContainer = this.shadowRoot.getElementById("chat-messages");
      if (messagesContainer) {
        // Find the initial suggestions div
        const initialSuggestions = messagesContainer.querySelector(
          "#initial-suggestions"
        );

        // Hide suggestions when adding real messages
        if (initialSuggestions && !isInitial) {
          initialSuggestions.style.display = "none";
        }

        // Insert new message before the input wrapper
        messagesContainer.appendChild(messageDiv);

        // If this is a welcome message, directly apply styles to ensure correct colors
        if (isInitial) {
          // Find and style the welcome title with correct colors
          const welcomeTitle = messageDiv.querySelector(".welcome-title");
          if (welcomeTitle) {
            welcomeTitle.style.background = `linear-gradient(90deg, ${
              this.websiteColor || "#882be6"
            }, ${this.websiteColor || "#882be6"},)`;
            welcomeTitle.style.webkitBackgroundClip = "text";
            welcomeTitle.style.backgroundClip = "text";
            welcomeTitle.style.webkitTextFillColor = "transparent";
          }

          // Style welcome highlights
          const welcomeHighlight =
            messageDiv.querySelector(".welcome-highlight");
          if (welcomeHighlight) {
            welcomeHighlight.style.color = this.websiteColor || "#882be6";
          }

          // Style welcome pulse
          const welcomePulse = messageDiv.querySelector(".welcome-pulse");
          if (welcomePulse) {
            welcomePulse.style.backgroundColor = this.websiteColor || "#882be6";
          }
        }

        // Update all previous user message statuses to "Read" after AI responds
        if (role === "ai") {
          const userStatusDivs =
            messagesContainer.querySelectorAll(".read-status");
          userStatusDivs.forEach((div) => {
            div.textContent = "Read";
            div.style.color = this.websiteColor || "#882be6";
          });
        }

        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }

    // Store message in history if not a loading indicator
    if (!isLoading) {
      this.messages = this.messages || [];
      this.messages.push({
        role: role === "user" ? "user" : "assistant",
        content: text,
      });

      // Update VoiceroCore state if available
    }

    // If this is an AI message (and not a welcome/initial message), add report button
    if (
      role === "ai" &&
      !isInitial &&
      !isLoading &&
      window.VoiceroSupport &&
      typeof window.VoiceroSupport.attachReportButtonToMessage === "function"
    ) {
      try {
        // Small delay to ensure the message is fully rendered
        setTimeout(() => {
          window.VoiceroSupport.attachReportButtonToMessage(messageDiv, "text");
        }, 50);
      } catch (e) {
        console.error("Failed to attach report button:", e);
      }
    }

    return messageDiv;
  },

  // Create isolated chat frame if not exists
  createIsolatedChatFrame: function () {
    // Implementation will be added here
    this.createChatInterface();
  },

  // Set up event listeners for the chat interface
  setupEventListeners: function () {
    if (!this.shadowRoot) return;

    // Get input field and send button
    const chatInput = this.shadowRoot.getElementById("chat-input");
    const sendButton = this.shadowRoot.getElementById("send-message-btn");

    if (chatInput && sendButton) {
      // Clear existing event listeners if any
      chatInput.removeEventListener("keydown", this._handleInputKeydown);
      sendButton.removeEventListener("click", this._handleSendClick);

      // Remove Siri-like effect on focus since we only want it when generating response
      chatInput.removeEventListener("focus", this._handleInputFocus);
      chatInput.removeEventListener("blur", this._handleInputBlur);
      chatInput.removeEventListener("input", this._handleInputChange);

      // Store bound functions for event cleanup
      this._handleInputKeydown = (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          e.preventDefault();
          this.sendMessage();
        }
      };

      this._handleSendClick = () => {
        this.sendMessage();
      };

      // Add event listeners
      chatInput.addEventListener("keydown", this._handleInputKeydown);
      sendButton.addEventListener("click", this._handleSendClick);

      // Focus the input field
      setTimeout(() => {
        chatInput.focus();
      }, 200);
    }
  },

  // Get color variants from a hex color
  getColorVariants: function (color) {
    if (!color) color = this.websiteColor || "#882be6";

    // Initialize with the main color
    const variants = {
      main: color,
      light: color,
      dark: color,
      superlight: color,
      superdark: color,
    };

    // If it's a hex color, we can calculate variants
    if (color.startsWith("#")) {
      try {
        // Convert hex to RGB for variants
        const r = parseInt(color.slice(1, 3), 16);
        const g = parseInt(color.slice(3, 5), 16);
        const b = parseInt(color.slice(5, 7), 16);

        // Create variants by adjusting brightness
        const lightR = Math.min(255, Math.floor(r * 1.2));
        const lightG = Math.min(255, Math.floor(g * 1.2));
        const lightB = Math.min(255, Math.floor(b * 1.2));

        const darkR = Math.floor(r * 0.8);
        const darkG = Math.floor(g * 0.8);
        const darkB = Math.floor(b * 0.8);

        const superlightR = Math.min(255, Math.floor(r * 1.5));
        const superlightG = Math.min(255, Math.floor(g * 1.5));
        const superlightB = Math.min(255, Math.floor(b * 1.5));

        const superdarkR = Math.floor(r * 0.6);
        const superdarkG = Math.floor(g * 0.6);
        const superdarkB = Math.floor(b * 0.6);

        // Convert back to hex
        variants.light = `#${lightR.toString(16).padStart(2, "0")}${lightG
          .toString(16)
          .padStart(2, "0")}${lightB.toString(16).padStart(2, "0")}`;
        variants.dark = `#${darkR.toString(16).padStart(2, "0")}${darkG
          .toString(16)
          .padStart(2, "0")}${darkB.toString(16).padStart(2, "0")}`;
        variants.superlight = `#${superlightR
          .toString(16)
          .padStart(2, "0")}${superlightG
          .toString(16)
          .padStart(2, "0")}${superlightB.toString(16).padStart(2, "0")}`;
        variants.superdark = `#${superdarkR
          .toString(16)
          .padStart(2, "0")}${superdarkG
          .toString(16)
          .padStart(2, "0")}${superdarkB.toString(16).padStart(2, "0")}`;
      } catch (e) {
        // Fallback to default variants
        variants.light = "#9370db";
        variants.dark = "#7a5abf";
        variants.superlight = "#d5c5f3";
        variants.superdark = "#5e3b96";
      }
    }

    this.colorVariants = variants;

    return variants;
  },

  // Helper methods for color variations
  colorLighter: function (color) {
    if (!color) return "#d5c5f3";
    if (!color.startsWith("#")) return color;

    try {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const lightR = Math.min(255, Math.floor(r * 1.6));
      const lightG = Math.min(255, Math.floor(g * 1.6));
      const lightB = Math.min(255, Math.floor(b * 1.6));

      return `#${lightR.toString(16).padStart(2, "0")}${lightG
        .toString(16)
        .padStart(2, "0")}${lightB.toString(16).padStart(2, "0")}`;
    } catch (e) {
      return "#d5c5f3";
    }
  },

  colorLight: function (color) {
    if (!color) return "#9370db";
    if (!color.startsWith("#")) return color;

    try {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const lightR = Math.min(255, Math.floor(r * 1.3));
      const lightG = Math.min(255, Math.floor(g * 1.3));
      const lightB = Math.min(255, Math.floor(b * 1.3));

      return `#${lightR.toString(16).padStart(2, "0")}${lightG
        .toString(16)
        .padStart(2, "0")}${lightB.toString(16).padStart(2, "0")}`;
    } catch (e) {
      return "#9370db";
    }
  },

  colorDark: function (color) {
    if (!color) return "#7a5abf";
    if (!color.startsWith("#")) return color;

    try {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const darkR = Math.floor(r * 0.7);
      const darkG = Math.floor(g * 0.7);
      const darkB = Math.floor(b * 0.7);

      return `#${darkR.toString(16).padStart(2, "0")}${darkG
        .toString(16)
        .padStart(2, "0")}${darkB.toString(16).padStart(2, "0")}`;
    } catch (e) {
      return "#7a5abf";
    }
  },

  colorDarker: function (color) {
    if (!color) return "#5e3b96";
    if (!color.startsWith("#")) return color;

    try {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      const darkR = Math.floor(r * 0.5);
      const darkG = Math.floor(g * 0.5);
      const darkB = Math.floor(b * 0.5);

      return `#${darkR.toString(16).padStart(2, "0")}${darkG
        .toString(16)
        .padStart(2, "0")}${darkB.toString(16).padStart(2, "0")}`;
    } catch (e) {
      return "#5e3b96";
    }
  },

  adjustColor: function (color, adjustment) {
    if (!color) return "#ff4444";
    if (!color.startsWith("#")) return color;

    try {
      const r = parseInt(color.slice(1, 3), 16);
      const g = parseInt(color.slice(3, 5), 16);
      const b = parseInt(color.slice(5, 7), 16);

      // Positive adjustment makes it lighter, negative makes it darker
      let factor = adjustment < 0 ? 1 + adjustment : 1 + adjustment;

      // Adjust RGB values
      let newR =
        adjustment < 0
          ? Math.floor(r * factor)
          : Math.min(255, Math.floor(r * factor));
      let newG =
        adjustment < 0
          ? Math.floor(g * factor)
          : Math.min(255, Math.floor(g * factor));
      let newB =
        adjustment < 0
          ? Math.floor(b * factor)
          : Math.min(255, Math.floor(b * factor));

      // Convert back to hex
      return `#${newR.toString(16).padStart(2, "0")}${newG
        .toString(16)
        .padStart(2, "0")}${newB.toString(16).padStart(2, "0")}`;
    } catch (e) {
      return color;
    }
  },

  // Force welcome message colors globally with !important
  forceGlobalWelcomeStyles: function () {
    // Use the fixed purple color
    const mainColor = "rgb(99, 102, 241)";

    // Create or update global style tag
    let styleTag = document.getElementById("voicero-forced-styles");
    if (!styleTag) {
      styleTag = document.createElement("style");
      styleTag.id = "voicero-forced-styles";
      document.head.appendChild(styleTag);
    }

    // Set extremely aggressive styling
    styleTag.textContent = `
      .welcome-message {
        border: none !important;
      }
      .welcome-highlight {
        color: ${mainColor} !important;
      }
      .welcome-pulse {
        background-color: ${mainColor} !important;
      }
      .welcome-title {
        background: linear-gradient(90deg, ${mainColor}, ${mainColor}) !important;
        -webkit-background-clip: text !important;
        background-clip: text !important;
        -webkit-text-fill-color: transparent !important;
      }
    `;
  },

  // Collect page data for better context
  collectPageData: function () {
    const pageData = {
      url: window.location.href,
      full_text: document.body.innerText.trim(),
      buttons: [],
      forms: [],
      sections: [],
      images: [],
    };

    // Only include elements that are within the body and not the header
    const isInHeader = (element) => {
      let parent = element.parentElement;
      while (parent) {
        if (parent.tagName && parent.tagName.toLowerCase() === "header") {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    // Check if element is in footer
    const isInFooter = (element) => {
      let parent = element.parentElement;
      while (parent) {
        if (
          parent.tagName &&
          (parent.tagName.toLowerCase() === "footer" ||
            parent.id === "colophon" ||
            parent.id === "ast-scroll-top")
        ) {
          return true;
        }
        parent = parent.parentElement;
      }
      return false;
    };

    // Filter function to exclude unwanted elements
    const shouldExcludeElement = (element) => {
      if (!element) return false;

      // Skip elements without IDs that are in header, footer, or admin bars
      if (!element.id) {
        if (isInHeader(element) || isInFooter(element)) {
          return true;
        }
        return false;
      }

      const id = element.id.toLowerCase();

      // Specific button IDs to exclude
      if (id === "chat-website-button" || id === "voice-mic-button") {
        return true;
      }

      // Exclude common WordPress admin elements
      if (id === "wpadminbar" || id === "adminbarsearch" || id === "page") {
        return true;
      }

      // Exclude masthead
      if (id === "masthead" || id.includes("masthead")) {
        return true;
      }

      // Exclude elements with ids starting with wp- or voicero
      if (id.startsWith("wp-") || id.startsWith("voicero")) {
        return true;
      }

      // Exclude voice toggle container
      if (id === "voice-toggle-container") {
        return true;
      }

      // Exclude elements related to voice-chat or text-chat
      if (id.includes("voice-") || id.includes("text-chat")) {
        return true;
      }

      return false;
    };

    // Collect all buttons that meet our criteria
    const buttonElements = document.querySelectorAll("button");
    buttonElements.forEach((button) => {
      if (
        !isInHeader(button) &&
        !isInFooter(button) &&
        !shouldExcludeElement(button)
      ) {
        pageData.buttons.push({
          id: button.id || "",
          text: button.innerText.trim(),
        });
      }
    });

    // Collect all forms and their inputs/selects that meet our criteria
    const formElements = document.querySelectorAll("form");
    formElements.forEach((form) => {
      if (
        !isInHeader(form) &&
        !isInFooter(form) &&
        !shouldExcludeElement(form)
      ) {
        const formData = {
          id: form.id || "",
          inputs: [],
          selects: [],
        };

        // Get inputs
        const inputs = form.querySelectorAll("input");
        inputs.forEach((input) => {
          formData.inputs.push({
            name: input.name || "",
            type: input.type || "",
            value: input.value || "",
          });
        });

        // Get selects
        const selects = form.querySelectorAll("select");
        selects.forEach((select) => {
          const selectData = {
            name: select.name || "",
            options: [],
          };

          // Get options
          const options = select.querySelectorAll("option");
          options.forEach((option) => {
            selectData.options.push({
              value: option.value || "",
              text: option.innerText.trim(),
            });
          });

          formData.selects.push(selectData);
        });

        pageData.forms.push(formData);
      }
    });

    // Collect important sections that meet our criteria
    const sectionElements = document.querySelectorAll(
      "div[id], section, article, main, aside"
    );
    sectionElements.forEach((section) => {
      if (
        !isInHeader(section) &&
        !isInFooter(section) &&
        !shouldExcludeElement(section)
      ) {
        pageData.sections.push({
          id: section.id || "",
          tag: section.tagName.toLowerCase(),
          text_snippet: section.innerText.substring(0, 150).trim(), // First 150 chars
        });
      }
    });

    // Collect images that meet our criteria
    const imageElements = document.querySelectorAll("img");
    imageElements.forEach((img) => {
      if (!isInHeader(img) && !isInFooter(img) && !shouldExcludeElement(img)) {
        pageData.images.push({
          src: img.src || "",
          alt: img.alt || "",
        });
      }
    });

    return pageData;
  },

  // Toggle from text chat to voice chat
  toggleToVoiceChat: function () {
    console.log("VoiceroText: Toggling from text to voice chat");

    // First close the text chat interface
    this.closeTextChat();

    // Then open the voice chat interface
    if (window.VoiceroVoice && window.VoiceroVoice.openVoiceChat) {
      setTimeout(() => {
        window.VoiceroVoice.openVoiceChat();

        // Make sure it's maximized
        if (window.VoiceroVoice.maximizeVoiceChat) {
          setTimeout(() => {
            window.VoiceroVoice.maximizeVoiceChat();
          }, 100);
        }
      }, 100);
    }
  },

  // Format content with potential links
  formatContent: function (text) {
    if (!text) return "";

    // Process URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const processedText = text.replace(
      urlRegex,
      '<a href="$1" target="_blank" class="chat-link">$1</a>'
    );

    return processedText;
  },

  // Show contact form in the chat interface
  showContactForm: function () {
    // Check if VoiceroContact module is available
    if (
      window.VoiceroContact &&
      typeof window.VoiceroContact.showContactForm === "function"
    ) {
      window.VoiceroContact.showContactForm();
    } else {
      console.error("VoiceroContact module not available");

      // Fallback: Display a message that contact form is not available
      this.addMessage(
        "I'm sorry, the contact form is not available right now. Please try again later or contact us directly.",
        "ai"
      );
    }
  },
};

// Initialize when core is ready
document.addEventListener("DOMContentLoaded", () => {
  // Remove any existing interface first to ensure clean initialization
  const existingInterface = document.getElementById(
    "voicero-text-chat-container"
  );
  if (existingInterface) {
    existingInterface.remove();
  }

  // Check if VoiceroCore is already loaded
  if (typeof VoiceroCore !== "undefined") {
    VoiceroText.init();
  } else {
    // Wait for core to be available
    let attempts = 0;
    const checkCoreInterval = setInterval(() => {
      attempts++;
      if (typeof VoiceroCore !== "undefined") {
        clearInterval(checkCoreInterval);
        VoiceroText.init();
      } else if (attempts >= 50) {
        clearInterval(checkCoreInterval);

        // Initialize anyway to at least have the interface elements ready
        VoiceroText.init();
      }
    }, 100);
  }
});

// Show contact form in the chat interface
VoiceroText.showContactForm = function () {
  // Check if VoiceroContact module is available
  if (
    window.VoiceroContact &&
    typeof window.VoiceroContact.showContactForm === "function"
  ) {
    window.VoiceroContact.showContactForm();
  } else {
    console.error("VoiceroContact module not available");

    // Fallback: Display a message that contact form is not available
    this.addMessage(
      "I'm sorry, the contact form is not available right now. Please try again later or contact us directly.",
      "ai"
    );
  }
};

// Expose global functions
window.VoiceroText = VoiceroText;
