/**
 * VoiceroAI Chooser Module
 *
 * This module handles the interaction chooser UI element that presents options
 * for voice or text interaction with the Voicero assistant.
 */

(function (window, document) {
  // Create a minimal jQuery-like fallback when jQuery is not available
  const $ =
    window.jQuery ||
    function (selector) {
      // Return a simple object that implements a ready method
      return {
        ready: function (fn) {
          if (document.readyState !== "loading") {
            setTimeout(fn, 0);
          } else {
            document.addEventListener("DOMContentLoaded", fn);
          }
        },
      };
    };

  const VoiceroChooser = {
    /**
     * Get the current removeHighlight setting from multiple sources
     */
    getRemoveHighlightSetting: function () {
      console.log(
        "VoiceroChooser: Getting removeHighlight setting from all available sources",
      );

      const core = window.VoiceroCore;
      if (!core) {
        console.log(
          "VoiceroChooser: VoiceroCore not available, defaulting to false",
        );
        return false;
      }

      // First try to get from session
      if (core.session && core.session.removeHighlight !== undefined) {
        console.log(
          "VoiceroChooser: Found removeHighlight in session:",
          core.session.removeHighlight,
        );
        return core.session.removeHighlight === true;
      }

      // Try to get from core directly
      if (core.removeHighlight !== undefined) {
        console.log(
          "VoiceroChooser: Found removeHighlight in core:",
          core.removeHighlight,
        );
        return core.removeHighlight === true;
      }

      // Try to get from website data if available
      if (core.websiteData && core.websiteData.removeHighlight !== undefined) {
        console.log(
          "VoiceroChooser: Found removeHighlight in websiteData:",
          core.websiteData.removeHighlight,
        );
        return core.websiteData.removeHighlight === true;
      }

      console.log(
        "VoiceroChooser: No removeHighlight setting found, defaulting to false",
      );
      return false;
    },

    /**
     * Get the appropriate SVG icon based on type and icon choice
     */
    getIconSvg: function (type) {
      // Direct approach - check global variables first
      let iconChoice = "";

      // For voice button, check global voiceroIconVoice variable
      if (type === "voice") {
        // Check for global values first
        if (window.voiceroIconVoice) {
          iconChoice = window.voiceroIconVoice;
          console.log(
            `VoiceroChooser: Using global voiceroIconVoice: ${iconChoice}`,
          );
        }
        // Fallback to VoiceroCore property
        else if (window.VoiceroCore && window.VoiceroCore.iconVoice) {
          iconChoice = window.VoiceroCore.iconVoice;
          console.log(
            `VoiceroChooser: Using VoiceroCore.iconVoice: ${iconChoice}`,
          );
        }
        // Last resort default
        else {
          iconChoice = "microphone";
          console.log(
            `VoiceroChooser: No voice icon setting found, using default: ${iconChoice}`,
          );
        }

        // Voice icons
        if (iconChoice === "waveform") {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" style="display:block">
            <rect x="3" y="10" width="2" height="4" fill="black"/>
            <rect x="7" y="8" width="2" height="8" fill="black"/>
            <rect x="11" y="2" width="2" height="20" fill="black"/>
            <rect x="15" y="8" width="2" height="8" fill="black"/>
            <rect x="19" y="10" width="2" height="4" fill="black"/>
          </svg>`;
        } else if (iconChoice === "speaker") {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" style="display:block">
            <path d="M5,9v6h4l5,5V4L9,9H5z" fill="black"/>
            <path d="M18.54,9.12c1.56,1.56,1.56,4.1,0,5.66l-1.41-1.41c0.78-0.78,0.78-2.05,0-2.83L18.54,9.12z" fill="black"/>
          </svg>`;
        } else {
          // Default microphone
          return `<svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" style="display:block">
            <path d="M12,14c1.66,0,3-1.34,3-3V5c0-1.66-1.34-3-3-3S9,3.34,9,5v6C9,12.66,10.34,14,12,14z" fill="black"/>
            <path d="M17,11c0,2.76-2.24,5-5,5s-5-2.24-5-5H5c0,3.53,2.61,6.43,6,6.92V21h2v-3.08c3.39-0.49,6-3.39,6-6.92H17z" fill="black"/>
          </svg>`;
        }
      }
      // For message button, check global voiceroIconMessage variable
      else {
        // Check for global values first
        if (window.voiceroIconMessage) {
          iconChoice = window.voiceroIconMessage;
          console.log(
            `VoiceroChooser: Using global voiceroIconMessage: ${iconChoice}`,
          );
        }
        // Fallback to VoiceroCore property
        else if (window.VoiceroCore && window.VoiceroCore.iconMessage) {
          iconChoice = window.VoiceroCore.iconMessage;
          console.log(
            `VoiceroChooser: Using VoiceroCore.iconMessage: ${iconChoice}`,
          );
        }
        // Last resort default
        else {
          iconChoice = "message";
          console.log(
            `VoiceroChooser: No message icon setting found, using default: ${iconChoice}`,
          );
        }

        // Message icons
        if (iconChoice === "document") {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" style="display:block">
            <rect x="4" y="4" width="16" height="2" fill="black"/>
            <rect x="4" y="8" width="16" height="2" fill="black"/>
            <rect x="4" y="12" width="10" height="2" fill="black"/>
            <rect x="4" y="16" width="16" height="2" fill="black"/>
          </svg>`;
        } else if (iconChoice === "cursor") {
          return `<svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" style="display:block">
            <rect x="11" y="2" width="2" height="20" fill="black"/>
          </svg>`;
        } else {
          // Default message
          return `<svg xmlns="http://www.w3.org/2000/svg" width="35" height="35" viewBox="0 0 24 24" style="display:block">
            <path d="M20,4H4C2.9,4,2,4.9,2,6v12c0,1.1,0.9,2,2,2h14l4,4V6C22,4.9,21.1,4,20,4z M20,18H4V6h16V18z" fill="black"/>
          </svg>`;
        }
      }
    },

    /**
     * Show the chooser interface
     */
    showChooser: function () {
      console.log("VoiceroChooser: showChooser called");

      // Get access to core for session information
      const core = window.VoiceroCore;
      if (!core) {
        console.error(
          "VoiceroChooser: Cannot show chooser - VoiceroCore not available",
        );
        return;
      }

      // Check if suppressChooser is true and immediately return
      if (core.session && core.session.suppressChooser) {
        console.log(
          "VoiceroChooser: suppressChooser is true, not showing chooser",
        );
        return;
      }

      // Clear any existing choosers to prevent duplicates
      const allChoosers = document.querySelectorAll("#interaction-chooser");
      console.log(
        "VoiceroChooser: Found " + allChoosers.length + " chooser elements",
      );

      if (allChoosers.length > 1) {
        console.log(
          "VoiceroChooser: Removing " +
            (allChoosers.length - 1) +
            " duplicate choosers",
        );
        // Remove all but the last one
        for (let i = 0; i < allChoosers.length - 1; i++) {
          if (allChoosers[i] && allChoosers[i].parentNode) {
            allChoosers[i].parentNode.removeChild(allChoosers[i]);
          }
        }
      }

      // Check if the chooser exists and is already visible
      const existingChooser = document.getElementById("interaction-chooser");
      if (existingChooser) {
        console.log(
          "VoiceroChooser: Ensuring chooser is refreshed for consistent behavior",
        );
        // Always remove existing chooser to create a fresh one
        if (existingChooser.parentNode) {
          existingChooser.parentNode.removeChild(existingChooser);
        }
      }

      // Create a new chooser to ensure it's fresh
      this.createChooser();

      const chooser = document.getElementById("interaction-chooser");
      if (chooser) {
        console.log("VoiceroChooser: Setting chooser to visible");

        // Check if removeHighlight is set in the session
        const removeHighlight = this.getRemoveHighlightSetting();
        console.log(
          "VoiceroChooser: removeHighlight setting:",
          removeHighlight,
        );

        // Determine box shadow based on removeHighlight setting
        const boxShadow = removeHighlight
          ? "none !important"
          : "6px 6px 0 " + (core.websiteColor || "#882be6") + " !important";
        console.log("VoiceroChooser: Using box shadow:", boxShadow);

        // FORCE VISIBILITY WITH DIRECT ATTRIBUTE SETTING
        chooser.setAttribute(
          "style",
          "position: fixed !important;" +
            "bottom: 80px !important;" +
            "right: 20px !important;" +
            "z-index: 10001 !important;" +
            "background-color: #c8c8c8 !important;" +
            "border-radius: 12px !important;" +
            "box-shadow: " +
            boxShadow +
            ";" +
            "padding: 15px !important;" +
            "width: 280px !important;" +
            "border: 1px solid rgb(0, 0, 0) !important;" +
            "display: flex !important;" +
            "visibility: visible !important;" +
            "opacity: 1 !important;" +
            "flex-direction: column !important;" +
            "align-items: center !important;" +
            "margin: 0 !important;" +
            "transform: none !important;",
        );

        // Make sure the buttons are properly styled
        const voiceButton = document.getElementById("voice-chooser-button");
        const textButton = document.getElementById("text-chooser-button");

        if (voiceButton) {
          console.log("VoiceroChooser: Fixing voice button style");

          voiceButton.setAttribute(
            "style",
            "position: relative !important;" +
              "display: flex !important;" +
              "align-items: center !important;" +
              "padding: 10px 10px !important;" +
              "margin-bottom: 10px !important;" +
              "margin-left: -30px !important;" +
              "cursor: pointer !important;" +
              "border-radius: 8px !important;" +
              "background-color: white !important;" +
              "border: 1px solid rgb(0, 0, 0) !important;" +
              "box-shadow: 4px 4px 0 rgb(0, 0, 0) !important;" +
              "transition: all 0.2s ease !important;" +
              "width: 200px !important;",
          );
        }

        if (textButton) {
          console.log("VoiceroChooser: Fixing text button style");

          textButton.setAttribute(
            "style",
            "position: relative !important;" +
              "display: flex !important;" +
              "align-items: center !important;" +
              "padding: 10px 10px !important;" +
              "margin-left: -30px !important;" +
              "cursor: pointer !important;" +
              "border-radius: 8px !important;" +
              "background-color: white !important;" +
              "border: 1px solid rgb(0, 0, 0) !important;" +
              "box-shadow: 4px 4px 0 rgb(0, 0, 0) !important;" +
              "transition: all 0.2s ease !important;" +
              "width: 200px !important;",
          );
        }

        // Update the icons directly to ensure they match current settings
        // Get the icon choices from all possible sources
        let iconVoice = "microphone"; // Default
        let iconMessage = "message"; // Default

        // Try to get values from session first
        if (core.session && core.session.iconVoice) {
          iconVoice = core.session.iconVoice;
          console.log("VoiceroChooser: Got iconVoice from session:", iconVoice);
        }
        // Try from core directly
        else if (core.iconVoice) {
          iconVoice = core.iconVoice;
          console.log("VoiceroChooser: Got iconVoice from core:", iconVoice);
        }

        // Try to get values from session first
        if (core.session && core.session.iconMessage) {
          iconMessage = core.session.iconMessage;
          console.log(
            "VoiceroChooser: Got iconMessage from session:",
            iconMessage,
          );
        }
        // Try from core directly
        else if (core.iconMessage) {
          iconMessage = core.iconMessage;
          console.log(
            "VoiceroChooser: Got iconMessage from core:",
            iconMessage,
          );
        }

        // Get the SVG markup for each icon
        const voiceIconSvg = this.getIconSvg("voice");
        const messageIconSvg = this.getIconSvg("message");

        // Update the icon containers
        const voiceIconContainer = document.getElementById(
          "voice-icon-container",
        );
        const messageIconContainer = document.getElementById(
          "message-icon-container",
        );

        if (voiceIconContainer) {
          console.log("VoiceroChooser: Updating voice icon to", iconVoice);
          voiceIconContainer.innerHTML = voiceIconSvg;
        }

        if (messageIconContainer) {
          console.log("VoiceroChooser: Updating message icon to", iconMessage);
          messageIconContainer.innerHTML = messageIconSvg;
        }

        // Check the final computed style
        const computedStyle = window.getComputedStyle(chooser);
        console.log(
          "VoiceroChooser: FINAL chooser display:",
          computedStyle.display,
        );
        console.log(
          "VoiceroChooser: FINAL chooser visibility:",
          computedStyle.visibility,
        );
        console.log(
          "VoiceroChooser: FINAL chooser opacity:",
          computedStyle.opacity,
        );
        console.log(
          "VoiceroChooser: FINAL chooser flexDirection:",
          computedStyle.flexDirection,
        );
      } else {
        console.log(
          "VoiceroChooser: CRITICAL ERROR: Chooser not found in DOM after creation",
        );
      }
    },

    /**
     * Create the interaction chooser with consistent HTML and styles
     */
    createChooser: function () {
      console.log("VoiceroChooser: createChooser called");

      // Get access to core for website color
      const core = window.VoiceroCore;
      if (!core) {
        console.error(
          "VoiceroChooser: Cannot create chooser - VoiceroCore not available",
        );
        return;
      }

      // Remove any existing chooser
      const oldChooser = document.getElementById("interaction-chooser");
      if (oldChooser && oldChooser.parentNode) {
        console.log("VoiceroChooser: Removing old chooser");
        oldChooser.parentNode.removeChild(oldChooser);
      }

      const themeColor = core.websiteColor || "#882be6";
      console.log("VoiceroChooser: Using theme color:", themeColor);

      // Check if removeHighlight is set in the session
      const removeHighlight = this.getRemoveHighlightSetting();
      console.log("VoiceroChooser: removeHighlight setting:", removeHighlight);

      // Determine box shadow based on removeHighlight setting
      const boxShadow = removeHighlight
        ? "none !important"
        : `6px 6px 0 ${themeColor} !important`;
      console.log("VoiceroChooser: Using box shadow:", boxShadow);

      // Get the icon choices from all possible sources
      let iconVoice = "microphone"; // Default
      let iconMessage = "message"; // Default

      // Try to get values from session first
      if (core.session && core.session.iconVoice) {
        iconVoice = core.session.iconVoice;
        console.log("VoiceroChooser: Got iconVoice from session:", iconVoice);
      }
      // Try from core directly
      else if (core.iconVoice) {
        iconVoice = core.iconVoice;
        console.log("VoiceroChooser: Got iconVoice from core:", iconVoice);
      }

      // Try to get values from session first
      if (core.session && core.session.iconMessage) {
        iconMessage = core.session.iconMessage;
        console.log(
          "VoiceroChooser: Got iconMessage from session:",
          iconMessage,
        );
      }
      // Try from core directly
      else if (core.iconMessage) {
        iconMessage = core.iconMessage;
        console.log("VoiceroChooser: Got iconMessage from core:", iconMessage);
      }

      // Get the SVG markup for each icon
      const voiceIconSvg = this.getIconSvg("voice");
      const messageIconSvg = this.getIconSvg("message");

      const buttonContainer = document.getElementById("voice-toggle-container");
      if (!buttonContainer) {
        console.log(
          "VoiceroChooser: CRITICAL ERROR: Button container not found",
        );
        return;
      }

      console.log("VoiceroChooser: Creating fresh chooser HTML");

      // Insert the HTML with placeholders for the icons
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
            box-shadow: ${boxShadow};
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
            <span style="font-weight: 700; color: rgb(0, 0, 0); font-size: 16px; width: 100%; text-align: center; white-space: nowrap;">
              Voice Conversation
            </span>
            <div id="voice-icon-container" style="position: absolute; right: -50px; width: 35px; height: 35px;"></div>
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
            <span style="font-weight: 700; color: rgb(0, 0, 0); font-size: 16px; width: 100%; text-align: center;">
              Message
            </span>
            <div id="message-icon-container" style="position: absolute; right: -50px; width: 35px; height: 35px;"></div>
          </div>
          
          <div style="
            text-align: center;
            margin-top: 18px;
            line-height: 1;
          ">
            <div style="
              font-size: 10px;
              color: black;
              opacity: 0.8;
              margin-bottom: 2px;
            ">Powered by Voicero</div>
            <div style="
              font-size: 8px;
              color: black;
              opacity: 0.6;
            ">Voicero AI can make mistakes</div>
          </div>
        </div>`,
      );

      // Now insert the icons directly into the containers
      const voiceIconContainer = document.getElementById(
        "voice-icon-container",
      );
      const messageIconContainer = document.getElementById(
        "message-icon-container",
      );

      if (voiceIconContainer) {
        console.log("VoiceroChooser: Setting voice icon to", iconVoice);
        voiceIconContainer.innerHTML = voiceIconSvg;
      }

      if (messageIconContainer) {
        console.log("VoiceroChooser: Setting message icon to", iconMessage);
        messageIconContainer.innerHTML = messageIconSvg;
      }

      // Double-check that icons were properly set
      if (voiceIconContainer) {
        console.log(
          "VoiceroChooser: Final voice icon HTML:",
          voiceIconContainer.innerHTML,
        );
      }

      if (messageIconContainer) {
        console.log(
          "VoiceroChooser: Final message icon HTML:",
          messageIconContainer.innerHTML,
        );
      }

      // Check that chooser was created
      const newChooser = document.getElementById("interaction-chooser");
      if (newChooser) {
        console.log("VoiceroChooser: New chooser created successfully");
      } else {
        console.log("VoiceroChooser: CRITICAL ERROR: Failed to create chooser");
        return;
      }

      // Add click handlers to the new options
      const chooser = document.getElementById("interaction-chooser");
      const container = document.getElementById("voicero-app-container");
      const voiceButton = document.getElementById("voice-chooser-button");
      if (voiceButton) {
        console.log("VoiceroChooser: Adding voice button click handler");

        // Remove any existing listeners first
        const newVoiceButton = voiceButton.cloneNode(true);
        if (voiceButton.parentNode) {
          voiceButton.parentNode.replaceChild(newVoiceButton, voiceButton);
        }

        newVoiceButton.addEventListener("click", () => {
          console.log("VoiceroChooser: Voice button clicked");

          // Hide the chooser
          if (chooser) {
            chooser.style.display = "none";
            chooser.style.visibility = "hidden";
            chooser.style.opacity = "0";
          }

          // JUST call openVoiceChat - it handles everything
          if (window.VoiceroVoice && window.VoiceroVoice.openVoiceChat) {
            window.VoiceroVoice.openVoiceChat();
          }
        });
      } else {
        console.log("VoiceroChooser: Voice button not found after creation");
      }

      const textButton = document.getElementById("text-chooser-button");
      if (textButton) {
        console.log("VoiceroChooser: Adding text button click handler");

        // Remove any existing listeners first
        const newTextButton = textButton.cloneNode(true);
        if (textButton.parentNode) {
          textButton.parentNode.replaceChild(newTextButton, textButton);
        }

        newTextButton.addEventListener("click", () => {
          console.log("VoiceroChooser: Text button clicked");

          // Hide the chooser
          if (chooser) {
            chooser.style.display = "none";
            chooser.style.visibility = "hidden";
            chooser.style.opacity = "0";
          }

          // JUST call openTextChat - it handles everything
          if (window.VoiceroText && window.VoiceroText.openTextChat) {
            window.VoiceroText.openTextChat();
          }
        });
      } else {
        console.log("VoiceroChooser: Text button not found after creation");
      }

      console.log("VoiceroChooser: Chooser creation complete");
    },

    /**
     * Helper to determine if the chooser should be displayed
     */
    shouldShowChooser: function () {
      console.log("VoiceroChooser: shouldShowChooser called");

      // Get access to core for session information
      const core = window.VoiceroCore;
      if (!core) {
        console.error(
          "VoiceroChooser: Cannot check chooser visibility - VoiceroCore not available",
        );
        return false;
      }

      console.log("VoiceroChooser: Session exists:", !!core.session);
      console.log("VoiceroChooser: Session state:", core.session);

      // Don't show if session doesn't exist
      if (!core.session) {
        console.log("VoiceroChooser: No session, not showing chooser");
        return false;
      }

      // Check if chooserOpen flag is explicitly set to true
      if (core.session.chooserOpen === true) {
        console.log("VoiceroChooser: chooserOpen is true, showing chooser");
        return true;
      }

      // Check if chooserOpen flag is explicitly set to false
      if (core.session.chooserOpen === false) {
        console.log(
          "VoiceroChooser: chooserOpen is false, not showing chooser",
        );
        return false;
      }

      // Don't show if any interfaces are open
      if (core.session.voiceOpen === true || core.session.textOpen === true) {
        console.log("VoiceroChooser: Interface is open, not showing chooser");
        return false;
      }

      // Don't show unless coreOpen is explicitly true and chooser isn't suppressed
      if (
        core.session.coreOpen !== true ||
        core.session.suppressChooser === true
      ) {
        console.log(
          "VoiceroChooser: coreOpen is not true or chooser is suppressed, not showing chooser",
        );
        return false;
      }

      // Check if interfaces are open in the DOM regardless of session state
      const textInterface = document.getElementById(
        "voicero-text-chat-container",
      );
      if (
        textInterface &&
        window.getComputedStyle(textInterface).display === "block"
      ) {
        console.log(
          "VoiceroChooser: Text interface is visible in DOM, not showing chooser",
        );
        return false;
      }

      const voiceInterface = document.getElementById("voice-chat-interface");
      if (
        voiceInterface &&
        window.getComputedStyle(voiceInterface).display === "block"
      ) {
        console.log(
          "VoiceroChooser: Voice interface is visible in DOM, not showing chooser",
        );
        return false;
      }

      console.log("VoiceroChooser: All checks passed, should show chooser");
      return true;
    },

    /**
     * Hide the chooser interface
     */
    hideChooser: function () {
      const chooser = document.getElementById("interaction-chooser");

      // Always hide the chooser, regardless of current state
      if (chooser) {
        console.log("VoiceroChooser: Hiding chooser UI unconditionally");
        chooser.style.display = "none";
        chooser.style.visibility = "hidden";
        chooser.style.opacity = "0";
      }
    },
  };

  // Expose the module globally
  window.VoiceroChooser = VoiceroChooser;
})(window, document);
