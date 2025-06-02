/**
 * VoiceroWait Module
 * Handles waiting animations and indicators
 */

const VoiceroWait = {
  typingTimeout: null,
  typingIndicator: null,
  debug: true, // Enable debug logging

  /**
   * Create typing indicator - Professional Version
   * @returns {HTMLElement} The typing indicator element
   */
  createTypingIndicator() {
    const wrapper = document.createElement("div");
    wrapper.className = "ai-message typing-wrapper";
    wrapper.style.cssText = `
      display: flex;
      justify-content: flex-start;
      margin: 8px 0;
      padding: 0;
    `;

    // Create the indicator with plain HTML
    wrapper.innerHTML = `
      <div id="voicero-typing-indicator" class="typing-indicator" style="
        background-color: #e5e5ea;
        padding: 8px 12px;
        border-radius: 18px;
        margin: 5px;
        display: flex;
        align-items: center;
        gap: 4px;
      ">
        <span class="typing-dot" style="
          width: 7px;
          height: 7px;
          background: #999999;
          border-radius: 50%;
          display: inline-block;
          animation: typingBounce 1s infinite;
        "></span>
        <span class="typing-dot" style="
          width: 7px;
          height: 7px;
          background: #999999;
          border-radius: 50%;
          display: inline-block;
          animation: typingBounce 1s infinite;
          animation-delay: 0.2s;
        "></span>
        <span class="typing-dot" style="
          width: 7px;
          height: 7px;
          background: #999999;
          border-radius: 50%;
          display: inline-block;
          animation: typingBounce 1s infinite;
          animation-delay: 0.4s;
        "></span>
      </div>
    `;

    // Add animation keyframes to document if not already added
    if (!document.getElementById("voicero-wait-styles")) {
      if (this.debug) console.log("VoiceroWait: Adding keyframes style");
      const styleEl = document.createElement("style");
      styleEl.id = "voicero-wait-styles";
      styleEl.innerHTML = `
        @keyframes typingBounce {
          0%, 60%, 100% { transform: translateY(0); }
          30% { transform: translateY(-6px); }
        }
      `;
      document.head.appendChild(styleEl);
    }

    if (this.debug) console.log("VoiceroWait: Created professional indicator");

    return wrapper;
  },

  /**
   * Show typing indicator - SIMPLIFIED
   * @param {HTMLElement} messagesContainer - The container to add the typing indicator to
   * @returns {HTMLElement} The wrapper containing the typing indicator
   */
  showTypingIndicator(messagesContainer) {
    if (!messagesContainer) {
      console.error("No messages container provided");
      return null;
    }

    if (this.debug) console.log("VoiceroWait: Showing typing indicator");

    // Remove any existing indicators
    this.hideTypingIndicator();

    // Create and append the indicator
    const indicatorWrapper = this.createTypingIndicator();
    messagesContainer.appendChild(indicatorWrapper);

    // Scroll and store reference
    messagesContainer.scrollTop = messagesContainer.scrollHeight;
    this.typingIndicator = indicatorWrapper;

    // Start the text dot animation
    this.startTextDotAnimation();

    // Log debug info
    if (this.debug) {
      console.log("VoiceroWait: Typing indicator added to DOM");
      console.log("VoiceroWait: Wrapper class: " + indicatorWrapper.className);
      console.log("VoiceroWait: Indicator HTML: ", indicatorWrapper.innerHTML);
    }

    return indicatorWrapper;
  },

  // Text dot animation
  startTextDotAnimation() {
    // Function kept for backward compatibility but not used anymore
    // Animation now handled by CSS
  },

  // Hide typing indicator
  hideTypingIndicator() {
    // Clear any animation intervals if they exist
    if (this.dotAnimationInterval) {
      clearInterval(this.dotAnimationInterval);
      this.dotAnimationInterval = null;
    }

    // Remove our stored reference if it exists
    if (this.typingIndicator) {
      if (this.typingIndicator.parentNode) {
        this.typingIndicator.parentNode.removeChild(this.typingIndicator);
      }
      this.typingIndicator = null;
    }

    // Also find and remove any other potential typing indicators in the DOM
    // This ensures we clean up any indicators that might have been created by other means
    document
      .querySelectorAll(
        ".typing-indicator, .typing-wrapper, #voicero-typing-indicator",
      )
      .forEach((el) => {
        if (el.parentNode) el.parentNode.removeChild(el);
      });

    if (this.debug) console.log("VoiceroWait: All typing indicators removed");
  },

  /**
   * Add rainbow animation to send button while waiting
   * @param {HTMLElement} button - The button to animate
   */
  addLoadingAnimation: function (button) {
    if (button) {
      button.classList.add("siri-active");
    }
  },

  /**
   * Remove rainbow animation from send button
   * @param {HTMLElement} button - The button to stop animating
   */
  removeLoadingAnimation: function (button) {
    if (button) {
      button.classList.remove("siri-active");
    }
  },
};

// Expose to global window
window.VoiceroWait = VoiceroWait;
