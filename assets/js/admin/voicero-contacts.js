/**
 * Voicero AI Contacts / Customer Messages
 * Handles the customer message center functionality
 */

(function ($) {
  "use strict";

  // Store the current filter state
  let currentFilter = "all";

  /**
   * Initialize the contacts page functionality
   */
  function initContactsPage() {
    // Set up tab switching
    setupTabs();

    // Set up message actions
    setupMessageActions();

    // Set up refresh button
    $("#refresh-messages").on("click", function (e) {
      e.preventDefault();
      loadMessages(currentFilter);
    });

    // Initialize by loading all messages
    loadMessages("all");
  }

  /**
   * Set up the tab switching functionality
   */
  function setupTabs() {
    $(".message-tabs .tab").on("click", function (e) {
      e.preventDefault();

      // Remove active class from all tabs
      $(".message-tabs .tab").removeClass("active");

      // Add active class to clicked tab
      $(this).addClass("active");

      // Get the filter from the data attribute
      const filter = $(this).data("filter");
      currentFilter = filter;

      // Load messages with the selected filter
      loadMessages(filter);
    });
  }

  /**
   * Set up message action buttons (mark read, reply, delete)
   */
  function setupMessageActions() {
    // Use event delegation for dynamically loaded content
    $("#messages-container").on("click", ".mark-read-btn", function () {
      const messageId = $(this).closest(".message-item").data("id");
      markAsRead(messageId);
    });

    $("#messages-container").on("click", ".reply-btn", function () {
      const messageId = $(this).closest(".message-item").data("id");
      replyToMessage(messageId);
    });

    $("#messages-container").on("click", ".delete-btn", function () {
      const messageId = $(this).closest(".message-item").data("id");
      deleteMessage(messageId);
    });
  }

  /**
   * Load messages based on the filter
   * @param {string} filter - The filter to apply (all, unread, read)
   */
  function loadMessages(filter) {
    // Show loading state
    showLoadingState();

    // Create a config object with fallbacks if voiceroConfig isn't defined
    const config =
      typeof voiceroConfig !== "undefined"
        ? voiceroConfig
        : {
            ajaxUrl: ajaxurl,
            nonce: $("#voicero_nonce").val(),
          };

    // Send AJAX request to get messages
    $.ajax({
      url: config.ajaxUrl,
      type: "POST",
      data: {
        action: "voicero_get_messages",
        nonce: config.nonce,
        filter: filter,
      },
      success: function (response) {
        hideLoadingState();

        if (response.success) {
          // Update messages list
          updateMessagesList(response.data.messages);

          // Update stats
          updateMessageStats(response.data.stats);
        } else {
          // Show error message
          showError(
            response.data.message || "An error occurred while loading messages."
          );
        }
      },
      error: function () {
        hideLoadingState();
        showError(
          "An error occurred while loading messages. Please try again."
        );
      },
    });
  }

  /**
   * Update the messages list in the UI
   * @param {Array} messages - The messages to display
   */
  function updateMessagesList(messages) {
    const $container = $("#messages-container");

    // Clear the container
    $container.empty();

    if (messages.length === 0) {
      // Show empty state
      $container.html('<div class="no-messages">No messages found.</div>');
      return;
    }

    // Add each message to the container
    messages.forEach(function (message) {
      const messageHtml = `
                <div class="message-item ${
                  message.is_read ? "read" : "unread"
                }" data-id="${message.id}">
                    <div class="message-avatar">
                        ${message.email.charAt(0).toUpperCase()}
                    </div>
                    <div class="message-content">
                        <div class="message-header">
                            <div class="message-info">
                                <div class="message-email">${
                                  message.email
                                }</div>
                                <div class="message-meta">
                                    ${
                                      message.is_read
                                        ? ""
                                        : '<span class="new-badge">New</span>'
                                    }
                                    <span class="message-time">${
                                      message.time
                                    }</span>
                                </div>
                            </div>
                            <div class="message-actions">
                                ${
                                  message.is_read
                                    ? ""
                                    : '<button class="button mark-read-btn">Mark Read</button>'
                                }
                                <button class="button reply-btn">Reply</button>
                                <button class="button delete-btn">Delete</button>
                            </div>
                        </div>
                        <div class="message-body">${message.message}</div>
                    </div>
                </div>
            `;

      $container.append(messageHtml);
    });
  }

  /**
   * Update the message statistics in the UI
   * @param {Object} stats - The message statistics
   */
  function updateMessageStats(stats) {
    $("#total-messages").text(stats.total || 0);
    $("#unread-messages").text(stats.unread || 0);
    $("#high-priority-messages").text(stats.high_priority || 0);
    $("#response-rate").text((stats.response_rate || 0) + "%");

    // Update unread count in the message center header
    const unreadCount = stats.unread || 0;
    $("#unread-count").text(
      unreadCount + " " + (unreadCount === 1 ? "Unread" : "Unread")
    );

    // Update tab counts
    $("#all-count").text("(" + (stats.total || 0) + ")");
    $("#unread-tab-count").text("(" + (stats.unread || 0) + ")");
    $("#read-count").text("(" + (stats.read || 0) + ")");
  }

  /**
   * Mark a message as read
   * @param {number} messageId - The ID of the message to mark as read
   */
  function markAsRead(messageId) {
    // Create a config object with fallbacks if voiceroConfig isn't defined
    const config =
      typeof voiceroConfig !== "undefined"
        ? voiceroConfig
        : {
            ajaxUrl: ajaxurl,
            nonce: $("#voicero_nonce").val(),
          };

    // Send AJAX request
    $.ajax({
      url: config.ajaxUrl,
      type: "POST",
      data: {
        action: "voicero_mark_message_read",
        nonce: config.nonce,
        message_id: messageId,
      },
      success: function (response) {
        if (response.success) {
          // Update the UI - remove the unread styling and mark read button
          const $message = $(`.message-item[data-id="${messageId}"]`);
          $message.removeClass("unread").addClass("read");
          $message.find(".new-badge").remove();
          $message.find(".mark-read-btn").remove();

          // Reload messages if we're on a filtered view
          if (currentFilter !== "all") {
            loadMessages(currentFilter);
          }

          // Update the stats
          updateMessageStats(response.data.stats);
        } else {
          showError(response.data.message || "An error occurred.");
        }
      },
      error: function () {
        showError("An error occurred. Please try again.");
      },
    });
  }

  /**
   * Reply to a message
   * @param {number} messageId - The ID of the message to reply to
   */
  function replyToMessage(messageId) {
    // Get the message email
    const email = $(
      `.message-item[data-id="${messageId}"] .message-email`
    ).text();

    // Open reply modal
    openReplyModal(messageId, email);
  }

  /**
   * Open the reply modal
   * @param {number} messageId - The ID of the message
   * @param {string} email - The recipient email
   */
  function openReplyModal(messageId, email) {
    // If modal doesn't exist, create it
    if ($("#reply-modal").length === 0) {
      const modalHtml = `
                <div id="reply-modal" class="voicero-modal">
                    <div class="voicero-modal-content">
                        <span class="voicero-modal-close">&times;</span>
                        <h2>Reply to Message</h2>
                        <form id="reply-form">
                            <input type="hidden" id="reply-message-id" value="">
                            <div class="form-group">
                                <label for="reply-to">To:</label>
                                <input type="text" id="reply-to" readonly>
                            </div>
                            <div class="form-group">
                                <label for="reply-subject">Subject:</label>
                                <input type="text" id="reply-subject" value="Re: Your inquiry">
                            </div>
                            <div class="form-group">
                                <label for="reply-content">Message:</label>
                                <textarea id="reply-content" rows="6"></textarea>
                            </div>
                            <div class="form-actions">
                                <button type="button" class="button button-secondary cancel-reply">Cancel</button>
                                <button type="submit" class="button button-primary">Send Reply</button>
                            </div>
                        </form>
                    </div>
                </div>
            `;

      $("body").append(modalHtml);

      // Set up event handlers for the modal
      $(".voicero-modal-close, .cancel-reply").on("click", function () {
        $("#reply-modal").hide();
      });

      $("#reply-form").on("submit", function (e) {
        e.preventDefault();
        sendReply();
      });
    }

    // Set the values in the form
    $("#reply-message-id").val(messageId);
    $("#reply-to").val(email);

    // Show the modal
    $("#reply-modal").show();
  }

  /**
   * Send a reply to a message
   */
  function sendReply() {
    const messageId = $("#reply-message-id").val();
    const subject = $("#reply-subject").val();
    const content = $("#reply-content").val();

    if (!content.trim()) {
      alert("Please enter a message.");
      return;
    }

    // Show loading state
    const $submitButton = $('#reply-form button[type="submit"]');
    const originalText = $submitButton.text();
    $submitButton.prop("disabled", true).text("Sending...");

    // Create a config object with fallbacks if voiceroConfig isn't defined
    const config =
      typeof voiceroConfig !== "undefined"
        ? voiceroConfig
        : {
            ajaxUrl: ajaxurl,
            nonce: $("#voicero_nonce").val(),
          };

    // Send AJAX request
    $.ajax({
      url: config.ajaxUrl,
      type: "POST",
      data: {
        action: "voicero_send_reply",
        nonce: config.nonce,
        message_id: messageId,
        subject: subject,
        content: content,
      },
      success: function (response) {
        $submitButton.prop("disabled", false).text(originalText);

        if (response.success) {
          // Close the modal
          $("#reply-modal").hide();

          // Clear the form
          $("#reply-content").val("");

          // Show success message
          showSuccess("Reply sent successfully.");

          // Mark the message as read
          markAsRead(messageId);

          // Reload messages to update the UI
          loadMessages(currentFilter);
        } else {
          showError(
            response.data.message ||
              "An error occurred while sending the reply."
          );
        }
      },
      error: function () {
        $submitButton.prop("disabled", false).text(originalText);
        showError(
          "An error occurred while sending the reply. Please try again."
        );
      },
    });
  }

  /**
   * Delete a message
   * @param {number} messageId - The ID of the message to delete
   */
  function deleteMessage(messageId) {
    if (
      !confirm(
        "Are you sure you want to delete this message? This action cannot be undone."
      )
    ) {
      return;
    }

    // Create a config object with fallbacks if voiceroConfig isn't defined
    const config =
      typeof voiceroConfig !== "undefined"
        ? voiceroConfig
        : {
            ajaxUrl: ajaxurl,
            nonce: $("#voicero_nonce").val(),
          };

    // Send AJAX request
    $.ajax({
      url: config.ajaxUrl,
      type: "POST",
      data: {
        action: "voicero_delete_message",
        nonce: config.nonce,
        message_id: messageId,
      },
      success: function (response) {
        if (response.success) {
          // Remove the message from the UI
          $(`.message-item[data-id="${messageId}"]`).fadeOut(function () {
            $(this).remove();

            // Show empty state if no messages left
            if ($(".message-item").length === 0) {
              $("#messages-container").html(
                '<div class="no-messages">No messages found.</div>'
              );
            }
          });

          // Update the stats
          updateMessageStats(response.data.stats);

          // Show success message
          showSuccess("Message deleted successfully.");
        } else {
          showError(
            response.data.message ||
              "An error occurred while deleting the message."
          );
        }
      },
      error: function () {
        showError(
          "An error occurred while deleting the message. Please try again."
        );
      },
    });
  }

  /**
   * Show a loading state
   */
  function showLoadingState() {
    // Add a loading overlay to the messages container
    if ($("#messages-loading").length === 0) {
      $("#messages-container").append(
        '<div id="messages-loading" class="loading-overlay"><span class="spinner is-active"></span></div>'
      );
    }
  }

  /**
   * Hide the loading state
   */
  function hideLoadingState() {
    $("#messages-loading").remove();
  }

  /**
   * Show a success message
   * @param {string} message - The success message
   */
  function showSuccess(message) {
    const $notice = $(
      '<div class="notice notice-success is-dismissible"><p>' +
        message +
        "</p></div>"
    );
    $(".wrap h1").after($notice);

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
  function showError(message) {
    const $notice = $(
      '<div class="notice notice-error is-dismissible"><p>' +
        message +
        "</p></div>"
    );
    $(".wrap h1").after($notice);
  }

  // Initialize when the DOM is ready
  $(document).ready(function () {
    // Check if we're on the contacts page
    if ($(".voicero-contacts-page").length > 0) {
      initContactsPage();

      // Add CSS for the contacts page
      addCustomCSS();
    }
  });

  /**
   * Add custom CSS for the contacts page
   */
  function addCustomCSS() {
    $("head").append(`
            <style>
                /* Message Center Styles */
                .voicero-card {
                    border-radius: 5px;
                    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
                    padding: 20px;
                    margin-top: 20px;
                    background: #fff;
                }
                
                .message-center-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .message-center-title {
                    margin: 0;
                    font-size: 18px;
                    font-weight: 600;
                }
                
                .message-center-subtitle {
                    color: #666;
                    margin-top: 5px;
                }
                
                .message-center-unread {
                    background-color: #f0f6fc;
                    color: #2271b1;
                    padding: 5px 10px;
                    border-radius: 20px;
                    font-size: 13px;
                    font-weight: 600;
                }
                
                /* Stats Grid */
                .message-stats {
                    display: grid;
                    grid-template-columns: repeat(4, 1fr);
                    gap: 20px;
                    margin-bottom: 20px;
                }
                
                .stat-box {
                    background-color: #f9f9f9;
                    padding: 15px;
                    border-radius: 5px;
                    text-align: center;
                }
                
                .stat-value {
                    font-size: 24px;
                    font-weight: 700;
                    color: #2271b1;
                    margin-bottom: 5px;
                }
                
                .stat-label {
                    font-size: 14px;
                    color: #666;
                }
                
                .high-priority .stat-value {
                    color: #d63638;
                }
                
                /* Messages Tab Navigation */
                .message-tabs {
                    display: flex;
                    border-bottom: 1px solid #ddd;
                    margin-bottom: 20px;
                }
                
                .message-tabs .tab {
                    padding: 10px 15px;
                    margin-right: 10px;
                    cursor: pointer;
                    border-bottom: 2px solid transparent;
                    color: #666;
                    text-decoration: none;
                }
                
                .message-tabs .tab.active {
                    border-bottom: 2px solid #2271b1;
                    color: #2271b1;
                    font-weight: 600;
                }
                
                /* Message Items */
                .message-item {
                    display: flex;
                    border: 1px solid #ddd;
                    border-radius: 5px;
                    margin-bottom: 15px;
                    overflow: hidden;
                }
                
                .message-item.unread {
                    border-left: 3px solid #2271b1;
                }
                
                .message-avatar {
                    width: 50px;
                    height: 50px;
                    background-color: #2271b1;
                    color: white;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    font-size: 20px;
                    font-weight: 600;
                    margin: 15px;
                    border-radius: 50%;
                }
                
                .message-content {
                    flex: 1;
                    padding: 15px 15px 15px 0;
                }
                
                .message-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: flex-start;
                    margin-bottom: 10px;
                }
                
                .message-email {
                    font-weight: 600;
                }
                
                .message-meta {
                    display: flex;
                    align-items: center;
                    font-size: 12px;
                    color: #666;
                    margin-top: 5px;
                }
                
                .new-badge {
                    background-color: #2271b1;
                    color: white;
                    padding: 2px 8px;
                    border-radius: 3px;
                    margin-right: 10px;
                    font-size: 11px;
                    text-transform: uppercase;
                }
                
                .message-actions button {
                    margin-left: 5px;
                }
                
                .message-body {
                    color: #555;
                }
                
                .no-messages {
                    text-align: center;
                    padding: 30px;
                    color: #666;
                    background: #f9f9f9;
                    border-radius: 5px;
                }
                
                /* Loading Overlay */
                .loading-overlay {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 100%;
                    height: 100%;
                    background-color: rgba(255, 255, 255, 0.7);
                    display: flex;
                    justify-content: center;
                    align-items: center;
                    z-index: 10;
                }
                
                /* Modal Styles */
                .voicero-modal {
                    display: none;
                    position: fixed;
                    z-index: 9999;
                    left: 0;
                    top: 0;
                    width: 100%;
                    height: 100%;
                    overflow: auto;
                    background-color: rgba(0, 0, 0, 0.4);
                }
                
                .voicero-modal-content {
                    background-color: #fefefe;
                    margin: 10% auto;
                    padding: 20px;
                    border: 1px solid #ddd;
                    width: 60%;
                    max-width: 600px;
                    border-radius: 5px;
                    position: relative;
                }
                
                .voicero-modal-close {
                    position: absolute;
                    right: 15px;
                    top: 10px;
                    font-size: 20px;
                    cursor: pointer;
                }
                
                .form-group {
                    margin-bottom: 15px;
                }
                
                .form-group label {
                    display: block;
                    margin-bottom: 5px;
                    font-weight: 600;
                }
                
                .form-group input,
                .form-group textarea {
                    width: 100%;
                }
                
                .form-actions {
                    text-align: right;
                    margin-top: 20px;
                }
                
                #refresh-messages {
                    margin-left: auto;
                    display: flex;
                    align-items: center;
                }
                
                #refresh-messages .dashicons {
                    margin-right: 5px;
                }
                
                .messages-header {
                    display: flex;
                    justify-content: space-between;
                    align-items: center;
                    margin-bottom: 15px;
                }
                
                .messages-header h2 {
                    margin: 0;
                }
            </style>
        `);
  }
})(jQuery);
