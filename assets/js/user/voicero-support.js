/**
 * VoiceroAI Support Module
 * Adds reporting functionality to AI message bubbles
 */

const VoiceroSupport = {
  initialized: false,
  debugMode: false, // Set to true to enable verbose logging

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

    // Also set up a delayed retry for processing messages and observers
    // This helps in case the chat interfaces are created after this module loads
    setTimeout(() => {
      this.setupMessageObservers();
      this.processExistingMessages();

      // Add a second delayed retry with longer timeout for slower pages
      setTimeout(() => {
        this.setupMessageObservers();
        this.processExistingMessages();
      }, 3000); // 3 seconds later
    }, 1000); // 1 second later
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
    if (this.debugMode)
      console.log("VoiceroSupport: Setting up text chat observer");

    // Function to find and observe the chat messages container
    const setupObserver = () => {
      // Find the text chat container
      const textChatContainer = document.getElementById(
        "voicero-text-chat-container"
      );
      if (!textChatContainer || !textChatContainer.shadowRoot) {
        if (this.debugMode)
          console.log(
            "VoiceroSupport: Text chat container or shadowRoot not found, will retry"
          );
        return false;
      }

      // Get the messages container from shadow DOM
      const messagesContainer =
        textChatContainer.shadowRoot.getElementById("chat-messages");
      if (!messagesContainer) {
        if (this.debugMode)
          console.log(
            "VoiceroSupport: Messages container not found in shadowRoot, will retry"
          );
        return false;
      }

      if (this.debugMode)
        console.log(
          "VoiceroSupport: Found text chat messages container, setting up observer"
        );

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
      if (this.debugMode)
        console.log("VoiceroSupport: Text chat observer successfully set up");
      return true;
    };

    // Try to set up the observer immediately
    const initialSetupSuccess = setupObserver();

    // If initial setup fails, retry with exponential backoff - but limit console noise
    if (!initialSetupSuccess) {
      let retryCount = 0;
      const maxRetries = 10;

      const retrySetup = () => {
        if (retryCount < maxRetries) {
          retryCount++;
          const backoffTime = Math.min(1000 * Math.pow(1.5, retryCount), 10000); // Exponential backoff with 10s max

          if (this.debugMode)
            console.log(
              `VoiceroSupport: Retrying text chat observer setup in ${backoffTime}ms (attempt ${retryCount})`
            );

          setTimeout(() => {
            if (!setupObserver()) {
              retrySetup();
            }
          }, backoffTime);
        } else {
          if (this.debugMode)
            console.log(
              "VoiceroSupport: Max retries reached for text chat observer setup"
            );
        }
      };

      retrySetup();
    }
  },

  /**
   * Set up observer for voice chat interface
   */
  setupVoiceChatObserver: function () {
    if (this.debugMode)
      console.log("VoiceroSupport: Setting up voice chat observer");

    // Function to find and observe the voice chat messages container
    const setupObserver = () => {
      // Find the voice chat container
      const voiceChatContainer = document.getElementById(
        "voice-chat-interface"
      );
      if (!voiceChatContainer) {
        if (this.debugMode)
          console.log(
            "VoiceroSupport: Voice chat container not found, will retry"
          );
        return false;
      }

      // Get the messages container
      const messagesContainer =
        voiceChatContainer.querySelector("#voice-messages");
      if (!messagesContainer) {
        if (this.debugMode)
          console.log(
            "VoiceroSupport: Voice messages container not found, will retry"
          );
        return false;
      }

      if (this.debugMode)
        console.log(
          "VoiceroSupport: Found voice chat messages container, setting up observer"
        );

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
      if (this.debugMode)
        console.log("VoiceroSupport: Voice chat observer successfully set up");
      return true;
    };

    // Try to set up the observer immediately
    const initialSetupSuccess = setupObserver();

    // If initial setup fails, retry with exponential backoff
    if (!initialSetupSuccess) {
      let retryCount = 0;
      const maxRetries = 10;

      const retrySetup = () => {
        if (retryCount < maxRetries) {
          retryCount++;
          const backoffTime = Math.min(1000 * Math.pow(1.5, retryCount), 10000); // Exponential backoff with 10s max

          if (this.debugMode)
            console.log(
              `VoiceroSupport: Retrying voice chat observer setup in ${backoffTime}ms (attempt ${retryCount})`
            );

          setTimeout(() => {
            if (!setupObserver()) {
              retrySetup();
            }
          }, backoffTime);
        } else {
          if (this.debugMode)
            console.log(
              "VoiceroSupport: Max retries reached for voice chat observer setup"
            );
        }
      };

      retrySetup();
    }
  },

  /**
   * Process existing messages in both chat interfaces
   */
  processExistingMessages: function () {
    if (this.debugMode)
      console.log("VoiceroSupport: Processing existing messages");

    try {
      // Process text chat messages
      const textChatContainer = document.getElementById(
        "voicero-text-chat-container"
      );

      if (textChatContainer && textChatContainer.shadowRoot) {
        if (this.debugMode)
          console.log(
            "VoiceroSupport: Found text chat container with shadow root"
          );

        // Try to get all AI messages from shadow DOM
        const aiMessages = textChatContainer.shadowRoot.querySelectorAll(
          ".ai-message:not(.placeholder):not(.typing-wrapper)"
        );

        if (this.debugMode)
          console.log(
            `VoiceroSupport: Found ${aiMessages.length} existing text AI messages`
          );

        // Process each message
        aiMessages.forEach((message) => {
          if (!message.querySelector(".voicero-report-button")) {
            this.attachReportButtonToMessage(message, "text");
          }
        });
      } else {
        if (this.debugMode)
          console.log(
            "VoiceroSupport: Text chat container or shadow root not available"
          );
      }

      // Process voice chat messages
      const voiceChatContainer = document.getElementById(
        "voice-chat-interface"
      );
      if (voiceChatContainer) {
        if (this.debugMode)
          console.log("VoiceroSupport: Found voice chat container");

        // Get all AI messages
        const aiMessages = voiceChatContainer.querySelectorAll(
          ".ai-message:not(.placeholder):not(.typing-indicator)"
        );

        if (this.debugMode)
          console.log(
            `VoiceroSupport: Found ${aiMessages.length} existing voice AI messages`
          );

        // Process each message
        aiMessages.forEach((message) => {
          if (!message.querySelector(".voicero-report-button")) {
            this.attachReportButtonToMessage(message, "voice");
          }
        });
      } else {
        if (this.debugMode)
          console.log("VoiceroSupport: Voice chat container not available");
      }
    } catch (error) {
      console.error(
        "VoiceroSupport: Error processing existing messages:",
        error
      );
    }
  },

  /**
   * Attach a report button to an AI message
   * @param {Element} messageElement - The message element to attach a report button to
   * @param {string} chatType - Either 'text' or 'voice'
   */
  attachReportButtonToMessage: function (messageElement, chatType) {
    try {
      // Skip if it already has a report button
      if (messageElement.querySelector(".voicero-report-button")) {
        return;
      }

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
      let messageContent = "";

      if (chatType === "text") {
        const contentEl = messageElement.querySelector(".message-content");
        if (contentEl) {
          // For text format, get text content with normalized whitespace
          messageContent = contentEl.textContent || contentEl.innerText || "";
        } else {
          // Fallback to direct text content
          messageContent =
            messageElement.textContent || messageElement.innerText || "";
        }
      } else {
        // voice
        const contentEl = messageElement.querySelector(
          ".voice-message-content"
        );
        if (contentEl) {
          messageContent = contentEl.textContent || contentEl.innerText || "";
        } else {
          messageContent =
            messageElement.textContent || messageElement.innerText || "";
        }
      }

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
      reportButton.addEventListener("click", (e) => {
        // Prevent any parent click events from firing
        e.stopPropagation();
        e.preventDefault();

        this.reportMessage(
          messageElement.dataset.messageId,
          chatType,
          messageElement.dataset.messageContent
        );
      });

      // Get the content container for message
      let contentContainer = null;

      if (chatType === "text") {
        contentContainer = messageElement.querySelector(".message-content");
      } else {
        // voice
        contentContainer = messageElement.querySelector(
          ".voice-message-content"
        );
      }

      // If we found the content container, append the report button
      if (contentContainer) {
        contentContainer.appendChild(reportButton);
        return true;
      } else {
        // If we can't find the content container, append directly to the message
        messageElement.appendChild(reportButton);
        return true;
      }
    } catch (error) {
      console.error("Error attaching report button:", error);
      return false;
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
      if (this.debugMode)
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

    if (this.debugMode) {
      console.log("VoiceroCore session:", window.VoiceroCore.session);
      console.log("Reporting message with ID:", actualMessageId);
      console.log("From thread with ID:", threadId);
      console.log(
        "Content used for matching:",
        messageContent?.substring(0, 30) + "..."
      );
    }

    // Make API request to the WordPress endpoint with the actual UUIDs
    fetch("http://localhost:3000/api/support/help", {
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

// Make a function to directly process a single AI message
VoiceroSupport.processAIMessage = function (messageElement, chatType) {
  if (!messageElement) return false;

  // Skip if it's not an AI message
  if (
    !messageElement.classList ||
    !messageElement.classList.contains("ai-message")
  ) {
    return false;
  }

  // Skip welcome messages, placeholders, and typing indicators
  if (
    messageElement.classList.contains("placeholder") ||
    messageElement.classList.contains("typing-wrapper") ||
    messageElement.classList.contains("typing-indicator") ||
    messageElement.querySelector(".welcome-message") ||
    messageElement.querySelector(".voice-prompt")
  ) {
    return false;
  }

  // If there's already a report button, don't add another one
  if (messageElement.querySelector(".voicero-report-button")) {
    return false;
  }

  // Attach the report button
  return this.attachReportButtonToMessage(messageElement, chatType || "text");
};

// Make available globally
window.VoiceroSupport = VoiceroSupport;
