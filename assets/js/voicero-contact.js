/**
 * VoiceroAI Contact Form Module
 * Handles contact form functionality within the Voicero text interface
 */

const VoiceroContact = {
  // Initialize the contact module
  init: function () {
    // This will be called when loaded
    console.log("VoiceroContact module initialized");
  },

  // Create and display contact form in the chat interface
  showContactForm: function () {
    // Determine which interface is active
    let messagesContainer;
    let interfaceType = "text"; // Default to text interface
    
    // Check if called from voice interface
    if (document.getElementById("voice-messages") && 
        window.VoiceroCore && 
        window.VoiceroCore.appState && 
        window.VoiceroCore.appState.activeInterface === "voice") {
      messagesContainer = document.getElementById("voice-messages");
      interfaceType = "voice";
    } 
    // Otherwise use text interface
    else if (window.VoiceroText && window.VoiceroText.shadowRoot) {
      messagesContainer = window.VoiceroText.shadowRoot.getElementById("chat-messages");
    }
    
    // Exit if neither interface is available
    if (!messagesContainer) {
      console.error("VoiceroText/Voice interface not available");
      return;
    }

    // Create the contact form HTML
    const contactFormHTML = `
      <div class="contact-form-container">
        <h3>How can we help?</h3>
        <p>Please fill out the form below and we'll get back to you soon.</p>
        <div class="form-group">
          <label for="contact-email">Email:</label>
          <input type="email" id="contact-email" placeholder="Your email address" required>
        </div>
        <div class="form-group">
          <label for="contact-message">Message:</label>
          <textarea id="contact-message" placeholder="How can we help you?" rows="4" required></textarea>
        </div>
        <div class="form-actions">
          <button id="contact-submit" class="contact-submit-btn">Submit</button>
          <button id="contact-cancel" class="contact-cancel-btn">Cancel</button>
        </div>
      </div>
    `;

    // Create a message element in the AI chat interface
    const messageDiv = document.createElement("div");
    messageDiv.className = "ai-message";

    // Create message content
    const contentDiv = document.createElement("div");
    contentDiv.className = "message-content contact-form-message";
    contentDiv.innerHTML = contactFormHTML;

    // Style the form to match the chat interface
    contentDiv.style.maxWidth = "85%";
    contentDiv.style.width = "300px";
    contentDiv.style.padding = "15px";

    // Add to message div
    messageDiv.appendChild(contentDiv);

    // Add to messages container
    messagesContainer.appendChild(messageDiv);
    messagesContainer.scrollTop = messagesContainer.scrollHeight;

    // Apply styles to form elements
    this.applyFormStyles(messageDiv);

    // Set up event listeners for the form
    this.setupFormEventListeners(messageDiv, interfaceType);
  },

  // Apply styles to the form elements
  applyFormStyles: function (formContainer) {
    // Get the main theme color from VoiceroText
    const mainColor = window.VoiceroText.websiteColor || "#882be6";

    // Apply styles to form elements
    const styles = `
      .contact-form-container {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif;
      }
      
      .contact-form-container h3 {
        margin: 0 0 10px 0;
        font-size: 16px;
        color: #333;
      }
      
      .contact-form-container p {
        margin: 0 0 15px 0;
        font-size: 14px;
        color: #666;
      }
      
      .form-group {
        margin-bottom: 12px;
      }
      
      .form-group label {
        display: block;
        margin-bottom: 5px;
        font-size: 14px;
        color: #555;
      }
      
      .form-group input, 
      .form-group textarea {
        width: 100%;
        padding: 8px 10px;
        border: 1px solid #ccc;
        border-radius: 8px;
        font-size: 14px;
        box-sizing: border-box;
      }
      
      .form-group input:focus, 
      .form-group textarea:focus {
        outline: none;
        border-color: ${mainColor};
        box-shadow: 0 0 0 2px rgba(${parseInt(mainColor.slice(1, 3), 16)}, 
                                   ${parseInt(mainColor.slice(3, 5), 16)}, 
                                   ${parseInt(mainColor.slice(5, 7), 16)}, 0.2);
      }
      
      .form-actions {
        display: flex;
        justify-content: space-between;
        margin-top: 15px;
      }
      
      .contact-submit-btn, 
      .contact-cancel-btn {
        padding: 8px 15px;
        border-radius: 8px;
        font-size: 14px;
        font-weight: 500;
        cursor: pointer;
        transition: all 0.2s ease;
        border: none;
      }
      
      .contact-submit-btn {
        background-color: ${mainColor};
        color: white;
      }
      
      .contact-submit-btn:hover {
        opacity: 0.9;
      }
      
      .contact-cancel-btn {
        background-color: #f2f2f2;
        color: #666;
      }
      
      .contact-cancel-btn:hover {
        background-color: #e5e5e5;
      }
    `;

    // Add styles to shadow DOM
    const styleEl = document.createElement("style");
    styleEl.textContent = styles;
    window.VoiceroText.shadowRoot.appendChild(styleEl);
  },

  // Set up event listeners for the form
  setupFormEventListeners: function (formContainer, interfaceType) {
    // Get form elements
    const submitButton = formContainer.querySelector("#contact-submit");
    const cancelButton = formContainer.querySelector("#contact-cancel");
    const emailInput = formContainer.querySelector("#contact-email");
    const messageInput = formContainer.querySelector("#contact-message");

    // Add submit handler
    if (submitButton) {
      submitButton.addEventListener("click", () => {
        // Basic validation
        if (!emailInput.value.trim()) {
          this.showFormError(emailInput, "Please enter your email address");
          return;
        }

        if (!this.validateEmail(emailInput.value.trim())) {
          this.showFormError(emailInput, "Please enter a valid email address");
          return;
        }

        if (!messageInput.value.trim()) {
          this.showFormError(messageInput, "Please enter your message");
          return;
        }

        // Check message length (must be at least 5 characters to match server validation)
        if (messageInput.value.trim().length < 5) {
          this.showFormError(
            messageInput,
            "Message must be at least 5 characters long"
          );
          return;
        }

        // Submit the form
        this.submitContactForm(
          emailInput.value.trim(),
          messageInput.value.trim(),
          formContainer,
          interfaceType
        );
      });
    }

    // Add cancel handler
    if (cancelButton) {
      cancelButton.addEventListener("click", () => {
        // Remove the form from the chat
        formContainer.remove();

        // Add a cancellation message based on interface type
        const cancelMessage = "No problem! Let me know if you have any other questions.";
        
        if (interfaceType === "voice" && window.VoiceroVoice && window.VoiceroVoice.addMessage) {
          window.VoiceroVoice.addMessage(cancelMessage, "ai");
        } else if (window.VoiceroText && window.VoiceroText.addMessage) {
          window.VoiceroText.addMessage(cancelMessage, "ai");
        }
      });
    }
  },

  // Show error for form field
  showFormError: function (inputElement, message) {
    // Remove any existing error message
    const parent = inputElement.parentElement;
    const existingError = parent.querySelector(".form-error");
    if (existingError) {
      existingError.remove();
    }

    // Add error styles to input
    inputElement.style.borderColor = "#ff3b30";

    // Create error message
    const errorDiv = document.createElement("div");
    errorDiv.className = "form-error";
    errorDiv.textContent = message;
    errorDiv.style.color = "#ff3b30";
    errorDiv.style.fontSize = "12px";
    errorDiv.style.marginTop = "4px";

    // Add error message after input
    parent.appendChild(errorDiv);

    // Focus the input
    inputElement.focus();
  },

  // Validate email format
  validateEmail: function (email) {
    const re =
      /^(([^<>()\[\]\\.,;:\s@"]+(\.[^<>()\[\]\\.,;:\s@"]+)*)|(".+"))@((\[[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}\.[0-9]{1,3}])|(([a-zA-Z\-0-9]+\.)+[a-zA-Z]{2,}))$/;
    return re.test(email);
  },

  // Submit the contact form to the WordPress REST API
  submitContactForm: function (email, message, formContainer, interfaceType) {
    // Create submit in progress UI
    const submitButton = formContainer.querySelector("#contact-submit");
    const originalText = submitButton.textContent;
    submitButton.textContent = "Sending...";
    submitButton.disabled = true;
    submitButton.style.opacity = "0.7";

    // Create the request data
    const requestData = {
      email: email,
      message: message,
    };

    // Add threadId from the session if available
    if (window.VoiceroCore && window.VoiceroCore.session) {
      // Try to get the current thread ID - we need the 'id' property, not the 'threadId' property
      let threadId = null;

      // First check if VoiceroCore.thread is available
      if (window.VoiceroCore.thread && window.VoiceroCore.thread.id) {
        // Get the 'id' value from the thread object
        threadId = window.VoiceroCore.thread.id;
        console.log("Using thread.id:", threadId);
      }
      // If still not found, try to get the most recent thread from the session
      else if (
        window.VoiceroCore.session.threads &&
        window.VoiceroCore.session.threads.length > 0
      ) {
        // Sort threads by lastMessageAt or createdAt to get the most recent
        const threads = [...window.VoiceroCore.session.threads];
        const sortedThreads = threads.sort((a, b) => {
          if (a.lastMessageAt && b.lastMessageAt) {
            return new Date(b.lastMessageAt) - new Date(a.lastMessageAt);
          }
          return new Date(b.createdAt) - new Date(a.createdAt);
        });

        // Get the most recent thread
        const thread = sortedThreads[0];

        // Use the id property (not the threadId property)
        if (thread.id) {
          threadId = thread.id;
          console.log("Using thread.id from session:", threadId);
        }
      }

      // Add threadId to request if found (must use camelCase to match the API)
      if (threadId) {
        requestData.threadId = threadId;
      }

      // Get websiteId - REQUIRED by the API
      if (window.VoiceroCore.websiteId) {
        requestData.websiteId = window.VoiceroCore.websiteId;
      } else if (window.VoiceroCore.session.websiteId) {
        requestData.websiteId = window.VoiceroCore.session.websiteId;
      } else {
        // Log error if websiteId is missing
        console.error("Contact form - Missing required websiteId");
      }

      console.log("VoiceroCore thread:", window.VoiceroCore.thread);
      console.log("VoiceroCore websiteId:", window.VoiceroCore.websiteId);
      console.log("Sending contact form data:", requestData);
    }

    // Send the request to the WordPress REST API
    fetch("/wp-json/voicero/v1/contactHelp", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify(requestData),
    })
      .then((response) => {
        if (!response.ok) {
          // Get the error details from the response
          return response
            .json()
            .then((errorData) => {
              console.error("Contact form submission error:", errorData);
              throw new Error(errorData.error || "Network response was not ok");
            })
            .catch((jsonError) => {
              // If we can't parse the JSON, use the status text
              console.error(
                "Contact form error response parsing failed:",
                jsonError
              );
              throw new Error(
                `Request failed: ${response.status} ${response.statusText}`
              );
            });
        }
        return response.json();
      })
      .then((data) => {
        // Remove the form
        formContainer.remove();

        // Show success message based on interface type
        const successMessage = "Thank you for your message! We've received your request and will get back to you soon.";
        
        if (interfaceType === "voice" && window.VoiceroVoice && window.VoiceroVoice.addMessage) {
          window.VoiceroVoice.addMessage(successMessage, "ai");
        } else if (window.VoiceroText && window.VoiceroText.addMessage) {
          window.VoiceroText.addMessage(successMessage, "ai");
        }
      })
      .catch((error) => {
        // Restore button state
        submitButton.textContent = originalText;
        submitButton.disabled = false;
        submitButton.style.opacity = "1";

        // Show error message
        const formActions = formContainer.querySelector(".form-actions");
        const existingError = formContainer.querySelector(".form-submit-error");

        if (existingError) {
          existingError.remove();
        }

        const errorDiv = document.createElement("div");
        errorDiv.className = "form-submit-error";
        errorDiv.textContent =
          "There was a problem sending your message. Please try again.";
        errorDiv.style.color = "#ff3b30";
        errorDiv.style.fontSize = "12px";
        errorDiv.style.marginTop = "8px";

        if (formActions) {
          formActions.parentNode.insertBefore(
            errorDiv,
            formActions.nextSibling
          );
        }
      });
  },
};

// Initialize when document is ready
document.addEventListener("DOMContentLoaded", () => {
  // Initialize only if VoiceroText is available
  if (window.VoiceroText) {
    VoiceroContact.init();
  } else {
    // Wait for VoiceroText to be available
    let attempts = 0;
    const checkInterval = setInterval(() => {
      attempts++;
      if (window.VoiceroText) {
        clearInterval(checkInterval);
        VoiceroContact.init();
      } else if (attempts >= 50) {
        clearInterval(checkInterval);
        console.error("VoiceroText not available after 50 attempts");
      }
    }, 100);
  }
});

// Expose to global scope
window.VoiceroContact = VoiceroContact;
