/**
 * Strip HTML and CSS from text
 */
function stripHtml(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
}

// Only declare globals if they don't already exist
if (typeof isAiRedirect === "undefined") {
  var isAiRedirect = false;
}
if (typeof ACCESS_KEY === "undefined") {
  var ACCESS_KEY = "";
}
if (typeof currentThreadId === "undefined") {
  // Remove localStorage, just use null
  var currentThreadId = null;
}

document.addEventListener("DOMContentLoaded", async () => {
  // Set ACCESS_KEY value
  ACCESS_KEY = window.aiWebsiteConfig?.accessKey || "";

  // Check if this is an AI redirect
  const urlParams = new URLSearchParams(window.location.search);
  isAiRedirect = urlParams.get("ai_redirect") === "true";

  // Get UI elements
  const mainToggle = document.getElementById("chat-website-button");
  const interactionChooser = document.getElementById("interaction-chooser");
  const textInterface = document.getElementById("text-interface");
  const chatMessages = document.getElementById("chat-messages");

  // First check website active status
  if (!(await checkConnection())) {
    console.log("Website is not active");
    return;
  }

  // Show main toggle button
  if (mainToggle) {
    mainToggle.style.display = "block";
    mainToggle.classList.add("visible");
  }

  // Add this: Fetch thread history if we have a threadId
  await fetchThreadHistory();

  // Set up click handlers
  mainToggle.addEventListener("click", () => {
    interactionChooser.style.display = "block";
    textInterface.style.display = "none";
    mainToggle.classList.add("active");
  });

  // Set up text chat option
  document
    .querySelector(".interaction-option.text")
    .addEventListener("click", () => {
      textInterface.style.display = "block";
      interactionChooser.style.display = "none";
    });

  // Set up close button
  document.getElementById("close-text").addEventListener("click", () => {
    textInterface.style.display = "none";
    mainToggle.classList.remove("active");
  });

  // Set up chat input handlers
  const chatInput = document.getElementById("chat-input");
  const sendButton = document.getElementById("send-message");

  if (sendButton && chatInput) {
    sendButton.addEventListener("click", async () => {
      const text = chatInput.value.trim();
      if (text) {
        chatInput.value = "";
        await handleTextChat(text);
      }
    });

    chatInput.addEventListener("keypress", async (e) => {
      if (e.key === "Enter" && !e.shiftKey) {
        e.preventDefault();
        const text = e.target.value.trim();
        if (text) {
          e.target.value = "";
          await handleTextChat(text);
        }
      }
    });
  }

  // If it's an AI redirect, show the interface and handle thread setup
  if (isAiRedirect) {
    textInterface.style.display = "block";
    interactionChooser.style.display = "none";
    mainToggle.classList.add("active");

    // Get thread ID from URL if it exists
    const threadId = urlParams.get("thread_id");
    if (threadId) {
      currentThreadId = threadId;
      await fetchThreadHistory();
    }

    // Clean up URL
    const newUrl = new URL(window.location.href);
    newUrl.searchParams.delete("ai_redirect");
    newUrl.searchParams.delete("thread_id");
    window.history.replaceState({}, "", newUrl.toString());
  }
});

// Add this function before handleTextChat
function addMessageToChat(role, content, timestamp = Date.now()) {
  const chatMessages = document.getElementById("chat-messages");
  if (!chatMessages) return;

  // Create message element
  const messageDiv = document.createElement("div");
  messageDiv.className = `message-wrapper ${role}-wrapper`;
  messageDiv.dataset.timestamp = timestamp;

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = `message-bubble ${role}-bubble`;
  // Force the background color based on role
 
  if (role === "user") {
    bubbleDiv.style.cssText =
      "background-color: #9370db !important; color: white !important;"; // Purple background, white text for user
  }

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";

  // Format markdown content
  if (typeof content === "string") {
    // Handle bold text
    content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Handle bullet points
    content = content.replace(/^- /gm, "• ");

    // Handle links - extract just the text
    content = content.replace(/\[(.*?)\]\(.*?\)/g, "$1");

    // Split by newlines and create proper spacing
    content = content
      .split("\n")
      .map((line) => {
        // Add extra spacing after bullet points
        if (line.startsWith("• ")) {
          return `<div class="bullet-point">${line}</div>`;
        }
        return line;
      })
      .join("<br>");

    contentDiv.innerHTML = content;
  } else {
    contentDiv.textContent = JSON.stringify(content);
  }

  bubbleDiv.appendChild(contentDiv);
  messageDiv.appendChild(bubbleDiv);

  // Sort messages by timestamp
  const messages = Array.from(chatMessages.children);
  const insertIndex = messages.findIndex(
    (msg) => parseInt(msg.dataset.timestamp) > timestamp
  );

  if (insertIndex === -1) {
    chatMessages.appendChild(messageDiv);
  } else {
    chatMessages.insertBefore(messageDiv, messages[insertIndex]);
  }

  chatMessages.scrollTop = chatMessages.scrollHeight;
}

// Add this before handleTextChat
function handleRedirect(redirectUrl) {
  try {
    const url = new URL(redirectUrl, window.location.origin);
    url.searchParams.set("ai_redirect", "true");

    // Include thread ID in redirect if we have one
    if (currentThreadId) {
      url.searchParams.set("thread_id", currentThreadId);
    }

    console.log("🔄 Redirecting to:", url.toString());
    window.location.href = url.toString();
  } catch (error) {
    console.error("❌ Invalid redirect URL:", redirectUrl);
  }
}

async function handleTextChat(text) {
  try {
    const timestamp = Date.now();
    addMessageToChat("user", text, timestamp);

    const response = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_KEY}`,
      },
      body: JSON.stringify({
        message: text,
        threadId: currentThreadId,
        isVoiceInput: false,
        context: {
          currentUrl: window.location.href,
          currentTitle: document.title,
        },
      }),
    });

    const data = await response.json();
    console.log("💬 AI Response:", data);

    if (data.threadId) {
      currentThreadId = data.threadId;
    }

    // Show AI response
    if (data.response) {
      const content = data.response.content.replace(
        /\[([^\]]+)\]\([^)]+\)/g,
        "$1"
      );
      // Use the created_at from response, or fallback to current timestamp + 1
      const aiTimestamp = data.response.created_at || timestamp + 1;
      addMessageToChat("ai", content, aiTimestamp);

      await new Promise((resolve) => setTimeout(resolve, 1000));

      // Handle navigation after showing the message
      if (data.response.scroll_to_text) {
        const scrollSuccess = scrollToText(data.response.scroll_to_text.trim());
        if (!scrollSuccess) {
          console.warn("Failed to find scroll text, trying redirect instead");
          if (data.response.redirect_url) {
            handleRedirect(data.response.redirect_url);
          }
        }
      } else if (data.response.redirect_url) {
        handleRedirect(data.response.redirect_url);
      }
    }
  } catch (error) {
    console.error("Error in text chat:", error);
    addMessageToChat("ai", "Sorry, I encountered an error. Please try again.");
  }
}

// Add this function to handle scrolling to text
function scrollToText(searchText) {
  if (!searchText) return false;

  console.log("🔍 [ScrollToText] Searching for:", searchText);

  // Create a TreeWalker to iterate through text nodes
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        // Skip hidden elements and chat/transcript elements
        const parent = node.parentElement;
        if (isHidden(parent)) return NodeFilter.FILTER_REJECT;

        // Skip chat messages and transcript content
        const isMessageContent = parent.closest(
          ".message-content, #chat-messages, #transcript-container, .transcript-line"
        );
        if (isMessageContent) return NodeFilter.FILTER_REJECT;

        return NodeFilter.FILTER_ACCEPT;
      },
    }
  );

  let node;
  let found = false;

  // Search through all text nodes
  while ((node = walker.nextNode())) {
    if (node.textContent.includes(searchText)) {
      found = true;
      const element = node.parentElement;

      // Scroll the element into view
      element.scrollIntoView({ behavior: "smooth", block: "center" });

      // Highlight the element temporarily
      const originalBackground = element.style.backgroundColor;
      element.style.backgroundColor = "#ffeb3b";
      element.style.transition = "background-color 0.5s ease";

      // Reset after animation
      setTimeout(() => {
        element.style.backgroundColor = originalBackground;
      }, 2000);

      console.log("✨ [ScrollToText] Found and scrolled to:", searchText);
      break;
    }
  }

  if (!found) {
    console.log("❌ [ScrollToText] Text not found:", searchText);
  }
  return found;
}

// Helper function to check if an element is hidden
function isHidden(element) {
  if (!element) return true;
  const style = window.getComputedStyle(element);
  return (
    style.display === "none" ||
    style.visibility === "hidden" ||
    style.opacity === "0" ||
    element.offsetParent === null
  );
}

// Now checkConnection can access ACCESS_KEY
async function checkConnection() {
  try {
    console.log("Checking connection with access key:", ACCESS_KEY);

    const response = await fetch("http://localhost:3000/api/connect", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_KEY}`,
      },
    });

    const data = await response.json();
    console.log("Connection response:", data);

    if (!response.ok) {
      throw new Error(data.error || "Connection failed");
    }

    return true;
  } catch (error) {
    console.error("Connection check failed:", error);
    return false;
  }
}

// Add this new function to fetch thread history
async function fetchThreadHistory() {
  if (!currentThreadId) return;
  try {
    const response = await fetch(`http://localhost:3000/api/thread-history`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_KEY}`,
      },
      body: JSON.stringify({
        threadId: currentThreadId,
      }),
    });
    const data = await response.json();
    console.log("💬 Thread History:", data);

    // Clear existing messages
    const chatMessages = document.getElementById("chat-messages");
    if (chatMessages) {
      chatMessages.innerHTML = "";
    }

    // Display each message in the thread
    if (data.messages && Array.isArray(data.messages)) {
      // Sort messages by createdAt
      const sortedMessages = [...data.messages].sort(
        (a, b) => new Date(a.createdAt) - new Date(b.createdAt)
      );

      sortedMessages.forEach((message) => {
        // Extract the message content
        const messageContent =
          typeof message.content === "object"
            ? message.content.content || message.content.response?.content
            : message.content;

        // Convert createdAt to timestamp
        const timestamp = new Date(message.createdAt).getTime();

        // === FIX: Convert "assistant" role to "ai" so your CSS can style it. ===
        let finalRole = message.role;
        if (finalRole === "assistant") {
          finalRole = "ai";
        }

        const messageDiv = document.createElement("div");
        messageDiv.className = `message-wrapper ${finalRole}-wrapper`;
        messageDiv.dataset.timestamp = timestamp;

        const bubbleDiv = document.createElement("div");
        bubbleDiv.className = `message-bubble ${finalRole}-bubble`;

        // Fill the content
        const contentDiv = document.createElement("div");
        contentDiv.className = "message-content";
        contentDiv.innerHTML = messageContent;

        bubbleDiv.appendChild(contentDiv);
        messageDiv.appendChild(bubbleDiv);
        chatMessages.appendChild(messageDiv);
      });

      // Scroll to bottom after loading history
      chatMessages.scrollTop = chatMessages.scrollHeight;
    }
  } catch (error) {
    console.error("Error fetching thread history:", error);
  }
}

