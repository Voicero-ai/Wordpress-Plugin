/**
 * VoiceroAI Welcome Module
 * Handles welcome messages for both voice and text interfaces
 */

const VoiceroWelcome = {
  // Initialize the welcome module
  init: function () {
    console.log("VoiceroWelcome module initialized");

    // Check if we need to show welcome messages
    this.checkAndDisplayWelcomeMessages();

    // Listen for window state changes to show welcome when needed
    if (window.VoiceroCore) {
      // Create a MutationObserver to watch for changes in the session state
      this.setupSessionObserver();
    }
  },

  // Setup observer to watch for session state changes
  setupSessionObserver: function () {
    if (!window.VoiceroCore) return;

    // Check for changes to the session object every second
    this.sessionCheckInterval = setInterval(() => {
      if (window.VoiceroCore && window.VoiceroCore.session) {
        // Check if we need to show voice welcome
        if (
          window.VoiceroCore.session.voiceWelcome &&
          window.VoiceroCore.session.voiceOpen
        ) {
          this.showVoiceWelcome();

          // Update state to prevent showing welcome again
          if (window.VoiceroCore.updateWindowState) {
            window.VoiceroCore.updateWindowState({
              voiceWelcome: false,
            });
          }
        }

        // Check if we need to show text welcome
        if (
          window.VoiceroCore.session.textWelcome &&
          window.VoiceroCore.session.textOpen
        ) {
          this.showTextWelcome();

          // Update state to prevent showing welcome again
          if (window.VoiceroCore.updateWindowState) {
            window.VoiceroCore.updateWindowState({
              textWelcome: false,
            });
          }
        }
      }
    }, 1000);
  },

  // Check if welcome messages should be displayed based on current state
  checkAndDisplayWelcomeMessages: function () {
    if (!window.VoiceroCore || !window.VoiceroCore.session) return;

    // Check for voice welcome
    if (
      window.VoiceroCore.session.voiceWelcome &&
      window.VoiceroCore.session.voiceOpen
    ) {
      this.showVoiceWelcome();
    }

    // Check for text welcome
    if (
      window.VoiceroCore.session.textWelcome &&
      window.VoiceroCore.session.textOpen
    ) {
      this.showTextWelcome();
    }
  },

  // Show welcome message in voice interface
  showVoiceWelcome: function () {
    // Only proceed if voice interface is active
    if (!window.VoiceroVoice || !document.getElementById("voice-messages")) {
      console.log("Voice interface not ready for welcome message");
      return;
    }

    console.log("Showing voice welcome message");

    // Get website name if available
    const websiteName = this.getWebsiteName();

    // Create welcome message
    const welcomeMessage = this.getWelcomeMessage(websiteName, "voice");

    // Add the message to the voice interface
    window.VoiceroVoice.addMessage(welcomeMessage, "ai");

    // Update state to prevent showing welcome again
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      window.VoiceroCore.updateWindowState({
        voiceWelcome: false,
      });
    }
  },

  // Show welcome message in text interface
  showTextWelcome: function () {
    // Only proceed if text interface is active
    if (!window.VoiceroText || !window.VoiceroText.shadowRoot) {
      console.log("Text interface not ready for welcome message");
      return;
    }

    console.log("Showing text welcome message");

    // Get website name if available
    const websiteName = this.getWebsiteName();

    // Create welcome message
    const welcomeMessage = this.getWelcomeMessage(websiteName, "text");

    // Add the message to the text interface
    window.VoiceroText.addMessage(welcomeMessage, "ai");

    // Update state to prevent showing welcome again
    if (window.VoiceroCore && window.VoiceroCore.updateWindowState) {
      window.VoiceroCore.updateWindowState({
        textWelcome: false,
      });
    }
  },

  // Get website name from session if available
  getWebsiteName: function () {
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.website &&
      window.VoiceroCore.session.website.name
    ) {
      return window.VoiceroCore.session.website.name;
    }

    // Fallback: try to get name from document
    if (document.title) {
      // Extract just the site name (before " - " or " | " if present)
      const title = document.title;
      const separatorIndex = Math.min(
        title.indexOf(" - ") > -1 ? title.indexOf(" - ") : Infinity,
        title.indexOf(" | ") > -1 ? title.indexOf(" | ") : Infinity,
      );

      if (separatorIndex !== Infinity) {
        return title.substring(0, separatorIndex);
      }
      return title;
    }

    return "our website";
  },

  // Generate appropriate welcome message with personalization
  getWelcomeMessage: function (websiteName, interfaceType) {
    // Voice interface should have a shorter, more conversational message
    if (interfaceType === "voice") {
      return `👋 Welcome to ${websiteName}! I'm your AI assistant. You can ask me questions about products, services, or anything else about ${websiteName}. How can I help you today?`;
    }

    // Text interface can have a slightly longer message with more details
    return `👋 Welcome to ${websiteName}! 

I'm your AI assistant powered by VoiceroAI. I'm here to help answer your questions about products, services, or anything else related to ${websiteName}.

Feel free to ask me anything, and I'll do my best to assist you!`;
  },
};

// Initialize when document is ready
document.addEventListener("DOMContentLoaded", () => {
  // Wait for VoiceroCore to be available before initializing
  if (window.VoiceroCore) {
    VoiceroWelcome.init();
  } else {
    // Wait for VoiceroCore to be available
    let attempts = 0;
    const checkCoreInterval = setInterval(() => {
      attempts++;
      if (window.VoiceroCore) {
        clearInterval(checkCoreInterval);
        VoiceroWelcome.init();
      } else if (attempts >= 50) {
        clearInterval(checkCoreInterval);
        console.error("VoiceroCore not available after 50 attempts");
      }
    }, 100);
  }
});

// Expose to global scope
window.VoiceroWelcome = VoiceroWelcome;
