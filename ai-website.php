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
define('VOICERO_API_URL', 'https://www.voicero.ai/api');

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
    $voicero_scripts = array('voicero-core-js', 'voicero-text-js', 'voicero-voice-js');
    foreach ($voicero_scripts as $handle) {
        $response['script_handles'][$handle] = isset($wp_scripts->registered[$handle]);
    }
    
    wp_send_json_success($response);
}

/* ------------------------------------------------------------------------
   1. ADMIN PAGE TO DISPLAY CONNECTION INTERFACE
------------------------------------------------------------------------ */
add_action('admin_menu', 'voicero_admin_page');
function voicero_admin_page() {
    add_menu_page(
        esc_html__('Voicero AI', 'voicero-ai'),          // Page title
        esc_html__('Voicero AI', 'voicero-ai'),          // Menu title
        'manage_options',                              // Capability required
        'voicero-ai-admin',                            // Menu slug (unique ID)
        'voicero_render_admin_page',                   // Callback function for the settings page
        'dashicons-microphone',                        // Menu icon
        30                                             // Menu position
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
        "https://www.voicero.ai/app/connect?site_url={$encoded_site_url}&redirect_url={$encoded_admin_url}",
        'voicero_connect'
    );

    // Output the admin interface
    ?>
    <div class="wrap">
        <h1><?php esc_html_e('AI Website Connection', 'voicero-ai'); ?></h1>
        
        <?php settings_errors('voicero_messages'); ?>

        <div class="card" style="max-width: 800px; margin-top: 20px;">
            <h2><?php esc_html_e('Connect Your Website', 'voicero-ai'); ?></h2>
            <p><?php esc_html_e('Enter your access key to connect to the AI Website service.', 'voicero-ai'); ?></p>

            <form method="post" action="">
                <?php wp_nonce_field('voicero_save_access_key_nonce'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="access_key"><?php esc_html_e('Access Key', 'voicero-ai'); ?></label></th>
                        <td>
                            <div style="display: flex; gap: 10px; align-items: flex-start;">
                                <input type="text" 
                                       id="access_key" 
                                       name="access_key" 
                                       value="<?php echo esc_attr($saved_key); ?>" 
                                       class="regular-text"
                                       placeholder="<?php esc_attr_e('Enter your 64-character access key', 'voicero-ai'); ?>"
                                       pattern=".{64,64}"
                                       title="<?php esc_attr_e('Access key should be exactly 64 characters long', 'voicero-ai'); ?>">
                                <?php if ($saved_key): ?>
                                    <button type="button" id="clear-connection" class="button button-secondary">
                                        <?php esc_html_e('Clear Connection', 'voicero-ai'); ?>
                                    </button>
                                <?php endif; ?>
                            </div>
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

            <?php if (!$saved_key): ?>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <h3><?php esc_html_e('New to Voicero?', 'voicero-ai'); ?></h3>
                    <p><?php esc_html_e('Connect your website in one click and create your account.', 'voicero-ai'); ?></p>
                    <a href="<?php echo esc_url($connect_url); ?>" class="button button-secondary">
                        <?php esc_html_e('Connect with Voicero', 'voicero-ai'); ?>
                    </a>
                </div>
            <?php endif; ?>
        </div>
       

        <?php if ($saved_key): ?>
            <!-- Website info card -->
            <div class="card" style="max-width: 800px; margin-top: 20px;">
                <h2><?php esc_html_e('Website Information', 'voicero-ai'); ?></h2>
                <div id="website-info-container">
                    <div class="spinner is-active" style="float: none;"></div>
                    <p><?php esc_html_e('Loading website information...', 'voicero-ai'); ?></p>
                </div>
                
               
            </div>
        <?php endif; ?>
    </div>   
    <?php
}

/* ------------------------------------------------------------------------
   2. REGISTER REST API ENDPOINTS
------------------------------------------------------------------------ */
// Optional debug logs for REST initialization
add_action('rest_api_init', function() {
    // error_log('REST API initialized from My First Plugin');
});

// Force-enable the REST API if something else is blocking it
add_action('init', function() {
    remove_filter('rest_authentication_errors', 'restrict_rest_api');
    add_filter('rest_enabled', '__return_true');
    add_filter('rest_jsonp_enabled', '__return_true');
});

/**
 * Add secure proxy endpoint for Voicero API
 * This keeps the access key server-side only
 */
add_action('rest_api_init', function() {
register_rest_route(
  'voicero/v1',
  '/connect',
  [
    'methods'             => WP_REST_Server::READABLE,    // GET
    'callback'            => 'voicero_connect_proxy',
    'permission_callback' => '__return_true',            // <-- allows public
  ]
);

    // New session endpoint proxy that handles both GET and POST
    register_rest_route('voicero/v1', '/session', [
        'methods'  => ['GET', 'POST'],
        'callback' => 'voicero_session_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Alternative endpoint without nested path
    register_rest_route('voicero/v1', '/window_state', [
        'methods'  => ['POST'],
        'callback' => 'voicero_window_state_proxy',
        'permission_callback' => '__return_true'
    ]);
});

function voicero_connect_proxy() {
    // Get the access key from options (server-side only)
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => esc_html__('No access key configured', 'voicero-ai')], 403);
    }
    
    // Make the API request with the key (server-side)
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
            'error' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}

/**
 * Proxy for the /session endpoint — GET by sessionId or websiteId,
 * POST to create a new session.
 */
function voicero_session_proxy( WP_REST_Request $request ) {
    // 1) Pull the server-side access key
    $access_key = voicero_get_access_key();
    if ( empty( $access_key ) ) {
        return new WP_REST_Response(
            [ 'error' => esc_html__( 'No access key configured', 'voicero-ai' ) ],
            403
        );
    }

    // 2) Base URL
    $base = rtrim( VOICERO_API_URL, '/' ) . '/session';

    // 3) Handle GET — must use query-string, NOT a path segment
    if ( 'GET' === $request->get_method() ) {
        $sessionId = $request->get_param( 'sessionId' );
        $websiteId = $request->get_param( 'websiteId' );

        if ( $sessionId ) {
            $endpoint = $base . '?sessionId=' . rawurlencode( $sessionId );
        } elseif ( $websiteId ) {
            $endpoint = $base . '?websiteId=' . rawurlencode( $websiteId );
        } else {
            return new WP_REST_Response(
                [ 'error' => esc_html__( 'Either sessionId or websiteId is required', 'voicero-ai' ) ],
                400
            );
        }

        $response = wp_remote_get( esc_url_raw( $endpoint ), [
            'headers'   => [
                'Authorization' => 'Bearer ' . $access_key,
                'Accept'        => 'application/json',
            ],
            'timeout'   => 30,
            'sslverify' => false,
        ] );
    }
    // 4) Handle POST — pass through body to create a new session
    else {
        $endpoint = $base;
        $body     = $request->get_body();
        $response = wp_remote_post( $endpoint, [
            'headers'   => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type'  => 'application/json',
                'Accept'        => 'application/json',
            ],
            'body'      => $body,
            'timeout'   => 30,
            'sslverify' => false,
        ] );
    }

    // 5) Error?
    if ( is_wp_error( $response ) ) {
        return new WP_REST_Response(
            [ 'error' => 'API request failed: ' . $response->get_error_message() ],
            500
        );
    }

    // 6) Forward the API's JSON back to the caller
    $status_code   = wp_remote_retrieve_response_code( $response );
    $response_body = wp_remote_retrieve_body( $response );
    $data          = json_decode( $response_body, true );

    return new WP_REST_Response( $data, $status_code );
}



/**
 * Proxy for the /session/window endpoint
 * Handles window state updates
 */
function voicero_window_state_proxy($request) {
    // Debug incoming request removed
    
    // Get the access key from options (server-side only)
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // Get the request body
    $body = $request->get_body();
    // Debug request body removed
    
    // Decode the body to validate it has the required fields
    $decoded_body = json_decode($body, true);
    if (!isset($decoded_body['sessionId']) || !isset($decoded_body['windowState'])) {
        // Debug invalid request removed
        return new WP_REST_Response(['error' => 'Session ID and window state are required'], 400);
    }
    
    // Ensure session ID is a properly formatted string
    $session_id = trim($decoded_body['sessionId']);
    if (empty($session_id)) {
        // Debug invalid sessionId removed
        return new WP_REST_Response(['error' => 'Valid Session ID is required'], 400);
    }
    
    // Debug processing session ID removed
    
    // Construct the API endpoint
    $endpoint = VOICERO_API_URL . '/session/windows';
    // Debug request URL removed
    
    // Make the POST request with the key (server-side)
    $response = wp_remote_request($endpoint, [
        'method' => 'POST', // Explicitly use POST method for updating
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => $body, // Keep the original body format
        'timeout' => 30,
        'sslverify' => false // Only for local development
    ]);
    
    if (is_wp_error($response)) {
        // Debug response error removed
        return new WP_REST_Response([
            'error' => 'API request failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    // Debug response removed
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}


/**
 * 2F) /wp-json/my-plugin/v1/all-content
 *     Returns all content types in one request
 */
add_action('rest_api_init', function() {
    register_rest_route('voicero-ai/v1', '/all-content', [
        'methods'  => ['GET', 'POST', 'OPTIONS'],
        'callback' => function($request) {
            $response = [
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

            // Get Authors
            $authors = get_users(['role__in' => ['author', 'editor', 'administrator']]);
            foreach ($authors as $author) {
                $response['authors'][] = [
                    'id' => $author->ID,
                    'name' => $author->display_name,
                    'email' => $author->user_email,
                    'url' => $author->user_url,
                    'bio' => get_user_meta($author->ID, 'description', true),
                    'avatar' => get_avatar_url($author->ID)
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
                $response['media'][] = [
                    'id' => $media->ID,
                    'title' => $media->post_title,
                    'url' => wp_get_attachment_url($media->ID),
                    'alt' => get_post_meta($media->ID, '_wp_attachment_image_alt', true),
                    'description' => $media->post_content,
                    'caption' => $media->post_excerpt,
                    'mime_type' => $media->post_mime_type,
                    'metadata' => $metadata
                ];
            }

            // Get Custom Fields (Post Meta)
            $post_types = ['post', 'page', 'product'];
            foreach ($post_types as $post_type) {
                $posts = get_posts([
                    'post_type' => $post_type,
                    'posts_per_page' => -1
                ]);
                foreach ($posts as $post) {
                    $custom_fields = get_post_custom($post->ID);
                    foreach ($custom_fields as $key => $values) {
                        // Skip internal WordPress meta
                        if (strpos($key, '_') === 0) continue;
                        
                        // phpcs:disable WordPress.DB.SlowDBQuery.slow_db_query_meta_key, WordPress.DB.SlowDBQuery.slow_db_query_meta_value
                        $response['customFields'][] = [
                            'post_id' => $post->ID,
                            'post_type' => $post_type,
                            'meta_key' => $key,
                            'meta_value' => $values[0]
                        ];
                        // phpcs:enable
                    }
                }
            }

            // Get Product Categories
            if (taxonomy_exists('product_cat')) {
                $product_categories = get_terms([
                    'taxonomy' => 'product_cat',
                    'hide_empty' => false
                ]);
                foreach ($product_categories as $category) {
                    $thumbnail_id = get_term_meta($category->term_id, 'thumbnail_id', true);
                    $response['productCategories'][] = [
                        'id' => $category->term_id,
                        'name' => $category->name,
                        'slug' => $category->slug,
                        'description' => $category->description,
                        'parent' => $category->parent,
                        'count' => $category->count,
                        'image' => $thumbnail_id ? wp_get_attachment_url($thumbnail_id) : null
                    ];
                }
            }

            // Get Product Tags
            if (taxonomy_exists('product_tag')) {
                $product_tags = get_terms([
                    'taxonomy' => 'product_tag',
                    'hide_empty' => false
                ]);
                foreach ($product_tags as $tag) {
                    $response['productTags'][] = [
                        'id' => $tag->term_id,
                        'name' => $tag->name,
                        'slug' => $tag->slug,
                        'description' => $tag->description,
                        'count' => $tag->count
                    ];
                }
            }

            // Get Posts
            $posts = get_posts([
                'post_type' => 'post',
                'post_status' => 'publish',
                'numberposts' => -1
            ]);

            foreach ($posts as $post) {
                // Get comments for this post
                $comments = get_comments([
                    'post_id' => $post->ID,
                    'status' => 'approve'
                ]);

                $formatted_comments = [];
                foreach ($comments as $comment) {
                    $formatted_comments[] = [
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

                // Add comments to the main comments array
                $response['comments'] = array_merge($response['comments'], $formatted_comments);

                $response['posts'][] = [
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
                    $response['pages'][] = [
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
                $response['categories'][] = [
                    'id' => $category->term_id,
                    'name' => $category->name,
                    'slug' => $category->slug,
                    'description' => wp_strip_all_tags($category->description)
                ];
            }

            // Get Tags
            $tags = get_tags(['hide_empty' => false]);
            foreach ($tags as $tag) {
                $response['tags'][] = [
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

                    $formatted_reviews = [];
                    foreach ($reviews as $review) {
                        $rating = get_comment_meta($review->comment_ID, 'rating', true);
                        $verified = get_comment_meta($review->comment_ID, 'verified', true);

                        $formatted_reviews[] = [
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

                    // Add reviews to the main reviews array
                    $response['reviews'] = array_merge($response['reviews'], $formatted_reviews);

                    $response['products'][] = [
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

            return new WP_REST_Response($response, 200);
        },
        'permission_callback' => '__return_true'
    ]);
});

/* ------------------------------------------------------------------------
   3. CORS HEADERS
------------------------------------------------------------------------ */
add_action('init', function() {
    if (isset($_SERVER['HTTP_ORIGIN'])) {
        $origin = esc_url_raw(wp_unslash($_SERVER['HTTP_ORIGIN']));
        
        // Add allowed origins here for production use
        $allowed_origins = [
            'https://www.voicero.ai', 
            'https://app.voicero.ai',
            get_site_url()
        ];
        
        // Validate origin against whitelist
        $origin_is_valid = false;
        
        // First validate URL structure
        if (wp_http_validate_url($origin)) {
            // Then check against the whitelist
            if (in_array($origin, $allowed_origins)) {
                $origin_is_valid = true;
            }
        }
        
        if ($origin_is_valid) {
            header("Access-Control-Allow-Origin: " . esc_url_raw($origin));
            header('Access-Control-Allow-Credentials: true');
        } else {
            // In production, you might want to restrict this to your own origin only
            if (defined('WP_DEBUG') && WP_DEBUG) {
                // More permissive for development
                header("Access-Control-Allow-Origin: *");
            } else {
                // More restrictive for production
                header("Access-Control-Allow-Origin: " . esc_url_raw(get_site_url()));
            }
        }
    } else {
        // Default fallback
        if (defined('WP_DEBUG') && WP_DEBUG) {
            // More permissive for development
            header("Access-Control-Allow-Origin: *");
        } else {
            // More restrictive for production
            header("Access-Control-Allow-Origin: " . esc_url_raw(get_site_url()));
        }
    }
    
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE"); // Allow common methods
    header("Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With"); // Allow common headers
    
    // Handle preflight requests
    if (isset($_SERVER['REQUEST_METHOD']) && $_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        status_header(200);
        exit();
    }
});

// Also add CORS headers to REST API responses
add_action('rest_api_init', function() {
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function($value) {
        if (isset($_SERVER['HTTP_ORIGIN'])) {
            $origin = esc_url_raw(wp_unslash($_SERVER['HTTP_ORIGIN']));
            
            // Add allowed origins here for production use
            $allowed_origins = [
                'https://www.voicero.ai', 
                'https://app.voicero.ai',
                get_site_url()
            ];
            
            // Validate origin against whitelist
            $origin_is_valid = false;
            
            // First validate URL structure
            if (wp_http_validate_url($origin)) {
                // Then check against the whitelist
                if (in_array($origin, $allowed_origins)) {
                    $origin_is_valid = true;
                }
            }
            
            if ($origin_is_valid) {
                header("Access-Control-Allow-Origin: " . esc_url_raw($origin));
                header('Access-Control-Allow-Credentials: true');
            } else {
                // In production, you might want to restrict this to your own origin only
                if (defined('WP_DEBUG') && WP_DEBUG) {
                    // More permissive for development
                    header("Access-Control-Allow-Origin: *");
                } else {
                    // More restrictive for production
                    header("Access-Control-Allow-Origin: " . esc_url_raw(get_site_url()));
                }
            }
        } else {
            // Default fallback
            if (defined('WP_DEBUG') && WP_DEBUG) {
                // More permissive for development
                header("Access-Control-Allow-Origin: *");
            } else {
                // More restrictive for production
                header("Access-Control-Allow-Origin: " . esc_url_raw(get_site_url()));
            }
        }
        
        header("Access-Control-Allow-Methods: GET, POST, OPTIONS, PUT, DELETE");
        header("Access-Control-Allow-Headers: Authorization, Content-Type, Accept, X-Requested-With");
        header("Access-Control-Expose-Headers: X-WP-Total, X-WP-TotalPages");
        return $value;
    });
}, 15);


/* ------------------------------------------------------------------------
   5. ADD FRONT-END INTERFACES TO <body>
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

   

    <!-- Main container for Voicero app -->
    <div id="voicero-app-container" data-hook="<?php echo esc_attr($hook); ?>"></div>
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
    // Removed debug log
    
    // Only enqueue on the frontend, not in admin
    if (!is_admin()) {
        // First enqueue the core script
        wp_enqueue_script(
            'voicero-core-js',
            plugin_dir_url(__FILE__) . 'assets/js/voicero-core.js',
            ['jquery'],
            '1.1',
            true
        );
        
        // Then enqueue the text script with core as dependency
        wp_enqueue_script(
            'voicero-text-js',
            plugin_dir_url(__FILE__) . 'assets/js/voicero-text.js',
            ['voicero-core-js', 'jquery'],
            '1.1',
            true
        );
        
        // Then enqueue the voice script with core as dependency
        wp_enqueue_script(
            'voicero-voice-js',
            plugin_dir_url(__FILE__) . 'assets/js/voicero-voice.js',
            ['voicero-core-js', 'jquery'],
            '1.1',
            true
        );

            // First enqueue the core script
        wp_enqueue_script(
            'voicero-action-handler-js',
            plugin_dir_url(__FILE__) . 'assets/js/voicero-action-handler.js',
            ['jquery'],
            '1.1',
            true
        );
        
        // Add support script for reporting functionality
        wp_enqueue_script(
            'voicero-support-js',
            plugin_dir_url(__FILE__) . 'assets/js/voicero-support.js',
            ['voicero-core-js', 'jquery'],
            '1.1',
            true
        );
        
        // Add contact form handling script
        wp_enqueue_script(
            'voicero-contact-js',
            plugin_dir_url(__FILE__) . 'assets/js/voicero-contact.js',
            ['voicero-text-js', 'jquery'],
            '1.1',
            true
        );

        // Get access key
        $access_key = voicero_get_access_key();
        // Removed debug log

        // Pass data to the frontend script
        wp_localize_script('voicero-core-js', 'voiceroConfig', [
            // Removed accessKey for security - now using server-side proxy
            'apiUrl' => VOICERO_API_URL,
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('voicero_frontend_nonce'),
            'pluginUrl' => plugin_dir_url(__FILE__),
            'debug' => defined('WP_DEBUG') && WP_DEBUG ? true : false,
        ]);

        // For backwards compatibility
        wp_add_inline_script('voicero-core-js', 'window.voiceroConfig = window.voiceroConfig;', 'before');

        // Enqueue the stylesheet
        wp_enqueue_style(
            'ai-website-style', 
            plugin_dir_url(__FILE__) . 'assets/css/style.css', 
            [], 
            '1.1'
        );
        
        voicero_debug_log('Voicero AI scripts enqueued successfully');
    }
}
add_action('wp_enqueue_scripts', 'voicero_enqueue_scripts');

// Add AJAX handler for frontend access AND admin access
add_action('wp_ajax_nopriv_voicero_get_info', 'voicero_get_info'); // For logged-out users (frontend)
add_action('wp_ajax_voicero_get_info', 'voicero_get_info'); // For logged-in users (admin and frontend)

function voicero_get_info() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Grab & verify nonce _before_ trusting any inputs
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    
    // Determine which nonce to check based on the context
    $is_admin = is_admin();
    $nonce_action = $is_admin ? 'voicero_ajax_nonce' : 'voicero_frontend_nonce';
    
    if (!check_ajax_referer($nonce_action, 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check capability for admin-specific data if in admin context
    if ($is_admin && !current_user_can('manage_options')) {
        wp_send_json_error(['message' => esc_html__('Insufficient permissions', 'voicero-ai')], 403);
        return;
    }

    // 4) Now that nonce & permissions are good, you can safely use action param
    $action = isset($_REQUEST['action']) ? sanitize_key(wp_unslash($_REQUEST['action'])) : '';
    
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured for this site.', 'voicero-ai')]);
        return;
    }

    $response = wp_remote_get(VOICERO_API_URL . '/connect?nocache=' . time(), [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false // Keep false for local dev
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ]);
        return;
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);

    if ($response_code !== 200) {
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %d: HTTP status code */
                esc_html__('Server returned error: %d', 'voicero-ai'),
                intval($response_code)
            ),
            'body' => wp_kses_post($body) // Sanitize the body content
        ]);
        return;
    }

    $data = json_decode($body, true);
    // The /connect endpoint returns { website: {...} }
    if (!$data || !isset($data['website'])) {
        wp_send_json_error([
            'message' => esc_html__('Invalid response structure from server.', 'voicero-ai')
        ]);
        return;
    }

    // Override the queryLimit to 200 for free plan users
    if (isset($data['website']['plan']) && $data['website']['plan'] === 'Free') {
        $data['website']['queryLimit'] = 200;
    }

    // Return just the website data
    wp_send_json_success($data['website']);
}

function voicero_clear_connection() {
    check_ajax_referer('voicero_ajax_nonce', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => esc_html__('Permission denied', 'voicero-ai')]);
        return;
    }
    delete_option('voicero_access_key');
    // Optionally: delete other related options or transients
    wp_send_json_success(['message' => esc_html__('Connection cleared successfully', 'voicero-ai')]);
}


/**
 * Proxy for the /session/clear endpoint
 * Creates a new thread and resets welcome flags
 */
function voicero_session_clear_proxy($request) {
    // Get the access key from options (server-side only)
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // Get the request body
    $body = $request->get_body();
    
    // Decode the body to validate it has the required fields
    $decoded_body = json_decode($body, true);
    if (!isset($decoded_body['sessionId'])) {
        return new WP_REST_Response(['error' => 'Session ID is required'], 400);
    }
    
    // Construct the API endpoint
    $endpoint = VOICERO_API_URL . '/session/clear';
    
    // Make the POST request with the key (server-side)
    $response = wp_remote_request($endpoint, [
        'method' => 'POST',
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => $body, // Keep the original body format
        'timeout' => 30,
        'sslverify' => false // Only for local development
    ]);
    
    if (is_wp_error($response)) {
        return new WP_REST_Response([
            'error' => 'API request failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}

/**
 * Proxy for the /chat endpoint
 * Handles text chat messages between client and AI
 */
function voicero_chat_proxy($request) {
    // Get the access key from options (server-side only)
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // Get the request body
    $body = $request->get_body();
    
    // Decode the body to validate it has the required fields
    $decoded_body = json_decode($body, true);
    if (!isset($decoded_body['message'])) {
        return new WP_REST_Response(['error' => 'Message is required'], 400);
    }
    
    // Ensure pageData is included in the request
    if (!isset($decoded_body['pageData'])) {
        $decoded_body['pageData'] = [
            'url' => isset($decoded_body['currentPageUrl']) ? $decoded_body['currentPageUrl'] : '',
            'full_text' => '',
            'buttons' => [],
            'forms' => [],
            'sections' => [],
            'images' => []
        ];
    } else {
        // Filter pageData to remove WordPress admin elements and Voicero UI
        $decoded_body['pageData'] = voicero_filter_page_data($decoded_body['pageData']);
    }
    
    // Log the pageData for debugging if needed
    voicero_debug_log('Chat request with page data', $decoded_body['pageData']);
    
    // Re-encode the body with any modifications
    $body = json_encode($decoded_body);
    
    // Construct the API endpoint - Updated to use /wordpress/chat instead of /chat
    $endpoint = VOICERO_API_URL . '/wordpress/chat';
    
    // Make the POST request with the key (server-side)
    $response = wp_remote_post($endpoint, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => $body,
        'timeout' => 60, // Longer timeout for chat responses
        'sslverify' => false // Only for local development
    ]);
    
    if (is_wp_error($response)) {
        return new WP_REST_Response([
            'error' => 'API request failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}

/**
 * Filter page data to remove WordPress admin and Voicero UI elements
 * 
 * @param array $pageData The page data to filter
 * @return array The filtered page data
 */
function voicero_filter_page_data($pageData) {
    // Define the IDs we want to ignore
    $ignored_ids = [
        // WordPress admin elements
        'wpadminbar',
        'adminbarsearch',
        'page',
        'masthead',
        
        // Voicero UI elements
        'chat-website-button',
        'voice-mic-button',
        'voice-toggle-container',
        'voice-messages',
        'voice-loading-bar',
        'voice-controls-header',
        'voice-input-wrapper',
    ];
    
    // Additional filters for partial matches
    $ignored_prefixes = [
        'wp-',
        'voicero',
    ];
    
    $ignored_substrings = [
        'voice-',
        'text-chat',
    ];
    
    // Filter buttons
    if (isset($pageData['buttons']) && is_array($pageData['buttons'])) {
        $pageData['buttons'] = array_filter($pageData['buttons'], function($btn) use ($ignored_ids, $ignored_prefixes, $ignored_substrings) {
            if (empty($btn['id'])) return true;
            
            // Check for exact match
            if (in_array($btn['id'], $ignored_ids)) return false;
            
            // Check for prefix match
            foreach ($ignored_prefixes as $prefix) {
                if (strpos($btn['id'], $prefix) === 0) return false;
            }
            
            // Check for substring match
            foreach ($ignored_substrings as $substr) {
                if (strpos($btn['id'], $substr) !== false) return false;
            }
            
            return true;
        });
        
        // Re-index array
        $pageData['buttons'] = array_values($pageData['buttons']);
    }
    
    // Filter forms
    if (isset($pageData['forms']) && is_array($pageData['forms'])) {
        $pageData['forms'] = array_filter($pageData['forms'], function($form) use ($ignored_ids, $ignored_prefixes, $ignored_substrings) {
            if (empty($form['id'])) return true;
            
            // Check for exact match
            if (in_array($form['id'], $ignored_ids)) return false;
            
            // Check for prefix match
            foreach ($ignored_prefixes as $prefix) {
                if (strpos($form['id'], $prefix) === 0) return false;
            }
            
            // Check for substring match
            foreach ($ignored_substrings as $substr) {
                if (strpos($form['id'], $substr) !== false) return false;
            }
            
            return true;
        });
        
        // Re-index array
        $pageData['forms'] = array_values($pageData['forms']);
    }
    
    // Filter sections
    if (isset($pageData['sections']) && is_array($pageData['sections'])) {
        $pageData['sections'] = array_filter($pageData['sections'], function($section) use ($ignored_ids, $ignored_prefixes, $ignored_substrings) {
            if (empty($section['id'])) {
                // For elements without IDs, check if it's in header/footer based on tag and text
                if ($section['tag'] === 'header' || $section['tag'] === 'footer') {
                    return false;
                }
                return true;
            }
            
            // Check for exact match
            if (in_array($section['id'], $ignored_ids)) return false;
            
            // Check for prefix match
            foreach ($ignored_prefixes as $prefix) {
                if (strpos($section['id'], $prefix) === 0) return false;
            }
            
            // Check for substring match
            foreach ($ignored_substrings as $substr) {
                if (strpos($section['id'], $substr) !== false) return false;
            }
            
            return true;
        });
        
        // Re-index array
        $pageData['sections'] = array_values($pageData['sections']);
    }
    
    // Filter images - usually no need to filter these, but included for completeness
    if (isset($pageData['images']) && is_array($pageData['images'])) {
        // Keep images that aren't from admin or Gravatar
        $pageData['images'] = array_filter($pageData['images'], function($img) {
            if (empty($img['src'])) return false;
            
            // Skip Gravatar images
            if (strpos($img['src'], 'gravatar.com') !== false) return false;
            
            return true;
        });
        
        // Re-index array
        $pageData['images'] = array_values($pageData['images']);
    }
    
    return $pageData;
}

/**
 * Proxy for Text-to-Speech API requests
 */
/**
 * Proxy endpoint: /voicero/v1/tts
 * Converts text → MP3 via Voicero API, stores it, returns the public URL.
 */
function voicero_tts_proxy( WP_REST_Request $request ) {

    /* 1. Guard clauses ---------------------------------------------------- */
    $access_key = get_option( 'voicero_access_key', '' );
    if ( empty( $access_key ) ) {
        return new WP_REST_Response( [ 'error' => 'No access key configured' ], 403 );
    }

    $json_body   = $request->get_body();
    $body_params = json_decode( $json_body, true );

    if ( empty( $body_params['text'] ) ) {
        return new WP_REST_Response( [ 'error' => 'No text provided' ], 400 );
    }

    /* 2. Forward to Voicero API ------------------------------------------- */
    $response = wp_remote_post(
        'https://www.voicero.ai/api/tts',
        [
            'headers'   => [
                'Authorization'            => 'Bearer ' . $access_key,
                'Content-Type'             => 'application/json',
                'Accept'                   => 'audio/mpeg',
                'X-Expected-Response-Type' => 'audio/mpeg',
            ],
            'body'      => $json_body,
            'timeout'   => 30,
            'sslverify' => false,
        ]
    );

    if ( is_wp_error( $response ) ) {
        return new WP_REST_Response(
            [ 'error' => 'Failed to connect to TTS API: ' . $response->get_error_message() ],
            500
        );
    }

    $status_code = wp_remote_retrieve_response_code( $response );
    if ( $status_code < 200 || $status_code >= 300 ) {
        return new WP_REST_Response(
            [
                'error'   => 'TTS API returned error',
                'details' => wp_remote_retrieve_body( $response ),
            ],
            $status_code
        );
    }

    $audio_data = wp_remote_retrieve_body( $response );

    /* Basic sanity check (ID3 or MPEG‑sync) */
    if ( ! str_starts_with( $audio_data, 'ID3' )
         && ( ord( $audio_data[0] ) !== 0xFF || ( ord( $audio_data[1] ) & 0xE0 ) !== 0xE0 ) ) {
        return new WP_REST_Response(
            [ 'error' => 'Invalid audio payload from TTS API' ],
            500
        );
    }

    /* 3. Save the MP3 to uploads ----------------------------------------- */
    $upload_dir = wp_upload_dir();
    $subdir     = trailingslashit( $upload_dir['basedir'] ) . 'voicero';

    if ( ! file_exists( $subdir ) ) {
        wp_mkdir_p( $subdir );
    }

    $filename   = 'tts-' . gmdate( 'Ymd-His' ) . '-' . wp_generate_password( 6, false ) . '.mp3';
    $saved      = wp_upload_bits( $filename, null, $audio_data, 'voicero' );

    if ( $saved['error'] ) {
        return new WP_REST_Response(
            [ 'error' => 'Failed to write audio file: ' . esc_html( $saved['error'] ) ],
            500
        );
    }

    /* 4. Return the public URL (signed if desired) ----------------------- */
    $file_url = $saved['url'];  // already absolute, no need to esc_url() for JSON
    // Ensure the URL uses HTTPS instead of HTTP to prevent mixed content warnings
    $file_url = str_replace('http://', 'https://', $file_url);

    return new WP_REST_Response(
        [
            'success' => true,
            'url'     => $file_url,
            // 'expires' => time() + 3600   // add TTL if you generate signed URLs
        ],
        200
    );
}


/**
 * Proxy for Whisper API (speech-to-text) requests
 */
function voicero_whisper_proxy($request) {
    // Get the access key from options (server-side only)
    $access_key = get_option('voicero_access_key', '');
    if (empty($access_key)) {
        //error_log('Whisper proxy: No access key configured');
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    //error_log('Whisper proxy: Received request');
    
    // Get the uploaded file
    $files = $request->get_file_params();
    if (empty($files['audio']) || !isset($files['audio']['tmp_name'])) {
        //error_log('Whisper proxy: No audio file uploaded');
        return new WP_REST_Response(['error' => 'No audio file uploaded'], 400);
    }
    
    // Get other form parameters
    $params = $request->get_params();
    
    // Create a new multipart form for the upstream request
    $boundary = wp_generate_uuid4();
    
    // Start building multipart body
    $body = '';
    
    // Add audio file to request body
    $file_path = $files['audio']['tmp_name'];
    $file_name = $files['audio']['name'];
    $file_type = $files['audio']['type'] ?: 'audio/webm';
    $file_content = file_get_contents($file_path);
    
    // Add file as part
    $body .= "--$boundary\r\n";
    $body .= "Content-Disposition: form-data; name=\"audio\"; filename=\"$file_name\"\r\n";
    $body .= "Content-Type: $file_type\r\n\r\n";
    $body .= $file_content . "\r\n";
    
    // Add additional parameters if needed
    foreach ($params as $key => $value) {
        if ($key !== 'audio') { // Skip the file parameter
            $body .= "--$boundary\r\n";
            $body .= "Content-Disposition: form-data; name=\"$key\"\r\n\r\n";
            $body .= $value . "\r\n";
        }
    }
    
    // Close multipart body
    $body .= "--$boundary--\r\n";
    
    // Send request to local API
    $response = wp_remote_post('https://www.voicero.ai/api/whisper', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'multipart/form-data; boundary=' . $boundary,
        ],
        'body' => $body,
        'timeout' => 30,
        'sslverify' => false
    ]);
    
    // Check for errors
    if (is_wp_error($response)) {
        //error_log('Whisper proxy error: ' . $response->get_error_message());
        return new WP_REST_Response(
            ['error' => 'Failed to connect to Whisper API: ' . $response->get_error_message()], 
            500
        );
    }
    
    // Get response status code
    $status_code = wp_remote_retrieve_response_code($response);
    
    // Log status code for debugging
    //error_log('Whisper API response status: ' . $status_code);
    
    // If not successful, return error
    if ($status_code < 200 || $status_code >= 300) {
        $error_body = wp_remote_retrieve_body($response);
        //error_log('Whisper API error response: ' . $error_body);
        
        // Clean up the error response to ensure it's valid JSON
        $sanitized_error = $error_body;
        if (!empty($error_body)) {
            // Try to decode JSON response
            $json_decoded = json_decode($error_body, true);
            if (json_last_error() !== JSON_ERROR_NONE) {
                // If JSON is invalid, escape it as a string
                $sanitized_error = 'Invalid JSON response: ' . esc_html($error_body);
            } else {
                // If JSON is valid, re-encode it to ensure proper formatting
                $sanitized_error = json_encode($json_decoded);
                if (json_last_error() !== JSON_ERROR_NONE) {
                    $sanitized_error = 'Error encoding response';
                }
            }
        }
        
        return new WP_REST_Response(
            ['error' => 'Whisper API returned error', 'details' => $sanitized_error],
            $status_code
        );
    }
    
    // Return API response
    $body = wp_remote_retrieve_body($response);
    return new WP_REST_Response(json_decode($body, true), $status_code);
}

add_action('rest_api_init', function() {
    // 1) Admin-only: return site info & plan
    register_rest_route(
        'voicero/v1',
        '/connect',
        [
            'methods'             => 'GET',
            'callback'            => 'voicero_connect_proxy',
           'permission_callback' => '__return_true',
        ]
    );

    // 2) Public session endpoints for frontend chat
    register_rest_route(
        'voicero/v1',
        '/session',
        [
            'methods'             => ['GET', 'POST'],
            'callback'            => 'voicero_session_proxy',
            'permission_callback' => '__return_true',
        ]
    );

    // 3) Public endpoint: update window state (front-end UI)
    register_rest_route(
        'voicero/v1',
        '/window_state',
        [
            'methods'             => 'POST',
            'callback'            => 'voicero_window_state_proxy',
            'permission_callback' => '__return_true',
        ]
    );

    // 4) Public endpoint: clear/reset session
    register_rest_route(
        'voicero/v1',
        '/session_clear',
        [
            'methods'             => 'POST',
            'callback'            => 'voicero_session_clear_proxy',
            'permission_callback' => '__return_true',
        ]
    );

    // 5) Public chat proxy for WordPress-flavored messages
    register_rest_route(
        'voicero/v1',
        '/wordpress/chat',
        [
            'methods'             => 'POST',
            'callback'            => 'voicero_chat_proxy',
            'permission_callback' => '__return_true',
        ]
    );

    // 6) Public TTS (text-to-speech) proxy
    register_rest_route(
        'voicero/v1',
        '/tts',
        [
            'methods'             => 'POST',
            'callback'            => 'voicero_tts_proxy',
            'permission_callback' => '__return_true',
        ]
    );

    // 7) Public Whisper (speech-to-text) proxy
    register_rest_route(
        'voicero/v1',
        '/whisper',
        [
            'methods'             => 'POST',
            'callback'            => 'voicero_whisper_proxy',
            'permission_callback' => '__return_true',
        ]
    );
    
    // 8) Support feedback endpoint
    register_rest_route(
        'voicero/v1',
        '/support',
        [
            'methods'             => 'POST',
            'callback'            => 'voicero_support_proxy',
            'permission_callback' => '__return_true', // Allow all users to report issues
        ]
    );
    
    // 9) Contact form endpoint
    register_rest_route(
        'voicero/v1',
        '/contactHelp',
        [
            'methods'             => 'POST',
            'callback'            => 'voicero_contact_form_handler',
            'permission_callback' => '__return_true', // Allow all users to submit contact forms
        ]
    );
});

/**
 * Handle support feedback requests
 * Forwards messageId and threadId to support API
 */
function voicero_support_proxy($request) {
    // Get the request body
    $json_body = $request->get_body();
    $params = json_decode($json_body, true);
    
    // Validate required parameters - must be valid UUIDs
    if (!isset($params['messageId']) || !isset($params['threadId'])) {
        error_log('Support API: Missing required parameters: ' . $json_body);
        return new WP_REST_Response([
            'error' => 'Missing required parameters: messageId and threadId are required'
        ], 400);
    }
    
    // Log the incoming request
    error_log('Support API request: messageId=' . $params['messageId'] . ', threadId=' . $params['threadId']);
    
    // Validate format
    $uuid_pattern = '/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i';
    if (!preg_match($uuid_pattern, $params['messageId']) || !preg_match($uuid_pattern, $params['threadId'])) {
        error_log('Support API: Invalid UUID format: ' . $json_body);
        return new WP_REST_Response([
            'error' => 'Invalid format: messageId and threadId must be valid UUIDs'
        ], 400);
    }
    
    // Get the access key from options
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        error_log('Support API: No access key configured');
        return new WP_REST_Response([
            'error' => 'No access key configured'
        ], 403);
    }
    
    // Create session-like auth for the external API
    // This fakes a session that the Next.js API expects
    $session_auth = array(
        'user' => array(
            'id' => 'wordpress_plugin', // This will be checked by the API
            'websiteId' => $params['threadId'], // Use the thread ID as website ID for auth
        )
    );
    
    // Encode as JWT-like format
    $session_token = base64_encode(json_encode($session_auth));
    
    // Create data to forward
    $forward_data = array(
        'messageId' => sanitize_text_field($params['messageId']),
        'threadId' => sanitize_text_field($params['threadId']),
        // Add authentication data for the Next.js API
        'auth' => array(
            'session' => $session_token
        )
    );
    
    // Forward to support API
    $response = wp_remote_post('https://www.voicero.ai/api/support/help', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json',
            'X-Voicero-Session' => $session_token, // Add session token in header
            'X-Voicero-Source' => 'wordpress_plugin' // Add source identifier
        ],
        'body' => json_encode($forward_data),
        'timeout' => 15,
        'sslverify' => true // Enable SSL verification for production
    ]);
    
    // Check for request errors
    if (is_wp_error($response)) {
        $error_message = 'Failed to connect to support API: ' . $response->get_error_message();
        error_log('Support API error: ' . $error_message);
        return new WP_REST_Response([
            'error' => $error_message
        ], 500);
    }
    
    // Get response status and body
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    // Log the response for debugging
    error_log('Support API response: Status=' . $status_code . ', Body=' . substr($response_body, 0, 200));
    
    // If it's a 401, try to handle it gracefully
    if ($status_code === 401) {
        // Try to parse the response for more details
        $response_data = json_decode($response_body, true);
        $error_message = isset($response_data['error']) ? $response_data['error'] : 'Authentication failed';
        
        error_log('Support API authentication failed: ' . $error_message);
        return new WP_REST_Response([
            'error' => 'Authentication failed with support API: ' . $error_message,
            'suggestion' => 'Please check your access key or contact Voicero support'
        ], 401);
    }
    
    // Return the API response
    return new WP_REST_Response(
        json_decode($response_body, true),
        $status_code
    );
}

/**
 * Handle contact form submissions
 * Forwards data to www.voicero.ai/contacts/help and returns success/error response
 */
function voicero_contact_form_handler($request) {
    // Get the request body
    $json_body = $request->get_body();
    $params = json_decode($json_body, true);
    
    // Validate required parameters
    if (!isset($params['email']) || !isset($params['message'])) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Missing required parameters: email and message are required'
        ], 400);
    }
    
    // Sanitize inputs
    $email = sanitize_email($params['email']);
    $message = sanitize_textarea_field($params['message']);
    
    // Get thread ID and website ID - using camelCase to match Next.js API
    $threadId = isset($params['threadId']) ? sanitize_text_field($params['threadId']) : '';
    $websiteId = isset($params['websiteId']) ? sanitize_text_field($params['websiteId']) : '';
    
    // Verify required fields for the Next.js API
    if (empty($websiteId)) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Website ID is required'
        ], 400);
    }
    
    // Validate email
    if (!is_email($email)) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Invalid email address'
        ], 400);
    }
    
    // Validate message length
    if (strlen($message) < 5) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Message is too short'
        ], 400);
    }
    
    // Get the access key from options
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        return new WP_REST_Response([
            'success' => false,
            'error' => 'No access key configured'
        ], 403);
    }
    
    // Prepare data to send to the Voicero API - using camelCase to match Next.js API
    $api_data = [
        'email' => $email,
        'message' => $message,
        'websiteId' => $websiteId,
        'source' => 'wordpress_plugin'
    ];
    
    // Add threadId if available
    if (!empty($threadId)) {
        $api_data['threadId'] = $threadId;
    }
    
    // Add site information
    $api_data['siteUrl'] = home_url();
    $api_data['siteName'] = get_bloginfo('name');
    
    // Log the request data for debugging
    error_log('Contact form - Sending data to API: ' . json_encode($api_data));
    
    // Forward to Voicero API - using the correct API URL
    $response = wp_remote_post('https://www.voicero.ai/api/contacts/help', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode($api_data),
        'timeout' => 15,
        'sslverify' => true // Use true for production
    ]);
    
    // Check for request errors
    if (is_wp_error($response)) {
        $error_message = 'Failed to connect to Voicero API: ' . $response->get_error_message();
        error_log('Contact API error: ' . $error_message);
        
        // Also store in local database as backup
        store_contact_in_database($email, $message, $threadId, $websiteId);
        
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Failed to send your message. We\'ve logged it and will get back to you soon.'
        ], 500);
    }
    
    // Get response status and body
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    // Check if the API request was successful
    if ($status_code >= 200 && $status_code < 300) {
        // Success - also store in local database for redundancy
        store_contact_in_database($email, $message, $threadId, $websiteId);
        
        return new WP_REST_Response([
            'success' => true,
            'message' => 'Thank you for your message! We\'ve received your request and will get back to you soon.'
        ], 200);
    } else {
        // API request failed - log the error but still store in local database
        error_log('Contact API error: Status=' . $status_code . ', Body=' . substr($response_body, 0, 200));
        store_contact_in_database($email, $message, $threadId, $websiteId);
        
        return new WP_REST_Response([
            'success' => false,
            'error' => 'Failed to process your request. We\'ve logged it and will get back to you soon.'
        ], 500);
    }
}

/**
 * Helper function to store contact form data in the database
 */
function store_contact_in_database($email, $message, $thread_id, $website_id) {
    try {
        global $wpdb;
        $table_name = $wpdb->prefix . 'voicero_contacts';
        
        // Check if table exists, create it if it doesn't
        if($wpdb->get_var("SHOW TABLES LIKE '$table_name'") != $table_name) {
            $charset_collate = $wpdb->get_charset_collate();
            $sql = "CREATE TABLE $table_name (
                id mediumint(9) NOT NULL AUTO_INCREMENT,
                time datetime DEFAULT '0000-00-00 00:00:00' NOT NULL,
                email varchar(100) NOT NULL,
                message text NOT NULL,
                thread_id varchar(255),
                website_id varchar(255),
                PRIMARY KEY  (id)
            ) $charset_collate;";
            
            require_once(ABSPATH . 'wp-admin/includes/upgrade.php');
            dbDelta($sql);
        }
        
        // Insert the contact submission
        $wpdb->insert(
            $table_name,
            array(
                'time' => current_time('mysql'),
                'email' => $email,
                'message' => $message,
                'thread_id' => $thread_id,
                'website_id' => $website_id
            )
        );
        
        return true;
    } catch(Exception $e) {
        // Log error but continue
        error_log('Error storing contact form submission: ' . $e->getMessage());
        return false;
    }
}

// Add a new function to track training status
function voicero_get_training_status() {
    check_ajax_referer('voicero_ajax_nonce', 'nonce');
    
    // Get the training status from options
    $training_data = get_option('voicero_training_status', [
        'in_progress' => false,
        'total_items' => 0,
        'completed_items' => 0,
        'failed_items' => 0,
        'last_updated' => 0,
        'status' => 'not_started'
    ]);
    
    // If training is in progress but hasn't been updated in 10 minutes, consider it stalled
    if ($training_data['in_progress'] && time() - $training_data['last_updated'] > 600) {
        $training_data['status'] = 'stalled';
    }
    
    wp_send_json_success($training_data);
}
add_action('wp_ajax_voicero_get_training_status', 'voicero_get_training_status');

// Helper function to update training status
function voicero_update_training_status($key, $value) {
    $training_data = get_option('voicero_training_status', [
        'in_progress' => false,
        'total_items' => 0,
        'completed_items' => 0,
        'failed_items' => 0,
        'last_updated' => time(),
        'status' => 'not_started'
    ]);
    
    $training_data[$key] = $value;
    $training_data['last_updated'] = time();
    
    update_option('voicero_training_status', $training_data);
    return $training_data;
}

/**
 * Enqueue admin scripts & styles for Voicero.AI page.
 */
function voicero_admin_enqueue_assets($hook_suffix) {
    // Only load on our plugin's admin page
    if ($hook_suffix !== 'toplevel_page_voicero-ai-admin') {
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
        plugin_dir_url(__FILE__) . 'assets/js/admin.js',
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
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce'   => wp_create_nonce('voicero_ajax_nonce'),
            'accessKey' => $access_key,
            'apiUrl' => defined('VOICERO_API_URL') ? VOICERO_API_URL : 'https://www.voicero.ai/api'
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


add_action('wp_ajax_nopriv_my_login_action', 'my_login_handler');

function my_login_handler() {
    // Verify nonce
    if (!check_ajax_referer('voicero_frontend_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => 'Invalid security token']);
        return;
    }

    // Sanitize and unslash input
    $username = isset($_POST['username']) ? sanitize_user(wp_unslash($_POST['username'])) : '';
    $password = isset($_POST['password']) && is_string($_POST['password']) ? sanitize_text_field(wp_unslash($_POST['password'])) : '';

    // Validate required fields
    if (empty($username) || empty($password)) {
        wp_send_json_error(['message' => 'Username and password are required']);
        return;
    }

    // Attempt login
    $creds = array(
        'user_login'    => $username,
        'user_password' => $password,
        'remember'      => true,
    );

    $user = wp_signon($creds, is_ssl());

    if (is_wp_error($user)) {
        wp_send_json_error(['message' => 'Login failed: ' . $user->get_error_message()]);
    } else {
        wp_send_json_success(['message' => 'Login successful']);
    }

    wp_die();
}
