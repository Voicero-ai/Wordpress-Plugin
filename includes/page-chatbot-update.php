<?php
// includes/page-chatbot-update.php
if ( ! defined('ABSPATH') ) {
    exit;
}

/**
 * Renders the "Customize AI Chatbot" page.
 * This page allows customization of the chatbot appearance and behavior.
 */
function voicero_render_chatbot_update_page() {
    // First, get the website data from the API
    $access_key = voicero_get_access_key();
    $website_id = '';
    $website_data = array();
    $api_debug = array();
    
    // Get basic website info first to get the ID
    $info_response = wp_remote_post(admin_url('admin-ajax.php'), array(
        'body' => array(
            'action' => 'voicero_get_info',
            'nonce' => wp_create_nonce('voicero_ajax_nonce')
        )
    ));
    
    $api_debug['info_response'] = $info_response;
    
    if (!is_wp_error($info_response) && wp_remote_retrieve_response_code($info_response) === 200) {
        $info_data = json_decode(wp_remote_retrieve_body($info_response), true);
        $api_debug['info_data'] = $info_data;
        
        if (isset($info_data['success']) && $info_data['success'] && !empty($info_data['data']['id'])) {
            $website_id = $info_data['data']['id'];
            
            // Now get detailed website data
            $detailed_response = wp_remote_post(admin_url('admin-ajax.php'), array(
                'body' => array(
                    'action' => 'voicero_websites_get',
                    'nonce' => wp_create_nonce('voicero_ajax_nonce'),
                    'id' => $website_id
                ),
                'timeout' => 30, // Increase timeout for larger responses
            ));
            
            $api_debug['detailed_response'] = $detailed_response;
            
            if (!is_wp_error($detailed_response) && wp_remote_retrieve_response_code($detailed_response) === 200) {
                $response_data = json_decode(wp_remote_retrieve_body($detailed_response), true);
                $api_debug['response_data'] = $response_data;
                
                if (isset($response_data['success']) && $response_data['success']) {
                    $website_data = $response_data['data'];
                    
                    // Log the data to help with debugging
                    error_log('Voicero website data: ' . print_r($website_data, true));
                } else {
                    // Log error
                    error_log('Voicero API error: ' . print_r($response_data, true));
                }
            } else {
                // Log error
                if (is_wp_error($detailed_response)) {
                    error_log('Voicero API error: ' . $detailed_response->get_error_message());
                } else {
                    error_log('Voicero API error: ' . wp_remote_retrieve_response_code($detailed_response));
                }
            }
        }
    }
    
    // Set defaults and then override with API data if available
    $chatbot_name = !empty($website_data['botName']) ? $website_data['botName'] : '';
    $welcome_message = !empty($website_data['customWelcomeMessage']) ? $website_data['customWelcomeMessage'] : '';
    $custom_instructions = !empty($website_data['customInstructions']) ? $website_data['customInstructions'] : '';
    $primary_color = !empty($website_data['color']) ? $website_data['color'] : '#6366F1'; // Default to indigo
    $remove_highlighting = isset($website_data['removeHighlight']) ? (bool)$website_data['removeHighlight'] : false;
    
    // Map API icon types to UI options
    $bot_icon_map = array(
        'MessageIcon' => 'Message',
        'VoiceIcon' => 'Voice',
        'BotIcon' => 'Bot'
    );
    
    $voice_icon_map = array(
        'MicrophoneIcon' => 'Microphone',
        'WaveformIcon' => 'Waveform',
        'SpeakerIcon' => 'Speaker'
    );
    
    $message_icon_map = array(
        'MessageIcon' => 'Message',
        'DocumentIcon' => 'Document',
        'CursorIcon' => 'Cursor'
    );
    
    // Reverse the maps to get from API to UI
    $bot_icon_map_reverse = array_flip($bot_icon_map);
    $voice_icon_map_reverse = array_flip($voice_icon_map);
    $message_icon_map_reverse = array_flip($message_icon_map);
    
    // Default values for icons
    $bot_icon_type = 'Bot';
    $voice_icon_type = 'Microphone';
    $message_icon_type = 'Message';
    
    // Get icon types from API data if available
    if (!empty($website_data['iconBot']) && isset($bot_icon_map[$website_data['iconBot']])) {
        $bot_icon_type = $bot_icon_map[$website_data['iconBot']];
    }
    
    if (!empty($website_data['iconVoice']) && isset($voice_icon_map[$website_data['iconVoice']])) {
        $voice_icon_type = $voice_icon_map[$website_data['iconVoice']];
    }
    
    if (!empty($website_data['iconMessage']) && isset($message_icon_map[$website_data['iconMessage']])) {
        $message_icon_type = $message_icon_map[$website_data['iconMessage']];
    }
    
    // Get suggested questions
    $suggested_questions = !empty($website_data['popUpQuestions']) ? $website_data['popUpQuestions'] : array();
    
    // Get website info
    $website_name = !empty($website_data['name']) ? $website_data['name'] : 'Your Website';
    
    // Format last synced date if available
    $last_synced = 'Never';
    if (!empty($website_data['lastSyncedAt'])) {
        $last_synced_date = new DateTime($website_data['lastSyncedAt']);
        $last_synced = $last_synced_date->format('m/d/Y, h:i:s A');
    }
    
    // SVG Icons for different options
    $svg_icons = array(
        // Voice icons
        'microphone' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z" /></svg>',
        'waveform' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 12h2v3H3v-3zm4-4h2v10H7V8zm4-6h2v22h-2V2zm4 6h2v10h-2V8zm4 4h2v3h-2v-3z" /></svg>',
        'speaker' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M5 9v6h4l5 5V4L9 9H5zm13.54.12a1 1 0 1 0-1.41 1.42 3 3 0 0 1 0 4.24 1 1 0 1 0 1.41 1.41 5 5 0 0 0 0-7.07z" /></svg>',
        
        // Message icons
        'message' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM4 16V4h16v12H5.17L4 17.17V16z" /></svg>',
        'cursor' => '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="24" height="24"><path d="M11 2h2v20h-2z" /></svg>',
        'document' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h16v2H4V4zm0 4h16v2H4V8zm0 4h10v2H4v-2zm0 4h16v2H4v-2z" /></svg>',
        
        // Bot icons
        'bot' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="24" height="24" fill="currentColor"><rect x="12" y="16" width="40" height="32" rx="10" ry="10" stroke="black" stroke-width="2" fill="currentColor" /><circle cx="22" cy="32" r="4" fill="white" /><circle cx="42" cy="32" r="4" fill="white" /><path d="M24 42c4 4 12 4 16 0" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" /><line x1="32" y1="8" x2="32" y2="16" stroke="black" stroke-width="2" /><circle cx="32" cy="6" r="2" fill="black" /></svg>',
        'voice' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M5 9v6h4l5 5V4L9 9H5zm13.54.12a1 1 0 1 0-1.41 1.42 3 3 0 0 1 0 4.24 1 1 0 1 0 1.41 1.41 5 5 0 0 0 0-7.07z" /></svg>',
        
        // Also add capitalized versions to match the UI
        'Bot' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="24" height="24" fill="currentColor"><rect x="12" y="16" width="40" height="32" rx="10" ry="10" stroke="black" stroke-width="2" fill="currentColor" /><circle cx="22" cy="32" r="4" fill="white" /><circle cx="42" cy="32" r="4" fill="white" /><path d="M24 42c4 4 12 4 16 0" stroke="white" stroke-width="2" fill="none" stroke-linecap="round" /><line x1="32" y1="8" x2="32" y2="16" stroke="black" stroke-width="2" /><circle cx="32" cy="6" r="2" fill="black" /></svg>',
        'Voice' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M5 9v6h4l5 5V4L9 9H5zm13.54.12a1 1 0 1 0-1.41 1.42 3 3 0 0 1 0 4.24 1 1 0 1 0 1.41 1.41 5 5 0 0 0 0-7.07z" /></svg>',
        'Message' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M20 2H4a2 2 0 0 0-2 2v18l4-4h14a2 2 0 0 0 2-2V4a2 2 0 0 0-2-2zM4 16V4h16v12H5.17L4 17.17V16z" /></svg>',
        'Microphone' => '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="24" height="24" fill="currentColor"><path d="M12 14a3 3 0 0 0 3-3V5a3 3 0 0 0-6 0v6a3 3 0 0 0 3 3z" /><path d="M19 11a1 1 0 1 0-2 0 5 5 0 0 1-10 0 1 1 0 1 0-2 0 7 7 0 0 0 6 6.92V21h2v-3.08A7 7 0 0 0 19 11z" /></svg>',
        'Waveform' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M3 12h2v3H3v-3zm4-4h2v10H7V8zm4-6h2v22h-2V2zm4 6h2v10h-2V8zm4 4h2v3h-2v-3z" /></svg>',
        'Speaker' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M5 9v6h4l5 5V4L9 9H5zm13.54.12a1 1 0 1 0-1.41 1.42 3 3 0 0 1 0 4.24 1 1 0 1 0 1.41 1.41 5 5 0 0 0 0-7.07z" /></svg>',
        'Document' => '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" fill="currentColor" viewBox="0 0 24 24"><path d="M4 4h16v2H4V4zm0 4h16v2H4V8zm0 4h10v2H4v-2zm0 4h16v2H4v-2z" /></svg>',
        'Cursor' => '<svg xmlns="http://www.w3.org/2000/svg" fill="currentColor" viewBox="0 0 24 24" width="24" height="24"><path d="M11 2h2v20h-2z" /></svg>',
    );
    
    // Pass website data and SVG icons to JavaScript
    wp_localize_script('jquery', 'voiceroChatbotData', $website_data);
    wp_localize_script('jquery', 'voiceroSvgIcons', $svg_icons);
    
    // Debug the website data - output to console
    echo '<script>
    console.log("Website Data received:", ' . json_encode($website_data) . ');
    </script>';
    
    // Debug the SVG icons - output to console
    echo '<script>
    console.log("SVG Icons being passed to JavaScript:", ' . json_encode($svg_icons) . ');
    </script>';
    
    // Enqueue jQuery UI for color picker
    wp_enqueue_script('jquery-ui-core');
    wp_enqueue_script('jquery-ui-widget');
    wp_enqueue_script('jquery-ui-draggable');
    wp_enqueue_script('jquery-ui-mouse');
    wp_enqueue_script('jquery-ui-slider');
    
    ?>
    <div class="wrap voicero-chatbot-page">
        <div class="chatbot-header">
            <a href="<?php echo esc_url(admin_url('admin.php?page=voicero-ai-admin')); ?>" class="back-link">
                <span class="dashicons dashicons-arrow-left-alt"></span> 
                <?php esc_html_e( 'Customize AI Chatbot', 'voicero-ai' ); ?>
            </a>
            <button type="button" id="save-settings-btn" class="button button-primary">
                <?php esc_html_e( 'Save Settings', 'voicero-ai' ); ?>
            </button>
        </div>
        
        <div id="voicero-settings-message"></div>
        
        <form id="voicero-chatbot-form" method="post" action="javascript:void(0);">
            <?php wp_nonce_field( 'voicero_chatbot_nonce', 'voicero_chatbot_nonce' ); ?>
            <input type="hidden" id="website-id" name="website_id" value="<?php echo esc_attr($website_id); ?>">
            
            <!-- Chatbot Identity Section -->
            <div class="voicero-card">
                <div class="voicero-card-header">
                    <div class="card-header-icon">
                        <span class="dashicons dashicons-admin-users"></span>
                    </div>
                    <h2><?php esc_html_e( 'Chatbot Identity', 'voicero-ai' ); ?></h2>
                    <span class="required-badge"><?php esc_html_e( 'Required', 'voicero-ai' ); ?></span>
                </div>
                
                <div class="voicero-card-content">
                    <div class="form-field">
                        <label for="chatbot-name"><?php esc_html_e( 'Chatbot Name', 'voicero-ai' ); ?></label>
                        <input type="text" id="chatbot-name" name="chatbot_name" value="<?php echo esc_attr($chatbot_name); ?>" maxlength="10" required>
                        <p class="field-description"><?php esc_html_e( 'The name displayed to your customers (max 3 words, 10 characters)', 'voicero-ai' ); ?></p>
                    </div>
                    
                    <div class="form-field">
                        <label for="welcome-message"><?php esc_html_e( 'Welcome Message', 'voicero-ai' ); ?></label>
                        <textarea id="welcome-message" name="welcome_message" rows="3"><?php echo esc_textarea($welcome_message); ?></textarea>
                        <p class="field-description"><?php esc_html_e( 'First message shown when a customer opens the chat (max 25 words)', 'voicero-ai' ); ?></p>
                        <div class="word-count" id="welcome-message-count">0/25 words</div>
                    </div>
                    
                    <div class="form-field">
                        <label for="custom-instructions"><?php esc_html_e( 'Custom Instructions', 'voicero-ai' ); ?></label>
                        <textarea id="custom-instructions" name="custom_instructions" rows="5"><?php echo esc_textarea($custom_instructions); ?></textarea>
                        <p class="field-description"><?php esc_html_e( 'Specific instructions for how the AI should behave or respond (max 50 words)', 'voicero-ai' ); ?></p>
                        <div class="word-count" id="custom-instructions-count">0/50 words</div>
                    </div>
                </div>
            </div>
            
            <!-- Suggested Questions Section -->
            <div class="voicero-card">
                <div class="voicero-card-header">
                    <div class="card-header-icon">
                        <span class="dashicons dashicons-editor-help"></span>
                    </div>
                    <h2><?php esc_html_e( 'Suggested Questions', 'voicero-ai' ); ?></h2>
                </div>
                
                <div class="voicero-card-content">
                    <p><?php esc_html_e( 'Add up to 3 suggested questions that will appear as quick options for customers to click.', 'voicero-ai' ); ?></p>
                    
                    <div id="suggested-questions-container">
                        <?php if (empty($suggested_questions)): ?>
                            <div class="no-questions"><?php esc_html_e( 'No suggested questions added yet.', 'voicero-ai' ); ?></div>
                        <?php else: ?>
                            <?php foreach ($suggested_questions as $index => $question): ?>
                                <div class="suggested-question-item" data-index="<?php echo esc_attr($index); ?>">
                                    <input type="text" name="suggested_questions[]" value="<?php echo esc_attr($question); ?>" class="suggested-question-input">
                                    <button type="button" class="remove-question-btn button-link">
                                        <span class="dashicons dashicons-trash"></span>
                                    </button>
                                </div>
                            <?php endforeach; ?>
                        <?php endif; ?>
                    </div>
                    
                    <div class="question-counter"><span id="questions-count"><?php echo count($suggested_questions); ?></span>/3 questions added</div>
                    
                    <div class="add-question-container" <?php echo (count($suggested_questions) >= 3) ? 'style="display:none;"' : ''; ?>>
                        <div class="add-question-field">
                            <input type="text" id="new-question" placeholder="<?php esc_attr_e('Type a question customers might ask...', 'voicero-ai'); ?>">
                            <button type="button" id="add-question-btn" class="button" style="display: flex; align-items: center; justify-content: center;">
                                <span class="dashicons dashicons-plus" style="margin-right: 5px; line-height: 1.2;"></span> <?php esc_html_e( 'Add', 'voicero-ai' ); ?>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
            
            <!-- Appearance Settings Section -->
            <div class="voicero-card">
                <div class="voicero-card-header">
                    <div class="card-header-icon">
                        <span class="dashicons dashicons-admin-appearance"></span>
                    </div>
                    <h2><?php esc_html_e( 'Appearance Settings', 'voicero-ai' ); ?></h2>
                </div>
                
                <div class="voicero-card-content">
                    <div class="form-field">
                        <label><?php esc_html_e( 'Primary Color', 'voicero-ai' ); ?></label>
                        <div class="color-picker-container">
                            <div id="color-picker"></div>
                            <div class="color-value-display" style="margin-left: 15px; display: inline-flex; align-items: center;">
                                <div class="color-preview" style="width: 30px; height: 30px; background: <?php echo esc_attr($primary_color); ?>; border: 1px solid #ddd; border-radius: 3px; display: inline-block;"></div>
                                <input type="text" id="primary-color" name="primary_color" value="<?php echo esc_attr($primary_color); ?>" style="width: 100px; margin-left: 10px; font-family: monospace;" />
                            </div>
                        </div>
                        <p class="field-description"><?php esc_html_e( 'This color will be used for the chatbot button and header', 'voicero-ai' ); ?></p>
                    </div>
                    
                    <div class="form-field checkbox-field">
                        <label>
                            <input type="checkbox" id="remove-highlighting" name="remove_highlighting" value="1" <?php checked($remove_highlighting, true); ?>>
                            <?php esc_html_e( 'Remove highlighting from AI answers', 'voicero-ai' ); ?>
                        </label>
                        <p class="field-description"><?php esc_html_e( 'When enabled, color highlighting will be removed from AI Chooser', 'voicero-ai' ); ?></p>
                    </div>
                    
                    <div class="form-field">
                        <label><?php esc_html_e( 'Bot Icon Type', 'voicero-ai' ); ?></label>
                        <div class="icon-selector">
                            <select id="bot-icon-type" name="bot_icon_type">
                                <option value="Bot" <?php selected($bot_icon_type, 'Bot'); ?>><?php esc_html_e( 'Bot', 'voicero-ai' ); ?></option>
                                <option value="Voice" <?php selected($bot_icon_type, 'Voice'); ?>><?php esc_html_e( 'Voice', 'voicero-ai' ); ?></option>
                                <option value="Message" <?php selected($bot_icon_type, 'Message'); ?>><?php esc_html_e( 'Message', 'voicero-ai' ); ?></option>
                            </select>
                            <div class="icon-preview bot-icon">
                                <?php 
                                // Try both capitalized and lowercase version
                                if (isset($svg_icons[$bot_icon_type])) {
                                    echo $svg_icons[$bot_icon_type];
                                } elseif (isset($svg_icons[strtolower($bot_icon_type)])) {
                                    echo $svg_icons[strtolower($bot_icon_type)];
                                } else {
                                    echo '<span class="dashicons dashicons-admin-generic"></span>';
                                }
                                ?>
                            </div>
                        </div>
                        <p class="field-description"><?php esc_html_e( 'Icon displayed for the chatbot', 'voicero-ai' ); ?></p>
                    </div>
                    
                    <div class="form-field">
                        <label><?php esc_html_e( 'Voice Icon Type', 'voicero-ai' ); ?></label>
                        <div class="icon-selector">
                            <select id="voice-icon-type" name="voice_icon_type">
                                <option value="Microphone" <?php selected($voice_icon_type, 'Microphone'); ?>><?php esc_html_e( 'Microphone', 'voicero-ai' ); ?></option>
                                <option value="Waveform" <?php selected($voice_icon_type, 'Waveform'); ?>><?php esc_html_e( 'Waveform', 'voicero-ai' ); ?></option>
                                <option value="Speaker" <?php selected($voice_icon_type, 'Speaker'); ?>><?php esc_html_e( 'Speaker', 'voicero-ai' ); ?></option>
                            </select>
                            <div class="icon-preview voice-icon">
                                <?php 
                                // Try both capitalized and lowercase version
                                if (isset($svg_icons[$voice_icon_type])) {
                                    echo $svg_icons[$voice_icon_type];
                                } elseif (isset($svg_icons[strtolower($voice_icon_type)])) {
                                    echo $svg_icons[strtolower($voice_icon_type)];
                                } else {
                                    echo '<span class="dashicons dashicons-admin-generic"></span>';
                                }
                                ?>
                            </div>
                        </div>
                        <p class="field-description"><?php esc_html_e( 'Icon displayed for voice input', 'voicero-ai' ); ?></p>
                    </div>
                    
                    <div class="form-field">
                        <label><?php esc_html_e( 'Message Icon Type', 'voicero-ai' ); ?></label>
                        <div class="icon-selector">
                            <select id="message-icon-type" name="message_icon_type">
                                <option value="Message" <?php selected($message_icon_type, 'Message'); ?>><?php esc_html_e( 'Message', 'voicero-ai' ); ?></option>
                                <option value="Document" <?php selected($message_icon_type, 'Document'); ?>><?php esc_html_e( 'Document', 'voicero-ai' ); ?></option>
                                <option value="Cursor" <?php selected($message_icon_type, 'Cursor'); ?>><?php esc_html_e( 'Cursor', 'voicero-ai' ); ?></option>
                            </select>
                            <div class="icon-preview message-icon">
                                <?php 
                                // Try both capitalized and lowercase version
                                if (isset($svg_icons[$message_icon_type])) {
                                    echo $svg_icons[$message_icon_type];
                                } elseif (isset($svg_icons[strtolower($message_icon_type)])) {
                                    echo $svg_icons[strtolower($message_icon_type)];
                                } else {
                                    echo '<span class="dashicons dashicons-admin-generic"></span>';
                                }
                                ?>
                            </div>
                        </div>
                        <p class="field-description"><?php esc_html_e( 'Icon displayed for chat messages', 'voicero-ai' ); ?></p>
                    </div>
                </div>
            </div>
            
           
        </form>
        
        <!-- Include the JS file -->
        <script type="text/javascript" src="<?php echo esc_url(plugin_dir_url(__FILE__) . '../assets/js/admin/voicero-chatbot.js'); ?>"></script>
    </div>
    <?php
}

// Register the AJAX handler for "voicero_trigger_chatbot_update":
add_action( 'wp_ajax_voicero_trigger_chatbot_update', function() {
    if ( ! check_admin_referer( 'voicero_update_chatbot_nonce', 'nonce' ) ) {
        wp_send_json_error( [ 'message' => __( 'Invalid nonce', 'voicero-ai' ) ] );
    }

    // 1) Check capability
    if ( ! current_user_can( 'manage_options' ) ) {
        wp_send_json_error( [ 'message' => __( 'Insufficient permissions', 'voicero-ai' ) ] );
    }

    // 2) Fetch access key
    $access_key = get_option( 'voicero_access_key', '' );
    if ( empty( $access_key ) ) {
        wp_send_json_error( [ 'message' => __( 'No access key configured.', 'voicero-ai' ) ] );
    }

    // 3) Fire off your remote API call to trigger chatbot update:
    $response = wp_remote_post( VOICERO_API_URL . '/wordpress/update-chatbot', [
        'headers'  => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type'  => 'application/json',
            'Accept'        => 'application/json',
        ],
        'body'     => json_encode( [ 'websiteId' => get_option( 'voicero_website_id', '' ) ] ), // adjust as needed
        'timeout'  => 30,
        'sslverify'=> false,
    ] );
    if ( is_wp_error( $response ) ) {
        wp_send_json_error( [ 'message' => __( 'API request failed: ', 'voicero-ai' ) . $response->get_error_message() ] );
    }

    $code = wp_remote_retrieve_response_code( $response );
    $body = wp_remote_retrieve_body( $response );
    if ( $code !== 200 ) {
        wp_send_json_error( [ 'message' => sprintf( __( 'Server returned %d', 'voicero-ai' ), $code ) ] );
    }

    wp_send_json_success();
} );

// Register the AJAX handler for "voicero_save_chatbot_settings":
add_action('wp_ajax_voicero_save_chatbot_settings', function() {
    if (!check_admin_referer('voicero_chatbot_nonce', 'nonce')) {
        wp_send_json_error(['message' => __('Invalid nonce', 'voicero-ai')]);
    }

    // Check capability
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => __('Insufficient permissions', 'voicero-ai')]);
    }

    // Get settings from request
    $settings = isset($_POST['settings']) ? $_POST['settings'] : [];
    
    if (empty($settings)) {
        wp_send_json_error(['message' => __('No settings provided', 'voicero-ai')]);
    }
    
    // Map UI icon types to API icon types
    $bot_icon_map = [
        'Bot' => 'BotIcon',
        'Voice' => 'VoiceIcon',
        'Message' => 'MessageIcon'
    ];
    
    $voice_icon_map = [
        'Microphone' => 'MicrophoneIcon',
        'Waveform' => 'WaveformIcon',
        'Speaker' => 'SpeakerIcon'
    ];
    
    $message_icon_map = [
        'Message' => 'MessageIcon',
        'Document' => 'DocumentIcon',
        'Cursor' => 'CursorIcon'
    ];
    
    // Format data for API
    $api_data = [
        'websiteId' => isset($settings['websiteId']) ? sanitize_text_field($settings['websiteId']) : '',
        'botName' => isset($settings['chatbot_name']) ? sanitize_text_field($settings['chatbot_name']) : '',
        'customWelcomeMessage' => isset($settings['welcome_message']) ? sanitize_textarea_field($settings['welcome_message']) : '',
        'customInstructions' => isset($settings['custom_instructions']) ? sanitize_textarea_field($settings['custom_instructions']) : '',
        'color' => isset($settings['primary_color']) ? sanitize_text_field($settings['primary_color']) : '',
        'removeHighlight' => isset($settings['remove_highlighting']) ? (bool) $settings['remove_highlighting'] : false,
        'iconBot' => isset($settings['bot_icon_type']) && isset($bot_icon_map[$settings['bot_icon_type']]) ? 
            $bot_icon_map[$settings['bot_icon_type']] : 'BotIcon',
        'iconVoice' => isset($settings['voice_icon_type']) && isset($voice_icon_map[$settings['voice_icon_type']]) ? 
            $voice_icon_map[$settings['voice_icon_type']] : 'MicrophoneIcon',
        'iconMessage' => isset($settings['message_icon_type']) && isset($message_icon_map[$settings['message_icon_type']]) ? 
            $message_icon_map[$settings['message_icon_type']] : 'MessageIcon',
        'popUpQuestions' => isset($settings['suggested_questions']) && is_array($settings['suggested_questions']) ? 
            array_map('sanitize_text_field', $settings['suggested_questions']) : []
    ];
    
    // Store settings in WordPress for fallback
    update_option('voicero_chatbot_name', $api_data['botName']);
    update_option('voicero_welcome_message', $api_data['customWelcomeMessage']);
    update_option('voicero_custom_instructions', $api_data['customInstructions']);
    update_option('voicero_primary_color', $api_data['color']);
    update_option('voicero_remove_highlighting', $api_data['removeHighlight']);
    
    // Get UI icon types for storage
    $bot_icon_type = isset($settings['bot_icon_type']) ? sanitize_text_field($settings['bot_icon_type']) : 'bot';
    $voice_icon_type = isset($settings['voice_icon_type']) ? sanitize_text_field($settings['voice_icon_type']) : 'microphone';
    $message_icon_type = isset($settings['message_icon_type']) ? sanitize_text_field($settings['message_icon_type']) : 'message';
    
    update_option('voicero_bot_icon_type', $bot_icon_type);
    update_option('voicero_voice_icon_type', $voice_icon_type);
    update_option('voicero_message_icon_type', $message_icon_type);
    update_option('voicero_suggested_questions', $api_data['popUpQuestions']);
    
    // Update last synced timestamp
    update_option('voicero_last_synced', current_time('m/d/Y, h:i:s A'));
    
    // Send settings to the remote API
    $access_key = get_option('voicero_access_key', '');
    if (!empty($access_key)) {
        $response = wp_remote_post(VOICERO_API_URL . '/websites/update', [
            'headers' => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json',
            ],
            'body' => json_encode($api_data),
            'timeout' => 30,
            'sslverify' => false,
        ]);
        
        if (is_wp_error($response)) {
            // Save settings locally even if API call fails
            wp_send_json_success(['message' => __('Settings saved locally, but API update failed: ', 'voicero-ai') . $response->get_error_message()]);
            return;
        }
        
        $code = wp_remote_retrieve_response_code($response);
        if ($code !== 200) {
            // Save settings locally even if API returns error
            wp_send_json_success(['message' => __('Settings saved locally, but API returned error code: ', 'voicero-ai') . $code]);
            return;
        }
    }
    
    wp_send_json_success(['message' => __('Chatbot settings saved successfully', 'voicero-ai')]);
});
