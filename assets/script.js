/**
 * Strip HTML and CSS from text
 */
function stripHtml(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
}

document.addEventListener("DOMContentLoaded", async () => {
  // =======================================================
  // 0) LOCALSTORAGE UTILS + AI REDIRECT FLAG (KEY CHANGES)
  // =======================================================

  let chatHistory = [];
  let isAiRedirect = false; // <--- Global flag to track if navigation is AI-initiated

  function saveStateToLocalStorage() {
    const state = {
      chatHistory,
      lastActiveInterface:
        voiceInterface.style.display === "block"
          ? "voice"
          : textInterface.style.display === "block"
          ? "text"
          : null,
    };
    localStorage.setItem("aiAssistantState", JSON.stringify(state));
  }

  function loadStateFromLocalStorage() {
    const saved = localStorage.getItem("aiAssistantState");
    if (!saved) return;

    try {
      const state = JSON.parse(saved);

      // Check if this page load was from an AI redirect
      const urlParams = new URLSearchParams(window.location.search);
      const isAiRedirect = urlParams.get("ai_redirect") === "true";

      // Only restore chat history if it's an AI redirect
      if (isAiRedirect && Array.isArray(state.chatHistory)) {
        chatHistory = state.chatHistory;

        // Restore chat messages in text interface
        chatMessages.innerHTML = "";
        chatHistory.slice(-10).forEach((msg) => {
          // Show last 10 messages max
          addMessageToChat(
            msg.role === "assistant" ? "ai" : "user",
            msg.content
          );
        });
      } else {
        // Clear chat history on normal page load
        chatHistory = [];
        chatMessages.innerHTML = "";
      }

      // Restore interface state
      if (state.lastActiveInterface === "voice") {
        voiceInterface.style.display = "block";
        textInterface.style.display = "none";
        interactionChooser.style.display = "none";
        if (isAiRedirect) {
          try {
            setTimeout(async () => {
              await startRecording();
            }, 500);
          } catch (err) {
            console.error("Error restarting recording after redirect:", err);
          }
        }
      } else if (state.lastActiveInterface === "text") {
        textInterface.style.display = "block";
        voiceInterface.style.display = "none";
        interactionChooser.style.display = "none";
        // Scroll chat to bottom if we restored messages
        if (isAiRedirect) {
          chatMessages.scrollTop = chatMessages.scrollHeight;
        }
      }

      // Clean URL if it was an AI redirect
      if (isAiRedirect) {
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete("ai_redirect");
        window.history.replaceState({}, "", newUrl.toString());
      }
    } catch (err) {
      console.error("Failed to load AI assistant state:", err);
      // On error, clear everything
      chatHistory = [];
      chatMessages.innerHTML = "";
    }
  }

  // ======================
  // 1) GLOBAL VARIABLES
  // ======================
  window.siteContent = await collectSiteContent();
  console.log("Site content loaded on page load:", window.siteContent);

  let recorder = null;
  let isListening = false;
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let silenceTimer = null;
  let recognition = null;

  const MAX_HISTORY_LENGTH = 5;

  const SILENCE_THRESHOLD = 0.008;
  const SILENCE_DURATION = 1000;
  const MAX_EMPTY_ATTEMPTS = 3;
  let emptyTranscriptionCount = 0;

  let mediaStream = null;

  const mainToggle = document.getElementById("chat-website-button");
  const interactionChooser = document.getElementById("interaction-chooser");
  const voiceInterface = document.getElementById("voice-interface");
  const textInterface = document.getElementById("text-interface");
  const voicePopupToggle = document.querySelector("#voice-popup-toggle");
  const popup = document.getElementById("voice-popup");
  const micButton = document.getElementById("mic-button");
  const transcriptContainer = document.getElementById("transcript-container");
  const transcriptText = transcriptContainer.querySelector(".transcript-text");
  const recordingWaves = document.querySelector(".recording-waves");
  const aiSpeakingIndicator = document.querySelector(".ai-speaking-indicator");
  const chatInput = document.getElementById("chat-input");
  const sendButton = document.getElementById("send-message");
  const chatMessages = document.getElementById("chat-messages");

  // Add this at the top level with other global variables
  let currentTTSAudio = null; // Track current TTS audio playback

  // =========================================
  // 2) LOAD ANY PREVIOUS STATE FROM localStorage
  // =========================================
  loadStateFromLocalStorage();

  // ======================
  // 3) UI HANDLERS
  // ======================
  mainToggle.addEventListener("click", () => {
    // Show interaction chooser
    interactionChooser.style.display = "block";
    voiceInterface.style.display = "none";
    textInterface.style.display = "none";
  });

  document
    .querySelector(".interaction-option.voice")
    .addEventListener("click", () => {
      voiceInterface.style.display = "block";
      textInterface.style.display = "none";
      interactionChooser.style.display = "none";
      mainToggle.classList.add("active");

      voiceInterface.classList.add("compact-interface");

      // Save changes
      saveStateToLocalStorage();
    });

  document
    .querySelector(".interaction-option.text")
    .addEventListener("click", () => {
      textInterface.style.display = "block";
      voiceInterface.style.display = "none";
      interactionChooser.style.display = "none";

      voiceInterface.classList.remove("compact-interface");

      // Save changes
      saveStateToLocalStorage();
    });

  micButton.addEventListener("click", async () => {
    console.log("Mic button clicked, current state:", isListening);
    if (micButton.disabled) return;
    micButton.disabled = true;

    try {
      if (!isListening) {
        console.log("Starting new recording session");
        await startRecording();
      } else {
        console.log("Stopping active recording session");
        cleanupRecording(false);
      }
    } catch (error) {
      console.error("Error in mic button handler:", error);
      cleanupRecording();
    } finally {
      setTimeout(() => {
        micButton.disabled = false;
      }, 1000);
    }
  });

  document.getElementById("close-voice").addEventListener("click", () => {
    voiceInterface.style.display = "none";
    cleanupRecording(true);
    saveStateToLocalStorage();
  });

  document.getElementById("close-text").addEventListener("click", () => {
    textInterface.style.display = "none";
    saveStateToLocalStorage();
  });

  if (voicePopupToggle) {
    voicePopupToggle.addEventListener("click", () => {
      voicePopupToggle.classList.toggle("active");
      if (voicePopupToggle.classList.contains("active")) {
        popup.style.display = "flex";

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

  if (popup) {
    popup.addEventListener("click", (e) => {
      if (e.target === popup) {
        popup.style.display = "none";
        if (voicePopupToggle) voicePopupToggle.classList.remove("active");
      }
    });
  }

  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  sendButton.addEventListener("click", sendMessage);

  // ======================
  // 4) RECORDING & TTS
  // ======================
  async function sendToGemini(text) {
    try {
      chatHistory.push({ role: "user", content: text });
      if (chatHistory.length > MAX_HISTORY_LENGTH * 2) {
        chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH * 2);
      }
      // Save updated state
      saveStateToLocalStorage();

      const truncateContent = (str) => str?.substring(0, 300) || "";

      const pages = (window.siteContent.pages || []).map((p) => ({
        title: p.title,
        link: p.link,
        content: truncateContent(p.content),
      }));

      const posts = (window.siteContent.posts || []).map((p) => ({
        title: p.title,
        link: p.link,
        content: truncateContent(p.content),
      }));

      const products = (window.siteContent.products || []).map((p) => ({
        title: p.title,
        price: p.price,
        link: p.link,
        content: truncateContent(p.content),
        categories: p.categories,
      }));

      // Get only essential page sections data
      const { sections: pageSections, textIndex } = collectPageSections();
      const currentPageUrl = window.location.href;
      const currentPageTitle = document.title;

      // Limit chat history
      const limitedChatHistory = chatHistory.slice(-3); // Keep only last 3 messages

      const response = await fetch(
        "https://ai-website-server.vercel.app/gemini",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            context: `
            You are a friendly website guide who speaks naturally and informatively.
            Your personality: Helpful and warm - like a knowledgeable friend showing someone around.

            NAVIGATION PRIORITY:
            1. If user asks about specific pages/posts/products, ALWAYS provide redirect_url
            2. Only look for text on current page if no relevant pages/posts/products exist
            3. Use scroll_to_text only when staying on current page

            CURRENT PAGE:
            URL: ${currentPageUrl}
            TITLE: ${currentPageTitle}

            Available Content:

            Pages:
            ${pages
              .map(
                (p) => `
              PAGE: ${p.title}
              URL: ${p.link}
              PREVIEW: ${p.content}
              ---
            `
              )
              .join("\n")}

            Posts:
            ${posts
              .map(
                (p) => `
              POST: ${p.title}
              URL: ${p.link}
              PREVIEW: ${p.content}
              ---
            `
              )
              .join("\n")}

            Products:
            ${products
              .map(
                (p) => `
              PRODUCT: ${p.title}
              PRICE: ${p.price}
              URL: ${p.link}
              PREVIEW: ${p.content}
              ---
            `
              )
              .join("\n")}

            Recent conversation:
            ${limitedChatHistory
              .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
              .join("\n")}

            User's question: ${text}
          `,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `[Gemini] responded with ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();
      console.log("📥 [sendToGemini] Raw data from server:", data);

      const aiText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

      let parsed;
      try {
        const pattern = /```(?:json)?([\s\S]*?)```/g;
        const cleanJson = aiText.replace(pattern, "$1").trim();
        parsed = JSON.parse(cleanJson);
      } catch (parseErr) {
        console.warn(
          "Could not parse AI text as JSON. Falling back to plain text..."
        );
        parsed = { response: aiText, redirect_url: null, scroll_to_text: null };
      }

      const aiResponse = parsed.response;
      const aiRedirect = parsed.redirect_url;
      const aiScrollText = parsed.scroll_to_text;

      const aiResponseElement = document.querySelector(
        ".transcript-line.ai-response span"
      );
      if (aiResponseElement) {
        aiResponseElement.textContent = aiResponse;
      }

      await sendToTTS(aiResponse);

      // Update the redirect handling logic
      if (aiRedirect && typeof aiRedirect === "string" && aiRedirect.trim()) {
        console.log("➡️ [sendToGemini] Found redirect URL:", aiRedirect);
        // Always redirect if we have a URL, regardless of current page
        handleRedirect(aiRedirect);
      } else if (aiScrollText) {
        // Only try scrolling if we have no redirect
        scrollToText(aiScrollText);
      }
    } catch (error) {
      console.error("❌ [sendToGemini] Error:", error);
      cleanupRecording();
    }
  }

  /**
   * If the AI wants us to scroll to a particular part of the current page,
   * we'll look up that element by ID and scroll it into view.
   */
  function handleInPageScroll(scrollId) {
    if (!scrollId) return;
    const targetElement = document.getElementById(scrollId);
    if (targetElement) {
      // Perform the scroll
      targetElement.scrollIntoView({ behavior: "smooth", block: "start" });
      console.log(
        `🔎 [In-Page Scroll] Scrolled to element with ID: ${scrollId}`
      );
    } else {
      console.warn(`⚠️ [In-Page Scroll] No element found with ID: ${scrollId}`);
    }
  }

  function stopRecording() {
    console.log("🛑 [Recording] Stopping...", {
      recorder: !!recorder,
      isListening,
    });

    if (!recorder) {
      console.warn("stopRecording called but recorder does not exist.");
      return;
    }

    isListening = false;
    recorder.stopRecording(async () => {
      console.log("🛑 [Recording] Stopped, sending audio to server...");
      const audioBlob = recorder.getBlob();
      console.log("📦 [Recording] Audio blob size:", audioBlob.size);

      try {
        await sendAudioToServer(audioBlob);
      } catch (error) {
        console.error("Error sending audio to server:", error);
      }
    });

    if (recognition) {
      try {
        recognition.stop();
        console.log("🎤 [Recording] Recognition stopped");
      } catch (e) {
        console.error("[Recording] Error stopping recognition:", e);
      }
    }
  }

  async function startRecording() {
    console.log("🎤 [Recording] Starting...");
    try {
      isListening = false;

      // Ensure complete cleanup of previous recording session
      if (recognition) {
        try {
          recognition.stop();
          await new Promise((resolve) => setTimeout(resolve, 100));
        } catch (e) {
          console.error("Error stopping old recognition:", e);
        }
        recognition = null;
      }

      if (audioContext) {
        await audioContext.close();
        await new Promise((resolve) => setTimeout(resolve, 100));
        audioContext = null;
      }

      if (recorder) {
        recorder.destroy();
        await new Promise((resolve) => setTimeout(resolve, 100));
        recorder = null;
      }

      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => track.stop());
        mediaStream = null;
      }

      // Clear any existing timers
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }

      micButton.classList.add("listening");
      recordingWaves.classList.add("active");
      emptyTranscriptionCount = 0;

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStream = stream;

      recorder = new RecordRTC(stream, {
        type: "audio",
        mimeType: "audio/wav",
        recorderType: RecordRTC.StereoAudioRecorder,
        desiredSampRate: 16000,
        numberOfAudioChannels: 1,
      });

      await new Promise((resolve) => setTimeout(resolve, 100));
      recorder.startRecording();
      console.log("🎤 [Recording] RecordRTC started");

      if ("webkitSpeechRecognition" in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        setupRecognitionHandlers(recognition);
        isListening = true;

        await new Promise((resolve) => setTimeout(resolve, 100));
        await recognition.start();
        console.log("🎤 [Recording] Recognition started");

        setupSilenceDetection(stream);
      }
    } catch (error) {
      console.error("❌ [Recording] Error starting recording:", error);
      alert("Please allow microphone access.");
      cleanupRecording();
      throw error;
    }
  }

  async function sendAudioToServer(audioBlob) {
    const formData = new FormData();
    formData.append("audio", audioBlob, "speech.wav");

    console.log("📤 [Transcribe] Sending audio to /transcribe...");
    try {
      const response = await fetch(
        "https://ai-website-server.vercel.app/transcribe",
        {
          method: "POST",
          body: formData,
        }
      );
      const data = await response.json();
      console.log("📥 [Transcribe] Received:", data);

      if (!data.transcription || !data.transcription.trim()) {
        console.log("🔇 [Transcribe] Empty transcription");
        emptyTranscriptionCount++;
        if (emptyTranscriptionCount >= MAX_EMPTY_ATTEMPTS) {
          console.log("🛑 [Transcribe] Max empty attempts, stopping.");
          emptyTranscriptionCount = 0;
          cleanupRecording();
          return;
        }
        console.log("🔄 [Transcribe] Attempt again...");
        if (!isListening) {
          startRecording();
        }
        return;
      }

      emptyTranscriptionCount = 0;
      transcriptText.textContent = data.transcription;
      await sendToGemini(data.transcription);
    } catch (error) {
      console.error("❌ [Transcribe] Error:", error);
      cleanupRecording();
    }
  }

  async function sendToTTS(text) {
    console.log("📤 [TTS] Sending text to /speak:", text);
    try {
      micButton.disabled = true;
      micButton.style.opacity = "0.5";

      // Start fetching the audio as soon as possible
      const responsePromise = fetch(
        "https://ai-website-server.vercel.app/speak",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        }
      );

      // While waiting for the response, prepare the audio context
      if (!audioContext) {
        audioContext = new AudioContext();
      }

      const response = await responsePromise;
      const audioBlob = await response.blob();
      console.log("📥 [TTS] Received audio blob");

      const audioURL = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioURL);

      // Preload the audio
      audio.preload = "auto";

      // Store reference to current audio
      currentTTSAudio = audio;

      return new Promise((resolve, reject) => {
        // Start playing as soon as enough data is loaded
        audio.oncanplaythrough = () => {
          audio.play().catch(reject);
        };

        audio.onended = () => {
          console.log("🔊 [TTS] Playback ended");
          URL.revokeObjectURL(audioURL);
          micButton.disabled = false;
          micButton.style.opacity = "1";
          currentTTSAudio = null;
          resolve();
        };

        audio.onerror = (err) => {
          console.error("❌ [TTS] Playback error:", err);
          micButton.disabled = false;
          micButton.style.opacity = "1";
          currentTTSAudio = null;
          reject(err);
        };
      });
    } catch (error) {
      console.error("❌ [TTS] Error:", error);
      micButton.disabled = false;
      micButton.style.opacity = "1";
      currentTTSAudio = null;
      throw error;
    }
  }

  // ======================
  // 5) SILENCE DETECTION
  // ======================
  function setupSilenceDetection(stream) {
    console.log("🎤 [Silence] Setting up detection...");

    if (!isListening) return;

    if (audioContext) {
      audioContext.close();
      audioContext = null;
    }

    try {
      audioContext = new AudioContext();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);

      analyser.fftSize = 512;
      dataArray = new Uint8Array(analyser.fftSize);

      source.connect(analyser);

      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }

      console.log("🎤 [Silence] Starting detection loop");
      setTimeout(() => {
        if (isListening && recorder && recognition) {
          checkSilence();
        }
      }, 500);
    } catch (error) {
      console.error("❌ [Silence] Setup error:", error);
    }
  }

  function checkSilence() {
    if (
      !isListening ||
      !analyser ||
      !audioContext ||
      !recorder ||
      !recognition
    ) {
      console.log("🔇 [Silence] Detection stopped - missing state");
      return;
    }

    if (audioContext.state !== "running") {
      console.log("🔇 [Silence] Audio context not running");
      return;
    }

    analyser.getByteTimeDomainData(dataArray);
    let sum = 0;
    let silenceCount = 0;
    const samples = 3; // Check multiple samples before deciding

    // Take multiple samples to avoid false triggers
    for (let j = 0; j < samples; j++) {
      sum = 0;
      for (let i = 0; i < dataArray.length; i++) {
        const val = dataArray[i] - 128;
        sum += val * val;
      }
      const rms = Math.sqrt(sum / dataArray.length) / 128;

      if (rms < SILENCE_THRESHOLD) {
        silenceCount++;
      }

      // Small delay between samples
      if (j < samples - 1) {
        analyser.getByteTimeDomainData(dataArray);
      }
    }

    // Only trigger silence if majority of samples are silent
    if (silenceCount >= Math.ceil(samples * 0.7)) {
      if (!silenceTimer) {
        console.log("🔇 [Silence] Detected, starting timer...");
        silenceTimer = setTimeout(() => {
          if (isListening && recorder && recognition) {
            console.log("🔇 [Silence] Timer complete, stopping recording...");
            stopRecording();
          } else {
            console.log("🔇 [Silence] Timer ended - state changed");
          }
        }, SILENCE_DURATION);
      }
    } else {
      if (silenceTimer) {
        console.log("🔊 [Silence] Noise detected, resetting timer");
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    }

    if (
      isListening &&
      recorder &&
      recognition &&
      audioContext?.state === "running"
    ) {
      // Increase check frequency
      setTimeout(() => requestAnimationFrame(checkSilence), 50);
    } else {
      console.log("🔇 [Silence] Loop ended - state changed");
    }
  }

  // ======================
  // 6) CLEANUP
  // ======================
  function cleanupRecording(clearHistory = false) {
    console.log("♻️ [Cleanup] Recording...", {
      clearHistory,
      isListening,
    });

    // Stop any ongoing TTS playback
    if (currentTTSAudio) {
      currentTTSAudio.pause();
      currentTTSAudio.currentTime = 0;
      currentTTSAudio = null;
      micButton.disabled = false;
      micButton.style.opacity = "1";
    }

    isListening = false;

    micButton.classList.remove("listening");
    micButton.disabled = false;
    micButton.style.opacity = "1";
    recordingWaves.classList.remove("active");

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
        console.error("Error stopping recognition:", e);
      }
      recognition = null;
    }

    if (clearHistory) {
      if (transcriptText) transcriptText.textContent = "";
      const aiResponse = document.querySelector(
        ".transcript-line.ai-response span"
      );
      if (aiResponse) aiResponse.textContent = "";
      chatHistory = [];
      if (transcriptContainer) transcriptContainer.innerHTML = "";
    }

    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStream = null;
    }

    // After cleaning up, save the new state
    saveStateToLocalStorage();
  }

  // ======================
  // 7) TRANSCRIPT DISPLAY
  // ======================
  function updateTranscriptDisplay() {
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

  // ======================
  // 8) TEXT CHAT
  // ======================
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
      saveStateToLocalStorage();

      const truncateContent = (str) => str?.substring(0, 300) || "";

      const formattedPages = (window.siteContent.pages || []).map((p) => ({
        title: p.title,
        url: p.url || "",
        content: truncateContent(p.fullContent || p.content),
      }));

      const formattedPosts = (window.siteContent.posts || []).map((p) => ({
        title: p.title,
        content: truncateContent(p.content),
      }));

      const formattedProducts = (window.siteContent.products || []).map(
        (p) => ({
          title: p.title,
          price: p.price,
          description: truncateContent(p.content),
          categories: (p.categories || []).join(", "),
        })
      );

      const pageSections = collectPageSections();

      const response = await fetch(
        "https://ai-website-server.vercel.app/gemini",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            context: `
              You are a friendly website guide who speaks naturally and informatively.
              Your personality: Helpful and warm - like a knowledgeable friend showing someone around.

              NAVIGATION PRIORITY:
              1. If user asks about specific pages/posts/products, ALWAYS provide redirect_url
              2. Only look for text on current page if no relevant pages/posts/products exist
              3. Use scroll_to_text only when staying on current page

              Your goals are to:
              1. Give meaningful information first, then ask questions if needed
              2. Provide specific details about what users can find
              3. Guide users naturally to relevant pages or sections
              4. Sound human and conversational

              IMPORTANT GUIDELINES:
              - For navigation requests, ALWAYS check Pages/Posts/Products first
              - Only search current page text if no relevant navigation exists
              - Include 1-2 specific details about the topic being discussed
              - Keep responses focused but informative (2-4 sentences)
              - Use transitions like "Let me show you" when redirecting

              CURRENT PAGE:
              URL: ${window.location.href}
              TITLE: ${document.title}

              CURRENT PAGE SECTIONS:
              ${pageSections.sections
                .map(
                  (section) => `
                SECTION ID: ${section.id}
                TITLE: ${section.title}
                CONTENT: ${section.content}
                ---
              `
                )
                .join("\n")}

              TEXT INDEX (Use this to find relevant content):
              ${pageSections.textIndex
                .map(
                  (entry) => `
                TEXT: ${entry.text}
                SECTION_ID: ${entry.sectionId}
                KEYWORDS: ${entry.keywords.join(", ")}
                ---
              `
                )
                .join("\n")}

              Previous conversation:
              ${chatHistory
                .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
                .join("\n")}

              User's question/message: ${text}

              Pages:
              ${formattedPages
                .map(
                  (page) => `
                PAGE: ${page.title}
                URL: ${page.url}
                CONTENT: ${page.content}
                ---
              `
                )
                .join("\n")}

              Posts:
              ${formattedPosts
                .map(
                  (post) => `
                POST: ${post.title}
                CONTENT: ${post.content}
                ---
              `
                )
                .join("\n")}

              Products:
              ${formattedProducts
                .map(
                  (product) => `
                PRODUCT: ${product.title}
                PRICE: ${product.price}
                DESCRIPTION: ${product.description}
                ---
              `
                )
                .join("\n")}
            `,
          }),
        }
      );

      if (!response.ok) {
        throw new Error(`[Gemini] Error: ${response.status}`);
      }

      const data = await response.json();
      console.log("📥 [sendMessage] Gemini response:", data);

      let rawText = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";
      // Remove markdown code block if present
      rawText = rawText.replace(/```json\n|\n```/g, "").trim();
      console.log("Raw text from Gemini:", rawText);

      let parsed;
      let aiResp;
      try {
        if (rawText.trim().startsWith("{")) {
          parsed = JSON.parse(rawText);
          aiResp = parsed.response || rawText;
        } else {
          aiResp = rawText;
          parsed = {
            response: rawText,
            redirect_url: null,
            scroll_to_text: null,
          };
        }
      } catch (err) {
        console.warn(
          "[sendMessage] Parsing AI text as JSON failed. Fallback to plain text."
        );
        aiResp = rawText;
        parsed = {
          response: rawText,
          redirect_url: null,
          scroll_to_text: null,
        };
      }

      const aiRedirect = parsed.redirect_url;
      const aiScrollText = parsed.scroll_to_text;

      addMessageToChat("ai", aiResp);
      chatHistory.push({ role: "assistant", content: aiResp });
      saveStateToLocalStorage();

      if (aiRedirect && typeof aiRedirect === "string" && aiRedirect.trim()) {
        // Check if we're redirecting to the same page
        const currentUrlNoSearch =
          window.location.origin + window.location.pathname;
        const redirectUrlNoSearch =
          new URL(aiRedirect).origin + new URL(aiRedirect).pathname;

        if (currentUrlNoSearch === redirectUrlNoSearch) {
          // Same page - just do the scroll if we have an ID
          if (aiScrollText) {
            scrollToText(aiScrollText);
          }
        } else {
          // Different page - do the redirect
          console.log("➡️ [sendMessage] Now redirecting to:", aiRedirect);
          handleRedirect(aiRedirect);
        }
      } else if (aiScrollText) {
        // No redirect but we have a scroll ID
        scrollToText(aiScrollText);
      }

      if (voiceInterface.style.display === "block") {
        await sendToTTS(aiResp);
        // After TTS, restart recording if in voice mode
        if (mainToggle.classList.contains("active")) {
          console.log("✅ [sendMessage] TTS done. Restart mic...");
          await startRecording();
        }
      }

      chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
      console.error("❌ [sendMessage] Error:", error);
      const errorMessage = "Sorry, I encountered an error. Please try again.";
      addMessageToChat("ai", errorMessage);
      chatHistory.push({ role: "assistant", content: errorMessage });
      saveStateToLocalStorage();
    }
  }

  function addMessageToChat(role, content) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role === "assistant" ? "ai" : role}`;

    const messageContent = document.createElement("div");
    messageContent.className = "message-content";
    if (content === "...") {
      messageContent.classList.add("loading");
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

  function setupRecognitionHandlers(recognitionInstance) {
    let isRestarting = false;

    recognitionInstance.onresult = (event) => {
      if (!isListening) return;

      let interimTranscript = "";
      let finalTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; ++i) {
        if (event.results[i].isFinal) {
          finalTranscript += event.results[i][0].transcript;
        } else {
          interimTranscript += event.results[i][0].transcript;
        }
      }

      const userTranscriptElement = document.querySelector(
        ".transcript-line .transcript-text"
      );
      if (userTranscriptElement) {
        userTranscriptElement.textContent = finalTranscript + interimTranscript;
      }

      const aiResponseElement = document.querySelector(
        ".transcript-line.ai-response span"
      );
      if (aiResponseElement && !aiResponseElement.textContent) {
        aiResponseElement.textContent = "Listening...";
      }
    };

    recognitionInstance.onstart = () => {
      console.log("🎤 [Recognition] Started listening");
      if (isListening) {
        micButton.classList.add("listening");
        recordingWaves.classList.add("active");
      }
    };

    recognitionInstance.onend = () => {
      console.log("🎤 [Recognition] Ended.");
      if (
        isListening &&
        !isRestarting &&
        recorder &&
        audioContext?.state === "running"
      ) {
        try {
          isRestarting = true;
          setTimeout(() => {
            if (
              isListening &&
              recognition &&
              recorder &&
              audioContext?.state === "running"
            ) {
              recognition.start();
              console.log("🎤 [Recognition] Restarted");
            } else {
              console.log("🎤 [Recognition] Not restarting - state changed");
            }
            isRestarting = false;
          }, 100);
        } catch (e) {
          console.error("❌ [Recognition] Restart error:", e);
          isRestarting = false;
        }
      } else {
        console.log("🎤 [Recognition] Not restarting - conditions not met");
      }
    };

    recognitionInstance.onerror = (event) => {
      console.error("❌ [Recognition] Error:", event.error);
      if (
        ["not-allowed", "service-not-allowed", "audio-capture"].includes(
          event.error
        )
      ) {
        console.error("❌ [Recognition] Fatal permission error - cleaning up");
        cleanupRecording();
      } else {
        console.log("🎤 [Recognition] Non-fatal error - continuing");
      }
    };
  }

  // ======================
  // 9) REDIRECT HANDLING
  // ======================
  function handleRedirect(redirectUrl) {
    isAiRedirect = true; // We set this global flag before redirect
    const url = new URL(redirectUrl);
    url.searchParams.set("ai_redirect", "true");
    window.location.href = url.toString();
  }

  // ======================
  // 10) OPTIONAL PAGE UNLOAD LOGIC
  // ======================
  window.addEventListener("beforeunload", () => {
    // If you do NOT want to clear localStorage on normal exits,
    // either remove this or comment it out. If you keep it:
    // localStorage.removeItem("aiAssistantState") will occur on normal user exit.
    //
    // if (!isAiRedirect) {
    //   localStorage.removeItem("aiAssistantState");
    // }
  });
});

/**
 * collectSiteContent()
 */
async function collectSiteContent() {
  try {
    console.log("[collectSiteContent] Starting content collection...");
    const testEndpoint = "/wp-json/my-plugin/v1/test";
    const testResponse = await fetch(testEndpoint);
    const testResult = await testResponse.json();
    console.log("[collectSiteContent] Test result:", testResult);

    if (!testResult || testResult.status !== "ok") {
      throw new Error("REST API test failed");
    }

    const pagesRes = await fetch("/wp-json/my-plugin/v1/pages");
    if (!pagesRes.ok) {
      throw new Error(`Failed to fetch pages: ${pagesRes.status}`);
    }
    let pages = await pagesRes.json();

    for (const page of pages) {
      try {
        const singlePageRes = await fetch(`/wp-json/wp/v2/pages/${page.id}`);
        if (!singlePageRes.ok) {
          console.warn(`Could not fetch full content for page ${page.id}`);
          continue;
        }
        const singlePageData = await singlePageRes.json();
        page.fullContent = stripHtml(singlePageData.content?.rendered || "");
        page.title = stripHtml(page.title);
        page.url = singlePageData.link || "";
      } catch (e) {
        console.warn(`Error fetching single page ${page.id}:`, e);
      }
    }

    const postsRes = await fetch("/wp-json/my-plugin/v1/posts");
    if (!postsRes.ok) {
      throw new Error(`Failed to fetch posts: ${postsRes.status}`);
    }
    const posts = await postsRes.json();
    const cleanedPosts = posts.map((post) => {
      post.title = stripHtml(post.title);
      post.content = stripHtml(post.content);
      return post;
    });

    const productsRes = await fetch("/wp-json/my-plugin/v1/products");
    if (!productsRes.ok) {
      throw new Error(`Failed to fetch products: ${productsRes.status}`);
    }
    const products = await productsRes.json();
    const cleanedProducts = products.map((product) => {
      product.title = stripHtml(product.title);
      product.content = stripHtml(product.content);
      product.categories = product.categories.map((cat) => stripHtml(cat));
      return product;
    });

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

// Add this function near the top with other utility functions
function collectPageSections() {
  // Collect all sections with IDs and all text blocks
  const sections = [];
  const textNodes = [];

  // Helper function to get all text nodes under an element
  function getTextNodes(element, sectionId = null) {
    const walker = document.createTreeWalker(
      element,
      NodeFilter.SHOW_TEXT,
      null,
      false
    );

    let node;
    while ((node = walker.nextNode())) {
      const text = node.textContent.trim();
      if (text.length > 20) {
        // Only collect meaningful text blocks
        textNodes.push({
          text,
          sectionId,
          element: node.parentElement,
        });
      }
    }
  }

  // First collect all sections with IDs
  document
    .querySelectorAll("section[id], div[id], article[id], main[id]")
    .forEach((section) => {
      const id = section.id;
      const title =
        section.querySelector("h1,h2,h3,h4,h5,h6")?.textContent?.trim() || "";
      const content = section.textContent.trim().substring(0, 200);

      sections.push({
        id,
        title,
        content,
        element: section,
      });

      // Collect text nodes within this section
      getTextNodes(section, id);
    });

  // Also collect text nodes that aren't in any ID'd section
  getTextNodes(document.body);

  // Create a searchable index of text content
  const textIndex = textNodes.map((node) => ({
    text: node.text,
    sectionId: node.sectionId || findClosestSection(node.element, sections),
    keywords: node.text
      .toLowerCase()
      .split(/\W+/)
      .filter((word) => word.length > 3),
  }));

  console.log("📑 [Sections] Found sections:", sections);
  console.log("📝 [Sections] Text index:", textIndex);

  return {
    sections: sections.map(({ id, title, content }) => ({
      id,
      title,
      content,
    })),
    textIndex,
  };
}

// Helper function to find the closest section to an element
function findClosestSection(element, sections) {
  let current = element;
  while (current && current !== document.body) {
    // Check if any section contains this element
    const containingSection = sections.find((section) =>
      section.element.contains(current)
    );
    if (containingSection) {
      return containingSection.id;
    }
    current = current.parentElement;
  }
  return null;
}

// Add this function to handle text-based scrolling
function scrollToText(searchText) {
  if (!searchText) return;
  console.log("🔍 [ScrollToText] Searching for:", searchText);

  // Clean and escape the search text for regex
  const cleanSearchText = searchText
    .trim()
    .replace(/[.*+?^${}()|[\]\\]/g, "\\$&")
    // Allow for some flexibility in whitespace
    .replace(/\s+/g, "\\s+");

  console.log("🧹 [ScrollToText] Cleaned search text:", cleanSearchText);

  // First try exact match
  const exactFinder = new RegExp(cleanSearchText, "i");
  let found = findAndScrollToText(exactFinder);

  // If not found, try a more flexible match
  if (!found) {
    console.log(
      "↪️ [ScrollToText] Exact match not found, trying flexible match..."
    );
    // Split into words and create a looser pattern
    const words = searchText
      .trim()
      .split(/\s+/)
      .filter((word) => word.length > 3) // Only use significant words
      .map((word) => word.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"))
      .join(".*?"); // Allow any characters between words

    const flexibleFinder = new RegExp(words, "i");
    found = findAndScrollToText(flexibleFinder);
  }

  return found;
}

function findAndScrollToText(finder) {
  console.log("🔎 [FindAndScroll] Using regex:", finder);

  // Get all text nodes, including those in the chat interface
  const textNodes = [];
  const walker = document.createTreeWalker(
    document.body,
    NodeFilter.SHOW_TEXT,
    {
      acceptNode: function (node) {
        // Skip script and style tags
        if (
          node.parentElement.tagName === "SCRIPT" ||
          node.parentElement.tagName === "STYLE"
        ) {
          return NodeFilter.FILTER_REJECT;
        }

        // Skip chat messages
        let current = node.parentElement;
        while (current && current !== document.body) {
          if (
            current.classList.contains("message-content") || // Skip chat messages
            current.classList.contains("message") || // Skip entire message container
            current.id === "chat-messages" || // Skip chat container
            current.id === "text-interface" // Skip entire chat interface
          ) {
            return NodeFilter.FILTER_REJECT;
          }
          current = current.parentElement;
        }

        // Skip hidden elements
        if (isHidden(node.parentElement)) {
          return NodeFilter.FILTER_REJECT;
        }

        const matches = finder.test(node.textContent);
        if (matches) {
          console.log(
            "✅ [FindAndScroll] Found matching text:",
            node.textContent.trim()
          );
        }
        return matches ? NodeFilter.FILTER_ACCEPT : NodeFilter.FILTER_REJECT;
      },
    }
  );

  let node;
  while ((node = walker.nextNode())) {
    textNodes.push(node);
  }

  console.log("📝 [FindAndScroll] Found matching nodes:", textNodes.length);

  // If we found matching nodes
  if (textNodes.length > 0) {
    // Get the first visible match
    const element = textNodes[0].parentElement;
    console.log("🎯 [FindAndScroll] Target element:", element);

    // Make sure the element and its parents are visible
    let current = element;
    while (current && current !== document.body) {
      if (current.style.display === "none") {
        current.style.display = "block";
      }
      current = current.parentElement;
    }

    // Scroll into view with offset
    const offset = 100; // pixels from top
    const elementPosition = element.getBoundingClientRect().top;
    const offsetPosition = elementPosition + window.pageYOffset - offset;

    window.scrollTo({
      top: offsetPosition,
      behavior: "smooth",
    });

    // Highlight the element
    const originalBackground = element.style.backgroundColor;
    const originalTransition = element.style.transition;
    element.style.transition = "background-color 0.3s ease";
    element.style.backgroundColor = "#ffeb3b";
    element.style.animation = "pulse 2s";
    element.style.position = "relative";

    // Add CSS for pulse animation if it doesn't exist
    if (!document.getElementById("pulse-animation")) {
      const style = document.createElement("style");
      style.id = "pulse-animation";
      style.textContent = `
        @keyframes pulse {
          0% { transform: scale(1); }
          50% { transform: scale(1.02); }
          100% { transform: scale(1); }
        }
      `;
      document.head.appendChild(style);
    }

    // Reset after animation
    setTimeout(() => {
      element.style.backgroundColor = originalBackground;
      element.style.transition = originalTransition;
      element.style.animation = "";
    }, 2000);

    console.log("✨ [FindAndScroll] Scrolled and highlighted element");
    return true;
  }

  console.log("❌ [FindAndScroll] No matching text found");
  return false;
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
