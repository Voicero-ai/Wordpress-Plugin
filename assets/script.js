
/**
 * Strip HTML and CSS from text
 */
function stripHtml(html) {
  const temp = document.createElement("div");
  temp.innerHTML = html;
  return temp.textContent || temp.innerText || "";
}

document.addEventListener("DOMContentLoaded", async () => {
  window.siteContent = await collectSiteContent();
  console.log("Site content loaded on page load:", window.siteContent);

  let recorder = null;
  let isListening = false;
  let audioContext = null;
  let analyser = null;
  let dataArray = null;
  let silenceTimer = null;
  let mediaRecorder = null;
  let interimTranscript = "";
  let recognition = null;
  let chatHistory = [];
  const MAX_HISTORY_LENGTH = 5;

  const SILENCE_THRESHOLD = 0.01;
  const SILENCE_DURATION = 2000;
  const MAX_EMPTY_ATTEMPTS = 3;
  let emptyTranscriptionCount = 0;

  let mediaStream = null;

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

  // ======================
  // 4) UI HANDLERS
  // ======================
  mainToggle.addEventListener("click", async () => {
    mainToggle.classList.toggle("active");
    if (mainToggle.classList.contains("active")) {
      interactionChooser.style.display = "block";
      voiceInterface.style.display = "none";
      textInterface.style.display = "none";
    } else {
      console.log("Turning off main toggle, cleaning up...");
      interactionChooser.style.display = "none";
      voiceInterface.style.display = "none";
      textInterface.style.display = "none";

      if (isListening) cleanupRecording(true);
      console.log("Main toggle cleanup complete");
    }
  });

  document
    .querySelector(".interaction-option.voice")
    .addEventListener("click", () => {
      voiceInterface.style.display = "block";
      textInterface.style.display = "none";
      interactionChooser.style.display = "none";
      mainToggle.classList.add("active");

      voiceInterface.classList.add("compact-interface");
    });

  document
    .querySelector(".interaction-option.text")
    .addEventListener("click", () => {
      textInterface.style.display = "block";
      voiceInterface.style.display = "none";
      interactionChooser.style.display = "none";

      voiceInterface.classList.remove("compact-interface");
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
    mainToggle.classList.remove("active");
    cleanupRecording(true);
  });

  document.getElementById("close-text").addEventListener("click", () => {
    textInterface.style.display = "none";
    mainToggle.classList.remove("active");
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

  if (closeButton) {
    closeButton.addEventListener("click", () => {
      popup.style.display = "none";
      if (voicePopupToggle) voicePopupToggle.classList.remove("active");
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
  // 5) RECORDING & TTS
  // ======================
  async function sendToGemini(text) {
    try {
      chatHistory.push({ role: "user", content: text });
      if (chatHistory.length > MAX_HISTORY_LENGTH * 2) {
        chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH * 2);
      }

      const pages = window.siteContent.pages || [];
      const posts = window.siteContent.posts || [];
      const products = window.siteContent.products || [];

      console.log("🔎 [sendToGemini] Using raw data:", {
        pages,
        posts,
        products,
      });

      const response = await fetch(
        "https://ai-website-server.vercel.app/gemini",
        {
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

            Pages:
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

            Posts:
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

            Products:
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
        parsed = { response: aiText, redirect_url: null };
      }

      const aiResponse = parsed.response;
      const aiRedirect = parsed.redirect_url;

      const aiResponseElement = document.querySelector(
        ".transcript-line.ai-response span"
      );
      if (aiResponseElement) {
        aiResponseElement.textContent = aiResponse;
      }

      await sendToTTS(aiResponse);

      if (typeof aiRedirect === "string" && aiRedirect.trim()) {
        console.log("➡️ [sendToGemini] Redirecting to:", aiRedirect);
        window.location.href = aiRedirect;
      } else {
        if (mainToggle.classList.contains("active")) {
          console.log("✅ [sendToGemini] TTS done. Restart mic...");
          micButton.classList.remove("listening");
          recordingWaves.classList.remove("active");

          await new Promise((resolve) => setTimeout(resolve, 100));
          try {
            await startRecording();
          } catch (error) {
            console.error("❌ [sendToGemini] Error restarting mic:", error);
            cleanupRecording();
          }
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
      isListening = false;

      if (recognition) {
        try {
          recognition.stop();
          await new Promise((resolve) => setTimeout(resolve, 50));
        } catch (e) {
          console.error("Error stopping old recognition:", e);
        }
        recognition = null;
      }

      if (audioContext) {
        await audioContext.close();
        await new Promise((resolve) => setTimeout(resolve, 50));
        audioContext = null;
      }

      if (recorder) {
        recorder.destroy();
        await new Promise((resolve) => setTimeout(resolve, 50));
        recorder = null;
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

      await new Promise((resolve) => setTimeout(resolve, 50));
      recorder.startRecording();
      console.log("🎤 [Recording] RecordRTC started");

      if ("webkitSpeechRecognition" in window) {
        recognition = new webkitSpeechRecognition();
        recognition.continuous = true;
        recognition.interimResults = true;
        setupRecognitionHandlers(recognition);
        isListening = true;

        await new Promise((resolve) => setTimeout(resolve, 50));
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

      const response = await fetch(
        "https://ai-website-server.vercel.app/speak",
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

  // ======================
  // 6) SILENCE DETECTION
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
  // 7) CLEANUP
  // ======================
  function cleanupRecording(clearHistory = false) {
    console.log("♻️ [Cleanup] Recording...", {
      clearHistory,
      isListening,
    });

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
  }

  // ======================
  // 8) TRANSCRIPT DISPLAY
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
  // 9) TEXT CHAT
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

      const loadingMessage = addMessageToChat("ai", "...");

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

      const response = await fetch(
        "https://ai-website-server.vercel.app/gemini",
        {
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
        }
      );

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

      if (aiRedirect && typeof aiRedirect === "string" && aiRedirect.trim()) {
        console.log("🗣️ [sendMessage] TTS before redirect...");
        await sendToTTS(aiResp);
        console.log("➡️ [sendMessage] Now redirecting to:", aiRedirect);
        window.location.href = aiRedirect;
      } else {
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

  function addMessageToChat(role, content) {
    const messageDiv = document.createElement("div");
    messageDiv.className = `message ${role}`;

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

      interimTranscript = "";
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
