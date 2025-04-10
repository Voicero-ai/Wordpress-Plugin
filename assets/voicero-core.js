/**
 * VoiceroAI Core Module - Minimal Version
 */

// Ensure compatibility with WordPress jQuery
(function ($, window, document) {
  console.log("Voicero Core Script: Starting initialization");

  const VoiceroCore = {
    apiBaseUrls: ["http://localhost:3000"],
    apiBaseUrl: null, // Store the working API URL
    apiConnected: false, // Track connection status
    session: null, // Store the current session
    thread: null, // Store the current thread

    // Queue for pending window state updates
    pendingWindowStateUpdates: [],

    // Initialize on page load
    init: function () {
      console.log("Voicero Core Script: init() called");
      // Set up global reference
      window.VoiceroCore = this;

      // Check if config is available
      if (typeof aiWebsiteConfig !== "undefined") {
        console.log("Voicero Core Script: Config found", aiWebsiteConfig);
      } else {
        console.warn(
          "Voicero Core Script: No config found (aiWebsiteConfig is undefined)"
        );
      }

      // Initialize the API connection
      this.initializeApiConnection();

      // Set up event listeners
      this.setupEventListeners();

      console.log("Voicero Core Script: Initialization complete");
    },

    // Initialize API connection
    initializeApiConnection: function () {
      console.log("Voicero Core Script: Initializing API connection");
      // Don't create the interface immediately - wait for successful API connection
      // Check API connection - do this immediately
      this.checkApiConnection();
    },

    // Set up event listeners
    setupEventListeners: function () {
      console.log("Voicero Core Script: Setting up event listeners");
      // Create the main interface with the two option buttons
      this.createButton();

      // Also create chat interface elements that might be needed
      this.createTextChatInterface();
      this.createVoiceChatInterface();
    },

    // Create the main interface with the two option buttons
    createButton: function () {
      console.log("Voicero Core Script: Creating button interface");

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
      console.log("Voicero Core Script: Added CSS animations");

      // Check if the container exists, otherwise append to body
      let container = document.getElementById("voicero-app-container");

      if (!container) {
        // If the WordPress-added container doesn't exist, create one on the body
        console.log("Voicero Core Script: No container found, creating one");
        document.body.insertAdjacentHTML(
          "beforeend",
          `<div id="voicero-app-container"></div>`
        );
        container = document.getElementById("voicero-app-container");
      }

      if (container) {
        console.log(
          "Voicero Core Script: Container found, adding button interface"
        );

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
          <button id="chat-website-button" class="visible">
            <svg class="bot-icon" viewBox="0 0 24 24" width="24" height="24">
              <path fill="currentColor" d="M12,2A3,3 0 0,1 15,5V11A3,3 0 0,1 12,14A3,3 0 0,1 9,11V5A3,3 0 0,1 12,2M19,11C19,14.53 16.39,17.44 13,17.93V21H11V17.93C7.61,17.44 5,14.53 5,11H7A5,5 0 0,0 12,16A5,5 0 0,0 17,11H19Z"/>
            </svg>
          </button>
        `;

          // Force visibility on desktop
          if (window.innerWidth > 768) {
            const chatButton = document.getElementById("chat-website-button");
            if (chatButton) {
              chatButton.style.display = "flex";
              chatButton.style.visibility = "visible";
              chatButton.style.opacity = "1";
            }
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
              box-shadow: 6px 6px 0 rgb(135, 24, 246) !important;
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
          const chatButton = document.getElementById("chat-website-button");
          const chooser = document.getElementById("interaction-chooser");

          if (chatButton && chooser) {
            chatButton.addEventListener("click", function (e) {
              e.preventDefault();
              e.stopPropagation();

              console.log("Voicero Core Script: Chat button clicked");

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
              this.updateWindowState({
                voiceOpen: true,
                voiceOpenWindowUp: true,
                textOpen: false,
                textOpenWindowUp: false,
              });

              // Open the voice interface
              if (window.VoiceroVoice && window.VoiceroVoice.openVoiceChat) {
                window.VoiceroVoice.openVoiceChat();
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
              this.updateWindowState({
                textOpen: true,
                textOpenWindowUp: true,
                voiceOpen: false,
                voiceOpenWindowUp: false,
              });

              // Open the text interface
              if (window.VoiceroText && window.VoiceroText.openTextChat) {
                window.VoiceroText.openTextChat();
              }
            });
          }

          console.log(
            "Voicero Core Script: Button interface created successfully"
          );
        } else {
          console.error(
            "Voicero Core Script: Failed to create button container"
          );
        }
      } else {
        console.error(
          "Voicero Core Script: Could not find or create container"
        );
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
        console.log("Voicero Core Script: Text chat interface container added");
      } else {
        console.error(
          "Voicero Core Script: Could not create text chat interface"
        );
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
        console.log(
          "Voicero Core Script: Voice chat interface container added"
        );
      } else {
        console.error(
          "Voicero Core Script: Could not create voice chat interface"
        );
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
      console.log(
        "Voicero Core Script: Starting API connection check with proxy"
      );

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
          console.log(
            "Voicero Core Script: API response status:",
            response.status
          );
          if (!response.ok) {
            throw new Error(`API validation failed: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Voicero Core Script: Full API response:", data);
          console.log("Voicero Core Script: Website data:", data.website);
          console.log(
            "Voicero Core Script: Is website active?",
            data.website?.active
          );

          // Store the working API URL and update connection status
          this.apiBaseUrl = this.apiBaseUrls[0]; // Just use first URL since proxy handles actual endpoint
          this.apiConnected = true;

          // Store website ID for session management
          if (data.website && data.website.id) {
            this.websiteId = data.website.id;

            // Initialize session after successful connection
            this.initializeSession();
          }

          // Only create the button if service is active
          if (data.website && data.website.active === true) {
            console.log(
              "Voicero Core Script: Website is active, creating interface"
            );

            // Now create the button since we have a successful connection
            this.createButton();

            // Enable voice and text functions
            if (window.VoiceroVoice) {
              window.VoiceroVoice.apiBaseUrl = this.apiBaseUrl;
            }

            if (window.VoiceroText) {
              window.VoiceroText.apiBaseUrl = this.apiBaseUrl;
            }
          } else {
            console.warn(
              "Voicero Core Script: Website is not active in API response"
            );
          }
        })
        .catch((error) => {
          console.error(`Voicero Core Script: API error with proxy:`, error);
        });
    },

    // Initialize session - check localStorage first or create new session
    initializeSession: function () {
      // Check if we have a saved sessionId in localStorage
      const savedSessionId = localStorage.getItem("voicero_session_id");

      if (
        savedSessionId &&
        typeof savedSessionId === "string" &&
        savedSessionId.trim() !== ""
      ) {
        console.log(
          "Voicero Core Script: Found valid saved session ID",
          savedSessionId
        );
        // Try to get the existing session
        this.getSession(savedSessionId);
      } else {
        console.log(
          "Voicero Core Script: No valid saved session, creating new one"
        );
        // Create a new session
        this.createSession();
      }
    },

    // Process any pending window state updates
    processPendingWindowStateUpdates: function () {
      if (this.pendingWindowStateUpdates.length === 0 || !this.sessionId) {
        return;
      }

      console.log(
        `Voicero Core Script: Processing ${this.pendingWindowStateUpdates.length} pending window state updates`
      );

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
        console.error("Voicero Core Script: Missing websiteId or sessionId");
        return;
      }

      const proxyUrl = `/wp-json/voicero/v1/session?websiteId=${this.websiteId}`;

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
              console.log(
                "Voicero Core Script: Session not found, creating new one"
              );
              this.createSession();
              return null;
            }
            throw new Error(`Session request failed: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          if (!data) return; // Handle the case where we're creating a new session

          console.log("Voicero Core Script: Got existing session", data);
          this.session = data.session;

          // Get the most recent thread
          if (
            data.session &&
            data.session.threads &&
            data.session.threads.length > 0
          ) {
            this.thread = data.session.threads[0];
            console.log("Voicero Core Script: Active thread info:", {
              threadId: this.thread.threadId,
              title: this.thread.title,
              messageCount: this.thread.messages
                ? this.thread.messages.length
                : 0,
              lastMessageAt: this.thread.lastMessageAt,
            });
          }

          // Log detailed session info
          if (data.session) {
            console.log("Voicero Core Script: Session details:", {
              id: data.session.id,
              createdAt: data.session.createdAt,
              threadCount: data.session.threads
                ? data.session.threads.length
                : 0,
              coreOpen: data.session.coreOpen,
              textOpen: data.session.textOpen,
              textOpenWindowUp: data.session.textOpenWindowUp,
              voiceOpen: data.session.voiceOpen,
              voiceOpenWindowUp: data.session.voiceOpenWindowUp,
            });
          }

          // Store session ID in global variable and localStorage
          if (data.session && data.session.id) {
            this.sessionId = data.session.id;
            localStorage.setItem("voicero_session_id", data.session.id);

            // Process any pending window state updates now that we have a sessionId
            this.processPendingWindowStateUpdates();
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
        })
        .catch((error) => {
          console.error("Voicero Core Script: Error getting session", error);
          // Try creating a new session as fallback
          this.createSession();
        });
    },

    // Restore interface state based on session flags
    restoreInterfaceState: function () {
      if (!this.session) return;

      console.log(
        "Voicero Core Script: Restoring interface state from session"
      );

      // Log the welcome message state
      console.log(
        "Voicero Core Script: Welcome message state:",
        this.session.textWelcome
          ? "should show welcome"
          : "should not show welcome"
      );

      // Check if text interface should be open
      if (this.session.textOpen === true) {
        console.log("Voicero Core Script: Restoring text interface");
        console.log(
          "Voicero Core Script: Text chat window state:",
          this.session.textOpenWindowUp ? "maximized" : "minimized"
        );

        // Make sure VoiceroText is initialized
        if (window.VoiceroText) {
          // The openTextChat function now handles the minimized/maximized state directly
          window.VoiceroText.openTextChat();
        }
      }

      // Check if voice interface should be open
      else if (this.session.voiceOpen === true) {
        console.log("Voicero Core Script: Restoring voice interface");
        console.log(
          "Voicero Core Script: Voice chat window state:",
          this.session.voiceOpenWindowUp ? "maximized" : "minimized"
        );

        // Make sure VoiceroVoice is initialized
        if (window.VoiceroVoice) {
          // Open voice chat
          window.VoiceroVoice.openVoiceChat();

          // Check if it should be minimized
          if (this.session.voiceOpenWindowUp === false) {
            console.log(
              "Voicero Core Script: Voice chat should be minimized based on session state"
            );
            setTimeout(() => {
              window.VoiceroVoice.minimizeVoiceChat();
            }, 500); // Short delay to ensure interface is fully open first
          } else {
            console.log(
              "Voicero Core Script: Voice chat should be maximized based on session state"
            );
          }

          // Check if auto mic should be activated
          if (this.session.autoMic === true) {
            setTimeout(() => {
              window.VoiceroVoice.toggleMic();
            }, 1000); // Longer delay for mic activation
          }
        }
      }
    },

    // Create a new session
    createSession: function () {
      if (!this.websiteId) {
        console.error("Voicero Core Script: Missing websiteId");
        return;
      }

      const proxyUrl = "/wp-json/voicero/v1/session";

      fetch(proxyUrl, {
        method: "POST",
        headers: {
          Accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          websiteId: this.websiteId,
        }),
      })
        .then((response) => {
          if (!response.ok) {
            throw new Error(`Create session failed: ${response.status}`);
          }
          return response.json();
        })
        .then((data) => {
          console.log("Voicero Core Script: Created new session", data);

          // Store session and thread data
          if (data.session) {
            this.session = data.session;

            // Log detailed session info
            console.log("Voicero Core Script: New session details:", {
              id: data.session.id,
              createdAt: data.session.createdAt,
              threadCount: data.session.threads
                ? data.session.threads.length
                : 0,
              websiteId: data.session.websiteId,
            });
          }

          if (data.thread) {
            this.thread = data.thread;

            // Log detailed thread info
            console.log("Voicero Core Script: New thread info:", {
              threadId: this.thread.threadId,
              title: this.thread.title,
              messageCount: this.thread.messages
                ? this.thread.messages.length
                : 0,
              createdAt: this.thread.createdAt,
            });
          } else if (
            data.session &&
            data.session.threads &&
            data.session.threads.length > 0
          ) {
            this.thread = data.session.threads[0];

            // Log detailed thread info
            console.log("Voicero Core Script: New thread from session:", {
              threadId: this.thread.threadId,
              title: this.thread.title,
              messageCount: this.thread.messages
                ? this.thread.messages.length
                : 0,
              createdAt: this.thread.createdAt,
            });
          }

          // Store session ID in localStorage for persistence
          if (data.session && data.session.id) {
            // Validate the session ID format
            const sessionId = data.session.id;
            if (typeof sessionId !== "string" || sessionId.trim() === "") {
              console.error(
                "Voicero Core Script: Received invalid session ID from API",
                sessionId
              );
            } else {
              console.log(
                "Voicero Core Script: Setting session ID:",
                sessionId
              );
              this.sessionId = sessionId;
              localStorage.setItem("voicero_session_id", sessionId);

              // Process any pending window state updates now that we have a sessionId
              this.processPendingWindowStateUpdates();
            }
          } else {
            console.error(
              "Voicero Core Script: No session ID in API response",
              data
            );
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
        })
        .catch((error) => {
          console.error("Voicero Core Script: Error creating session", error);
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

    // Add control buttons to interface
    addControlButtons: function (container, type) {
      // This function can be called by VoiceroText or VoiceroVoice
      // to add common control elements
    },

    // Update window state via API
    updateWindowState: function (windowState) {
      console.log("Voicero Core Script: Updating window state:", windowState);

      if (!this.sessionId) {
        console.log(
          "Voicero Core Script: No session ID available, queuing window state update"
        );

        // Add to pending updates queue
        this.pendingWindowStateUpdates.push(windowState);

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

          console.log(
            "Voicero Core Script: Local session state updated immediately (pending server update)",
            this.session
          );
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

        console.log(
          "Voicero Core Script: Local session state updated immediately",
          this.session
        );
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
          console.error(
            "Voicero Core Script: Invalid sessionId for API call",
            sessionIdForApi
          );
          return;
        }

        // Make API call to persist the changes
        const proxyUrl = "/wp-json/voicero/v1/window_state";

        console.log(
          "Voicero Core Script: Making API call to update window state for session",
          sessionIdForApi
        );

        // Format the request body to match what the Next.js API expects
        const requestBody = {
          sessionId: sessionIdForApi,
          windowState: windowStateForApi,
        };

        console.log(
          "Voicero Core Script: Sending request with body:",
          requestBody
        );

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
            console.log(
              "Voicero Core Script: Window state updated on server",
              data
            );

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
          .catch((error) => {
            console.error(
              "Voicero Core Script: Error updating window state",
              error
            );
          });
      }, 0);
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
