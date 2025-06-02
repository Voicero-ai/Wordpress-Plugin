<?php
/**
 * Front-end functionality for Voicero.AI
 */

if (!defined('ABSPATH')) {
    exit; // Prevent direct access
}

/* ------------------------------------------------------------------------
   1. ADD FRONT-END INTERFACES TO <body>
------------------------------------------------------------------------ */
function voicero_add_toggle_button() {
    $hook = current_filter(); // Get the current hook being used
    
    // Only add the button if the website is active AND synced
    $saved_key = voicero_get_access_key();
    $is_active = false; // Default
    $is_synced = false; // Default

    if ($saved_key) {
        // We need to fetch the status - this is tricky without duplicating the API call.
        // Simplification: Assume if key exists, we *might* add the button,
        // JS will handle showing/hiding based on actual fetched status later.
        // Or better: Check a transient or option set during sync/activation.
        // For now, let's just enqueue scripts regardless and let JS decide to show the button.
    }

    ?>
    <!-- Voicero AI Chat Interface -->
    <div id="voicero-app-container" data-hook="<?php echo esc_attr($hook); ?>">
        <!-- Chat Toggle Button -->
        <button id="voicero-toggle-button" class="voicero-toggle-button" aria-label="<?php esc_attr_e('Chat with AI Assistant', 'voicero-ai'); ?>">
            <div class="voicero-button-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                    <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor"/>
                </svg>
            </div>
            <span class="voicero-button-text"><?php esc_html_e('Chat with AI', 'voicero-ai'); ?></span>
        </button>
        
        <!-- Chat Window -->
        <div id="voicero-chat-window" class="voicero-chat-window">
            <div class="voicero-chat-header">
                <div class="voicero-chat-title">
                    <div class="voicero-logo">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                            <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor"/>
                        </svg>
                    </div>
                    <h3><?php esc_html_e('AI Assistant', 'voicero-ai'); ?></h3>
                </div>
                <div class="voicero-chat-controls">
                    <button class="voicero-minimize-btn" aria-label="<?php esc_attr_e('Minimize', 'voicero-ai'); ?>">
                        <span class="dashicons dashicons-minus"></span>
                    </button>
                    <button class="voicero-close-btn" aria-label="<?php esc_attr_e('Close', 'voicero-ai'); ?>">
                        <span class="dashicons dashicons-no-alt"></span>
                    </button>
                </div>
            </div>
            
            <div class="voicero-chat-body">
                <div class="voicero-messages-container" id="voicero-messages">
                    <!-- Messages will be dynamically added here -->
                    <div class="voicero-message voicero-message-ai">
                        <div class="voicero-message-avatar">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                                <path d="M12 2C6.48 2 2 6.48 2 12C2 17.52 6.48 22 12 22C17.52 22 22 17.52 22 12C22 6.48 17.52 2 12 2ZM12 5C13.66 5 15 6.34 15 8C15 9.66 13.66 11 12 11C10.34 11 9 9.66 9 8C9 6.34 10.34 5 12 5ZM12 19.2C9.5 19.2 7.29 17.92 6 15.98C6.03 13.99 10 12.9 12 12.9C13.99 12.9 17.97 13.99 18 15.98C16.71 17.92 14.5 19.2 12 19.2Z" fill="currentColor"/>
                            </svg>
                        </div>
                        <div class="voicero-message-bubble">
                            <p><?php esc_html_e('Hello! How can I assist you today?', 'voicero-ai'); ?></p>
                        </div>
                    </div>
                </div>
                
                <div class="voicero-chat-input-container">
                    <div class="voicero-input-controls">
                        <button id="voicero-voice-input-btn" class="voicero-voice-btn" aria-label="<?php esc_attr_e('Voice Input', 'voicero-ai'); ?>">
                            <span class="dashicons dashicons-microphone"></span>
                        </button>
                        <textarea id="voicero-chat-input" placeholder="<?php esc_attr_e('Type your message...', 'voicero-ai'); ?>" rows="1"></textarea>
                        <button id="voicero-send-btn" class="voicero-send-btn" aria-label="<?php esc_attr_e('Send Message', 'voicero-ai'); ?>" disabled>
                            <span class="dashicons dashicons-arrow-right-alt2"></span>
                        </button>
                    </div>
                    <div class="voicero-powered-by">
                        <span><?php esc_html_e('Powered by', 'voicero-ai'); ?> </span>
                        <a href="https://voicero.ai" target="_blank" rel="noopener noreferrer">Voicero.AI</a>
                    </div>
                </div>
            </div>
        </div>
    </div>
    <?php
}

// Hook into WordPress to add the button
add_action('wp_body_open', 'voicero_add_toggle_button');
add_action('wp_footer', 'voicero_add_toggle_button', 999);

// Add this near the top of the file after the header
function voicero_get_access_key() {
    return get_option('voicero_access_key', '');
}

// Add this to make the access key and API URL available to frontend scripts
function voicero_enqueue_scripts() {
    // Only enqueue on the frontend, not in admin
    if (!is_admin()) {
        // Get all JS files from the assets/js directory
        $js_dir = plugin_dir_path(__FILE__) . '../assets/js/';
        $js_files = glob($js_dir . '*.js');
        
        // Sort files to ensure core files load first
        usort($js_files, function($a, $b) {
            // Make sure core.js loads first
            if (strpos($a, 'voicero-core.js') !== false) return -1;
            if (strpos($b, 'voicero-core.js') !== false) return 1;
            return strcmp($a, $b);
        });
        
        $loaded_handles = array();
        
        // Track dependencies
        $core_handle = '';
        
        // Load each file except admin.js
        foreach ($js_files as $js_file) {
            $file_name = basename($js_file);
            
            // Skip admin.js
            if ($file_name === 'admin.js') {
                continue;
            }
            
            // Create handle from filename
            $handle = str_replace('.js', '', $file_name) . '-js';
            
            // Determine dependencies
            $deps = ['jquery'];
            
            // Add core as dependency for most files
            if (strpos($file_name, 'voicero-core.js') !== false) {
                $core_handle = $handle;
            } elseif (!empty($core_handle)) {
                $deps[] = $core_handle;
            }
            
            // Special case for text dependency
            if (strpos($file_name, 'voicero-contact.js') !== false && in_array('voicero-text-js', $loaded_handles)) {
                $deps[] = 'voicero-text-js';
            }
            
            // Enqueue the script
            wp_enqueue_script(
                $handle,
                plugin_dir_url(__FILE__) . '../assets/js/' . $file_name,
                $deps,
                '1.1',
                true
            );
            
            $loaded_handles[] = $handle;
        }

        // Get access key
        $access_key = voicero_get_access_key();

        // Pass data to the frontend script
        wp_localize_script('voicero-core-js', 'voiceroConfig', [
            // Removed accessKey for security - now using server-side proxy
            'apiUrl' => VOICERO_API_URL,
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('voicero_frontend_nonce'),
            'pluginUrl' => plugin_dir_url(__FILE__) . '../',
            'debug' => defined('WP_DEBUG') && WP_DEBUG ? true : false,
        ]);

        // For backwards compatibility
        wp_add_inline_script('voicero-core-js', 'window.voiceroConfig = window.voiceroConfig;', 'before');

        // Enqueue the stylesheets
        wp_enqueue_style(
            'dashicons'
        );
        
        wp_enqueue_style(
            'ai-website-style', 
            plugin_dir_url(__FILE__) . '../assets/css/style.css', 
            ['dashicons'], 
            '1.1'
        );
        
        // Add custom inline CSS for the chat interface
        wp_add_inline_style('ai-website-style', voicero_get_custom_css());
        
        voicero_debug_log('Voicero AI scripts enqueued successfully');
    }
}
add_action('wp_enqueue_scripts', 'voicero_enqueue_scripts');

/**
 * Get custom CSS for the chat interface
 */
function voicero_get_custom_css() {
    // Get customization options from settings
    $primary_color = get_option('voicero_primary_color', '#2271b1');
    $text_color = get_option('voicero_text_color', '#ffffff');
    $button_position = get_option('voicero_button_position', 'bottom-right');
    
    // Position variables
    $bottom = '20px';
    $right = '20px';
    $left = 'auto';
    
    if ($button_position === 'bottom-left') {
        $right = 'auto';
        $left = '20px';
    }
    
    // Custom CSS
    return "
        /* Voicero AI Chat Interface */
        :root {
            --voicero-primary: {$primary_color};
            --voicero-text: {$text_color};
            --voicero-light: #f8f9fa;
            --voicero-border: #e0e0e0;
            --voicero-shadow: rgba(0, 0, 0, 0.1);
            --voicero-shadow-hover: rgba(0, 0, 0, 0.2);
            --voicero-ai-msg: #f0f7ff;
            --voicero-user-msg: #e1f5fe;
        }
        
        /* Chat Button */
        .voicero-toggle-button {
            position: fixed;
            bottom: {$bottom};
            right: {$right};
            left: {$left};
            z-index: 999999;
            display: flex;
            align-items: center;
            background-color: var(--voicero-primary);
            color: var(--voicero-text);
            border: none;
            border-radius: 50px;
            padding: 10px 20px;
            font-size: 16px;
            font-weight: 500;
            cursor: pointer;
            box-shadow: 0 4px 12px var(--voicero-shadow);
            transition: all 0.3s ease;
        }
        
        .voicero-toggle-button:hover {
            box-shadow: 0 6px 16px var(--voicero-shadow-hover);
            transform: translateY(-2px);
        }
        
        .voicero-button-icon {
            margin-right: 8px;
            display: flex;
            align-items: center;
        }
        
        /* Chat Window */
        .voicero-chat-window {
            position: fixed;
            bottom: {$bottom};
            right: {$right};
            left: {$left};
            z-index: 999998;
            width: 380px;
            max-width: calc(100vw - 40px);
            height: 600px;
            max-height: calc(100vh - 100px);
            background-color: white;
            border-radius: 10px;
            box-shadow: 0 10px 25px rgba(0, 0, 0, 0.15);
            display: flex;
            flex-direction: column;
            overflow: hidden;
            opacity: 0;
            visibility: hidden;
            transform: translateY(20px);
            transition: all 0.3s ease;
        }
        
        .voicero-chat-window.active {
            opacity: 1;
            visibility: visible;
            transform: translateY(0);
        }
        
        /* Chat Header */
        .voicero-chat-header {
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 15px 20px;
            background-color: var(--voicero-primary);
            color: var(--voicero-text);
            border-top-left-radius: 10px;
            border-top-right-radius: 10px;
        }
        
        .voicero-chat-title {
            display: flex;
            align-items: center;
        }
        
        .voicero-logo {
            margin-right: 10px;
        }
        
        .voicero-chat-title h3 {
            margin: 0;
            font-size: 18px;
            font-weight: 600;
            color: var(--voicero-text);
        }
        
        .voicero-chat-controls {
            display: flex;
            gap: 10px;
        }
        
        .voicero-chat-controls button {
            background: none;
            border: none;
            color: var(--voicero-text);
            padding: 0;
            width: 30px;
            height: 30px;
            border-radius: 50%;
            display: flex;
            align-items: center;
            justify-content: center;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }
        
        .voicero-chat-controls button:hover {
            background-color: rgba(255, 255, 255, 0.2);
        }
        
        /* Chat Body */
        .voicero-chat-body {
            flex: 1;
            display: flex;
            flex-direction: column;
            overflow: hidden;
        }
        
        .voicero-messages-container {
            flex: 1;
            overflow-y: auto;
            padding: 20px;
        }
        
        /* Messages */
        .voicero-message {
            display: flex;
            margin-bottom: 15px;
        }
        
        .voicero-message-ai {
            align-items: flex-start;
        }
        
        .voicero-message-user {
            flex-direction: row-reverse;
        }
        
        .voicero-message-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            background-color: var(--voicero-primary);
            color: var(--voicero-text);
            display: flex;
            align-items: center;
            justify-content: center;
            margin-right: 12px;
            flex-shrink: 0;
        }
        
        .voicero-message-user .voicero-message-avatar {
            margin-right: 0;
            margin-left: 12px;
            background-color: #e0e0e0;
        }
        
        .voicero-message-bubble {
            background-color: var(--voicero-ai-msg);
            padding: 12px 16px;
            border-radius: 18px;
            border-top-left-radius: 4px;
            max-width: 80%;
        }
        
        .voicero-message-user .voicero-message-bubble {
            background-color: var(--voicero-user-msg);
            border-radius: 18px;
            border-top-right-radius: 4px;
        }
        
        .voicero-message-bubble p {
            margin: 0;
            line-height: 1.5;
        }
        
        /* Chat Input */
        .voicero-chat-input-container {
            padding: 15px;
            border-top: 1px solid var(--voicero-border);
            background-color: white;
        }
        
        .voicero-input-controls {
            display: flex;
            align-items: center;
            background-color: var(--voicero-light);
            border-radius: 24px;
            padding: 6px 12px;
        }
        
        .voicero-voice-btn, 
        .voicero-send-btn {
            background: none;
            border: none;
            width: 36px;
            height: 36px;
            display: flex;
            align-items: center;
            justify-content: center;
            border-radius: 50%;
            color: #555;
            cursor: pointer;
            transition: background-color 0.2s ease;
        }
        
        .voicero-voice-btn:hover, 
        .voicero-send-btn:hover {
            background-color: rgba(0, 0, 0, 0.05);
        }
        
        .voicero-send-btn {
            color: var(--voicero-primary);
        }
        
        .voicero-send-btn:disabled {
            color: #ccc;
            cursor: not-allowed;
        }
        
        #voicero-chat-input {
            flex: 1;
            border: none;
            background: none;
            resize: none;
            padding: 8px 0;
            margin: 0 8px;
            outline: none;
            font-family: inherit;
            font-size: 15px;
            line-height: 1.4;
            max-height: 120px;
            min-height: 24px;
        }
        
        .voicero-powered-by {
            text-align: center;
            margin-top: 8px;
            font-size: 12px;
            color: #888;
        }
        
        .voicero-powered-by a {
            color: var(--voicero-primary);
            text-decoration: none;
            font-weight: 500;
        }
        
        /* Admin Dashboard Styles */
        .card {
            width: 100%;
            max-width: 100%;
            box-sizing: border-box;
        }
        
        /* Responsive Adjustments */
        @media (max-width: 480px) {
            .voicero-chat-window {
                width: 100%;
                max-width: 100%;
                height: 100%;
                max-height: 100%;
                bottom: 0;
                right: 0;
                left: 0;
                border-radius: 0;
            }
            
            .voicero-chat-header {
                border-radius: 0;
            }
            
            .voicero-toggle-button {
                width: auto;
                padding: 10px 15px;
            }
            
            .voicero-button-text {
                display: none;
            }
            
            .voicero-toggle-button .voicero-button-icon {
                margin-right: 0;
            }
        }
    ";
}
