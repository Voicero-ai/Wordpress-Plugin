/**
 * VoiceroAI Core Module - Minimal Version
 */

const VoiceroCore = {
  apiBaseUrls: ["https://www.voicero.ai"],
  apiBaseUrl: null, // Store the working API URL
  apiConnected: false, // Track connection status
  appState: {
    isOpen: false,
    activeInterface: null,
    hasShownTextWelcome: false,
    messages: [],
    isTextMinimized: false,
  },

  // Initialize on page load
  init: function () {
    // Set up global reference
    window.VoiceroCore = this;

    // Don't create the interface immediately - wait for successful API connection
    // Check API connection - do this immediately
    if (window.voiceroConfig && window.voiceroConfig.accessKey) {
      this.checkApiConnection(window.voiceroConfig.accessKey);
    } else {
    }
  },

  // Create the main interface with the two option buttons
  createButton: function () {
    // Check if we should show the chooser or if an interface should auto-open
    const shouldAutoOpen =
      this.appState.isOpen && this.appState.activeInterface;

    // Add CSS Animations
    const styleEl = document.createElement("style");
    styleEl.innerHTML = `
      @keyframes fadeIn {
        from {
          opacity: 0;
          transform: translateY(20px);
        }
        to {
          opacity: 1;
          transform: translateY(0);
        }
      }
    `;
    document.head.appendChild(styleEl);

    document.body.insertAdjacentHTML(
      "beforeend",
      `
      <div id="voice-toggle-container" style="
        position: fixed;
        bottom: 40px;
        right: 20px;
        z-index: 10000;
        animation: fadeIn 0.5s ease forwards;
      ">
        <div
          id="interaction-chooser"
          style="
            position: relative;
            z-index: 10001;
            background-color: #c8c8c8;
            border-radius: 12px;
            box-shadow: 6px 6px 0 rgb(135, 24, 246);
            padding: 15px;
            width: 280px;
            border: 1px solid rgb(0, 0, 0);
            display: flex;
            flex-direction: column;
            align-items: center;
            ${shouldAutoOpen ? "visibility: hidden; opacity: 0;" : ""}
          "
        >
          <div
            id="voice-chooser-button"
            class="interaction-option voice"
            style="
              position: relative;
              display: flex;
              align-items: center;
              padding: 10px 10px;
              margin-bottom: 10px;
              margin-left: -30px;
              cursor: pointer;
              border-radius: 8px;
              background-color: white;
              border: 1px solid rgb(0, 0, 0);
              box-shadow: 4px 4px 0 rgb(0, 0, 0);
              transition: all 0.2s ease;
              width: 200px;
            "
            onmouseover="this.style.transform='translateY(-2px)'"
            onmouseout="this.style.transform='translateY(0)'"
            onclick="VoiceroVoice && VoiceroVoice.openVoiceChat()"
          >
            <span style="font-weight: 700; color: rgb(0, 0, 0); font-size: 18px; width: 100%; text-align: center;">
              Talk to Website
            </span>
            <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" style="position: absolute; right: -50px; width: 35px; height: 35px;">
              <path d="M12 1a3 3 0 0 0-3 3v8a3 3 0 0 0 6 0V4a3 3 0 0 0-3-3z"/>
              <path d="M19 10v2a7 7 0 0 1-14 0v-2"/>
              <path d="M12 19v4"/>
              <path d="M8 23h8"/>
            </svg>
          </div>

          <div
            id="text-chooser-button"
            class="interaction-option text"
            style="
              position: relative;
              display: flex;
              align-items: center;
              padding: 10px 10px;
              margin-left: -30px;
              cursor: pointer;
              border-radius: 8px;
              background-color: white;
              border: 1px solid rgb(0, 0, 0);
              box-shadow: 4px 4px 0 rgb(0, 0, 0);
              transition: all 0.2s ease;
              width: 200px;
            "
            onmouseover="this.style.transform='translateY(-2px)'"
            onmouseout="this.style.transform='translateY(0)'"
            onclick="VoiceroText && VoiceroText.openTextChat()"
          >
            <span style="font-weight: 700; color: rgb(0, 0, 0); font-size: 18px; width: 100%; text-align: center;">
              Chat with Website
            </span>
            <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" style="position: absolute; right: -50px; width: 35px; height: 35px;">
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
            </svg>
          </div>
        </div>
      </div>
      `,
    );

    // Also create chat interface elements that might be needed
    this.createTextChatInterface();
    this.createVoiceChatInterface();
  },

  // Create text chat interface (basic container elements)
  createTextChatInterface: function () {
    // Check if text chat interface already exists
    if (document.getElementById("text-chat-interface")) {
      return;
    }

    // Just create the basic container here - VoiceroText.js will handle the rest
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="text-chat-interface" style="display: none;"></div>`,
    );
  },

  // Create voice chat interface (basic container elements)
  createVoiceChatInterface: function () {
    // Check if voice chat interface already exists
    if (document.getElementById("voice-chat-interface")) {
      return;
    }

    // Just create the basic container here - VoiceroVoice.js will handle the rest
    document.body.insertAdjacentHTML(
      "beforeend",
      `<div id="voice-chat-interface" style="display: none;"></div>`,
    );
  },

  // Format markdown (helper function that may be used by modules)
  formatMarkdown: function (text) {
    if (!text) return "";

    // Replace links
    text = text.replace(
      /\[([^\]]+)\]\(([^)]+)\)/g,
      '<a href="$2" class="chat-link" target="_blank">$1</a>',
    );

    // Replace bold
    text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

    // Replace italics
    text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");

    // Replace line breaks
    text = text.replace(/\n/g, "<br>");

    return text;
  },

  // Save application state
  saveState: function () {
    // Save state to localStorage
    try {
      localStorage.setItem("voiceroAppState", JSON.stringify(this.appState));
    } catch (e) {
      console.error("Failed to save state to localStorage:", e);
    }
  },

  // Load application state
  loadState: function () {
    try {
      const savedState = localStorage.getItem("voiceroAppState");
      if (savedState) {
        const parsedState = JSON.parse(savedState);
        // Merge saved state with default state
        this.appState = { ...this.appState, ...parsedState };
        return true;
      }
    } catch (e) {
      console.error("Failed to load state from localStorage:", e);
    }
    return false;
  },

  // Check API connection
  checkApiConnection: function (accessKey) {
    // Try each URL in sequence
    let urlIndex = 0;

    const tryNextUrl = () => {
      if (urlIndex >= this.apiBaseUrls.length) {
        console.error("All API endpoints failed");
        return;
      }

      const currentUrl = this.apiBaseUrls[urlIndex];
      const apiUrl = `${currentUrl}/api/connect`;

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
          // Store the working API URL and update connection status
          this.apiBaseUrl = currentUrl;
          this.apiConnected = true;

          // Only create the button if service is active
          if (data.website && data.website.active === true) {
            // Load saved state from localStorage
            this.loadState();

            // Now create the button since we have a successful connection
            this.createButton();

            // Enable voice and text functions
            if (window.VoiceroVoice) {
              window.VoiceroVoice.apiBaseUrl = currentUrl;
            }

            if (window.VoiceroText) {
              window.VoiceroText.apiBaseUrl = currentUrl;
            }

            // Check if we should auto-open an interface
            if (this.appState.isOpen && this.appState.activeInterface) {
              // Wait a moment for all modules to initialize
              setTimeout(() => {
                if (
                  this.appState.activeInterface === "voice" &&
                  window.VoiceroVoice
                ) {
                  window.VoiceroVoice.openVoiceChat();
                } else if (
                  this.appState.activeInterface === "text" &&
                  window.VoiceroText
                ) {
                  window.VoiceroText.openTextChat();
                }
              }, 500);
            }
          } else {
          }
        })
        .catch((error) => {
          console.error(`API error with ${currentUrl}:`, error);

          // Try next URL
          urlIndex++;
          tryNextUrl();
        });
    };

    // Start trying URLs immediately
    tryNextUrl();
  },

  // Get the working API base URL
  getApiBaseUrl: function () {
    return this.apiBaseUrl || this.apiBaseUrls[0];
  },

  // Show the chooser interface when an active interface is closed
  showChooser: function () {
    const chooser = document.getElementById("interaction-chooser");
    if (chooser) {
      chooser.style.display = "flex";
      chooser.style.visibility = "visible";
      chooser.style.opacity = "1";
    }
  },

  // Add control buttons to interface
  addControlButtons: function (container, type) {
    // This function can be called by VoiceroText or VoiceroVoice
    // to add common control elements
  },
};

// Initialize on DOM content loaded
document.addEventListener("DOMContentLoaded", function () {
  VoiceroCore.init();
});

// Also initialize immediately if DOM is already loaded
if (
  document.readyState === "complete" ||
  document.readyState === "interactive"
) {
  setTimeout(function () {
    VoiceroCore.init();
  }, 1);
}

// Expose global functions
window.VoiceroCore = VoiceroCore;
