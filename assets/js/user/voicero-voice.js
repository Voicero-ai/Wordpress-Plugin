/**
 * VoiceroAI Voice Module
 * Handles voice chat functionality
 */

// Voice interface variables
const VoiceroVoice = {
  // IMPORTANT: Division of responsibilities
  // VoiceroVoice should ONLY handle the voice interface itself.
  // It should NOT manipulate:
  // 1. The interaction chooser (#interaction-chooser)
  // 2. The toggle container (#voice-toggle-container)
  // 3. The main chat button (#chat-website-button)
  //
  // These elements are managed EXCLUSIVELY by VoiceroCore.js
  // Any manipulation of these elements should happen only in VoiceroCore.js

  isRecording: false,
  audioContext: null,
  analyser: null,
  mediaRecorder: null,
  audioChunks: [],
  recordingTimeout: null,
  silenceDetectionTimer: null,
  silenceThreshold: 8, // Lower threshold to increase sensitivity (was 15)
  silenceTime: 0,
  isSpeaking: false,
  hasStartedSpeaking: false,
  currentAudioStream: null,
  isShuttingDown: false,
  manuallyStoppedRecording: false, // New flag to track if user manually stopped recording
  websiteColor: "#882be6", // Default color
  isOpeningVoiceChat: false,
  isClosingVoiceChat: false, // New flag to track close operation
  lastOpenTime: 0, // New: Track when the interface was last opened
  hasShownWelcome: false, // Flag to track if welcome message has been shown

  // Initialize the voice module
  init: function () {
    // Check if already initialized
    if (this.initialized) return;

    // Set initialized flag
    this.initialized = true;

    console.log("VoiceroVoice: Initializing");

    // Set session from VoiceroCore if available
    if (window.VoiceroCore) {
      this.session = window.VoiceroCore.session;
      this.thread = window.VoiceroCore.thread;
      this.sessionId = window.VoiceroCore.sessionId;
      this.websiteId = window.VoiceroCore.websiteId;
      this.websiteColor = window.VoiceroCore.websiteColor || "#882be6";

      // Ensure the voice interface is always maximized by default
      if (this.session && this.session.voiceOpen) {
        console.log(
          "VoiceroVoice: Ensuring voiceOpenWindowUp is true by default"
        );
        this.session.voiceOpenWindowUp = true;

        // Update window state if we have access to the method
        if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
          window.VoiceroCore.updateWindowState({
            voiceOpenWindowUp: true,
          });
        }
      }
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
        "VoiceroVoice [INIT]: Checking thread on initialization:",
        mostRecentThread
      );

      // If thread has no messages or only system messages, prepare welcome message
      if (
        !mostRecentThread.messages ||
        mostRecentThread.messages.length === 0
      ) {
        console.log(
          "VoiceroVoice [INIT]: Thread has empty messages array, forcing welcome message"
        );
        if (window.VoiceroCore.session) {
          // Force the welcome message by setting session flag directly
          window.VoiceroCore.session.voiceWelcome = true;
          // Reset internal flags
          this.hasShownWelcome = false;
          localStorage.removeItem("voicero_shown_welcome");
          if (window.VoiceroCore && window.VoiceroCore.appState) {
            window.VoiceroCore.appState.hasShownVoiceWelcome = false;
          }
        }
      } else {
        // Check if there are any non-system messages
        const nonSystemMessages = mostRecentThread.messages.filter(
          (msg) => msg.role !== "system" && msg.type !== "page_data"
        );

        if (nonSystemMessages.length === 0) {
          console.log(
            "VoiceroVoice [INIT]: Thread has only system messages, forcing welcome message"
          );
          if (window.VoiceroCore.session) {
            // Force the welcome message by setting session flag directly
            window.VoiceroCore.session.voiceWelcome = true;
            // Reset internal flags
            this.hasShownWelcome = false;
            localStorage.removeItem("voicero_shown_welcome");
            if (window.VoiceroCore && window.VoiceroCore.appState) {
              window.VoiceroCore.appState.hasShownVoiceWelcome = false;
            }
          }
        }
      }
    }

    // Set up message container references
    this.setupContainers();

    // Get website color from Core if available
    if (window.VoiceroCore) {
      // First check color directly from VoiceroCore
      if (window.VoiceroCore.websiteColor) {
        this.websiteColor = window.VoiceroCore.websiteColor;
        console.log(
          "VoiceroVoice: Using website color from VoiceroCore:",
          this.websiteColor
        );
      }
      // Then also check if there's a color in the session object
      else if (
        window.VoiceroCore.session &&
        window.VoiceroCore.session.website &&
        window.VoiceroCore.session.website.color
      ) {
        this.websiteColor = window.VoiceroCore.session.website.color;
        console.log(
          "VoiceroVoice: Using website color from session:",
          this.websiteColor
        );
      }
      // Otherwise use default color
      else {
        this.websiteColor = "#882be6";
        console.log("VoiceroVoice: Using default color:", this.websiteColor);
      }
    } else {
      // Use default color
      this.websiteColor = "#882be6";
      console.log(
        "VoiceroVoice: VoiceroCore not available, using default color:",
        this.websiteColor
      );
    }

    // Set CSS variable for theme color to ensure consistency
    document.documentElement.style.setProperty(
      "--voicero-theme-color",
      this.websiteColor
    );

    // Wait for DOM to be ready
    if (document.readyState === "loading") {
      document.addEventListener("DOMContentLoaded", () => {
        // Create the voice chat interface if it doesn't exist
        this.createVoiceChatInterface();
      });
    } else {
      // If DOM is already loaded, create interface immediately
      this.createVoiceChatInterface();
    }
  },

  // Setup container references for the voice chat interface
  setupContainers: function () {
    // Initialize references to important containers
    this.messagesContainer = document.getElementById("voice-messages");
    this.interfaceContainer = document.getElementById("voice-chat-interface");
    this.inputContainer = document.getElementById("voice-input-wrapper");

    // Log status of container initialization
    console.log("VoiceroVoice: Setting up container references");

    // If the interface doesn't exist yet, these will be null
    // They'll be properly set after createVoiceChatInterface() runs
  },

  // Create voice chat interface (HTML structure)
  createVoiceChatInterface: function () {
    // Check if the interface already exists
    if (document.getElementById("voice-chat-interface")) {
      return;
    }

    // Create style element for welcome questions and other styles
    const styleEl = document.createElement("style");
    styleEl.textContent = `
      .welcome-question {
        color: var(--voicero-theme-color, ${this.websiteColor || "#882be6"});
        text-decoration: underline !important;
        font-weight: bold !important;
        cursor: pointer !important;
      }
      
      .welcome-question:hover {
        opacity: 0.8 !important;
      }
    `;
    document.head.appendChild(styleEl);

    // Check if interface already exists
    const existingInterface = document.getElementById("voice-chat-interface");
    const existingMessagesContainer = document.getElementById("voice-messages");
    if (existingInterface && existingMessagesContainer) {
      return;
    }
    if (existingInterface && !existingMessagesContainer) {
      existingInterface.remove();
    }

    // First, let's add a specific style reset at the beginning of createVoiceChatInterface
    const resetStyle = document.createElement("style");
    resetStyle.innerHTML = `
      #voice-messages {
        padding: 18px !important; 
        padding-top: 0 !important;
        margin: 0 !important;
        background-color: #f2f2f7 !important; /* iOS light gray background */
      }

      #voice-messages::-webkit-scrollbar {
        display: none !important;
      }

      #voice-controls-header {
        margin-bottom: 15px !important;
        margin-top: 0 !important;
        background-color: #f2f2f7 !important;
        position: sticky !important;
        top: 0 !important;
        z-index: 9999999 !important;
        box-shadow: none !important;
        border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
        border-radius: 0 !important;
        width: 100% !important;
        left: 0 !important;
        right: 0 !important;

        box-sizing: border-box !important;
        margin-left: 0 !important;
        margin-right: 0 !important;
      }


      @keyframes pulseListening {
        0% { transform: scale(1); background: ${this.websiteColor}; }
        50% { transform: scale(1.1); background: ${this.adjustColor(
          this.websiteColor,
          -0.2
        )}; }
        100% { transform: scale(1); background: ${this.websiteColor}; }
      }
      
      @keyframes colorRotate {
        0% { 
          box-shadow: 0 0 20px 5px rgba(136, 43, 230, 0.7);
          background: radial-gradient(circle, rgba(136, 43, 230, 0.8) 0%, rgba(136, 43, 230, 0.4) 70%);
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
          box-shadow: 0 0 20px 5px rgba(136, 43, 230, 0.7);
          background: radial-gradient(circle, rgba(136, 43, 230, 0.8) 0%, rgba(136, 43, 230, 0.4) 70%);
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

      @keyframes thinkingDots {
        0%, 20% { content: '.'; }
        40%, 60% { content: '..'; }
        80%, 100% { content: '...'; }
      }

      .thinking-animation {
        display: inline-block;
        position: relative;
      }

      .thinking-animation::after {
        content: '';
        animation: thinkingDots 1.5s infinite;
      }

      .listening-active {
        animation: pulseListening 1.5s infinite !important;
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
        line-height: 1.4;
      }
            
      .user-message {
        display: flex;
        justify-content: flex-end;
        margin-bottom: 16px;
        position: relative;
        padding-right: 8px;
      }

      .user-message .message-content {
        background: ${this.websiteColor || "#882be6"};
        color: white;
        border-radius: 18px;
        padding: 10px 12px;
        max-width: 70%;
        word-wrap: break-word;
        font-size: 14px;
        line-height: 1.4;
        text-align: left;
        box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      }

      .ai-message {
        display: flex;
        justify-content: flex-start;
        margin-bottom: 16px;
        position: relative;
        padding-left: 8px;
      }

      .ai-message .message-content {
        background: #e5e5ea;
        color: #333;
        border-radius: 18px;
        padding: 10px 12px;
        max-width: 70%;
        word-wrap: break-word;
        font-size: 14px;
        line-height: 1.4;
        text-align: left;
        box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
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

      /* Placeholder styling for user message during transcription */
      .user-message .message-content.placeholder-loading {
        font-style: italic;
        color: rgba(255, 255, 255, 0.7);
        background: var(--voicero-theme-color, #882be6);
        opacity: 0.8;
        /* Optional: Add a subtle animation */
        animation: pulsePlaceholder 1.5s infinite ease-in-out;
      }

      @keyframes pulsePlaceholder {
        0% { opacity: 0.6; }
        50% { opacity: 0.9; }
        100% { opacity: 0.6; }
      }
    `;
    document.head.appendChild(resetStyle);

    // Create the voice interface container
    const interfaceContainer = document.createElement("div");
    interfaceContainer.id = "voice-chat-interface";
    interfaceContainer.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      width: 85%;
      max-width: 480px;
      min-width: 280px;
      display: none;
      z-index: 2147483647;
      user-select: none;
      margin: 0;
      border-radius: 0 0 12px 12px;
      box-shadow: none;
      overflow: hidden;
      background: transparent;
      border: none;
      padding: 0;
      backdropFilter: none;
      webkitBackdropFilter: none;
      opacity: 1;
    `;

    // Create messages container
    const messagesContainer = document.createElement("div");
    messagesContainer.id = "voice-messages";
    messagesContainer.setAttribute(
      "style",
      `
      background: #f2f2f7 !important;
      background-color: #f2f2f7 !important;
      border-radius: 0 !important;
      padding: 15px !important;
      padding-top: 0 !important;
      margin: 0 !important;
      max-height: 35vh;
      overflow-y: auto;
      overflow-x: hidden;
      scrollbar-width: none !important; /* Firefox */
      -ms-overflow-style: none !important; /* IE and Edge */
      box-shadow: none !important;
      position: relative;
      transition: all 0.3s ease, max-height 0.3s ease, opacity 0.3s ease, padding 0.3s ease;
      width: 100% !important;
      box-sizing: border-box !important;
    `
    );

    // Create a sticky header for controls instead of positioning them absolutely
    const controlsHeader = document.createElement("div");
    controlsHeader.id = "voice-controls-header";
    controlsHeader.setAttribute(
      "style",
      `
      position: sticky !important;
      top: 0 !important;
      left: 0 !important;
      right: 0 !important;
      height: 40px !important;
      background-color: #f2f2f7 !important;
      z-index: 9999999 !important;
      display: flex !important;
      justify-content: space-between !important;
      align-items: center !important;
      border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
      border-radius: 0 !important;
      margin: 0 !important;
      margin-bottom: 15px !important;
      width: 100% !important;
      box-shadow: none !important;
      box-sizing: border-box !important;
      margin-left: 0 !important; 
      margin-right: 0 !important;
    `
    );

    // Create clear button for the header
    const clearButton = document.createElement("button");
    clearButton.id = "clear-voice-chat";
    clearButton.setAttribute("onclick", "VoiceroVoice.clearChatHistory()");
    clearButton.setAttribute("title", "Clear Chat History");
    clearButton.style.cssText = `
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
    `;
    clearButton.innerHTML = `
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" style="margin-right: 4px;">
        <polyline points="3 6 5 6 21 6"></polyline>
        <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
      </svg>
      <span>Clear</span>
    `;
    controlsHeader.appendChild(clearButton);

    // Add status indicator to the header
    const status = document.createElement("div");
    status.id = "voicero-status";
    status.style.cssText = `
      font-size: 13px;
      font-weight: bold;
      color: #444;
      margin-left: auto;
      padding: 0 12px;
      flex-grow: 1;
      text-align: center;
      background-color: #f8f8f8;
      border-radius: 4px;
      min-width: 100px;
    `;
    status.textContent = ""; // Start empty
    controlsHeader.appendChild(status);

    // Create minimize button for the header
    const minimizeButton = document.createElement("button");
    minimizeButton.id = "minimize-voice-chat";
    // Replace onclick attribute with event listener that will be added after all buttons are created
    minimizeButton.setAttribute("title", "Minimize");
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
    minimizeButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
        <line x1="5" y1="12" x2="19" y2="12"></line>
      </svg>
    `;
    controlsHeader.appendChild(minimizeButton);

    // Create toggle button for the header (to switch to text chat)
    const toggleButton = document.createElement("button");
    toggleButton.id = "toggle-to-text-chat";
    // Replace onclick attribute with event listener that will be added after all buttons are created
    toggleButton.setAttribute("title", "Switch to Text Chat");
    toggleButton.style.cssText = `
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
    toggleButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
        <rect x="3" y="5" width="18" height="14" rx="2" ry="2"></rect>
        <path d="M14 9l-2 2-2-2"></path>
        <path d="M12 11v4"></path>
        <line x1="8" y1="16" x2="16" y2="16"></line>
      </svg>
    `;
    controlsHeader.appendChild(toggleButton);

    // Create close button for the header
    const closeButton = document.createElement("button");
    closeButton.id = "close-voice-chat";
    // Replace onclick attribute with event listener that will be added after all buttons are created
    closeButton.setAttribute("title", "Close");
    closeButton.style.cssText = `
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
    closeButton.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
        <path d="M18 6L6 18M6 6l12 12"/>
      </svg>
    `;
    controlsHeader.appendChild(closeButton);

    // Create a container for right-aligned buttons
    const rightButtonsContainer = document.createElement("div");
    rightButtonsContainer.style.cssText = `
      display: flex !important;
      gap: 5px !important;
      align-items: center !important;
      margin: 0 !important;
      padding: 0 !important;
      height: 28px !important;
    `;

    // Add loading bar
    const loadingBar = document.createElement("div");
    loadingBar.id = "voice-loading-bar";
    loadingBar.style.cssText = `
      position: absolute;
      top: 0;
      left: 0;
      height: 3px;
      width: 0%;
      background: linear-gradient(90deg, ${this.websiteColor}, #ff4444, ${this.websiteColor});
      background-size: 200% 100%;
      border-radius: 3px;
      display: none;
      animation: gradientMove 2s linear infinite;
    `;

    // Move the minimize and close buttons to the right container
    rightButtonsContainer.appendChild(minimizeButton);
    rightButtonsContainer.appendChild(toggleButton);
    rightButtonsContainer.appendChild(closeButton);
    controlsHeader.appendChild(rightButtonsContainer);

    // Add event listeners with session status checks
    minimizeButton.addEventListener("click", () => {
      // Check if session operations are in progress
      if (window.VoiceroCore && window.VoiceroCore.isSessionBusy()) {
        console.log(
          "VoiceroVoice: Minimize button click ignored - session operation in progress"
        );
        return;
      }
      VoiceroVoice.minimizeVoiceChat();
    });

    toggleButton.addEventListener("click", () => {
      // Check if session operations are in progress
      if (window.VoiceroCore && window.VoiceroCore.isSessionBusy()) {
        console.log(
          "VoiceroVoice: Toggle button click ignored - session operation in progress"
        );
        return;
      }
      VoiceroVoice.toggleToTextChat();
    });

    closeButton.addEventListener("click", () => {
      // Check if session operations are in progress
      if (window.VoiceroCore && window.VoiceroCore.isSessionBusy()) {
        console.log(
          "VoiceroVoice: Close button click ignored - session operation in progress"
        );
        return;
      }
      VoiceroVoice.closeVoiceChat();
    });

    // First add the controls header to the messages container
    messagesContainer.appendChild(loadingBar);
    messagesContainer.appendChild(controlsHeader);

    // Add a padding div similar to the text interface
    const paddingDiv = document.createElement("div");
    paddingDiv.style.cssText = `
      padding-top: 15px;
    `;
    messagesContainer.appendChild(paddingDiv);

    // Create user message div
    const userMessageDiv = document.createElement("div");
    userMessageDiv.className = "user-message";
    userMessageDiv.style.cssText = `
      margin-bottom: 15px;
      animation: fadeIn 0.3s ease forwards;
    `;
    paddingDiv.appendChild(userMessageDiv);

    // Create input container with border - for the mic button
    const inputContainer = document.createElement("div");
    inputContainer.id = "voice-input-wrapper";
    inputContainer.style.cssText = `
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
      box-shadow: none;
      width: 100%;
      box-sizing: border-box;
      margin: 0;
    `;

    // Add inner container HTML content with matching border radius
    const innerContainerHtml = `
      <button
        id="maximize-voice-chat"
        onclick="VoiceroVoice.maximizeVoiceChat()"
        style="
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: ${this.websiteColor || "#882be6"};
          border: none;
          color: white;
          padding: 10px 20px;
          border-radius: 20px 20px 0 0;
          font-size: 14px;
          font-weight: 500;
          cursor: pointer;
          display: none;
          align-items: center;
          justify-content: center;
          min-width: 160px;
          z-index: 999999;
          margin-bottom: -1px;
          height: 40px;
          overflow: visible;
          box-shadow: none;
        "
      >
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
          <polyline points="15 3 21 3 21 9"></polyline>
          <polyline points="9 21 3 21 3 15"></polyline>
          <line x1="21" y1="3" x2="14" y2="10"></line>
          <line x1="3" y1="21" x2="10" y2="14"></line>
        </svg>
        Open Voice Chat
      </button>
      <div
        style="
          display: flex;
          align-items: center;
          justify-content: center;
          background: white;
          border-radius: 0 0 10px 10px;
          padding: 10px 15px;
          height: 60px;
        "
      >
        <button
          id="voice-mic-button"
          onclick="VoiceroVoice.toggleMic()"
          style="
            width: 45px;
            height: 45px;
            border-radius: 50%;
            background: ${this.websiteColor || "#882be6"};
            border: 2px solid transparent;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: all 0.3s ease;
            box-shadow: none;
            position: relative;
            padding: 0;
          "
        >
          <svg
            id="mic-icon"
            width="24"
            height="24"
            viewBox="0 0 24 24"
            fill="none"
            stroke="white"
            stroke-width="2"
            stroke-linecap="round"
            stroke-linejoin="round"
            style="
              display: block;
              margin: auto;
              position: relative;
            "
          >
            <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
            <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
            <path d="M12 19v4"/>
            <path d="M8 23h8"/>
          </svg>
        </button>
      </div>
    `;

    // Set the inner HTML
    inputContainer.innerHTML = innerContainerHtml;

    // Assemble interface
    if (!messagesContainer) {
      return;
    }

    // Check if user and AI message divs exist
    const userMessageExists =
      messagesContainer.querySelector(".user-message") !== null;
    const aiMessageExists =
      messagesContainer.querySelector(".ai-message") !== null;

    // Add interface elements to the DOM in proper order
    interfaceContainer.appendChild(messagesContainer);
    interfaceContainer.appendChild(inputContainer);

    // Verify before adding to body

    // Add to document body
    document.body.appendChild(interfaceContainer);

    // Verify after adding to DOM
    const verifyMessagesContainer = document.getElementById("voice-messages");
    const verifyUserMessage = document.querySelector(".user-message");
    const verifyAiMessage = document.querySelector(".ai-message");

    // After creating all elements, set the padding again to override any potential changes
    setTimeout(() => {
      const messagesEl = document.getElementById("voice-messages");
      if (messagesEl) {
        messagesEl.style.padding = "15px";
        messagesEl.style.paddingTop = "0"; // Keep top padding at 0 for header
        messagesEl.style.backgroundColor = "#f2f2f7";
        messagesEl.style.width = "100%";
        messagesEl.style.boxSizing = "border-box";
        messagesEl.style.margin = "0";
      }

      // Ensure header styling is applied
      const headerEl = document.getElementById("voice-controls-header");
      if (headerEl) {
        headerEl.style.position = "sticky";
        headerEl.style.top = "0";
        headerEl.style.backgroundColor = "#f2f2f7";
        headerEl.style.zIndex = "9999999";
        headerEl.style.borderRadius = "0";
        headerEl.style.borderBottom = "1px solid rgba(0, 0, 0, 0.1)";
        headerEl.style.width = "100%";
        headerEl.style.left = "0";
        headerEl.style.right = "0";
        headerEl.style.margin = "0 0 15px 0";
        headerEl.style.boxShadow = "none";
        headerEl.style.boxSizing = "border-box";
        // headerEl.style.padding = "10px 15px";
      }

      // Ensure input wrapper styling
      const inputWrapperEl = document.getElementById("voice-input-wrapper");
      if (inputWrapperEl) {
        inputWrapperEl.style.width = "100%";
        inputWrapperEl.style.boxSizing = "border-box";
        inputWrapperEl.style.margin = "0";
        inputWrapperEl.style.borderRadius = "0 0 12px 12px";
      }

      // Ensure maximize button styling when visible
      const maximizeBtn = document.getElementById("maximize-voice-chat");
      if (maximizeBtn) {
        maximizeBtn.style.marginBottom = "-2px"; // Slight overlap with container for seamless appearance
        maximizeBtn.style.height = "40px";
        maximizeBtn.style.overflow = "visible";
        maximizeBtn.style.width = "auto"; // Allow button to size to content
        maximizeBtn.style.minWidth = "160px"; // Ensure minimum width
        maximizeBtn.style.position = "absolute";
        maximizeBtn.style.bottom = "100%";
        maximizeBtn.style.left = "50%";
        maximizeBtn.style.transform = "translateX(-50%)";
      }
    }, 100);
  },

  isOpeningVoiceChat: false,

  // Open voice chat interface
  openVoiceChat: function () {
    console.log(
      "VoiceroVoice: Opening voice chat interface - ensuring it's maximized"
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
      console.log("VoiceroVoice [INIT]: Most recent thread:", mostRecentThread);

      // If thread has no messages or only system messages, force welcome message
      if (
        !mostRecentThread.messages ||
        mostRecentThread.messages.length === 0
      ) {
        console.log(
          "VoiceroVoice [INIT]: Thread has empty messages array, forcing welcome message"
        );
        if (window.VoiceroCore.session) {
          window.VoiceroCore.session.voiceWelcome = true;
          // Reset any stored flags
          this.hasShownWelcome = false;
          localStorage.removeItem("voicero_shown_welcome");
          if (window.VoiceroCore && window.VoiceroCore.appState) {
            window.VoiceroCore.appState.hasShownVoiceWelcome = false;
          }
        }
      } else {
        // Check if there are any non-system messages
        const nonSystemMessages = mostRecentThread.messages.filter(
          (msg) => msg.role !== "system" && msg.type !== "page_data"
        );

        if (nonSystemMessages.length === 0) {
          console.log(
            "VoiceroVoice [INIT]: Thread has only system messages, forcing welcome message"
          );
          if (window.VoiceroCore.session) {
            window.VoiceroCore.session.voiceWelcome = true;
            // Reset any stored flags
            this.hasShownWelcome = false;
            localStorage.removeItem("voicero_shown_welcome");
            if (window.VoiceroCore && window.VoiceroCore.appState) {
              window.VoiceroCore.appState.hasShownVoiceWelcome = false;
            }
          }
        }
      }
    }

    // IMPORTANT: Always ensure voiceOpenWindowUp is true when opening the interface
    // It should only be set to false when the user explicitly clicks the minimize button
    if (window.VoiceroCore && window.VoiceroCore.session) {
      window.VoiceroCore.session.voiceOpenWindowUp = true;
    }

    // Continue with normal initialization
    this.syncThemeColor();

    console.log("VoiceroVoice: Opening voice chat interface");

    // Set current time to prevent reopening too quickly
    this.lastOpenTime = Date.now();

    // Set flag to prevent closing the interface too quickly
    this.isOpeningVoiceChat = true;
    this.isClosingVoiceChat = false; // Reset closing flag

    // Determine if we should show welcome message
    let shouldShowWelcome = false;

    console.log("VoiceroVoice: Checking if welcome message should be shown");

    // Check if the session already has a voiceWelcome flag set
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.voiceWelcome !== undefined
    ) {
      // Use the existing value from the session
      shouldShowWelcome = window.VoiceroCore.session.voiceWelcome;
      console.log(
        "VoiceroVoice: Using existing voiceWelcome value from session:",
        shouldShowWelcome
      );
    }
    // Only calculate a new value if session doesn't have it set
    else {
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
        console.log("VoiceroVoice: Most recent thread:", mostRecentThread);

        if (
          !mostRecentThread.messages ||
          mostRecentThread.messages.length === 0
        ) {
          console.log(
            "VoiceroVoice: Most recent thread has empty messages array, showing welcome message"
          );
          shouldShowWelcome = true;
          // FORCE the welcome message by overriding session value
          if (window.VoiceroCore && window.VoiceroCore.session) {
            window.VoiceroCore.session.voiceWelcome = true;
          }
        } else {
          console.log(
            "VoiceroVoice: Most recent thread has",
            mostRecentThread.messages.length,
            "messages"
          );
        }
      } else {
        console.log("VoiceroVoice: No threads found in session");
      }

      // If not determined by thread, use other checks
      if (!shouldShowWelcome) {
        // More comprehensive welcome message checks
        // First check localStorage
        if (localStorage.getItem("voicero_shown_welcome") === "true") {
          shouldShowWelcome = false;
          // Ensure our local flag is also set
          this.hasShownWelcome = true;
          console.log(
            "VoiceroVoice: Welcome already shown according to localStorage"
          );
        }
        // Then check our internal flag
        else if (this.hasShownWelcome) {
          shouldShowWelcome = false;
          console.log(
            "VoiceroVoice: Welcome already shown according to internal flag"
          );
        }
        // Finally check VoiceroCore state
        else if (window.VoiceroCore && window.VoiceroCore.appState) {
          // Only show welcome if we haven't shown it before
          shouldShowWelcome =
            window.VoiceroCore.appState.hasShownVoiceWelcome === undefined ||
            window.VoiceroCore.appState.hasShownVoiceWelcome === false;

          console.log(
            "VoiceroVoice: Welcome state from VoiceroCore.appState:",
            shouldShowWelcome
          );

          // Mark that we've shown the welcome message if needed
          if (shouldShowWelcome) {
            window.VoiceroCore.appState.hasShownVoiceWelcome = true;
            // Also set our internal flag for consistent tracking
            this.hasShownWelcome = true;
            // And store in localStorage for persistence
            localStorage.setItem("voicero_shown_welcome", "true");
          }
        }
      }
    }

    console.log(
      "VoiceroVoice: Final shouldShowWelcome value:",
      shouldShowWelcome
    );

    // Update window state - Always open maximized, minimize only after fully loaded if needed
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      console.log(
        "VoiceroVoice: Updating window state - voice open (maximized) with voiceWelcome:",
        shouldShowWelcome
      );
      window.VoiceroCore.updateWindowState({
        voiceOpen: true,
        voiceOpenWindowUp: true, // Always start maximized
        voiceWelcome: shouldShowWelcome, // Use value from session or calculated value
        coreOpen: false,
        textOpen: false,
        textOpenWindowUp: false,
      });
    }

    // Also update the session object directly to ensure consistency
    if (window.VoiceroCore && window.VoiceroCore.session) {
      window.VoiceroCore.session.voiceOpen = true;
      window.VoiceroCore.session.voiceOpenWindowUp = true;
    }

    // Apply consistent border radius for maximized state
    this.updateVoiceChatBorderRadius(false);

    // Close text interface if it's open
    const textInterface = document.getElementById(
      "voicero-text-chat-container"
    );
    if (textInterface && textInterface.style.display === "block") {
      if (window.VoiceroText && window.VoiceroText.closeTextChat) {
        window.VoiceroText.closeTextChat();
      } else {
        textInterface.style.display = "none";
      }
    }

    // First make sure we have created the interface
    this.createVoiceChatInterface();

    // Let VoiceroCore handle hiding buttons and chooser - we don't touch them at all

    // Show the voice interface
    const voiceInterface = document.getElementById("voice-chat-interface");
    if (voiceInterface) {
      console.log("VoiceroVoice: Displaying voice interface");
      // Position in lower middle of screen
      voiceInterface.style.cssText = `
        position: fixed !important;
        left: 50% !important;
        bottom: 20px !important;
        transform: translateX(-50%) !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 999999 !important;
        width: 85% !important;
        max-width: 480px !important;
        min-width: 280px !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        border-radius: 12px !important;
      `;
    }

    this.loadMessagesFromSession();

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
          "VoiceroVoice: Completed checking for welcome back messages"
        );
      }
    }, 500); // Check every 500ms

    // After the interface is fully loaded and visible, check if it should be minimized
    // based on the previous session state (delayed to prevent race conditions)
    setTimeout(() => {
      // We no longer auto-minimize the interface when opening
      // The interface should only be minimized when the user explicitly clicks the minimize button
      console.log(
        "VoiceroVoice: Interface opened and maximized - auto-minimize disabled"
      );

      // Just clear the opening flag
      this.isOpeningVoiceChat = false;
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
        "VoiceroVoice: Welcome back message already displayed in another interface"
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
          "VoiceroVoice: Found welcome back message during continuous check:",
          welcomeBackMessage
        );

        // Check if the message is empty or just contains whitespace
        if (!welcomeBackMessage.trim()) {
          console.log(
            "VoiceroVoice: Welcome back message is empty, not displaying"
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
          "VoiceroVoice: Welcome back message displayed, now clearing it"
        );

        // Clear the welcome back message
        if (
          window.VoiceroUserData &&
          typeof window.VoiceroUserData.clearWelcomeBackMessage === "function"
        ) {
          window.VoiceroUserData.clearWelcomeBackMessage();
          console.log(
            "VoiceroVoice: Welcome back message cleared from storage"
          );
        }

        // Clear the interval since we found the message
        if (this.welcomeBackCheckInterval) {
          clearInterval(this.welcomeBackCheckInterval);
          console.log(
            "VoiceroVoice: Stopped checking for welcome back messages after finding one"
          );
        }
      }
    }
  },

  // Minimize voice chat interface
  minimizeVoiceChat: function () {
    console.log("VoiceroVoice: Minimizing voice chat");

    // Prevent minimize if a close is in progress
    if (this.isClosingVoiceChat) {
      console.log(
        "VoiceroVoice: Skipping minimize because close is in progress"
      );
      return;
    }

    // Check if we're in the process of opening the voice chat
    if (this.isOpeningVoiceChat) {
      console.log("VoiceroVoice: Cannot minimize - currently opening");

      // Schedule another minimize attempt after opening completes
      setTimeout(() => {
        if (!this.isOpeningVoiceChat && !this.isClosingVoiceChat) {
          console.log("VoiceroVoice: Delayed minimize attempt");
          this.minimizeVoiceChat();
        }
      }, 2000);

      return; // Don't proceed with minimizing
    }

    // Update window state
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      window.VoiceroCore.updateWindowState({
        voiceOpen: true,
        voiceOpenWindowUp: false,
        coreOpen: false,
        textOpen: false,
        textOpenWindowUp: false,
      });
    }

    // Apply consistent border radius styling for minimized state
    this.updateVoiceChatBorderRadius(true);

    // Get the messages container
    const messagesContainer = document.getElementById("voice-messages");
    const headerContainer = document.getElementById("voice-controls-header");
    const inputWrapper = document.getElementById("voice-input-wrapper");
    const maximizeButton = document.getElementById("maximize-voice-chat");

    if (messagesContainer) {
      // Hide all message content
      const allMessages = messagesContainer.querySelectorAll(
        ".user-message, .ai-message"
      );
      allMessages.forEach((msg) => {
        msg.style.display = "none";
      });

      // Collapse the messages container
      messagesContainer.style.maxHeight = "0";
      messagesContainer.style.minHeight = "0";
      messagesContainer.style.height = "0";
      messagesContainer.style.opacity = "0";
      messagesContainer.style.padding = "0";
      messagesContainer.style.overflow = "hidden";
      messagesContainer.style.border = "none";
      messagesContainer.style.borderRadius = "0"; // Remove border radius
    }

    // Hide the header
    if (headerContainer) {
      headerContainer.style.display = "none";
    }

    // Adjust the input wrapper to connect with the button
    if (inputWrapper) {
      inputWrapper.style.borderRadius = "12px";
      inputWrapper.style.marginTop = "36px"; // Space for the button (slightly less than height to overlap)
    }

    // Show the maximize button
    if (maximizeButton) {
      maximizeButton.style.display = "flex";
      maximizeButton.style.zIndex = "9999999";
      maximizeButton.style.marginBottom = "-2px"; // Slight overlap to ensure connection
      maximizeButton.style.height = "40px";
      maximizeButton.style.overflow = "visible";
      maximizeButton.style.bottom = inputWrapper
        ? inputWrapper.offsetTop - 38 + "px"
        : "100%";
    }

    // Force a redraw to ensure button is visible WITHOUT hiding the interface
    const voiceInterface = document.getElementById("voice-chat-interface");
    if (voiceInterface) {
      // Ensure the interface remains visible
      voiceInterface.style.display = "block";
      voiceInterface.style.visibility = "visible";
      voiceInterface.style.opacity = "1";

      // Position the button properly
      if (maximizeButton && inputWrapper) {
        maximizeButton.style.position = "absolute";
        maximizeButton.style.bottom = "100%";
        maximizeButton.style.left = "50%";
        maximizeButton.style.transform = "translateX(-50%)";
      }
    }

    console.log("VoiceroVoice: Minimization complete");
  },

  // Maximize voice chat interface
  maximizeVoiceChat: function () {
    console.log("VoiceroVoice: Maximizing voice chat");

    // Check if we're in the process of opening or closing
    if (this.isOpeningVoiceChat || this.isClosingVoiceChat) {
      console.log(
        "VoiceroVoice: Cannot maximize - interface busy (opening or closing)"
      );
      setTimeout(() => {
        if (!this.isOpeningVoiceChat && !this.isClosingVoiceChat) {
          this.maximizeVoiceChat();
        }
      }, 1000);
      return;
    }

    // Update window state
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      window.VoiceroCore.updateWindowState({
        voiceOpen: true,
        voiceOpenWindowUp: true,
        coreOpen: false,
        textOpen: false,
        textOpenWindowUp: false,
      });
    }

    // Apply consistent border radius styling for maximized state
    this.updateVoiceChatBorderRadius(false);

    this.reopenVoiceChat();

    // Remove any voice prompts, placeholders, typing indicators, or empty message bubbles
    const messagesContainer = document.getElementById("voice-messages");
    if (messagesContainer) {
      messagesContainer
        .querySelectorAll(".voice-prompt, .placeholder, .typing-indicator")
        .forEach((el) => el.remove());
      // Remove empty message bubbles
      messagesContainer
        .querySelectorAll(".ai-message, .user-message")
        .forEach((msg) => {
          const textEl = msg.querySelector(".message-content");
          if (!textEl || !textEl.textContent.trim()) {
            msg.remove();
          }
        });
      // First immediate scroll
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      // Then scroll again after a short delay to ensure it works after any animations
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 300);
    }

    console.log("VoiceroVoice: Maximization complete");
  },

  // Close voice chat interface only - don't show anything else
  closeVoiceChat: function () {
    console.log("VoiceroVoice: Closing voice chat");

    // Set closing flag
    this.isClosingVoiceChat = true;

    // First create reliable references to the elements we need
    const voiceInterface = document.getElementById("voice-chat-interface");

    // Update window state first - this is critical
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      window.VoiceroCore.updateWindowState({
        voiceOpen: false,
        voiceOpenWindowUp: false,
        coreOpen: true, // Set coreOpen to true when closing voice chat
        textOpen: false,
        autoMic: false,
        textOpenWindowUp: false,
      });
    }

    // Hide voice interface
    if (voiceInterface) {
      voiceInterface.style.display = "none";
    }

    // Let VoiceroCore handle the button visibility
    if (window.VoiceroCore) {
      window.VoiceroCore.ensureMainButtonVisible();
    }

    // Reset closing flag
    this.isClosingVoiceChat = false;
  },

  /**
   * Toggle microphone recording
   * @param {string} source - "manual" if user clicked the mic button, "auto" if triggered programmatically (silence/timeout).
   */
  // CHANGED: added a `source = "manual"` parameter
  toggleMic: function (source = "manual") {
    const micButton = document.getElementById("voice-mic-button");
    const micIcon = document.getElementById("mic-icon");

    // If the voice chat is minimized and we're about to start recording, reopen it
    if (
      !this.isRecording &&
      VoiceroCore &&
      VoiceroCore.appState &&
      VoiceroCore.appState.isVoiceMinimized
    ) {
      this.reopenVoiceChat();
    }

    if (this.isRecording) {
      // Stop listening
      this.isRecording = false;

      // Clear status when stopping recording
      this.setStatus("");

      if (source === "manual") {
        // Turn off autoMic in session when user manually stops recording
        if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
          window.VoiceroCore.updateWindowState({
            autoMic: false,
          });
        }
      }

      // Update UI - remove siri animation
      micButton.classList.remove("siri-active");
      micButton.style.background = this.websiteColor || "#882be6";
      micButton.style.borderColor = "transparent";
      micButton.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.1)";
      micIcon.style.stroke = "white";

      // Remove the "I'm listening..." indicator if it exists
      const listeningIndicator = document.getElementById(
        "listening-indicator-message"
      );
      if (listeningIndicator) {
        listeningIndicator.remove();
      }

      // Also remove any leftover placeholders or typing indicators
      document
        .querySelectorAll(".placeholder, .typing-indicator, .voice-prompt")
        .forEach((el) => el.remove());

      // Force maximize the chat window when stopping recording
      // First update the window state to ensure it's marked as maximized
      if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
        window.VoiceroCore.updateWindowState({
          voiceOpen: true,
          voiceOpenWindowUp: true,
          isVoiceMinimized: false,
        });
      }

      // Then force maximize
      this.maximizeVoiceChat();

      // Ensure we scroll to the bottom after maximizing
      const messagesContainer = document.getElementById("voice-messages");
      if (messagesContainer) {
        // First immediate scroll
        messagesContainer.scrollTop = messagesContainer.scrollHeight;

        // Then scroll again after a short delay to ensure it works after any animations
        setTimeout(() => {
          messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }, 300);
      }

      // Rest of the existing stop listening logic
      if (this.mediaRecorder && this.mediaRecorder.state !== "inactive") {
        this.audioChunks = [];
        this.mediaRecorder.stop();
        if (this.recordingTimeout) {
          clearTimeout(this.recordingTimeout);
          this.recordingTimeout = null;
        }
        if (this.silenceDetectionTimer) {
          clearInterval(this.silenceDetectionTimer);
          this.silenceDetectionTimer = null;
        }
      }

      if (this.currentAudioStream) {
        this.currentAudioStream.getTracks().forEach((track) => track.stop());
        this.currentAudioStream = null;
      }
    } else {
      // Start listening
      this.isRecording = true;
      this.manuallyStoppedRecording = false;

      // Update status to Listening...
      this.setStatus("Listening...");
      this.addSystemMessage(
        `<div id="listening-indicator-message" class="voice-prompt">I'm listening…</div>`
      );

      if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
        window.VoiceroCore.updateWindowState({
          voiceWelcome: false, // Once user starts recording, don't show welcome again
          autoMic: false, // Set autoMic to false to remember user's preference
        });
      }

      // Reset silence detection variables
      this.silenceTime = 0;
      this.isSpeaking = false;
      this.hasStartedSpeaking = false;

      // Check if mediaDevices and getUserMedia are supported
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        this.isRecording = false;

        // Show error message
        micButton.classList.remove("siri-active");
        micButton.style.background = this.websiteColor || "#882be6";
        micButton.style.borderColor = "transparent";
        micButton.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.1)";

        this.addSystemMessage(`
          <div class="voice-prompt" style="background: #ffeded; color: #d43b3b;">
            Microphone access not supported in this browser. Try using Chrome, Firefox or Safari.
          </div>
        `);
        return;
      }

      // Check if AudioContext is supported
      const audioContextSupported = this.isAudioContextSupported();

      // Request microphone access
      navigator.mediaDevices
        .getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
            sampleRate: 44100,
            channelCount: 1,
          },
        })
        .then((stream) => {
          // Log audio track settings to help with debugging
          const audioTracks = stream.getAudioTracks();
          if (audioTracks.length > 0) {
            const settings = audioTracks[0].getSettings();
          }

          this.currentAudioStream = stream;

          // Create media recorder with higher bitrate
          this.mediaRecorder = new MediaRecorder(stream, {
            mimeType: "audio/webm;codecs=opus",
            audioBitsPerSecond: 128000,
          });
          this.audioChunks = [];

          // NOW update UI - add siri-like animation after microphone is activated
          micButton.classList.add("siri-active");
          micIcon.style.stroke = "white";

          // Update the message to "I'm listening..." now that the mic is ready
          const listeningIndicator = document.getElementById(
            "listening-indicator-message"
          );
          if (listeningIndicator) {
            listeningIndicator.textContent = "I'm listening...";
          }

          // Set up audio analysis for silence detection if supported
          if (audioContextSupported) {
            try {
              // Cross-browser compatible AudioContext initialization
              const AudioContextClass =
                window.AudioContext || window.webkitAudioContext;
              this.audioContext = new AudioContextClass();
              const source = this.audioContext.createMediaStreamSource(stream);
              this.analyser = this.audioContext.createAnalyser();
              this.analyser.fftSize = 256;
              source.connect(this.analyser);

              // Start silence detection
              const bufferLength = this.analyser.frequencyBinCount;
              const dataArray = new Uint8Array(bufferLength);

              this.silenceDetectionTimer = setInterval(() => {
                this.analyser.getByteFrequencyData(dataArray);
                // Calculate average volume
                let sum = 0;
                for (let i = 0; i < bufferLength; i++) {
                  sum += dataArray[i];
                }
                const average = sum / bufferLength;

                // Check if user is speaking
                if (average > this.silenceThreshold) {
                  this.silenceTime = 0;
                  if (!this.isSpeaking) {
                    this.isSpeaking = true;
                    this.hasStartedSpeaking = true;
                  }
                } else {
                  if (this.isSpeaking) {
                    this.silenceTime += 100; // Interval is 100ms

                    // Removed auto-stopping of recording after silence
                    // Only log the silence for debugging purposes
                    if (this.silenceTime > 500 && this.hasStartedSpeaking) {
                    }
                  }
                }
              }, 100);
            } catch (error) {}
          }

          // Handle data available event
          this.mediaRecorder.ondataavailable = (event) => {
            if (event.data.size > 0) {
              this.audioChunks.push(event.data);
            }
          };

          this.mediaRecorder.onstop = async () => {
            // Check if recording was manually stopped by the user
            if (this.manuallyStoppedRecording) {
              // Clear flag for next recording
              this.manuallyStoppedRecording = false;

              // Clean up
              if (this.currentAudioStream) {
                this.currentAudioStream
                  .getTracks()
                  .forEach((track) => track.stop());
                this.currentAudioStream = null;
              }
              // Clear audio chunks
              this.audioChunks = [];
              return; // Exit without processing audio
            }

            // Create audio blob from chunks
            const audioBlob = new Blob(this.audioChunks, {
              type: "audio/webm",
            });

            // Only process if we have actual audio data
            if (audioBlob.size > 0) {
              try {
                // Update status to Transcribing...
                this.setStatus("Transcribing...");
                this.addSystemMessage(
                  `<div id="transcribing-indicator-message" class="voice-prompt">Transcribing…</div>`
                );

                // Create form data for the audio upload
                const formData = new FormData();
                formData.append(
                  "audio",
                  new Blob(this.audioChunks, { type: "audio/webm" })
                );

                // Add additional data like session and thread IDs
                if (window.VoiceroCore && window.VoiceroCore.sessionId) {
                  formData.append("sessionId", window.VoiceroCore.sessionId);
                }

                if (this.currentThreadId) {
                  formData.append("threadId", this.currentThreadId);
                }

                if (window.VoiceroCore && window.VoiceroCore.websiteId) {
                  formData.append("websiteId", window.VoiceroCore.websiteId);
                }

                // Collect page data for better context (similar to text interface)
                const pageData = this.collectPageData();

                // Add page context data
                if (pageData) {
                  formData.append("pageContext", JSON.stringify(pageData));
                }

                // Make the upload request to voice API through WordPress proxy
                const whisperResponse = await fetch(
                  "/wp-json/voicero/v1/whisper",
                  {
                    method: "POST",
                    headers: {
                      ...(window.voiceroConfig?.getAuthHeaders
                        ? window.voiceroConfig.getAuthHeaders()
                        : {}),
                    },
                    body: formData,
                  }
                );

                if (!whisperResponse.ok) {
                  let errorText;
                  try {
                    const errorData = await whisperResponse.json();
                    errorText = JSON.stringify(errorData);
                  } catch (e) {
                    // If JSON parsing fails, get text response instead
                    errorText = await whisperResponse.text();
                  }

                  throw new Error(
                    `Whisper API request failed with status ${whisperResponse.status}`
                  );
                }

                const whisperData = await whisperResponse.json();

                // Extract the transcription - ensure we get a string
                const transcription =
                  whisperData.transcription ||
                  (whisperData.text && typeof whisperData.text === "string"
                    ? whisperData.text
                    : typeof whisperData === "object" && whisperData.text
                    ? whisperData.text
                    : "Could not transcribe audio");

                // Update status to indicate transcription is complete
                this.setStatus("");

                // CHECK IF TRANSCRIPTION IS MEANINGFUL
                // If Whisper returns an empty string, very short nonsense, or the default error message, don't process further
                if (
                  !transcription ||
                  transcription.trim() === "" ||
                  transcription === "Could not transcribe audio" ||
                  transcription.length < 2
                ) {
                  console.log(
                    "Voice interface: Empty or invalid transcription detected, stopping processing"
                  );
                  // Show a message to the user that nothing was heard
                  this.addSystemMessage(`
                    <div class="voice-prompt" style="background: #e5e5ea; color: #666;">
                      I didn't hear anything. Please try speaking again.
                    </div>
                  `);
                  return;
                }

                // Additional checks for nonsensical transcriptions
                const cleanedTranscription = transcription.trim();
                const wordCount = cleanedTranscription.split(/\s+/).length;

                // Common patterns of random noise transcriptions
                const appearsToBeForeignOrNonsense = (text) => {
                  // Check for transcripts that are just a few random characters
                  if (
                    text.length < 5 &&
                    !/^(hi|hey|yo|yes|no|ok)$/i.test(text)
                  ) {
                    return true;
                  }

                  // Check for very short transcripts that don't form common words or questions
                  if (
                    wordCount <= 2 &&
                    text.length < 12 &&
                    !/(hi|hey|yo|yes|no|ok|what|who|when|where|why|how|can|help|thanks|is|are)/i.test(
                      text
                    )
                  ) {
                    return true;
                  }

                  // Check for random character sequences often produced with background noise
                  if (
                    /^[a-z]{1,2}[aeiou]{1,2}[a-z]{1,2}$/i.test(text) ||
                    /^[^a-z0-9\s]{3,}$/i.test(text)
                  ) {
                    return true;
                  }

                  return false;
                };

                if (appearsToBeForeignOrNonsense(cleanedTranscription)) {
                  console.log(
                    "Voice interface: Nonsensical transcription detected:",
                    cleanedTranscription
                  );

                  return;
                }

                const transEl = document.getElementById(
                  "transcribing-indicator-message"
                );
                if (transEl) transEl.remove();

                // MOVED: Build the request payload BEFORE adding the message to UI
                // Now send the transcription to the Shopify chat endpoint
                const requestBody = {
                  message: transcription,
                  type: "voice",
                  threadId:
                    this.currentThreadId ||
                    (window.VoiceroCore &&
                    window.VoiceroCore.thread &&
                    window.VoiceroCore.thread.threadId
                      ? window.VoiceroCore.thread.threadId
                      : null),
                  websiteId:
                    window.VoiceroCore && window.VoiceroCore.websiteId
                      ? window.VoiceroCore.websiteId
                      : null,
                  currentPageUrl: window.location.href,
                  pageData: this.collectPageData(),
                  pastContext: this.getPastContext(),
                };

                // Add the user message with transcription (MOVED: after building requestBody)
                this.addMessage(transcription, "user");
                if (window.VoiceroCore && VoiceroCore.appState) {
                  VoiceroCore.appState.voiceMessages =
                    VoiceroCore.appState.voiceMessages || {};
                  VoiceroCore.appState.voiceMessages.user = transcription;
                  if (typeof VoiceroCore.saveState === "function") {
                    VoiceroCore.saveState();
                  }
                }

                // Mark that first conversation has occurred
                if (VoiceroCore && VoiceroCore.appState) {
                  VoiceroCore.appState.hasHadFirstConversation = true;
                  if (
                    VoiceroCore.saveState &&
                    typeof VoiceroCore.saveState === "function"
                  ) {
                    VoiceroCore.saveState();
                  }
                }

                // Show typing indicator instead of text placeholder
                this.addTypingIndicator();

                // Log the request body for debugging
                console.log(
                  "[VOICERO VOICE] Sending to /chat:",
                  JSON.stringify(requestBody, null, 2)
                );

                // Try WordPress proxy for the /shopify/chat route
                const chatResponse = await fetch(
                  "/wp-json/voicero/v1/wordpress/chat",
                  {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      Accept: "application/json",
                      ...(window.voiceroConfig?.getAuthHeaders
                        ? window.voiceroConfig.getAuthHeaders()
                        : {}),
                    },
                    body: JSON.stringify(requestBody),
                  }
                );

                if (!chatResponse.ok) {
                  let errorText;
                  try {
                    const errorData = await chatResponse.json();
                    errorText = JSON.stringify(errorData);
                  } catch (e) {
                    // If JSON parsing fails, get text response instead
                    errorText = await chatResponse.text();
                  }

                  throw new Error(
                    `Chat API request failed with status ${chatResponse.status}`
                  );
                }

                const chatData = await chatResponse.json();

                // Log the response data for debugging
                console.log(
                  "[VOICERO VOICE] Received from /chat:",
                  JSON.stringify(chatData, null, 2)
                );

                // Store thread ID from response
                if (chatData.threadId) {
                  this.currentThreadId = chatData.threadId;

                  // Update VoiceroCore thread reference if available
                  if (
                    window.VoiceroCore &&
                    window.VoiceroCore.session &&
                    window.VoiceroCore.session.threads
                  ) {
                    // Find the matching thread in the threads array
                    const matchingThread =
                      window.VoiceroCore.session.threads.find(
                        (thread) => thread.threadId === chatData.threadId
                      );

                    if (matchingThread) {
                      // Update VoiceroCore.thread reference
                      window.VoiceroCore.thread = matchingThread;
                    }
                  }

                  // Update window state to save the thread ID
                  if (
                    window.VoiceroCore &&
                    window.VoiceroCore.updateWindowState
                  ) {
                    window.VoiceroCore.updateWindowState({
                      voiceWelcome: false,
                      threadId: chatData.threadId,
                    });
                  }
                }

                // Get the text response - now properly handling JSON response formats
                let aiTextResponse = "";
                let actionType = null;
                let actionUrl = null;
                let actionContext = null;

                try {
                  // First check if the response is already an object
                  if (
                    typeof chatData.response === "object" &&
                    chatData.response !== null
                  ) {
                    aiTextResponse =
                      chatData.response.answer ||
                      "Sorry, I don't have a response.";
                    actionType = chatData.response.action || null;

                    // Check for action_context first (new format)
                    if (chatData.response.action_context) {
                      actionContext = chatData.response.action_context;

                      // If it's a redirect action, get the URL from action_context
                      if (actionType === "redirect" && actionContext.url) {
                        actionUrl = actionContext.url;
                      }
                    }

                    // Fallback to old format if no URL found in action_context
                    if (!actionUrl) {
                      actionUrl = chatData.response.url || null;
                    }
                  }
                  // Then try to parse the response as JSON if it's a string
                  else if (typeof chatData.response === "string") {
                    try {
                      const parsedResponse = JSON.parse(chatData.response);
                      aiTextResponse =
                        parsedResponse.answer ||
                        "Sorry, I don't have a response.";
                      actionType = parsedResponse.action || null;

                      // Check for action_context first (new format)
                      if (parsedResponse.action_context) {
                        actionContext = parsedResponse.action_context;

                        // If it's a redirect action, get the URL from action_context
                        if (actionType === "redirect" && actionContext.url) {
                          actionUrl = actionContext.url;
                        }
                      }

                      // Fallback to old format if no URL found in action_context
                      if (!actionUrl) {
                        actionUrl = parsedResponse.url || null;
                      }
                    } catch (e) {
                      // If parsing fails, use the response as is
                      aiTextResponse =
                        chatData.response || "Sorry, I don't have a response.";
                    }
                  } else {
                    // Fallback
                    aiTextResponse =
                      chatData.response || "Sorry, I don't have a response.";
                  }
                } catch (error) {
                  aiTextResponse = "Sorry, I don't have a response.";
                }

                // Process text to extract and clean URLs - making sure we have a string
                if (typeof aiTextResponse !== "string") {
                  aiTextResponse = String(aiTextResponse);
                }

                // Remove duplicate action handler call - will only handle actions after audio completes
                // Also use VoiceroActionHandler if available
                // if (
                //   chatData.response &&
                //   window.VoiceroActionHandler &&
                //   typeof window.VoiceroActionHandler.handle === "function"
                // ) {
                //   window.VoiceroActionHandler.handle(chatData.response);
                // }

                // Process text to extract and clean URLs
                const processedResponse =
                  this.extractAndCleanUrls(aiTextResponse);
                const cleanedTextResponse = processedResponse.text;
                const extractedUrls = processedResponse.urls;

                try {
                  // Request audio generation using TTS endpoint through WordPress proxy
                  const ttsResponse = await fetch("/wp-json/voicero/v1/tts", {
                    method: "POST",
                    headers: {
                      "Content-Type": "application/json",
                      ...(window.voiceroConfig?.getAuthHeaders
                        ? window.voiceroConfig.getAuthHeaders()
                        : {}),
                    },
                    body: JSON.stringify({
                      text: cleanedTextResponse, // Send cleaned text to TTS
                    }),
                  });

                  if (!ttsResponse.ok) {
                    let details;
                    try {
                      details = JSON.stringify(await ttsResponse.json());
                    } catch {
                      details = await ttsResponse.text();
                    }
                    throw new Error(
                      `TTS request failed (${
                        ttsResponse.status
                      }): ${details.substring(0, 200)}`
                    );
                  }

                  // Remove typing indicator before adding the real response
                  this.removeTypingIndicator();

                  // IMPORTANT: Add flag to track if we've added the message
                  let messageAdded = false;

                  // Update AI message with cleaned text content
                  this.addMessage(cleanedTextResponse, "ai");
                  messageAdded = true;

                  const listenEl = document.getElementById(
                    "listening-indicator-message"
                  );
                  if (listenEl) listenEl.remove();
                  const transEl = document.getElementById(
                    "transcribing-indicator-message"
                  );
                  if (transEl) transEl.remove();

                  // Store in state
                  if (VoiceroCore && VoiceroCore.appState) {
                    // Initialize voiceMessages if it doesn't exist
                    if (!VoiceroCore.appState.voiceMessages) {
                      VoiceroCore.appState.voiceMessages = {};
                    }
                    VoiceroCore.appState.voiceMessages.ai = cleanedTextResponse;
                    if (
                      VoiceroCore.saveState &&
                      typeof VoiceroCore.saveState === "function"
                    ) {
                      VoiceroCore.saveState();
                    }
                  }

                  const contentType = ttsResponse.headers.get("Content-Type");
                  let audio;

                  if (contentType && contentType.includes("audio/")) {
                    // Handle binary audio response
                    const audioBlob = await ttsResponse.blob();
                    const audioUrl = URL.createObjectURL(audioBlob);
                    audio = new Audio(audioUrl);
                  } else {
                    // Handle JSON response with URL
                    const responseData = await ttsResponse.json();
                    const { success, url } = responseData;

                    if (!success || !url) {
                      throw new Error("Malformed TTS response (no URL)");
                    }

                    // Play the audio response from the URL
                    audio = new Audio(url);
                  }

                  // Create a promise to handle audio completion
                  const audioPlaybackPromise = new Promise((resolve) => {
                    audio.addEventListener("ended", () => {
                      resolve();
                    });

                    // Also handle errors in playback by resolving
                    audio.addEventListener("error", (e) => {
                      console.warn(
                        "Audio playback error - continuing with actions anyway",
                        e.error || e
                      );
                      resolve();
                    });
                  });

                  // Start audio playback - with better mobile support
                  try {
                    // iOS Safari and many mobile browsers require user interaction
                    // Check if it's a mobile device
                    const isMobile = /iPhone|iPad|iPod|Android/i.test(
                      navigator.userAgent
                    );

                    if (isMobile) {
                      console.log(
                        "[VOICERO VOICE] Mobile device detected, using special audio playback approach"
                      );

                      // For iOS, we need to set these properties before play()
                      audio.setAttribute("playsinline", "true");
                      audio.muted = false;
                      audio.volume = 1.0;

                      // Create and use AudioContext (which often works better on mobile)
                      try {
                        const AudioContextClass =
                          window.AudioContext || window.webkitAudioContext;
                        if (AudioContextClass) {
                          const audioCtx = new AudioContextClass();

                          // This helps "wake up" the audio context on iOS
                          if (audioCtx.state === "suspended") {
                            audioCtx.resume();
                          }
                        }
                      } catch (audioCtxErr) {
                        console.warn(
                          "[VOICERO VOICE] Failed to initialize AudioContext for mobile",
                          audioCtxErr
                        );
                      }
                    }

                    // Now attempt to play with detailed error reporting
                    await audio.play().catch((err) => {
                      console.error(
                        "[VOICERO VOICE] Audio play() failed:",
                        err
                      );
                      // For autoplay blocked errors, we should show a message to the user
                      if (
                        err.name === "NotAllowedError" ||
                        err.message?.includes("user gesture")
                      ) {
                        console.warn(
                          "[VOICERO VOICE] Autoplay blocked by browser policy"
                        );
                        // Add a note to the message that audio is not available
                        const messagesContainer =
                          document.getElementById("voice-messages");
                        if (messagesContainer) {
                          const notification = document.createElement("div");
                          notification.className = "voice-prompt";
                          notification.style.cssText =
                            "background: #fff8e1; color: #856404; margin-top: 8px;";
                          notification.innerHTML =
                            "Audio playback is not available. Enable audio in your browser settings.";
                          messagesContainer.appendChild(notification);
                          messagesContainer.scrollTop =
                            messagesContainer.scrollHeight;
                        }
                      }
                      // Let the promise resolve even on error
                      throw err;
                    });
                  } catch (playError) {
                    console.error(
                      "[VOICERO VOICE] Failed to play audio:",
                      playError
                    );
                    // Continue anyway
                  }

                  // Wait for audio to complete playing before proceeding
                  await audioPlaybackPromise;

                  // Handle contact action if present
                  if (
                    actionType === "contact" &&
                    (actionContext?.contact_help_form === true ||
                      actionContext?.contact === true)
                  ) {
                    console.log(
                      "[VOICERO VOICE] Contact action detected, showing contact form"
                    );

                    // Skip adding the AI message again since it was already added by the TTS code above
                    // Just make sure typing indicator is removed
                    this.removeTypingIndicator();

                    // Then show contact form with a delay to ensure DOM is ready
                    setTimeout(() => {
                      if (
                        window.VoiceroContact &&
                        typeof window.VoiceroContact.showContactForm ===
                          "function"
                      ) {
                        try {
                          window.VoiceroContact.showContactForm();
                        } catch (err) {
                          console.error(
                            "[VOICERO VOICE] Failed to show contact form:",
                            err
                          );
                        }
                      } else {
                        console.error(
                          "[VOICERO VOICE] VoiceroContact.showContactForm not available"
                        );
                      }
                    }, 500);

                    return; // Exit early to prevent duplicate processing
                  }

                  // Handle actions ONLY AFTER audio playback completes
                  if (window.VoiceroActionHandler) {
                    try {
                      // Let VoiceroActionHandler handle all actions including redirects
                      window.VoiceroActionHandler.handle(
                        chatData.response ?? chatData
                      );
                    } catch (err) {
                      // console.error("VoiceroActionHandler error:", err);
                    }
                  }
                } catch (audioError) {
                  // Remove typing indicator before adding the error message
                  this.removeTypingIndicator();

                  // Check if a message was already added in the try block
                  if (!messageAdded) {
                    // Only show the text response if it wasn't already added and audio fails
                    this.addMessage(cleanedTextResponse, "ai");
                  }

                  const listenEl = document.getElementById(
                    "listening-indicator-message"
                  );
                  if (listenEl) listenEl.remove();
                  const transEl = document.getElementById(
                    "transcribing-indicator-message"
                  );
                  if (transEl) transEl.remove();

                  // Store in state
                  if (VoiceroCore && VoiceroCore.appState) {
                    if (!VoiceroCore.appState.voiceMessages) {
                      VoiceroCore.appState.voiceMessages = {};
                    }
                    VoiceroCore.appState.voiceMessages.ai = cleanedTextResponse;
                    if (
                      VoiceroCore.saveState &&
                      typeof VoiceroCore.saveState === "function"
                    ) {
                      VoiceroCore.saveState();
                    }
                  }
                }
              } catch (error) {
                // Log the error for debugging
                console.error("Voice processing error:", error);

                // Check if we already have a successful AI response message
                const existingSuccessMessage = document.querySelector(
                  "#voice-chat-interface .ai-message:not(.placeholder):not(.typing-wrapper)"
                );

                // Only show error if we don't have a successful message already
                if (!existingSuccessMessage) {
                  // Remove any placeholder messages
                  const messagesContainer =
                    document.getElementById("voice-messages");
                  if (messagesContainer) {
                    const placeholders = messagesContainer.querySelectorAll(
                      ".ai-message.placeholder"
                    );
                    placeholders.forEach((el) => el.remove());
                  }

                  // Update AI message with error
                  const aiMessageDiv = document.querySelector(
                    "#voice-chat-interface .ai-message"
                  );
                  if (aiMessageDiv) {
                    aiMessageDiv.textContent =
                      "Sorry, I encountered an error processing your audio.";
                  }
                }
              }
            } else {
            }

            // Clean up
            if (this.currentAudioStream) {
              this.currentAudioStream
                .getTracks()
                .forEach((track) => track.stop());
              this.currentAudioStream = null;
            }

            // Clean up audio context
            if (this.audioContext) {
              this.audioContext
                .close()
                .then(() => {
                  this.audioContext = null;
                  this.analyser = null;
                })
                .catch((err) => {
                  this.audioContext = null;
                  this.analyser = null;
                });
            }
          };

          // Start the audio capture
          this.mediaRecorder.start();
          this.isRecording = true;

          // Set a timeout to automatically end the conversation after 30 seconds
          this.recordingTimeout = setTimeout(() => {
            if (
              this.isRecording &&
              this.mediaRecorder &&
              this.mediaRecorder.state !== "inactive"
            ) {
              // CHANGED: pass "auto" to differentiate from user stop
              this.toggleMic("auto"); // End the conversation
            }
          }, 30000); // 30 seconds
        })
        .catch((error) => {
          // Reset UI
          micButton.classList.remove("siri-active");
          micButton.style.background = this.websiteColor || "#882be6";
          micButton.style.borderColor = "transparent";
          micButton.style.boxShadow = "0 4px 15px rgba(0, 0, 0, 0.1)";
          this.isRecording = false;

          // Show error message in the voice interface
          this.addSystemMessage(`
            <div class="voice-prompt" style="background: #ffeded; color: #d43b3b;">
              Please allow microphone access to use voice chat.
            </div>
          `);
        });
    }
  },

  // Improved audio playback function with fallback methods
  playAudioResponse: async function (audioBlob) {
    return new Promise((resolve, reject) => {
      try {
        // Create a properly typed blob to ensure browser compatibility
        // Some browsers are stricter about MIME types, so let's ensure we use the exact correct one
        const properBlob = new Blob([audioBlob], {
          type: audioBlob.type || "audio/mpeg",
        });

        // Track if playback has been successful with any method
        let playbackSucceeded = false;

        // Try using the Web Audio API for better browser support first
        this.playWithWebAudio(properBlob, resolve)
          .then(() => {
            playbackSucceeded = true;
            resolve();
          })
          .catch((error) => {
            tryFallbackMethod();
          });

        // Check if AudioContext is supported and try it first
        function tryAudioContext() {
          const AudioContextClass =
            window.AudioContext || window.webkitAudioContext;

          if (AudioContextClass) {
            const audioContext = new AudioContextClass();
            const fileReader = new FileReader();

            fileReader.onload = function () {
              const arrayBuffer = this.result;

              // Decode the audio data
              audioContext.decodeAudioData(
                arrayBuffer,
                function (buffer) {
                  // Create a source node
                  const source = audioContext.createBufferSource();
                  source.buffer = buffer;

                  // Connect to destination (speakers)
                  source.connect(audioContext.destination);

                  // Play the audio
                  source.onended = function () {
                    playbackSucceeded = true;
                    resolve();
                  };

                  source.start(0);
                },
                function (error) {
                  // Always fall back to the Audio element method when decoding fails
                  tryFallbackMethod();
                }
              );
            };

            fileReader.onerror = function () {
              tryFallbackMethod();
            };

            // Read the blob as an array buffer
            fileReader.readAsArrayBuffer(properBlob);
            return true;
          }

          return false;
        }

        // Fallback method using Audio element (less reliable but simpler)
        function tryFallbackMethod() {
          const audio = new Audio();

          // Add event listeners
          audio.onloadedmetadata = () => {};

          audio.onended = () => {
            if (audio.src && audio.src.startsWith("blob:")) {
              URL.revokeObjectURL(audio.src);
            }
            resolve();
          };

          audio.onerror = (error) => {
            // Try alternative audio format as last resort
            tryMP3Fallback();

            // Clean up and resolve anyway to continue with the conversation
            if (audio.src && audio.src.startsWith("blob:")) {
              URL.revokeObjectURL(audio.src);
            }
            resolve(); // Resolve instead of reject to continue with the conversation
          };

          // Create a blob URL
          const audioUrl = URL.createObjectURL(properBlob);

          audio.src = audioUrl;

          // Start playback
          audio
            .play()
            .then(() => {})
            .catch((err) => {
              // Try MP3 fallback as last resort
              tryMP3Fallback();

              if (audio.src && audio.src.startsWith("blob:")) {
                URL.revokeObjectURL(audio.src);
              }
              resolve(); // Resolve instead of reject to continue with the conversation
            });
        }

        // Last resort fallback for browsers with limited codec support
        function tryMP3Fallback() {
          // Try multiple formats to see if any works
          tryFormat("audio/mpeg");

          function tryFormat(mimeType) {
            // Force specific MIME type
            const formatBlob = new Blob([audioBlob], { type: mimeType });
            const formatAudio = new Audio();
            const formatUrl = URL.createObjectURL(formatBlob);

            formatAudio.src = formatUrl;
            formatAudio.onended = () => {
              URL.revokeObjectURL(formatUrl);
            };

            formatAudio.onerror = () => {
              URL.revokeObjectURL(formatUrl);

              // Try wav format if mp3 fails
              if (mimeType === "audio/mpeg") {
                tryFormat("audio/wav");
              } else if (mimeType === "audio/wav") {
                // Try ogg as last resort
                tryFormat("audio/ogg");
              } else {
              }
            };

            formatAudio.play().catch((err) => {
              URL.revokeObjectURL(formatUrl);

              // Try next format when current fails to play
              if (mimeType === "audio/mpeg") {
                tryFormat("audio/wav");
              } else if (mimeType === "audio/wav") {
                tryFormat("audio/ogg");
              }
            });
          }
        }
      } catch (error) {
        resolve(); // Resolve instead of reject to continue with the conversation
      }
    });
  },

  // Helper method to play audio using WebAudio API with better format support
  playWithWebAudio: async function (audioBlob, resolve) {
    return new Promise(async (resolve, reject) => {
      try {
        // Debug: Check the first few bytes to verify it's a valid audio file
        // MP3 files typically start with ID3 (49 44 33) or MPEG frame sync (FF Ex)
        const arrayBuffer = await audioBlob.arrayBuffer();
        const byteView = new Uint8Array(arrayBuffer);
        const firstBytes = byteView.slice(0, 16);

        let byteString = Array.from(firstBytes)
          .map((b) => b.toString(16).padStart(2, "0"))
          .join(" ");

        // Check for valid MP3 signatures
        const isID3 =
          firstBytes[0] === 0x49 &&
          firstBytes[1] === 0x44 &&
          firstBytes[2] === 0x33;
        const isMPEGFrameSync =
          firstBytes[0] === 0xff && (firstBytes[1] & 0xe0) === 0xe0;

        if (!isID3 && !isMPEGFrameSync) {
        } else {
        }

        const AudioContextClass =
          window.AudioContext || window.webkitAudioContext;
        if (!AudioContextClass) {
          return reject(new Error("AudioContext not supported"));
        }

        const context = new AudioContextClass();

        // Use the arrayBuffer we already loaded
        // Try to decode
        context.decodeAudioData(
          arrayBuffer,
          (buffer) => {
            // Get the actual duration of the audio
            const audioDuration = buffer.duration * 1000; // Convert to milliseconds

            const source = context.createBufferSource();
            source.buffer = buffer;
            source.connect(context.destination);

            source.onended = () => {
              context.close().catch(() => {});
              // Store the audio duration in a global variable for the redirect logic
              if (window.VoiceroVoice) {
                window.VoiceroVoice.lastAudioDuration = audioDuration;
              }
              resolve();
            };

            source.start(0);
          },
          (err) => {
            context.close().catch(() => {});
            reject(err);
          }
        );
      } catch (err) {
        reject(err);
      }
    });
  },

  // Extract URLs from text and clean the text
  extractAndCleanUrls: function (text) {
    // Store extracted URLs
    const extractedUrls = [];

    // Format currency for better TTS pronunciation
    text = this.formatCurrencyForSpeech(text);

    // First handle markdown-style links [text](url)
    const markdownRegex = /\[([^\]]+)\]\(([^)]+)\)/g;
    let markdownMatch;
    let cleanedText = text;

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

    const textWithoutMarkdown = cleanedText;
    while ((match = urlRegex.exec(textWithoutMarkdown)) !== null) {
      let url = match[0];
      // Remove trailing punctuation that might have been included
      url = url.replace(/[.,;:!?)]+$/, "");
      try {
        const formattedUrl = url.startsWith("http") ? url : `https://${url}`;
        new URL(formattedUrl);
        if (!extractedUrls.includes(formattedUrl)) {
          extractedUrls.push(formattedUrl);
        }
      } catch (e) {}
    }

    // Replace URL patterns with natural language alternatives
    cleanedText = cleanedText.replace(
      /check out (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
      "check it out"
    );
    cleanedText = cleanedText.replace(
      /at (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
      "here"
    );
    cleanedText = cleanedText.replace(
      /here: (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
      "here"
    );
    cleanedText = cleanedText.replace(
      /at this link: (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
      "here"
    );
    cleanedText = cleanedText.replace(
      /visit (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
      "visit this page"
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

  // Get past conversation context for AI
  getPastContext: function () {
    // Initialize empty context array
    const context = [];

    // Try to get thread messages from session - approach similar to text interface
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
      const recentThread = sortedThreads[0];

      console.log("🔍 getPastContext(): Using recent thread", recentThread);

      // Check if this thread has messages
      if (
        recentThread &&
        recentThread.messages &&
        recentThread.messages.length > 0
      ) {
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

        console.log(
          "✅ getPastContext(): Found messages in thread",
          lastMessages.length
        );

        // Map messages to required format for API
        return lastMessages.map((msg) => {
          if (msg.role === "user") {
            return {
              question: msg.content,
              role: "user",
              createdAt: msg.createdAt,
              pageUrl: msg.pageUrl || window.location.href,
              id: msg.id,
              threadId: msg.threadId || recentThread.threadId,
            };
          } else {
            // For assistant messages, try to extract answer from JSON if needed
            let content = msg.content;
            try {
              const parsed = JSON.parse(content);
              if (parsed && parsed.answer) {
                content = parsed.answer;
              }
            } catch (e) {
              // If parsing fails, use content as is
            }

            return {
              answer: content,
              role: "assistant",
              createdAt: msg.createdAt,
              id: msg.id,
              threadId: msg.threadId || recentThread.threadId,
            };
          }
        });
      }
    }

    // Fallback to VoiceroCore.thread if available
    if (
      window.VoiceroCore &&
      window.VoiceroCore.thread &&
      window.VoiceroCore.thread.messages
    ) {
      console.log("🔄 getPastContext(): Falling back to VoiceroCore.thread");
      const msgs = [...window.VoiceroCore.thread.messages].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );
      const userMsgs = msgs.filter((m) => m.role === "user").slice(-5);
      const aiMsgs = msgs.filter((m) => m.role === "assistant").slice(-5);
      const last = [...userMsgs, ...aiMsgs].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );

      return last.map((msg) => {
        if (msg.role === "user") {
          return {
            question: msg.content,
            role: "user",
            createdAt: msg.createdAt,
            pageUrl: msg.pageUrl || window.location.href,
            id: msg.id,
            threadId: msg.threadId,
          };
        } else {
          let content = msg.content;
          try {
            const p = JSON.parse(content);
            if (p.answer) content = p.answer;
          } catch {}
          return {
            answer: content,
            role: "assistant",
            createdAt: msg.createdAt,
            id: msg.id,
            threadId: msg.threadId,
          };
        }
      });
    }

    // Last fallback to appState.voiceMessages (for very first messages)
    if (
      window.VoiceroCore &&
      window.VoiceroCore.appState &&
      window.VoiceroCore.appState.voiceMessages
    ) {
      console.log(
        "⚠️ getPastContext(): Falling back to appState.voiceMessages"
      );
      const voiceMessages = window.VoiceroCore.appState.voiceMessages || {};

      if (voiceMessages.user) {
        context.push({
          question: voiceMessages.user,
          role: "user",
          createdAt: new Date().toISOString(),
          pageUrl: window.location.href,
          id: this.generateId(),
        });
      }
      if (voiceMessages.ai) {
        context.push({
          answer: voiceMessages.ai,
          role: "assistant",
          createdAt: new Date().toISOString(),
          id: this.generateId(),
        });
      }
    }

    console.log("💬 getPastContext(): Final context", context);
    return context;
  },

  // Generate a unique ID for messages (copied from voicero-text implementation)
  generateId: function () {
    return (
      "msg_" +
      Date.now().toString(36) +
      "_" +
      Math.random().toString(36).substr(2, 9)
    );
  },

  // Check if AudioContext is supported
  isAudioContextSupported: function () {
    return !!(window.AudioContext || window.webkitAudioContext);
  },

  // Add typing indicator
  addTypingIndicator: function () {
    const messagesContainer = document.getElementById("voice-messages");
    if (!messagesContainer) {
      return;
    }

    // Get send button if it exists
    const sendButton = document.getElementById("voice-send-button");

    // Always use VoiceroWait if available
    if (window.VoiceroWait) {
      // Add loading animation to send button if it exists
      if (sendButton) {
        window.VoiceroWait.addLoadingAnimation(sendButton);
      }

      // Show typing indicator in messages container
      return window.VoiceroWait.showTypingIndicator(messagesContainer);
    } else {
      // Fallback implementation if VoiceroWait is not available
      console.error(
        "VoiceroWait module not found. Basic fallback implemented."
      );

      // Add animation to send button if it exists
      if (sendButton) {
        sendButton.classList.add("siri-active");
      }

      // First remove any existing indicators
      this.removeTypingIndicator();

      // Create a basic wrapper (no inline styles, using CSS classes)
      const wrapper = document.createElement("div");
      wrapper.className = "ai-message typing-wrapper";

      // Create indicator container (no inline styles, using CSS classes)
      const indicator = document.createElement("div");
      indicator.className = "typing-indicator";
      indicator.id = "voice-typing-indicator";

      // Create the three dots (no inline styles, using CSS classes)
      for (let i = 0; i < 3; i++) {
        const dot = document.createElement("div");
        dot.className = "typing-dot";
        // Add delay classes instead of inline styles
        if (i === 1) dot.classList.add("typing-dot-delay-1");
        if (i === 2) dot.classList.add("typing-dot-delay-2");
        indicator.appendChild(dot);
      }

      wrapper.appendChild(indicator);
      messagesContainer.appendChild(wrapper);
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
      return indicator;
    }
  },

  // Remove typing indicator
  removeTypingIndicator: function () {
    // Get send button if it exists
    const sendButton = document.getElementById("voice-send-button");

    // Use VoiceroWait if available
    if (window.VoiceroWait) {
      // Hide typing indicator
      window.VoiceroWait.hideTypingIndicator();

      // Remove loading animation from send button
      if (sendButton) {
        window.VoiceroWait.removeLoadingAnimation(sendButton);
      }

      return;
    }

    // Fallback implementation if VoiceroWait is not available
    // Remove both the indicator itself and any typing wrapper
    const indicator = document.getElementById("voice-typing-indicator");
    if (indicator) {
      // If indicator is inside a wrapper, remove the wrapper instead
      const wrapper = indicator.closest(".typing-wrapper");
      if (wrapper) {
        wrapper.parentNode.removeChild(wrapper);
      } else {
        indicator.parentNode.removeChild(indicator);
      }
    }

    // Also remove any typing-wrapper elements that might exist
    const typingElements = document.querySelectorAll(".typing-wrapper");
    typingElements.forEach((el) => el.remove());

    // Remove animation from send button
    if (sendButton) {
      sendButton.classList.remove("siri-active");
    }
  },

  // Add message to the voice chat
  addMessage: function (content, role, formatMarkdown = false) {
    let messagesContainer = document.getElementById("voice-messages");
    if (!messagesContainer) {
      this.createVoiceChatInterface();
      messagesContainer = document.getElementById("voice-messages");
      if (!messagesContainer) {
        const interfaceExists =
          document.getElementById("voice-chat-interface") !== null;
        if (interfaceExists) {
          const interfaceElement = document.getElementById(
            "voice-chat-interface"
          );
          interfaceElement.remove();
          this.createVoiceChatInterface();
          messagesContainer = document.getElementById("voice-messages");
          if (!messagesContainer) {
            return;
          }
        } else {
          return;
        }
      }
    }

    // ── Dedupe: if the last AI message is identical, do nothing ──
    if (role === "ai") {
      const lastAi = messagesContainer.querySelector(
        ".ai-message:last-child .message-content"
      );
      if (lastAi && lastAi.textContent === content.trim()) {
        return;
      }
    }

    if (
      content === "Generating response..." ||
      content.includes("Thinking...") ||
      content === "..."
    ) {
      const existingPlaceholders = messagesContainer.querySelectorAll(
        ".ai-message.placeholder"
      );
      existingPlaceholders.forEach((el) => el.remove());
    }

    if (
      role === "ai" &&
      content !== "Generating response..." &&
      !content.includes("Thinking...") &&
      content !== "..."
    ) {
      const existingPlaceholders = messagesContainer.querySelectorAll(
        ".ai-message.placeholder"
      );
      existingPlaceholders.forEach((el) => el.remove());
    }

    const messageEl = document.createElement("div");
    messageEl.className = role === "user" ? "user-message" : "ai-message";

    // Generate a unique message ID for this message and store it as a data attribute
    const messageId =
      "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    messageEl.dataset.messageId = messageId;

    if (
      content === "Generating response..." ||
      content.includes("Thinking...") ||
      content === "..."
    ) {
      messageEl.className += " placeholder";
    }

    messageEl.style.cssText = `
      margin-bottom: 16px;
      animation: fadeIn 0.3s ease forwards;
      display: flex;
      justify-content: ${role === "user" ? "flex-end" : "flex-start"};
      position: relative;
      ${role === "user" ? "padding-right: 8px;" : "padding-left: 8px;"}
    `;

    let messageContent = document.createElement("div");
    messageContent.className = "message-content voice-message-content";

    // Apply markdown formatting for AI messages (similar to VoiceroText)
    if (role === "ai") {
      // Check if content contains HTML elements that need to be preserved (like welcome-question spans)
      const containsHtml = /<[a-z][\s\S]*>/i.test(content);

      if (containsHtml) {
        // If it has HTML, use innerHTML to preserve the HTML elements
        messageContent.innerHTML = content;

        // Check if there are welcome questions
        const hasWelcomeQuestions =
          messageContent.querySelectorAll(".welcome-question").length > 0;

        if (hasWelcomeQuestions) {
          console.log(
            "VoiceroVoice: Found welcome questions in message, using event delegation"
          );

          // Mark this message as having questions so we can use event delegation
          messageEl.setAttribute("data-has-questions", "true");

          // Add a single click handler to the message element
          messageEl.addEventListener("click", (e) => {
            // Find if the click was on a welcome-question element
            let target = e.target;
            while (target !== messageEl) {
              if (target.classList.contains("welcome-question")) {
                e.preventDefault();
                const questionText = target.getAttribute("data-question");
                if (questionText) {
                  console.log(
                    "VoiceroVoice: Welcome question clicked:",
                    questionText
                  );
                  this.processUserText(questionText);
                }
                break;
              }
              if (!target.parentElement) break; // Safety check
              target = target.parentElement;
            }
          });
        }
      } else {
        // Format message if needed (check if VoiceroCore.formatMarkdown is available)
        if (window.VoiceroCore && window.VoiceroCore.formatMarkdown) {
          messageContent.innerHTML = window.VoiceroCore.formatMarkdown(content);
        } else {
          // Fallback to basic formatting if VoiceroCore.formatMarkdown is not available
          messageContent.innerHTML = this.formatContent(content);
        }
      }
    } else {
      messageContent.textContent = content;
    }

    if (role === "user") {
      messageContent.style.cssText = `
        background: var(--voicero-theme-color, ${this.websiteColor});
        color: white;
        border-radius: 18px;
        padding: 10px 12px;
        max-width: 75%;
        word-wrap: break-word;
        font-size: 14px;
        line-height: 1.4;
        text-align: left;
        box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
        font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
      `;

      // Add delivery status for user messages (iPhone-style)
      const statusDiv = document.createElement("div");
      statusDiv.className = "read-status";
      statusDiv.textContent = "Delivered";
      messageEl.appendChild(statusDiv);
    } else if (role === "ai") {
      if (
        content === "Generating response..." ||
        content.includes("Thinking...") ||
        content === "..."
      ) {
        messageContent.style.cssText = `
          background: #e5e5ea;
          color: #666;
          border-radius: 18px;
          padding: 10px 12px;
          max-width: 75%;
          word-wrap: break-word;
          font-size: 14px;
          line-height: 1.4;
          font-style: italic;
          text-align: left;
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        `;
      } else {
        messageContent.style.cssText = `
          background: #e5e5ea;
          color: #333;
          border-radius: 18px;
          padding: 10px 12px;
          max-width: 75%;
          word-wrap: break-word;
          font-size: 14px;
          line-height: 1.4;
          text-align: left;
          box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
        `;

        // Update all previous user message statuses to "Read" after AI responds
        const userStatusDivs =
          messagesContainer.querySelectorAll(".read-status");
        userStatusDivs.forEach((div) => {
          div.textContent = "Read";
          div.style.color =
            "var(--voicero-theme-color, " + this.websiteColor + ")";
        });
      }
    }

    messageEl.appendChild(messageContent);
    messagesContainer.appendChild(messageEl);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // If this is an AI message (not a placeholder), attach the "Report AI response" button using VoiceroSupport
    if (
      role === "ai" &&
      content !== "Generating response..." &&
      !content.includes("Thinking...") &&
      content !== "..." &&
      window.VoiceroSupport &&
      typeof window.VoiceroSupport.attachReportButtonToMessage === "function"
    ) {
      try {
        // Small delay to ensure the message is fully rendered
        setTimeout(() => {
          window.VoiceroSupport.attachReportButtonToMessage(messageEl, "voice");
        }, 50);
      } catch (e) {
        console.error("Failed to attach report button to voice message:", e);
      }
    }

    return messageEl;
  },

  // Format content with potential links (similar to VoiceroText)
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

  // Format currency values for better speech pronunciation
  formatCurrencyForSpeech: function (text) {
    // Check if text is a string first
    if (typeof text !== "string") {
      // Convert to string safely
      return String(text || "");
    }

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

  // Reopen the voice chat from minimized state
  reopenVoiceChat: function () {
    console.log("VoiceroVoice: Reopening voice chat from minimized state");

    // Set temporary flags to manage state
    const wasOpeningBefore = this.isOpeningVoiceChat;
    this.isOpeningVoiceChat = true;
    this.isClosingVoiceChat = false;

    // First create reliable references to all elements we need
    const voiceInterface = document.getElementById("voice-chat-interface");
    const messagesContainer = document.getElementById("voice-messages");
    const headerContainer = document.getElementById("voice-controls-header");
    const inputWrapper = document.getElementById("voice-input-wrapper");
    const maximizeButton = document.getElementById("maximize-voice-chat");

    // Update window state first - critical for proper state management
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      // Preserve the existing voiceWelcome value from the session
      const currentWelcomeState =
        window.VoiceroCore.session &&
        window.VoiceroCore.session.voiceWelcome !== undefined
          ? window.VoiceroCore.session.voiceWelcome
          : false;

      window.VoiceroCore.updateWindowState({
        voiceOpen: true,
        voiceOpenWindowUp: true,
        // Don't override existing voiceWelcome value from session
        voiceWelcome: currentWelcomeState,
        coreOpen: false,
        textOpen: false,
        textOpenWindowUp: false,
      });
    }

    if (voiceInterface) {
      // Restore messages container
      if (messagesContainer) {
        // Show all messages
        const allMessages = messagesContainer.querySelectorAll(
          ".user-message, .ai-message"
        );
        allMessages.forEach((msg) => {
          msg.style.display = "flex";
        });

        // Restore container styles with robust inline styling
        messagesContainer.style.cssText = `
          max-height: 35vh !important;
          min-height: auto !important;
          height: auto !important;
          opacity: 1 !important;
          padding-top: 0 !important;
          overflow: auto !important;
          border: none !important;
          display: block !important;
          visibility: visible !important;
        `;
      }

      // Restore header with robust inline styling
      if (headerContainer) {
        headerContainer.style.cssText = `
          position: sticky !important;
          top: 0 !important;
          left: 0 !important;
          right: 0 !important;
          height: 40px !important;
          background-color: #f2f2f7 !important;
          z-index: 9999999 !important;
          display: flex !important;
          justify-content: space-between !important;
          align-items: center !important;

          border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
          border-radius: 0 !important;
          margin: 0 !important;
          margin-bottom: 15px !important;
          width: 100% !important;
          box-shadow: none !important;
          box-sizing: border-box !important;
          margin-left: 0 !important; 
          margin-right: 0 !important;
        `;
      }

      // Restore input wrapper with robust inline styling
      if (inputWrapper) {
        inputWrapper.style.cssText = `
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
          box-shadow: none;
          width: 100%;
          box-sizing: border-box;
          margin: 0;
        `;
      }

      // Hide maximize button
      if (maximizeButton) {
        maximizeButton.style.display = "none";
      }

      // Update main interface with robust inline styling
      voiceInterface.style.cssText = `
        position: fixed !important;
        left: 50% !important;
        bottom: 20px !important;
        transform: translateX(-50%) !important;
        display: block !important;
        visibility: visible !important;
        opacity: 1 !important;
        z-index: 999999 !important;
        width: 85% !important;
        max-width: 480px !important;
        min-width: 280px !important;
        box-sizing: border-box !important;
        overflow: hidden !important;
        border-radius: 12px !important;
      `;
    }

    // Reset opening flag with delay
    setTimeout(() => {
      // Restore original opening flag state or reset to false
      this.isOpeningVoiceChat = wasOpeningBefore || false;
      console.log(
        "VoiceroVoice: Reopening complete, isOpeningVoiceChat =",
        this.isOpeningVoiceChat
      );
    }, 1000);
  },

  // Add a system message to the voice interface
  addSystemMessage: function (text) {
    const messagesContainer = document.getElementById("voice-messages");
    if (!messagesContainer) return;

    // Create a message element
    const messageDiv = document.createElement("div");
    messageDiv.className = "ai-message";
    messageDiv.style.cssText = `
      display: flex;
      justify-content: center;
      margin-bottom: 8px;
    `;

    // Create the message content
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content";
    contentDiv.innerHTML = text;
    contentDiv.style.cssText = `      
      background: #e5e5ea;
      color: #333;
      border-radius: 16px;
      padding: 6px 10px;
      width: 90% !important;
      max-width: 400px !important;
      word-wrap: break-word;
      font-size: 13px;
      line-height: 1.2;
      text-align: center;
      box-shadow: 0 4px 15px rgba(0, 0, 0, 0.08);
      margin: 4px auto;
    `;

    // Add content to message
    messageDiv.appendChild(contentDiv);

    // Add message to container
    messagesContainer.appendChild(messageDiv);

    // Scroll to bottom
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
  },

  // Clear chat history from the voice interface
  clearChatHistory: function () {
    // Call the session/clear API endpoint
    if (window.VoiceroCore && window.VoiceroCore.sessionId) {
      const proxyUrl = "/wp-json/voicero/v1/session_clear";

      fetch(proxyUrl, {
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

                // IMPORTANT: Also update the currentThreadId in this component
                // to ensure new requests use the new thread
                this.currentThreadId = data.session.threads[0].threadId;
              }
            }
          }
        })
        .catch((error) => {
          // console.error("Failed to clear chat history:", error);
        });
    }

    const messagesContainer = document.getElementById("voice-messages");
    if (!messagesContainer) return;

    // Remove all message elements except the user message input container
    const messages = messagesContainer.querySelectorAll(
      ".ai-message, .user-message"
    );
    if (messages.length === 0) return;

    messages.forEach((msg) => {
      // If this is the first user-message and it's empty (just the container), keep it
      if (
        msg.classList.contains("user-message") &&
        !msg.querySelector(".message-content")
      ) {
        return;
      }
      msg.remove();
    });

    // Reset the messages array as well
    this.messages = [];

    // RESET all welcome flags to false to ensure showing welcome message again after clearing
    this.hasShownWelcome = false;
    localStorage.removeItem("voicero_shown_welcome");

    // Update VoiceroCore state
    if (window.VoiceroCore) {
      if (window.VoiceroCore.appState) {
        window.VoiceroCore.appState.hasShownVoiceWelcome = false;
      }

      // Also update session flag
      if (window.VoiceroCore.updateWindowState) {
        window.VoiceroCore.updateWindowState({
          voiceWelcome: true, // Set to true to force showing welcome again
        });
      }
    }

    // Directly show the welcome message
    this.showWelcomeMessage();
  },

  // Load messages from session
  loadMessagesFromSession: function () {
    // Flag to track if any messages were loaded
    let messagesLoaded = false;

    console.log("VoiceroVoice: Loading messages from session");

    // CRITICAL: First check VoiceroCore.session.voiceWelcome - if it's true, ALWAYS show welcome message
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.voiceWelcome === true
    ) {
      console.log(
        "VoiceroVoice: VoiceroCore.session.voiceWelcome is true, forcing welcome message"
      );
      // Reset welcome flags to ensure welcome message is shown
      this.hasShownWelcome = false;
      localStorage.removeItem("voicero_shown_welcome");
      if (window.VoiceroCore && window.VoiceroCore.appState) {
        window.VoiceroCore.appState.hasShownVoiceWelcome = false;
      }
    }

    // If voiceWelcome is explicitly false, don't show welcome message
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.voiceWelcome === false
    ) {
      console.log(
        "VoiceroVoice: VoiceroCore.session.voiceWelcome is false, not showing welcome message"
      );
      this.hasShownWelcome = true;
      localStorage.setItem("voicero_shown_welcome", "true");
      if (window.VoiceroCore && window.VoiceroCore.appState) {
        window.VoiceroCore.appState.hasShownVoiceWelcome = true;
      }
    }

    // If we've already shown the welcome message (check multiple sources), skip showing it again
    if (
      this.hasShownWelcome ||
      localStorage.getItem("voicero_shown_welcome") === "true" ||
      (window.VoiceroCore &&
        window.VoiceroCore.appState &&
        window.VoiceroCore.appState.hasShownVoiceWelcome === true)
    ) {
      // Make sure all flags are synchronized to prevent future issues
      this.hasShownWelcome = true;
      if (window.VoiceroCore && window.VoiceroCore.appState) {
        window.VoiceroCore.appState.hasShownVoiceWelcome = true;
      }
      localStorage.setItem("voicero_shown_welcome", "true");

      // Skip welcome message but still load messages
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
      console.log("VoiceroVoice: Most recent thread:", currentThread);

      // Check if thread has messages array and it's not empty
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
          "VoiceroVoice: Thread has",
          nonSystemMessages.length,
          "non-system messages"
        );

        if (nonSystemMessages.length === 0) {
          // If there are no actual messages, set messagesLoaded to false
          // to trigger welcome message
          messagesLoaded = false;

          // IMPORTANT: Force the welcome message to show for threads with empty messages
          if (window.VoiceroCore && window.VoiceroCore.session) {
            console.log(
              "VoiceroVoice: Thread has no non-system messages, forcing welcome message"
            );
            window.VoiceroCore.session.voiceWelcome = true;
            // Reset flags to ensure welcome message shows
            this.hasShownWelcome = false;
            localStorage.removeItem("voicero_shown_welcome");
            if (window.VoiceroCore && window.VoiceroCore.appState) {
              window.VoiceroCore.appState.hasShownVoiceWelcome = false;
            }
          }
        } else {
          // Clear existing messages if any
          const messagesContainer = document.getElementById("voice-messages");
          if (messagesContainer) {
            // Keep the container but remove all messages
            const messages = messagesContainer.querySelectorAll(
              ".user-message, .ai-message"
            );
            messages.forEach((msg) => {
              msg.remove();
            });
          }

          // Add each message to the UI
          nonSystemMessages.forEach((msg) => {
            // Skip system messages and page_data messages
            if (msg.role === "system" || msg.type === "page_data") {
              return; // Skip this message
            }

            if (msg.role === "user") {
              // Add user message
              this.addMessage(msg.content, "user");
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
                this.addMessage(aiMessage, "ai");
                messagesLoaded = true;
              } catch (e) {}
            }
          });

          // Store the thread ID
          this.currentThreadId = currentThread.threadId;

          // Scroll to bottom
          if (messagesContainer) {
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
          }
        }
      } else {
        // Thread exists but has empty messages array - should show welcome message
        console.log(
          "VoiceroVoice: Thread has empty messages array, should show welcome message"
        );
        messagesLoaded = false;

        // Store the thread ID even if no messages
        if (currentThread) {
          this.currentThreadId = currentThread.threadId;
        }
      }
    }

    // If no messages were loaded (either no threads or empty thread), show welcome message
    // We also should show welcome message if VoiceroCore.session.voiceWelcome is true
    if (
      !messagesLoaded ||
      (window.VoiceroCore &&
        window.VoiceroCore.session &&
        window.VoiceroCore.session.voiceWelcome === true)
    ) {
      // Extra check to prevent duplicate welcome messages
      if (
        !this.hasShownWelcome &&
        localStorage.getItem("voicero_shown_welcome") !== "true" &&
        !(
          window.VoiceroCore &&
          window.VoiceroCore.appState &&
          window.VoiceroCore.appState.hasShownVoiceWelcome === true
        ) &&
        !(
          window.VoiceroCore &&
          window.VoiceroCore.session &&
          window.VoiceroCore.session.voiceWelcome === false
        )
      ) {
        // Verify no welcome messages are already in the DOM
        const existingWelcomeMessages = document.querySelectorAll(
          ".ai-message .welcome-question"
        );
        if (existingWelcomeMessages.length === 0) {
          console.log(
            "VoiceroVoice: All checks passed, showing welcome message"
          );
          this.showWelcomeMessage();
        } else {
          console.log(
            "VoiceroVoice: Found existing welcome message in DOM, not showing again"
          );
          this.hasShownWelcome = true;
        }
      } else {
        console.log(
          "VoiceroVoice: Not showing welcome message due to existing flags"
        );
      }
    }
  },

  // Helper function to display the welcome message
  showWelcomeMessage: function () {
    // CRITICAL: Check for existing welcome messages in the DOM first
    const existingWelcomeMessages = document.querySelectorAll(
      ".ai-message .welcome-question"
    );
    if (existingWelcomeMessages.length > 0) {
      console.log(
        "VoiceroVoice: Welcome message already exists in DOM, not showing again"
      );
      this.hasShownWelcome = true;
      localStorage.setItem("voicero_shown_welcome", "true");
      if (window.VoiceroCore && window.VoiceroCore.appState) {
        window.VoiceroCore.appState.hasShownVoiceWelcome = true;
      }
      return;
    }

    // Multiple checks to prevent welcome message from showing repeatedly

    // Check internal flag
    if (this.hasShownWelcome) {
      return;
    }

    // Also check VoiceroCore's appState
    if (
      window.VoiceroCore &&
      window.VoiceroCore.appState &&
      window.VoiceroCore.appState.hasShownVoiceWelcome === true
    ) {
      this.hasShownWelcome = true;
      return;
    }

    // Check if we've stored a flag in localStorage as a fallback
    if (localStorage.getItem("voicero_shown_welcome") === "true") {
      this.hasShownWelcome = true;
      return;
    }

    // Get messages container
    const messagesContainer = document.getElementById("voice-messages");
    if (!messagesContainer) {
      return;
    }

    // Check if there are already messages in the container
    const existingMessages = messagesContainer.querySelectorAll(
      ".user-message .message-content, .ai-message .message-content"
    );
    if (existingMessages.length > 0) {
      // If there are already messages, don't show the welcome message
      this.hasShownWelcome = true;

      // Set the flag in multiple places for redundancy
      if (window.VoiceroCore && window.VoiceroCore.appState) {
        window.VoiceroCore.appState.hasShownVoiceWelcome = true;
        if (
          window.VoiceroCore.saveState &&
          typeof window.VoiceroCore.saveState === "function"
        ) {
          window.VoiceroCore.saveState();
        }
      }
      localStorage.setItem("voicero_shown_welcome", "true");
      return;
    }

    // Set flag to indicate welcome was shown - in multiple places for redundancy
    this.hasShownWelcome = true;
    if (window.VoiceroCore && window.VoiceroCore.appState) {
      window.VoiceroCore.appState.hasShownVoiceWelcome = true;
      if (
        window.VoiceroCore.saveState &&
        typeof window.VoiceroCore.saveState === "function"
      ) {
        window.VoiceroCore.saveState();
      }
    }
    localStorage.setItem("voicero_shown_welcome", "true");

    // Use VoiceroWelcome to get the welcome message if available
    let websiteName = "our website";
    let welcomeMessage = "";
    let welcomeMessageContent = "";

    // Get website name - try different sources
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

    // Get bot name if available
    const botName =
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.botName
        ? window.VoiceroCore.session.botName
        : window.voiceroBotName || window.VoiceroCore?.botName || "Voicero";

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

    // Create base welcome message
    welcomeMessage = `Hi, I'm ${botName}! ${welcomeMessageContent}

**Click the microphone to start talking**
`;

    // Check if we have custom pop-up questions to add to the welcome message
    let customPopUpQuestions = [];
    let popUpQuestionsSource = "none";

    // Try to get questions from multiple possible sources
    // Try to get questions from VoiceroCore session
    if (
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
      "VoiceroVoice: Found popup questions from",
      popUpQuestionsSource,
      customPopUpQuestions
    );

    // Add questions to welcome message if available
    if (customPopUpQuestions.length > 0) {
      welcomeMessage += "\n\nHere are some questions you might want to ask:\n";

      customPopUpQuestions.forEach((item, index) => {
        const questionText = item.question || item;
        if (questionText && typeof questionText === "string") {
          // Create a more robust styling approach that works in the voice interface
          welcomeMessage += `\n- <span class="welcome-question" style="color: ${
            this.websiteColor || "#882be6"
          }; text-decoration: underline; font-weight: bold; cursor: pointer;" data-question="${questionText.replace(
            /"/g,
            "&quot;"
          )}">${questionText}</span>`;
        }
      });
    }

    console.log("Showing welcome message");

    // Create a message element directly to have more control
    const messageEl = document.createElement("div");
    messageEl.className = "ai-message";
    messageEl.style.cssText = `
      margin-bottom: 16px;
      animation: fadeIn 0.3s ease forwards;
      display: flex;
      justify-content: flex-start;
      position: relative;
      padding-left: 8px;
    `;

    // Generate a unique message ID
    const messageId =
      "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
    messageEl.dataset.messageId = messageId;

    // Create message content
    const messageContent = document.createElement("div");
    messageContent.className = "message-content voice-message-content";

    // Format the welcome message content with the correct formatting
    if (window.VoiceroCore && window.VoiceroCore.formatMarkdown) {
      messageContent.innerHTML =
        window.VoiceroCore.formatMarkdown(welcomeMessage);
    } else {
      // Use our local formatContent function
      messageContent.innerHTML = this.formatContent(welcomeMessage);
    }

    // Append content to message
    messageEl.appendChild(messageContent);

    // Append to messages container
    messagesContainer.appendChild(messageEl);

    // Add click handlers to the welcome questions
    setTimeout(() => {
      // Use the message element for event delegation instead of individual question elements
      // This avoids duplicate handlers when switching between interfaces
      if (messageEl) {
        // Only add the handler if it's not already there
        if (!messageEl.hasAttribute("data-question-handler")) {
          messageEl.setAttribute("data-question-handler", "true");

          // Use event delegation - one handler for the entire message
          messageEl.addEventListener("click", (e) => {
            // Find if the click was on a welcome-question element
            let target = e.target;
            while (target !== messageEl) {
              if (target.classList.contains("welcome-question")) {
                e.preventDefault();
                const questionText = target.getAttribute("data-question");
                if (questionText) {
                  // Send the question as a user message
                  this.processUserText(questionText);
                }
                break;
              }
              target = target.parentElement;
            }
          });
        }
      }
    }, 100);

    // Scroll to bottom
    if (messagesContainer) {
      setTimeout(() => {
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
      }, 100);
    }

    return messageEl;
  },

  // Stop any ongoing recording
  stopRecording: function (processAudioData = true) {
    // Set flag to indicate recording is stopped
    this.isRecording = false;
    this.manuallyStoppedRecording = !processAudioData;

    // Stop any audio streams that might be active
    if (this.currentAudioStream) {
      this.currentAudioStream.getTracks().forEach((track) => track.stop());
      this.currentAudioStream = null;
    }

    // Stop the media recorder if it exists
    if (this.mediaRecorder && this.mediaRecorder.state === "recording") {
      this.mediaRecorder.stop();
    }

    // Clear any timers
    if (this.silenceDetectionTimer) {
      clearInterval(this.silenceDetectionTimer);
      this.silenceDetectionTimer = null;
    }

    if (this.recordingTimeout) {
      clearTimeout(this.recordingTimeout);
      this.recordingTimeout = null;
    }

    // Reset audio related variables
    this.audioContext = null;
    this.analyser = null;
    this.audioChunks = [];
    this.silenceTime = 0;
    this.isSpeaking = false;
    this.hasStartedSpeaking = false;
  },

  // Helper methods for color variations
  adjustColor: function (color, adjustment) {
    return window.VoiceroColor && window.VoiceroColor.adjustColor
      ? window.VoiceroColor.adjustColor(color, adjustment)
      : !color
      ? "#ff4444"
      : !color.startsWith("#")
      ? color
      : "#ff4444";
  },

  // Collect page data for better context
  collectPageData: function () {
    // Check if VoiceroPageData is available
    if (
      !window.VoiceroPageData ||
      typeof window.VoiceroPageData.collectPageData !== "function"
    ) {
      console.warn(
        "VoiceroVoice: VoiceroPageData module not available - ensure it's loaded before voicero-voice.js"
      );
      // Return minimal data
      return {
        url: window.location.href,
        full_text: document.body.innerText.substring(0, 500),
        buttons: [],
        forms: [],
        sections: [],
        images: [],
      };
    }

    // Use the shared utility function
    return window.VoiceroPageData.collectPageData();
  },

  // Toggle from voice chat to text chat
  toggleToTextChat: function () {
    console.log("VoiceroVoice: Toggling from voice to text chat");

    // Set closing flag
    this.isClosingVoiceChat = true;

    // First create reliable references to the elements we need
    const voiceInterface = document.getElementById("voice-chat-interface");

    // Hide voice interface
    if (voiceInterface) {
      voiceInterface.style.display = "none";
    }

    // Update window state with a single call instead of sequential calls
    // This prevents the race condition where coreOpen gets set to true
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

      // Disable any further state updates for a short period to prevent conflicts
      if (window.VoiceroCore.disableStateUpdates) {
        window.VoiceroCore.disableStateUpdates(1000); // Disable for 1 second
      }

      window.VoiceroCore.updateWindowState({
        textOpen: true,
        textOpenWindowUp: true, // Explicitly set to true to ensure maximized
        textWelcome: currentTextWelcome, // Preserve text welcome state
        voiceOpen: false,
        voiceOpenWindowUp: false,
        voiceWelcome: currentVoiceWelcome, // Preserve voice welcome state
        coreOpen: false,
        autoMic: false, // Include autoMic setting too
      });
    }

    // Reset closing flag
    this.isClosingVoiceChat = false;

    // Then open the text chat interface
    if (window.VoiceroText && window.VoiceroText.openTextChat) {
      setTimeout(() => {
        window.VoiceroText.openTextChat();

        // Make sure it's maximized
        if (window.VoiceroText.maximizeChat) {
          setTimeout(() => {
            window.VoiceroText.maximizeChat();
          }, 100);
        }
      }, 100);
    }
  },

  // Sync theme color with VoiceroCore
  syncThemeColor: function () {
    let newColor = null;

    // Check for color in VoiceroCore
    if (window.VoiceroCore) {
      if (window.VoiceroCore.websiteColor) {
        newColor = window.VoiceroCore.websiteColor;
      } else if (
        window.VoiceroCore.session &&
        window.VoiceroCore.session.website &&
        window.VoiceroCore.session.website.color
      ) {
        newColor = window.VoiceroCore.session.website.color;
      }
    }

    // Only update if we got a color and it's different from the current one
    if (newColor && newColor !== this.websiteColor) {
      console.log(
        "VoiceroVoice: Updating theme color from",
        this.websiteColor,
        "to",
        newColor
      );
      this.websiteColor = newColor;

      // Update CSS variable
      document.documentElement.style.setProperty(
        "--voicero-theme-color",
        this.websiteColor
      );

      // Update mic button if it exists
      const micButton = document.getElementById("voice-mic-button");
      if (micButton && !this.isRecording) {
        micButton.style.background = this.websiteColor;
      }

      // Update any user messages
      const userMessages = document.querySelectorAll(
        ".user-message .message-content"
      );
      userMessages.forEach((msg) => {
        msg.style.background =
          "var(--voicero-theme-color, " + this.websiteColor + ")";
      });

      // Update read status indicators
      const readStatuses = document.querySelectorAll(".read-status");
      readStatuses.forEach((status) => {
        if (status.textContent === "Read") {
          status.style.color =
            "var(--voicero-theme-color, " + this.websiteColor + ")";
        }
      });
    }
  },

  // New helper function to ensure consistent border radius styles
  updateVoiceChatBorderRadius: function (isMinimized) {
    if (!document) return;

    const inputWrapper = document.getElementById("voice-input-wrapper");
    if (!inputWrapper) return;

    // Get the inner container
    const innerWrapper = inputWrapper.querySelector("div");
    if (!innerWrapper) return;

    const messagesContainer = document.getElementById("voice-messages");
    const headerContainer = document.getElementById("voice-controls-header");
    const voiceInterface = document.getElementById("voice-chat-interface");

    if (isMinimized) {
      // Full border radius for minimized state
      inputWrapper.style.borderRadius = "12px";
      innerWrapper.style.borderRadius = "10px";

      if (voiceInterface) {
        voiceInterface.style.borderRadius = "12px";
      }

      if (messagesContainer) {
        messagesContainer.style.borderRadius = "0";
      }

      if (headerContainer) {
        headerContainer.style.borderRadius = "0";
      }
    } else {
      // Bottom-only border radius for maximized state
      inputWrapper.style.borderRadius = "0 0 12px 12px";
      innerWrapper.style.borderRadius = "0 0 10px 10px";

      if (voiceInterface) {
        voiceInterface.style.borderRadius = "12px 12px 12px 12px";
      }

      if (messagesContainer) {
        messagesContainer.style.borderRadius = "12px 12px 0 0";
      }

      if (headerContainer) {
        headerContainer.style.borderRadius = "12px 12px 0 0";
      }
    }
  },

  // Set status message
  setStatus: function (status) {
    const statusElement = document.getElementById("voicero-status");
    if (statusElement) {
      statusElement.textContent = status;
    }
  },

  processUserText: function (text) {
    console.log("VoiceroVoice: Processing user text:", text);

    // Add the user message to the chat
    this.addMessage(text, "user");

    // Proceed with the API request
    this.sendUserTextToAPI(text);
  },

  // Send text message to the API
  sendUserTextToAPI: function (text) {
    console.log("VoiceroVoice: Sending text to API:", text);

    // Show the AI is thinking
    this.addMessage("Thinking...", "ai", false);

    // Format the request body according to the API's expected structure
    const requestBody = {
      message: text,
      type: "text",
    };

    // Add thread ID if available
    if (this.currentThreadId) {
      requestBody.threadId = this.currentThreadId;
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
    requestBody.pageData = this.collectPageData();

    // Log request body for debugging
    console.log(
      "[VOICERO VOICE] Sending to /chat:",
      JSON.stringify(requestBody, null, 2)
    );

    // Use WordPress proxy for the /shopify/chat route
    fetch("/wp-json/voicero/v1/wordpress/chat", {
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
          throw new Error(`API error: ${response.status}`);
        }
        return response.json();
      })
      .then((data) => {
        console.log(
          "[VOICERO VOICE] Received from /chat:",
          JSON.stringify(data, null, 2)
        );

        // Remove the typing indicator
        const placeholder = document.querySelector(".ai-message.placeholder");
        if (placeholder) {
          placeholder.remove();
        }

        // Get the text response from the data
        let aiTextResponse = "";
        let actionType = null;
        let actionUrl = null;

        // Extract the answer from the API response
        if (data && data.response && data.response.answer) {
          aiTextResponse = data.response.answer;
          actionType = data.response.action || null;
          actionUrl = data.response.url || null;
        } else if (data && data.answer) {
          aiTextResponse = data.answer;
          actionType = data.action || null;
          actionUrl = data.url || null;
        } else if (data && typeof data.response === "string") {
          aiTextResponse = data.response;
        } else {
          aiTextResponse = "I'm sorry, I couldn't process that request.";
        }

        // Add the AI response to the chat
        this.addMessage(aiTextResponse, "ai");

        // Store the thread ID if provided
        if (data.threadId) {
          this.currentThreadId = data.threadId;
        }

        // Handle redirect action if needed
        if (actionType === "redirect" && actionUrl) {
          setTimeout(() => {
            window.location.href = actionUrl;
          }, 1000);
        }
      })
      .catch((error) => {
        console.error("[VOICERO VOICE] Error sending text to API:", error);

        // Remove the typing indicator
        const placeholder = document.querySelector(".ai-message.placeholder");
        if (placeholder) {
          placeholder.remove();
        }

        // Add error message
        this.addMessage(
          "I'm sorry, there was an error processing your request. Please try again later.",
          "ai"
        );
      });
  },
};

// Expose global functions
window.VoiceroVoice = VoiceroVoice;

// Add debugging helper function
VoiceroVoice.debugInterface = function () {
  console.log("---------- VOICE INTERFACE DEBUG ----------");

  // Check flags
  console.log("Flags:", {
    isRecording: this.isRecording,
    isOpeningVoiceChat: this.isOpeningVoiceChat,
    isClosingVoiceChat: this.isClosingVoiceChat,
    lastOpenTime: this.lastOpenTime,
    timeSinceOpen: Date.now() - this.lastOpenTime + "ms",
  });

  // Check elements
  const voiceInterface = document.getElementById("voice-chat-interface");
  const toggleContainer = document.getElementById("voice-toggle-container");
  const mainButton = document.getElementById("chat-website-button");
  const messagesContainer = document.getElementById("voice-messages");

  console.log("Elements:", {
    voiceInterface: voiceInterface ? "exists" : "missing",
    toggleContainer: toggleContainer ? "exists" : "missing",
    mainButton: mainButton ? "exists" : "missing",
    messagesContainer: messagesContainer ? "exists" : "missing",
  });

  // Check visibility
  if (voiceInterface) {
    const style = window.getComputedStyle(voiceInterface);
    console.log("Voice Interface Visibility:", {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      zIndex: style.zIndex,
    });
  }

  if (mainButton) {
    const style = window.getComputedStyle(mainButton);
    console.log("Main Button Visibility:", {
      display: style.display,
      visibility: style.visibility,
      opacity: style.opacity,
      zIndex: style.zIndex,
    });
  }

  // Check VoiceroCore state
  if (window.VoiceroCore && window.VoiceroCore.session) {
    console.log("VoiceroCore Session:", {
      voiceOpen: window.VoiceroCore.session.voiceOpen,
      voiceOpenWindowUp: window.VoiceroCore.session.voiceOpenWindowUp,
      textOpen: window.VoiceroCore.session.textOpen,
    });
  } else {
    console.log("VoiceroCore Session: Not available");
  }

  return "Debug info logged to console";
};

// Add autoMic activation function
VoiceroVoice.activateAutoMic = function () {
  // Only proceed if the voice interface is open
  const voiceInterface = document.getElementById("voice-chat-interface");
  if (!voiceInterface || voiceInterface.style.display !== "block") {
    return;
  }

  // If not already recording, start the microphone
  if (!this.isRecording) {
    this.toggleMic("auto");

    // Begin audio processing immediately
    if (this.mediaRecorder && this.audioContext && this.analyser) {
      // Force hasStartedSpeaking to true to ensure we're immediately listening
      this.hasStartedSpeaking = true;
      this.isSpeaking = true;
    } else {
    }
  } else {
  }
};

// Initialize when core is ready
document.addEventListener("DOMContentLoaded", () => {
  const existingInterface = document.getElementById("voice-chat-interface");
  if (existingInterface) {
    existingInterface.remove();
  }

  if (typeof VoiceroCore !== "undefined") {
    VoiceroVoice.init();

    if (
      VoiceroCore &&
      VoiceroCore.appState &&
      VoiceroCore.appState.hasShownVoiceWelcome === undefined
    ) {
      VoiceroCore.appState.hasShownVoiceWelcome = false;
      if (
        VoiceroCore.saveState &&
        typeof VoiceroCore.saveState === "function"
      ) {
        VoiceroCore.saveState();
      }
    }

    // Check for voice reactivation after navigation
    const shouldReactivate =
      localStorage.getItem("voicero_reactivate_voice") === "true" ||
      (VoiceroCore.appState &&
        VoiceroCore.appState.isOpen &&
        VoiceroCore.appState.activeInterface === "voice");

    if (shouldReactivate) {
      localStorage.removeItem("voicero_reactivate_voice");

      // Wait a moment for everything to initialize properly
      setTimeout(() => {
        // Force update VoiceroCore state to ensure UI matches state
        if (VoiceroCore && VoiceroCore.appState) {
          VoiceroCore.appState.isOpen = true;
          VoiceroCore.appState.activeInterface = "voice";
          VoiceroCore.appState.isVoiceMinimized = false;
          if (
            VoiceroCore.saveState &&
            typeof VoiceroCore.saveState === "function"
          ) {
            VoiceroCore.saveState();
          }
        }
        // Open voice chat interface
        VoiceroVoice.openVoiceChat();

        // Also start the microphone automatically if needed
        const shouldActivateMic =
          localStorage.getItem("voicero_auto_mic") === "true" ||
          (VoiceroCore &&
            VoiceroCore.session &&
            VoiceroCore.session.autoMic === true);

        if (shouldActivateMic) {
          localStorage.removeItem("voicero_auto_mic");
          setTimeout(() => {
            // Use our new function for complete mic activation
            VoiceroVoice.activateAutoMic();
          }, 800);
        }
      }, 1000);
    }
  } else {
    let attempts = 0;
    const checkCoreInterval = setInterval(() => {
      attempts++;
      if (typeof VoiceroCore !== "undefined") {
        clearInterval(checkCoreInterval);
        VoiceroVoice.init();

        // Initialize the hasShownVoiceWelcome flag if it doesn't exist
        if (
          VoiceroCore &&
          VoiceroCore.appState &&
          VoiceroCore.appState.hasShownVoiceWelcome === undefined
        ) {
          VoiceroCore.appState.hasShownVoiceWelcome = false;
          if (
            VoiceroCore.saveState &&
            typeof VoiceroCore.saveState === "function"
          ) {
            VoiceroCore.saveState();
          }
        }

        // Check for voice reactivation after VoiceroCore loads
        const shouldReactivate =
          localStorage.getItem("voicero_reactivate_voice") === "true" ||
          (VoiceroCore.appState &&
            VoiceroCore.appState.isOpen &&
            VoiceroCore.appState.activeInterface === "voice");
        if (shouldReactivate) {
          localStorage.removeItem("voicero_reactivate_voice");
          setTimeout(() => {
            if (VoiceroCore && VoiceroCore.appState) {
              VoiceroCore.appState.isOpen = true;
              VoiceroCore.appState.activeInterface = "voice";
              VoiceroCore.appState.isVoiceMinimized = false;
              if (
                VoiceroCore.saveState &&
                typeof VoiceroCore.saveState === "function"
              ) {
                VoiceroCore.saveState();
              }
            }
            VoiceroVoice.openVoiceChat();

            const shouldActivateMic =
              localStorage.getItem("voicero_auto_mic") === "true" ||
              (VoiceroCore &&
                VoiceroCore.session &&
                VoiceroCore.session.autoMic === true);

            if (shouldActivateMic) {
              localStorage.removeItem("voicero_auto_mic");
              setTimeout(() => {
                // Use our new function for complete mic activation
                VoiceroVoice.activateAutoMic();
              }, 800);
            }
          }, 1000);
        }
      } else if (attempts >= 50) {
        clearInterval(checkCoreInterval);
      }
    }, 100);
  }
});
