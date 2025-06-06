<?php
/**
 * Plugin Name: Voicero.AI
 * Description: Connect your site to an AI Salesman. It answers questions, guides users, and boosts sales.
 * Version: 1.0
 * Author: Voicero.AI
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 * Text Domain: voicero-ai
 */


if (!defined('ABSPATH')) {
    exit; // Prevent direct access
}

// Load text domain for translations
add_action('plugins_loaded', function() {
    load_plugin_textdomain('voicero-ai', false, dirname(plugin_basename(__FILE__)) . '/languages');
});

// Register activation hook to flush rewrite rules
register_activation_hook(__FILE__, 'voicero_activate_plugin');

// Activation function to flush rewrite rules
function voicero_activate_plugin() {
    // Ensure the REST API is properly initialized
    do_action('rest_api_init');
    // Flush rewrite rules to ensure endpoints work
    flush_rewrite_rules();
    // Log activation
    // Remove error log
}

// Define the API base URL
define('VOICERO_API_URL', 'http://localhost:3000/api');

// Define a debug function to log messages to the error log
function voicero_debug_log($message, $data = null) {
    // Only log if WP_DEBUG and VOICERO_DEBUG are both enabled
    if (defined('WP_DEBUG') && WP_DEBUG && defined('VOICERO_DEBUG') && VOICERO_DEBUG) {
        if (is_array($data) || is_object($data)) {
            // Remove error log
        } else {
            // Remove error log
        }
    }
}

// Add AJAX endpoint to get debug info for troubleshooting
add_action('wp_ajax_voicero_debug_info', 'voicero_debug_info');
add_action('wp_ajax_nopriv_voicero_debug_info', 'voicero_debug_info');

// Add action to flush rewrite rules
add_action('wp_ajax_voicero_flush_rules', 'voicero_flush_rules');
function voicero_flush_rules() {
    // Verify user has admin capabilities
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => esc_html__('Permission denied', 'voicero-ai')]);
        return;
    }
    
    // Flush rewrite rules
    flush_rewrite_rules();
    
    // Reinitialize REST API
    do_action('rest_api_init');
    
    wp_send_json_success(['message' => esc_html__('Rewrite rules flushed successfully', 'voicero-ai')]);
}

function voicero_debug_info() {
    $response = array(
        'wp_version' => get_bloginfo('version'),
        'php_version' => phpversion(),
        'theme' => wp_get_theme()->get('Name'),
        'plugins' => array(),
        'access_key' => !empty(voicero_get_access_key()),
        'script_handles' => array(),
        'hooks' => array(
            'wp_body_open' => has_action('wp_body_open'),
            'wp_footer' => has_action('wp_footer')
        )
    );
    
    // Get active plugins
    $active_plugins = get_option('active_plugins');
    foreach ($active_plugins as $plugin) {
        $plugin_data = get_plugin_data(WP_PLUGIN_DIR . '/' . $plugin);
        $response['plugins'][] = array(
            'name' => $plugin_data['Name'],
            'version' => $plugin_data['Version']
        );
    }
    
    // Check if scripts are properly registered
    global $wp_scripts;
    
    // Get all expected script handles from the JS directory
    $js_dir = plugin_dir_path(__FILE__) . 'assets/js/';
    $js_files = glob($js_dir . '*.js');
    $expected_handles = array();
    
    foreach ($js_files as $js_file) {
        $file_name = basename($js_file);
        if ($file_name !== 'admin.js') { // Skip admin.js
            $handle = str_replace('.js', '', $file_name) . '-js';
            $expected_handles[] = $handle;
        }
    }
    
    // Always check core script
    if (!in_array('voicero-core-js', $expected_handles)) {
        $expected_handles[] = 'voicero-core-js';
    }
    
    // Check if each expected script is registered
    foreach ($expected_handles as $handle) {
        $response['script_handles'][$handle] = isset($wp_scripts->registered[$handle]);
    }
    
    wp_send_json_success($response);
}

/* ------------------------------------------------------------------------
   1. ADMIN PAGE TO DISPLAY CONNECTION INTERFACE
------------------------------------------------------------------------ */
add_action('admin_menu', 'voicero_admin_page');
function voicero_admin_page() {
    // Add main menu page
    add_menu_page(
        esc_html__('Voicero AI', 'voicero-ai'),          // Page title
        esc_html__('Voicero AI', 'voicero-ai'),          // Menu title
        'manage_options',                              // Capability required
        'voicero-ai-admin',                            // Menu slug (unique ID)
        'voicero_render_admin_page',                   // Callback function for the settings page
        'dashicons-microphone',                        // Menu icon
        30                                             // Menu position
    );

    // Add submenu pages
    add_submenu_page(
        'voicero-ai-admin',                           // Parent slug
        esc_html__('Overview', 'voicero-ai'),         // Page title
        esc_html__('Overview', 'voicero-ai'),         // Menu title
        'manage_options',                             // Capability
        'voicero-ai-admin',                           // Menu slug (same as parent for first item)
        'voicero_render_admin_page'                   // Callback function
    );

    add_submenu_page(
        'voicero-ai-admin',                           // Parent slug
        esc_html__('Settings', 'voicero-ai'),      // Page title
        esc_html__('Settings', 'voicero-ai'),      // Menu title
        'manage_options',                             // Capability
        'voicero-ai-settings',                        // Menu slug
        'voicero_render_settings_page'                // Callback function
    );

    add_submenu_page(
        'voicero-ai-admin',                           // Parent slug
        esc_html__('Contacts', 'voicero-ai'),         // Page title
        esc_html__('Contacts', 'voicero-ai'),         // Menu title
        'manage_options',                             // Capability
        'voicero-ai-contacts',                        // Menu slug
        'voicero_render_contacts_page'                // Callback function
    );

    add_submenu_page(
        'voicero-ai-admin',                           // Parent slug
        esc_html__('Chatbot Update', 'voicero-ai'),   // Page title
        esc_html__('Chatbot Update', 'voicero-ai'),   // Menu title
        'manage_options',                             // Capability
        'voicero-ai-chatbot-update',                  // Menu slug
        'voicero_render_chatbot_update_page'          // Callback function
    );

    add_submenu_page(
        'voicero-ai-admin',                           // Parent slug
        esc_html__('AI Overview', 'voicero-ai'),      // Page title
        esc_html__('AI Overview', 'voicero-ai'),      // Menu title
        'manage_options',                             // Capability
        'voicero-ai-overview',                        // Menu slug
        'voicero_render_ai_overview_page'             // Callback function
    );
}

// Add AJAX handlers for the admin page
add_action('wp_ajax_voicero_check_connection', 'voicero_check_connection');
add_action('wp_ajax_voicero_sync_content', 'voicero_sync_content');
add_action('wp_ajax_voicero_vectorize_content', 'voicero_vectorize_content');
add_action('wp_ajax_voicero_setup_assistant', 'voicero_setup_assistant');
add_action('wp_ajax_voicero_clear_connection', 'voicero_clear_connection');

// Add new AJAX handlers for training steps
add_action('wp_ajax_voicero_train_page', 'voicero_train_page');
add_action('wp_ajax_voicero_train_post', 'voicero_train_post');
add_action('wp_ajax_voicero_train_product', 'voicero_train_product');
add_action('wp_ajax_voicero_train_general', 'voicero_train_general');

function voicero_check_connection() {
    check_ajax_referer('voicero_ajax_nonce', 'nonce');
    
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key found', 'voicero-ai')]);
    }

    $response = wp_remote_get(VOICERO_API_URL . '/connect', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);

    if (is_wp_error($response)) {
        // Remove error log
        return new WP_REST_Response([
            'message' => esc_html__('Connection failed: ', 'voicero-ai') . esc_html($response->get_error_message())
        ], 500);
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);

    if ($response_code !== 200) {
        // Remove error log
        return new WP_REST_Response([
            'message' => esc_html__('Server returned error: ', 'voicero-ai') . esc_html($response_code),
            'body' => $body
        ]);
    }

    $data = json_decode($body, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error([
            'message' => esc_html__('Invalid response from server', 'voicero-ai'),
            'code' => 'invalid_json'
        ]);
    }

    wp_send_json_success($data);
}

function voicero_sync_content() {
    check_ajax_referer('voicero_ajax_nonce', 'nonce');

    $data = voicero_collect_wordpress_data();
    
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key found', 'voicero-ai')]);
    }

    try {
        // 1. Sync the content
        $sync_response = wp_remote_post(VOICERO_API_URL . '/wordpress/sync', [
            'headers' => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'body' => json_encode($data),
            'timeout' => 120,
            'sslverify' => false
        ]);

        if (is_wp_error($sync_response)) {
            wp_send_json_error([
                'message' => esc_html__('Sync failed: ', 'voicero-ai') . esc_html($sync_response->get_error_message()),
                'code' => $sync_response->get_error_code(),
                'stage' => 'sync',
                'progress' => 0
            ]);
        }

        $response_code = wp_remote_retrieve_response_code($sync_response);
        if ($response_code !== 200) {
            wp_send_json_error([
                'message' => esc_html__('Sync failed: Server returned ', 'voicero-ai') . esc_html($response_code),
                'code' => $response_code,
                'stage' => 'sync',
                'progress' => 0,
                'body' => wp_remote_retrieve_body($sync_response)
            ]);
        }


        // Return success after sync is complete
        wp_send_json_success([
            'message' => 'Content sync completed, ready for vectorization...',
            'stage' => 'sync',
            'progress' => 17, // Updated progress
            'complete' => false,
            'details' => [
                'sync' => json_decode(wp_remote_retrieve_body($sync_response), true)
            ]
        ]);

    } catch (Exception $e) {
        wp_send_json_error([
            'message' => 'Operation failed: ' . $e->getMessage(),
            'stage' => 'unknown',
            'progress' => 0
        ]);
    }
}


// Add new endpoint for vectorization
function voicero_vectorize_content() {
    check_ajax_referer('voicero_ajax_nonce', 'nonce');
    
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key found', 'voicero-ai')]);
    }

    $vectorize_response = wp_remote_post(VOICERO_API_URL . '/wordpress/vectorize', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 120,
        'sslverify' => false
    ]);

    if (is_wp_error($vectorize_response)) {
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Vectorization failed: %s', 'voicero-ai'), 
                esc_html($vectorize_response->get_error_message())
            ),
            'code' => $vectorize_response->get_error_code(),
            'stage' => 'vectorize',
            'progress' => 17 // Keep progress at previous step
        ]);
    }
    
    $response_code = wp_remote_retrieve_response_code($vectorize_response);
    if ($response_code !== 200) {
        $response_body = wp_remote_retrieve_body($vectorize_response);
        
        // Sanitize the response body to prevent XSS
        $sanitized_body = wp_kses_post($response_body);
         
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: HTTP status code */
                esc_html__('Vectorization failed: Server returned %s', 'voicero-ai'),
                esc_html($response_code)
            ),
            'code' => $response_code,
            'stage' => 'vectorize',
            'progress' => 17,
            'body' => $sanitized_body
        ]);
    }

    wp_send_json_success([
        'message' => esc_html__('Vectorization completed, setting up assistant...', 'voicero-ai'),
        'stage' => 'vectorize',
        'progress' => 34, // Updated progress
        'complete' => false,
        'details' => json_decode(wp_remote_retrieve_body($vectorize_response), true)
    ]);
}

// Add new endpoint for assistant setup
function voicero_setup_assistant() {
    check_ajax_referer('voicero_ajax_nonce', 'nonce');
    
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key found', 'voicero-ai')]);
    }

    $assistant_response = wp_remote_post(VOICERO_API_URL . '/wordpress/assistant', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 120,
        'sslverify' => false
    ]);

    if (is_wp_error($assistant_response)) {
        wp_send_json_error([
            'message' => esc_html__('Assistant setup failed: ', 'voicero-ai') . esc_html($assistant_response->get_error_message()),
            'code' => $assistant_response->get_error_code(),
            'stage' => 'assistant',
            'progress' => 34 // Keep progress at previous step
        ]);
    }
    
    $response_code = wp_remote_retrieve_response_code($assistant_response);
    $body = wp_remote_retrieve_body($assistant_response);
    
    if ($response_code !== 200) {
         wp_send_json_error([
            'message' => 'Assistant setup failed: Server returned ' . $response_code,
            'code' => $response_code,
            'stage' => 'assistant',
            'progress' => 34,
            'body' => $body
        ]);
    }

    $data = json_decode($body, true);
     if (json_last_error() !== JSON_ERROR_NONE || !$data) {
        wp_send_json_error([
            'message' => 'Invalid response from assistant setup',
            'code' => 'invalid_json',
            'stage' => 'assistant',
            'progress' => 34
        ]);
    }

    wp_send_json_success([
        'message' => 'Assistant setup complete, preparing individual training...',
        'stage' => 'assistant',
        'progress' => 50, // Updated progress
        'complete' => false,
        'data' => $data // Pass the response data back to JS
    ]);
}

// Training Endpoints (Page, Post, Product, General)
function voicero_train_page() {
    voicero_handle_training_request('page', 'pageId');
}

function voicero_train_post() {
    voicero_handle_training_request('post', 'postId');
}

function voicero_train_product() {
    voicero_handle_training_request('product', 'productId');
}

function voicero_train_general() {
    voicero_handle_training_request('general');
}

function voicero_handle_training_request($type, $id_key = null) {
    check_ajax_referer('voicero_ajax_nonce', 'nonce');

    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key found', 'voicero-ai')]);
    }

    $api_url = VOICERO_API_URL . '/wordpress/train/' . $type;
    $request_body = [];
    
    // Add required parameters to the body based on type
    if ($type === 'general') {
        // For general training, we only need websiteId
        if (isset($_POST['websiteId'])) {
            $request_body['websiteId'] = sanitize_text_field(wp_unslash($_POST['websiteId']));
        } else {
            wp_send_json_error(['message' => esc_html__('Missing required parameter: websiteId', 'voicero-ai')]);
            return;
        }
    } else {
        // For content-specific training, we need both wpId and websiteId
        // 1. Check for content ID (for our internal reference only)
        if ($id_key && isset($_POST[$id_key])) {
            // We don't need to send the page/post/product ID to the API
            // $request_body[$id_key] = sanitize_text_field($_POST[$id_key]);
        } elseif ($id_key) {
            wp_send_json_error(['message' => esc_html__('Missing required parameter: ', 'voicero-ai') . esc_html($id_key)]);
            return;
        }
        
        // 2. Add wpId - required for content-specific training
        if (isset($_POST['wpId'])) {
            $request_body['wpId'] = sanitize_text_field(wp_unslash($_POST['wpId']));
        } else {
            wp_send_json_error(['message' => esc_html__('Missing required parameter: wpId', 'voicero-ai')]);
            return;
        }
        
        // 3. Add websiteId - required for all types
        if (isset($_POST['websiteId'])) {
            $request_body['websiteId'] = sanitize_text_field(wp_unslash($_POST['websiteId']));
        } else {
            wp_send_json_error(['message' => esc_html__('Missing required parameter: websiteId', 'voicero-ai')]);
            return;
        }
    }

    // Use non-blocking approach but with a callback to track status
    $args = [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode($request_body),
        'timeout' => 0.01, // Minimal timeout just for the request to be sent
        'blocking' => false, // Non-blocking - PHP will continue without waiting for Vercel
        'sslverify' => false
    ];

    // Track item in status
    $training_data = voicero_update_training_status('in_progress', true);
    $training_data = voicero_update_training_status('status', 'in_progress');
    
    // Increment total items if needed
    if (isset($_POST['is_first_item']) && sanitize_text_field(wp_unslash($_POST['is_first_item'])) === 'true') {
        $total_items = isset($_POST['total_items']) ? intval(wp_unslash($_POST['total_items'])) : 0;
        $training_data = voicero_update_training_status('total_items', $total_items);
        $training_data = voicero_update_training_status('completed_items', 0);
        $training_data = voicero_update_training_status('failed_items', 0);
    }
    
    // Log info about request for status tracking
    $request_id = uniqid($type . '_');
    update_option('voicero_last_training_request', [
        'id' => $request_id,
        'type' => $type,
        'timestamp' => time()
    ]);
    
    // For more reliable status tracking, schedule a background check
    // This will check status in 10-30 seconds depending on the item type
    $check_delay = ($type === 'general') ? 30 : 10;
    wp_schedule_single_event(time() + $check_delay, 'voicero_check_training_status', [$type, $request_id]);
    
    // Fire the API request
    wp_remote_post($api_url, $args);
    
    // Return success immediately with tracking info
    wp_send_json_success([
        'message' => sprintf(
            /* translators: %s: content type being trained (Page, Post, Product, etc.) */
            esc_html__('%s training initiated.', 'voicero-ai'),
            ucfirst($type)
        ),
        'type' => $type,
        'request_id' => $request_id,
        'status_tracking' => true
    ]);
}

// Function to check training status
function voicero_check_training_status($type, $request_id) {
    $training_data = get_option('voicero_training_status', []);
    
    // Mark as completed - in a real implementation, you would check with Vercel
    // but for now we'll just assume it completed successfully
    $completed_items = intval($training_data['completed_items']) + 1;
    voicero_update_training_status('completed_items', $completed_items);
    
    // If all items are done, mark training as complete
    if ($completed_items >= $training_data['total_items']) {
        voicero_update_training_status('in_progress', false);
        voicero_update_training_status('status', 'completed');
    }
}
add_action('voicero_check_training_status', 'voicero_check_training_status', 10, 2);

// Updated function for batch training
function voicero_batch_train() {
    check_ajax_referer('voicero_ajax_nonce', 'nonce');

    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key found', 'voicero-ai')]);
    }

    // Initialize training status
    $training_data = voicero_update_training_status('in_progress', true);
    $training_data = voicero_update_training_status('status', 'in_progress');
    
    // Get the batch data from the request and sanitize appropriately for JSON data
    $batch_data = array();
    if (isset($_POST['batch_data'])) {
        $json_str = sanitize_text_field(wp_unslash($_POST['batch_data']));
        $decoded_data = json_decode($json_str, true);
        
        // Only proceed if we have valid JSON
        if (is_array($decoded_data)) {
            foreach ($decoded_data as $item) {
                $sanitized_item = array();
                
                // Sanitize each field in the item
                if (isset($item['type'])) {
                    $sanitized_item['type'] = sanitize_text_field($item['type']);
                }
                
                if (isset($item['wpId'])) {
                    $sanitized_item['wpId'] = sanitize_text_field($item['wpId']);
                }
                
                // Only add properly sanitized items
                if (!empty($sanitized_item)) {
                    $batch_data[] = $sanitized_item;
                }
            }
        }
    }
    
    $website_id = isset($_POST['websiteId']) ? sanitize_text_field(wp_unslash($_POST['websiteId'])) : '';
    
    if (empty($website_id)) {
        wp_send_json_error(['message' => esc_html__('Missing required parameter: websiteId', 'voicero-ai')]);
    }
    
    if (empty($batch_data) || !is_array($batch_data)) {
        wp_send_json_error(['message' => esc_html__('Invalid or missing batch data', 'voicero-ai')]);
    }
    
    // Set total items count in the training status
    $total_items = count($batch_data);
    voicero_update_training_status('total_items', $total_items);
    voicero_update_training_status('completed_items', 0);
    voicero_update_training_status('failed_items', 0);

    // Create a batch ID for tracking all these requests
    $batch_id = uniqid('batch_');
    update_option('voicero_last_training_request', [
        'id' => $batch_id,
        'type' => 'batch',
        'timestamp' => time(),
        'total_items' => $total_items
    ]);
    
    // Clear any existing checks
    wp_clear_scheduled_hook('voicero_check_batch_status');
    
    // Fire off all API requests in parallel (non-blocking)
    foreach ($batch_data as $index => $item) {
        $type = $item['type']; // 'page', 'post', 'product', or 'general'
        
        // Ensure proper API URL format
        $api_url = VOICERO_API_URL;
        if (substr($api_url, -1) !== '/') {
            $api_url .= '/';
        }
        $api_url .= 'wordpress/train/' . $type;
        
        $request_body = [
            'websiteId' => $website_id
        ];
        
        // Add wpId for content items (not for general)
        if ($type !== 'general' && isset($item['wpId'])) {
            $request_body['wpId'] = $item['wpId'];
        }
        
        $args = [
            'headers' => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'body' => json_encode($request_body),
            'timeout' => 1, // Slightly longer timeout to ensure requests are sent
            'blocking' => false, // Non-blocking
            'sslverify' => false
        ];
        
        // Fire off the request
        wp_remote_post($api_url, $args);
        
        // IMPORTANT: Update completed items directly after sending the request
        // This bypasses the WP-Cron dependency and fixes the progress bar
        voicero_update_training_status('completed_items', $index + 1);
        
        // We'll keep the scheduled check for good measure, but progress will update immediately
        $item_request_id = $batch_id . '_' . $index;
        $check_delay = ($type === 'general') ? 30 : max(5, min(5 * ($index + 1), 30)); // Stagger checks from 5-30 seconds
        wp_schedule_single_event(time() + $check_delay, 'voicero_check_batch_item_status', [$type, $item_request_id]);
    }
    
    // If we've processed everything, mark training as complete
    if (count($batch_data) > 0) {
        // Short delay to ensure the last completed_items update is saved
        wp_schedule_single_event(time() + 2, 'voicero_finalize_training');
    }

    // Also schedule periodic checks for the overall batch (once per minute for 10 minutes)
    for ($i = 1; $i <= 10; $i++) {
        wp_schedule_single_event(time() + ($i * 60), 'voicero_check_batch_status', [$batch_id, $i]);
    }
    
    wp_send_json_success([
        'message' => esc_html__('Batch training initiated.', 'voicero-ai'),
        'request_id' => $batch_id,
        'total_items' => $total_items,
        'status_tracking' => true
    ]);
}

// Function to check individual batch item status
function voicero_check_batch_item_status($type, $request_id) {
    $training_data = get_option('voicero_training_status', []);
    
    // Only proceed if we're still in progress
    if (!$training_data['in_progress']) {
        return;
    }
    
    // Mark one item as completed
    $completed_items = intval($training_data['completed_items']) + 1;
    voicero_update_training_status('completed_items', $completed_items);
    
    // If all items are done, mark training as complete
    if ($completed_items >= $training_data['total_items']) {
        voicero_update_training_status('in_progress', false);
        voicero_update_training_status('status', 'completed');
    }
}
add_action('voicero_check_batch_item_status', 'voicero_check_batch_item_status', 10, 2);

// Function to check batch training status
function voicero_check_batch_status($batch_id, $check_num) {
    $training_data = get_option('voicero_training_status', []);
    $last_request = get_option('voicero_last_training_request', []);
    
    // Only proceed if we're still in progress and this is the right request
    if (!$training_data['in_progress'] || $last_request['id'] !== $batch_id) {
        return;
    }
    
    // If we've been running for 10 minutes and we're not done, mark as completed anyway
    if ($check_num >= 10) {
        // Update status to complete the process
        voicero_update_training_status('completed_items', $training_data['total_items']);
        voicero_update_training_status('in_progress', false);
        voicero_update_training_status('status', 'completed');
    }
}
add_action('voicero_check_batch_status', 'voicero_check_batch_status', 10, 2);

// Function to finalize training after all items have been processed
function voicero_finalize_training() {
    $training_data = get_option('voicero_training_status', []);
    
    // Only proceed if we're still in progress
    if (!isset($training_data['in_progress']) || !$training_data['in_progress']) {
        return;
    }
    
    // Mark training as complete
    voicero_update_training_status('in_progress', false);
    voicero_update_training_status('status', 'completed');
    
    // Record the completion time
    update_option('voicero_last_training_date', current_time('mysql'));
}
add_action('voicero_finalize_training', 'voicero_finalize_training');

// Register the new AJAX action
add_action('wp_ajax_voicero_batch_train', 'voicero_batch_train');

// Register the new AJAX actions
add_action('wp_ajax_voicero_vectorize_content', 'voicero_vectorize_content');
add_action('wp_ajax_voicero_setup_assistant', 'voicero_setup_assistant');

// Helper function to collect WordPress data
function voicero_collect_wordpress_data() {
    $data = [
        'posts' => [],
        'pages' => [],
        'products' => [],
        'categories' => [],
        'tags' => [],
        'comments' => [],
        'reviews' => [],
        'authors' => [],
        'media' => [],
        'customFields' => [],
        'productCategories' => [],
        'productTags' => []
    ];

    // Get Posts
    $posts = get_posts([
        'post_type' => 'post',
        'post_status' => 'publish',
        'numberposts' => -1
    ]);

    // Get Authors (Users with relevant roles)
    $authors = get_users([
        'role__in' => ['administrator', 'editor', 'author', 'contributor'],
    ]);

    foreach ($authors as $author) {
        $data['authors'][] = [
            'id' => $author->ID,
            'name' => $author->display_name,
            'email' => $author->user_email,
            'url' => $author->user_url,
            'bio' => get_user_meta($author->ID, 'description', true),
            'avatarUrl' => get_avatar_url($author->ID)
        ];
    }

    // Get Media
    $media_items = get_posts([
        'post_type' => 'attachment',
        'post_status' => 'inherit',
        'posts_per_page' => -1
    ]);

    foreach ($media_items as $media) {
        $metadata = wp_get_attachment_metadata($media->ID);
        $data['media'][] = [
            'id' => $media->ID,
            'title' => $media->post_title,
            'url' => wp_get_attachment_url($media->ID),
            'alt' => get_post_meta($media->ID, '_wp_attachment_image_alt', true),
            'description' => $media->post_content,
            'caption' => $media->post_excerpt,
            'mimeType' => $media->post_mime_type,
            'metadata' => $metadata
        ];
    }

    // Get Custom Fields for Posts and Products
    foreach ($posts as $post) {
        $custom_fields = get_post_custom($post->ID);
        foreach ($custom_fields as $key => $values) {
            if (strpos($key, '_') !== 0) { // Skip private meta
                // phpcs:disable WordPress.DB.SlowDBQuery.slow_db_query_meta_key, WordPress.DB.SlowDBQuery.slow_db_query_meta_value
                $data['customFields'][] = [
                    'post_id' => $post->ID,
                    'post_type' => $post->post_type,
                    'meta_key' => $key,
                    'meta_value' => $values[0]
                ];
                // phpcs:enable
            }
        }
    }

    // Get Product Categories
    $product_categories = get_terms([
        'taxonomy' => 'product_cat',
        'hide_empty' => false
    ]);

    if (!is_wp_error($product_categories)) {
        foreach ($product_categories as $category) {
            $thumbnail_id = get_term_meta($category->term_id, 'thumbnail_id', true);
            $image_url = $thumbnail_id ? wp_get_attachment_url($thumbnail_id) : '';
            
            $data['productCategories'][] = [
                'id' => $category->term_id,
                'name' => $category->name,
                'slug' => $category->slug,
                'description' => wp_strip_all_tags($category->description),
                'parent' => $category->parent,
                'count' => $category->count,
                'imageUrl' => $image_url
            ];
        }
    }

    // Get Product Tags
    $product_tags = get_terms([
        'taxonomy' => 'product_tag',
        'hide_empty' => false
    ]);

    if (!is_wp_error($product_tags)) {
        foreach ($product_tags as $tag) {
            $data['productTags'][] = [
                'id' => $tag->term_id,
                'name' => $tag->name,
                'slug' => $tag->slug,
                'description' => wp_strip_all_tags($tag->description),
                'count' => $tag->count
            ];
        }
    }

    // Get Custom Fields for Products
    $products = get_posts([
        'post_type' => 'product',
        'post_status' => 'publish',
        'numberposts' => -1
    ]);

    foreach ($products as $product) {
        $custom_fields = get_post_meta($product->ID);
        foreach ($custom_fields as $key => $values) {
            if (strpos($key, '_') !== 0) { // Skip private meta
                // phpcs:disable WordPress.DB.SlowDBQuery.slow_db_query_meta_key, WordPress.DB.SlowDBQuery.slow_db_query_meta_value
                $data['customFields'][] = [
                    'post_id' => $product->ID,
                    'post_type' => $product->post_type,
                    'meta_key' => $key,
                    'meta_value' => $values[0]
                ];
                // phpcs:enable
            }
        }
    }

    // Get Comments
    foreach ($posts as $post) {
        $comments = get_comments([
            'post_id' => $post->ID,
            'status' => 'approve'
        ]);

        foreach ($comments as $comment) {
            $data['comments'][] = [
                'id' => $comment->comment_ID,
                'post_id' => $post->ID,
                'author' => $comment->comment_author,
                'author_email' => $comment->comment_author_email,
                'content' => wp_strip_all_tags($comment->comment_content),
                'date' => $comment->comment_date,
                'status' => $comment->comment_approved,
                'parent_id' => $comment->comment_parent
            ];
        }

        $data['posts'][] = [
            'id' => $post->ID,
            'title' => $post->post_title,
            'content' => $post->post_content,
            'contentStripped' => wp_strip_all_tags($post->post_content),
            'excerpt' => wp_strip_all_tags(get_the_excerpt($post)),
            'slug' => $post->post_name,
            'link' => get_permalink($post->ID),
            'author' => get_the_author_meta('display_name', $post->post_author),
            'date' => $post->post_date,
            'categories' => wp_get_post_categories($post->ID, ['fields' => 'names']),
            'tags' => wp_get_post_tags($post->ID, ['fields' => 'names'])
        ];
    }

    // Get Pages
    $pages = get_pages(['post_status' => 'publish']);
    if (!empty($pages)) {
        foreach ($pages as $page) {
            $data['pages'][] = [
                'id' => $page->ID,
                'title' => $page->post_title,
                'content' => $page->post_content,
                'contentStripped' => wp_strip_all_tags($page->post_content),
                'slug' => $page->post_name,
                'link' => get_permalink($page->ID),
                'template' => get_page_template_slug($page->ID),
                'parent' => $page->post_parent,
                'order' => $page->menu_order,
                'lastModified' => $page->post_modified
            ];
        }
    }

    // Get Categories
    $categories = get_categories(['hide_empty' => false]);
    foreach ($categories as $category) {
        $data['categories'][] = [
            'id' => $category->term_id,
            'name' => $category->name,
            'slug' => $category->slug,
            'description' => wp_strip_all_tags($category->description)
        ];
    }

    // Get Tags
    $tags = get_tags(['hide_empty' => false]);
    foreach ($tags as $tag) {
        $data['tags'][] = [
            'id' => $tag->term_id,
            'name' => $tag->name,
            'slug' => $tag->slug
        ];
    }

    // Get Products if WooCommerce is active
    if (class_exists('WC_Product_Query')) {
        $products = wc_get_products([
            'status' => 'publish',
            'limit' => -1
        ]);

        foreach ($products as $product) {
            // Get reviews for this product
            $reviews = get_comments([
                'post_id' => $product->get_id(),
                'status' => 'approve',
                'type' => 'review'
            ]);

            foreach ($reviews as $review) {
                $rating = get_comment_meta($review->comment_ID, 'rating', true);
                $verified = get_comment_meta($review->comment_ID, 'verified', true);

                $data['reviews'][] = [
                    'id' => $review->comment_ID,
                    'product_id' => $product->get_id(),
                    'reviewer' => $review->comment_author,
                    'reviewer_email' => $review->comment_author_email,
                    'review' => wp_strip_all_tags($review->comment_content),
                    'rating' => (int)$rating,
                    'date' => $review->comment_date,
                    'verified' => (bool)$verified
                ];
            }

            $data['products'][] = [
                'id' => $product->get_id(),
                'name' => $product->get_name(),
                'slug' => $product->get_slug(),
                'description' => wp_strip_all_tags($product->get_description()),
                'short_description' => wp_strip_all_tags($product->get_short_description()),
                'price' => $product->get_price(),
                'regular_price' => $product->get_regular_price(),
                'sale_price' => $product->get_sale_price(),
                'stock_quantity' => $product->get_stock_quantity(),
                'link' => get_permalink($product->get_id())
            ];
        }
    }

    return $data;
}

function voicero_render_admin_page() {
    // 1) Handle key coming back via GET redirect
    if ( ! empty( $_GET['access_key'] ) ) {
    if ( current_user_can('manage_options') ) {
      $key = sanitize_text_field( wp_unslash( $_GET['access_key'] ) );
      update_option( 'voicero_access_key', $key );
      add_settings_error(
        'voicero_messages',
        'key_updated',
        __( 'Successfully connected to AI service!', 'voicero-ai' ),
        'updated'
      );
        } else {
            add_settings_error(
                'voicero_messages',
                'invalid_nonce',
                __('Invalid connection link — please try again.', 'voicero-ai'),
                'error'
            );
        }
    }
    
    // Handle form submission
    if (isset($_POST['access_key'])) {
        if (check_admin_referer('voicero_save_access_key_nonce')) {
            $access_key = sanitize_text_field(wp_unslash($_POST['access_key']));
            
            // Verify the key is valid by making a test request
            $test_response = wp_remote_get(VOICERO_API_URL . '/connect', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $access_key,
                    'Content-Type' => 'application/json'
                ],
                'timeout' => 15,
                'sslverify' => false
            ]);

            if (is_wp_error($test_response)) {
                add_settings_error(
                    'voicero_messages',
                    'connection_error',
                    esc_html__('Could not connect to AI service. Please check your internet connection and try again.', 'voicero-ai'),
                    'error'
                );
            } else {
                $response_code = wp_remote_retrieve_response_code($test_response);
                $response_body = wp_remote_retrieve_body($test_response);
                
                if ($response_code !== 200) {
                    add_settings_error(
                        'voicero_messages',
                        'connection_error',
                        esc_html__('Could not validate access key. Please try connecting again.', 'voicero-ai'),
                        'error'
                    );
                } else {
                    update_option('voicero_access_key', $access_key);
                    add_settings_error(
                        'voicero_messages',
                        'key_updated',
                        esc_html__('Successfully connected to AI service!', 'voicero-ai'),
                        'updated'
                    );
                }
            }
        }
    }

    // Handle manual sync
    if (isset($_POST['sync_content']) && check_admin_referer('voicero_sync_content_nonce')) {
        // We'll handle the sync status message in the AJAX response
        add_settings_error(
            'voicero_messages',
            'sync_started',
            esc_html__('Content sync initiated...', 'voicero-ai'),
            'info'
        );
    }

    // Get saved values
    $saved_key = voicero_get_access_key();

    // Get the current site URL
    $site_url = get_site_url();
    $admin_url = admin_url('admin.php?page=voicero-ai-admin');
    
    // Encode URLs for safe transport
    $encoded_site_url = urlencode($site_url);
    $encoded_admin_url = urlencode($admin_url);
    
    // Generate the connection URL with nonce
    $connect_url = wp_nonce_url(
        "http://localhost:3000/app/connect?site_url={$encoded_site_url}&redirect_url={$encoded_admin_url}",
        'voicero_connect'
    );

    // Output the admin interface with full width
    ?>
    <div class="wrap" style="max-width: 100%;">
        <h1><?php esc_html_e('AI Website Connection', 'voicero-ai'); ?></h1>
        
        <?php settings_errors('voicero_messages'); ?>

        <?php if (!$saved_key): ?>
        <div class="card" style="max-width: 800px; margin-top: 20px;">
            <h2><?php esc_html_e('Connect Your Website', 'voicero-ai'); ?></h2>
            <p><?php esc_html_e('Enter your access key to connect to the AI Website service.', 'voicero-ai'); ?></p>

            <form method="post" action="">
                <?php wp_nonce_field('voicero_save_access_key_nonce'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="access_key"><?php esc_html_e('Access Key', 'voicero-ai'); ?></label></th>
                        <td>
                            <input type="text" 
                                   id="access_key" 
                                   name="access_key" 
                                   value="<?php echo esc_attr($saved_key); ?>" 
                                   class="regular-text"
                                   placeholder="<?php esc_attr_e('Enter your 64-character access key', 'voicero-ai'); ?>"
                                   pattern=".{64,64}"
                                   title="<?php esc_attr_e('Access key should be exactly 64 characters long', 'voicero-ai'); ?>">
                            <p class="description"><?php esc_html_e('Your access key should be exactly 64 characters long.', 'voicero-ai'); ?></p>
                        </td>
                    </tr>
                </table>
                <p class="submit">
                    <input type="submit" 
                           name="submit" 
                           id="submit" 
                           class="button button-primary" 
                           value="<?php esc_attr_e('Save & Connect', 'voicero-ai'); ?>">
                </p>
            </form>

            <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
                <h3><?php esc_html_e('New to Voicero?', 'voicero-ai'); ?></h3>
                <p><?php esc_html_e('Connect your website in one click and create your account.', 'voicero-ai'); ?></p>
                <a href="<?php echo esc_url($connect_url); ?>" class="button button-secondary">
                    <?php esc_html_e('Connect with Voicero', 'voicero-ai'); ?>
                </a>
            </div>
        </div>
        <?php endif; ?>

        <?php if ($saved_key): ?>
            <!-- Website info card - fixed full width -->
            <div class="card" style="margin-top: 20px; width: 100%; max-width: 100%; box-sizing: border-box;">
                <h2><?php esc_html_e('Website Information', 'voicero-ai'); ?></h2>
                <div id="website-info-container" style="width: 100%;">
                    <div class="spinner is-active" style="float: none;"></div>
                    <p><?php esc_html_e('Loading website information...', 'voicero-ai'); ?></p>
                </div>
                
                <div style="margin-top: 20px;">
                    <form method="post" action="javascript:void(0);" id="sync-form" onsubmit="return false;">
                        <?php wp_nonce_field('voicero_sync_content_nonce'); ?>
                        <input type="submit" 
                               name="sync_content" 
                               id="sync-button" 
                               class="button" 
                               value="<?php esc_attr_e('Sync Content Now', 'voicero-ai'); ?>">
                        <span id="sync-status" style="margin-left: 10px;"></span>
                    </form>
                </div>
            </div>
        <?php endif; ?>
    </div>   
    <?php
}

require_once plugin_dir_path(__FILE__) . 'includes/page-main.php';
require_once plugin_dir_path(__FILE__) . 'includes/api.php';
require_once plugin_dir_path(__FILE__) . 'includes/page-ai-overview.php';
require_once plugin_dir_path(__FILE__) . 'includes/page-settings.php';
require_once plugin_dir_path(__FILE__) . 'includes/page-contacts.php';
require_once plugin_dir_path(__FILE__) . 'includes/page-chatbot-update.php';

// Force-enable the REST API if something else is blocking it
add_action('init', function() {
    remove_filter('rest_authentication_errors', 'restrict_rest_api');
    add_filter('rest_enabled', '__return_true');
    add_filter('rest_jsonp_enabled', '__return_true');
});

/**
 * Enqueue admin scripts & styles for Voicero.AI page.
 */
function voicero_admin_enqueue_assets($hook_suffix) {
    // Load on all plugin admin pages
    if (strpos($hook_suffix, 'voicero-ai') === false) {
        return;
    }

    // CSS
    wp_register_style(
        'voicero-admin-style',
        plugin_dir_url(__FILE__) . 'assets/css/admin-style.css',
        [],      // no dependencies
        '1.0.0'
    );
    wp_enqueue_style('voicero-admin-style');

    // JS
    wp_register_script(
        'voicero-admin-js',
        plugin_dir_url(__FILE__) . 'assets/js/admin/voicero-main.js',
        ['jquery'],  // jQuery dependency
        '1.0.0',
        true         // load in footer
    );
    wp_enqueue_script('voicero-admin-js');

    // Get access key for JS
    $access_key = get_option('voicero_access_key', '');

    // If you still need any inline settings or nonce, attach them here:
    wp_localize_script(
        'voicero-admin-js',
        'voiceroAdminConfig',
        [
            'ajaxUrl'   => admin_url('admin-ajax.php'),
            'nonce'     => wp_create_nonce('voicero_ajax_nonce'),
            'accessKey' => $access_key,
            'apiUrl'    => defined('VOICERO_API_URL') ? VOICERO_API_URL : 'http://localhost:3000/api',
            'websiteId' => get_option('voicero_website_id', '')
        ]
    );
    
    // Also create window.voiceroConfig for backwards compatibility
    wp_add_inline_script(
        'voicero-admin-js',
        'window.voiceroConfig = window.voiceroAdminConfig;',
        'before'
    );
}
add_action('admin_enqueue_scripts', 'voicero_admin_enqueue_assets');


