/**
 * Voicero AI Chatbot Customization
 * Handles the customization functionality for the AI chatbot
 */

(function ($) {
  "use strict";

  // Store color picker instance
  let colorPicker;

  // Store the website data from the API
  let websiteData =
    typeof voiceroChatbotData !== "undefined" ? voiceroChatbotData : {};

  // Store SVG icons
  let svgIcons = typeof voiceroSvgIcons !== "undefined" ? voiceroSvgIcons : {};

  /**
   * Initialize the chatbot customization page
   */
  function initChatbotPage() {
    // Log the website data for debugging
    console.log("Chatbot website data:", websiteData);
    console.log("SVG icons before override:", svgIcons);

    // Directly define SVG icons here to override any potential issues with PHP passing
    svgIcons = {
      // Voice icons
      Microphone:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z" /></svg>',
      Waveform:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 12h2v3H3v-3zm4-4h2v10H7V8zm4-6h2v22h-2V2zm4 6h2v10h-2V8zm4 4h2v3h-2v-3z" /></svg>',
      Speaker:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M5 9v6h4l5 5V4L9 9H5zm13.54.12a1 1 0 1 0-1.41 1.42 3 3 0 0 1 0 4.24 1 1 0 1 0 1.41 1.41 5 5 0 0 0 0-7.07z" /></svg>',

      // Message icons
      Message:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM4 16V4h16v12H5.17L4 17.17V16z" /></svg>',
      Cursor:
        '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="24" height="24"><path d="M11 2h2v20h-2z" /></svg>',
      Document:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h16v2H4V4zm0 4h16v2H4V8zm0 4h10v2H4v-2zm0 4h16v2H4v-2z" /></svg>',

      // Bot icons
      Bot: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="24" height="24" fill="currentColor"><rect x="12" y="16" width="40" height="32" rx="10" ry="10" stroke="black" stroke-width="2" fill="currentColor" /><circle cx="22" cy="32" r="4" fill="white" /><circle cx="42" cy="32" r="4" fill="white" /><path d="M24 42c4 4 12 4 16 0" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" /><line x1="32" y1="8" x2="32" y2="16" stroke="black" stroke-width="2" /><circle cx="32" cy="6" r="2" fill="black" /></svg>',
      Voice:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M5 9v6h4l5 5V4L9 9H5zm13.54.12a1 1 0 1 0-1.41 1.42 3 3 0 0 1 0 4.24 1 1 0 1 0 1.41 1.41 5 5 0 0 0 0-7.07z" /></svg>',

      // Also add lowercase versions for compatibility
      microphone:
        '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z" /></svg>',
      waveform:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 12h2v3H3v-3zm4-4h2v10H7V8zm4-6h2v22h-2V2zm4 6h2v10h-2V8zm4 4h2v3h-2v-3z" /></svg>',
      speaker:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M5 9v6h4l5 5V4L9 9H5zm13.54.12a1 1 0 1 0-1.41 1.42 3 3 0 0 1 0 4.24 1 1 0 1 0 1.41 1.41 5 5 0 0 0 0-7.07z" /></svg>',
      message:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM4 16V4h16v12H5.17L4 17.17V16z" /></svg>',
      cursor:
        '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="24" height="24"><path d="M11 2h2v20h-2z" /></svg>',
      document:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h16v2H4V4zm0 4h16v2H4V8zm0 4h10v2H4v-2zm0 4h16v2H4v-2z" /></svg>',
      bot: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="24" height="24" fill="currentColor"><rect x="12" y="16" width="40" height="32" rx="10" ry="10" stroke="black" stroke-width="2" fill="currentColor" /><circle cx="22" cy="32" r="4" fill="white" /><circle cx="42" cy="32" r="4" fill="white" /><path d="M24 42c4 4 12 4 16 0" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" /><line x1="32" y1="8" x2="32" y2="16" stroke="black" stroke-width="2" /><circle cx="32" cy="6" r="2" fill="black" /></svg>',
      voice:
        '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M5 9v6h4l5 5V4L9 9H5zm13.54.12a1 1 0 1 0-1.41 1.42 3 3 0 0 1 0 4.24 1 1 0 1 0 1.41 1.41 5 5 0 0 0 0-7.07z" /></svg>',
    };

    console.log("SVG icons after override:", svgIcons);

    // Add direct debug output to the page
    $(".voicero-chatbot-page").prepend(`
      <div id="debug-info" style="background: #f9f9f9; padding: 15px; margin-bottom: 20px; border: 1px solid #ddd; display: none;">
        <h3>Debug Information</h3>
        <p><strong>Available Icons:</strong> ${Object.keys(svgIcons).join(
          ", "
        )}</p>
        <button id="toggle-debug" class="button">Show/Hide Debug</button>
      </div>
    `);

    $("#toggle-debug").on("click", function () {
      $("#debug-info").toggle();
    });

    // Initialize word counters
    initWordCounters();

    // Initialize suggested questions
    initSuggestedQuestions();

    // Initialize color picker
    initColorPicker();

    // Initialize icon selectors
    initIconSelectors();

    // Handle form submission
    $("#save-settings-btn").on("click", function () {
      saveSettings();
    });
  }

  /**
   * Initialize word counters for text areas
   */
  function initWordCounters() {
    // Welcome message word counter
    $("#welcome-message")
      .on("input", function () {
        updateWordCount($(this), $("#welcome-message-count"), 25);
      })
      .trigger("input");

    // Custom instructions word counter
    $("#custom-instructions")
      .on("input", function () {
        updateWordCount($(this), $("#custom-instructions-count"), 50);
      })
      .trigger("input");
  }

  /**
   * Update word count for a text area
   * @param {Object} $textarea - The textarea jQuery object
   * @param {Object} $counter - The counter element jQuery object
   * @param {number} limit - The word limit
   */
  function updateWordCount($textarea, $counter, limit) {
    const text = $textarea.val().trim();
    const wordCount = text ? text.split(/\s+/).length : 0;

    $counter.text(wordCount + "/" + limit + " words");

    if (wordCount > limit) {
      $counter.addClass("over-limit");
    } else {
      $counter.removeClass("over-limit");
    }
  }

  /**
   * Initialize suggested questions functionality
   */
  function initSuggestedQuestions() {
    // Add question button
    $("#add-question-btn").on("click", function () {
      addSuggestedQuestion();
    });

    // Enter key in new question field
    $("#new-question").on("keypress", function (e) {
      if (e.which === 13) {
        e.preventDefault();
        addSuggestedQuestion();
      }
    });

    // Remove question button (using event delegation)
    $("#suggested-questions-container").on(
      "click",
      ".remove-question-btn",
      function () {
        removeSuggestedQuestion($(this).closest(".suggested-question-item"));
      }
    );
  }

  /**
   * Add a new suggested question
   */
  function addSuggestedQuestion() {
    const newQuestion = $("#new-question").val().trim();

    if (!newQuestion) {
      return;
    }

    // Get current question count
    const currentCount = parseInt($("#questions-count").text(), 10);

    // Check if we've reached the limit
    if (currentCount >= 3) {
      return;
    }

    // Remove "no questions" message if it exists
    $(".no-questions").remove();

    // Create new question element
    const questionIndex = $(".suggested-question-item").length;
    const $questionItem = $(`
            <div class="suggested-question-item" data-index="${questionIndex}">
                <input type="text" name="suggested_questions[]" value="${newQuestion}" class="suggested-question-input">
                <button type="button" class="remove-question-btn button-link">
                    <span class="dashicons dashicons-trash"></span>
                </button>
            </div>
        `);

    // Add to container
    $("#suggested-questions-container").append($questionItem);

    // Clear input
    $("#new-question").val("").focus();

    // Update counter
    const newCount = currentCount + 1;
    $("#questions-count").text(newCount);

    // Hide add container if we've reached the limit
    if (newCount >= 3) {
      $(".add-question-container").hide();
    }
  }

  /**
   * Remove a suggested question
   * @param {Object} $questionItem - The question item jQuery object
   */
  function removeSuggestedQuestion($questionItem) {
    // Remove the item
    $questionItem.remove();

    // Update indices for remaining items
    $(".suggested-question-item").each(function (index) {
      $(this).attr("data-index", index);
    });

    // Update counter
    const newCount = $(".suggested-question-item").length;
    $("#questions-count").text(newCount);

    // Show add container if we're below the limit
    if (newCount < 3) {
      $(".add-question-container").show();
    }

    // Show "no questions" message if no questions left
    if (newCount === 0) {
      $("#suggested-questions-container").append(
        '<div class="no-questions">No suggested questions added yet.</div>'
      );
    }
  }

  /**
   * Initialize the color picker
   */
  function initColorPicker() {
    // Check if color picker container exists
    const $colorPicker = $("#color-picker");
    if ($colorPicker.length === 0) return;

    // Load saved color or use default - prefer API data if available
    const savedColor =
      $("#primary-color").val() || websiteData.color || "#6366F1";

    // Create a better color picker using div gradient
    $colorPicker.css({
      background:
        "linear-gradient(to right, red, yellow, lime, cyan, blue, magenta, red)",
      height: "20px",
      width: "100%",
      "max-width": "300px",
      position: "relative",
      cursor: "pointer",
      "border-radius": "3px",
      "margin-bottom": "10px",
    });

    // Add color selector handle
    const $colorHandle = $('<div class="color-handle"></div>').css({
      position: "absolute",
      width: "10px",
      height: "26px",
      border: "2px solid white",
      "box-shadow": "0 0 2px rgba(0,0,0,0.5)",
      "border-radius": "3px",
      top: "-3px",
      transform: "translateX(-50%)",
      background: savedColor,
    });

    $colorPicker.append($colorHandle);

    // Calculate position based on color
    let initialPosition = 66.67; // Default position (blue-ish)

    // Try to estimate position from hex color
    if (savedColor.startsWith("#")) {
      try {
        // Extract RGB components
        const r = parseInt(savedColor.slice(1, 3), 16) / 255;
        const g = parseInt(savedColor.slice(3, 5), 16) / 255;
        const b = parseInt(savedColor.slice(5, 7), 16) / 255;

        // Simple hue calculation
        // This is a simplified approach - not perfect but gives a rough position
        if (r === 1 && g < 1 && b === 0) {
          // Red to Yellow
          initialPosition = g * 16.67;
        } else if (r > 0 && g === 1 && b === 0) {
          // Yellow to Green
          initialPosition = 16.67 + (1 - r) * 16.67;
        } else if (r === 0 && g === 1 && b < 1) {
          // Green to Cyan
          initialPosition = 33.33 + b * 16.67;
        } else if (r === 0 && g > 0 && b === 1) {
          // Cyan to Blue
          initialPosition = 50 + (1 - g) * 16.67;
        } else if (r < 1 && g === 0 && b === 1) {
          // Blue to Magenta
          initialPosition = 66.67 + r * 16.67;
        } else if (r === 1 && g === 0 && b > 0) {
          // Magenta to Red
          initialPosition = 83.33 + (1 - b) * 16.67;
        }
      } catch (e) {
        console.warn("Error calculating color position:", e);
        // Use default position
        initialPosition = 66.67;
      }
    }

    // Set handle position
    $colorHandle.css("left", initialPosition + "%");

    // Handle click and drag on color picker
    $colorPicker.on("click", function (e) {
      const position =
        ((e.pageX - $colorPicker.offset().left) / $colorPicker.width()) * 100;
      updateColorPickerHandle(position);
    });

    let isDragging = false;

    $colorHandle.on("mousedown", function () {
      isDragging = true;
    });

    $(document).on("mousemove", function (e) {
      if (!isDragging) return;

      const position =
        ((e.pageX - $colorPicker.offset().left) / $colorPicker.width()) * 100;
      updateColorPickerHandle(position);
    });

    $(document).on("mouseup", function () {
      isDragging = false;
    });

    // Set initial color to input
    $("#primary-color").val(savedColor);

    // Handle direct input of color
    $("#primary-color").on("input", function () {
      const inputColor = $(this).val();

      // Validate the color (basic validation)
      if (/^#[0-9A-F]{6}$/i.test(inputColor)) {
        // Update the preview
        $(".color-preview").css("background", inputColor);
        $colorHandle.css("background", inputColor);

        // Try to update the position of the handle
        try {
          const position = estimatePositionFromColor(inputColor);
          if (position !== null) {
            $colorHandle.css("left", position + "%");
          }
        } catch (e) {
          console.warn("Error updating color handle position:", e);
        }
      }
    });

    // Update on blur even if not a perfect hex
    $("#primary-color").on("blur", function () {
      let inputColor = $(this).val();

      // Add # if missing
      if (inputColor.charAt(0) !== "#") {
        inputColor = "#" + inputColor;
      }

      // Force 6 characters
      if (/^#[0-9A-F]{3}$/i.test(inputColor)) {
        // Convert 3-char hex to 6-char
        inputColor =
          "#" +
          inputColor[1] +
          inputColor[1] +
          inputColor[2] +
          inputColor[2] +
          inputColor[3] +
          inputColor[3];
      }

      // If still not valid, revert to saved
      if (!/^#[0-9A-F]{6}$/i.test(inputColor)) {
        inputColor = savedColor;
      }

      // Update input and preview
      $(this).val(inputColor);
      $(".color-preview").css("background", inputColor);
      $colorHandle.css("background", inputColor);
    });
  }

  /**
   * Estimate color picker position from a hex color
   * @param {string} color - Hex color code
   * @returns {number|null} Position as percentage (0-100) or null if cannot be determined
   */
  function estimatePositionFromColor(color) {
    if (!color.startsWith("#")) return null;

    try {
      // Extract RGB components
      const r = parseInt(color.slice(1, 3), 16) / 255;
      const g = parseInt(color.slice(3, 5), 16) / 255;
      const b = parseInt(color.slice(5, 7), 16) / 255;

      // Find the dominant colors
      if (r === 1 && g < 1 && b === 0) {
        // Red to Yellow
        return g * 16.67;
      } else if (r > 0 && g === 1 && b === 0) {
        // Yellow to Green
        return 16.67 + (1 - r) * 16.67;
      } else if (r === 0 && g === 1 && b < 1) {
        // Green to Cyan
        return 33.33 + b * 16.67;
      } else if (r === 0 && g > 0 && b === 1) {
        // Cyan to Blue
        return 50 + (1 - g) * 16.67;
      } else if (r < 1 && g === 0 && b === 1) {
        // Blue to Magenta
        return 66.67 + r * 16.67;
      } else if (r === 1 && g === 0 && b > 0) {
        // Magenta to Red
        return 83.33 + (1 - b) * 16.67;
      }

      // If we can't determine a good position, return null
      return null;
    } catch (e) {
      console.warn("Error estimating position from color:", e);
      return null;
    }
  }

  /**
   * Update the color picker handle position and color
   * @param {number} position - The position as a percentage (0-100)
   */
  function updateColorPickerHandle(position) {
    // Constrain position to 0-100%
    position = Math.max(0, Math.min(100, position));

    // Update handle position
    $(".color-handle").css("left", position + "%");

    // Calculate color based on position (simplified)
    // This is a very basic implementation
    let color;
    if (position < 16.67) {
      // Red to Yellow
      const ratio = position / 16.67;
      color = rgbToHex(255, Math.round(255 * ratio), 0);
    } else if (position < 33.33) {
      // Yellow to Lime
      const ratio = (position - 16.67) / 16.67;
      color = rgbToHex(Math.round(255 * (1 - ratio)), 255, 0);
    } else if (position < 50) {
      // Lime to Cyan
      const ratio = (position - 33.33) / 16.67;
      color = rgbToHex(0, 255, Math.round(255 * ratio));
    } else if (position < 66.67) {
      // Cyan to Blue
      const ratio = (position - 50) / 16.67;
      color = rgbToHex(0, Math.round(255 * (1 - ratio)), 255);
    } else if (position < 83.33) {
      // Blue to Magenta
      const ratio = (position - 66.67) / 16.67;
      color = rgbToHex(Math.round(255 * ratio), 0, 255);
    } else {
      // Magenta to Red
      const ratio = (position - 83.33) / 16.67;
      color = rgbToHex(255, 0, Math.round(255 * (1 - ratio)));
    }

    // Update handle color and input
    $(".color-handle").css("background", color);
    $("#primary-color").val(color);
    $(".color-preview").css("background", color);
  }

  /**
   * Convert RGB values to HEX color code
   * @param {number} r - Red (0-255)
   * @param {number} g - Green (0-255)
   * @param {number} b - Blue (0-255)
   * @returns {string} HEX color code
   */
  function rgbToHex(r, g, b) {
    return "#" + componentToHex(r) + componentToHex(g) + componentToHex(b);
  }

  /**
   * Convert a color component to HEX
   * @param {number} c - Color component (0-255)
   * @returns {string} HEX component
   */
  function componentToHex(c) {
    const hex = c.toString(16);
    return hex.length === 1 ? "0" + hex : hex;
  }

  /**
   * Convert hex color to RGBA format
   * @param {string} hex - The hex color code
   * @returns {string} RGBA color string
   */
  function hexToRgba(hex) {
    // Remove the # if present
    hex = hex.replace("#", "");

    // Parse the hex values
    const r = parseInt(hex.substring(0, 2), 16);
    const g = parseInt(hex.substring(2, 4), 16);
    const b = parseInt(hex.substring(4, 6), 16);

    if (isNaN(r) || isNaN(g) || isNaN(b)) {
      return null;
    }

    return `rgba(${r}, ${g}, ${b}, 1)`;
  }

  /**
   * Initialize icon selectors
   */
  function initIconSelectors() {
    console.log("Initializing icon selectors");

    // Bot icon selector
    $("#bot-icon-type")
      .on("change", function () {
        updateIconPreview($(this), $(".bot-icon"), "bot");
      })
      .trigger("change");

    // Voice icon selector
    $("#voice-icon-type")
      .on("change", function () {
        updateIconPreview($(this), $(".voice-icon"), "voice");
      })
      .trigger("change");

    // Message icon selector
    $("#message-icon-type")
      .on("change", function () {
        updateIconPreview($(this), $(".message-icon"), "message");
      })
      .trigger("change");
  }

  /**
   * Update icon preview based on selection
   * @param {Object} $select - The select element jQuery object
   * @param {Object} $preview - The preview element jQuery object
   * @param {string} iconType - The type of icon (bot, voice, message)
   */
  function updateIconPreview($select, $preview, iconType) {
    const selectedValue = $select.val();

    console.log(`Updating ${iconType} icon to ${selectedValue}`);
    console.log("Available icons:", Object.keys(svgIcons));

    // Add debug info directly to preview
    const debugInfo = $(
      `<div class="icon-debug" style="font-size: 10px; margin-top: 5px; color: #666; max-width: 150px;"></div>`
    );
    $preview.parent().find(".icon-debug").remove();
    $preview.after(debugInfo);

    // Try different variations of the icon name
    const iconKey = selectedValue;
    const iconKeyLower = selectedValue.toLowerCase();

    console.log(`Trying to find icon with keys: ${iconKey}, ${iconKeyLower}`);

    // First try exact match, then lowercase
    if (svgIcons && svgIcons[iconKey]) {
      console.log(`Found SVG icon for ${iconKey}`);
      $preview.html(svgIcons[iconKey]);
    } else if (svgIcons && svgIcons[iconKeyLower]) {
      console.log(`Found SVG icon for lowercase ${iconKeyLower}`);
      $preview.html(svgIcons[iconKeyLower]);
    } else {
      // Fallback to a basic icon if SVG not found
      console.warn(
        `SVG icon not found for ${selectedValue} (tried ${iconKey}, ${iconKeyLower})`
      );
      $preview.html('<span class="dashicons dashicons-admin-generic"></span>');
      debugInfo.append(`<br>Not found! Using fallback.`);
    }
  }

  /**
   * Save settings via AJAX
   */
  function saveSettings() {
    // Show saving indicator
    showSavingIndicator();

    // Validate form
    if (!validateForm()) {
      hideSavingIndicator();
      return;
    }

    // Get form data
    const formData = {
      websiteId: $("#website-id").val(),
      chatbot_name: $("#chatbot-name").val(),
      welcome_message: $("#welcome-message").val(),
      custom_instructions: $("#custom-instructions").val(),
      primary_color: $("#primary-color").val(),
      remove_highlighting: $("#remove-highlighting").is(":checked") ? 1 : 0,
      bot_icon_type: $("#bot-icon-type").val(),
      voice_icon_type: $("#voice-icon-type").val(),
      message_icon_type: $("#message-icon-type").val(),
      suggested_questions: [],
    };

    console.log("Form data to be sent:", formData);

    // Get suggested questions
    $(".suggested-question-input").each(function () {
      formData.suggested_questions.push($(this).val());
    });

    // Create a config object with fallbacks if voiceroConfig isn't defined
    const config =
      typeof voiceroConfig !== "undefined"
        ? voiceroConfig
        : {
            ajaxUrl: ajaxurl,
            nonce: $("#voicero_chatbot_nonce").val(),
          };

    // Send AJAX request
    $.ajax({
      url: config.ajaxUrl,
      type: "POST",
      data: {
        action: "voicero_save_chatbot_settings",
        nonce: config.nonce,
        settings: formData,
      },
      success: function (response) {
        hideSavingIndicator();

        if (response.success) {
          // Update the website data with the new values
          if (websiteData) {
            websiteData.botName = formData.chatbot_name;
            websiteData.customWelcomeMessage = formData.welcome_message;
            websiteData.customInstructions = formData.custom_instructions;
            websiteData.color = formData.primary_color;
            websiteData.removeHighlight = formData.remove_highlighting === 1;
            websiteData.popUpQuestions = formData.suggested_questions;

            // Map icon types back to API format
            const botIconMap = {
              Bot: "BotIcon",
              Voice: "VoiceIcon",
              Message: "MessageIcon",
            };

            const voiceIconMap = {
              Microphone: "MicrophoneIcon",
              Waveform: "WaveformIcon",
              Speaker: "SpeakerIcon",
            };

            const messageIconMap = {
              Message: "MessageIcon",
              Document: "DocumentIcon",
              Cursor: "CursorIcon",
            };

            websiteData.iconBot =
              botIconMap[formData.bot_icon_type] || "BotIcon";
            websiteData.iconVoice =
              voiceIconMap[formData.voice_icon_type] || "MicrophoneIcon";
            websiteData.iconMessage =
              messageIconMap[formData.message_icon_type] || "MessageIcon";

            console.log("Updated website data:", websiteData);
          }

          showSuccessMessage("Chatbot settings saved successfully.");
        } else {
          showErrorMessage(
            response.data.message || "An error occurred while saving settings."
          );
        }
      },
      error: function () {
        hideSavingIndicator();
        showErrorMessage(
          "An error occurred while saving settings. Please try again."
        );
      },
    });
  }

  /**
   * Validate the form
   * @returns {boolean} Is valid
   */
  function validateForm() {
    // Check required fields
    if (!$("#chatbot-name").val().trim()) {
      showErrorMessage("Chatbot Name is required.");
      return false;
    }

    // Check word limits
    const welcomeMessage = $("#welcome-message").val().trim();
    if (welcomeMessage && welcomeMessage.split(/\s+/).length > 25) {
      showErrorMessage("Welcome Message exceeds the 25 word limit.");
      return false;
    }

    const customInstructions = $("#custom-instructions").val().trim();
    if (customInstructions && customInstructions.split(/\s+/).length > 50) {
      showErrorMessage("Custom Instructions exceeds the 50 word limit.");
      return false;
    }

    return true;
  }

  /**
   * Show a saving indicator
   */
  function showSavingIndicator() {
    // Disable save button and show spinner
    $("#save-settings-btn")
      .prop("disabled", true)
      .html(
        '<span class="spinner is-active" style="float: none; margin: 0 5px 0 0;"></span> Saving...'
      );
  }

  /**
   * Hide the saving indicator
   */
  function hideSavingIndicator() {
    // Re-enable save button
    $("#save-settings-btn").prop("disabled", false).html("Save Settings");
  }

  /**
   * Show a success message
   * @param {string} message - The success message
   */
  function showSuccessMessage(message) {
    const $notice = $(
      '<div class="notice notice-success is-dismissible"><p>' +
        message +
        "</p></div>"
    );
    $("#voicero-settings-message").html($notice);

    // Auto-dismiss after 5 seconds
    setTimeout(function () {
      $notice.fadeOut(function () {
        $(this).remove();
      });
    }, 5000);
  }

  /**
   * Show an error message
   * @param {string} message - The error message
   */
  function showErrorMessage(message) {
    const $notice = $(
      '<div class="notice notice-error is-dismissible"><p>' +
        message +
        "</p></div>"
    );
    $("#voicero-settings-message").html($notice);
  }

  // Initialize when the DOM is ready
  $(document).ready(function () {
    // Check if we're on the chatbot page
    if ($(".voicero-chatbot-page").length > 0) {
      initChatbotPage();

      // Add CSS for the chatbot page
      addCustomCSS();
    }
  });

  /**
   * Add custom CSS for the chatbot page
   */
  function addCustomCSS() {
    $("head").append(`
            <style>
                /* Chatbot Customization Page Styles */
                .voicero-chatbot-page {
                    max-width: 800px;
                }
                
                .chatbot-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .back-link {
                    text-decoration: none;
                    color: #2271b1;
                    display: flex;
                    align-items: center;
                    font-size: 16px;
                    font-weight: 600;
                }
                
                .back-link .dashicons {
                    margin-right: 5px;
                }
                
                .voicero-card {
                    background: #fff;
                    border-radius: 5px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    margin-bottom: 20px;
                    overflow: hidden;
                }
                
                .voicero-card-header {
                    display: flex;
                    align-items: center;
                    padding: 15px 20px;
                    background-color: #f8f9fa;
                    border-bottom: 1px solid #e9ecef;
                }
                
                .card-header-icon {
                    margin-right: 15px;
                }
                
                .card-header-icon .dashicons {
                    color: #2271b1;
                    font-size: 20px;
                }
                
                .voicero-card-header h2 {
                    margin: 0;
                    flex-grow: 1;
                    font-size: 16px;
                }
                
                .required-badge {
                    background-color: #f0f6fc;
                    color: #2271b1;
                    padding: 3px 8px;
                    border-radius: 3px;
                    font-size: 12px;
                    font-weight: 600;
                }
                
                .voicero-card-content {
                    padding: 20px;
                }
                
                .form-field {
                    margin-bottom: 20px;
                }
                
                .form-field:last-child {
                    margin-bottom: 0;
                }
                
                .form-field label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 600;
                }
                
                .form-field input[type="text"],
                .form-field textarea,
                .form-field select {
                    width: 100%;
                }
                
                .field-description {
                    margin-top: 5px;
                    color: #666;
                    font-style: italic;
                }
                
                .word-count {
                    text-align: right;
                    color: #666;
                    font-size: 12px;
                    margin-top: 5px;
                }
                
                .word-count.over-limit {
                    color: #d63638;
                    font-weight: 600;
                }
                
                /* Suggested Questions */
                .suggested-question-item {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                    padding: 5px;
                    border: 1px solid #ddd;
                    border-radius: 3px;
                    background-color: #f9f9f9;
                }
                
                .suggested-question-input {
                    flex-grow: 1;
                    margin-right: 10px;
                }
                
                .remove-question-btn {
                    color: #d63638;
                }
                
                .remove-question-btn:hover {
                    color: #b32d2e;
                }
                
                .question-counter {
                    margin: 10px 0;
                    color: #666;
                    font-size: 13px;
                }
                
                .add-question-field {
                    display: flex;
                    margin-top: 10px;
                }
                
                .add-question-field input {
                    flex-grow: 1;
                    margin-right: 10px;
                }
                
                .no-questions {
                    padding: 15px;
                    background-color: #f9f9f9;
                    border: 1px dashed #ddd;
                    text-align: center;
                    color: #666;
                    border-radius: 3px;
                }
                
                /* Color Picker */
                .color-picker-container {
                    margin-top: 10px;
                    display: flex;
                    align-items: center;
                }
                
                /* Icon Selector */
                .icon-selector {
                    display: flex;
                    align-items: center;
                    margin-top: 5px;
                }
                
                .icon-selector select {
                    margin-right: 10px;
                    width: 150px;
                }
                
                .icon-preview {
                    width: 40px;
                    height: 40px;
                    background-color: #f0f6fc;
                    border-radius: 5px;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    border: 1px solid #ddd;
                }
                
                .icon-preview svg {
                    color: #2271b1;
                    width: 24px;
                    height: 24px;
                }
                
                /* Website Information */
                .info-field {
                    display: flex;
                    margin-bottom: 10px;
                }
                
                .info-field:last-child {
                    margin-bottom: 0;
                }
                
                .info-label {
                    font-weight: 600;
                    width: 120px;
                    flex-shrink: 0;
                }
                
                .info-value {
                    color: #333;
                }
                
                /* Checkbox Field */
                .checkbox-field {
                    display: flex;
                    align-items: flex-start;
                }
                
                .checkbox-field input[type="checkbox"] {
                    margin-top: 3px;
                    margin-right: 8px;
                }
            </style>
        `);
  }
})(jQuery);
