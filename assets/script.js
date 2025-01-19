document.addEventListener("DOMContentLoaded", async () => {
  // 1) Collect site content (pages + posts) on page load
  window.siteContent = await collectSiteContent();
  console.log("Site content loaded on page load:", window.siteContent);

  // 2) GLOBALS
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
  const MAX_HISTORY_LENGTH = 5; // Keep last 5 exchanges

  // Silence detection constants
  const SILENCE_THRESHOLD = 0.01;
  const SILENCE_DURATION = 2000; // Increased to 2 seconds
  const MAX_EMPTY_ATTEMPTS = 3;
  let emptyTranscriptionCount = 0;

  // Add this variable with other globals
  let mediaStream = null;

  // 3) DOM ELEMENTS
  const mainToggle = document.querySelector("#main-voice-toggle");
  const interactionChooser = document.getElementById("interaction-chooser");
  const voiceInterface = document.getElementById("voice-interface");
  const textInterface = document.getElementById("text-interface");
  const devToggle = document.querySelector("#dev-toggle .toggle");
  const devPanel = document.getElementById("dev-panel");
  const voicePopupToggle = document.querySelector("#voice-popup-toggle");
  const popup = document.getElementById("voice-popup");
  const closeButton = document.getElementById("close-popup");
  const micButton = document.getElementById("mic-button");
  const transcriptContainer = document.getElementById("transcript-container");
  const transcriptText = transcriptContainer.querySelector(".transcript-text");
  const recordingWaves = document.querySelector(".recording-waves");
  const aiSpeakingIndicator = document.querySelector(".ai-speaking-indicator");

  // Text chat input handler
  const chatInput = document.getElementById("chat-input");
  const sendButton = document.getElementById("send-message");
  const chatMessages = document.getElementById("chat-messages");

  /* ----------------------------------------------------------------
      UI HANDLERS
  ---------------------------------------------------------------- */
  // Main AI toggle click
  mainToggle.addEventListener("click", () => {
    mainToggle.classList.toggle("active");
    if (mainToggle.classList.contains("active")) {
      interactionChooser.style.display = "block";
      voiceInterface.style.display = "none";
      textInterface.style.display = "none";
    } else {
      // When turning off the main toggle, clean up everything
      interactionChooser.style.display = "none";
      voiceInterface.style.display = "none";
      textInterface.style.display = "none";

      // Stop all recording and clean up
      if (isListening) {
        cleanupRecording(true);
        if (recorder) {
          recorder.stopRecording(() => {
            recorder.destroy();
            recorder = null;
          });
        }
        if (recognition) {
          recognition.stop();
          recognition = null;
        }
        if (audioContext) {
          audioContext.close();
          audioContext = null;
        }
      }

      // Stop and release media stream
      if (mediaStream) {
        mediaStream.getTracks().forEach((track) => {
          track.stop();
        });
        mediaStream = null;
      }

      // Reset all states
      isListening = false;
      micButton.classList.remove("listening");
      micButton.disabled = false;
      micButton.style.opacity = "1";
    }
  });

  // Choose voice
  document
    .querySelector(".interaction-option.voice")
    .addEventListener("click", () => {
      voiceInterface.style.display = "block";
      textInterface.style.display = "none";
      interactionChooser.style.display = "none";
      mainToggle.classList.add("active");
    });

  // Choose text
  document
    .querySelector(".interaction-option.text")
    .addEventListener("click", () => {
      textInterface.style.display = "block";
      voiceInterface.style.display = "none";
      interactionChooser.style.display = "none";
    });

  // Microphone button
  micButton.addEventListener("click", () => {
    console.log("Mic button clicked, current state:", isListening);
    if (!isListening) {
      startRecording();
    } else {
      // Stop recording but preserve history
      isListening = false;
      if (recorder) {
        recorder.stopRecording(() => {
          console.log("Recording stopped by user");
          recorder.destroy();
          recorder = null;
        });
      }
      if (recognition) {
        recognition.stop();
        recognition = null;
      }
      if (audioContext) {
        audioContext.close();
        audioContext = null;
      }
      micButton.classList.remove("listening");
    }
  });

  // Close voice interface
  document.getElementById("close-voice").addEventListener("click", () => {
    voiceInterface.style.display = "none";
    mainToggle.classList.remove("active");
    cleanupRecording(true);
  });

  // Close text interface
  document.getElementById("close-text").addEventListener("click", () => {
    textInterface.style.display = "none";
    mainToggle.classList.remove("active");
  });

  // Dev panel toggle
  devToggle.addEventListener("click", () => {
    devToggle.classList.toggle("active");
    const isActive = devToggle.classList.contains("active");
    devPanel.style.display = isActive ? "block" : "none";

    // Show siteContent in Dev Panel JSON
    if (isActive) {
      const jsonContainer = document.getElementById("json-container");
      const dataToShow = window.siteContent || {};
      jsonContainer.innerHTML = `<pre>${JSON.stringify(
        dataToShow,
        null,
        2
      )}</pre>`;
    }
  });

  // Close dev panel
  document.getElementById("close-dev").addEventListener("click", () => {
    devPanel.style.display = "none";
    devToggle.classList.remove("active");
  });

  // Popup toggle (if used)
  if (voicePopupToggle) {
    voicePopupToggle.addEventListener("click", () => {
      voicePopupToggle.classList.toggle("active");
      if (voicePopupToggle.classList.contains("active")) {
        popup.style.display = "flex";

        // Display site content in popup
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

  // Close popup by clicking outside
  if (popup) {
    popup.addEventListener("click", (e) => {
      if (e.target === popup) {
        popup.style.display = "none";
        if (voicePopupToggle) voicePopupToggle.classList.remove("active");
        cleanupRecording();
      }
    });
  }

  // Close popup with X
  if (closeButton) {
    closeButton.addEventListener("click", () => {
      popup.style.display = "none";
      if (voicePopupToggle) voicePopupToggle.classList.remove("active");
      cleanupRecording();
    });
  }

  // Send on Enter key
  chatInput.addEventListener("keypress", (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  });

  // Send on button click
  sendButton.addEventListener("click", sendMessage);

  /* ----------------------------------------------------------------
      RECORDING & TTS FUNCTIONS
  ---------------------------------------------------------------- */
  async function sendToGemini(text) {
    try {
      // Add current user message to history
      chatHistory.push({ role: "user", content: text });

      // Keep history at max length
      if (chatHistory.length > MAX_HISTORY_LENGTH * 2) {
        // *2 because each exchange has 2 messages
        chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH * 2);
      }

      const formattedPages = (window.siteContent.pages || []).map((p) => ({
        title: p.title,
        // Possibly use the 'fullContent' HTML or just the stripped content
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
          categories: p.categories.join(", "),
        })
      );

      console.log("Sending to Gemini with pages:", formattedPages);
      console.log("Sending to Gemini with posts:", formattedPosts);
      console.log("Sending to Gemini with products:", formattedProducts);

      const response = await fetch("http://localhost:5001/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          context: `You are a friendly voice assistant helping someone navigate this website. 
            Keep responses brief and conversational.

            Previous conversation:
            ${chatHistory
              .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
              .join("\n")}

            Here are the pages on this website:
            ${formattedPages
              .map(
                (page) => `
                  PAGE: ${page.title}
                  CONTENT: ${page.content}
                  ---
                `
              )
              .join("\n")}
            Here are the blog posts on this website:
            ${formattedPosts
              .map(
                (post) => `
                  POST: ${post.title}
                  CONTENT: ${post.content}
                  ---
                `
              )
              .join("\n")}
            Here are the products available:
            ${formattedProducts
              .map(
                (product) => `
                  PRODUCT: ${product.title}
                  PRICE: ${product.price}
                  CATEGORIES: ${product.categories}
                  DESCRIPTION: ${product.description}
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
          `Gemini responded with ${response.status}: ${errorText}`
        );
      }

      const data = await response.json();
      const aiResponse = data.candidates[0].content.parts[0].text;

      // Update transcript
      let aiLine = document.querySelector(".transcript-line.ai-response");
      if (!aiLine) {
        aiLine = document.createElement("div");
        aiLine.className = "transcript-line ai-response";
        transcriptContainer.appendChild(aiLine);
      }
      aiLine.innerHTML = `<strong>AI:</strong> <span>${aiResponse}</span>`;

      // Add AI's response to history
      chatHistory.push({ role: "assistant", content: aiResponse });

      // Update transcript with full history
      updateTranscriptDisplay();

      // Send to TTS and wait for it to finish
      await sendToTTS(aiResponse);

      // Auto-restart listening after AI finishes speaking
      console.log("AI finished speaking, auto-restarting listening...");
      startRecording();
    } catch (error) {
      console.error("Error calling Gemini API:", error);
      cleanupRecording();
    }
  }

  // Start recording
  function startRecording() {
    console.log("Starting recording...");

    // Reset empty transcription counter on new recording session
    if (!isListening) {
      emptyTranscriptionCount = 0;
    }

    if (recorder) {
      recorder.destroy();
      recorder = null;
    }

    navigator.mediaDevices
      .getUserMedia({ audio: true })
      .then((stream) => {
        console.log("Got media stream");
        mediaStream = stream; // Store the stream reference

        // Initialize RecordRTC as before
        recorder = new RecordRTC(stream, {
          type: "audio",
          mimeType: "audio/wav",
          recorderType: RecordRTC.StereoAudioRecorder,
          desiredSampRate: 16000,
          numberOfAudioChannels: 1,
        });

        // Initialize real-time transcription
        if ("webkitSpeechRecognition" in window) {
          // Stop existing recognition if any
          if (recognition) {
            recognition.stop();
          }

          recognition = new webkitSpeechRecognition();
          recognition.continuous = true;
          recognition.interimResults = true;

          recognition.onresult = (event) => {
            interimTranscript = "";
            let finalTranscript = "";

            for (let i = event.resultIndex; i < event.results.length; ++i) {
              if (event.results[i].isFinal) {
                finalTranscript += event.results[i][0].transcript;
              } else {
                interimTranscript += event.results[i][0].transcript;
              }
            }

            // Show real-time transcription in a user message style
            transcriptContainer.innerHTML = "";

            // Show last AI message if it exists
            const lastAIMessage = chatHistory.findLast(
              (msg) => msg.role === "assistant"
            );
            if (lastAIMessage) {
              const aiLine = document.createElement("div");
              aiLine.className = "transcript-line ai-response";
              aiLine.innerHTML = `<strong>AI:</strong> <span>${lastAIMessage.content}</span>`;
              transcriptContainer.appendChild(aiLine);
            }

            // Show current user message
            const userLine = document.createElement("div");
            userLine.className = "transcript-line";
            userLine.innerHTML = `<strong>User:</strong> <span>${finalTranscript}<span style="color: #666;">${interimTranscript}</span></span>`;
            transcriptContainer.appendChild(userLine);

            // Scroll to bottom
            transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
          };

          recognition.onend = () => {
            console.log("Recognition ended, isListening:", isListening);
            if (isListening && recognition) {
              recognition.start();
            }
          };

          recognition.onerror = (event) => {
            console.error("Recognition error:", event.error);
          };

          try {
            recognition.start();
            console.log("Recognition started");
          } catch (e) {
            console.error("Error starting recognition:", e);
          }
        }

        recorder.startRecording();
        isListening = true;

        micButton.classList.add("listening");
        recordingWaves.classList.add("active");

        setupSilenceDetection(stream);
        console.log("Recording started");
      })
      .catch((error) => {
        console.error("Microphone error:", error);
        alert("Please allow microphone access.");
        isListening = false;
        micButton.classList.remove("listening");
        recordingWaves.classList.remove("active");
      });
  }

  // Stop recording
  function stopRecording() {
    console.log("Stopping recording...");
    if (!recorder || !isListening) return;

    isListening = false;

    // Stop recognition
    if (recognition) {
      try {
        recognition.stop();
      } catch (e) {
        console.error("Error stopping recognition:", e);
      }
      recognition = null;
    }

    recorder.stopRecording(() => {
      console.log("Recording stopped, sending audio...");
      const audioBlob = recorder.getBlob();
      sendAudioToServer(audioBlob);

      // Clean up after sending
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

  // Send audio to local AI server
  async function sendAudioToServer(audioBlob) {
    const formData = new FormData();
    formData.append("audio", audioBlob, "speech.wav");

    try {
      const response = await fetch("http://localhost:5001/transcribe", {
        method: "POST",
        body: formData,
      });
      const data = await response.json();
      console.log("Transcription:", data.transcription);

      // Check if transcription is empty or just whitespace
      if (!data.transcription || !data.transcription.trim()) {
        console.log("Empty transcription detected");
        emptyTranscriptionCount++;

        if (emptyTranscriptionCount >= MAX_EMPTY_ATTEMPTS) {
          console.log(
            `${MAX_EMPTY_ATTEMPTS} empty transcriptions in a row, stopping...`
          );
          emptyTranscriptionCount = 0;
          cleanupRecording();
          return;
        }

        // Restart recording without cleanup
        console.log(
          `Empty transcription ${emptyTranscriptionCount}/${MAX_EMPTY_ATTEMPTS}, continuing...`
        );
        if (!isListening) {
          startRecording();
        }
        return;
      }

      // Reset counter on successful transcription
      emptyTranscriptionCount = 0;
      transcriptText.textContent = data.transcription;
      sendToGemini(data.transcription);
    } catch (error) {
      console.error("Error sending audio:", error);
      cleanupRecording();
    }
  }

  // Text-to-speech
  async function sendToTTS(text) {
    try {
      // Disable mic while AI is speaking
      micButton.disabled = true;
      micButton.style.opacity = "0.5";

      const response = await fetch("http://localhost:5001/speak", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text }),
      });

      const audioBlob = await response.blob();
      const audioURL = URL.createObjectURL(audioBlob);
      const audio = new Audio(audioURL);

      // Return a promise that resolves when audio finishes playing
      return new Promise((resolve, reject) => {
        audio.onended = () => {
          URL.revokeObjectURL(audioURL);
          // Re-enable mic after AI finishes speaking
          micButton.disabled = false;
          micButton.style.opacity = "1";
          // Auto-restart recording
          startRecording();
          resolve();
        };

        audio.onerror = (err) => {
          console.error("Audio playback error:", err);
          // Re-enable mic on error
          micButton.disabled = false;
          micButton.style.opacity = "1";
          reject(err);
        };

        audio.play().catch(reject);
      });
    } catch (error) {
      console.error("Error in TTS:", error);
      // Re-enable mic on error
      micButton.disabled = false;
      micButton.style.opacity = "1";
      throw error;
    }
  }

  /* ----------------------------------------------------------------
      SILENCE DETECTION
  ---------------------------------------------------------------- */
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
      if (!silenceTimer) {
        silenceTimer = setTimeout(() => {
          console.log("Silence detected for 1s, stopping recording...");
          stopRecording();
        }, SILENCE_DURATION);
      }
    } else {
      if (silenceTimer) {
        clearTimeout(silenceTimer);
        silenceTimer = null;
      }
    }

    requestAnimationFrame(checkSilence);
  }

  /* ----------------------------------------------------------------
      CLEANUP
  ---------------------------------------------------------------- */
  function cleanupRecording(clearHistory = false) {
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

    isListening = false;
    if (transcriptText) transcriptText.textContent = "";
    const aiResponse = document.querySelector(
      ".transcript-line.ai-response span"
    );
    if (aiResponse) aiResponse.textContent = "";

    if (clearHistory) {
      chatHistory = [];
      if (transcriptContainer) transcriptContainer.innerHTML = "";
    }

    // Stop and release media stream
    if (mediaStream) {
      mediaStream.getTracks().forEach((track) => {
        track.stop();
      });
      mediaStream = null;
    }
  }

  // Update the updateTranscriptDisplay function to only show last exchange
  function updateTranscriptDisplay() {
    // Clear existing transcript
    transcriptContainer.innerHTML = "";

    // Only show the last exchange (last 2 messages)
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

    // Scroll to bottom
    transcriptContainer.scrollTop = transcriptContainer.scrollHeight;
  }

  async function sendMessage() {
    const text = chatInput.value.trim();
    if (!text) return;

    // Clear input and add user message immediately
    chatInput.value = "";
    addMessageToChat("user", text);

    try {
      // Add current message to history
      chatHistory.push({ role: "user", content: text });

      // Keep history at max length
      if (chatHistory.length > MAX_HISTORY_LENGTH * 2) {
        chatHistory = chatHistory.slice(-MAX_HISTORY_LENGTH * 2);
      }

      // Show loading state
      const loadingMessage = addMessageToChat("ai", "...");

      // Get formatted content for context
      const formattedPages = (window.siteContent.pages || []).map((p) => ({
        title: p.title,
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
          categories: p.categories.join(", "),
        })
      );

      // Send to Gemini with full context
      const response = await fetch("http://localhost:5001/gemini", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          query: text,
          context: `You are a friendly AI assistant helping someone navigate this website. 
                    Keep responses brief and conversational.

                    Previous conversation:
                    ${chatHistory
                      .map((msg) => `${msg.role.toUpperCase()}: ${msg.content}`)
                      .join("\n")}

                    Here are the pages on this website:
                    ${formattedPages
                      .map(
                        (page) => `
                        PAGE: ${page.title}
                        CONTENT: ${page.content}
                        ---
                    `
                      )
                      .join("\n")}
                    Here are the blog posts on this website:
                    ${formattedPosts
                      .map(
                        (post) => `
                        POST: ${post.title}
                        CONTENT: ${post.content}
                        ---
                    `
                      )
                      .join("\n")}
                    Here are the products available:
                    ${formattedProducts
                      .map(
                        (product) => `
                        PRODUCT: ${product.title}
                        PRICE: ${product.price}
                        CATEGORIES: ${product.categories}
                        DESCRIPTION: ${product.description}
                        ---
                    `
                      )
                      .join("\n")}
                `,
        }),
      });

      if (!response.ok) {
        throw new Error(`Error: ${response.status}`);
      }

      const data = await response.json();
      const aiResponse = data.candidates[0].content.parts[0].text;

      // Remove loading message
      loadingMessage.remove();

      // Add AI response
      addMessageToChat("ai", aiResponse);

      // Add to chat history
      chatHistory.push({ role: "assistant", content: aiResponse });

      // Scroll to bottom
      chatMessages.scrollTop = chatMessages.scrollHeight;
    } catch (error) {
      console.error("Error sending message:", error);
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
});

/* ----------------------------------------------------------------
    CONTENT SCRAPER FUNCTION
---------------------------------------------------------------- */
async function collectSiteContent() {
  try {
    console.log("Starting content collection...");

    // 1) Quick test
    const testEndpoint = "/wp-json/my-plugin/v1/test";
    console.log("Testing REST API at:", testEndpoint);
    const testResponse = await fetch(testEndpoint);
    const testResult = await testResponse.json();
    console.log("REST API test result:", testResult);

    if (!testResult || testResult.status !== "ok") {
      throw new Error("REST API test failed");
    }

    // 2) Fetch PAGES (from custom plugin endpoint)
    console.log("Fetching pages...");
    const pagesRes = await fetch("/wp-json/my-plugin/v1/pages");
    if (!pagesRes.ok) {
      throw new Error(`Failed to fetch pages: ${pagesRes.status}`);
    }
    let pages = await pagesRes.json();
    console.log("Initial pages data (stripped):", pages);

    // 2A) For each page, also fetch its raw HTML content from /wp-json/wp/v2/pages/:id
    //     and store it in page.fullContent
    for (const page of pages) {
      try {
        const singlePageRes = await fetch(`/wp-json/wp/v2/pages/${page.id}`);
        if (!singlePageRes.ok) {
          console.warn(`Could not fetch full content for page ${page.id}`);
          continue;
        }
        const singlePageData = await singlePageRes.json();
        // This is the rendered HTML
        page.fullContent = singlePageData.content?.rendered || "";
      } catch (e) {
        console.warn(`Error fetching single page ${page.id}:`, e);
      }
    }

    // 3) Fetch POSTS
    console.log("Fetching posts...");
    const postsRes = await fetch("/wp-json/my-plugin/v1/posts");
    if (!postsRes.ok) {
      throw new Error(`Failed to fetch posts: ${postsRes.status}`);
    }
    const posts = await postsRes.json();
    console.log("Posts data:", posts);

    // 4) Fetch PRODUCTS
    console.log("Fetching products...");
    const productsRes = await fetch("/wp-json/my-plugin/v1/products");
    if (!productsRes.ok) {
      throw new Error(`Failed to fetch products: ${productsRes.status}`);
    }
    const products = await productsRes.json();
    console.log("Products data:", products);

    // Combine them
    const content = {
      pages,
      posts,
      products,
      timestamp: new Date().toISOString(),
    };

    console.log("Final content:", content);
    return content;
  } catch (error) {
    console.error("Content collection error:", error);
    return {
      pages: [],
      posts: [],
      products: [],
      timestamp: new Date().toISOString(),
      error: error.message,
    };
  }
}
