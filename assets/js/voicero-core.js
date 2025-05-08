/**
 * VoiceroAI Core Module - Minimal Version
 */

// Ensure compatibility with WordPress jQuery
(function ($, window, document) {
  const VoiceroCore = {
    apiBaseUrls: ["https://www.voicero.ai"],
    apiBaseUrl: null, // Store the working API URL
    apiConnected: false, // Track connection status
    session: null, // Store the current session
    thread: null, // Store the current thread
    websiteColor: "#882be6", // Default color if not provided by API
    isInitializingSession: false, // Track if a session initialization is in progress
    sessionInitialized: false, // Track if session is fully initialized
    isWebsiteActive: false, // Track website active status

    // Queue for pending window state updates
    pendingWindowStateUpdates: [],
    // Queue for pending session operations
    pendingSessionOperations: [],

    // Initialize on page load
    init: function () {
      // Set up global reference
      window.VoiceroCore = this;

      // Set initializing flag to prevent button flickering during startup
      this.isInitializing = true;

      // Create global property to track button visibility timeouts
      this.buttonVisibilityTimeouts = [];

      // Track website active status - default to false until verified by API
      this.isWebsiteActive = false;

      // BULLETPROOF FAILSAFE - Only set up if needed
      // We'll set this up after API check instead of immediately
      // this.setupButtonFailsafe();

      // Make sure apiConnected is false by default until we get a successful API response
      this.apiConnected = false;

      // Check if config is available
      if (typeof voiceroConfig !== "undefined") {
      } else {
      }

      // Step 1: First set up basic containers (but not the button yet)
      this.createTextChatInterface();
      this.createVoiceChatInterface();

      // Step 2: Initialize the API connection - this will create the button
      // only after we know the website color

      this.checkApiConnection();

      // Clear initializing flag after a delay
      setTimeout(() => {
        this.isInitializing = false;
      }, 2000);

      // Don't force the button to show here anymore - wait for API
      // setTimeout(() => {
      //   this.ensureMainButtonVisible();
      // }, 500);
    },

    // Initialize API connection - empty since we call checkApiConnection directly now
    initializeApiConnection: function () {
      // This method is now empty as we call checkApiConnection directly from init
    },

    // Set up event listeners
    setupEventListeners: function () {
      // Don't create the button here - wait for API connection first

      // Create chat interface elements that might be needed
      this.createTextChatInterface();
      this.createVoiceChatInterface();
    },

    // Create the main interface with the two option buttons
    createButton: function () {
      // DON'T SKIP BUTTON CREATION - Even if API isn't connected, we need the main button
      // Just log a warning instead of completely skipping
      if (!this.apiConnected) {
      }

      // Make sure theme colors are updated
      this.updateThemeColor();

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

      // Use the website color from API or default
      const themeColor = this.websiteColor || "#882be6";

      // Check if the container exists, otherwise append to body
      let container = document.getElementById("voicero-app-container");

      if (!container) {
        // If the WordPress-added container doesn't exist, create one on the body

        document.body.insertAdjacentHTML(
          "beforeend",
          `<div id="voicero-app-container"></div>`
        );
        container = document.getElementById("voicero-app-container");
      }

      // CRITICAL FIX: Always ensure the container is visible
      if (container) {
        container.style.display = "block";
        container.style.visibility = "visible";
        container.style.opacity = "1";
      }

      if (container) {
        // Create the button container inside the main container
        container.innerHTML = `<div id="voice-toggle-container"></div>`;
        const buttonContainer = document.getElementById(
          "voice-toggle-container"
        );

        if (buttonContainer) {
          // Apply styles directly to the element with !important to override injected styles
          buttonContainer.style.cssText = `
          position: fixed !important;
          bottom: 20px !important;
          right: 20px !important;
          z-index: 2147483647 !important; /* Maximum z-index value to ensure it's always on top */
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          margin: 0 !important;
          padding: 0 !important;
          transform: none !important;
          top: auto !important;
          left: auto !important;
        `;

          // Add the main button first
          buttonContainer.innerHTML = `
          <button id="chat-website-button" class="visible" style="background-color: ${themeColor}">
            <svg class="bot-icon" viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
            </svg>
          </button>
        `;

          // ALWAYS force visibility on all devices
          const chatButtonEl = document.getElementById("chat-website-button");
          if (chatButtonEl) {
            chatButtonEl.style.cssText = `
              background-color: ${themeColor};
              display: flex !important;
              visibility: visible !important;
              opacity: 1 !important;
              width: 50px !important;
              height: 50px !important;
              border-radius: 50% !important;
              justify-content: center !important;
              align-items: center !important;
              color: white !important;
              box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2) !important;
              border: none !important;
              cursor: pointer !important;
              transition: all 0.2s ease !important;
              padding: 0 !important;
              margin: 0 !important;
              position: relative !important;
              z-index: 2147483647 !important;
            `;
          }

          // Add the chooser as a separate element
          buttonContainer.insertAdjacentHTML(
            "beforeend",
            `
          <div
            id="interaction-chooser"
            style="
              position: fixed !important;
              bottom: 80px !important;
              right: 20px !important;
              z-index: 10001 !important;
              background-color: #c8c8c8 !important;
              border-radius: 12px !important;
              box-shadow: 6px 6px 0 ${themeColor} !important;
              padding: 15px !important;
              width: 280px !important;
              border: 1px solid rgb(0, 0, 0) !important;
              display: none !important;
              visibility: hidden !important;
              opacity: 0 !important;
              flex-direction: column !important;
              align-items: center !important;
              margin: 0 !important;
              transform: none !important;
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
            >
              <span style="font-weight: 700; color: rgb(0, 0, 0); font-size: 18px; width: 100%; text-align: center;">
                Voice Conversation
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
            >
              <span style="font-weight: 700; color: rgb(0, 0, 0); font-size: 18px; width: 100%; text-align: center;">
                Message
              </span>
              <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" style="position: absolute; right: -50px; width: 35px; height: 35px;">
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
              </svg>
            </div>
          </div>
        `
          );

          // Add click handler for the main button to toggle the chooser
          const mainButton = document.getElementById("chat-website-button");
          const chooser = document.getElementById("interaction-chooser");

          if (mainButton && chooser) {
            mainButton.addEventListener("click", function (e) {
              e.preventDefault();
              e.stopPropagation();

              // Check if any interfaces are open and close them (acting as home button)
              const voiceInterface = document.getElementById(
                "voice-chat-interface"
              );
              const textInterface = document.getElementById(
                "voicero-text-chat-container"
              );

              let interfacesOpen = false;

              if (voiceInterface && voiceInterface.style.display === "block") {
                // Close voice interface
                if (window.VoiceroVoice && window.VoiceroVoice.closeVoiceChat) {
                  window.VoiceroVoice.closeVoiceChat();
                  interfacesOpen = true;
                } else {
                  voiceInterface.style.display = "none";
                  interfacesOpen = true;
                }
              }

              if (textInterface && textInterface.style.display === "block") {
                // Close text interface
                if (window.VoiceroText && window.VoiceroText.closeTextChat) {
                  window.VoiceroText.closeTextChat();
                  interfacesOpen = true;
                } else {
                  textInterface.style.display = "none";
                  interfacesOpen = true;
                }
              }

              // If no interfaces were open, then toggle the chooser
              if (!interfacesOpen) {
                // Get the current display style - needs to check computed style
                const computedStyle = window.getComputedStyle(chooser);
                const isVisible =
                  computedStyle.display !== "none" &&
                  computedStyle.visibility !== "hidden";

                if (isVisible) {
                  chooser.style.display = "none";
                  chooser.style.visibility = "hidden";
                  chooser.style.opacity = "0";
                } else {
                  chooser.style.display = "flex";
                  chooser.style.visibility = "visible";
                  chooser.style.opacity = "1";
                }
              }
            });
          }

          // Add click handlers for voice and text buttons
          const voiceButton = document.getElementById("voice-chooser-button");
          const textButton = document.getElementById("text-chooser-button");

          if (voiceButton) {
            // Remove the inline onclick attribute
            voiceButton.removeAttribute("onclick");

            // Add event listener to open voice chat and update window state
            voiceButton.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();

              // Hide the chooser
              if (chooser) {
                chooser.style.display = "none";
                chooser.style.visibility = "hidden";
                chooser.style.opacity = "0";
              }

              // Update window state first (set voice open flags)
              // REMOVED: Let openVoiceChat handle its own state update
              // this.updateWindowState({
              //   voiceOpen: true,
              //   voiceOpenWindowUp: true,
              //   textOpen: false,
              //   textOpenWindowUp: false,
              // });

              // Open the voice interface
              if (window.VoiceroVoice && window.VoiceroVoice.openVoiceChat) {
                window.VoiceroVoice.openVoiceChat();
                // Force maximize after opening
                setTimeout(() => {
                  if (
                    window.VoiceroVoice &&
                    window.VoiceroVoice.maximizeVoiceChat
                  ) {
                    window.VoiceroVoice.maximizeVoiceChat();
                  }
                }, 100);
              }
            });
          }

          if (textButton) {
            // Remove the inline onclick attribute
            textButton.removeAttribute("onclick");

            // Add event listener to open text chat and update window state
            textButton.addEventListener("click", (e) => {
              e.preventDefault();
              e.stopPropagation();

              // Hide the chooser
              if (chooser) {
                chooser.style.display = "none";
                chooser.style.visibility = "hidden";
                chooser.style.opacity = "0";
              }

              // Update window state first (set text open flags)
              // REMOVED: Let openTextChat handle its own state update
              // this.updateWindowState({
              //   textOpen: true,
              //   textOpenWindowUp: true,
              //   voiceOpen: false,
              //   voiceOpenWindowUp: false,
              // });

              // Open the text interface
              if (window.VoiceroText && window.VoiceroText.openTextChat) {
                window.VoiceroText.openTextChat();
                // Force maximize after opening
                setTimeout(() => {
                  if (window.VoiceroText && window.VoiceroText.maximizeChat) {
                    window.VoiceroText.maximizeChat();
                  }
                }, 100);
              }
            });
          }
        } else {
        }
      } else {
      }
    },

    // Create text chat interface (basic container elements)
    createTextChatInterface: function () {
      // Check if text chat interface already exists
      if (document.getElementById("voicero-text-chat-container")) {
        return;
      }

      // Get the container or create it if not exists
      let container = document.getElementById("voicero-app-container");
      if (!container) {
        document.body.insertAdjacentHTML(
          "beforeend",
          `<div id="voicero-app-container"></div>`
        );
        container = document.getElementById("voicero-app-container");
      }

      // Add the interface to the container
      if (container) {
        container.insertAdjacentHTML(
          "beforeend",
          `<div id="voicero-text-chat-container" style="display: none;"></div>`
        );
      } else {
      }
    },

    // Create voice chat interface (basic container elements)
    createVoiceChatInterface: function () {
      // Check if voice chat interface already exists
      if (document.getElementById("voice-chat-interface")) {
        return;
      }

      // Get the container or create it if not exists
      let container = document.getElementById("voicero-app-container");
      if (!container) {
        document.body.insertAdjacentHTML(
          "beforeend",
          `<div id="voicero-app-container"></div>`
        );
        container = document.getElementById("voicero-app-container");
      }

      // Add the interface to the container
      if (container) {
        container.insertAdjacentHTML(
          "beforeend",
          `<div id="voice-chat-interface" style="display: none;"></div>`
        );
      } else {
      }
    },

    // Format markdown (helper function that may be used by modules)
    formatMarkdown: function (text) {
      if (!text) return "";

      // Replace links
      text = text.replace(
        /\[([^\]]+)\]\(([^)]+)\)/g,
        '<a href="$2" class="chat-link" target="_blank">$1</a>'
      );

      // Replace bold
      text = text.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");

      // Replace italics
      text = text.replace(/\*([^*]+)\*/g, "<em>$1</em>");

      // Replace line breaks
      text = text.replace(/\n/g, "<br>");

      return text;
    },

    // Check API connection
    checkApiConnection: function () {
      // Use WordPress REST API proxy endpoint instead of direct API call
      const proxyUrl = "/wp-json/voicero/v1/connect";

      fetch(proxyUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
          // No Authorization header needed - proxy handles it
        },
      })
        .then((response) => {
          // Check if the response status is not 200
          if (!response.ok) {
            // Set connection status to false since we got an error
            this.apiConnected = false;
            this.isWebsiteActive = false; // Mark site as inactive
            this.hideMainButton(); // Hide button on API failure
            throw new Error(`API validation failed: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          // Store the working API URL
          this.apiBaseUrl = this.apiBaseUrls[0]; // Just use first URL since proxy handles actual endpoint

          // Check if the website exists and is active
          if (!data.website || data.website.active !== true) {
            this.apiConnected = false;
            this.isWebsiteActive = false; // Mark site as inactive

            // Force hide the button
            this.hideMainButton();

            // Force removal of any existing buttons
            this.removeAllButtons();

            return; // Exit early
          }

          // Only set apiConnected to true if we have a website and it's active
          this.apiConnected = true;
          this.isWebsiteActive = true; // Mark site as active

          // Store website ID for session management
          if (data.website.id) {
            this.websiteId = data.website.id;

            // Store website color from API response, default to #882be6 if not provided
            this.websiteColor = data.website.color
              ? data.website.color
              : "#882be6";

            // Update CSS variables with the theme color
            this.updateThemeColor(this.websiteColor);

            // ALWAYS ensure main button is visible when website is active
            this.ensureMainButtonVisible();

            // NOW set up the failsafe (only for active sites)
            this.setupButtonFailsafe();

            // Don't create the button yet - wait for session initialization
            // We'll make sure initializeSession will call createButton when done

            // Initialize session after successful connection
            this.initializeSession();
          } else {
            this.apiConnected = false;
            this.isWebsiteActive = false; // Mark site as inactive
            this.hideMainButton(); // Hide button if no website ID
            this.removeAllButtons(); // Force remove all buttons
            return; // Exit early, don't create button
          }

          // Enable voice and text functions regardless of session
          if (window.VoiceroVoice) {
            window.VoiceroVoice.apiBaseUrl = this.apiBaseUrl;
            window.VoiceroVoice.websiteColor = this.websiteColor;
          }

          if (window.VoiceroText) {
            window.VoiceroText.apiBaseUrl = this.apiBaseUrl;
            window.VoiceroText.websiteColor = this.websiteColor;
          }
        })
        .catch((error) => {
          // Set connection status to false since we got an error
          this.apiConnected = false;
          this.isWebsiteActive = false; // Mark site as inactive
          this.hideMainButton(); // Hide button on any error
          this.removeAllButtons(); // Force remove all buttons

          // Ensure no UI elements are created in error case
        });
    },

    // Hide the main website button
    hideMainButton: function () {
      // Cancel any pending visibility calls that might conflict
      if (this.buttonVisibilityTimeouts) {
        this.buttonVisibilityTimeouts.forEach((timeoutId) =>
          clearTimeout(timeoutId)
        );
      }
      this.buttonVisibilityTimeouts = [];

      // Hide toggle container with comprehensive styles
      const toggleContainer = document.getElementById("voice-toggle-container");
      if (toggleContainer) {
        toggleContainer.style.cssText = `
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          z-index: -1 !important;
          height: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
        `;
      }

      // Hide main button with comprehensive styles
      const mainButton = document.getElementById("chat-website-button");
      if (mainButton) {
        mainButton.style.cssText = `
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          z-index: -1 !important;
          height: 0 !important;
          width: 0 !important;
          overflow: hidden !important;
          position: absolute !important;
        `;
      }

      // Hide the chooser as well if it exists
      const chooser = document.getElementById("interaction-chooser");
      if (chooser) {
        chooser.style.cssText = `
          display: none !important;
          visibility: hidden !important;
          opacity: 0 !important;
          pointer-events: none !important;
          z-index: -1 !important;
        `;
      }

      // Set a flag in the object to remember button is hidden
      this._buttonHidden = true;
    },

    // Initialize session - check localStorage first or create new session
    initializeSession: function () {
      // Prevent multiple initialization attempts at the same time
      if (this.isInitializingSession) {
        return;
      }

      // Mark that initialization is in progress
      this.isInitializingSession = true;

      // Check if we have a saved sessionId in localStorage
      const savedSessionId = localStorage.getItem("voicero_session_id");

      try {
        // Verify localStorage is actually working
        localStorage.setItem("voicero_test", "test");
        if (localStorage.getItem("voicero_test") !== "test") {
          // If localStorage isn't working, just create a new session
          this.createSession();
          return;
        }
        localStorage.removeItem("voicero_test");
      } catch (e) {
        // If localStorage isn't available, just create a new session
        this.createSession();
        return;
      }

      if (
        savedSessionId &&
        typeof savedSessionId === "string" &&
        savedSessionId.trim() !== ""
      ) {
        // Try to get the existing session
        this.getSession(savedSessionId);
      } else {
        // Create a new session
        this.createSession();
      }
    },

    // Process any pending window state updates
    processPendingWindowStateUpdates: function () {
      if (this.pendingWindowStateUpdates.length === 0 || !this.sessionId) {
        return;
      }

      // Process each pending update
      for (const update of this.pendingWindowStateUpdates) {
        this.updateWindowState(update);
      }

      // Clear the queue
      this.pendingWindowStateUpdates = [];
    },

    // Get an existing session by ID
    getSession: function (sessionId) {
      if (!this.websiteId || !sessionId) {
        this.isInitializingSession = false; // Reset flag even in error case
        return;
      }

      // Ask our REST proxy for this specific sessionId
      const proxyUrl = `/wp-json/voicero/v1/session?sessionId=${sessionId}`;

      fetch(proxyUrl, {
        method: "GET",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
      })
        .then((response) => {
          if (!response.ok) {
            // If we can't get the session, try creating a new one
            if (response.status === 404) {
              // Set a flag to indicate we're calling from getSession to prevent checks
              this.createSessionFromGetSession();
              return null;
            }
            throw new Error(`Session request failed: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          if (!data) return; // Handle the case where we're creating a new session

          this.session = data.session;

          // Get the most recent thread
          if (
            data.session &&
            data.session.threads &&
            data.session.threads.length > 0
          ) {
            this.thread = data.session.threads[0];
          }

          // Log detailed session info
          if (data.session) {
          }

          // Store session ID in global variable and localStorage
          if (data.session && data.session.id) {
            this.sessionId = data.session.id;
            localStorage.setItem("voicero_session_id", data.session.id);

            // Process any pending window state updates now that we have a sessionId
            this.processPendingWindowStateUpdates();

            // Ensure button visibility after session is established
            this.ensureMainButtonVisible();
          }

          // Make session available to other modules
          if (window.VoiceroText) {
            window.VoiceroText.session = this.session;
            window.VoiceroText.thread = this.thread;
          }

          if (window.VoiceroVoice) {
            window.VoiceroVoice.session = this.session;
            window.VoiceroVoice.thread = this.thread;
          }

          // Restore interface state based on session flags
          this.restoreInterfaceState();

          // Mark session as initialized and no longer initializing
          this.sessionInitialized = true;
          this.isInitializingSession = false;
        })
        .catch((error) => {
          // Reset initialization flag in error case
          this.isInitializingSession = false;

          // Try creating a new session as fallback
          this.createSessionFromGetSession();
        });
    },

    // Restore interface state based on session flags
    restoreInterfaceState: function () {
      if (!this.session) return;

      // Create a flag to track if we need to hide the button
      const shouldHideButton =
        this.session.textOpen === true || this.session.voiceOpen === true;

      // Hide the button first if needed, before any interface operations
      if (shouldHideButton) {
        // Hide button immediately to prevent flickering
        this.hideMainButton();

        // Set a flag to indicate we're currently restoring an interface
        this.isRestoringInterface = true;

        // Cancel any pending button visibility calls
        if (this.buttonVisibilityTimeouts) {
          this.buttonVisibilityTimeouts.forEach((timeoutId) =>
            clearTimeout(timeoutId)
          );
        }
        this.buttonVisibilityTimeouts = [];

        // Add more aggressive button hiding with multiple timers
        setTimeout(() => this.hideMainButton(), 100);
        setTimeout(() => this.hideMainButton(), 500);
        setTimeout(() => this.hideMainButton(), 1000);
        setTimeout(() => this.hideMainButton(), 2000);
      } else {
        // No interfaces open, ensure button is visible
        this.ensureMainButtonVisible();

        // Clear initialization flag after we've determined no interfaces need to be opened
        this.isInitializing = false;
        return;
      }

      // One-time function to ensure button stays hidden
      const ensureButtonHidden = () => {
        const toggleContainer = document.getElementById(
          "voice-toggle-container"
        );
        if (toggleContainer) {
          toggleContainer.style.cssText = `
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: -1 !important;
          `;
        }

        const mainButton = document.getElementById("chat-website-button");
        if (mainButton) {
          mainButton.style.cssText = `
            display: none !important;
            visibility: hidden !important;
            opacity: 0 !important;
            pointer-events: none !important;
            z-index: -1 !important;
          `;
        }
      };

      // Check if text interface should be open
      if (this.session.textOpen === true) {
        // Make sure VoiceroText is initialized
        if (window.VoiceroText) {
          // Open the text chat (will always open maximized now)
          window.VoiceroText.openTextChat();

          // AFTER opening, check if it should be minimized based on session
          if (this.session.textOpenWindowUp === false) {
            // Use setTimeout to allow the interface to render first
            setTimeout(() => {
              if (window.VoiceroText && window.VoiceroText.minimizeChat) {
                window.VoiceroText.minimizeChat();
              }
            }, 100); // Small delay
          }

          // Multiple timeouts to ensure button stays hidden
          this.buttonVisibilityTimeouts = [
            setTimeout(() => ensureButtonHidden(), 300),
            setTimeout(() => ensureButtonHidden(), 800),
            setTimeout(() => ensureButtonHidden(), 1500),
            setTimeout(() => ensureButtonHidden(), 3000),
          ];
        }
      }
      // Check if voice interface should be open
      else if (this.session.voiceOpen === true) {
        // Make sure VoiceroVoice is initialized
        if (window.VoiceroVoice) {
          // Open voice chat
          window.VoiceroVoice.openVoiceChat();

          // Check if it should be minimized
          if (this.session.voiceOpenWindowUp === false) {
            setTimeout(() => {
              if (
                window.VoiceroVoice &&
                window.VoiceroVoice.minimizeVoiceChat
              ) {
                window.VoiceroVoice.minimizeVoiceChat();
              }
            }, 500); // Short delay to ensure interface is fully open first
          }

          // Check if auto mic should be activated
          if (this.session.autoMic === true) {
            setTimeout(() => {
              if (window.VoiceroVoice && window.VoiceroVoice.toggleMic) {
                window.VoiceroVoice.toggleMic();
              }
            }, 1000); // Longer delay for mic activation
          }

          // Multiple timeouts to ensure button stays hidden
          this.buttonVisibilityTimeouts = [
            setTimeout(() => ensureButtonHidden(), 300),
            setTimeout(() => ensureButtonHidden(), 800),
            setTimeout(() => ensureButtonHidden(), 1500),
            setTimeout(() => ensureButtonHidden(), 3000),
          ];
        }
      }

      // Clear restoration flag after a short delay
      setTimeout(() => {
        this.isRestoringInterface = false;

        // Also clear initialization flag after interface restoration is complete
        this.isInitializing = false;

        // One final check to make sure button stays hidden if interfaces are open
        if (this.session.textOpen === true || this.session.voiceOpen === true) {
          this.hideMainButton();
        }
      }, 2000);
    },

    // Create a new session specifically called from getSession
    createSessionFromGetSession: function () {
      // This is a wrapper to avoid infinite loops

      // Always allow this call to proceed even if isInitializingSession is true
      this.isInitializingSession = false;
      this.createSession();
    },

    // Create a new session
    createSession: function () {
      if (!this.websiteId) {
        this.isInitializingSession = false; // Reset flag even in error case
        return;
      }

      // NEVER SKIP - Force proceed even if already initializing
      if (this.isInitializingSession) {
        // Force reset the flag to allow a new attempt
        this.isInitializingSession = false;
      }

      // Set the initializing flag
      this.isInitializingSession = true;

      const proxyUrl = "/wp-json/voicero/v1/session";
      const requestBody = JSON.stringify({
        websiteId: this.websiteId,
      });

      try {
        // Use a longer timeout and add more detailed error handling
        const fetchPromise = fetch(proxyUrl, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: requestBody,
        });

        // Add a timeout to detect if fetch is hanging
        const timeoutPromise = new Promise((_, reject) => {
          setTimeout(
            () => reject(new Error("Fetch timeout - server not responding")),
            10000
          );
        });

        // Race between fetch and timeout
        Promise.race([fetchPromise, timeoutPromise])
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Create session failed: ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {
            // Store session and thread data
            if (data.session) {
              this.session = data.session;

              // Log detailed session info
            }

            if (data.thread) {
              this.thread = data.thread;

              // Log detailed thread info
            } else if (
              data.session &&
              data.session.threads &&
              data.session.threads.length > 0
            ) {
              this.thread = data.session.threads[0];

              // Log detailed thread info
            }

            // Store session ID in localStorage for persistence
            if (data.session && data.session.id) {
              // Validate the session ID format
              const sessionId = data.session.id;
              if (typeof sessionId !== "string" || sessionId.trim() === "") {
              } else {
                this.sessionId = sessionId;

                try {
                  // Attempt to save to localStorage with error handling
                  localStorage.setItem("voicero_session_id", sessionId);

                  // Verify it was saved correctly
                  const verifiedId = localStorage.getItem("voicero_session_id");
                  if (verifiedId !== sessionId) {
                  } else {
                  }
                } catch (e) {}

                // Process any pending window state updates now that we have a sessionId
                this.processPendingWindowStateUpdates();
              }
            } else {
            }

            // Make session available to other modules
            if (window.VoiceroText) {
              window.VoiceroText.session = this.session;
              window.VoiceroText.thread = this.thread;
            }

            if (window.VoiceroVoice) {
              window.VoiceroVoice.session = this.session;
              window.VoiceroVoice.thread = this.thread;
            }

            // For new sessions, also check if we need to restore interface state
            // (this may be the case if server remembered state but client lost its cookie)
            this.restoreInterfaceState();

            // Mark session as initialized and no longer initializing
            this.sessionInitialized = true;
            this.isInitializingSession = false;

            // Now create the button since we have a session

            this.createButton();
          })
          .catch((error) => {
            // Make a direct AJAX call as a fallback to see if that works better
            this._createSessionFallback();
          });
      } catch (error) {
        // Reset initialization flags in error case
        this.isInitializingSession = false;
        this.sessionInitialized = false;

        // Create the button anyway, since we at least have website info

        this.createButton();
      }
    },

    // Fallback method to try creating a session using jQuery AJAX
    _createSessionFallback: function () {
      // Only run if jQuery is available
      if (typeof $ === "undefined") {
        this.isInitializingSession = false;
        this.sessionInitialized = false;
        this.createButton();
        return;
      }

      $.ajax({
        url: "/wp-json/voicero/v1/session",
        type: "POST",
        data: JSON.stringify({ websiteId: this.websiteId }),
        contentType: "application/json",
        dataType: "json",
        success: (data) => {
          if (data.session && data.session.id) {
            this.session = data.session;
            this.sessionId = data.session.id;

            try {
              localStorage.setItem("voicero_session_id", data.session.id);
            } catch (e) {}
          }

          this.sessionInitialized = true;
          this.isInitializingSession = false;
          this.createButton();
        },
        error: (xhr, status, error) => {
          this.isInitializingSession = false;
          this.sessionInitialized = false;
          this.createButton();
        },
      });
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

    // Ensure the main button is always visible
    ensureMainButtonVisible: function () {
      // Don't show button if we're currently restoring an interface that should have it hidden
      if (this.isRestoringInterface || this.isInitializing) {
        return;
      }

      // Do a more thorough check of session state
      if (this.session) {
        if (this.session.textOpen === true || this.session.voiceOpen === true) {
          // Don't show button if text or voice interfaces are open
          this.hideMainButton();
          return;
        }
      }

      // Also check if any interfaces are currently visible in the DOM
      const textInterface = document.getElementById(
        "voicero-text-chat-container"
      );
      if (
        textInterface &&
        window.getComputedStyle(textInterface).display === "block"
      ) {
        this.hideMainButton();
        return;
      }

      const voiceInterface = document.getElementById("voice-chat-interface");
      if (
        voiceInterface &&
        window.getComputedStyle(voiceInterface).display === "block"
      ) {
        this.hideMainButton();
        return;
      }

      // Make sure the container is visible
      const container = document.getElementById("voicero-app-container");
      if (container) {
        container.style.display = "block";
        container.style.visibility = "visible";
        container.style.opacity = "1";
      }

      // Make sure button container is visible
      const buttonContainer = document.getElementById("voice-toggle-container");
      if (buttonContainer) {
        buttonContainer.style.display = "block";
        buttonContainer.style.visibility = "visible";
        buttonContainer.style.opacity = "1";

        // Apply critical positioning styles
        buttonContainer.style.cssText = `
          position: fixed !important;
          bottom: 20px !important;
          right: 20px !important;
          z-index: 2147483647 !important;
          display: block !important;
          visibility: visible !important;
          opacity: 1 !important;
          margin: 0 !important;
          padding: 0 !important;
          transform: none !important;
          top: auto !important;
          left: auto !important;
        `;
      }

      // Make sure the main button is visible
      const mainButton = document.getElementById("chat-website-button");
      if (mainButton) {
        const themeColor = this.websiteColor || "#882be6";
        mainButton.style.cssText = `
          background-color: ${themeColor};
          display: flex !important;
          visibility: visible !important;
          opacity: 1 !important;
          width: 50px !important;
          height: 50px !important;
          border-radius: 50% !important;
          justify-content: center !important;
          align-items: center !important;
          color: white !important;
          box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2) !important;
          border: none !important;
          cursor: pointer !important;
          transition: all 0.2s ease !important;
          padding: 0 !important;
          margin: 0 !important;
          position: relative !important;
          z-index: 2147483647 !important;
        `;
      }
    },

    // Add control buttons to interface
    addControlButtons: function (container, type) {
      // This function can be called by VoiceroText or VoiceroVoice
      // to add common control elements
    },

    // Update window state via API
    updateWindowState: function (windowState) {
      // Check if session initialization is in progress
      if (this.isInitializingSession) {
        this.pendingWindowStateUpdates.push(windowState);
        return;
      }

      // Check if we have a session ID
      if (!this.sessionId) {
        // Add to pending updates queue
        this.pendingWindowStateUpdates.push(windowState);

        // If session is not initialized yet, trigger initialization
        if (!this.sessionInitialized && !this.isInitializingSession) {
          this.initializeSession();
        }

        // Immediately update local session values even without sessionId
        if (this.session) {
          // Update our local session with new values
          Object.assign(this.session, windowState);

          // Propagate the immediate updates to other modules
          if (window.VoiceroText) {
            window.VoiceroText.session = this.session;
          }

          if (window.VoiceroVoice) {
            window.VoiceroVoice.session = this.session;
          }
        }

        return;
      }

      // Immediately update local session values for instant access
      if (this.session) {
        // Update our local session with new values
        Object.assign(this.session, windowState);

        // Propagate the immediate updates to other modules
        if (window.VoiceroText) {
          window.VoiceroText.session = this.session;
        }

        if (window.VoiceroVoice) {
          window.VoiceroVoice.session = this.session;
        }
      }

      // Store the values we need for the API call to avoid timing issues
      const sessionIdForApi = this.sessionId;
      const windowStateForApi = { ...windowState };

      // Use setTimeout to ensure the API call happens after navigation
      setTimeout(() => {
        // Verify we have a valid sessionId
        if (
          !sessionIdForApi ||
          typeof sessionIdForApi !== "string" ||
          sessionIdForApi.trim() === ""
        ) {
          return;
        }

        // Make API call to persist the changes
        const proxyUrl = "/wp-json/voicero/v1/window_state";

        // Format the request body to match what the Next.js API expects
        const requestBody = {
          sessionId: sessionIdForApi,
          windowState: windowStateForApi,
        };

        fetch(proxyUrl, {
          method: "POST",
          headers: {
            Accept: "application/json",
            "Content-Type": "application/json",
          },
          body: JSON.stringify(requestBody),
        })
          .then((response) => {
            if (!response.ok) {
              throw new Error(`Window state update failed: ${response.status}`);
            }
            return response.json();
          })
          .then((data) => {
            // Update our local session data with the full server response
            if (data.session) {
              // Need to update the global VoiceroCore session
              if (window.VoiceroCore) {
                window.VoiceroCore.session = data.session;
              }

              // Propagate the updated session to other modules
              if (window.VoiceroText) {
                window.VoiceroText.session = data.session;
              }

              if (window.VoiceroVoice) {
                window.VoiceroVoice.session = data.session;
              }
            }
          })
          .catch((error) => {});
      }, 0);
    },

    // Update theme color in CSS variables
    updateThemeColor: function (color) {
      if (!color) color = this.websiteColor;

      // Update CSS variables with the theme color
      document.documentElement.style.setProperty(
        "--voicero-theme-color",
        color
      );

      // Create lighter and darker variants
      let lighterVariant = color;
      let hoverVariant = color;

      // If it's a hex color, we can calculate variants
      if (color.startsWith("#")) {
        try {
          // Convert hex to RGB for the lighter variant
          const r = parseInt(color.slice(1, 3), 16);
          const g = parseInt(color.slice(3, 5), 16);
          const b = parseInt(color.slice(5, 7), 16);

          // Create a lighter variant by adjusting brightness
          const lighterR = Math.min(255, Math.floor(r * 1.2));
          const lighterG = Math.min(255, Math.floor(g * 1.2));
          const lighterB = Math.min(255, Math.floor(b * 1.2));

          // Create a darker variant for hover
          const darkerR = Math.floor(r * 0.8);
          const darkerG = Math.floor(g * 0.8);
          const darkerB = Math.floor(b * 0.8);

          // Convert back to hex
          lighterVariant = `#${lighterR.toString(16).padStart(2, "0")}${lighterG
            .toString(16)
            .padStart(2, "0")}${lighterB.toString(16).padStart(2, "0")}`;
          hoverVariant = `#${darkerR.toString(16).padStart(2, "0")}${darkerG
            .toString(16)
            .padStart(2, "0")}${darkerB.toString(16).padStart(2, "0")}`;

          // Update the pulse animation with the current color
          const pulseStyle = document.createElement("style");
          pulseStyle.innerHTML = `
            @keyframes pulse {
              0% {
                box-shadow: 0 0 0 0 rgba(${r}, ${g}, ${b}, 0.4);
              }
              70% {
                box-shadow: 0 0 0 10px rgba(${r}, ${g}, ${b}, 0);
              }
              100% {
                box-shadow: 0 0 0 0 rgba(${r}, ${g}, ${b}, 0);
              }
            }
          `;

          // Remove any existing pulse style and add the new one
          const existingPulseStyle = document.getElementById(
            "voicero-pulse-style"
          );
          if (existingPulseStyle) {
            existingPulseStyle.remove();
          }

          pulseStyle.id = "voicero-pulse-style";
          document.head.appendChild(pulseStyle);
        } catch (e) {
          // Fallback to default variants
          lighterVariant = "#9370db";
          hoverVariant = "#7a5abf";
        }
      }

      // Set the variant colors
      document.documentElement.style.setProperty(
        "--voicero-theme-color-light",
        lighterVariant
      );
      document.documentElement.style.setProperty(
        "--voicero-theme-color-hover",
        hoverVariant
      );
    },

    // BULLETPROOF FAILSAFE to ensure button always exists and is visible
    setupButtonFailsafe: function () {
      // Only set up failsafe if website is active
      if (!this.isWebsiteActive) {
        return;
      }

      // Set multiple timers at different intervals to guarantee button creation
      setTimeout(() => this.createFailsafeButton(), 1000);
      setTimeout(() => this.createFailsafeButton(), 2000);
      setTimeout(() => this.createFailsafeButton(), 5000);

      // Also add window load event listener as an additional guarantee
      window.addEventListener("load", () => {
        // Check if site is active before creating button
        if (this.isWebsiteActive) {
          setTimeout(() => this.createFailsafeButton(), 500);
        }
      });

      // Add visibility change listener to ensure button when tab becomes visible
      document.addEventListener("visibilitychange", () => {
        if (document.visibilityState === "visible" && this.isWebsiteActive) {
          setTimeout(() => this.createFailsafeButton(), 300);
        }
      });
    },

    // Create a failsafe button if one doesn't exist
    createFailsafeButton: function () {
      // CRITICAL: Only create button if website is active
      if (!this.isWebsiteActive) {
        // Actually hide the button if it exists and site is inactive
        this.hideMainButton();
        return;
      }

      // Check if button already exists
      if (document.getElementById("chat-website-button")) {
        this.ensureMainButtonVisible();
        return;
      }

      // Create app container if it doesn't exist
      let container = document.getElementById("voicero-app-container");
      if (!container) {
        document.body.insertAdjacentHTML(
          "beforeend",
          `<div id="voicero-app-container" style="display:block!important;visibility:visible!important;opacity:1!important;"></div>`
        );
        container = document.getElementById("voicero-app-container");
      } else {
        // Force container visibility
        container.style.cssText =
          "display:block!important;visibility:visible!important;opacity:1!important;";
      }

      // Check if button container exists, create if not
      let buttonContainer = document.getElementById("voice-toggle-container");
      if (!buttonContainer) {
        container.insertAdjacentHTML(
          "beforeend",
          `<div id="voice-toggle-container" style="position:fixed!important;bottom:20px!important;right:20px!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;"></div>`
        );
        buttonContainer = document.getElementById("voice-toggle-container");
      } else {
        // Force button container visibility
        buttonContainer.style.cssText =
          "position:fixed!important;bottom:20px!important;right:20px!important;z-index:2147483647!important;display:block!important;visibility:visible!important;opacity:1!important;";
      }

      // If the main button does not exist, create it with absolute guaranteed visibility
      const chatButton = document.getElementById("chat-website-button");
      if (!chatButton && buttonContainer) {
        const themeColor = this.websiteColor || "#882be6";

        buttonContainer.insertAdjacentHTML(
          "beforeend",
          `<button id="chat-website-button" class="visible" style="background-color:${themeColor};display:flex!important;visibility:visible!important;opacity:1!important;width:50px!important;height:50px!important;border-radius:50%!important;justify-content:center!important;align-items:center!important;color:white!important;box-shadow:0 4px 15px rgba(0,0,0,0.2)!important;border:none!important;cursor:pointer!important;transition:all 0.2s ease!important;padding:0!important;margin:0!important;position:relative!important;z-index:2147483647!important;">
            <svg class="bot-icon" viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
            </svg>
          </button>`
        );
      }

      // ALWAYS add click handler to ensure the button works
      this.attachButtonClickHandler();

      // Final insurance: force both elements to be visible with inline styles
      const mainButton = document.getElementById("chat-website-button");
      if (mainButton) {
        mainButton.setAttribute(
          "style",
          `background-color:${
            this.websiteColor || "#882be6"
          };display:flex!important;visibility:visible!important;opacity:1!important;width:50px!important;height:50px!important;border-radius:50%!important;justify-content:center!important;align-items:center!important;color:white!important;box-shadow:0 4px 15px rgba(0,0,0,0.2)!important;border:none!important;cursor:pointer!important;transition:all 0.2s ease!important;padding:0!important;margin:0!important;position:relative!important;z-index:2147483647!important;`
        );
      }
    },

    // Attach bulletproof click handler to button
    attachButtonClickHandler: function () {
      const mainButton = document.getElementById("chat-website-button");
      if (!mainButton) return;

      // Remove existing listeners to prevent duplicates
      const newButton = mainButton.cloneNode(true);
      if (mainButton.parentNode) {
        mainButton.parentNode.replaceChild(newButton, mainButton);
      }

      // Add the new bulletproof click handler
      newButton.addEventListener("click", (e) => {
        e.preventDefault();
        e.stopPropagation();

        // Create chooser if it doesn't exist
        let chooser = document.getElementById("interaction-chooser");
        if (!chooser) {
          const themeColor = this.websiteColor || "#882be6";
          const buttonContainer = document.getElementById(
            "voice-toggle-container"
          );

          if (buttonContainer) {
            buttonContainer.insertAdjacentHTML(
              "beforeend",
              `<div
                id="interaction-chooser"
                style="
                  position: fixed !important;
                  bottom: 80px !important;
                  right: 20px !important;
                  z-index: 10001 !important;
                  background-color: #c8c8c8 !important;
                  border-radius: 12px !important;
                  box-shadow: 6px 6px 0 ${themeColor} !important;
                  padding: 15px !important;
                  width: 280px !important;
                  border: 1px solid rgb(0, 0, 0) !important;
                  display: none !important;
                  visibility: hidden !important;
                  opacity: 0 !important;
                  flex-direction: column !important;
                  align-items: center !important;
                  margin: 0 !important;
                  transform: none !important;
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
                >
                  <span style="font-weight: 700; color: rgb(0, 0, 0); font-size: 18px; width: 100%; text-align: center;">
                    Voice Conversation
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
                >
                  <span style="font-weight: 700; color: rgb(0, 0, 0); font-size: 18px; width: 100%; text-align: center;">
                    Message
                  </span>
                  <svg width="35" height="35" viewBox="0 0 24 24" fill="none" stroke="black" stroke-width="2" style="position: absolute; right: -50px; width: 35px; height: 35px;">
                    <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>
                  </svg>
                </div>
              </div>`
            );

            chooser = document.getElementById("interaction-chooser");

            // Add click handlers to the new options
            const voiceButton = document.getElementById("voice-chooser-button");
            if (voiceButton) {
              voiceButton.addEventListener("click", () => {
                if (chooser) {
                  chooser.style.display = "none";
                }

                // Create voice interface if needed
                let voiceInterface = document.getElementById(
                  "voice-chat-interface"
                );
                if (!voiceInterface) {
                  container.insertAdjacentHTML(
                    "beforeend",
                    `<div id="voice-chat-interface" style="display: none;"></div>`
                  );
                }

                // Try to open voice interface
                if (window.VoiceroVoice && window.VoiceroVoice.openVoiceChat) {
                  window.VoiceroVoice.openVoiceChat();
                  // Force maximize after opening
                  setTimeout(() => {
                    if (
                      window.VoiceroVoice &&
                      window.VoiceroVoice.maximizeVoiceChat
                    ) {
                      window.VoiceroVoice.maximizeVoiceChat();
                    }
                  }, 100);
                }
              });
            }

            const textButton = document.getElementById("text-chooser-button");
            if (textButton) {
              textButton.addEventListener("click", () => {
                if (chooser) {
                  chooser.style.display = "none";
                }

                // Create text interface if needed
                let textInterface = document.getElementById(
                  "voicero-text-chat-container"
                );
                if (!textInterface) {
                  container.insertAdjacentHTML(
                    "beforeend",
                    `<div id="voicero-text-chat-container" style="display: none;"></div>`
                  );
                }

                // Try to open text interface
                if (window.VoiceroText && window.VoiceroText.openTextChat) {
                  window.VoiceroText.openTextChat();
                  // Force maximize after opening
                  setTimeout(() => {
                    if (window.VoiceroText && window.VoiceroText.maximizeChat) {
                      window.VoiceroText.maximizeChat();
                    }
                  }, 100);
                }
              });
            }
          }
        }

        // If chooser exists now, show it
        chooser = document.getElementById("interaction-chooser");
        if (chooser) {
          // Check current visibility
          const computedStyle = window.getComputedStyle(chooser);
          const isVisible =
            computedStyle.display !== "none" &&
            computedStyle.visibility !== "hidden";

          if (isVisible) {
            // Hide if already visible
            chooser.style.display = "none";
            chooser.style.visibility = "hidden";
            chooser.style.opacity = "0";
          } else {
            // Show if hidden
            chooser.style.display = "flex";
            chooser.style.visibility = "visible";
            chooser.style.opacity = "1";
          }
        } else {
          // Last resort - create direct interface
          const voiceInterface = document.getElementById(
            "voice-chat-interface"
          );
          if (voiceInterface) {
            voiceInterface.innerHTML = `<div style="position:fixed;bottom:20px;left:50%;transform:translateX(-50%);width:400px;height:500px;background:white;border-radius:12px;box-shadow:0 4px 20px rgba(0,0,0,0.2);z-index:999999;padding:20px;display:flex;flex-direction:column;border:1px solid #ccc;">
              <div style="display:flex;justify-content:space-between;align-items:center;border-bottom:1px solid #eee;padding-bottom:10px;margin-bottom:15px;">
                <h3 style="margin:0;font-size:18px;font-weight:600;">Voice Assistant</h3>
                <button id="emergency-voice-close" style="background:none;border:none;font-size:20px;cursor:pointer;">×</button>
              </div>
              <div style="flex:1;overflow-y:auto;padding:10px;">
                <p>The voice module is loading. Please try again in a moment.</p>
              </div>
            </div>`;
            voiceInterface.style.display = "block";

            // Add close button handler
            const closeBtn = document.getElementById("emergency-voice-close");
            if (closeBtn) {
              closeBtn.addEventListener("click", () => {
                voiceInterface.style.display = "none";
              });
            }
          }
        }
      });
    },

    // Force remove all buttons from the DOM
    removeAllButtons: function () {
      // Try to remove the toggle container completely
      const toggleContainer = document.getElementById("voice-toggle-container");
      if (toggleContainer && toggleContainer.parentNode) {
        toggleContainer.parentNode.removeChild(toggleContainer);
      }

      // Also look for any stray buttons
      const mainButton = document.getElementById("chat-website-button");
      if (mainButton && mainButton.parentNode) {
        mainButton.parentNode.removeChild(mainButton);
      }

      // Remove all chooser interfaces
      const chooser = document.getElementById("interaction-chooser");
      if (chooser && chooser.parentNode) {
        chooser.parentNode.removeChild(chooser);
      }
    },

    // Create the UI
    initializeUI: function () {
      // Set initializing flag to prevent multiple operations
      this.isInitializing = true;

      // Create global property to track button visibility timeouts
      this.buttonVisibilityTimeouts = [];

      // Create main container
      // ... existing code ...

      // After initialization, clear the flag with a short delay
      setTimeout(() => {
        this.isInitializing = false;
      }, 1000);
    },
  };

  // Initialize on DOM content loaded
  $(document).ready(function () {
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
})(jQuery, window, document);
