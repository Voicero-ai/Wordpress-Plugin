/**
 * VoiceroAI Support Module
 * Adds reporting functionality to AI message bubbles
 */

const VoiceroSupport = {
  initialized: false,

  /**
   * Initialize the support reporting system
   */
  init: function () {
    if (this.initialized) return;

    console.log("VoiceroSupport: Initializing support reporting system");

    // Add listener for message additions to both text and voice chats
    this.setupMessageObservers();

    // Mark as initialized
    this.initialized = true;

    // Immediately process any existing messages
    this.processExistingMessages();
  },

  /**
   * Set up observers to watch for new messages being added to chat interfaces
   */
  setupMessageObservers: function () {
    // Setup for text chat messages
    this.setupTextChatObserver();

    // Setup for voice chat messages
    this.setupVoiceChatObserver();
  },

  /**
   * Set up observer for text chat interface
   */
  setupTextChatObserver: function () {
    // Find the text chat container
    const textChatContainer = document.getElementById(
      "voicero-text-chat-container"
    );
    if (!textChatContainer || !textChatContainer.shadowRoot) return;

    // Get the messages container from shadow DOM
    const messagesContainer =
      textChatContainer.shadowRoot.getElementById("chat-messages");
    if (!messagesContainer) return;

    // Create mutation observer
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          // Process each new node
          mutation.addedNodes.forEach((node) => {
            if (node.classList && node.classList.contains("ai-message")) {
              // Don't add report buttons to placeholder messages or typing indicators
              if (
                !node.classList.contains("placeholder") &&
                !node.classList.contains("typing-wrapper")
              ) {
                // Use a small delay to ensure the message content is fully rendered
                setTimeout(() => {
                  this.attachReportButtonToMessage(node, "text");
                }, 100);
              }
            }
          });
        }
      });
    });

    // Start observing
    observer.observe(messagesContainer, { childList: true, subtree: false });
  },

  /**
   * Set up observer for voice chat interface
   */
  setupVoiceChatObserver: function () {
    // Find the voice chat container
    const voiceChatContainer = document.getElementById("voice-chat-interface");
    if (!voiceChatContainer) return;

    // Get the messages container
    const messagesContainer =
      voiceChatContainer.querySelector("#voice-messages");
    if (!messagesContainer) return;

    // Create mutation observer
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.type === "childList" && mutation.addedNodes.length > 0) {
          // Process each new node
          mutation.addedNodes.forEach((node) => {
            if (node.classList && node.classList.contains("ai-message")) {
              // Don't add report buttons to placeholder messages or typing indicators
              if (
                !node.classList.contains("placeholder") &&
                !node.classList.contains("typing-indicator")
              ) {
                // Use a small delay to ensure the message content is fully rendered
                setTimeout(() => {
                  this.attachReportButtonToMessage(node, "voice");
                }, 100);
              }
            }
          });
        }
      });
    });

    // Start observing
    observer.observe(messagesContainer, { childList: true, subtree: false });
  },

  /**
   * Process existing messages in both chat interfaces
   */
  processExistingMessages: function () {
    // Process text chat messages
    const textChatContainer = document.getElementById(
      "voicero-text-chat-container"
    );
    if (textChatContainer && textChatContainer.shadowRoot) {
      const aiMessages = textChatContainer.shadowRoot.querySelectorAll(
        ".ai-message:not(.placeholder):not(.typing-wrapper)"
      );
      aiMessages.forEach((message) => {
        this.attachReportButtonToMessage(message, "text");
      });
    }

    // Process voice chat messages
    const voiceChatContainer = document.getElementById("voice-chat-interface");
    if (voiceChatContainer) {
      const aiMessages = voiceChatContainer.querySelectorAll(
        ".ai-message:not(.placeholder):not(.typing-indicator)"
      );
      aiMessages.forEach((message) => {
        this.attachReportButtonToMessage(message, "voice");
      });
    }
  },

  /**
   * Attach a report button to an AI message
   * @param {Element} messageElement - The message element to attach a report button to
   * @param {string} chatType - Either 'text' or 'voice'
   */
  attachReportButtonToMessage: function (messageElement, chatType) {
    // Skip if it already has a report button
    if (messageElement.querySelector(".voicero-report-button")) return;

    // Skip welcome messages and system messages
    if (
      messageElement.querySelector(".welcome-message") ||
      messageElement.querySelector(".voice-prompt") ||
      messageElement.classList.contains("placeholder") ||
      messageElement.classList.contains("typing-indicator") ||
      messageElement.classList.contains("typing-wrapper")
    ) {
      return;
    }

    // Create a unique ID for this message if it doesn't have one
    if (!messageElement.dataset.messageId) {
      messageElement.dataset.messageId = this.generateUniqueId();
    }

    // Store the message content for identification
    const messageContent =
      chatType === "text"
        ? messageElement.querySelector(".message-content")?.textContent ||
          messageElement.textContent
        : messageElement.querySelector(".voice-message-content")?.textContent ||
          messageElement.textContent;

    // Save this as a data attribute to find the correct message later
    if (messageContent) {
      // Trim the content and store only the first 100 chars to avoid huge data attributes
      const trimmedContent = messageContent.trim().substring(0, 100);
      messageElement.dataset.messageContent = trimmedContent;
    }

    // Create the report button
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
      transition: opacity 0.2s ease;
    `;

    // Add hover effect
    reportButton.addEventListener("mouseover", () => {
      reportButton.style.opacity = "1";
    });

    reportButton.addEventListener("mouseout", () => {
      reportButton.style.opacity = "0.8";
    });

    // Add click event to report the message
    reportButton.addEventListener("click", () => {
      this.reportMessage(
        messageElement.dataset.messageId,
        chatType,
        messageElement.dataset.messageContent
      );
    });

    // Get the content container for message
    const contentContainer = 
      chatType === "text"
        ? messageElement.querySelector(".message-content")
        : messageElement.querySelector(".voice-message-content");

    if (contentContainer) {
      // Append the report button
      contentContainer.appendChild(reportButton);
    }
  },

  /**
   * Generate a unique ID for messages
   * @returns {string} A unique ID
   */
  generateUniqueId: function () {
    return "msg_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9);
  },

  /**
   * Report a message to the backend
   * @param {string} messageId - The ID of the message to report
   * @param {string} chatType - Either 'text' or 'voice'
   * @param {string} messageContent - The content of the message to help identify it
   */
  reportMessage: function (messageId, chatType, messageContent) {
    // Get current thread ID from VoiceroCore if available
    let threadId = null;
    let actualMessageId = null;

    // Immediately show an in-progress notification to the user
    this.showReportStatus("Reporting AI problem...", "info");

    // We need to find the actual UUID message ID from the session data
    if (
      window.VoiceroCore &&
      window.VoiceroCore.session &&
      window.VoiceroCore.session.threads
    ) {
      console.log("VoiceroCore session:", window.VoiceroCore.session);

      // Find the active thread first
      let activeThread = null;

      // First try to find by looking for a thread with the current ThreadId
      if (window.VoiceroCore.currentThreadId) {
        activeThread = window.VoiceroCore.session.threads.find(
          (thread) => thread.threadId === window.VoiceroCore.currentThreadId
        );
      }

      // If not found, try using thread property
      if (
        !activeThread &&
        window.VoiceroCore.thread &&
        window.VoiceroCore.thread.threadId
      ) {
        activeThread = window.VoiceroCore.session.threads.find(
          (thread) => thread.threadId === window.VoiceroCore.thread.threadId
        );
      }

      // If still not found, try to find a thread with an active message
      if (!activeThread) {
        // Look in all threads
        for (const thread of window.VoiceroCore.session.threads) {
          if (thread.messages && thread.messages.length > 0) {
            activeThread = thread;
            break;
          }
        }
      }

      // If we found an active thread
      if (activeThread) {
        // Use the thread ID in the proper UUID format
        threadId = activeThread.id;

        // Now find the specific message by content if we have it
        if (activeThread.messages && activeThread.messages.length > 0) {
          if (messageContent) {
            // Try to find the message by matching content
            const assistantMessages = activeThread.messages.filter(
              (msg) => msg.role === "assistant"
            );

            for (const msg of assistantMessages) {
              if (msg.content && msg.content.includes(messageContent)) {
                actualMessageId = msg.id;
                break;
              }
            }
          }

          // If we couldn't find by content, use the most recent message
          if (!actualMessageId) {
            // Get the last assistant message as fallback
            const assistantMessages = activeThread.messages.filter(
              (msg) => msg.role === "assistant"
            );

            if (assistantMessages.length > 0) {
              actualMessageId =
                assistantMessages[assistantMessages.length - 1].id;
            }
          }
        }
      }
    }

    // Fallback to searching in text and voice modules
    if (!threadId || !actualMessageId) {
      if (window.VoiceroText && window.VoiceroText.currentThreadId) {
        // Try to find the thread with this ID
        if (
          window.VoiceroCore &&
          window.VoiceroCore.session &&
          window.VoiceroCore.session.threads
        ) {
          const textThread = window.VoiceroCore.session.threads.find(
            (thread) => thread.threadId === window.VoiceroText.currentThreadId
          );
          if (textThread) {
            threadId = textThread.id;
            // Search for message by content
            if (
              textThread.messages &&
              textThread.messages.length > 0 &&
              messageContent
            ) {
              const assistantMessages = textThread.messages.filter(
                (msg) => msg.role === "assistant"
              );

              for (const msg of assistantMessages) {
                if (msg.content && msg.content.includes(messageContent)) {
                  actualMessageId = msg.id;
                  break;
                }
              }

              // Fallback to last message
              if (!actualMessageId && assistantMessages.length > 0) {
                actualMessageId =
                  assistantMessages[assistantMessages.length - 1].id;
              }
            }
          }
        }
      }
    }

    // Voice module fallback
    if (!threadId || !actualMessageId) {
      if (window.VoiceroVoice && window.VoiceroVoice.currentThreadId) {
        // Try to find the thread with this ID
        if (
          window.VoiceroCore &&
          window.VoiceroCore.session &&
          window.VoiceroCore.session.threads
        ) {
          const voiceThread = window.VoiceroCore.session.threads.find(
            (thread) => thread.threadId === window.VoiceroVoice.currentThreadId
          );
          if (voiceThread) {
            threadId = voiceThread.id;
            // Search for message by content
            if (
              voiceThread.messages &&
              voiceThread.messages.length > 0 &&
              messageContent
            ) {
              const assistantMessages = voiceThread.messages.filter(
                (msg) => msg.role === "assistant"
              );

              for (const msg of assistantMessages) {
                if (msg.content && msg.content.includes(messageContent)) {
                  actualMessageId = msg.id;
                  break;
                }
              }

              // Fallback to last message
              if (!actualMessageId && assistantMessages.length > 0) {
                actualMessageId =
                  assistantMessages[assistantMessages.length - 1].id;
              }
            }
          }
        }
      }
    }

    // Check if we have the necessary information
    if (!threadId || !actualMessageId) {
      console.error(
        "Cannot report message: Could not find proper thread or message ID"
      );
      console.error("Original message ID:", messageId);
      console.error("Detected message content:", messageContent);
      console.error("Found thread ID:", threadId);
      console.error("Found message ID:", actualMessageId);
      this.showReportStatus(
        "Sorry, couldn't report the AI problem. Please try again.",
        "error"
      );
      return;
    }

    console.log("VoiceroCore session:", window.VoiceroCore.session);
    console.log("Reporting message with ID:", actualMessageId);
    console.log("From thread with ID:", threadId);
    console.log(
      "Content used for matching:",
      messageContent?.substring(0, 30) + "..."
    );

    // Make API request to the WordPress endpoint with the actual UUIDs
    fetch("/wp-json/voicero/v1/support", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        messageId: actualMessageId,
        threadId: threadId,
      }),
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error("Failed to report message");
        }
        return response.json();
      })
      .then((data) => {
        this.showReportStatus(
          "Thank you! Your AI problem report has been submitted.",
          "success"
        );
      })
      .catch((error) => {
        console.error("Error reporting message:", error);
        this.showReportStatus(
          "Sorry, couldn't report the AI problem. Please try again.",
          "error"
        );
      });
  },

  /**
   * Show a status message to the user
   * @param {string} message - The message to show
   * @param {string} type - Either 'info', 'success', or 'error'
   */
  showReportStatus: function (message, type) {
    // Create a notification element
    const notification = document.createElement("div");
    notification.className = "voicero-report-notification";

    // Set styles based on type
    let bgColor = "#4caf50"; // success (green)
    if (type === "error") {
      bgColor = "#f44336"; // error (red)
    } else if (type === "info") {
      bgColor = "#2196F3"; // info (blue)
    }

    notification.style.cssText = `
      position: fixed;
      bottom: 20px;
      left: 50%;
      transform: translateX(-50%);
      padding: 12px 20px;
      background-color: ${bgColor};
      color: white;
      border-radius: 4px;
      box-shadow: 0 3px 10px rgba(0,0,0,0.2);
      z-index: 9999999;
      font-size: 15px;
      opacity: 0;
      transition: opacity 0.3s ease;
      text-align: center;
      min-width: 250px;
    `;

    notification.textContent = message;
    document.body.appendChild(notification);

    // Fade in
    setTimeout(() => {
      notification.style.opacity = "1";
    }, 10);

    // Fade out and remove after 3 seconds
    setTimeout(() => {
      notification.style.opacity = "0";
      setTimeout(() => {
        document.body.removeChild(notification);
      }, 300);
    }, 4000);
  },
};

// Initialize when document is loaded
document.addEventListener("DOMContentLoaded", function () {
  // Initialize after a short delay to ensure VoiceroCore is loaded
  setTimeout(() => {
    VoiceroSupport.init();
  }, 1000);
});

// Make available globally
window.VoiceroSupport = VoiceroSupport;
