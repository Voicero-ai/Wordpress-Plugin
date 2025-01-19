/****************************************************************************
 * script.js (FULL CODE, NOTHING SKIPPED)
 * If using Next.js, you can adapt this into a "page.tsx" file, or a client
 * component. For standard HTML, just load it as a separate script.
 ****************************************************************************/

/**
 * Strip HTML and CSS from text
 */
function stripHtml(html) {
  // Create a temporary div
  const temp = document.createElement("div");
  temp.innerHTML = html;
  // Get text content only
  return temp.textContent || temp.innerText || "";
}

// This code runs after the DOM is loaded
document.addEventListener("DOMContentLoaded", async () => {
  /**************************************************************************
   * 1) Collect site content on page load
   **************************************************************************/
  window.siteContent = await collectSiteContent();
  console.log("Site content loaded on page load:", window.siteContent);

  /**************************************************************************
   * 2) GLOBALS
   **************************************************************************/
  let recorder = null; // RecordRTC instance
  let isListening = false; // Whether mic is actively listening
  let audioContext = null; // For silence detection
  let analyser = null; // For silence detection
  let dataArray = null; // For silence detection
  let silenceTimer = null; // For silence detection
  let mediaRecorder = null; // Unused if using RecordRTC
  let interimTranscript = ""; // For onresult partial transcripts
  let recognition = null; // webkitSpeechRecognition instance
  let chatHistory = []; // Keep track of user & AI conversation
  const MAX_HISTORY_LENGTH = 5; // We keep the last 5 user+AI turns

  // Silence detection constants
  const SILENCE_THRESHOLD = 0.01;
  const SILENCE_DURATION = 2000; // 2 seconds
  const MAX_EMPTY_ATTEMPTS = 3;
  let emptyTranscriptionCount = 0;

  // We'll store the mic's MediaStream here
  let mediaStream = null;

  /**************************************************************************
   * 3) DOM ELEMENTS
   **************************************************************************/
  const mainToggle = document.querySelector("#main-voice-toggle");
  const interactionChooser = document.getElementById("interaction-chooser");
  const voiceInterface = document.getElementById("voice-interface");
  const textInterface = document.getElementById("text-interface");
  const voicePopupToggle = document.querySelector("#voice-popup-toggle");
  const popup = document.getElementById("voice-popup");
  const closeButton = document.getElementById("close-popup");
  const micButton = document.getElementById("mic-button");
  const transcriptContainer = document.getElementById("transcript-container");
  const transcriptText = transcriptContainer.querySelector(".transcript-text");
  const recordingWaves = document.querySelector(".recording-waves");
  const aiSpeakingIndicator = document.querySelector(".ai-speaking-indicator");
  const chatInput = document.getElementById("chat-input");
  const sendButton = document.getElementById("send-message");
  const chatMessages = document.getElementById("chat-messages");

  /**************************************************************************
   * 4) UI HANDLERS
   **************************************************************************/

  /* Main AI toggle (On/Off) */
  mainToggle.addEventListener("click", async () => {
    mainToggle.classList.toggle("active");
    if (mainToggle.classList.contains("active")) {
      // If turned ON
      interactionChooser.style.display = "block";
      voiceInterface.style.display = "none";
      textInterface.style.display = "none";
    } else {
      // If turned OFF
      console.log("Turning off main toggle, cleaning up...");

      // Hide interfaces
      interactionChooser.style.display = "none";
      voiceInterface.style.display = "none";
      textInterface.style.display = "none";

      // Stop everything if we are currently listening
      if (isListening) {
        // Stop recorder
        if (recorder) {
          try {
            recorder.stopRecording();
            await new Promise((resolve) => {
              recorder.destroy(() => {
                console.log("Recorder destroyed");
                resolve();
              });
            });
            recorder = null;
          } catch (e) {
            console.error("Error stopping recorder:", e);
          }
        }

        // Stop recognition
        if (recognition) {
          try {
            recognition.stop();
            recognition = null;
            console.log("Recognition stopped");
          } catch (e) {
            console.error("Error stopping recognition:", e);
          }
        }

        // Close audio context
        if (audioContext) {
          try {
            await audioContext.close();
            audioContext = null;
            console.log("Audio context closed");
          } catch (e) {
            console.error("Error closing audio context:", e);
          }
        }

        // Stop media stream
        if (mediaStream) {
          mediaStream.getTracks().forEach((track) => {
            track.stop();
            console.log("Media track stopped");
          });
          mediaStream = null;
        }

        // Reset state
        isListening = false;
        micButton.classList.remove("listening");
        micButton.disabled = false;
        micButton.style.opacity = "1";

        // Full cleanup
        cleanupRecording(true);
      }

      console.log("Main toggle cleanup complete");
    }
  });

  /* Choose voice-based interaction */
  document
    .querySelector(".interaction-option.voice")
    .addEventListener("click", () => {
      voiceInterface.style.display = "block";
      textInterface.style.display = "none";
      interactionChooser.style.display = "none";
      mainToggle.classList.add("active");
    });

  /* Choose text-based interaction */
  document
    .querySelector(".interaction-option.text")
    .addEventListener("click", () => {
      textInterface.style.display = "block";
      voiceInterface.style.display = "none";
      interactionChooser.style.display = "none";
    });

  /* Microphone button handler */
  micButton.addEventListener("click", async () => {
    console.log("Mic button clicked, current state:", isListening);
    if (micButton.disabled) return;
    micButton.disabled = true;

    try {
      if (!isListening) {
        console.log("Starting new recording session");
        await startRecording();
      } else {
        console.log("Stopping current recording session");
        cleanupRecording(false);
      }
    } catch (error) {
      console.error("Error in mic button handler:", error);
      cleanupRecording();
    } finally {
      // Re-enable button after a short delay
      setTimeout(() => {
        micButton.disabled = false;
      }, 1000);
    }
  });

  /* Close the voice interface (X button) */
  document.getElementById("close-voice").addEventListener("click", () => {
    voiceInterface.style.display = "none";
    mainToggle.classList.remove("active");
    cleanupRecording(true);
  });

  /* Close the text interface (X button) */
  document.getElementById("close-text").addEventListener("click", () => {
    textInterface.style.display = "none";
    mainToggle.classList.remove("active");
  });

  /* Voice popup toggle (if you have a popup to show site content) */
  if (voicePopupToggle) {
    voicePopupToggle.addEventListener("click", () => {
      voicePopupToggle.classList.toggle("active");
      if (voicePopupToggle.classList.contains("active")) {
        popup.style.display = "flex";

        // Show site content (pages, posts, products) in some small JSON viewer
        const contentDisplay = document.createElement("pre");
        contentDisplay.id = "content-display";
        contentDisplay.style.cssText = `
          max-height: 150px;
          overflow-y: auto;
          background: #f5f5f5;
          padding: 10px;
          border-radius: 5px;
          margin-top: 10px;
          text-align: left;
          font-size: 10px;
        `;
        contentDisplay.textContent = JSON.stringify(
          window.siteContent,
          null,
          2
        );

        let jsonContainer = document.getElementById("json-container");
        if (!jsonContainer) {
          jsonContainer = document.createElement("div");
          jsonContainer.id = "json-container";
          document
            .querySelector(".voice-popup-content")
            .appendChild(jsonContainer);
        }

        jsonContainer.innerHTML = "";
        jsonContainer.appendChild(contentDisplay);
      } else {
        popup.style.display = "none";
      }
    });
  }

  /* Close popup by clicking outside content */
  if (popup) {
    popup.addEventListener("click", (e) => {
      if (e.target === popup) {
        popup.style.display = "none";
        if (voicePopupToggle) voicePopupToggle.classList.remove("active");
        cleanupRecording();
      }
    });
  }

  /* Close popup with the X button */
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      popup.style.display = "none";
      if (voicePopupToggle) voicePopupToggle.classList.remove("active");
      cleanupRecording();
    });
  }

  /* Text interface: Send on Enter key */
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  /* Text interface: Send on button click */
  sendButton.addEventListener("click", sendMessage);

  /**************************************************************************
   * 5) RECORDING & TTS FUNCTIONS
   **************************************************************************/

  /**
   * sendToGemini()
   * Sends user text to the /gemini endpoint, expecting JSON with:
   * {
   *   "response": "...some text...",
   *   "redirect_url": "https://..."
   * }
   */
  async function sendToGemini(text) {
    try {
      // Add user message to chatHistory
      chatHistory.push({ role: "user", content: text });
      if (chatHistory.length > MAX_HISTORY_LENGTH * 2) {
        chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH * 2);
      }

      // Get the raw site content that was loaded on page load
      const pages = window.siteContent.pages || [];
      const posts = window.siteContent.posts || [];
      const products = window.siteContent.products || [];

      console.log("🔎 [sendToGemini] Using raw data:", {
        pages,
        posts,
        products,
      });

      // Make the request
      const response = await fetch("http://localhost:5001/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          context: `
            You are a friendly voice assistant helping someone navigate this website.
            Keep responses brief and conversational.

            Previous conversation:
            ${chatHistory
              .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
              .join("\n")}

            User's question/message: ${text}

            Here are the pages:
            ${pages
              .map(
                (page) => `
              PAGE: ${page.title}
              URL: ${page.link}
              CONTENT: ${page.content}
              ---
            `
              )
              .join("\n")}

            Here are the blog posts:
            ${posts
              .map(
                (post) => `
              POST: ${post.title}
              URL: ${post.link}
              CONTENT: ${post.content}
              ---
            `
              )
              .join("\n")}

            Here are the products:
            ${products
              .map(
                (product) => `
              PRODUCT: ${product.title}
              PRICE: ${product.price}
              URL: ${product.link}
              DESCRIPTION: ${product.content}
              CATEGORIES: ${product.categories?.join(", ") || ""}
              SKU: ${product.sku}
              STOCK: ${product.in_stock ? "In Stock" : "Out of Stock"}
              ---
            `
              )
              .join("\n")}
          `,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `[Gemini] responded with ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();
      console.log("📥 [sendToGemini] Raw data from server:", data);

      // 1) Grab AI's text from your back-end (wherever it's returned)
      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      // 2) Attempt to parse it as JSON
      let parsed;
      try {
        // Strip any ```json ... ``` fences
        // Remove ANY triple backticks with optional "json"
        const pattern = /```(?:json)?([\s\S]*?)```/g;
        const cleanJson = aiText.replace(pattern, "$1").trim();
        parsed = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.warn(
          "Could not parse AI text as JSON. Falling back to plain text..."
        );
        // Fallback: Just treat the entire AI text as the 'response'
        parsed = { response: aiText, redirect_url: null };
      }

      // 3) Extract the actual response text and optional redirect
      const aiResponse = parsed.response;
      const aiRedirect = parsed.redirect_url;

      // 4) Display the AI response and send to TTS
      await sendToTTS(aiResponse);

      // 5) If redirect is provided, redirect the user after speech is done
      if (typeof aiRedirect === "string" && aiRedirect.trim()) {
        console.log("➡️ [sendToGemini] Redirecting to:", aiRedirect);
        window.location.href = aiRedirect;
      }

      // If the user hasn't turned AI off, auto-restart mic
      if (mainToggle.classList.contains("active") && isListening) {
        console.log("✅ [sendToGemini] TTS done. Auto-restart mic...");
        startRecording();
      }
    } catch (error) {
      console.error("❌ [sendToGemini] Error:", error);
      cleanupRecording();
    }
  }

  /**
   * startRecording()
   * Gets user mic, starts RecordRTC, sets up speech recognition & silence detection
   */
  async function startRecording() {
    console.log("🎤 [Recording] Starting...");
    try {
      micButton.classList.add("listening");
      recordingWaves.classList.add("active");
      emptyTranscriptionCount = 0;

      if (recorder) {
        recorder.destroy();
        recorder = null;
      }

      // Ask for mic access
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      console.log("🎤 [Recording] Got media stream");
      mediaStream = stream;

      // Create a new RecordRTC instance
      recorder = new RecordRTC(stream, {
        type: "audio",
        mimeType: "audio/wav",
        recorderType: RecordRTC.StereoAudioRecorder,
        desiredSampRate: 16000,
        numberOfAudioChannels: 1,
      });

      recorder.startRecording();
      console.log("🎤 [Recording] RecordRTC started");

      // Setup webkitSpeechRecognition
      if ("webkitSpeechRecognition" in window) {
        if (recognition) {
          try {
            recognition.stop();
            recognition = null;
          } catch (e) {
            console.error("[Recording] Error stopping old recognition:", e);
          }
        }

        // Create a new recognition instance
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        setupRecognitionHandlers(recognition);

        try {
          isListening = true;
          await recognition.start();
          console.log("🎤 [Recording] Recognition started");

          // Setup silence detection
          setupSilenceDetection(stream);
          console.log("🎤 [Recording] Setup complete");
        } catch (e) {
          console.error("[Recording] Error in recognition setup:", e);
          cleanupRecording();
          throw e;
        }
      }
    } catch (error) {
      console.error("❌ [Recording] Error starting recording:", error);
      alert("Please allow microphone access.");
      cleanupRecording();
      throw error;
    }
  }

  /**
   * stopRecording()
   * Called by silence detection or manual triggers
   */
  function stopRecording() {
    console.log("🛑 [Recording] Stopping...");
    if (!recorder || !isListening) return;

    isListening = false;

    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        console.error("[Recording] Error stopping recognition:", e);
      }
      recognition = null;
    }

    // Stop RecordRTC
    recorder.stopRecording(async () => {
      console.log("🛑 [Recording] Stopped, sending audio to server...");
      const audioBlob = recorder.getBlob();
      await sendAudioToServer(audioBlob);

      // Cleanup
      if (recorder) {
        recorder.destroy();
        recorder = null;
      }
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      micButton.classList.remove("listening");
    });
  }

  /**
   * sendAudioToServer()
   * Sends recorded audio to /transcribe
   */
  async function sendAudioToServer(audioBlob) {
    const formData = new FormData();
    formData.append("audio", audioBlob, "speech.wav");

    console.log("📤 [Transcribe] Sending audio to /transcribe...");
    try {
      const response = await fetch("http://localhost:5001/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      console.log("📥 [Transcribe] Received:", data);

      // If there's no actual transcription, we handle that
      if (!data.transcription || !data.transcription.trim()) {
        console.log("🔇 [Transcribe] Empty transcription");
        emptyTranscriptionCount++;
        if (emptyTranscriptionCount >= MAX_EMPTY_ATTEMPTS) {
          console.log("🛑 [Transcribe] Max empty attempts, stopping.");
          emptyTranscriptionCount = 0;
          cleanupRecording();
          return;
        }
        console.log("🔄 [Transcribe] Attempt again (startRecording) ...");
        if (!isListening) {
          startRecording();
        }
        return;
      }

      // We got a valid transcription
      emptyTranscriptionCount = 0;
      transcriptText.textContent = data.transcription;
      // Send it to Gemini
      await sendToGemini(data.transcription);
    } catch (error) {
      console.error("❌ [Transcribe] Error:", error);
      cleanupRecording();
    }
  }

  /**
   * sendToTTS()
   * Sends text to /speak, plays the returned MP3 audio
   */
  async function sendToTTS(text) {
    console.log("📤 [TTS] Sending text to /speak:", text);
    try {
      micButton.disabled = true;
      micButton.style.opacity = "0.5";

      const response = await fetch("http://localhost:5001/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const audioBlob = await response.blob();
      console.log("📥 [TTS] Received audio blob");
      const audioURL = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioURL);

      // Return a promise that resolves when audio finishes
      return new Promise((resolve, reject) => {
        audio.onended = () => {
          console.log("🔊 [TTS] Playback ended");
          URL.revokeObjectURL(audioURL);
          micButton.disabled = false;
          micButton.style.opacity = "1";
          resolve();
        };

        audio.onerror = (err) => {
          console.error("❌ [TTS] Playback error:", err);
          micButton.disabled = false;
          micButton.style.opacity = "1";
          reject(err);
        };

        audio.play().catch(reject);
      });
    } catch (error) {
      console.error("❌ [TTS] Error:", error);
      micButton.disabled = false;
      micButton.style.opacity = "1";
      throw error;
    }
  }

  /**************************************************************************
   * 6) SILENCE DETECTION
   **************************************************************************/
  function setupSilenceDetection(stream) {
    audioContext = new AudioContext();
    analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);

    analyser.fftSize = 512;
    dataArray = new Uint8Array(analyser.fftSize);

    source.connect(analyser);
    checkSilence();
  }

  function checkSilence() {
    if (!isListening) return;

    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    for (let i = 0; i < dataArray.length; i++) {
      const val = dataArray[i] - 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length) / 128;

    if (rms < SILENCE_THRESHOLD) {
      // Start a timer if not already running
      if (!silenceTimer) {
        silenceTimer = setTimeout(() => {
          console.log("🔇 [Silence Detection] Stopping after silence...");
          stopRecording();
        }, SILENCE_DURATION);
      }
    } else {
      // If there's noise, reset timer
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    }

    // Keep checking
    requestAnimationFrame(checkSilence);
  }

  /**************************************************************************
   * 7) CLEANUP
   **************************************************************************/
  function cleanupRecording(clearHistory = false) {
    console.log("♻️ [Cleanup] Recording...");
    isListening = false;

    micButton.classList.remove("listening");
    micButton.disabled = false;
    micButton.style.opacity = "1";

    if (silenceTimer) {
      clearTimeout(silenceTimer);
      silenceTimer = null;
    }

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    if (recorder) {
      recorder.destroy();
      recorder = null;
    }

    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        console.error("Error stopping recognition in cleanup:", e);
      }
      recognition = null;
    }

    if (transcriptText) transcriptText.textContent = "";
    const aiResponse = document.querySelector(
      ".transcript-line.ai-response span"
    );
    if (aiResponse) aiResponse.textContent = "";

    if (clearHistory) {
      chatHistory = [];
      if (transcriptContainer) transcriptContainer.innerHTML = "";
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStream = null;
    }
  }

  /**************************************************************************
   * 8) TRANSCRIPT DISPLAY
   **************************************************************************/
  function updateTranscriptDisplay() {
    // Show only the last user + AI pair
    transcriptContainer.innerHTML = "";

    const lastMessages = chatHistory.slice(-2);
    lastMessages.forEach((msg) => {
      const line = document.createElement("div");
      line.className = `transcript-line ${
        msg.role === "assistant" ? "ai-response" : ""
      }`;
      line.innerHTML = `<strong>${
        msg.role === "assistant" ? "AI" : "User"
      }:</strong> <span>${msg.content}</span>`;
      transcriptContainer.appendChild(line);
    });

    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
  }

  /**************************************************************************
   * 9) TEXT CHAT - sendMessage()
   **************************************************************************/
  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    chatInput.value = "";
    addMessageToChat("user", text);

    try {
      chatHistory.push({ role: "user", content: text });
      if (chatHistory.length > MAX_HISTORY_LENGTH * 2) {
        chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH * 2);
      }

      const loadingMessage = addMessageToChat("ai", "...");

      // Format site content for context
      const formattedPages = (window.siteContent.pages || []).map((p) => ({
        title: p.title,
        url: p.url || "",
        content: (p.fullContent || p.content || "").substring(0, 500),
      }));
      const formattedPosts = (window.siteContent.posts || []).map((p) => ({
        title: p.title,
        content: p.content.substring(0, 500),
      }));
      const formattedProducts = (window.siteContent.products || []).map(
        (p) => ({
          title: p.title,
          price: p.price,
          description: p.content,
          categories: (p.categories || []).join(", "),
        })
      );

      // Send to /gemini
      const response = await fetch("http://localhost:5001/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          context: `
            You are a friendly AI assistant helping someone navigate this website.
            Keep responses brief and conversational.

            Previous conversation:
            ${chatHistory
              .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
              .join("\n")}

            Pages:
            ${formattedPages
              .map(
                (page) =>
                  `PAGE: ${page.title}\nURL: ${page.url}\nCONTENT: ${page.content}\n---`
              )
              .join("\n")}
            Posts:
            ${formattedPosts
              .map(
                (post) => `POST: ${post.title}\nCONTENT: ${post.content}\n---`
              )
              .join("\n")}
            Products:
            ${formattedProducts
              .map(
                (product) =>
                  `PRODUCT: ${product.title}\nPRICE: ${product.price}\nDESCRIPTION: ${product.description}\n---`
              )
              .join("\n")}
          `,
        }),
      });

      if (!response.ok) {
        throw new Error(`[Gemini] Error: ${response.status}`);
      }

      const data = await response.json();
      console.log("📥 [sendMessage] Gemini response:", data);

      const rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      loadingMessage.remove();

      let parsed;
      try {
        parsed = JSON.parse(rawText);
      } catch (err) {
        console.warn(
          "[sendMessage] Parsing AI text as JSON failed. Fallback to plain text."
        );
        parsed = { response: rawText, redirect_url: null };
      }

      const aiResp = parsed.response || rawText;
      const aiRedirect = parsed.redirect_url || null;

      addMessageToChat("ai", aiResp);
      chatHistory.push({ role: "assistant", content: aiResp });

      // Wait for TTS to complete before redirecting
      if (aiRedirect && typeof aiRedirect === "string" && aiRedirect.trim()) {
        console.log("🗣️ [sendMessage] Speaking before redirect...");
        await sendToTTS(aiResp);
        console.log("➡️ [sendMessage] Now redirecting to:", aiRedirect);
        window.location.href = aiRedirect;
      } else {
        // If no redirect, just speak normally
        await sendToTTS(aiResp);
        console.log("ℹ️ [sendMessage] No redirect.");
      }

      chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
      console.error("❌ [sendMessage] Error:", error);
      const errorMessage = "Sorry, I encountered an error. Please try again.";
      addMessageToChat("ai", errorMessage);
      chatHistory.push({ role: "assistant", content: errorMessage });
    }
  }

  /**
   * addMessageToChat()
   * Helper for text-based chat
   */
  function addMessageToChat(role, content) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}`;

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";
    if (content === "...") {
      messageContent.className += " loading";
    }
    messageContent.textContent = content;

    const timeDiv = document.createElement("div");
    timeDiv.className = "message-time";
    timeDiv.textContent = new Date().toLocaleTimeString();

    messageDiv.appendChild(messageContent);
    messageDiv.appendChild(timeDiv);

    chatMessages.appendChild(messageDiv);
    chatMessages.scrollTop = chatMessages.scrollHeight;

    return messageDiv;
  }

  /**
   * setupRecognitionHandlers()
   * Sets event handlers for webkitSpeechRecognition
   */
  function setupRecognitionHandlers(recognitionInstance) {
    let isRestarting = false;

    recognitionInstance.onresult = (event) => {
      interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      // Show partial + final transcripts
      transcriptContainer.innerHTML = "";

      const lastAIMessage = chatHistory.findLast(
        (msg) => msg.role === "assistant"
      );
      if (lastAIMessage) {
        const aiLine = document.createElement("div");
        aiLine.className = "transcript-line ai-response";
        aiLine.innerHTML = `<strong>AI:</strong> <span>${lastAIMessage.content}</span>`;
        transcriptContainer.appendChild(aiLine);
      }

      const userLine = document.createElement("div");
      userLine.className = "transcript-line";
      userLine.innerHTML = `<strong>User:</strong> <span>${finalTranscript}<span style="color: #666;">${interimTranscript}</span></span>`;
      transcriptContainer.appendChild(userLine);

      transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
    };

    recognitionInstance.onend = () => {
      console.log("[Recognition] ended. isListening:", isListening);
      // Auto-restart if we're still listening
      if (isListening && recognitionInstance && !isRestarting) {
        try {
          isRestarting = true;
          setTimeout(() => {
            if (isListening) {
              recognitionInstance.start();
              console.log("[Recognition] restarted");
            }
            isRestarting = false;
          }, 100);
        } catch (e) {
          console.error("[Recognition] restart error:", e);
          isRestarting = false;

          // If we still want to be listening, recreate the instance
          if (isListening) {
            recognition = new webkitSpeechRecognition();
            recognition.continuous = true;
            recognition.interimResults = true;
            setupRecognitionHandlers(recognition);
            try {
              recognition.start();
            } catch (err) {
              console.error("[Recognition] Error starting new instance:", err);
            }
          }
        }
      } else {
        console.log(
          "[Recognition] Not restarting. Either turned off or in process."
        );
      }
    };

    recognitionInstance.onerror = (event) => {
      console.error("[Recognition] error:", event.error);
      if (event.error === "no-speech") {
        console.log("[Recognition] No speech detected");
      }
    };
  }
});

/**************************************************************************
 * collectSiteContent()
 * Scrapes pages, posts, products from WP endpoints and includes link
 **************************************************************************/
async function collectSiteContent() {
  try {
    console.log("[collectSiteContent] Starting content collection...");

    // 1) Quick test
    const testEndpoint = "/wp-json/my-plugin/v1/test";
    const testResponse = await fetch(testEndpoint);
    const testResult = await testResponse.json();
    console.log("[collectSiteContent] Test result:", testResult);

    if (!testResult || testResult.status !== "ok") {
      throw new Error("REST API test failed");
    }

    // 2) Fetch pages
    const pagesRes = await fetch("/wp-json/my-plugin/v1/pages");
    if (!pagesRes.ok) {
      throw new Error(`Failed to fetch pages: ${pagesRes.status}`);
    }
    let pages = await pagesRes.json();
    console.log("[collectSiteContent] Pages (stripped):", pages);

    // 2A) For each page, fetch raw HTML & link
    for (const page of pages) {
      try {
        const singlePageRes = await fetch(`/wp-json/wp/v2/pages/${page.id}`);
        if (!singlePageRes.ok) {
          console.warn(`Could not fetch full content for page ${page.id}`);
          continue;
        }
        const singlePageData = await singlePageRes.json();

        // Strip HTML from content before storing
        page.fullContent = stripHtml(singlePageData.content?.rendered || "");
        page.title = stripHtml(page.title);
        page.url = singlePageData.link || "";
      } catch (e) {
        console.warn(`Error fetching single page ${page.id}:`, e);
      }
    }

    // 3) Fetch posts
    const postsRes = await fetch("/wp-json/my-plugin/v1/posts");
    if (!postsRes.ok) {
      throw new Error(`Failed to fetch posts: ${postsRes.status}`);
    }
    const posts = await postsRes.json();
    console.log("[collectSiteContent] Posts:", posts);

    // Clean posts data
    const cleanedPosts = posts.map((post) => {
      post.title = stripHtml(post.title);
      post.content = stripHtml(post.content);
      return post;
    });

    // 4) Fetch products
    const productsRes = await fetch("/wp-json/my-plugin/v1/products");
    if (!productsRes.ok) {
      throw new Error(`Failed to fetch products: ${productsRes.status}`);
    }
    const products = await productsRes.json();
    console.log("[collectSiteContent] Products:", products);

    // Clean products data
    const cleanedProducts = products.map((product) => {
      product.title = stripHtml(product.title);
      product.content = stripHtml(product.content);
      product.categories = product.categories.map((cat) => stripHtml(cat));
      return product;
    });

    // Return combined data
    return {
      pages,
      posts: cleanedPosts,
      products: cleanedProducts,
      timestamp: new Date().toISOString(),
    };
  } catch (error) {
    console.error("[collectSiteContent] Error:", error);
    return {
      pages: [],
      posts: [],
      products: [],
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}
