/**
 * VoiceroAI Text Module
 * Handles text chat functionality
 */

// Text interface variables
const VoiceroText = {
  // debounce visibility toggles
  _isChatVisible: false, // tracks whether messages+header+input are up
  _lastChatToggle: 0, // timestamp of last minimize/maximize
  CHAT_TOGGLE_DEBOUNCE_MS: 500, // minimum time between toggles - increased from 200ms

  // Add session operation tracking
  isSessionOperationInProgress: false,
  lastSessionOperationTime: 0,
  sessionOperationTimeout: 3000, // maximum time a session operation can take before being considered stuck

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
    // Check if already initialized
    if (this.initialized) return;

    // Set initialized flag
    this.initialized = true;

    console.log("VoiceroText: Initializing");

    // Initialize the hasShownWelcome flag
    this.hasShownWelcome = false;

    // Set session and thread from VoiceroCore if available
    if (window.VoiceroCore) {
      this.session = window.VoiceroCore.session;
      this.thread = window.VoiceroCore.thread;
      this.sessionId = window.VoiceroCore.sessionId;
      this.websiteId = window.VoiceroCore.websiteId;

      // IMPORTANT: Always get the latest websiteColor from VoiceroCore
      this.websiteColor = window.VoiceroCore.websiteColor || "#882be6";
      console.log("VoiceroText: Using website color:", this.websiteColor);

      // Ensure the text interface is always maximized by default
      if (this.session && this.session.textOpen) {
        console.log(
          "VoiceroText: Ensuring textOpenWindowUp is true by default"
        );
        this.session.textOpenWindowUp = true;

        // Update window state if we have access to the method
        if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
          window.VoiceroCore.updateWindowState({
            textOpenWindowUp: true,
          });
        }
      }
    }

    // Get API URL and color from Core if available
    if (window.VoiceroCore) {
      if (window.VoiceroCore.getApiBaseUrl) {
        this.apiBaseUrl = VoiceroCore.getApiBaseUrl();
      }

      // Always use the VoiceroColor utility if available
      if (
        window.VoiceroColor &&
        typeof window.VoiceroColor.getColorVariants === "function"
      ) {
        this.colorVariants = window.VoiceroColor.getColorVariants(
          this.websiteColor
        );
        console.log(
          "VoiceroText: Generated color variants using VoiceroColor:",
          this.colorVariants
        );
      } else {
        // Fallback to our own implementation
        this.colorVariants = this.getColorVariants(this.websiteColor);
        console.log(
          "VoiceroText: Generated color variants using fallback:",
          this.colorVariants
        );
      }
    } else {
      // Use default color and generate variants
      this.colorVariants = this.getColorVariants(this.websiteColor);
    }

    // PRE-INITIALIZATION CHECK: Check for empty message arrays and set flags
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.threads &&
      window.VoiceroCore.session.threads.length > 0
    ) {
      // Sort threads to get the most recent one
      const threads = [...window.VoiceroCore.session.threads];
      const sortedThreads = threads.sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      const mostRecentThread = sortedThreads[0];
      console.log(
        "VoiceroText [INIT]: Checking thread on initialization:",
        mostRecentThread
      );

      // If thread has no messages or only system messages, prepare welcome message
      if (
        !mostRecentThread.messages ||
        mostRecentThread.messages.length === 0
      ) {
        console.log(
          "VoiceroText [INIT]: Thread has empty messages array, preparing welcome message"
        );
        if (window.VoiceroCore.session) {
          // Force the welcome message by setting session flag directly
          window.VoiceroCore.session.textWelcome = true;
          // Reset internal flags
          this.hasShownWelcome = false;
          localStorage.removeItem("voicero_shown_text_welcome");
          if (window.VoiceroCore && window.VoiceroCore.appState) {
            window.VoiceroCore.appState.hasShownTextWelcome = false;
          }
        }
      } else {
        // Check if there are any non-system messages
        const nonSystemMessages = mostRecentThread.messages.filter(
          (msg) => msg.role !== "system" && msg.type !== "page_data"
        );

        if (nonSystemMessages.length === 0) {
          console.log(
            "VoiceroText [INIT]: Thread has only system messages, preparing welcome message"
          );
          if (window.VoiceroCore.session) {
            // Force the welcome message by setting session flag directly
            window.VoiceroCore.session.textWelcome = true;
            // Reset internal flags
            this.hasShownWelcome = false;
            localStorage.removeItem("voicero_shown_text_welcome");
            if (window.VoiceroCore && window.VoiceroCore.appState) {
              window.VoiceroCore.appState.hasShownTextWelcome = false;
            }
          }
        }
      }
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

    // CRITICAL: Always get the latest websiteColor from VoiceroCore
    if (window.VoiceroCore && window.VoiceroCore.websiteColor) {
      this.websiteColor = window.VoiceroCore.websiteColor;
      console.log("VoiceroText: Updated website color:", this.websiteColor);
    }

    // Always regenerate color variants with the latest websiteColor
    if (
      window.VoiceroColor &&
      typeof window.VoiceroColor.getColorVariants === "function"
    ) {
      this.colorVariants = window.VoiceroColor.getColorVariants(
        this.websiteColor
      );
    } else {
      this.colorVariants = this.getColorVariants(this.websiteColor);
    }

    // Get the main color - ALWAYS USE LATEST WEBSITE COLOR
    const mainColor = this.websiteColor || "#882be6";
    console.log("VoiceroText: Applying dynamic color:", mainColor);

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

    // Add code to update CSS variables in the shadow DOM:
    // CRITICAL: Add CSS variables directly to shadow DOM
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      :host {
        --voicero-theme-color: ${mainColor} !important;
        --voicero-theme-color-light: ${this.colorVariants.light} !important;
        --voicero-theme-color-hover: ${this.colorVariants.dark} !important;
      }
      
      /* Force contact form button to use website color */
      .contact-submit-btn {
        background-color: ${mainColor} !important;
        color: white !important;
      }
      
      .contact-form-message .contact-submit-btn {
        background-color: ${mainColor} !important;
        color: white !important;
      }

      /* Force suggestion buttons to use website color */
      .suggestion {
        background-color: ${mainColor} !important;
      }

      /* Force user message bubbles to use website color */
      .user-message .message-content {
        background-color: ${mainColor} !important;
      }

      /* Force send button to use website color */
      #send-message-btn {
        background-color: ${mainColor} !important;
      }

      /* Force welcome question spans to use website color */
      .welcome-question {
        color: ${mainColor} !important;
      }
    `;

    // Remove existing custom variables if any
    const existingVars = this.shadowRoot.getElementById("voicero-css-vars");
    if (existingVars) {
      existingVars.remove();
    }

    // Add new variables
    styleEl.id = "voicero-css-vars";
    this.shadowRoot.appendChild(styleEl);

    console.log(
      `VoiceroText: Applied CSS variables to shadow DOM: ${mainColor}`
    );
  },

  // Open text chat interface
  openTextChat: function () {
    console.log(
      "VoiceroText: Opening text chat interface - ensuring it's maximized"
    );

    // IMMEDIATE CHECK: Check for empty message arrays and force welcome message if needed
    // This must happen before any other checks to ensure the welcome message shows on first load
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.threads &&
      window.VoiceroCore.session.threads.length > 0
    ) {
      // Sort threads to get the most recent one
      const threads = [...window.VoiceroCore.session.threads];
      const sortedThreads = threads.sort((a, b) => {
        if (a.lastMessageAt && b.lastMessageAt) {
          return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
        }
        return new Date(b.createdAt) - new Date(a.createdAt);
      });

      const mostRecentThread = sortedThreads[0];
      console.log("VoiceroText [INIT]: Most recent thread:", mostRecentThread);

      // If thread has no messages or only system messages, force welcome message
      if (
        !mostRecentThread.messages ||
        mostRecentThread.messages.length === 0
      ) {
        console.log(
          "VoiceroText [INIT]: Thread has empty messages array, forcing welcome message"
        );
        if (window.VoiceroCore.session) {
          window.VoiceroCore.session.textWelcome = true;
          // Reset any stored flags
          this.hasShownWelcome = false;
          localStorage.removeItem("voicero_shown_text_welcome");
          if (window.VoiceroCore && window.VoiceroCore.appState) {
            window.VoiceroCore.appState.hasShownTextWelcome = false;
          }
        }
      } else {
        // Check if there are any non-system messages
        const nonSystemMessages = mostRecentThread.messages.filter(
          (msg) => msg.role !== "system" && msg.type !== "page_data"
        );

        if (nonSystemMessages.length === 0) {
          console.log(
            "VoiceroText [INIT]: Thread has only system messages, forcing welcome message"
          );
          if (window.VoiceroCore.session) {
            window.VoiceroCore.session.textWelcome = true;
            // Reset any stored flags
            this.hasShownWelcome = false;
            localStorage.removeItem("voicero_shown_text_welcome");
            if (window.VoiceroCore && window.VoiceroCore.appState) {
              window.VoiceroCore.appState.hasShownTextWelcome = false;
            }
          }
        }
      }
    }

    // CRITICAL: Ensure we have the latest website color from VoiceroCore
    if (window.VoiceroCore && window.VoiceroCore.websiteColor) {
      this.websiteColor = window.VoiceroCore.websiteColor;
      console.log(
        "VoiceroText: Updated website color on open:",
        this.websiteColor
      );

      // Regenerate color variants
      if (
        window.VoiceroColor &&
        typeof window.VoiceroColor.getColorVariants === "function"
      ) {
        this.colorVariants = window.VoiceroColor.getColorVariants(
          this.websiteColor
        );
      } else {
        this.colorVariants = this.getColorVariants(this.websiteColor);
      }
    }

    // IMPORTANT: Always ensure textOpenWindowUp is true when opening the interface
    // It should only be set to false when the user explicitly clicks the minimize button
    if (window.VoiceroCore && window.VoiceroCore.session) {
      window.VoiceroCore.session.textOpenWindowUp = true;
    }

    // Check if thread has messages
    const hasMessages = this.messages && this.messages.length > 0;

    // Determine if we should show welcome message
    let shouldShowWelcome = false;

    console.log("VoiceroText: Checking if welcome message should be shown");

    // Check if the session already has a textWelcome flag set
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.textWelcome !== undefined
    ) {
      // Use the existing value from the session
      shouldShowWelcome = window.VoiceroCore.session.textWelcome;
      console.log(
        "VoiceroText: Using existing textWelcome value from session:",
        shouldShowWelcome
      );
    }
    // Only calculate a new value if session doesn't have it set
    else if (window.VoiceroCore && window.VoiceroCore.appState) {
      // Check if the most recent thread has an empty messages array - should show welcome message
      if (
        window.VoiceroCore &&
        window.VoiceroCore.session &&
        window.VoiceroCore.session.threads &&
        window.VoiceroCore.session.threads.length > 0
      ) {
        // Sort threads to ensure we have the most recent one first
        const threads = [...window.VoiceroCore.session.threads];
        const sortedThreads = threads.sort((a, b) => {
          // First try to sort by lastMessageAt if available
          if (a.lastMessageAt && b.lastMessageAt) {
            return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
          }
          // Fall back to createdAt if lastMessageAt is not available
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        const mostRecentThread = sortedThreads[0];
        console.log("VoiceroText: Most recent thread:", mostRecentThread);

        if (
          !mostRecentThread.messages ||
          mostRecentThread.messages.length === 0
        ) {
          console.log(
            "VoiceroText: Most recent thread has empty messages array, showing welcome message"
          );
          shouldShowWelcome = true;
          // FORCE the welcome message by overriding session value
          if (window.VoiceroCore && window.VoiceroCore.session) {
            window.VoiceroCore.session.textWelcome = true;
          }
        } else {
          console.log(
            "VoiceroText: Most recent thread has",
            mostRecentThread.messages.length,
            "messages"
          );
        }
      } else {
        console.log("VoiceroText: No threads found in session");
      }

      // If not determined by thread, check app state
      if (!shouldShowWelcome) {
        // Show welcome if we haven't shown it before
        shouldShowWelcome =
          window.VoiceroCore.appState.hasShownTextWelcome === undefined ||
          window.VoiceroCore.appState.hasShownTextWelcome === false;

        console.log(
          "VoiceroText: Welcome state from VoiceroCore.appState:",
          shouldShowWelcome
        );

        // Mark that we've shown the welcome message
        if (shouldShowWelcome) {
          window.VoiceroCore.appState.hasShownTextWelcome = true;
          // Also set our internal flag for consistent tracking
          this.hasShownWelcome = false; // We want the welcome message to be shown once during this session
        }
      }
    }

    console.log(
      "VoiceroText: Final shouldShowWelcome value:",
      shouldShowWelcome
    );

    // Update window state if it hasn't been done already
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      window.VoiceroCore.updateWindowState({
        textOpen: true,
        textOpenWindowUp: true, // Always start maximized
        textWelcome: shouldShowWelcome, // Use value from session or calculated value
        coreOpen: false, // Always false when opening chat
        voiceOpen: false,
        voiceOpenWindowUp: false,
      });
    }

    // Also update the session object directly to ensure consistency
    if (window.VoiceroCore && window.VoiceroCore.session) {
      window.VoiceroCore.session.textOpen = true;
      window.VoiceroCore.session.textOpenWindowUp = true;
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
        headerContainer.style.borderRadius = "0"; // Ensure square corners
      }

      // Also ensure messages container has square corners
      const messagesContainer = this.shadowRoot.getElementById("chat-messages");
      if (messagesContainer) {
        messagesContainer.style.borderRadius = "0"; // Ensure square corners
      }
    }

    // Apply correct border radius for initial state (always maximized initially)
    this.updateChatContainerBorderRadius(false);

    // Set up input and button listeners
    this.setupEventListeners();

    // Set up button event handlers (ensure minimize/maximize work)
    this.setupButtonHandlers();

    // Load existing messages from session
    this.loadMessagesFromSession();

    // Initialize visibility state
    this._isChatVisible = true;
    this._lastChatToggle = Date.now();

    // Process existing AI messages to ensure report buttons are present
    setTimeout(() => {
      this.processExistingAIMessages();

      // Also directly trigger VoiceroSupport to process messages
      if (
        window.VoiceroSupport &&
        typeof window.VoiceroSupport.processExistingMessages === "function"
      ) {
        window.VoiceroSupport.processExistingMessages();
      }
    }, 500);

    // Set up continuous checking for welcome back message for 10 seconds
    // This ensures we catch messages that arrive shortly after the interface loads
    this.welcomeBackCheckCount = 0;
    this.maxWelcomeBackChecks = 20; // Check for 10 seconds (20 checks * 500ms)
    this.hasDisplayedWelcomeBack = false;

    // Clear any existing interval
    if (this.welcomeBackCheckInterval) {
      clearInterval(this.welcomeBackCheckInterval);
    }

    // Start checking for welcome back messages
    this.welcomeBackCheckInterval = setInterval(() => {
      this.checkForWelcomeBackMessage();

      // Increment counter
      this.welcomeBackCheckCount++;

      // Stop checking after max attempts
      if (this.welcomeBackCheckCount >= this.maxWelcomeBackChecks) {
        clearInterval(this.welcomeBackCheckInterval);
        console.log(
          "VoiceroText: Completed checking for welcome back messages"
        );
      }
    }, 500); // Check every 500ms

    // After the interface is fully loaded and visible, check if it should be minimized
    // based on the previous session state (delayed to prevent race conditions)
    setTimeout(() => {
      // We no longer auto-minimize the interface when opening
      // The interface should only be minimized when the user explicitly clicks the minimize button
      console.log(
        "VoiceroText: Interface opened and maximized - auto-minimize disabled"
      );

      // Force maximize to ensure consistency
      this._isChatVisible = true;
    }, 1500);
  },

  // Check for welcome back message and display it if found
  checkForWelcomeBackMessage: function () {
    // Skip if we've already displayed a welcome back message
    if (this.hasDisplayedWelcomeBack) {
      return;
    }

    // Also check for global flag to prevent showing in multiple interfaces
    if (window.voiceroWelcomeBackDisplayed) {
      console.log(
        "VoiceroText: Welcome back message already displayed in another interface"
      );
      this.hasDisplayedWelcomeBack = true;
      return;
    }

    // Check for welcome back message
    if (
      window.VoiceroUserData &&
      typeof window.VoiceroUserData.getWelcomeBackMessage === "function"
    ) {
      const welcomeBackMessage = window.VoiceroUserData.getWelcomeBackMessage();

      if (welcomeBackMessage) {
        console.log(
          "VoiceroText: Found welcome back message during continuous check:",
          welcomeBackMessage
        );

        // Check if the message is empty or just contains whitespace
        if (!welcomeBackMessage.trim()) {
          console.log(
            "VoiceroText: Welcome back message is empty, not displaying"
          );
          this.hasDisplayedWelcomeBack = true;
          return;
        }

        // Mark as displayed to prevent duplicates (both locally and globally)
        this.hasDisplayedWelcomeBack = true;
        window.voiceroWelcomeBackDisplayed = true;

        // Display the welcome back message
        this.addMessage(welcomeBackMessage, "ai");

        console.log(
          "VoiceroText: Welcome back message displayed, now clearing it"
        );

        // Clear the welcome back message
        if (
          window.VoiceroUserData &&
          typeof window.VoiceroUserData.clearWelcomeBackMessage === "function"
        ) {
          window.VoiceroUserData.clearWelcomeBackMessage();
          console.log("VoiceroText: Welcome back message cleared from storage");
        }

        // Clear the interval since we found the message
        if (this.welcomeBackCheckInterval) {
          clearInterval(this.welcomeBackCheckInterval);
          console.log(
            "VoiceroText: Stopped checking for welcome back messages after finding one"
          );
        }
      }
    }
  },

  // Load existing messages from session and display them
  loadMessagesFromSession: function () {
    // Flag to track if any messages were loaded
    let messagesLoaded = false;

    console.log("VoiceroText: Loading messages from session");

    // CRITICAL: First check VoiceroCore.session.textWelcome - if it's true, ALWAYS show welcome message
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.textWelcome === true
    ) {
      console.log(
        "VoiceroText: VoiceroCore.session.textWelcome is true, forcing welcome message"
      );
      // Reset welcome flags to ensure welcome message is shown
      this.hasShownWelcome = false;
      localStorage.removeItem("voicero_shown_text_welcome");
      if (window.VoiceroCore && window.VoiceroCore.appState) {
        window.VoiceroCore.appState.hasShownTextWelcome = false;
        if (
          window.VoiceroCore.saveState &&
          typeof window.VoiceroCore.saveState === "function"
        ) {
          window.VoiceroCore.saveState();
        }
      }
    }

    // If textWelcome is explicitly false, don't show welcome message
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.textWelcome === false
    ) {
      console.log(
        "VoiceroText: VoiceroCore.session.textWelcome is false, not showing welcome message"
      );
      this.hasShownWelcome = true;
      localStorage.setItem("voicero_shown_text_welcome", "true");
      if (window.VoiceroCore && window.VoiceroCore.appState) {
        window.VoiceroCore.appState.hasShownTextWelcome = true;
        if (
          window.VoiceroCore.saveState &&
          typeof window.VoiceroCore.saveState === "function"
        ) {
          window.VoiceroCore.saveState();
        }
      }
    }

    // Flag to check if we should show welcome message
    let shouldShowWelcome = false;

    // Check if textWelcome flag is set in session
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.textWelcome
    ) {
      shouldShowWelcome = true;
      console.log("VoiceroText: textWelcome flag is true in session");
    }

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
      console.log("VoiceroText: Most recent thread:", currentThread);

      if (
        currentThread &&
        currentThread.messages &&
        currentThread.messages.length > 0
      ) {
        // Check if there are any non-system messages
        const nonSystemMessages = currentThread.messages.filter(
          (msg) => msg.role !== "system" && msg.type !== "page_data"
        );

        console.log(
          "VoiceroText: Thread has",
          nonSystemMessages.length,
          "non-system messages"
        );

        if (nonSystemMessages.length === 0) {
          // If there are no actual messages, mark as empty for welcome message
          console.log(
            "VoiceroText: Thread has only system messages, should show welcome message"
          );
          shouldShowWelcome = true;
          messagesLoaded = false;

          // IMPORTANT: Force the welcome message to show for threads with empty messages
          if (window.VoiceroCore && window.VoiceroCore.session) {
            console.log(
              "VoiceroText: Thread has no non-system messages, forcing welcome message"
            );
            window.VoiceroCore.session.textWelcome = true;
            // Reset flags to ensure welcome message shows
            this.hasShownWelcome = false;
            localStorage.removeItem("voicero_shown_text_welcome");
            if (window.VoiceroCore && window.VoiceroCore.appState) {
              window.VoiceroCore.appState.hasShownTextWelcome = false;
            }
          }
        } else {
          // Sort messages by createdAt (oldest first)
          const sortedMessages = [...nonSystemMessages].sort((a, b) => {
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
              messagesLoaded = true;
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
                messagesLoaded = true;
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

          // Process the AI messages to ensure report buttons are attached
          setTimeout(() => {
            this.processExistingAIMessages();
          }, 500);
        }
      } else {
        // Thread exists but has empty messages array - should show welcome message
        console.log(
          "VoiceroText: Thread has empty messages array, should show welcome message"
        );
        shouldShowWelcome = true;
        messagesLoaded = false;

        // IMPORTANT: Force the welcome message to show for empty message arrays
        if (window.VoiceroCore && window.VoiceroCore.session) {
          console.log(
            "VoiceroText: Thread has empty messages array, forcing welcome message"
          );
          window.VoiceroCore.session.textWelcome = true;
          // Reset flags to ensure welcome message shows
          this.hasShownWelcome = false;
          localStorage.removeItem("voicero_shown_text_welcome");
          if (window.VoiceroCore && window.VoiceroCore.appState) {
            window.VoiceroCore.appState.hasShownTextWelcome = false;
          }
        }

        // Still store the thread ID even if no messages
        if (currentThread) {
          this.currentThreadId = currentThread.threadId;
        }
      }
    } else {
      // No threads available, mark as empty for welcome message
      console.log("VoiceroText: No threads found in session");
      shouldShowWelcome = true;
    }

    console.log(
      "VoiceroText: shouldShowWelcome:",
      shouldShowWelcome,
      "messagesLoaded:",
      messagesLoaded
    );

    // If no messages were loaded and we should show welcome message
    // Also respect explicit textWelcome=true from session
    if (
      (!messagesLoaded && shouldShowWelcome) ||
      (window.VoiceroCore &&
        window.VoiceroCore.session &&
        window.VoiceroCore.session.textWelcome === true)
    ) {
      // Extra check to prevent duplicate welcome messages
      if (
        !this.hasShownWelcome &&
        localStorage.getItem("voicero_shown_text_welcome") !== "true" &&
        !(
          window.VoiceroCore &&
          window.VoiceroCore.appState &&
          window.VoiceroCore.appState.hasShownTextWelcome === true
        ) &&
        !(
          window.VoiceroCore &&
          window.VoiceroCore.session &&
          window.VoiceroCore.session.textWelcome === false
        )
      ) {
        // Verify no welcome messages are already in the DOM
        const messagesContainer = this.shadowRoot
          ? this.shadowRoot.getElementById("chat-messages")
          : document.getElementById("chat-messages");

        if (messagesContainer) {
          const existingWelcomeMessages = messagesContainer.querySelectorAll(
            ".ai-message .welcome-question"
          );
          if (existingWelcomeMessages.length === 0) {
            console.log(
              "VoiceroText: All checks passed, showing welcome message"
            );
            this.showWelcomeMessage();
          } else {
            console.log(
              "VoiceroText: Found existing welcome message in DOM, not showing again"
            );
            this.hasShownWelcome = true;
            localStorage.setItem("voicero_shown_text_welcome", "true");
            if (window.VoiceroCore && window.VoiceroCore.appState) {
              window.VoiceroCore.appState.hasShownTextWelcome = true;
            }
          }
        } else {
          // If there's no messages container, just show the message
          this.showWelcomeMessage();
        }
      } else {
        console.log(
          "VoiceroText: Not showing welcome message due to existing flags"
        );
      }
    }
  },

  // Helper function to display the welcome message
  showWelcomeMessage: function () {
    // CRITICAL: Check for existing welcome messages in the DOM first
    const messagesContainer = this.shadowRoot
      ? this.shadowRoot.getElementById("chat-messages")
      : document.getElementById("chat-messages");

    if (messagesContainer) {
      const existingWelcomeMessages = messagesContainer.querySelectorAll(
        ".ai-message .welcome-question"
      );
      if (existingWelcomeMessages.length > 0) {
        console.log(
          "VoiceroText: Welcome message already exists in DOM, not showing again"
        );
        this.hasShownWelcome = true;
        localStorage.setItem("voicero_shown_text_welcome", "true");
        if (window.VoiceroCore && window.VoiceroCore.appState) {
          window.VoiceroCore.appState.hasShownTextWelcome = true;
        }
        return;
      }
    }

    // Multiple checks to prevent welcome message from showing repeatedly

    // Check internal flag
    if (this.hasShownWelcome) {
      console.log("VoiceroText: Welcome message blocked by internal flag");
      return;
    }

    // Also check VoiceroCore's appState
    if (
      window.VoiceroCore &&
      window.VoiceroCore.appState &&
      window.VoiceroCore.appState.hasShownTextWelcome === true
    ) {
      console.log(
        "VoiceroText: Welcome message blocked by VoiceroCore appState"
      );
      this.hasShownWelcome = true;
      return;
    }

    // Check localStorage for persistence across page refreshes
    if (localStorage.getItem("voicero_shown_text_welcome") === "true") {
      console.log("VoiceroText: Welcome message blocked by localStorage flag");
      this.hasShownWelcome = true;
      return;
    }

    // If we get here, we need to show the welcome message
    // Set all flags to indicate welcome was shown
    this.hasShownWelcome = true;
    localStorage.setItem("voicero_shown_text_welcome", "true");
    if (window.VoiceroCore && window.VoiceroCore.appState) {
      window.VoiceroCore.appState.hasShownTextWelcome = true;
      if (
        window.VoiceroCore.saveState &&
        typeof window.VoiceroCore.saveState === "function"
      ) {
        window.VoiceroCore.saveState();
      }
    }

    // Additional check for existing AI messages
    if (messagesContainer && messagesContainer.querySelector(".ai-message")) {
      console.log(
        "VoiceroText: Welcome message blocked by existing AI messages"
      );
      return;
    }

    // Get website name - try different sources
    let websiteName = "our website";
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.website &&
      window.VoiceroCore.session.website.name
    ) {
      websiteName = window.VoiceroCore.session.website.name;
    } else if (document.title) {
      // Extract site name (before " - " or " | " if present)
      const title = document.title;
      const separatorIndex = Math.min(
        title.indexOf(" - ") > -1 ? title.indexOf(" - ") : Infinity,
        title.indexOf(" | ") > -1 ? title.indexOf(" | ") : Infinity
      );

      if (separatorIndex !== Infinity) {
        websiteName = title.substring(0, separatorIndex);
      } else {
        websiteName = title;
      }
    }

    // Create welcome message with website name and bot name if available
    const botName =
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.botName
        ? window.VoiceroCore.session.botName
        : window.voiceroBotName || window.VoiceroCore?.botName || "Voicero";

    let welcomeMessageContent = "";
    let welcomeMessage = "";

    // Check if there's a custom welcome message from the API
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.customWelcomeMessage
    ) {
      welcomeMessageContent = window.VoiceroCore.session.customWelcomeMessage;
    } else if (
      window.voiceroCustomWelcomeMessage ||
      window.VoiceroCore?.customWelcomeMessage
    ) {
      welcomeMessageContent =
        window.voiceroCustomWelcomeMessage ||
        window.VoiceroCore.customWelcomeMessage;
    } else {
      welcomeMessageContent = `I'm your AI assistant powered by VoiceroAI. I'm here to help answer your questions about products, services, or anything else related to ${websiteName}.

Feel free to ask me anything, and I'll do my best to assist you!`;
    }

    welcomeMessage = `Hi, I'm ${botName}! ${welcomeMessageContent}

**Start Typing to Chat**
`;

    // IMPORTANT: Always get the latest websiteColor from VoiceroCore
    if (window.VoiceroCore && window.VoiceroCore.websiteColor) {
      this.websiteColor = window.VoiceroCore.websiteColor;
    }

    // Check if we have custom pop-up questions to add to the welcome message
    let customPopUpQuestions = [];
    let popUpQuestionsSource = "none";

    // Try to get questions from website data
    if (
      this.websiteData &&
      this.websiteData.website &&
      this.websiteData.website.popUpQuestions &&
      this.websiteData.website.popUpQuestions.length > 0
    ) {
      customPopUpQuestions = this.websiteData.website.popUpQuestions;
      popUpQuestionsSource = "websiteData";
    }
    // Try to get questions from VoiceroCore session
    else if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.popUpQuestions &&
      window.VoiceroCore.session.popUpQuestions.length > 0
    ) {
      customPopUpQuestions = window.VoiceroCore.session.popUpQuestions;
      popUpQuestionsSource = "VoiceroCore.session.popUpQuestions";
    }
    // Try to get questions directly from VoiceroCore
    else if (
      window.VoiceroCore &&
      window.VoiceroCore.popUpQuestions &&
      window.VoiceroCore.popUpQuestions.length > 0
    ) {
      customPopUpQuestions = window.VoiceroCore.popUpQuestions;
      popUpQuestionsSource = "VoiceroCore.popUpQuestions";
    }
    // Check for website property directly in VoiceroCore
    else if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.website &&
      window.VoiceroCore.session.website.popUpQuestions &&
      window.VoiceroCore.session.website.popUpQuestions.length > 0
    ) {
      customPopUpQuestions = window.VoiceroCore.session.website.popUpQuestions;
      popUpQuestionsSource = "VoiceroCore.session.website.popUpQuestions";
    }
    // Direct access to VoiceroCore's website object
    else if (
      window.VoiceroCore &&
      window.VoiceroCore.website &&
      window.VoiceroCore.website.popUpQuestions &&
      window.VoiceroCore.website.popUpQuestions.length > 0
    ) {
      customPopUpQuestions = window.VoiceroCore.website.popUpQuestions;
      popUpQuestionsSource = "VoiceroCore.website.popUpQuestions";
    }
    // Fallback to window global
    else if (
      window.voiceroPopUpQuestions &&
      window.voiceroPopUpQuestions.length > 0
    ) {
      customPopUpQuestions = window.voiceroPopUpQuestions;
      popUpQuestionsSource = "window.voiceroPopUpQuestions";
    }

    console.log(
      "VoiceroText: Found popup questions from",
      popUpQuestionsSource,
      customPopUpQuestions
    );

    // Add questions to welcome message if available
    if (customPopUpQuestions.length > 0) {
      welcomeMessage += "\n\nHere are some questions you might want to ask:\n";

      customPopUpQuestions.forEach((item, index) => {
        const questionText = item.question || item;
        if (questionText && typeof questionText === "string") {
          welcomeMessage += `\n- <span class="welcome-question" style="text-decoration: underline; color: ${
            this.websiteColor
          }; cursor: pointer;" data-question="${questionText.replace(
            /"/g,
            "&quot;"
          )}">${questionText}</span>`;
        }
      });
    }

    // Add the welcome message to the interface
    const welcomeMessageElement = this.addMessage(welcomeMessage, "ai");

    // Add click handlers to the welcome questions
    setTimeout(() => {
      if (this.shadowRoot && welcomeMessageElement) {
        // Use event delegation on the welcome message element instead of individual question elements
        // This avoids duplicate handlers when switching between interfaces
        if (!welcomeMessageElement.hasAttribute("data-question-handler")) {
          welcomeMessageElement.setAttribute("data-question-handler", "true");

          // Use event delegation - one handler for the entire message
          welcomeMessageElement.addEventListener("click", (e) => {
            // Find if the click was on a welcome-question element
            let target = e.target;
            while (target !== welcomeMessageElement) {
              if (target.classList.contains("welcome-question")) {
                e.preventDefault();
                const questionText = target.getAttribute("data-question");
                if (questionText) {
                  this.sendChatMessage(questionText);
                }
                break;
              }
              if (!target.parentElement) break; // Safety check
              target = target.parentElement;
            }
          });
        }
      }
    }, 100);

    // Update state to prevent showing welcome again
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      window.VoiceroCore.updateWindowState({
        textWelcome: false,
      });
    }
  },

  // New function to process existing AI messages
  processExistingAIMessages: function () {
    if (!this.shadowRoot) return;

    const messagesContainer = this.shadowRoot.getElementById("chat-messages");
    if (!messagesContainer) return;

    // Find all AI messages
    const aiMessages = messagesContainer.querySelectorAll(
      ".ai-message:not(.placeholder):not(.typing-wrapper)"
    );

    // Skip if no messages
    if (!aiMessages || aiMessages.length === 0) return;

    // Process each message
    aiMessages.forEach((message) => {
      // Check if there's already a report button
      if (message.querySelector(".voicero-report-button")) return;

      // Try to attach a report button
      if (window.VoiceroSupport) {
        if (typeof window.VoiceroSupport.processAIMessage === "function") {
          window.VoiceroSupport.processAIMessage(message, "text");
        } else if (
          typeof window.VoiceroSupport.attachReportButtonToMessage ===
          "function"
        ) {
          window.VoiceroSupport.attachReportButtonToMessage(message, "text");
        }
      } else {
        // Fallback: Add a basic report button
        const contentEl = message.querySelector(".message-content");
        if (contentEl && !contentEl.querySelector(".voicero-report-button")) {
          const reportButton = document.createElement("div");
          reportButton.className = "voicero-report-button";
          reportButton.innerHTML = "Report an AI problem";
          reportButton.style.cssText = `
            font-size: 12px;
            color: #888;
            margin-top: 10px;
            text-align: right;
            cursor: pointer;
            text-decoration: underline;
            display: block;
            opacity: 0.8;
          `;
          contentEl.appendChild(reportButton);
        }
      }
    });
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
      // Make sure any HTML content (especially for welcome questions) is preserved
      messageContent.innerHTML = this.formatContent(text);

      // Use event delegation instead of individual click handlers
      // We'll set up a single click handler on the message element
      if (messageContent.querySelectorAll(".welcome-question").length > 0) {
        message.setAttribute("data-has-questions", "true");
      }
    } else {
      messageContent.textContent = text;
    }

    // Append content to message
    message.appendChild(messageContent);

    // Add event delegation for welcome questions if needed
    if (message.getAttribute("data-has-questions") === "true") {
      // Use event delegation - one handler for the entire message
      message.addEventListener("click", (e) => {
        // Find if the click was on a welcome-question element
        let target = e.target;
        while (target !== message) {
          if (target.classList.contains("welcome-question")) {
            e.preventDefault();
            const questionText = target.getAttribute("data-question");
            if (questionText) {
              this.sendChatMessage(questionText);
            }
            break;
          }
          if (!target.parentElement) break; // Safety check
          target = target.parentElement;
        }
      });
    }

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
    return window.VoiceroPageData && window.VoiceroPageData.generateId
      ? window.VoiceroPageData.generateId()
      : "temp-" +
          Math.random().toString(36).substring(2, 15) +
          Math.random().toString(36).substring(2, 15);
  },

  // Fetch website data from /api/connect endpoint
  fetchWebsiteData: function () {
    // Use WordPress proxy endpoint instead of direct API endpoint
    fetch("/wp-json/voicero/v1/connect", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(window.voiceroConfig?.getAuthHeaders
          ? window.voiceroConfig.getAuthHeaders()
          : {}),
      },
      body: JSON.stringify({
        url: window.location.href,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Website data fetch failed: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        // Use the website data from the response
        this.websiteData = data;

        // Store custom instructions if available
        if (data.website && data.website.customInstructions) {
          this.customInstructions = data.website.customInstructions;
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
    let customPopUpQuestions = [];
    let popUpQuestionsSource = "none";

    // Try to get questions from website data
    if (
      this.websiteData &&
      this.websiteData.website &&
      this.websiteData.website.popUpQuestions &&
      this.websiteData.website.popUpQuestions.length > 0
    ) {
      customPopUpQuestions = this.websiteData.website.popUpQuestions;
      popUpQuestionsSource = "websiteData";
    }
    // Try to get questions from VoiceroCore session
    else if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.popUpQuestions &&
      window.VoiceroCore.session.popUpQuestions.length > 0
    ) {
      customPopUpQuestions = window.VoiceroCore.session.popUpQuestions;
      popUpQuestionsSource = "VoiceroCore.session.popUpQuestions";
    }
    // Try to get questions directly from VoiceroCore
    else if (
      window.VoiceroCore &&
      window.VoiceroCore.popUpQuestions &&
      window.VoiceroCore.popUpQuestions.length > 0
    ) {
      customPopUpQuestions = window.VoiceroCore.popUpQuestions;
      popUpQuestionsSource = "VoiceroCore.popUpQuestions";
    }
    // Check for website property directly in VoiceroCore
    else if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.website &&
      window.VoiceroCore.session.website.popUpQuestions &&
      window.VoiceroCore.session.website.popUpQuestions.length > 0
    ) {
      customPopUpQuestions = window.VoiceroCore.session.website.popUpQuestions;
      popUpQuestionsSource = "VoiceroCore.session.website.popUpQuestions";
    }
    // Direct access to VoiceroCore's website object
    else if (
      window.VoiceroCore &&
      window.VoiceroCore.website &&
      window.VoiceroCore.website.popUpQuestions &&
      window.VoiceroCore.website.popUpQuestions.length > 0
    ) {
      customPopUpQuestions = window.VoiceroCore.website.popUpQuestions;
      popUpQuestionsSource = "VoiceroCore.website.popUpQuestions";
    }
    // Fallback to window global
    else if (
      window.voiceroPopUpQuestions &&
      window.voiceroPopUpQuestions.length > 0
    ) {
      customPopUpQuestions = window.voiceroPopUpQuestions;
      popUpQuestionsSource = "window.voiceroPopUpQuestions";
    }

    console.log(
      "VoiceroText: Updating popup questions from",
      popUpQuestionsSource,
      customPopUpQuestions
    );

    if (!customPopUpQuestions || customPopUpQuestions.length === 0) {
      console.log("VoiceroText: No popup questions found");
      return;
    }

    const popupQuestions = customPopUpQuestions;

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
      

        /* Hide scrollbar for different browsers */
        #chat-messages {
          scrollbar-width: none !important; /* Firefox */
          -ms-overflow-style: none !important; /* IE and Edge */
          padding: 15px !important; 
          padding-top: 10px !important;
          margin: 0 !important;
          background-color: #f2f2f7 !important;
          border-radius: 0 !important;
          transition: max-height 0.25s ease, opacity 0.25s ease !important;
          overflow-y: auto !important;
          overflow-x: hidden !important;
          max-height: 27vh !important;
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
          
          
          
         
          
          

          /* Hide scrollbar for different browsers */
          #chat-messages {
            scrollbar-width: none !important; /* Firefox */
            -ms-overflow-style: none !important; /* IE and Edge */
            padding: 15px !important; 
            padding-top: 10px !important;
            margin: 0 !important;
            background-color: #f2f2f7 !important;
            border-radius: 0 !important;
            transition: max-height 0.25s ease, opacity 0.25s ease !important;
            overflow-y: auto !important;
            overflow-x: hidden !important;
            max-height: 33vh !important;
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
            background: ${this.websiteColor || "#882be6"};
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
          border-radius: 0 !important;
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
          max-height: 33vh;
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
      minimizeBtn.addEventListener("click", () => {
        // Check if session operations are in progress
        if (this.isSessionBusy()) {
          console.log(
            "VoiceroText: Minimize button click ignored - session operation in progress"
          );
          return;
        }
        this.minimizeChat();
      });
    }

    if (maximizeBtn) {
      maximizeBtn.removeAttribute("onclick");
      maximizeBtn.addEventListener("click", () => {
        // Check if session operations are in progress
        if (this.isSessionBusy()) {
          console.log(
            "VoiceroText: Maximize button click ignored - session operation in progress"
          );
          return;
        }
        this.maximizeChat();
      });

      // We don't need to set the background color here anymore as it's already set in the HTML
      // Just ensure the button has display:flex for the icon alignment
      const maximizeButton = maximizeBtn.querySelector("button");
      if (maximizeButton) {
        // Reapply the main styling to ensure it's consistent
        maximizeButton.style.position = "relative";
        maximizeButton.style.background = this.websiteColor || "#882be6"; // Use the dynamic website color
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

    if (closeBtn) {
      closeBtn.removeAttribute("onclick");
      closeBtn.addEventListener("click", () => {
        // Check if session operations are in progress
        if (this.isSessionBusy()) {
          console.log(
            "VoiceroText: Close button click ignored - session operation in progress"
          );
          return;
        }
        this.closeTextChat();
      });
    }

    if (clearBtn) {
      clearBtn.removeAttribute("onclick");
      clearBtn.addEventListener("click", () => this.clearChatHistory());
    }

    if (toggleBtn) {
      toggleBtn.removeAttribute("onclick");
      toggleBtn.addEventListener("click", () => {
        // Check if session operations are in progress
        if (this.isSessionBusy()) {
          console.log(
            "VoiceroText: Toggle button click ignored - session operation in progress"
          );
          return;
        }
        this.toggleToVoiceChat();
      });
    }
  },

  // Clear chat history
  clearChatHistory: function () {
    // Call the session/clear API endpoint
    if (window.VoiceroCore && window.VoiceroCore.sessionId) {
      // Use WordPress proxy endpoint
      fetch("/wp-json/voicero/v1/session_clear", {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          ...(window.voiceroConfig?.getAuthHeaders
            ? window.voiceroConfig.getAuthHeaders()
            : {}),
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
    }

    // Reset messages array
    this.messages = [];

    // RESET all welcome flags to false to ensure showing welcome message again after clearing
    this.hasShownWelcome = false;
    localStorage.removeItem("voicero_shown_text_welcome");

    // Update VoiceroCore state
    if (window.VoiceroCore) {
      if (window.VoiceroCore.appState) {
        window.VoiceroCore.appState.hasShownTextWelcome = false;
      }

      // Also update session flag
      if (window.VoiceroCore.updateWindowState) {
        window.VoiceroCore.updateWindowState({
          textWelcome: true, // Set to true to force showing welcome again
        });
      }
    }

    // Directly show the welcome message
    this.showWelcomeMessage();
  },

  // Send chat message to API
  sendChatToApi: function (messageText, threadId) {
    // Show loading indicator
    this.setLoadingIndicator(true);

    // Format the request body according to the API's expected structure
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

    // Log request body for debugging
    console.log(
      "[VOICERO TEXT] Sending to /chat:",
      JSON.stringify(requestBody, null, 2)
    );

    // Use WordPress proxy endpoint instead of direct localhost call
    return fetch("/wp-json/voicero/v1/wordpress/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Accept: "application/json",
        ...(window.voiceroConfig?.getAuthHeaders
          ? window.voiceroConfig.getAuthHeaders()
          : {}),
      },
      body: JSON.stringify(requestBody),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Chat API request failed: ${response.status}`);
        }
        console.log(
          "[VOICERO TEXT] Successfully used WordPress proxy endpoint"
        );
        return response;
      })
      .catch((error) => {
        console.log("[VOICERO TEXT] API request failed:", error.message);

        // Throw the error so it can be handled by the calling function
        throw error;
      });
  },

  // Create typing indicator for AI messages

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

    // Get the send button
    let sendButton = null;
    if (this.shadowRoot) {
      sendButton = this.shadowRoot.getElementById("send-message-btn");
    }

    // Check if VoiceroWait is available and use it
    if (window.VoiceroWait) {
      // Add loading animation to send button
      if (sendButton) {
        window.VoiceroWait.addLoadingAnimation(sendButton);
      }

      // Show typing indicator in messages container
      if (this.shadowRoot) {
        // First ensure the animation styles are in the Shadow DOM
        this.ensureTypingAnimationInShadowDOM();

        const messagesContainer =
          this.shadowRoot.getElementById("chat-messages");
        if (messagesContainer) {
          this.typingIndicator =
            window.VoiceroWait.showTypingIndicator(messagesContainer);
        }
      }
    } else {
      // Fallback to classic animation if VoiceroWait is not available
      if (sendButton) {
        sendButton.classList.add("siri-active");
      }
    }

    // Function to remove typing indicator and animations
    const removeTypingIndicator = () => {
      if (window.VoiceroWait) {
        // Use VoiceroWait to hide the indicator
        window.VoiceroWait.hideTypingIndicator();

        // Remove loading animation from send button
        if (sendButton) {
          window.VoiceroWait.removeLoadingAnimation(sendButton);
        }
      } else {
        // Fallback to classic removal
        if (this.typingIndicator) {
          this.typingIndicator.remove();
          this.typingIndicator = null;
        }

        const typingElements = document.querySelectorAll(".typing-wrapper");
        typingElements.forEach((el) => el.remove());

        // Remove rainbow animation manually
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
          console.log(
            "[VOICERO TEXT] Received from /chat:",
            JSON.stringify(data, null, 2)
          );

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

          // Handle actions - directly pass to VoiceroActionHandler if available
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

    // Check if API request is in progress
    if (this.isWaitingForResponse) {
      console.log("VoiceroText: Cannot close - waiting for API response");
      return;
    }

    // Check if session operations are in progress
    if (
      window.VoiceroCore &&
      window.VoiceroCore.isSessionBusy &&
      window.VoiceroCore.isSessionBusy()
    ) {
      console.log("VoiceroText: Cannot close - session operation in progress");
      return;
    }

    // Set closing flag
    this.isClosingTextChat = true;
    this.isSessionOperationInProgress = true;
    this.lastSessionOperationTime = Date.now();

    // Store reference to this for callbacks
    const self = this;

    // First create reliable references to the elements we need
    const textInterface = document.getElementById("text-chat-interface");
    const shadowHost = document.getElementById("voicero-text-chat-container");

    // Update window state first - this is critical
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      // First update to close text chat
      const updateResult = window.VoiceroCore.updateWindowState({
        textOpen: false,
        textOpenWindowUp: false,
        coreOpen: true,
        voiceOpen: false,
        autoMic: false,
        voiceOpenWindowUp: false,
      });

      // Check if updateResult is a Promise
      if (updateResult && typeof updateResult.finally === "function") {
        updateResult.finally(() => {
          // Reset busy flags after operation completes
          self.isSessionOperationInProgress = false;
          self.isClosingTextChat = false;

          // Small delay to ensure state updates are processed
          setTimeout(() => {
            // Then ensure core is visible
            if (window.VoiceroCore) {
              window.VoiceroCore.ensureMainButtonVisible();
            }
          }, 100);
        });
      } else {
        // If not a Promise, just reset the flags
        self.isSessionOperationInProgress = false;
        self.isClosingTextChat = false;

        // Small delay to ensure state updates are processed
        setTimeout(() => {
          // Then ensure core is visible
          if (window.VoiceroCore) {
            window.VoiceroCore.ensureMainButtonVisible();
          }
        }, 100);
      }
    } else {
      // Reset busy flags if VoiceroCore isn't available
      this.isSessionOperationInProgress = false;
      this.isClosingTextChat = false;
    }

    // Hide both the interface and shadow host
    if (textInterface) {
      textInterface.style.display = "none";
    }
    if (shadowHost) {
      shadowHost.style.display = "none";
    }
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

    // Check if session operations are in progress
    if (
      window.VoiceroCore &&
      window.VoiceroCore.isSessionBusy &&
      window.VoiceroCore.isSessionBusy()
    ) {
      console.log(
        "VoiceroText: Cannot minimize - session operation in progress"
      );
      return;
    }

    // Set busy flag
    this.isSessionOperationInProgress = true;
    this.lastSessionOperationTime = Date.now();

    this._lastChatToggle = now;
    this._isChatVisible = false;

    // Store reference to this for callbacks
    const self = this;

    // Update window state first (text open but window down)
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      // Preserve the existing textWelcome value from the session
      const currentWelcomeState =
        window.VoiceroCore.session &&
        window.VoiceroCore.session.textWelcome !== undefined
          ? window.VoiceroCore.session.textWelcome
          : false;

      const updateResult = window.VoiceroCore.updateWindowState({
        textOpen: true,
        textOpenWindowUp: false, // Set to false when minimized
        textWelcome: currentWelcomeState, // Preserve existing welcome state
        coreOpen: false,
        voiceOpen: false,
        voiceOpenWindowUp: false,
      });

      // Check if updateResult is a Promise
      if (updateResult && typeof updateResult.finally === "function") {
        updateResult.finally(() => {
          // Reset busy flag after operation completes
          self.isSessionOperationInProgress = false;
        });
      } else {
        // If not a Promise, just reset the flag
        self.isSessionOperationInProgress = false;
      }
    } else {
      // Reset busy flag if VoiceroCore isn't available
      this.isSessionOperationInProgress = false;
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
        maximizeButton.style.background = this.websiteColor || "#882be6"; // Use the dynamic website color
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
      messagesContainer.style.borderRadius = "0"; // Remove any border radius

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

    // Adjust input wrapper using the helper function
    this.updateChatContainerBorderRadius(true);

    // Additional styles for minimized state
    if (inputWrapper) {
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

    // Check if session operations are in progress
    if (
      window.VoiceroCore &&
      window.VoiceroCore.isSessionBusy &&
      window.VoiceroCore.isSessionBusy()
    ) {
      console.log(
        "VoiceroText: Cannot maximize - session operation in progress"
      );
      return;
    }

    // Set busy flag
    this.isSessionOperationInProgress = true;
    this.lastSessionOperationTime = Date.now();

    this._lastChatToggle = now;
    this._isChatVisible = true;

    // Store reference to this for callbacks
    const self = this;

    // Update window state first (text open with window up)
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      // Preserve the existing textWelcome value from the session
      const currentWelcomeState =
        window.VoiceroCore.session &&
        window.VoiceroCore.session.textWelcome !== undefined
          ? window.VoiceroCore.session.textWelcome
          : false;

      const updateResult = window.VoiceroCore.updateWindowState({
        textOpen: true,
        textOpenWindowUp: true, // Set to true when maximized
        textWelcome: currentWelcomeState, // Preserve existing welcome state
        coreOpen: false,
        voiceOpen: false,
        voiceOpenWindowUp: false,
      });

      // Check if updateResult is a Promise
      if (updateResult && typeof updateResult.finally === "function") {
        updateResult.finally(() => {
          // Reset busy flag after operation completes
          self.isSessionOperationInProgress = false;
        });
      } else {
        // If not a Promise, just reset the flag
        self.isSessionOperationInProgress = false;
      }
    } else {
      // Reset busy flag if VoiceroCore isn't available
      this.isSessionOperationInProgress = false;
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
      messagesContainer.style.maxHeight = "33vh";
      messagesContainer.style.minHeight = "auto";
      messagesContainer.style.height = "auto";
      messagesContainer.style.padding = "15px";
      messagesContainer.style.paddingTop = "0";
      messagesContainer.style.margin = "0";
      messagesContainer.style.overflow = "auto";
      messagesContainer.style.overflowY = "scroll";
      messagesContainer.style.border = "";
      messagesContainer.style.opacity = "1";
      messagesContainer.style.borderRadius = "0"; // Square corners for maximized view

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

    // Show the header with square corners
    if (headerContainer) {
      headerContainer.style.display = "flex";
      headerContainer.style.zIndex = "9999999";
      headerContainer.style.borderRadius = "0"; // Square corners for maximized view
    }

    // Restore input wrapper using the helper function
    this.updateChatContainerBorderRadius(false);

    // Additional styles for maximized state
    if (inputWrapper) {
      inputWrapper.style.marginTop = "0";
    }
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

    if (isInitial) {
      contentDiv.style.background = "#e5e5ea";
      contentDiv.style.color = "#333";
      contentDiv.style.textAlign = "center";
      contentDiv.style.margin = "15px auto";
      contentDiv.style.width = "80%";
      contentDiv.style.borderRadius = "18px";
      messageDiv.style.justifyContent = "center";

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

    if (role === "ai" && !isInitial && !isLoading) {
      try {
        // Try three different methods to ensure the report button gets added

        // Method 1: Direct call to processAIMessage if available
        if (
          window.VoiceroSupport &&
          typeof window.VoiceroSupport.processAIMessage === "function"
        ) {
          // Small delay to ensure the message is fully rendered
          setTimeout(() => {
            window.VoiceroSupport.processAIMessage(messageDiv, "text");
          }, 50);
        }
        // Method 2: Call attachReportButtonToMessage directly
        else if (
          window.VoiceroSupport &&
          typeof window.VoiceroSupport.attachReportButtonToMessage ===
            "function"
        ) {
          // Small delay to ensure the message is fully rendered
          setTimeout(() => {
            window.VoiceroSupport.attachReportButtonToMessage(
              messageDiv,
              "text"
            );
          }, 50);
        }
        // Method 3: Force-adding the button directly
        else {
          setTimeout(() => {
            // If VoiceroSupport is not available, create a basic report button ourselves
            if (!messageDiv.querySelector(".voicero-report-button")) {
              const reportButton = document.createElement("div");
              reportButton.className = "voicero-report-button";
              reportButton.innerHTML = "Report an AI problem";
              reportButton.style.cssText = `
                font-size: 12px;
                color: #888;
                margin-top: 10px;
                text-align: right;
                cursor: pointer;
                text-decoration: underline;
                display: block;
                opacity: 0.8;
              `;

              // Find the content container or use direct message
              const contentContainer =
                messageDiv.querySelector(".message-content");
              if (contentContainer) {
                contentContainer.appendChild(reportButton);
              } else {
                messageDiv.appendChild(reportButton);
              }
            }
          }, 100);
        }
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
    // Use the shared VoiceroColor utility function
    if (window.VoiceroColor && window.VoiceroColor.getColorVariants) {
      this.colorVariants = window.VoiceroColor.getColorVariants(color);
      return this.colorVariants;
    }

    // Fallback implementation if VoiceroColor isn't loaded yet
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
    return window.VoiceroColor &&
      typeof window.VoiceroColor.colorLighter === "function"
      ? window.VoiceroColor.colorLighter(color)
      : !color
      ? "#d5c5f3"
      : !color.startsWith("#")
      ? color
      : "#d5c5f3";
  },

  colorLight: function (color) {
    return window.VoiceroColor &&
      typeof window.VoiceroColor.colorLight === "function"
      ? window.VoiceroColor.colorLight(color)
      : !color
      ? "#9370db"
      : !color.startsWith("#")
      ? color
      : "#9370db";
  },

  colorDark: function (color) {
    return window.VoiceroColor &&
      typeof window.VoiceroColor.colorDark === "function"
      ? window.VoiceroColor.colorDark(color)
      : !color
      ? "#7a5abf"
      : !color.startsWith("#")
      ? color
      : "#7a5abf";
  },

  colorDarker: function (color) {
    return window.VoiceroColor &&
      typeof window.VoiceroColor.colorDarker === "function"
      ? window.VoiceroColor.colorDarker(color)
      : !color
      ? "#5e3b96"
      : !color.startsWith("#")
      ? color
      : "#5e3b96";
  },

  adjustColor: function (color, adjustment) {
    return window.VoiceroColor &&
      typeof window.VoiceroColor.adjustColor === "function"
      ? window.VoiceroColor.adjustColor(color, adjustment)
      : !color
      ? "#ff4444"
      : !color.startsWith("#")
      ? color
      : "#ff4444";
  },

  // Collect page data for better context
  collectPageData: function () {
    // Use the shared utility function instead of duplicating the code
    return window.VoiceroPageData
      ? window.VoiceroPageData.collectPageData()
      : // Fallback implementation in case the utility isn't loaded
        {
          url: window.location.href,
          full_text: document.body.innerText.trim(),
          buttons: [],
          forms: [],
          sections: [],
          images: [],
        };
  },

  // Toggle from text chat to voice chat
  toggleToVoiceChat: function () {
    console.log("VoiceroText: Toggling from text to voice chat");

    // Check if API request is in progress
    if (this.isWaitingForResponse) {
      console.log(
        "VoiceroText: Cannot toggle to voice chat - waiting for API response"
      );
      return;
    }

    // Check if session operations are in progress
    if (
      window.VoiceroCore &&
      window.VoiceroCore.isSessionBusy &&
      window.VoiceroCore.isSessionBusy()
    ) {
      console.log(
        "VoiceroText: Cannot toggle to voice chat - session operation in progress"
      );
      return;
    }

    // Set busy flag
    this.isSessionOperationInProgress = true;
    this.lastSessionOperationTime = Date.now();

    // Flag for tracking closure
    this.isClosingTextChat = true;

    // First hide the text chat interfaces
    const textInterface = document.getElementById("text-chat-interface");
    const shadowHost = document.getElementById("voicero-text-chat-container");

    // Hide both the interface and shadow host
    if (textInterface) {
      textInterface.style.display = "none";
    }
    if (shadowHost) {
      shadowHost.style.display = "none";
    }

    // Store reference to this for callbacks
    const self = this;

    // Update window state with a single call instead of sequentially
    // This prevents race conditions where coreOpen ends up as true
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      // Preserve existing welcome values from session
      const currentTextWelcome =
        window.VoiceroCore.session &&
        window.VoiceroCore.session.textWelcome !== undefined
          ? window.VoiceroCore.session.textWelcome
          : false;

      const currentVoiceWelcome =
        window.VoiceroCore.session &&
        window.VoiceroCore.session.voiceWelcome !== undefined
          ? window.VoiceroCore.session.voiceWelcome
          : false;

      const updateResult = window.VoiceroCore.updateWindowState({
        voiceOpen: true,
        voiceOpenWindowUp: true, // Explicitly set to true to ensure maximized
        voiceWelcome: currentVoiceWelcome, // Preserve voice welcome state
        textOpen: false,
        textOpenWindowUp: false,
        textWelcome: currentTextWelcome, // Preserve text welcome state
        coreOpen: false,
        autoMic: false,
      });

      // Check if updateResult is a Promise
      if (updateResult && typeof updateResult.finally === "function") {
        updateResult.finally(() => {
          // Reset busy flags after operation completes
          self.isSessionOperationInProgress = false;
          self.isClosingTextChat = false;

          // Then open the voice chat interface
          self.openVoiceChatAfterToggle();
        });
      } else {
        // If not a Promise, just reset the flag and continue
        self.isSessionOperationInProgress = false;
        self.isClosingTextChat = false;
        self.openVoiceChatAfterToggle();
      }
    } else {
      // Reset busy flag if VoiceroCore isn't available
      this.isSessionOperationInProgress = false;
      this.isClosingTextChat = false;
      this.openVoiceChatAfterToggle();
    }
  },

  // Helper function to open voice chat after toggle
  openVoiceChatAfterToggle: function () {
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

    // Check if text already contains HTML elements (like our welcome-question spans)
    const containsHtml = /<[a-z][\s\S]*>/i.test(text);

    if (containsHtml) {
      // If it already has HTML, just return it (our spans are already formatted)
      return text;
    }

    // Process URLs
    const urlRegex = /(https?:\/\/[^\s]+)/g;
    const processedText = text.replace(
      urlRegex,
      '<a href="$1" target="_blank" class="chat-link">$1</a>'
    );

    // Process markdown-style bold text
    let formattedText = processedText.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    );

    // Process markdown-style italic text
    formattedText = formattedText.replace(/\*(.*?)\*/g, "<em>$1</em>");

    // Replace line breaks
    formattedText = formattedText.replace(/\n/g, "<br>");

    return formattedText;
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

  // Check if session operations are in progress
  isSessionBusy: function () {
    // If a session operation is explicitly marked as in progress
    if (this.isSessionOperationInProgress) {
      // Check if it's been too long (might be stuck)
      const currentTime = Date.now();
      const timeSinceLastOperation =
        currentTime - this.lastSessionOperationTime;

      if (timeSinceLastOperation > this.sessionOperationTimeout) {
        console.warn(
          "VoiceroText: Session operation timeout exceeded, resetting flag"
        );
        this.isSessionOperationInProgress = false;
        return false;
      }
      return true;
    }

    // Also check if waiting for API response
    if (this.isWaitingForResponse) {
      console.log("VoiceroText: Session busy - waiting for API response");
      return true;
    }

    return false;
  },

  // New helper function to ensure consistent border radius styles
  updateChatContainerBorderRadius: function (isMinimized) {
    if (!this.shadowRoot) return;

    const inputWrapper = this.shadowRoot.getElementById("chat-input-wrapper");
    if (!inputWrapper) return;

    // Get the inner container
    const innerWrapper = inputWrapper.querySelector("div");
    if (!innerWrapper) return;

    if (isMinimized) {
      // Full border radius for minimized state
      inputWrapper.style.borderRadius = "12px";
      innerWrapper.style.borderRadius = "10px";
    } else {
      // Bottom-only border radius for maximized state
      inputWrapper.style.borderRadius = "0 0 12px 12px";
      innerWrapper.style.borderRadius = "0 0 10px 10px";

      // Make sure messages container has square top corners in maximized mode
      const messagesContainer = this.shadowRoot.getElementById("chat-messages");
      if (messagesContainer) {
        messagesContainer.style.borderRadius = "0 0 0 0"; // Square corners on top
      }

      // Ensure header has square corners too
      const headerContainer = this.shadowRoot.getElementById(
        "chat-controls-header"
      );
      if (headerContainer) {
        headerContainer.style.borderRadius = "0";
      }
    }
  },

  // Ensure typing animation keyframes are in Shadow DOM
  ensureTypingAnimationInShadowDOM: function () {
    if (!this.shadowRoot) return;

    // Check if animation styles already exist
    if (!this.shadowRoot.getElementById("voicero-typing-styles")) {
      console.log("Adding typing animation keyframes to Shadow DOM");

      // Create style element for Shadow DOM
      const styleEl = document.createElement("style");
      styleEl.id = "voicero-typing-styles";
      styleEl.textContent = `
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
        
        /* Ensure the typing dots have animation styling */
        .typing-dot {
          animation: typingBounce 1s infinite;
        }
        
        .typing-dot:nth-child(2) {
          animation-delay: 0.2s;
        }
        
        .typing-dot:nth-child(3) {
          animation-delay: 0.4s;
        }
      `;

      // Add to shadow DOM
      this.shadowRoot.appendChild(styleEl);
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
