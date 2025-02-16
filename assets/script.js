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
if (typeof userPromptHistory === "undefined") {
  var userPromptHistory = [];
}

// Add these variables at the top level
let mediaRecorder = null;
let audioChunks = [];
let isRecording = false;
let audioContext = null;
let analyser = null;
let silenceStart = null;
const SILENCE_THRESHOLD = 0.03; // Increased from 0.01 to 0.03
const SILENCE_DURATION = 1500; // Keep at 1.5 seconds
let hasDetectedSpeech = false;
const SPEECH_THRESHOLD = 0.05; // Higher than silence threshold to ensure it's actual speech

document.addEventListener("DOMContentLoaded", async () => {
  // Set ACCESS_KEY value with more detailed debugging
  ACCESS_KEY = window.aiWebsiteConfig?.accessKey || "";
  console.log("Initial ACCESS_KEY setup:", {
    exists: Boolean(ACCESS_KEY),
    length: ACCESS_KEY?.length || 0,
    fromConfig: Boolean(window.aiWebsiteConfig?.accessKey),
    configObject: window.aiWebsiteConfig || "missing",
  });

  // Check if this is an AI redirect
  const urlParams = new URLSearchParams(window.location.search);
  isAiRedirect = urlParams.get("ai_redirect") === "true";

  // Get UI elements
  const mainToggle = document.getElementById("chat-website-button");
  const interactionChooser = document.getElementById("interaction-chooser");
  const textInterface = document.getElementById("text-interface");
  const voiceInterface = document.getElementById("voice-interface");

  // Hide all elements initially
  if (mainToggle) mainToggle.style.display = "none";
  if (interactionChooser) {
    interactionChooser.style.display = "none";
    interactionChooser.style.visibility = "hidden";
  }
  if (textInterface) textInterface.style.display = "none";
  if (voiceInterface) voiceInterface.style.display = "none";

  // Check connection before showing anything
  const isConnected = await checkConnection();
  console.log("Connection check result:", isConnected);

  if (!isConnected) {
    console.log("Website is not active - keeping AI interface hidden");
    return;
  }

  // Only show main toggle if connected
  if (mainToggle) {
    console.log("Showing main toggle button");
    mainToggle.style.display = "flex";
    mainToggle.classList.add("visible");
  }

  // Add this: Fetch thread history if we have a threadId
  await fetchThreadHistory();

  // Prevent multiple event registrations
  if (mainToggle && !mainToggle.hasAttribute("data-handler-attached")) {
    // Set up click handlers - combine notification removal with main toggle
    mainToggle.addEventListener("click", async (e) => {
      // Prevent event bubbling
      e.stopPropagation();
      e.preventDefault();

      // Remove notification on any click
      mainToggle.classList.remove("has-notification");

      console.log("Main toggle clicked", Date.now());
      const isVisible = interactionChooser.classList.contains("visible");
      console.log("Chooser visible:", isVisible);

      if (isVisible) {
        // If we're closing the interface and recording is active, stop it
        if (isRecording) {
          try {
            // Stop recording without processing audio
            await stopRecording(false);
            isRecording = false;
            audioChunks = []; // Clear the chunks so no audio is processed

            // Remove recording UI states
            const micButton = document.querySelector(".mic-button-header");
            micButton?.classList.remove("recording");
            const voiceInterface = document.getElementById("voice-interface");
            if (voiceInterface) {
              voiceInterface.classList.remove("recording");
            }
          } catch (error) {
            console.error("Error stopping recording:", error);
          }
        }

        interactionChooser.classList.remove("visible");
        setTimeout(() => {
          interactionChooser.style.display = "none";
          interactionChooser.style.visibility = "hidden";
          // Also hide the interfaces
          textInterface.style.display = "none";
          voiceInterface.style.display = "none";
        }, 300);
        mainToggle.classList.remove("active");
      } else {
        interactionChooser.style.display = "block";
        interactionChooser.style.visibility = "visible";
        interactionChooser.offsetHeight; // Force reflow
        interactionChooser.classList.add("visible");

        textInterface.style.display = "none";
        voiceInterface.style.display = "none";
        mainToggle.classList.add("active");
      }
    });

    // Mark that we've attached the handler
    mainToggle.setAttribute("data-handler-attached", "true");
  }

  // Set up text chat option
  const textOption = document.querySelector(".interaction-option.text");
  console.log("Text option found:", !!textOption);

  textOption?.addEventListener("click", () => {
    console.log("Text option clicked");
    textInterface.style.display = "block";
    interactionChooser.classList.remove("visible");
    setTimeout(() => {
      interactionChooser.style.visibility = "hidden";
    }, 300);
  });

  // Set up close button
  document.getElementById("close-text").addEventListener("click", () => {
    textInterface.style.display = "none";
    mainToggle.classList.remove("active");
  });

  // Add this after the text option click handler
  const voiceOption = document.querySelector(".interaction-option.voice");
  console.log("Voice option found:", !!voiceOption);

  voiceOption?.addEventListener("click", () => {
    console.log("Voice option clicked");
    const voiceInterface = document.getElementById("voice-interface");
    voiceInterface.style.display = "block";
    interactionChooser.classList.remove("visible");
    setTimeout(() => {
      interactionChooser.style.visibility = "hidden";
    }, 300);
  });

  // Add close button handler for voice interface
  document.getElementById("close-voice")?.addEventListener("click", () => {
    const voiceInterface = document.getElementById("voice-interface");
    voiceInterface.style.display = "none";
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

  // Add notification dot after a delay
  setTimeout(() => {
    mainToggle?.classList.add("has-notification");
  }, 3000);

  // Make sure interaction chooser starts properly hidden
  if (interactionChooser) {
    interactionChooser.style.display = "none";
    interactionChooser.style.visibility = "hidden";
    interactionChooser.classList.remove("visible");
  }

  // Add mic button click handler
  const micButton = document.querySelector(".mic-button-header");
  if (micButton && !micButton.hasAttribute("data-handler-attached")) {
    micButton.addEventListener("click", async () => {
      try {
        if (!isRecording) {
          // Start recording
          await startRecording();
          micButton.classList.add("recording");
          const voiceInterface = document.getElementById("voice-interface");
          if (voiceInterface) {
            voiceInterface.classList.add("recording");
          }
        } else {
          // Stop recording without processing audio
          await stopRecording(false);
          micButton.classList.remove("recording");
          const voiceInterface = document.getElementById("voice-interface");
          if (voiceInterface) {
            voiceInterface.classList.remove("recording");
          }
        }
      } catch (error) {
        console.error("Microphone error:", error);
        alert("Could not access microphone. Please check your permissions.");
      }
    });

    // Mark that we've attached the handler
    micButton.setAttribute("data-handler-attached", "true");
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

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content";

  // Format markdown content
  if (typeof content === "string") {
    // Extract text from square brackets and remove parentheses with http links
    content = content
      // First handle any [...](http...) pattern
      .replace(/\[([^\]]+)\]\([^)]*http[^)]*\)/g, "$1")
      // Then handle any remaining [...] pattern
      .replace(/\[([^\]]+)\]/g, "$1")
      // Finally remove any (http...) pattern
      .replace(/\([^)]*http[^)]*\)/g, "");

    // Convert markdown list items
    content = content.replace(/^- (.+)$/gm, "• $1");

    // Handle bold text
    content = content.replace(/\*\*(.*?)\*\*/g, "<strong>$1</strong>");

    // Convert newlines to proper spacing
    content = content
      .split("\n")
      .map((line) => {
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

    // Add current prompt to history
    userPromptHistory.push(text);
    // Keep only last 3 prompts (including current one)
    if (userPromptHistory.length > 3) {
      userPromptHistory = userPromptHistory.slice(-3);
    }

    // Add loading message
    const loadingTimestamp = timestamp + 1;
    const loadingId = addLoadingMessage(loadingTimestamp);

    // Get past 2 prompts (excluding current one)
    const pastPrompts = userPromptHistory.slice(0, -1);

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
        pastPrompts: pastPrompts,
        context: {
          currentUrl: window.location.href,
          currentTitle: document.title,
        },
      }),
    });

    // Remove loading message
    removeLoadingMessage(loadingId);

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

// Update the addLoadingMessage function
function addLoadingMessage(timestamp) {
  const loadingId = `loading-${timestamp}`;
  const messages = [
    ".....",
    "searching",
    "clicking",
    "reading",
    "thinking",
    "scrolling",
    "thinking",
  ];
  const colors = ["#9370DB", "#8A2BE2", "#9400D3", "#800080"];
  let currentIndex = 0;

  const messageDiv = document.createElement("div");
  messageDiv.className = "message-wrapper ai-wrapper";
  messageDiv.dataset.timestamp = timestamp;
  messageDiv.id = loadingId;

  const bubbleDiv = document.createElement("div");
  bubbleDiv.className = "message-bubble loading-bubble";

  const contentDiv = document.createElement("div");
  contentDiv.className = "message-content loading-content";

  updateLoadingText(contentDiv, messages[0], colors[0]);

  bubbleDiv.appendChild(contentDiv);
  messageDiv.appendChild(bubbleDiv);

  const chatMessages = document.getElementById("chat-messages");
  chatMessages.appendChild(messageDiv);
  chatMessages.scrollTop = chatMessages.scrollHeight;

  // Slow down the interval to 3 seconds
  const intervalId = setInterval(() => {
    currentIndex = (currentIndex + 1) % messages.length;
    updateLoadingText(contentDiv, messages[currentIndex], colors[currentIndex]);
  }, 4000); // Slowed down to 3 seconds

  messageDiv.dataset.intervalId = intervalId;
  return loadingId;
}

function updateLoadingText(container, text, color) {
  container.innerHTML = "";

  [...text].forEach((char, index) => {
    const span = document.createElement("span");
    span.textContent = char;
    span.style.color = color;
    span.style.opacity = "0";
    // Slow down the character animation to 3 seconds with longer delays between characters
    span.style.animation = `fadeInOut 2s ease ${index * 0.2}s`;
    container.appendChild(span);
  });
}

function removeLoadingMessage(loadingId) {
  const loadingDiv = document.getElementById(loadingId);
  if (loadingDiv) {
    // Clear the interval
    clearInterval(loadingDiv.dataset.intervalId);
    // Remove the element
    loadingDiv.remove();
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

// Update checkConnection with more debugging
async function checkConnection() {
  try {
    console.log(
      "Checking connection with access key:",
      ACCESS_KEY ? "Key exists" : "No key"
    );

    if (!ACCESS_KEY) {
      console.log("No access key available");
      return false;
    }

    const response = await fetch("http://localhost:3000/api/connect", {
      method: "GET",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_KEY}`,
      },
    });

    const data = await response.json();
    console.log("Connection response full data:", data);

    if (!response.ok || data.error) {
      console.log("Connection failed:", data.error || "Unknown error");
      return false;
    }

    // Verify the website is active in the response
    if (data.website && data.website.active === false) {
      console.log("Website is not active");
      return false;
    }

    console.log("Connection successful, website is active");
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

// Update the startRecording function
async function startRecording() {
  try {
    console.log(
      "Access key when starting recording:",
      ACCESS_KEY ? "exists" : "missing"
    );
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    audioChunks = [];

    // Reset detection states
    hasDetectedSpeech = false;
    silenceStart = null;

    // Set isRecording to true BEFORE setting up audio analysis
    isRecording = true;
    console.log("Recording flag set to:", isRecording);

    // Set up audio analysis
    audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(stream);
    analyser = audioContext.createAnalyser();
    analyser.fftSize = 256;
    source.connect(analyser);

    console.log("Audio analysis setup complete");
    console.log("Starting speech detection with:", {
      speechThreshold: SPEECH_THRESHOLD,
      silenceThreshold: SILENCE_THRESHOLD,
      duration: SILENCE_DURATION,
      fftSize: analyser.fftSize,
    });

    mediaRecorder.ondataavailable = (event) => {
      audioChunks.push(event.data);
    };

    mediaRecorder.onstop = async () => {
      const audioBlob = new Blob(audioChunks, { type: "audio/wav" });
      await processAudio(audioBlob);
    };

    // Start the media recorder
    mediaRecorder.start();

    // Start detection
    console.log("Waiting for speech...");
    detectSilence();

    console.log("Recording started");
  } catch (error) {
    console.error("Error starting recording:", error);
    isRecording = false;
    hasDetectedSpeech = false;
    throw error;
  }
}

// Update the detectSilence function to handle initial speech detection
function detectSilence() {
  if (!isRecording || !analyser) {
    console.log("Not recording or no analyser available");
    return;
  }

  const dataArray = new Uint8Array(analyser.frequencyBinCount);
  analyser.getByteFrequencyData(dataArray);

  // Calculate average volume
  const average = dataArray.reduce((a, b) => a + b) / dataArray.length;
  const normalizedAverage = average / 256; // Normalize to 0-1 range

  // Log the audio levels periodically (every 500ms to avoid console spam)
  if (Date.now() % 500 < 50) {
    console.log(
      `Current audio level: ${normalizedAverage.toFixed(4)} ${
        !hasDetectedSpeech
          ? "(WAITING FOR SPEECH)"
          : normalizedAverage < SILENCE_THRESHOLD
          ? "(SILENCE)"
          : "(SOUND)"
      }`
    );
  }

  // First wait for speech to begin
  if (!hasDetectedSpeech) {
    if (normalizedAverage > SPEECH_THRESHOLD) {
      hasDetectedSpeech = true;
      console.log("🎤 Speech detected - now monitoring for silence");
    }
    // Continue checking if still recording
    if (isRecording) {
      requestAnimationFrame(detectSilence);
    }
    return;
  }

  // Only check for silence after speech has been detected
  if (normalizedAverage < SILENCE_THRESHOLD) {
    if (!silenceStart) {
      silenceStart = Date.now();
      console.log("🔇 Silence started");
    } else {
      const silenceDuration = Date.now() - silenceStart;
      // Log silence duration every 500ms
      if (silenceDuration % 500 < 50) {
        console.log(
          `⏱️ Silence duration: ${silenceDuration}ms / ${SILENCE_DURATION}ms`
        );
      }

      if (silenceDuration >= SILENCE_DURATION) {
        console.log("🛑 Silence threshold reached - stopping recording");
        stopRecording(true);
        return;
      }
    }
  } else {
    if (silenceStart) {
      console.log("🔊 Silence broken - resetting timer");
      silenceStart = null;
    }
  }

  // Continue checking if still recording
  if (isRecording) {
    requestAnimationFrame(detectSilence);
  }
}

// Update stopRecording to clean up audio analysis
async function stopRecording(processAudioData = true) {
  if (mediaRecorder && isRecording) {
    // If we don't want to process the audio, remove both handlers
    if (!processAudioData) {
      mediaRecorder.ondataavailable = null;
      mediaRecorder.onstop = null;
    }

    // Stop all tracks in the stream first
    mediaRecorder.stream.getTracks().forEach((track) => track.stop());

    // Clean up audio analysis
    if (audioContext) {
      await audioContext.close();
      audioContext = null;
      analyser = null;
    }

    // Then stop the recorder
    mediaRecorder.stop();
    isRecording = false;
    silenceStart = null;
    console.log("Recording stopped, process audio:", processAudioData);

    // Clear chunks if we're not processing
    if (!processAudioData) {
      audioChunks = [];
    }
  }
}

async function processAudio(audioBlob) {
  try {
    // Add debug logging for access key
    console.log("Access key being sent:", {
      length: ACCESS_KEY?.length || 0,
      firstChars: ACCESS_KEY ? ACCESS_KEY.substring(0, 5) + "..." : "none",
    });

    // First, show a loading message in the voice interface
    const conversationContainer = document.querySelector(
      ".conversation-container"
    );
    const userMessageLine = conversationContainer.querySelector(
      ".message-line:first-child .content"
    );
    userMessageLine.textContent = "Processing your message...";

    // Create form data with the audio file
    const formData = new FormData();
    formData.append("audio", audioBlob, "recording.wav");

    // Log the full request details (except the audio data)
    console.log("Sending request to whisper API:", {
      url: "http://localhost:3000/api/whisper",
      headers: {
        Authorization: `Bearer ${ACCESS_KEY.substring(0, 5)}...`,
      },
    });

    // Send to Whisper API endpoint with proper Authorization header
    const response = await fetch("http://localhost:3000/api/whisper", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${ACCESS_KEY}`,
      },
      body: formData,
    });

    // Log response status and headers
    console.log("Whisper API response:", {
      status: response.status,
      statusText: response.statusText,
      headers: Object.fromEntries(response.headers.entries()),
    });

    if (!response.ok) {
      // Add better error handling with full error details
      const errorData = await response.json();
      console.error("Full error response:", errorData);
      throw new Error(
        errorData.error || `HTTP error! status: ${response.status}`
      );
    }

    const data = await response.json();
    console.log("Whisper response:", data);

    if (data.error) {
      throw new Error(data.error);
    }

    // Show transcribed text in voice interface
    userMessageLine.textContent = data.text;

    // Now send the transcribed text to the chat API
    await handleVoiceChat(data.text);
  } catch (error) {
    console.error("Error processing audio:", error);
    const conversationContainer = document.querySelector(
      ".conversation-container"
    );
    const userMessageLine = conversationContainer.querySelector(
      ".message-line:first-child .content"
    );
    userMessageLine.textContent = `Error: ${
      error.message || "Could not process audio"
    }`;
  }
}

async function handleVoiceChat(text) {
  try {
    const conversationContainer = document.querySelector(
      ".conversation-container"
    );
    const aiMessageLine = conversationContainer.querySelector(
      ".message-line:last-child .content"
    );

    // Show loading state
    aiMessageLine.textContent = "Thinking...";

    // Notice we're sending the currentThreadId here
    const response = await fetch("http://localhost:3000/api/chat", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${ACCESS_KEY}`,
      },
      body: JSON.stringify({
        message: text,
        threadId: currentThreadId, // Using the same threadId variable as text chat
        isVoiceInput: true,
        pastPrompts: userPromptHistory,
        context: {
          currentUrl: window.location.href,
          currentTitle: document.title,
        },
      }),
    });

    const data = await response.json();
    console.log("💬 AI Voice Response:", data);

    if (data.threadId) {
      currentThreadId = data.threadId;
    }

    // Show AI response
    if (data.response) {
      const content = data.response.content.replace(
        /\[([^\]]+)\]\([^)]+\)/g,
        "$1"
      );
      aiMessageLine.textContent = content;

      // Call text-to-speech API
      try {
        const ttsResponse = await fetch("http://localhost:3000/api/tts", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${ACCESS_KEY}`,
          },
          body: JSON.stringify({
            text: content,
          }),
        });

        if (!ttsResponse.ok) {
          throw new Error(`TTS API error: ${ttsResponse.status}`);
        }

        // The response will be audio data that you'll handle in your API implementation
        const audioBlob = await ttsResponse.blob();
        const audioUrl = URL.createObjectURL(audioBlob);
        const audio = new Audio(audioUrl);
        await audio.play();

        // Clean up the blob URL after playing
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
        };
      } catch (ttsError) {
        console.error("Text-to-speech error:", ttsError);
        // Continue with the rest of the function even if TTS fails
      }

      // Handle navigation after showing the message
      await new Promise((resolve) => setTimeout(resolve, 1000));

      if (data.response.scroll_to_text) {
        const scrollSuccess = scrollToText(data.response.scroll_to_text.trim());
        if (!scrollSuccess && data.response.redirect_url) {
          handleRedirect(data.response.redirect_url);
        }
      } else if (data.response.redirect_url) {
        handleRedirect(data.response.redirect_url);
      }
    }
  } catch (error) {
    console.error("Error in voice chat:", error);
    const conversationContainer = document.querySelector(
      ".conversation-container"
    );
    const aiMessageLine = conversationContainer.querySelector(
      ".message-line:last-child .content"
    );
    aiMessageLine.textContent =
      "Sorry, I encountered an error. Please try again.";
  }
}
