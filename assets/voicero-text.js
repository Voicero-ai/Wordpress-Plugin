/**
 * VoiceroAI Text Module
 * Handles text chat functionality
 */

// Text interface variables
const VoiceroText = {
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

  // Initialize the text module
  init: function () {
    // Check if already initialized to prevent double initialization
    if (this.initialized) {
      return;
    }
    // Initialize messages array
    this.messages = [];
    // Mark as initialized early to prevent initialization loops
    this.initialized = true;

    // Get API URL from Core if available
    if (window.VoiceroCore && window.VoiceroCore.getApiBaseUrl) {
      this.apiBaseUrl = VoiceroCore.getApiBaseUrl();
      // Store access key for later use
      if (window.voiceroConfig && window.voiceroConfig.accessKey) {
        this.accessKey = window.voiceroConfig.accessKey;
        // Fetch website data including popup questions
        this.fetchWebsiteData(this.accessKey);
      }
    } else {
      // Try to get from environment or use a reasonable default
      this.apiBaseUrl =
        this.apiBaseUrl || window.API_URL || "https://www.voicero.ai";
    }

    // Create HTML structure for the chat interface
    this.createChatInterface();

    // Verify the interface was created successfully
    const chatInterface = document.getElementById("text-chat-interface");
    if (chatInterface) {
    } else {
    }
  },

  // Open text chat interface
  openTextChat: function () {
    // Hide the core buttons container
    const coreButtonsContainer = document.getElementById(
      "voice-toggle-container",
    );
    if (coreButtonsContainer) {
      coreButtonsContainer.style.display = "none";
    }

    // Check if we already initialized
    if (!this.initialized) {
      this.init();
      // If still not initialized after trying, report error and stop
      if (!this.initialized) {
        return;
      }
    }

    // Set active interface
    if (VoiceroCore && VoiceroCore.appState) {
      VoiceroCore.appState.isOpen = true;
      VoiceroCore.appState.activeInterface = "text";
      VoiceroCore.isAnyInterfaceOpen = true;
    }

    // Create isolated chat frame if not exists
    if (!this.shadowRoot) {
      this.createIsolatedChatFrame();
    } else {
    }

    // Check if we have popup questions data

    // Make chat visible
    const shadowHost = document.getElementById("voicero-shadow-host");
    if (shadowHost) {
      shadowHost.style.display = "block";
    }

    // Set up input and button listeners
    this.setupEventListeners();

    // Check if we should show welcome message
    const hasMessages = this.messages && this.messages.length > 0;
    const hasShownWelcome =
      window.VoiceroCore &&
      window.VoiceroCore.appState &&
      window.VoiceroCore.appState.hasShownTextWelcome;

    if (!hasMessages && !hasShownWelcome) {
      const welcomeMessage = "Hi there! How can I help you with this website?";
      this.addMessage(welcomeMessage, "ai", false, true);

      // Mark welcome as shown
      if (window.VoiceroCore && window.VoiceroCore.appState) {
        window.VoiceroCore.appState.hasShownTextWelcome = true;
        window.VoiceroCore.saveState();
      }
    }

    // Show initial suggestions if available and if we haven't chatted before
    if (
      this.websiteData &&
      this.websiteData.website &&
      this.websiteData.website.popUpQuestions
    ) {
      // Check if we already have messages (don't show suggestions if we do)
      if (this.messages && this.messages.length > 0) {
        // Hide suggestions in both DOM contexts
        if (this.shadowRoot) {
          const suggestions = this.shadowRoot.getElementById(
            "initial-suggestions",
          );
          if (suggestions) {
            suggestions.style.display = "none";
          }
        }
        const suggestions = document.getElementById("initial-suggestions");
        if (suggestions) {
          suggestions.style.display = "none";
        }
      } else {
        // Show and update suggestions
        if (this.shadowRoot) {
          const suggestions = this.shadowRoot.getElementById(
            "initial-suggestions",
          );
          if (suggestions) {
            suggestions.style.display = "block";
            suggestions.style.opacity = "1";
          }
        }
        // Update with the latest popup questions
        this.updatePopupQuestions();
      }
    } else {
      this.fetchWebsiteData(this.accessKey);
    }
  },

  // Fetch website data from /api/connect endpoint
  fetchWebsiteData: function (accessKey) {
    if (!this.apiBaseUrl) {
      return;
    }
    if (!accessKey) {
      return;
    }
    const apiUrl = `${this.apiBaseUrl}/api/connect`;

    fetch(apiUrl, {
      method: "GET",
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${accessKey}`,
      },
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`API validation failed: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        if (!data || typeof data !== "object") {
          return;
        }
        this.websiteData = data;
        // Store custom instructions if available
        if (data.website && data.website.customInstructions) {
          this.customInstructions = data.website.customInstructions;
        }
        // Update popup questions in the interface if it exists
        this.updatePopupQuestions();
      })
      .catch((error) => {
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
      });
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
        "#initial-suggestions",
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
        "#initial-suggestions",
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

        suggestionsDiv.innerHTML +=
          '<div class="suggestion" style="' +
          "background: #882be6;" +
          "padding: 8px 14px;" +
          "border-radius: 8px;" +
          "cursor: pointer;" +
          "transition: all 0.2s ease;" +
          "color: white;" +
          "font-weight: 500;" +
          "text-align: left;" +
          "font-size: 13px;" +
          "margin-bottom: 6px;" +
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
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .typing-indicator {
          display: flex !important;
          gap: 4px;
          padding: 8px 12px;
          background: #f0f0f0;
          border-radius: 12px;
          width: fit-content;
          opacity: 1 !important;
          margin-bottom: 0;
        }

        .typing-dot {
          width: 8px;
          height: 8px;
          background: #666;
          border-radius: 50%;
          animation: typingAnimation 1s infinite;
          opacity: 1;
        }

        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typingAnimation {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
        }

        .user-message {
          display: flex;
          justify-content: flex-end;
        }

        .user-message .message-content {
          background: #882be6;
          color: white;
          border-radius: 12px 12px 0 12px;
          padding: 10px 14px;
          max-width: 65%;
          word-wrap: break-word;
          font-size: 14px;
          line-height: 1.4;
        }

        .ai-message {
          display: flex;
          justify-content: flex-start;
        }

        .ai-message .message-content {
          background: #f0f0f0;
          color: #333;
          border-radius: 12px 12px 12px 0;
          padding: 10px 14px;
          max-width: 65%;
          word-wrap: break-word;
          font-size: 14px;
          line-height: 1.4;
        }

        .chat-link {
          color: #882be6;
          text-decoration: none;
          font-weight: 500;
          position: relative;
          transition: all 0.2s ease;
        }

        .chat-link:hover {
          text-decoration: underline;
          opacity: 0.9;
        }
      `;
      document.head.appendChild(styleEl);

      // Create interface container first
      const interfaceContainer = document.createElement("div");
      interfaceContainer.id = "text-chat-interface";
      interfaceContainer.dataset.chatContainer = "true"; // Add data attribute for easier selection
      interfaceContainer.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        width: 56vw;
        max-width: 960px;
        min-width: 280px;
        display: none;
        z-index: 2147483647; /* Maximum possible z-index value */
        user-select: none;
      `;

      // Create messages container
      const messagesContainer = document.createElement("div");
      messagesContainer.id = "chat-messages";
      messagesContainer.style.cssText = `
        background: white;
        border-radius: 12px 12px 0 0;
        padding: 15px;
        padding-top: 45px; /* Increased to make room for sticky header */
        margin-bottom: 0;
        max-height: 40vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        position: relative;
        transition: all 0.3s ease;
      `;

      // Create a sticky header for controls
      const controlsHeader = document.createElement("div");
      controlsHeader.id = "chat-controls-header";
      controlsHeader.style.cssText = `
        position: sticky;
        top: 0;
        left: 0;
        right: 0;
        height: 36px;
        background: white;
        z-index: 10;
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 5px 10px;
        border-bottom: 1px solid #f0f0f0;
        border-radius: 12px 12px 0 0;
        margin-bottom: 10px;
      `;

      // Move the clear button to the header
      const clearButton =
        document.getElementById("clear-text-chat") ||
        (this.shadowRoot
          ? this.shadowRoot.getElementById("clear-text-chat")
          : null);
      if (clearButton) {
        // Update clearButton styles for the sticky header
        clearButton.style.position = "relative";
        clearButton.style.top = "auto";
        clearButton.style.left = "auto";
        controlsHeader.appendChild(clearButton);
      }

      // Move the close button to the header
      const closeButton =
        document.getElementById("close-text-chat") ||
        (this.shadowRoot
          ? this.shadowRoot.getElementById("close-text-chat")
          : null);
      if (closeButton) {
        // Update closeButton styles for the sticky header
        closeButton.style.position = "relative";
        closeButton.style.top = "auto";
        closeButton.style.right = "auto";
        controlsHeader.appendChild(closeButton);
      }

      // Add minimize button to the header
      const minimizeButton = document.createElement("button");
      minimizeButton.id = "minimize-text-chat";
      minimizeButton.setAttribute("onclick", "VoiceroText.minimizeChat()");
      minimizeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
          <path d="M8 3h8m-8 18h8M4 8v8m16-8v8"/>
        </svg>
      `;
      minimizeButton.style.cssText = `
        background: none;
        border: none;
        cursor: pointer;
        padding: 5px;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        transition: all 0.2s ease;
      `;
      controlsHeader.appendChild(minimizeButton);

      // Insert the controls header at the top of the messages container
      messagesContainer.insertBefore(
        controlsHeader,
        messagesContainer.firstChild,
      );

      // Add minimize and close buttons
      messagesContainer.innerHTML = `
        <button
          id="close-chat"
          onclick="VoiceroText.closeTextChat()"
          style="
            position: absolute;
            top: 10px;
            right: 40px;
            background: none;
            border: none;
            cursor: pointer;
            padding: 5px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            z-index: 1001;
          "
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
            <path d="M18 6L6 18M6 6l12 12"/>
          </svg>
        </button>

        <button
          id="maximize-chat"
          onclick="VoiceroText.maximizeChat()"
          style="
            position: fixed;
            top: 0;
            right: 10px;
            background: white;
            border: none;
            cursor: pointer;
            padding: 8px;
            border-radius: 50%;
            display: none;
            align-items: center;
            justify-content: center;
            transition: all 0.2s ease;
            z-index: 2147483647;
            width: 32px;
            height: 32px;
            box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
            transform: translateY(-45px);
          "
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
            <path d="M8 3v18m8-18v18M4 8h16m-16 8h16"/>
          </svg>
        </button>

        <div id="loading-bar" style="
          position: absolute;
          top: 0;
          left: 0;
          height: 3px;
          width: 0%;
          background: linear-gradient(90deg, #882be6, #ff4444, #882be6);
          background-size: 200% 100%;
          border-radius: 3px;
          display: none;
          animation: gradientMove 2s linear infinite;
        "></div>

        <!-- Add initial suggestions directly in messages area -->
        <div id="initial-suggestions" style="
          padding: 10px 0;
          opacity: 1;
          transition: all 0.3s ease;
        ">
          <div style="
            color: #666;
            font-size: 13px;
            margin-bottom: 10px;
            text-align: center;
          ">
            Try asking one of these questions:
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <!-- Suggestions will be populated from the API -->
            <div class="suggestion" style="
              background: #882be6;
              padding: 8px 14px;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s ease;
              color: white;
              font-weight: 500;
              text-align: left;
              font-size: 13px;
            ">What's the best snowboard you have? 🤔</div>
            <div class="suggestion" style="
              background: #882be6;
              padding: 8px 14px;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s ease;
              color: white;
              font-weight: 500;
              text-align: left;
              font-size: 13px;
            ">Do you do international shipping? 📜</div>
            <div class="suggestion" style="
              background: #882be6;
              padding: 8px 14px;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s ease;
              color: white;
              font-weight: 500;
              text-align: left;
              font-size: 13px;
            ">Where can I go to contact you? 🎯</div>
          </div>
        </div>
      `;

      // Create input container with border
      const inputContainer = document.createElement("div");
      inputContainer.id = "chat-input-wrapper";
      inputContainer.style.cssText = `
        position: relative;
        padding: 2px;
        background: linear-gradient(90deg, #882be6, #ff4444, #882be6);
        background-size: 200% 100%;
        border-radius: 0 0 12px 12px;
        animation: gradientBorder 3s linear infinite;
      `;

      // Add maximize button (OUTSIDE the input area for better visibility)
      const maximizeButton = document.createElement("button");
      maximizeButton.id = "maximize-chat";
      maximizeButton.setAttribute("onclick", "VoiceroText.maximizeChat()");
      maximizeButton.style.cssText = `
        position: fixed;
        bottom: 95px;
        left: 50%;
        right: auto;
        transform: translateX(-50%);
        width: 42px;
        height: 42px;
        background: white;
        border: none;
        border-radius: 50%;
        display: flex;
        align-items: center;
        justify-content: center;
        cursor: pointer;
        box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
        z-index: 2147483647;
        transition: all 0.2s ease;
      `;
      maximizeButton.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
          <path d="M8 3v3a2 2 0 0 1-2 2H3m18 0h-3a2 2 0 0 1-2-2V3m0 18v-3a2 2 0 0 1 2-2h3M3 16h3a2 2 0 0 1 2 2v3"/>
        </svg>
      `;
      inputContainer.appendChild(maximizeButton);

      // Add input field and send button
      inputContainer.innerHTML += `
        <div style="
          display: flex;
          align-items: center;
          background: white;
          border-radius: 0 0 12px 12px;
          padding: 5px;
        ">
          <input
            type="text"
            id="chat-input"
            placeholder="Ask me anything..."
            style="
              flex: 1;
              border: none;
              padding: 12px 20px;
              font-size: 16px;
              outline: none;
              background: transparent;
              border-radius: 50px;
            "
          >
          <button id="send-message-btn" style="
            background: #882be6;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            margin-right: 5px;
            transition: all 0.3s ease;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
            </svg>
          </button>
        </div>
      `;

      // Assemble interface
      interfaceContainer.appendChild(messagesContainer);
      interfaceContainer.appendChild(inputContainer);
      document.body.appendChild(interfaceContainer);

      // Set up event listeners
      this.setupEventListeners();

      // Update popup questions if we have already fetched them
      if (
        this.websiteData &&
        this.websiteData.website &&
        this.websiteData.website.popUpQuestions
      ) {
        this.updatePopupQuestions();
      }
    } catch (error) {}
  },

  // Set up event listeners for chat interface
  setupEventListeners: function () {
    // Setup for shadow DOM
    if (this.shadowRoot) {
      // Add keydown listener to chat input
      const chatInput = this.shadowRoot.getElementById("chat-input");
      if (chatInput) {
        chatInput.addEventListener("keydown", (e) => {
          if (e.key === "Enter" && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
          }
        });
      }

      // Add click listener to send button
      const sendBtn = this.shadowRoot.getElementById("send-message-btn");
      if (sendBtn) {
        sendBtn.addEventListener("click", () => {
          this.sendMessage();
        });
      }

      // Set up suggestion click listeners
      this.setupSuggestionListeners();
    }
  },

  // Set up listeners for suggestion clicks
  setupSuggestionListeners: function () {
    // For shadow DOM
    if (this.shadowRoot) {
      const initialSuggestions = this.shadowRoot.getElementById(
        "initial-suggestions",
      );
      if (initialSuggestions) {
        const suggestions = initialSuggestions.querySelectorAll(".suggestion");
        suggestions.forEach((suggestion, index) => {
          suggestion.addEventListener("click", () => {
            const text = suggestion.textContent.trim();
            // Send the message
            this.sendChatMessage(text);
            // Hide suggestions
            initialSuggestions.style.display = "none";
          });
        });
      } else {
      }
    }
  },

  // Set loading state
  setLoading: function (isLoading) {
    // Get loading bar element (check Shadow DOM first)
    const loadingBar = this.shadowRoot
      ? this.shadowRoot.getElementById("loading-bar")
      : document.getElementById("loading-bar");
    if (!loadingBar) return;

    if (isLoading) {
      loadingBar.style.display = "block";
      loadingBar.style.width = "100%";
    } else {
      loadingBar.style.display = "none";
      loadingBar.style.width = "0%";
    }
  },

  // Close text chat interface
  closeTextChat: function () {
    // Show the core buttons container
    const coreButtonsContainer = document.getElementById(
      "voice-toggle-container",
    );
    if (coreButtonsContainer) {
      coreButtonsContainer.style.display = "block";
    }

    // Hide chat interface in both regular DOM and shadow DOM
    const textInterface = document.getElementById("text-chat-interface");
    if (textInterface) {
      textInterface.style.display = "none";
    }

    // Hide shadow DOM interface if it exists
    const shadowHost = document.getElementById("voicero-shadow-host");
    if (shadowHost) {
      shadowHost.style.display = "none";
    }

    // Update app state
    if (VoiceroCore) {
      VoiceroCore.appState.isOpen = false;
      VoiceroCore.appState.activeInterface = null;
      VoiceroCore.saveState();

      // Reopen the chooser interface

      // Use the VoiceroCore method to show the chooser
      if (VoiceroCore.showChooser) {
        VoiceroCore.showChooser();
      } else {
        // Fallback to direct manipulation if the method isn't available
        const chooser = document.getElementById("interaction-chooser");
        if (chooser) {
          chooser.style.display = "flex";
          chooser.style.visibility = "visible";
          chooser.style.opacity = "1";
        } else if (VoiceroCore.init) {
          // If chooser doesn't exist yet, initialize it
          VoiceroCore.init();
        }
      }
    }

    // Stop visibility guard
    if (this.visibilityGuardInterval) {
      clearInterval(this.visibilityGuardInterval);
    }
  },

  // Completely revamp the minimizeChat function to ensure the maximize button is visible
  minimizeChat: function () {
    const messagesContainer = this.shadowRoot
      ? this.shadowRoot.getElementById("chat-messages")
      : document.getElementById("chat-messages");
    const chatInterface = document.getElementById("voicero-shadow-host");

    if (!messagesContainer || !chatInterface) {
      return;
    }

    // Hide messages container with animation
    messagesContainer.style.maxHeight = "0";
    messagesContainer.style.opacity = "0";
    messagesContainer.style.padding = "0";
    messagesContainer.style.overflow = "hidden";

    // Update interface container style
    chatInterface.style.borderRadius = "12px";

    // FIRST REMOVE ANY EXISTING MAXIMIZE BUTTONS
    const existingMaximizeBtn = document.getElementById(
      "voicero-maximize-fixed",
    );
    if (existingMaximizeBtn) {
      existingMaximizeBtn.remove();
    }

    // CREATE A NEW MAXIMIZE BUTTON DIRECTLY IN THE BODY
    const newMaxBtn = document.createElement("button");
    newMaxBtn.id = "voicero-maximize-fixed";
    newMaxBtn.innerHTML = `
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#882be6" stroke-width="2" stroke-linecap="round">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2"></rect>
        <path d="M3 9h18"></path>
        <path d="M9 21V9"></path>
      </svg>
    `;

    // Style the button for maximum visibility
    newMaxBtn.style.cssText = `
      position: fixed;
      bottom: 95px;
      left: 50%;
      right: auto;
      transform: translateX(-50%);
      width: 42px;
      height: 42px;
      background: white;
      border: none;
      border-radius: 50%;
      display: flex;
      align-items: center;
      justify-content: center;
      cursor: pointer;
      box-shadow: 0 4px 10px rgba(0, 0, 0, 0.2);
      z-index: 2147483647;
      transition: all 0.2s ease;
    `;

    // Update hover effect for centered button
    newMaxBtn.onmouseover = function () {
      this.style.transform = "translateX(-50%) scale(1.1)";
    };

    newMaxBtn.onmouseout = function () {
      this.style.transform = "translateX(-50%)";
    };

    // Add click event
    newMaxBtn.onclick = () => {
      this.maximizeChat();
      newMaxBtn.remove(); // Remove button after maximizing
    };

    // Add to document body
    document.body.appendChild(newMaxBtn);

    // Update state
    if (VoiceroCore) {
      VoiceroCore.appState.isTextMinimized = true;
      VoiceroCore.saveState();
    }
  },

  // Update the maximizeChat function to handle the new button
  maximizeChat: function () {
    // Remove any standalone maximize button
    const standaloneMaxBtn = document.getElementById("voicero-maximize-fixed");
    if (standaloneMaxBtn) {
      standaloneMaxBtn.remove();
    }

    const messagesContainer = this.shadowRoot
      ? this.shadowRoot.getElementById("chat-messages")
      : document.getElementById("chat-messages");
    const chatInterface = document.getElementById("voicero-shadow-host");

    if (!messagesContainer) {
      return;
    }

    // Make sure the shadow host is fully visible first
    if (chatInterface) {
      chatInterface.style.display = "block";
      chatInterface.style.opacity = "1";
      chatInterface.style.visibility = "visible";
    }

    // Restore messages container with animation
    messagesContainer.style.maxHeight = "40vh";
    messagesContainer.style.opacity = "1";
    messagesContainer.style.padding = "15px";
    messagesContainer.style.paddingTop = "35px";
    messagesContainer.style.overflow = "auto";
    messagesContainer.style.height = "auto";
    messagesContainer.style.visibility = "visible";

    // Update container style
    if (chatInterface) {
      chatInterface.style.borderRadius = "12px 12px 0 0";
    }

    // Add a small delay to ensure styles are applied
    setTimeout(() => {
      // Force a reflow to ensure styles are applied
      if (messagesContainer) {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }
    }, 100);

    // Update state
    if (VoiceroCore) {
      VoiceroCore.appState.isTextMinimized = false;
      VoiceroCore.saveState();
    }
  },

  // Helper function to adjust container padding
  adjustContainerPadding: function (hasSuggestions) {
    // Get messages container (check Shadow DOM first)
    const messagesContainer = this.shadowRoot
      ? this.shadowRoot.getElementById("chat-messages")
      : document.getElementById("chat-messages");
    if (!messagesContainer) return;

    if (hasSuggestions) {
      // Set padding for when suggestions are visible
      messagesContainer.style.paddingTop = "35px";
    } else {
      // Reduce padding when suggestions are hidden
      messagesContainer.style.paddingTop = "15px";
    }
  },

  // Add message to the chat
  addMessage: function (
    content,
    role,
    formatMarkdown = false,
    keepSuggestions = false,
    saveToHistory = true,
  ) {
    // Get messages container (check Shadow DOM first)
    const messagesContainer = this.shadowRoot
      ? this.shadowRoot.getElementById("chat-messages")
      : document.getElementById("chat-messages");
    if (!messagesContainer) {
      return;
    }

    // Hide initial suggestions only if this is a user message or if we're not keeping suggestions
    if (role === "user" || !keepSuggestions) {
      const initialSuggestions = messagesContainer.querySelector(
        "#initial-suggestions",
      );
      if (initialSuggestions) {
        // Only hide suggestions for user messages (not for AI welcome)
        if (role === "user") {
          initialSuggestions.style.display = "none";
          initialSuggestions.style.opacity = "0";
          initialSuggestions.style.height = "0";
          initialSuggestions.style.margin = "0";
          initialSuggestions.style.padding = "0";
          initialSuggestions.style.overflow = "hidden";
          // Adjust container padding & height after hiding suggestions
          messagesContainer.style.paddingTop = "15px";
          messagesContainer.style.minHeight = "150px";
          // Mark that we've shown a user message to prevent suggestions from reappearing
          if (VoiceroCore && VoiceroCore.appState) {
            VoiceroCore.appState.hasUserMessage = true;
            VoiceroCore.saveState();
          }
        } else if (!keepSuggestions) {
          initialSuggestions.style.display = "none";
          initialSuggestions.style.opacity = "0";
          initialSuggestions.style.height = "0";
          initialSuggestions.style.margin = "0";
          initialSuggestions.style.padding = "0";
          initialSuggestions.style.overflow = "hidden";
          // Adjust container padding & height after hiding suggestions
          messagesContainer.style.paddingTop = "15px";
          messagesContainer.style.minHeight = "150px";
        }
      }
    }

    // Create message element
    const messageEl = document.createElement("div");
    messageEl.className = role === "user" ? "user-message" : "ai-message";
    messageEl.style.cssText = `
      margin-bottom: 15px;
      animation: fadeIn 0.3s ease forwards;
    `;

    // Create message content
    const messageContent = document.createElement("div");
    messageContent.className = "message-content";

    // Format content if needed
    if (formatMarkdown && role === "ai" && VoiceroCore) {
      messageContent.innerHTML = VoiceroCore.formatMarkdown(content);
    } else {
      messageContent.textContent = content;
    }

    // Add message content to message
    messageEl.appendChild(messageContent);

    // Add message to container
    messagesContainer.appendChild(messageEl);

    // Save this message to conversation history if not a placeholder
    if (
      saveToHistory &&
      content !== "Generating response..." &&
      !content.includes("Thinking...") &&
      content !== "..."
    ) {
      this.saveMessageToHistory(content, role);
    }

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    return messageEl;
  },

  // Save message to conversation history
  saveMessageToHistory: function (content, role) {
    // Get existing history or initialize new array
    let messageHistory = JSON.parse(
      localStorage.getItem("voicero_text_message_history") || "[]",
    );

    // Add the new message
    messageHistory.push({
      content: content,
      role: role,
      timestamp: new Date().toISOString(),
    });

    // Store back in localStorage
    localStorage.setItem(
      "voicero_text_message_history",
      JSON.stringify(messageHistory),
    );

    // Also update the VoiceroCore state if available
    if (VoiceroCore && VoiceroCore.appState) {
      VoiceroCore.appState.textMessageHistory = messageHistory;
      VoiceroCore.saveState();
    }
  },

  // Load conversation history from localStorage
  loadMessageHistory: function () {
    try {
      const messageHistory = JSON.parse(
        localStorage.getItem("voicero_text_message_history") || "[]",
      );
      return messageHistory;
    } catch (e) {
      return [];
    }
  },

  // Display all messages from history
  displayMessageHistory: function () {
    // Get messages container (check Shadow DOM first)
    const messagesContainer = this.shadowRoot
      ? this.shadowRoot.getElementById("chat-messages")
      : document.getElementById("chat-messages");
    if (!messagesContainer) return;

    // Get initial suggestions if they exist
    const initialSuggestions = messagesContainer.querySelector(
      "#initial-suggestions",
    );

    // Remove existing message elements but keep control buttons and suggestions
    const existingMessages = messagesContainer.querySelectorAll(
      ".user-message, .ai-message",
    );
    existingMessages.forEach((el) => el.remove());

    // Get message history
    const messageHistory = this.loadMessageHistory();

    // Skip displaying if empty
    if (!messageHistory || messageHistory.length === 0) {
      // Make sure suggestions are visible if no messages
      if (initialSuggestions) {
        initialSuggestions.style.display = "block";
        initialSuggestions.style.opacity = "1";
      }
      return;
    }

    // Hide initial suggestions if we have messages
    if (initialSuggestions) {
      initialSuggestions.style.display = "none";
      initialSuggestions.style.opacity = "0";
      initialSuggestions.style.height = "0";
      initialSuggestions.style.margin = "0";
      initialSuggestions.style.padding = "0";
      initialSuggestions.style.overflow = "hidden";
    }

    // Filter out duplicate welcome messages
    const filteredHistory = [];
    const seen = new Set();
    const welcomeMessage = "Hi there! How can I help you with this store?";
    let hasAddedWelcome = false;

    messageHistory.forEach((msg) => {
      // For welcome messages, only add the first one
      if (msg.content === welcomeMessage && msg.role === "ai") {
        if (!hasAddedWelcome) {
          filteredHistory.push(msg);
          hasAddedWelcome = true;
        }
      } else {
        // For other messages, only add if we haven't seen this exact content+role
        const key = `${msg.role}:${msg.content}`;
        if (!seen.has(key)) {
          filteredHistory.push(msg);
          seen.add(key);
        }
      }
    });

    // Add each message to the interface without saving to history again
    filteredHistory.forEach((msg) => {
      // Create message element
      const messageEl = document.createElement("div");
      messageEl.className = msg.role === "user" ? "user-message" : "ai-message";
      messageEl.style.cssText = `
        margin-bottom: 15px;
        animation: fadeIn 0.3s ease forwards;
      `;
      // Create message content
      const messageContent = document.createElement("div");
      messageContent.className = "message-content";

      // Format content if needed for AI messages
      if (msg.role === "ai" && VoiceroCore) {
        messageContent.innerHTML = VoiceroCore.formatMarkdown(msg.content);
      } else {
        messageContent.textContent = msg.content;
      }
      // Add to DOM
      messageEl.appendChild(messageContent);
      messagesContainer.appendChild(messageEl);
    });

    // Update VoiceroCore state
    if (VoiceroCore && VoiceroCore.appState) {
      VoiceroCore.appState.hasUserMessage = true;
      // Update the saved message history to remove duplicates
      if (filteredHistory.length !== messageHistory.length) {
        localStorage.setItem(
          "voicero_text_message_history",
          JSON.stringify(filteredHistory),
        );
        VoiceroCore.appState.textMessageHistory = filteredHistory;
      }
      VoiceroCore.saveState();
    }

    // Scroll to the bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  },

  // Add typing indicator
  addTypingIndicator: function () {
    // Get messages container (check Shadow DOM first)
    const messagesContainer = this.shadowRoot
      ? this.shadowRoot.getElementById("chat-messages")
      : document.getElementById("chat-messages");
    if (!messagesContainer) {
      return;
    }

    // Create typing indicator
    const indicator = document.createElement("div");
    indicator.className = "typing-indicator";
    indicator.id = "typing-indicator";
    indicator.style.cssText = `
      display: flex;
      gap: 4px;
      padding: 8px 12px;
      background: #f0f0f0;
      border-radius: 12px;
      width: fit-content;
      opacity: 1;
      margin-bottom: 15px;
    `;

    // Add dots
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("div");
      dot.className = "typing-dot";
      dot.style.cssText = `
        width: 8px;
        height: 8px;
        background: #666;
        border-radius: 50%;
        animation: typingAnimation 1s infinite;
      `;
      if (i === 1) dot.style.animationDelay = "0.2s";
      if (i === 2) dot.style.animationDelay = "0.4s";
      indicator.appendChild(dot);
    }

    // Add to container
    messagesContainer.appendChild(indicator);
    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  },

  // Remove typing indicator
  removeTypingIndicator: function () {
    // First check in Shadow DOM
    if (this.shadowRoot) {
      const indicator = this.shadowRoot.getElementById("typing-indicator");
      if (indicator) {
        indicator.remove();
        return;
      }
    }
    // Then check in main document
    const indicator = document.getElementById("typing-indicator");
    if (indicator) {
      indicator.remove();
    }
  },

  // Restore messages from state
  restoreMessages: function () {
    if (!VoiceroCore || !VoiceroCore.appState || !VoiceroCore.appState.messages)
      return;

    // Get messages container (check Shadow DOM first)
    const messagesContainer = this.shadowRoot
      ? this.shadowRoot.getElementById("chat-messages")
      : document.getElementById("chat-messages");
    if (!messagesContainer) {
      return;
    }

    // Check if we have any messages to restore
    if (VoiceroCore.appState.messages.length === 0) {
      const initialSuggestions = messagesContainer.querySelector(
        "#initial-suggestions",
      );
      if (initialSuggestions) {
        initialSuggestions.style.display = "block";
        initialSuggestions.style.opacity = "1";
      }
      return;
    }

    // Clear existing messages
    const initialSuggestions = messagesContainer.querySelector(
      "#initial-suggestions",
    );
    if (initialSuggestions) {
      // Save initial suggestions
      const savedSuggestions = initialSuggestions.cloneNode(true);
      // Clear messages
      messagesContainer.innerHTML = "";
      // Add back the initial suggestions
      messagesContainer.appendChild(savedSuggestions);
      // But keep them hidden if we've had user messages before
      if (VoiceroCore.appState.hasUserMessage) {
        savedSuggestions.style.display = "none";
        savedSuggestions.style.opacity = "0";
      }
    } else {
      // Just clear messages
      messagesContainer.innerHTML = "";
    }

    // Add messages from state
    let hasUserMessages = false;
    VoiceroCore.appState.messages.forEach((message) => {
      // Map old format to new format if needed
      const content = message.content || message.text;
      const role = message.role || message.sender;
      if (content && role) {
        this.addMessage(content, role);
        if (role === "user") {
          hasUserMessages = true;
        }
      }
    });

    // Update the flag based on whether we found user messages
    if (hasUserMessages) {
      VoiceroCore.appState.hasUserMessage = true;
      // Make sure suggestions stay hidden
      const initialSuggestions = messagesContainer.querySelector(
        "#initial-suggestions",
      );
      if (initialSuggestions) {
        initialSuggestions.style.display = "none";
        initialSuggestions.style.opacity = "0";
      }
    } else if (!VoiceroCore.appState.hasUserMessage) {
      // If no user messages were added and we haven't marked hasUserMessage, make sure suggestions are visible
      const initialSuggestions = messagesContainer.querySelector(
        "#initial-suggestions",
      );
      if (initialSuggestions) {
        initialSuggestions.style.display = "block";
        initialSuggestions.style.opacity = "1";
      }
    }

    // Save updated state
    VoiceroCore.saveState();
  },

  // Extract URLs from text and clean the text
  extractAndCleanUrls: function (text) {
    // Store extracted URLs
    const extractedUrls = [];

    // Format currency for better readability
    text = this.formatCurrencyForSpeech(text);

    // First handle markdown-style links [text](url)
    const markdownRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let markdownMatch;
    let cleanedText = text;

    // Extract markdown URLs and replace them with just the text part
    while ((markdownMatch = markdownRegex.exec(text)) !== null) {
      const linkText = markdownMatch[1];
      let url = markdownMatch[2];
      // Remove trailing punctuation that might have been included
      url = url.replace(/[.,;:!?)]+$/, "");
      // Add the URL to our collection
      if (url && url.trim() !== "") {
        try {
          // Ensure URL has proper protocol
          const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
          // Test if it's a valid URL before adding
          new URL(formattedUrl);
          extractedUrls.push(formattedUrl);
        } catch (e) {}
      }
      // Replace the markdown link with just the text
      cleanedText = cleanedText.replace(markdownMatch[0], linkText);
    }

    // Now handle regular URLs
    const urlRegex =
      /(https?:\/\/[^\s]+)|(www\.[^\s]+)|([^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi;
    let match;
    // Find all regular URLs in the text
    const textWithoutMarkdown = cleanedText;
    while ((match = urlRegex.exec(textWithoutMarkdown)) !== null) {
      let url = match[0];
      // Remove trailing punctuation that might have been included
      url = url.replace(/[.,;:!?)]+$/, "");
      try {
        // Ensure URL has proper protocol
        const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
        // Test if it's a valid URL before adding
        new URL(formattedUrl);
        // Only add if it's not already in the list
        if (!extractedUrls.includes(formattedUrl)) {
          extractedUrls.push(formattedUrl);
        }
      } catch (e) {}
    }

    // Replace URL patterns with natural language alternatives
    cleanedText = cleanedText.replace(
      /check out (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
      "check it out",
    );
    cleanedText = cleanedText.replace(
      /at (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
      "here",
    );
    cleanedText = cleanedText.replace(
      /here: (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
      "here",
    );
    cleanedText = cleanedText.replace(
      /at this link: (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
      "here",
    );
    cleanedText = cleanedText.replace(
      /visit (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
      "visit this page",
    );

    // Replace any remaining URLs with "this link"
    cleanedText = cleanedText.replace(urlRegex, "this link");

    // Remove any double spaces that might have been created
    cleanedText = cleanedText.replace(/\s\s+/g, " ").trim();

    return {
      text: cleanedText,
      urls: extractedUrls,
    };
  },

  // Handle redirection to extracted URLs
  redirectToUrl: function (url) {
    if (!url) return;
    // Make sure the URL is properly formed
    try {
      // Test if the URL is valid
      new URL(url);

      // Before redirecting, save state that we were in text chat mode
      if (VoiceroCore) {
        // Save that we should reactivate text chat on next page load
        localStorage.setItem("voicero_reactivate_text", "true");
        // Make sure VoiceroCore state is also set correctly
        if (VoiceroCore.appState) {
          // Ensure we've properly marked that a user message was sent
          VoiceroCore.appState.hasUserMessage = true;
          // Update state to reactivate properly
          VoiceroCore.appState.isOpen = true;
          VoiceroCore.appState.activeInterface = "text";
          VoiceroCore.appState.isTextMinimized = false;
          // Explicitly save the state to ensure message history is preserved
          VoiceroCore.saveState();
        }
      }
      // Navigate in the same tab instead of opening a new one
      window.location.href = url;
    } catch (error) {
      // Add a fallback notification if URL is invalid
      if (this.shadowRoot) {
        const aiMessageDiv = this.shadowRoot.querySelector(".ai-message");
        if (aiMessageDiv && aiMessageDiv.querySelector(".message-content")) {
          const messageContent = aiMessageDiv.querySelector(".message-content");
          // Create notification
          const notificationElement = document.createElement("div");
          notificationElement.style.cssText = `
            margin-top: 10px;
            padding: 8px 12px;
            background: #fff0f0;
            border-radius: 8px;
            font-size: 14px;
            color: #d43b3b;
            text-align: center;
          `;
          notificationElement.textContent =
            "I couldn't open the link mentioned. There might be an issue with the URL.";
          // Append to message
          messageContent.appendChild(notificationElement);
          // Scroll to bottom to ensure notification is visible
          const messagesContainer =
            this.shadowRoot.getElementById("chat-messages");
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }
      } else {
        // Fallback to regular document if shadow DOM not available
        const aiMessageDiv = document.querySelector(
          "#text-chat-interface .ai-message",
        );
        if (aiMessageDiv && aiMessageDiv.querySelector(".message-content")) {
          const messageContent = aiMessageDiv.querySelector(".message-content");
          // Create notification
          const notificationElement = document.createElement("div");
          notificationElement.style.cssText = `
            margin-top: 10px;
            padding: 8px 12px;
            background: #fff0f0;
            border-radius: 8px;
            font-size: 14px;
            color: #d43b3b;
            text-align: center;
          `;
          notificationElement.textContent =
            "I couldn't open the link mentioned. There might be an issue with the URL.";
          // Append to message
          messageContent.appendChild(notificationElement);
          // Scroll to bottom to ensure notification is visible
          const messagesContainer = document.getElementById("chat-messages");
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }
      }
    }
  },

  // Format currency values for better readability in text
  formatCurrencyForSpeech: function (text) {
    // Replace currency patterns like $X.XX with "X dollars and XX cents"
    return text.replace(/\$(\d+)\.(\d{2})/g, function (match, dollars, cents) {
      if (cents === "00") {
        return `${dollars} dollars`;
      } else if (dollars === "1") {
        return `1 dollar and ${cents} cents`;
      } else {
        return `${dollars} dollars and ${cents} cents`;
      }
    });
  },

  // Send a message to the backend API
  sendMessage: async function () {
    // Get chat input element (check Shadow DOM first)
    const chatInput = this.shadowRoot
      ? this.shadowRoot.getElementById("chat-input")
      : document.getElementById("chat-input");
    // Exit if chat input not found
    if (!chatInput) {
      return;
    }
    // Get message from input
    const message = chatInput.value.trim();
    // Exit if message is empty
    if (!message) {
      return;
    }

    // If the chat is minimized, maximize it first
    if (VoiceroCore && VoiceroCore.appState.isTextMinimized) {
      this.maximizeChat();
    }

    // Clear input
    chatInput.value = "";

    // Add user message to chat
    this.addMessage(message, "user");

    // Show loading state
    this.setLoading(true);

    // Hide any initial suggestions
    const initialSuggestions = this.shadowRoot
      ? this.shadowRoot.getElementById("initial-suggestions")
      : document.getElementById("initial-suggestions");
    if (initialSuggestions) {
      initialSuggestions.style.display = "none";
    }

    try {
      // Add typing indicator
      this.addTypingIndicator();

      // Prepare request data
      const requestData = {
        message,
        url: window.location.href,
        threadId: VoiceroCore ? VoiceroCore.currentThreadId || "" : "",
        type: "text",
        source: "voicero",
      };

      // Get API URL - Now use the shopify/chat endpoint
      const apiUrl = VoiceroCore
        ? `${VoiceroCore.getApiBaseUrl()}/api/shopify/chat`
        : "https://www.voicero.ai/api/shopify/chat";

      // Send request to API
      const response = await fetch(apiUrl, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${window.voiceroConfig.accessKey}`,
        },
        body: JSON.stringify(requestData),
      });

      // Check if response is ok
      if (!response.ok) {
        throw new Error(`API request failed: ${response.status}`);
      }

      // Parse response
      const data = await response.json();

      // Remove typing indicator
      this.removeTypingIndicator();

      // Get the text response from the appropriate field
      const aiTextResponse =
        data.response || data.message || "Sorry, I don't have a response.";

      // Process text to extract and clean URLs
      const processedResponse = this.extractAndCleanUrls(aiTextResponse);
      const cleanedTextResponse = processedResponse.text;
      const extractedUrls = processedResponse.urls;

      // Add AI message to chat with the cleaned text
      this.addMessage(cleanedTextResponse, "ai", true);

      // Store thread ID
      if (data.threadId && VoiceroCore) {
        VoiceroCore.currentThreadId = data.threadId;
      }

      // Store in app state if core is available
      if (VoiceroCore) {
        VoiceroCore.appState.messages.push({
          role: "user",
          content: message,
        });
        VoiceroCore.appState.messages.push({
          role: "assistant",
          content: cleanedTextResponse, // Store cleaned response
        });
        VoiceroCore.saveState();
      }

      // After a short delay, redirect to the first URL if one exists
      if (extractedUrls.length > 0) {
        setTimeout(() => {
          this.redirectToUrl(extractedUrls[0]);
        }, 1500);
      }
    } catch (error) {
      // Remove typing indicator
      this.removeTypingIndicator();
      // Add error message
      this.addMessage(
        "Sorry, I encountered an error. Please try again later.",
        "ai",
      );
    } finally {
      // End loading state
      this.setLoading(false);
    }
  },

  // Start a visibility guard to ensure the interface stays visible
  startVisibilityGuard: function () {
    // Clear any existing guard interval
    if (this.visibilityGuardInterval) {
      clearInterval(this.visibilityGuardInterval);
    }
    // Set up interval to periodically check visibility
    this.visibilityGuardInterval = setInterval(() => {
      this.ensureChatVisibility();
    }, 2000); // Check every 2 seconds

    // Also check once right away
    setTimeout(() => {
      this.ensureChatVisibility();
    }, 300);

    // Make sure the interval is cleared when the page is unloaded
    window.addEventListener("beforeunload", () => {
      if (this.visibilityGuardInterval) {
        clearInterval(this.visibilityGuardInterval);
      }
    });
  },

  // Function to ensure the chat interface stays visible
  ensureChatVisibility: function () {
    const shadowHost = document.getElementById("voicero-shadow-host");
    if (!shadowHost) {
      return;
    }
    // Check if shadow host is visible
    const style = window.getComputedStyle(shadowHost);
    const isHidden =
      style.display === "none" || parseFloat(style.opacity) < 0.1;

    if (isHidden) {
      shadowHost.style.display = "block";
      shadowHost.style.opacity = "1";
    }

    // In our new approach, we need to ensure that:
    // 1. Input wrapper is always visible
    // 2. Messages container is visible only if not minimized

    if (this.shadowRoot) {
      const inputWrapper = this.shadowRoot.getElementById("chat-input-wrapper");
      if (inputWrapper) {
        const inputStyle = window.getComputedStyle(inputWrapper);
        if (
          inputStyle.display === "none" ||
          parseFloat(inputStyle.opacity) < 0.1
        ) {
          inputWrapper.style.display = "block";
          inputWrapper.style.opacity = "1";
          if (VoiceroCore && VoiceroCore.appState.isTextMinimized) {
            inputWrapper.style.borderRadius = "12px";
            inputWrapper.style.marginTop = "10px";
          }
        }
      }
      // Only check messages container if not minimized
      if (VoiceroCore && !VoiceroCore.appState.isTextMinimized) {
        const messagesContainer =
          this.shadowRoot.getElementById("chat-messages");
        if (messagesContainer) {
          const messageStyle = window.getComputedStyle(messagesContainer);
          if (
            messageStyle.display === "none" ||
            parseFloat(messageStyle.opacity) < 0.1
          ) {
            messagesContainer.style.display = "block";
            messagesContainer.style.opacity = "1";
          }
          // Only check if initial suggestions should be visible if no user messages
          const hasUserMessage =
            VoiceroCore &&
            VoiceroCore.appState &&
            VoiceroCore.appState.hasUserMessage;
          const userMessages =
            messagesContainer.querySelectorAll(".user-message");
          if (userMessages.length === 0 && !hasUserMessage) {
            const initialSuggestions = messagesContainer.querySelector(
              "#initial-suggestions",
            );
            if (initialSuggestions) {
              if (
                initialSuggestions.style.display === "none" ||
                parseFloat(
                  window.getComputedStyle(initialSuggestions).opacity,
                ) < 0.1
              ) {
                initialSuggestions.style.display = "block";
                initialSuggestions.style.opacity = "1";
              }
            }
          }
        }
      }
    }

    // Also ensure the maximize button is shown if chat is minimized
    if (VoiceroCore && VoiceroCore.appState.isTextMinimized) {
      const maximizeButton = this.shadowRoot
        ? this.shadowRoot.getElementById("maximize-chat")
        : document.getElementById("maximize-chat");

      if (maximizeButton) {
        const btnStyle = window.getComputedStyle(maximizeButton);
        if (
          btnStyle.display === "none" ||
          btnStyle.opacity === "0" ||
          parseFloat(btnStyle.opacity) < 0.5
        ) {
          maximizeButton.style.position = "absolute";
          maximizeButton.style.display = "flex";
          maximizeButton.style.opacity = "1";
          maximizeButton.style.bottom = "60px";
          maximizeButton.style.right = "20px";
          maximizeButton.style.width = "32px";
          maximizeButton.style.height = "32px";
          maximizeButton.style.background = "white";
          maximizeButton.style.boxShadow = "0 2px 8px rgba(0, 0, 0, 0.15)";
          maximizeButton.style.zIndex = "2147483647";
          maximizeButton.style.cursor = "pointer";
          maximizeButton.style.top = "auto"; // Clear any top property
          maximizeButton.style.transform = "none"; // Remove any transforms
        }
      } else {
        // If button doesn't exist, we could create it here
      }
    }
  },

  // Create an isolated iframe to host the chat interface
  createIsolatedChatFrame: function () {
    // First check if shadow host already exists
    let shadowHost = document.getElementById("voicero-shadow-host");
    if (shadowHost) {
    } else {
      // Create shadow DOM host element
      shadowHost = document.createElement("div");
      shadowHost.id = "voicero-shadow-host";
      shadowHost.style.cssText = `
        position: fixed;
        bottom: 30px;
        left: 50%;
        transform: translateX(-50%);
        width: 80%;
        max-width: 960px;
        min-width: 280px;
        z-index: 2147483646; /* Maximum possible z-index value - 1 */
        border-radius: 12px;
        box-shadow: 0 10px 25px rgba(0, 0, 0, 0.1);
        overflow: hidden;
      `;
      document.body.appendChild(shadowHost);
    }

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
          50% { background-position: 100% 50%; }
          100% { background-position: 0% 50%; }
        }

        .typing-indicator {
          display: flex !important;
          gap: 4px;
          padding: 8px 12px;
          background: #f0f0f0;
          border-radius: 12px;
          width: fit-content;
          opacity: 1 !important;
          margin-bottom: 0;
        }

        .typing-dot {
          width: 8px;
          height: 8px;
          background: #666;
          border-radius: 50%;
          animation: typingAnimation 1s infinite;
          opacity: 1;
        }

        .typing-dot:nth-child(2) { animation-delay: 0.2s; }
        .typing-dot:nth-child(3) { animation-delay: 0.4s; }

        @keyframes typingAnimation {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-8px); }
        }

        .user-message {
          display: flex;
          justify-content: flex-end;
        }

        .user-message .message-content {
          background: #882be6;
          color: white;
          border-radius: 12px 12px 0 12px;
          padding: 10px 14px;
          max-width: 65%;
          word-wrap: break-word;
          font-size: 14px;
          line-height: 1.4;
        }

        .ai-message {
          display: flex;
          justify-content: flex-start;
        }

        .ai-message .message-content {
          background: #f0f0f0;
          color: #333;
          border-radius: 12px 12px 12px 0;
          padding: 10px 14px;
          max-width: 65%;
          word-wrap: break-word;
          font-size: 14px;
          line-height: 1.4;
        }

        .chat-link {
          color: #882be6;
          text-decoration: none;
          font-weight: 500;
          position: relative;
          transition: all 0.2s ease;
        }

        .chat-link:hover {
          text-decoration: underline;
          opacity: 0.9;
        }
      </style>

      <div id="chat-messages" style="
        background: white;
        border-radius: 12px 12px 0 0;
        padding: 15px;
        padding-top: 45px; /* Increased to make room for sticky header */
        margin-bottom: 0;
        max-height: 40vh;
        overflow-y: auto;
        box-shadow: 0 4px 20px rgba(0, 0, 0, 0.1);
        position: relative;
        transition: all 0.3s ease;
      ">
        <div id="chat-controls-header" style="
          position: sticky;
          top: 0;
          left: 0;
          right: 0;
          height: 36px;
          background: white;
          z-index: 10;
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 5px 10px;
          border-bottom: 1px solid #f0f0f0;
          border-radius: 12px 12px 0 0;
          margin-bottom: 10px;
        ">
          <button
            id="close-chat"
            onclick="VoiceroText.closeTextChat()"
            style="
              position: absolute;
              top: 10px;
              right: 40px;
              background: none;
              border: none;
              cursor: pointer;
              padding: 5px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s ease;
              z-index: 1001;
            "
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
              <path d="M18 6L6 18M6 6l12 12"/>
            </svg>
          </button>
          <button
            id="minimize-chat"
            onclick="VoiceroText.minimizeChat()"
            style="
              position: absolute;
              top: 10px;
              right: 10px;
              background: none;
              border: none;
              cursor: pointer;
              padding: 5px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s ease;
              z-index: 1001;
            "
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
              <path d="M8 3h8m-8 18h8M4 8v8m16-8v8"/>
            </svg>
          </button>
          <button
            id="maximize-chat"
            onclick="VoiceroText.maximizeChat()"
            style="
              position: fixed;
              top: 0;
              right: 10px;
              background: white;
              border: none;
              cursor: pointer;
              padding: 8px;
              border-radius: 50%;
              display: none;
              align-items: center;
              justify-content: center;
              transition: all 0.2s ease;
              z-index: 2147483647;
              width: 32px;
              height: 32px;
              box-shadow: 0 2px 5px rgba(0, 0, 0, 0.1);
              transform: translateY(-45px);
            "
          >
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
              <path d="M8 3v18m8-18v18M4 8h16m-16 8h16"/>
            </svg>
          </button>
          <button
            id="clear-text-chat"
            onclick="VoiceroText.clearChatHistory()"
            style="
              position: relative;
              top: auto;
              left: auto;
              background: none;
              border: none;
              cursor: pointer;
              padding: 5px;
              border-radius: 50%;
              display: flex;
              align-items: center;
              justify-content: center;
              transition: all 0.2s ease;
              z-index: 1001;
              background-color: #f0f0f0;
              font-size: 12px;
              color: #666;
              box-shadow: 0 1px 3px rgba(0, 0, 0, 0.1);
            "
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" style="margin-right: 4px;">
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
            <span>Clear</span>
          </button>
        </div>
        <div id="loading-bar" style="
          position: absolute;
          top: 0;
          left: 0;
          height: 3px;
          width: 0%;
          background: linear-gradient(90deg, #882be6, #ff4444, #882be6);
          background-size: 200% 100%;
          border-radius: 3px;
          display: none;
          animation: gradientMove 2s linear infinite;
        "></div>

        <!-- Add initial suggestions directly in shadow DOM -->
        <div id="initial-suggestions" style="
          padding: 10px 0;
          opacity: 1;
          transition: all 0.3s ease;
        ">
          <div style="
            color: #666;
            font-size: 13px;
            margin-bottom: 10px;
            text-align: center;
          ">
            Try asking one of these questions:
          </div>
          <div style="display: flex; flex-direction: column; gap: 6px;">
            <!-- Suggestions will be populated from API -->
            <div class="suggestion" style="
              background: #882be6;
              padding: 8px 14px;
              border-radius: 8px;
              cursor: pointer;
              transition: all 0.2s ease;
              color: white;
              font-weight: 500;
              text-align: left;
              font-size: 13px;
            ">Loading suggestions...</div>
          </div>
        </div>
      </div>

      <div id="chat-input-wrapper" style="
        position: relative;
        padding: 2px;
        background: linear-gradient(90deg, #882be6, #ff4444, #882be6);
        background-size: 200% 100%;
        border-radius: 0 0 12px 12px;
        animation: gradientBorder 3s linear infinite;
      ">
        <div style="
          display: flex;
          align-items: center;
          background: white;
          border-radius: 0 0 12px 12px;
          padding: 5px;
        ">
          <input
            type="text"
            id="chat-input"
            placeholder="Ask me anything..."
            style="
              flex: 1;
              border: none;
              padding: 12px 20px;
              font-size: 16px;
              outline: none;
              background: transparent;
              border-radius: 50px;
            "
          >
          <button id="send-message-btn" style="
            background: #882be6;
            border: none;
            width: 40px;
            height: 40px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            margin-right: 5px;
            transition: all 0.3s ease;
          ">
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
              <path d="M22 2L11 13M22 2l-7 20-4-9-9-4 20-7z"></path>
            </svg>
          </button>
        </div>
      </div>
    `;
    const initialSuggestions = this.shadowRoot.getElementById(
      "initial-suggestions",
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
    } else {
    }

    return this.shadowRoot;
  },

  // Clear chat history
  clearChatHistory: function () {
    // Clear localStorage message history
    localStorage.removeItem("voicero_text_message_history");

    // Also update the UI if the chat is currently open
    const messagesContainer = this.shadowRoot
      ? this.shadowRoot.getElementById("chat-messages")
      : document.getElementById("chat-messages");
    if (messagesContainer) {
      const existingMessages = messagesContainer.querySelectorAll(
        ".user-message, .ai-message",
      );
      existingMessages.forEach((el) => el.remove());
      // Reset height and padding after clearing
      messagesContainer.style.height = "auto";
      messagesContainer.style.paddingTop = "35px";

      // Show initial suggestions again
      const initialSuggestions = messagesContainer.querySelector(
        "#initial-suggestions",
      );
      if (initialSuggestions) {
        initialSuggestions.style.display = "block";
        initialSuggestions.style.opacity = "1";
        initialSuggestions.style.height = "auto";
        initialSuggestions.style.margin = "";
        initialSuggestions.style.padding = "";
        initialSuggestions.style.overflow = "visible";
      }
    }

    // Reset in VoiceroCore state if available
    if (VoiceroCore && VoiceroCore.appState) {
      VoiceroCore.appState.messages = [];
      VoiceroCore.appState.hasUserMessage = false;
      VoiceroCore.appState.textMessageHistory = []; // Reset text message history in state
      // We should also reset hasShownTextWelcome so the welcome message will show again on next open
      VoiceroCore.appState.hasShownTextWelcome = false;
      VoiceroCore.saveState();
    }
  },

  // Send chat message to API
  sendChatToApi: function (messageText, threadId) {
    if (!this.apiBaseUrl) {
      return Promise.reject("API URL not available");
    }

    // Show loading indicator
    this.setLoadingIndicator(true);

    // Get current URL to send as context
    const currentUrl = window.location.href;

    // Format the request body according to the API's expected structure
    const requestBody = {
      message: messageText,
      url: currentUrl,
      type: "text",
      source: "chat",
      context: {
        currentUrl: currentUrl,
        currentContent: document.body.innerText.substring(0, 1000), // snippet of page content
      },
    };

    // Add thread ID if available
    if (threadId) {
      requestBody.threadId = threadId;
    } else if (this.currentThreadId) {
      requestBody.threadId = this.currentThreadId;
    }

    // Add chat history if available
    if (this.messages && this.messages.length > 0) {
      requestBody.chatHistory = this.messages.map((msg) => ({
        role: msg.role,
        message: msg.content,
      }));
    }

    // Add custom instructions if available
    if (this.customInstructions) {
      requestBody.customInstructions = this.customInstructions;
    }

    return fetch(`${this.apiBaseUrl}/api/shopify/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${window.voiceroConfig.accessKey}`,
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
      background: #f0f0f0;
      border-radius: 12px;
      width: fit-content;
      margin-bottom: 10px;
    `;

    // Create typing dots
    for (let i = 0; i < 3; i++) {
      const dot = document.createElement("div");
      dot.className = "typing-dot";
      dot.style.cssText = `
        width: 8px;
        height: 8px;
        background: #666;
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

    // Function to remove typing indicator
    const removeTypingIndicator = () => {
      if (typingWrapper) {
        typingWrapper.remove();
      }
      const typingElements = document.querySelectorAll(".typing-wrapper");
      typingElements.forEach((el) => el.remove());
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

          // Extract message
          let message =
            typeof data.response === "string"
              ? data.response
              : data.response || "I'm sorry, I couldn't process that request.";

          // Extract URLs
          const urlRegex =
            /(https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi;
          const urls = message.match(urlRegex) || [];

          // If there's a product URL, do a redirect
          const productUrl = urls.find((url) => url.includes("/products/"));
          if (productUrl) {
            this.lastProductUrl = productUrl;
            // Redirect to the product page
            window.location.href = productUrl;
          }

          // Clean up URLs in the message
          message = message.replace(
            /check out (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
            "check it out",
          );
          message = message.replace(
            /at (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
            "here",
          );
          message = message.replace(
            /here: (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
            "here",
          );
          message = message.replace(
            /at this link: (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
            "here",
          );
          message = message.replace(
            /visit (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
            "visit this page",
          );
          message = message.replace(urlRegex, "this link");
          message = message.replace(/\s\s+/g, " ").trim();

          // Add AI response to chat
          this.addMessage(message, "ai");

          // Save the thread ID if provided
          if (data.threadId) {
            this.currentThreadId = data.threadId;
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
        "ai",
      );
      this.isWaitingForResponse = false;
    }
  },

  // Send message from input field
  sendMessage: function () {
    // Auto-maximize if minimized
    if (
      VoiceroCore &&
      VoiceroCore.appState &&
      VoiceroCore.appState.isTextMinimized
    ) {
      this.maximizeChat();

      // Small delay to ensure UI is updated before continuing
      setTimeout(() => {
        this.sendMessageLogic();
      }, 200);
    } else {
      // Chat is already maximized, proceed normally
      this.sendMessageLogic();
    }
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
    // Check if chat is minimized
    if (
      VoiceroCore &&
      VoiceroCore.appState &&
      VoiceroCore.appState.isTextMinimized
    ) {
      this.maximizeChat();

      // Small delay to ensure UI is updated before continuing
      setTimeout(() => {
        this.sendChatMessageLogic(text);
      }, 200);
    } else {
      // Chat is already maximized, proceed normally
      this.sendChatMessageLogic(text);
    }
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
};

// Initialize when core is ready
document.addEventListener("DOMContentLoaded", () => {
  // Check if VoiceroCore is already loaded
  if (typeof VoiceroCore !== "undefined") {
    VoiceroText.init();
  } else {
    // Wait for core to be available
    const checkCoreInterval = setInterval(() => {
      if (typeof VoiceroCore !== "undefined") {
        clearInterval(checkCoreInterval);
        VoiceroText.init();
      }
    }, 100);

    // Stop checking after 10 seconds
    setTimeout(() => {
      clearInterval(checkCoreInterval);
      // Initialize anyway to at least have the interface elements ready
      VoiceroText.init();
    }, 10000);
  }
});

// Expose global functions
window.VoiceroText = VoiceroText;
