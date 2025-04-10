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
        this.apiBaseUrl || window.API_URL || "http://localhost:3000";
    }

    // Create HTML structure for the chat interface but keep it hidden
    this.createChatInterface();

    // Hide the shadow host if it exists
    const shadowHost = document.getElementById("voicero-shadow-host");
    if (shadowHost) {
      shadowHost.style.display = "none";
    }
  },

  // Open text chat interface
  openTextChat: function () {
    // Close voice interface if it's open
    const voiceInterface = document.getElementById("voice-chat-interface");
    if (voiceInterface && voiceInterface.style.display === "block") {
      if (window.VoiceroVoice && window.VoiceroVoice.closeVoiceChat) {
        window.VoiceroVoice.closeVoiceChat();
      } else {
        voiceInterface.style.display = "none";
      }
    }

    // Hide the toggle container when opening on mobile
    if (window.innerWidth <= 768) {
      const toggleContainer = document.getElementById("voice-toggle-container");
      if (toggleContainer) {
        toggleContainer.style.display = "none";
        toggleContainer.style.visibility = "hidden";
        toggleContainer.style.opacity = "0";
      }
    }

    // Hide the chooser popup
    const chooser = document.getElementById("interaction-chooser");
    if (chooser) {
      chooser.style.display = "none";
      chooser.style.visibility = "hidden";
      chooser.style.opacity = "0";
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

    // Show the shadow host (which contains the chat interface)
    const shadowHost = document.getElementById("voicero-text-chat-container");
    if (shadowHost) {
      shadowHost.style.display = "block";

      // Position in lower middle of screen to match voice interface
      shadowHost.style.position = "fixed";
      shadowHost.style.left = "50%";
      shadowHost.style.bottom = "20px";
      shadowHost.style.transform = "translateX(-50%)";
      shadowHost.style.zIndex = "999999";
      shadowHost.style.width = "85%";
      shadowHost.style.maxWidth = "480px";
      shadowHost.style.minWidth = "280px";
    }

    // Set up input and button listeners
    this.setupEventListeners();

    // Set up button event handlers (ensure minimize/maximize work)
    this.setupButtonHandlers();

    // Check if we should show welcome message
    const hasMessages = this.messages && this.messages.length > 0;

    if (!hasMessages) {
      // Add welcome message with clear prompt - formatted like voice interface
      this.addMessage(
        `
        <div class="welcome-message">
          <div class="welcome-title">Aura, your website concierge</div>
          <div class="welcome-subtitle">Text me like your <span class="welcome-highlight">best friend</span> and I'll solve any problem you may have.</div>
          <div class="welcome-note"><span class="welcome-pulse"></span>Ask me anything about this site!</div>
        </div>
      `,
        "ai",
        false,
        true
      );
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
            "initial-suggestions"
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
            "initial-suggestions"
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

        suggestionsDiv.innerHTML +=
          '<div class="suggestion" style="' +
          "background: #882be6;" +
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
          border: 1px solid rgba(136, 43, 230, 0.1);
        }
        
        .welcome-title {
          font-size: 18px;
          font-weight: 700;
          margin-bottom: 5px;
          font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
          background: linear-gradient(90deg, #882be6, #ff6b6b, #4a90e2);
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
          color: #882be6;
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
          background-color: #ff4444;
          border-radius: 50%;
          margin-right: 4px;
          animation: welcomePulse 1.5s infinite;
        }

        /* Hide scrollbar for different browsers */
        #chat-messages {
          scrollbar-width: none; /* Firefox */
          -ms-overflow-style: none; /* IE and Edge */
          padding: 15px !important; 
          padding-top: 0 !important;
          margin: 0 !important;
          background-color: #f2f2f7 !important; /* iOS light gray background */
          border-radius: 12px 12px 0 0 !important; /* Add border radius to top */
        }
        
        #chat-messages::-webkit-scrollbar {
          display: none; /* Chrome, Safari and Opera */
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
          background: #882be6;
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
          background: #882be6 !important;
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
            50% { background-position: 100% 50%; }
            100% { background-position: 0% 50%; }
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
            border: 1px solid rgba(136, 43, 230, 0.1);
          }
          
          .welcome-title {
            font-size: 18px;
            font-weight: 700;
            margin-bottom: 5px;
            font-family: 'Segoe UI', -apple-system, BlinkMacSystemFont, sans-serif;
            background: linear-gradient(90deg, #882be6, #ff6b6b, #4a90e2);
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
            color: #882be6;
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
            background-color: #ff4444;
            border-radius: 50%;
            margin-right: 4px;
            animation: welcomePulse 1.5s infinite;
          }

          /* Hide scrollbar for different browsers */
          #chat-messages {
            scrollbar-width: none; /* Firefox */
            -ms-overflow-style: none; /* IE and Edge */
            padding: 15px !important; 
            padding-top: 0 !important;
            margin: 0 !important;
            background-color: #f2f2f7 !important; /* iOS light gray background */
            border-radius: 12px 12px 0 0 !important; /* Add border radius to top */
          }
          
          #chat-messages::-webkit-scrollbar {
            display: none; /* Chrome, Safari and Opera */
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
            background: #882be6;
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
            background: #882be6 !important;
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
          
          /* IMPORTANT: New styles for maximize button to ensure visibility */
          #maximize-chat {
            display: none;
            width: 100%;
            text-align: center;
            padding: 0;
            margin: 0;
            margin-top: 10px; /* Add top margin for spacing */
            cursor: pointer;
            transition: all 0.2s ease;
            z-index: 999999;
            position: relative;
          }
          
          #maximize-chat button {
            background: #882be6;
            border: none;
            color: white;
            padding: 10px 20px;
            border-radius: 20px 20px 0 0;
            font-size: 14px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
            display: inline-flex;
            align-items: center;
            justify-content: center;
            min-width: 160px;
            margin-bottom: -2px; /* Increased negative margin to ensure overlap */
            position: relative;
            z-index: 1000000; /* Higher z-index to ensure button shows above input */
          }
        </style>

        <!-- IMPORTANT: Restructured layout - Maximize button first in the DOM order -->
        <!-- This is critical so it won't be affected by the messages container collapse -->
        <div 
          id="maximize-chat"
          style="display: none; margin-top: 10px;"
        >
          <button>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="margin-right: 8px;">
              <polyline points="15 3 21 3 21 9"></polyline>
              <polyline points="9 21 3 21 3 15"></polyline>
              <line x1="21" y1="3" x2="14" y2="10"></line>
              <line x1="3" y1="21" x2="10" y2="14"></line>
            </svg>
            Open Messages
          </button>
        </div>

        <div id="chat-messages" style="
          background: #f2f2f7;
          border-radius: 0;
          padding: 15px;
          padding-top: 0 !important;
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
            background: linear-gradient(90deg, #882be6, #ff4444, #882be6);
            background-size: 200% 100%;
            border-radius: 3px;
            display: none;
            animation: gradientMove 2s linear infinite;
          "></div>
          
          <div id="chat-controls-header" style="
            position: sticky !important;
            top: 0 !important;
            left: 0 !important;
            right: 0 !important;
            height: 40px !important;
            background: #f2f2f7 !important;
            z-index: 20 !important;
            display: flex !important;
            justify-content: space-between !important;
            align-items: center !important;
            padding: 10px 15px !important;
            border-bottom: 1px solid rgba(0, 0, 0, 0.1) !important;
            border-radius: 0 !important;
            margin: 0 !important;
            margin-bottom: 15px !important;
            width: 100% !important;
          ">
            <button
              id="clear-text-chat"
              style="
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
              "
            >
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
              <button
                id="minimize-chat"
                style="
                  background: none;
                  border: none;
                  cursor: pointer;
                  padding: 5px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s ease;
                "
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
                  <line x1="5" y1="12" x2="19" y2="12"></line>
                </svg>
              </button>
              
              <button
                id="close-text-chat"
                style="
                  background: none;
                  border: none;
                  cursor: pointer;
                  padding: 5px;
                  border-radius: 50%;
                  display: flex;
                  align-items: center;
                  justify-content: center;
                  transition: all 0.2s ease;
                "
              >
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round">
                  <path d="M18 6L6 18M6 6l12 12"/>
                </svg>
              </button>
            </div>
          </div>
          
          <div style="padding-top: 15px;"> <!-- Add padding container for messages -->
            <!-- Initial suggestions -->
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
                  padding: 10px 15px;
                  border-radius: 17px;
                  cursor: pointer;
                  transition: all 0.2s ease;
                  color: white;
                  font-weight: 400;
                  text-align: left;
                  font-size: 14px;
                  box-shadow: 0 1px 1px rgba(0, 0, 0, 0.05);
                ">Loading suggestions...</div>
              </div>
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
            width: calc(100% - 24px); /* Ensure proper width */
          ">
            <div style="
              width: 30px;
              display: flex;
              justify-content: center;
              opacity: 0.6;
            ">
              <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#666" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                <circle cx="12" cy="12" r="10"></circle>
                <path d="M8 14s1.5 2 4 2 4-2 4-2"></path>
                <line x1="9" y1="9" x2="9.01" y2="9"></line>
                <line x1="15" y1="9" x2="15.01" y2="9"></line>
              </svg>
            </div>
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
              background: #882be6;
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

    // Remove onclick attributes and add event listeners
    if (minimizeBtn) {
      minimizeBtn.removeAttribute("onclick");
      minimizeBtn.addEventListener("click", () => this.minimizeChat());
    }

    if (maximizeBtn) {
      maximizeBtn.removeAttribute("onclick");
      maximizeBtn.addEventListener("click", () => this.maximizeChat());
    }

    if (closeBtn) {
      closeBtn.removeAttribute("onclick");
      closeBtn.addEventListener("click", () => this.closeTextChat());
    }

    if (clearBtn) {
      clearBtn.removeAttribute("onclick");
      clearBtn.addEventListener("click", () => this.clearChatHistory());
    }
  },

  // Clear chat history
  clearChatHistory: function () {
    // Clear localStorage message history

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

    this.messages = [];
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
            "check it out"
          );
          message = message.replace(
            /at (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
            "here"
          );
          message = message.replace(
            /here: (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
            "here"
          );
          message = message.replace(
            /at this link: (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
            "here"
          );
          message = message.replace(
            /visit (https?:\/\/[^\s]+|www\.[^\s]+|[^\s]+\.(com|org|net|io|co|shop|store|app)(\/?[^\s]*)?)/gi,
            "visit this page"
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
    console.log("Closing text chat interface");

    // Hide the shadow host (which contains the chat interface)
    const shadowHost = document.getElementById("voicero-text-chat-container");
    if (shadowHost) {
      shadowHost.style.display = "none";
    }

    // Show the microphone button when closing
    const toggleContainer = document.getElementById("voice-toggle-container");
    if (toggleContainer) {
      toggleContainer.style.display = "block";
      toggleContainer.style.visibility = "visible";
      toggleContainer.style.opacity = "1";
    }
  },

  // Minimize the chat interface
  minimizeChat: function () {
    console.log("Minimizing text chat interface");

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
      // Show the maximize button with absolute positioning and higher z-index
      maximizeBtn.style.display = "block";
      maximizeBtn.style.marginTop = "10px"; // Add top margin
    }

    if (messagesContainer) {
      // Hide all message content
      const allMessages = messagesContainer.querySelectorAll(
        ".user-message, .ai-message, #initial-suggestions"
      );
      allMessages.forEach((msg) => {
        msg.style.display = "none";
      });

      // Completely hide the messages container
      messagesContainer.style.maxHeight = "0";
      messagesContainer.style.minHeight = "0";
      messagesContainer.style.height = "0";
      messagesContainer.style.padding = "0";
      messagesContainer.style.margin = "0";
      messagesContainer.style.overflow = "hidden";
      messagesContainer.style.border = "none";
      messagesContainer.style.display = "none"; // Add display: none
      messagesContainer.style.visibility = "hidden"; // Add visibility: hidden
      messagesContainer.style.opacity = "0"; // Make fully transparent
      messagesContainer.style.position = "absolute"; // Take out of flow
      messagesContainer.style.pointerEvents = "none"; // Prevent any interaction

      // Also hide padding container inside
      const paddingContainer = messagesContainer.querySelector(
        "div[style*='padding-top: 15px']"
      );
      if (paddingContainer) {
        paddingContainer.style.display = "none";
        paddingContainer.style.height = "0";
        paddingContainer.style.padding = "0";
        paddingContainer.style.margin = "0";
      }
    }

    // Hide the header
    if (headerContainer) {
      headerContainer.style.display = "none";
    }

    // Adjust the input wrapper to connect with the button
    if (inputWrapper) {
      inputWrapper.style.borderRadius = "12px";
      inputWrapper.style.marginTop = "0";
    }

    // Force a redraw to ensure button is visible
    document.getElementById("voicero-text-chat-container").style.display =
      "none";
    setTimeout(() => {
      document.getElementById("voicero-text-chat-container").style.display =
        "block";
    }, 0);
  },

  // Maximize the chat interface
  maximizeChat: function () {
    console.log("Maximizing text chat interface");

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
      // Restore visibility first
      messagesContainer.style.display = "block";
      messagesContainer.style.visibility = "visible";
      messagesContainer.style.opacity = "1";
      messagesContainer.style.position = "relative";
      messagesContainer.style.pointerEvents = "auto";

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

      // Check if initial suggestions should be shown
      if (this.messages && this.messages.length === 0) {
        const suggestions = messagesContainer.querySelector(
          "#initial-suggestions"
        );
        if (suggestions) {
          suggestions.style.display = "block";
        }
      }

      // Restore the messages container height and padding
      messagesContainer.style.maxHeight = "35vh";
      messagesContainer.style.minHeight = "auto";
      messagesContainer.style.height = "auto";
      messagesContainer.style.padding = "15px";
      messagesContainer.style.paddingTop = "0";
      messagesContainer.style.margin = "0";
      messagesContainer.style.overflow = "auto";
      messagesContainer.style.border = "";
    }

    // Show the header
    if (headerContainer) {
      headerContainer.style.display = "flex";
    }

    // Restore input wrapper styling
    if (inputWrapper) {
      inputWrapper.style.borderRadius = "0 0 12px 12px";
      inputWrapper.style.marginTop = "0";
    }

    // Force a redraw to ensure elements are properly positioned
    document.getElementById("voicero-text-chat-container").style.display =
      "none";
    setTimeout(() => {
      document.getElementById("voicero-text-chat-container").style.display =
        "block";
    }, 0);
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
            div.style.color = "#882be6";
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
        console.error(
          "VoiceroCore not available after 50 attempts (5 seconds)"
        );
        // Initialize anyway to at least have the interface elements ready
        VoiceroText.init();
      }
    }, 100);
  }
});

// Expose global functions
window.VoiceroText = VoiceroText;
