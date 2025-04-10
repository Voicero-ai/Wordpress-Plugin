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
      if (window.aiWebsiteConfig && window.aiWebsiteConfig.accessKey) {
        console.log(
          "Voicero Core Script: Found access key, checking API connection"
        );
        this.checkApiConnection(window.aiWebsiteConfig.accessKey);
      } else {
        console.warn("Voicero Core Script: No access key found in config");
      }
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
              onclick="VoiceroVoice && VoiceroVoice.openVoiceChat()"
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
              onclick="VoiceroText && VoiceroText.openTextChat()"
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
    checkApiConnection: function (accessKey) {
      console.log(
        "Voicero Core Script: Starting API connection check with key:",
        accessKey.substring(0, 10) + "..."
      );

      // Try each URL in sequence
      let urlIndex = 0;

      const tryNextUrl = () => {
        if (urlIndex >= this.apiBaseUrls.length) {
          console.error("Voicero Core Script: All API endpoints failed");
          return;
        }

        const currentUrl = this.apiBaseUrls[urlIndex];
        const apiUrl = `${currentUrl}/api/connect`;
        console.log("Voicero Core Script: Trying API URL:", apiUrl);

        fetch(apiUrl, {
          method: "GET",
          headers: {
            Accept: "application/json",
            Authorization: `Bearer ${accessKey}`,
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
            this.apiBaseUrl = currentUrl;
            this.apiConnected = true;

            // Only create the button if service is active
            if (data.website && data.website.active === true) {
              console.log(
                "Voicero Core Script: Website is active, creating interface"
              );

              // Now create the button since we have a successful connection
              this.createButton();

              // Enable voice and text functions
              if (window.VoiceroVoice) {
                window.VoiceroVoice.apiBaseUrl = currentUrl;
              }

              if (window.VoiceroText) {
                window.VoiceroText.apiBaseUrl = currentUrl;
              }
            } else {
              console.warn(
                "Voicero Core Script: Website is not active in API response"
              );
            }
          })
          .catch((error) => {
            console.error(
              `Voicero Core Script: API error with ${currentUrl}:`,
              error
            );

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
