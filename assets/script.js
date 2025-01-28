/**
 * Strip HTML and CSS from text
 */
function stripHtml(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
}

document.addEventListener("DOMContentLoaded", async () => {
  // ======================
  // 0) LOCALSTORAGE UTILS
  // ======================
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

      // Restore chat history
      if (Array.isArray(state.chatHistory)) {
        chatHistory = state.chatHistory;

        // Check if this page load was from an AI redirect
        const urlParams = new URLSearchParams(window.location.search);
        const isAiRedirect = urlParams.get("ai_redirect") === "true";

        if (isAiRedirect) {
          // Show the last active interface
          if (state.lastActiveInterface === "voice") {
            voiceInterface.style.display = "block";
            textInterface.style.display = "none";
            interactionChooser.style.display = "none";

            // Update the transcript display with last messages
            updateTranscriptDisplay();

            try {
              startRecording();
            } catch (err) {
              console.error("Error restarting recording after redirect:", err);
            }
          } else if (state.lastActiveInterface === "text") {
            textInterface.style.display = "block";
            voiceInterface.style.display = "none";
            interactionChooser.style.display = "none";

            // Restore chat messages in text interface
            chatMessages.innerHTML = "";
            chatHistory.forEach((msg) => {
              addMessageToChat(
                msg.role === "assistant" ? "ai" : "user",
                msg.content
              );
            });

            // Scroll chat to bottom
            chatMessages.scrollTop = chatMessages.scrollHeight;
          }

          // Clean URL
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete("ai_redirect");
          window.history.replaceState({}, "", newUrl.toString());
        } else {
          // Not an AI redirect, reset everything including localStorage
          localStorage.removeItem("aiAssistantState");
          interactionChooser.style.display = "none";
          voiceInterface.style.display = "none";
          textInterface.style.display = "none";
          cleanupRecording(false);
          chatHistory = [];
          chatMessages.innerHTML = "";
        }
      }
    } catch (err) {
      console.error("Failed to load AI assistant state:", err);
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
  let chatHistory = [];
  const MAX_HISTORY_LENGTH = 5;

  const SILENCE_THRESHOLD = 0.01;
  const SILENCE_DURATION = 2000;
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
      voiceInterface.dataset.forceStop = "false";
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
      // User message already saved at start
      chatHistory.push({ role: "user", content: text });
      if (chatHistory.length > MAX_HISTORY_LENGTH * 2) {
        chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH * 2);
      }
      saveStateToLocalStorage();

      const pages = window.siteContent.pages || [];
      const posts = window.siteContent.posts || [];
      const products = window.siteContent.products || [];

      // Get current page info
      const currentPageUrl = window.location.href;
      const currentPageTitle = document.title;

      console.log("🔎 [sendToGemini] Using raw data:", {
        pages,
        posts,
        products,
        currentPage: { url: currentPageUrl, title: currentPageTitle },
      });

      const response = await fetch(
        "https://ai-website-server-wordpress.vercel.app/gemini",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            context: `
              You are a friendly and helpful guide. Keep responses natural and conversational.
              Avoid phrases like "as an AI" or "as a website assistant".
              Just answer questions directly and warmly like a knowledgeable friend would.
              Always give the user an answer to their question even if its a subjective answer. 
              If you don't know the answer, say so.
              If you need to redirect the user to a different page, use the redirect_url field.
              If you need to scroll to a specific part of the page, use the scroll_to_text field.
              If you need to answer the question directly, use the response field.

              CURRENT PAGE:
              URL: ${currentPageUrl}
              TITLE: ${currentPageTitle}
              TEXT INDEX:
              ${document.body.innerText.replace(/[\n\r]+/g, " ").trim()}

              Available Content:
              ${pages
                .map(
                  (p) => `
                PAGE: ${p.title}
                URL: ${p.link}
                IS_HOME: ${p.is_home}
                PREVIEW: ${p.content}
                ---
              `
                )
                .join("\n")}

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
              ${chatHistory
                .slice(-3)
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
      console.log("Raw AI text:", aiText);

      let parsed;
      try {
        // First clean the text of any markdown and control characters
        let cleanText = aiText
          .replace(/```json\s*|\s*```/g, "") // Remove markdown
          .replace(/[\u0000-\u001F\u007F-\u009F]/g, "") // Remove control characters
          .trim();

        parsed = JSON.parse(cleanText);
        console.log("Successfully parsed JSON:", parsed);
      } catch (parseErr) {
        console.warn("Failed to parse AI response as JSON:", parseErr);
        // Create a basic response with the raw text
        parsed = {
          response: aiText.replace(/```[\s\S]*?```/g, "").trim(),
          redirect_url: null,
          scroll_to_text: null,
        };
      }

      // Validate the response isn't empty
      if (!parsed.response || !parsed.response.trim()) {
        throw new Error("Empty response from AI");
      }

      const aiResponse = parsed.response;
      const aiRedirect = parsed.redirect_url;
      const aiScrollText = parsed.scroll_to_text;

      // Save AI response to chat history
      chatHistory.push({ role: "assistant", content: aiResponse });
      saveStateToLocalStorage();

      // Show response to user
      const aiResponseElement = document.querySelector(
        ".transcript-line.ai-response span"
      );
      if (aiResponseElement) {
        aiResponseElement.textContent = aiResponse;
      }

      // Only send to TTS if we have actual text
      if (aiResponse.trim()) {
        await sendToTTS(aiResponse);
      }

      // Handle redirect or scroll
      if (aiRedirect && typeof aiRedirect === "string" && aiRedirect.trim()) {
        console.log("➡️ [sendToGemini] Found redirect URL:", aiRedirect);
        handleRedirect(aiRedirect);
      } else if (
        aiScrollText &&
        typeof aiScrollText === "string" &&
        aiScrollText.trim()
      ) {
        console.log("🔍 [sendToGemini] Found scroll text:", aiScrollText);
        const scrollSuccess = scrollToText(aiScrollText.trim());
        if (!scrollSuccess) {
          console.warn(
            "❌ [sendToGemini] Failed to find scroll text:",
            aiScrollText
          );
        }
      }
    } catch (error) {
      console.error("❌ [sendToGemini] Error:", error);
      cleanupRecording();
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
      // First check for browser support
      if (!("webkitSpeechRecognition" in window)) {
        throw new Error("Speech recognition not supported");
      }

      // Reset state
      isListening = false;

      // Clean up any existing recognition instance
      if (recognition) {
        try {
          recognition.stop();
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (e) {
          console.error("Error stopping old recognition:", e);
        }
        recognition = null;
      }

      // Clean up audio context
      if (audioContext) {
        await audioContext.close();
        await new Promise((resolve) => setTimeout(resolve, 50));
        audioContext = null;
      }

      // Clean up recorder
      if (recorder) {
        recorder.destroy();
        await new Promise((resolve) => setTimeout(resolve, 50));
        recorder = null;
      }

      // Request microphone permission and get stream
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStream = stream;

      // Set up new recorder
      recorder = new RecordRTC(stream, {
        type: "audio",
        mimeType: "audio/wav",
        recorderType: RecordRTC.StereoAudioRecorder,
        desiredSampRate: 16000,
        numberOfAudioChannels: 1,
      });

      // Start recording
      await new Promise((resolve) => setTimeout(resolve, 50));
      recorder.startRecording();
      console.log("🎤 [Recording] RecordRTC started");

      // Set up new recognition instance
      recognition = new webkitSpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      setupRecognitionHandlers(recognition);

      // Update UI
      micButton.classList.add("listening");
      recordingWaves.classList.add("active");
      emptyTranscriptionCount = 0;
      isListening = true;

      // Start recognition
      await new Promise((resolve) => setTimeout(resolve, 50));
      await recognition.start();
      console.log("🎤 [Recording] Recognition started");

      // Set up silence detection
      setupSilenceDetection(stream);
    } catch (error) {
      console.error("❌ [Recording] Error starting recording:", error);
      if (error.name === "NotAllowedError") {
        alert("Please allow microphone access to use voice features.");
      } else {
        alert("Error starting voice recording. Please try again.");
      }
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
        "https://ai-website-server-wordpress.vercel.app/transcribe",
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
      // Don't start TTS if we're force stopped
      if (voiceInterface.dataset.forceStop === "true") {
        console.log("🛑 [TTS] Force stop detected - not starting TTS");
        return;
      }

      micButton.disabled = true;
      micButton.style.opacity = "0.5";

      const response = await fetch(
        "https://ai-website-server-wordpress.vercel.app/speak",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ text }),
        }
      );

      const audioBlob = await response.blob();
      console.log("📥 [TTS] Received audio blob");
      const audioURL = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioURL);
      audio.preload = "auto";
      currentTTSAudio = audio;

      return new Promise((resolve, reject) => {
        audio.oncanplaythrough = () => {
          // Check force stop again before playing
          if (voiceInterface.dataset.forceStop === "true") {
            console.log("🛑 [TTS] Force stop detected - not playing audio");
            URL.revokeObjectURL(audioURL);
            currentTTSAudio = null;
            resolve();
            return;
          }
          audio.play().catch(reject);
        };

        audio.onended = async () => {
          console.log("🔊 [TTS] Playback ended");
          URL.revokeObjectURL(audioURL);
          micButton.disabled = false;
          micButton.style.opacity = "1";
          currentTTSAudio = null;

          // Only restart recording if not force stopped
          if (
            voiceInterface.style.display === "block" &&
            !isListening &&
            voiceInterface.dataset.forceStop !== "true"
          ) {
            console.log("🎤 [TTS] Restarting recording after playback");
            try {
              await startRecording();
            } catch (err) {
              console.error("Error restarting recording:", err);
            }
          }

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
    for (let i = 0; i < dataArray.length; i++) {
      const val = dataArray[i] - 128;
      sum += val * val;
    }
    const rms = Math.sqrt(sum / dataArray.length) / 128;

    if (rms < SILENCE_THRESHOLD) {
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
      requestAnimationFrame(checkSilence);
    } else {
      console.log("🔇 [Silence] Loop ended - state changed");
    }
  }

  // ======================
  // 6) CLEANUP
  // ======================
  let currentTTSAudio = null; // Track current TTS audio playback

  function cleanupRecording(clearHistory = false) {
    console.log("♻️ [Cleanup] Recording...", {
      clearHistory,
      isListening,
    });

    // Force stop all recording/listening
    isListening = false;
    voiceInterface.dataset.forceStop = "true"; // Add this flag to prevent restarts

    // Stop any playing TTS audio
    if (currentTTSAudio) {
      currentTTSAudio.pause();
      currentTTSAudio.currentTime = 0;
      currentTTSAudio = null;
    }

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

    // After cleaning up, save the new state (which might be "off" or cleared)
    saveStateToLocalStorage();
  }

  // ======================
  // 7) TRANSCRIPT DISPLAY
  // ======================
  function updateTranscriptDisplay() {
    if (!transcriptContainer) return;

    transcriptContainer.innerHTML = "";

    // Only show the most recent user-AI message pair
    const lastUserMessage = chatHistory.findLast((msg) => msg.role === "user");
    const lastAIMessage = chatHistory.findLast(
      (msg) => msg.role === "assistant"
    );

    if (lastUserMessage) {
      const userLine = document.createElement("div");
      userLine.className = "transcript-line";
      userLine.innerHTML = `
        <strong>User:</strong> 
        <span>${lastUserMessage.content}</span>
      `;
      transcriptContainer.appendChild(userLine);
    }

    if (lastAIMessage) {
      const aiLine = document.createElement("div");
      aiLine.className = "transcript-line ai-response";
      aiLine.innerHTML = `
        <strong>AI:</strong> 
        <span>${lastAIMessage.content}</span>
      `;
      transcriptContainer.appendChild(aiLine);
    }

    // Scroll to bottom
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

      const loadingMessage = addMessageToChat("ai", "...");

      const currentPageUrl = window.location.href;
      const currentPageTitle = document.title;

      const pages = window.siteContent.pages || [];
      const posts = window.siteContent.posts || [];
      const products = window.siteContent.products || [];

      const response = await fetch(
        "https://ai-website-server-wordpress.vercel.app/gemini",
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            query: text,
            context: `
              You are a friendly and helpful guide. Keep responses natural and conversational.
              Avoid phrases like "as an AI" or "as a website assistant".
              Just answer questions directly and warmly like a knowledgeable friend would.
              Always give the user an answer to their question even if its a subjective answer. 
              If you don't know the answer, say so.

              CURRENT PAGE:
              URL: ${currentPageUrl}
              TITLE: ${currentPageTitle}
              TEXT INDEX:
              ${document.body.innerText.replace(/[\n\r]+/g, " ").trim()}

              Available Content:
              ${pages
                .map(
                  (p) => `
                PAGE: ${p.title}
                URL: ${p.link}
                IS_HOME: ${p.is_home}
                PREVIEW: ${p.content}
                ---
              `
                )
                .join("\n")}

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
              ${chatHistory
                .slice(-3)
                .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
                .join("\n")}

              User's question: ${text}
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
      loadingMessage.remove();

      let parsed;
      let aiResp;
      try {
        // If rawText is JSON, parse it
        if (rawText.trim().startsWith("{")) {
          parsed = JSON.parse(rawText);
          aiResp = parsed.response || rawText;
          console.log("Parsed JSON response:", aiResp);
        } else {
          // If rawText is plain text, use directly
          aiResp = rawText;
          console.log("Using raw text:", aiResp);
        }
      } catch (err) {
        console.warn(
          "[sendMessage] Parsing AI text as JSON failed. Fallback to plain text."
        );
        aiResp = rawText;
      }

      const aiRedirect = parsed?.redirect_url || null;
      const aiScrollText = parsed?.scroll_to_text || null;

      addMessageToChat("ai", aiResp);
      chatHistory.push({ role: "assistant", content: aiResp });
      saveStateToLocalStorage();

      // Handle redirect or scroll
      if (aiRedirect && typeof aiRedirect === "string" && aiRedirect.trim()) {
        console.log("➡️ [sendMessage] Now redirecting to:", aiRedirect);
        handleRedirect(aiRedirect);
      } else if (
        aiScrollText &&
        typeof aiScrollText === "string" &&
        aiScrollText.trim()
      ) {
        console.log("🔍 [sendMessage] Scrolling to text:", aiScrollText);
        const scrollSuccess = scrollToText(aiScrollText.trim());
        if (!scrollSuccess) {
          console.warn(
            "❌ [sendMessage] Failed to find scroll text:",
            aiScrollText
          );
        }
      }

      if (voiceInterface.style.display === "block") {
        await sendToTTS(aiResp);
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
    // Add check for browser support
    if (!("webkitSpeechRecognition" in window)) {
      console.error("Speech recognition not supported in this browser");
      alert(
        "Speech recognition is not supported in your browser. Please use Chrome."
      );
      return;
    }

    recognitionInstance.onstart = () => {
      console.log("🎤 [Recognition] Started");
      isListening = true;
      micButton.classList.add("listening");
      recordingWaves.classList.add("active");

      // Only create user line if transcript is empty
      if (!transcriptContainer.querySelector(".transcript-line")) {
        const userLine = document.createElement("div");
        userLine.className = "transcript-line";
        userLine.innerHTML = `<strong>User:</strong> <span></span>`;
        transcriptContainer.appendChild(userLine);
      }
    };

    recognitionInstance.onresult = (event) => {
      if (!isListening) return;

      const transcript = Array.from(event.results)
        .map((result) => result[0].transcript)
        .join(" ");

      console.log("🎤 [Recognition] Interim result:", transcript);

      // Update the user transcript line
      const userLine = transcriptContainer.querySelector(
        ".transcript-line span"
      );
      if (userLine) {
        userLine.textContent = transcript;
      }
    };

    recognitionInstance.onend = async () => {
      console.log("🎤 [Recognition] Ended.");

      // Check for force stop flag
      if (voiceInterface.dataset.forceStop === "true") {
        console.log("🛑 [Recognition] Force stop detected - not restarting");
        isListening = false;
        return;
      }

      // Only restart if we're in voice mode and actively listening
      if (
        voiceInterface.style.display === "block" &&
        isListening &&
        !currentTTSAudio
      ) {
        console.log("🎤 [Recognition] Restarting...");
        try {
          await new Promise((resolve) => setTimeout(resolve, 100));
          await recognitionInstance.start();
        } catch (err) {
          console.error("Error restarting recognition:", err);
          isListening = false;
        }
      } else {
        console.log("🎤 [Recognition] Not restarting - conditions not met");
        isListening = false;
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

  // Add this near the top of the DOMContentLoaded event listener
  let isAiRedirect = false; // Flag to track if navigation is AI-initiated

  // Update the redirect logic in both sendToGemini and sendMessage
  function handleRedirect(redirectUrl) {
    try {
      // Get all valid URLs from our data
      const validUrls = [
        ...(window.siteContent.pages || []).map((p) => p.link),
        ...(window.siteContent.posts || []).map((p) => p.link),
        ...(window.siteContent.products || []).map((p) => p.link),
      ];

      // Check if the redirect URL exists in our data
      if (!validUrls.includes(redirectUrl)) {
        console.warn(
          "❌ [handleRedirect] Invalid URL - not found in site data:",
          redirectUrl
        );
        console.log("Valid URLs are:", validUrls);
        return;
      }

      isAiRedirect = true;
      const url = new URL(redirectUrl, window.location.origin);
      url.searchParams.set("ai_redirect", "true");
      console.log(
        "🔄 [handleRedirect] Redirecting to validated URL:",
        url.toString()
      );
      window.location.href = url.toString();
    } catch (error) {
      console.error("❌ [handleRedirect] Invalid URL:", redirectUrl);
    }
  }

  // Add event listener for page unload
  window.addEventListener("beforeunload", () => {
    // Only clear if it's not an AI redirect
    if (!isAiRedirect) {
      localStorage.removeItem("aiAssistantState");
    }
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
