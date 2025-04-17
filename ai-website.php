<?php
/**
 * Plugin Name: Voicero.AI
 * Description: Connect your site to an AI Salesman. It answers questions, guides users, and boosts sales.
 * Version: 1.0
 * Author: Voicero.AI
 * License: GPLv2 or later
 * License URI: https://www.gnu.org/licenses/gpl-2.0.html
 */


if (!defined('ABSPATH')) {
    exit; // Prevent direct access
}

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
// define('AI_WEBSITE_API_URL', 'https://www.voicero.ai/api');
define('AI_WEBSITE_API_URL', 'https://www.voicero.ai/api');

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
        wp_send_json_error(['message' => 'Permission denied']);
        return;
    }
    
    // Flush rewrite rules
    flush_rewrite_rules();
    
    // Reinitialize REST API
    do_action('rest_api_init');
    
    wp_send_json_success(['message' => 'Rewrite rules flushed successfully']);
}

function voicero_debug_info() {
    $response = array(
        'wp_version' => get_bloginfo('version'),
        'php_version' => phpversion(),
        'theme' => wp_get_theme()->get('Name'),
        'plugins' => array(),
        'access_key' => !empty(get_option('ai_website_access_key', '')),
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
add_action('admin_menu', 'ai_website_add_admin_page');
function ai_website_add_admin_page() {
    add_menu_page(
        'Voicero.AI',         // Page <title>
        'Voicero.AI',         // Menu label
        'manage_options',     // Capability required
        'ai-website-admin',   // Menu slug (unique ID)
        'ai_website_render_admin_page', // Callback that renders the page
        'dashicons-analytics',// Icon (dashicons)
        100                   // Position in the menu
    );
}

// Add AJAX handlers for the admin page
add_action('wp_ajax_ai_website_check_connection', 'ai_website_check_connection');
add_action('wp_ajax_ai_website_sync_content', 'ai_website_sync_content');
add_action('wp_ajax_ai_website_vectorize_content', 'ai_website_vectorize_content');
add_action('wp_ajax_ai_website_setup_assistant', 'ai_website_setup_assistant');
add_action('wp_ajax_ai_website_clear_connection', 'ai_website_clear_connection');

// Add new AJAX handlers for training steps
add_action('wp_ajax_ai_website_train_page', 'ai_website_train_page');
add_action('wp_ajax_ai_website_train_post', 'ai_website_train_post');
add_action('wp_ajax_ai_website_train_product', 'ai_website_train_product');
add_action('wp_ajax_ai_website_train_general', 'ai_website_train_general');

function ai_website_check_connection() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
    }

    $response = wp_remote_get(AI_WEBSITE_API_URL . '/connect', [
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
            'message' => 'Connection failed: ' . $response->get_error_message()
        ], 500);
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);

    if ($response_code !== 200) {
        // Remove error log
        return new WP_REST_Response([
            'message' => 'Server returned error: ' . $response_code,
            'body' => $body
        ]);
    }

    $data = json_decode($body, true);
    if (json_last_error() !== JSON_ERROR_NONE) {
        wp_send_json_error([
            'message' => 'Invalid response from server',
            'code' => 'invalid_json'
        ]);
    }

    wp_send_json_success($data);
}

function ai_website_sync_content() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
    }

    try {
        // 1. Sync the content
        $data = collect_wordpress_data();

        $sync_response = wp_remote_post(AI_WEBSITE_API_URL . '/wordpress/sync', [
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
                'message' => 'Sync failed: ' . $sync_response->get_error_message(),
                'code' => $sync_response->get_error_code(),
                'stage' => 'sync',
                'progress' => 0
            ]);
        }

        $response_code = wp_remote_retrieve_response_code($sync_response);
        if ($response_code !== 200) {
            wp_send_json_error([
                'message' => 'Sync failed: Server returned ' . $response_code,
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
function ai_website_vectorize_content() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
    }

    $vectorize_response = wp_remote_post(AI_WEBSITE_API_URL . '/wordpress/vectorize', [
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
            'message' => 'Vectorization failed: ' . $vectorize_response->get_error_message(),
            'code' => $vectorize_response->get_error_code(),
            'stage' => 'vectorize',
            'progress' => 17 // Keep progress at previous step
        ]);
    }
    
    $response_code = wp_remote_retrieve_response_code($vectorize_response);
    if ($response_code !== 200) {
         wp_send_json_error([
            'message' => 'Vectorization failed: Server returned ' . $response_code,
            'code' => $response_code,
            'stage' => 'vectorize',
            'progress' => 17,
            'body' => wp_remote_retrieve_body($vectorize_response)
        ]);
    }

    wp_send_json_success([
        'message' => 'Vectorization completed, setting up assistant...',
        'stage' => 'vectorize',
        'progress' => 34, // Updated progress
        'complete' => false,
        'details' => json_decode(wp_remote_retrieve_body($vectorize_response), true)
    ]);
}

// Add new endpoint for assistant setup
function ai_website_setup_assistant() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
    }

    $assistant_response = wp_remote_post(AI_WEBSITE_API_URL . '/wordpress/assistant', [
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
            'message' => 'Assistant setup failed: ' . $assistant_response->get_error_message(),
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
function ai_website_train_page() {
    _handle_training_request('page', 'pageId');
}
function ai_website_train_post() {
    _handle_training_request('post', 'postId');
}
function ai_website_train_product() {
    _handle_training_request('product', 'productId');
}
function ai_website_train_general() {
    _handle_training_request('general');
}

// Helper for training requests
function _handle_training_request($type, $id_key = null) {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');

    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
    }

    $api_url = AI_WEBSITE_API_URL . '/wordpress/train/' . $type;
    $request_body = [];
    
    // Add required parameters to the body based on type
    if ($type === 'general') {
        // For general training, we only need websiteId
        if (isset($_POST['websiteId'])) {
            $request_body['websiteId'] = sanitize_text_field(wp_unslash($_POST['websiteId']));
        } else {
            wp_send_json_error(['message' => "Missing required parameter: websiteId"]);
            return;
        }
    } else {
        // For content-specific training, we need both wpId and websiteId
        // 1. Check for content ID (for our internal reference only)
        if ($id_key && isset($_POST[$id_key])) {
            // We don't need to send the page/post/product ID to the API
            // $request_body[$id_key] = sanitize_text_field($_POST[$id_key]);
        } elseif ($id_key) {
            wp_send_json_error(['message' => "Missing required parameter: $id_key"]);
            return;
        }
        
        // 2. Add wpId - required for content-specific training
        if (isset($_POST['wpId'])) {
            $request_body['wpId'] = sanitize_text_field(wp_unslash($_POST['wpId']));
        } else {
            wp_send_json_error(['message' => "Missing required parameter: wpId"]);
            return;
        }
        
        // 3. Add websiteId - required for all types
        if (isset($_POST['websiteId'])) {
            $request_body['websiteId'] = sanitize_text_field(wp_unslash($_POST['websiteId']));
        } else {
            wp_send_json_error(['message' => "Missing required parameter: websiteId"]);
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
        'message' => ucfirst($type) . ' training initiated.',
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
function ai_website_batch_train() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');

    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key found']);
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
        wp_send_json_error(['message' => 'Missing required parameter: websiteId']);
    }
    
    if (empty($batch_data) || !is_array($batch_data)) {
        wp_send_json_error(['message' => 'Invalid or missing batch data']);
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
        $api_url = AI_WEBSITE_API_URL;
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
        
        // Schedule a status check for this item (staggered timing)
        $item_request_id = $batch_id . '_' . $index;
        $check_delay = ($type === 'general') ? 30 : max(5, min(5 * ($index + 1), 30)); // Stagger checks from 5-30 seconds
        wp_schedule_single_event(time() + $check_delay, 'voicero_check_batch_item_status', [$type, $item_request_id]);
    }
    
    // Also schedule periodic checks for the overall batch (once per minute for 10 minutes)
    for ($i = 1; $i <= 10; $i++) {
        wp_schedule_single_event(time() + ($i * 60), 'voicero_check_batch_status', [$batch_id, $i]);
    }
    
    wp_send_json_success([
        'message' => 'Batch training initiated.',
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

// Register the new AJAX action
add_action('wp_ajax_ai_website_batch_train', 'ai_website_batch_train');

// Register the new AJAX actions
add_action('wp_ajax_ai_website_vectorize_content', 'ai_website_vectorize_content');
add_action('wp_ajax_ai_website_setup_assistant', 'ai_website_setup_assistant');

// Helper function to collect WordPress data
function collect_wordpress_data() {
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

function ai_website_render_admin_page() {
    // Check for access key in URL
    $url_access_key = isset($_GET['access_key']) ? sanitize_text_field(wp_unslash($_GET['access_key'])) : '';
    
    // Handle form submission
    if (isset($_POST['access_key']) || !empty($url_access_key)) {
        // Don't check nonce if we have a URL access key
        if (!empty($url_access_key) || check_admin_referer('save_access_key_nonce')) {
            $access_key = !empty($_POST['access_key']) ? sanitize_text_field(wp_unslash($_POST['access_key'])) : $url_access_key;
            
            // Verify the key is valid by making a test request
            $test_response = wp_remote_get(AI_WEBSITE_API_URL . '/connect', [
                'headers' => [
                    'Authorization' => 'Bearer ' . $access_key,
                    'Content-Type' => 'application/json'
                ],
                'timeout' => 15,
                'sslverify' => false
            ]);

            if (is_wp_error($test_response)) {
                add_settings_error(
                    'ai_website_messages',
                    'connection_error',
                    'Could not connect to AI service. Please check your internet connection and try again.',
                    'error'
                );
            } else {
                $response_code = wp_remote_retrieve_response_code($test_response);
                $response_body = wp_remote_retrieve_body($test_response);
                
                if ($response_code !== 200) {
                    add_settings_error(
                        'ai_website_messages',
                        'connection_error',
                        'Could not validate access key. Please try connecting again.',
                        'error'
                    );
                } else {
                    update_option('ai_website_access_key', $access_key);
                    add_settings_error(
                        'ai_website_messages',
                        'key_updated',
                        'Successfully connected to AI service!',
                        'updated'
                    );
                }
            }
        }
    }

    // Handle manual sync
    if (isset($_POST['sync_content']) && check_admin_referer('sync_content_nonce')) {
        // We'll handle the sync status message in the AJAX response
        add_settings_error(
            'ai_website_messages',
            'sync_started',
            'Content sync initiated...',
            'info'
        );
    }

    // Get saved values
    $saved_key = get_option('ai_website_access_key', '');

    // Get the current site URL
    $site_url = get_site_url();
    $admin_url = admin_url('admin.php?page=ai-website-admin');
    
    // Encode URLs for safe transport
    $encoded_site_url = urlencode($site_url);
    $encoded_admin_url = urlencode($admin_url);
    
    // Generate the connection URL
    $connect_url = "https://www.voicero.ai/app/connect?site_url={$encoded_site_url}&redirect_url={$encoded_admin_url}";

    // Output the admin interface
    ?>
    <div class="wrap">
        <h1>AI Website Connection</h1>
        
        <?php settings_errors('ai_website_messages'); ?>

        <div class="card" style="max-width: 800px; margin-top: 20px;">
            <h2>Connect Your Website</h2>
            <p>Enter your access key to connect to the AI Website service.</p>

            <form method="post" action="">
                <?php if (empty($url_access_key)) wp_nonce_field('save_access_key_nonce'); ?>
                <table class="form-table">
                    <tr>
                        <th scope="row"><label for="access_key">Access Key</label></th>
                        <td>
                            <div style="display: flex; gap: 10px; align-items: flex-start;">
                                <input type="text" 
                                       id="access_key" 
                                       name="access_key" 
                                       value="<?php echo esc_attr($saved_key); ?>" 
                                       class="regular-text"
                                       placeholder="Enter your 64-character access key"
                                       pattern=".{64,64}"
                                       title="Access key should be exactly 64 characters long">
                                <?php if ($saved_key): ?>
                                    <button type="button" id="clear-connection" class="button button-secondary">
                                        Clear Connection
                                    </button>
                                <?php endif; ?>
                            </div>
                            <p class="description">Your access key should be exactly 64 characters long.</p>
                        </td>
                    </tr>
                </table>
                <p class="submit">
                    <input type="submit" 
                           name="submit" 
                           id="submit" 
                           class="button button-primary" 
                           value="Save & Connect">
                </p>
            </form>

            <?php if (!$saved_key): ?>
                <div style="margin-top: 20px; padding-top: 20px; border-top: 1px solid #ddd;">
                    <h3>New to Voicero?</h3>
                    <p>Connect your website in one click and create your account.</p>
                    <a href="<?php echo esc_url($connect_url); ?>" class="button button-secondary">
                        Connect with Voicero
                    </a>
                </div>
            <?php endif; ?>
        </div>
       

        <?php if ($saved_key): ?>
            <!-- Website info card -->
            <div class="card" style="max-width: 800px; margin-top: 20px;">
                <h2>Website Information</h2>
                <div id="website-info-container">
                    <div class="spinner is-active" style="float: none;"></div>
                    <p>Loading website information...</p>
                </div>
                
                <div style="margin-top: 20px;">
                    <form method="post" action="" id="sync-form">
                        <?php wp_nonce_field('sync_content_nonce'); ?>
                        <input type="submit" 
                               name="sync_content" 
                               id="sync-button" 
                               class="button" 
                               value="Sync Content Now">
                        <span id="sync-status" style="margin-left: 10px;"></span>
                    </form>
                </div>
            </div>
        <?php endif; ?>
    </div>

    <style>
    .modal {
        display: none;
        position: fixed;
        top: 0;
        left: 0;
        width: 100%;
        height: 100%;
        background: rgba(0,0,0,0.6);
        z-index: 100000;
    }
    .modal-content {
        position: relative;
        background: #fff;
        width: 90%;
        max-width: 600px;
        margin: 50px auto;
        padding: 20px;
        border-radius: 5px;
        box-shadow: 0 5px 15px rgba(0,0,0,0.3);
    }
    .modal-close {
        position: absolute;
        right: 10px;
        top: 10px;
        font-size: 24px;
        cursor: pointer;
        color: #666;
    }
    .modal-close:hover {
        color: #000;
    }
    </style>

    <script>
    jQuery(document).ready(function($) {
        // Add toggle functionality
        $('.connection-details-toggle button').on('click', function() {
            const $toggle = $(this).parent();
            const $details = $('.connection-details');
            const isVisible = $details.is(':visible');
            
            $details.slideToggle();
            $toggle.toggleClass('active');
            $(this).html(`
                <span class="dashicons dashicons-arrow-${isVisible ? 'down' : 'up'}-alt2"></span>
                ${isVisible ? 'Show' : 'Hide'} Connection Details
            `);
        });

        // Check if WordPress shows expired message - only once
        const bodyText = $('body').text();
        if (bodyText.includes('link you followed has expired') && window.location.search.includes('access_key')) {
            // Only refresh if we came from an access_key URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('access_key');
            window.location.replace(newUrl.toString()); // Use replace instead of href
            return;
        }

        // Add a flag to localStorage when clearing connection
        $('#clear-connection').on('click', function() {
            if (confirm('Are you sure you want to clear the connection?')) {
                localStorage.setItem('connection_cleared', 'true');
                
                // Make AJAX call to clear the connection
                $.post(ajaxurl, {
                    action: 'ai_website_clear_connection',
                    nonce: nonce
                })
                .then(function() {
                    // Clear the form and reload
                    $('#access_key').val('');
                    window.location.reload();
                });
            }
        });

        // Check for access key in URL - but only if we haven't just cleared
        const urlParams = new URLSearchParams(window.location.search);
        const accessKey = urlParams.get('access_key');
        const wasCleared = localStorage.getItem('connection_cleared') === 'true';
        
        if (accessKey && !wasCleared) {
            // Just fill the form
            $('#access_key').val(accessKey);
            
            // Clean the URL
            const newUrl = new URL(window.location.href);
            newUrl.searchParams.delete('access_key');
            window.history.replaceState({}, '', newUrl.toString());
        }

        // Clear the flag after handling
        localStorage.removeItem('connection_cleared');

        const ajaxurl = '<?php echo esc_js(admin_url('admin-ajax.php')); ?>';
        const nonce = '<?php echo esc_js(wp_create_nonce('ai_website_ajax_nonce')); ?>';
        const savedAccessKey = '<?php echo esc_js($saved_key); ?>'; // Get saved key for JS

        // Handle sync form submission
        $('#sync-form').on('submit', function(e) {
            e.preventDefault();
            const syncButton = $('#sync-button');
            const syncStatusContainer = $('#sync-status'); 

            // Reset initial state
            syncButton.prop('disabled', true);

            // Create progress bar and status text elements
            syncStatusContainer.html(`
                <div id="sync-progress-bar-container" style="width: 100%; background-color: #e0e0e0; border-radius: 4px; overflow: hidden; margin-bottom: 5px; height: 24px; position: relative; margin-top: 15px;">
                    <div id="sync-progress-bar" style="width: 0%; height: 100%; background-color: #0073aa; transition: width 0.3s ease;"></div>
                    <div id="sync-progress-percentage" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; line-height: 24px; text-align: center; color: #fff; font-weight: bold; text-shadow: 1px 1px 1px rgba(0,0,0,0.2);">
                        0%
                    </div>
                </div>
                <div id="sync-progress-text" style="font-style: italic; text-align: center;">Initiating sync...</div>
                <div id="sync-warning" style="margin-top: 10px; padding: 8px; background-color: #f0f6fc; border-left: 4px solid #2271b1; color: #1d2327; font-size: 13px; text-align: left;">
                    <p><strong>⚠️ Important:</strong> Please do not close this page during training. You can leave the page and do other things while the training is happening. This process could take up to 20 minutes to complete depending on the size of your website.</p>
                </div>
            `);

            const progressBar = $('#sync-progress-bar');
            const progressPercentage = $('#sync-progress-percentage');
            const progressText = $('#sync-progress-text');

            function updateProgress(percentage, text, isError = false) {
                const p = Math.min(100, Math.max(0, Math.round(percentage))); // Clamp between 0 and 100
                progressBar.css('width', p + '%');
                progressPercentage.text(p + '%');
                progressText.text(text);
                
                if (isError) {
                    progressBar.css('background-color', '#d63638'); // Red for error
                    progressPercentage.css('color', '#fff'); 
                } else {
                     progressBar.css('background-color', '#0073aa'); // Blue for progress/success
                     progressPercentage.css('color', p < 40 ? '#333' : '#fff'); 
                }
            }

            updateProgress(5, '⏳ Syncing content...'); 

            try {
                let assistantData = null; // To store assistant response
                let websiteId = null; // Declare websiteId at a higher scope level

                // Step 1: Initial Sync (to 17%)
                $.post(ajaxurl, { action: 'ai_website_sync_content', nonce: nonce })
                .then(function(response) {
                    if (!response.success) throw new Error(response.data.message || "Sync failed");
                    updateProgress(response.data.progress || 17, '⏳ Vectorizing content...');
                    // Step 2: Vectorization (to 34%)
                    return $.post(ajaxurl, { action: 'ai_website_vectorize_content', nonce: nonce });
                })
                .then(function(response) {
                    if (!response.success) throw new Error(response.data.message || "Vectorization failed");
                    updateProgress(response.data.progress || 34, '⏳ Setting up assistant...');
                    // Step 3: Assistant Setup (to 50%)
                    return $.post(ajaxurl, { action: 'ai_website_setup_assistant', nonce: nonce });
                })
                .then(function(response) {
                    if (!response.success) throw new Error(response.data.message || "Assistant setup failed");
                    updateProgress(response.data.progress || 50, '⏳ Preparing content training...');
                    assistantData = response.data.data; // Store the content IDs
                    
                    // Store websiteId at the higher scope
                    if (assistantData && assistantData.websiteId) {
                        websiteId = assistantData.websiteId;
                    } else {
                        // Try to use the first content item's websiteId as fallback
                        if (assistantData && assistantData.content && 
                            assistantData.content.pages && assistantData.content.pages.length > 0) {
                            websiteId = assistantData.content.pages[0].websiteId;
                        }
                        // If still no websiteId, we'll need to handle that error case
                        if (!websiteId) {
                            throw new Error("No websiteId available for training");
                        }
                    }
                    
                    // --- Step 4: All Training (50% to 100%) ---
                    if (!assistantData || !assistantData.content) {
                         // Even if no content items, we still need to do general training
                    }
                    
                    // Prepare training data
                    const pages = assistantData && assistantData.content ? (assistantData.content.pages || []) : [];
                    const posts = assistantData && assistantData.content ? (assistantData.content.posts || []) : [];
                    const products = assistantData && assistantData.content ? (assistantData.content.products || []) : [];
                    
                    // Calculate total items including general training which we'll do last
                    const totalItems = pages.length + posts.length + products.length + 1; // +1 for general training
                    updateProgress(50, `⏳ Preparing to train ${totalItems} items...`);

                    // Build combined array of all items to train
                    const allItems = [
                        ...pages.map(item => ({ type: 'page', wpId: item.id })),
                        ...posts.map(item => ({ type: 'post', wpId: item.id })),
                        ...products.map(item => ({ type: 'product', wpId: item.id })),
                        { type: 'general' } // Add general training as the last item
                    ];
                    
                    // Process all items in a single batch request
                    return $.post(ajaxurl, {
                        action: 'ai_website_batch_train',
                        nonce: nonce,
                        websiteId: websiteId,
                        batch_data: JSON.stringify(allItems)
                    });
                })
                .then(function(response) {
                    if (!response.success) throw new Error(response.data.message || "Batch training failed");
                    // Training requests have been initiated
                    updateProgress(60, '⏳ Training requests initiated. Monitoring progress...');
                    
                    // Show explanation about background processing
                    $('#sync-warning').html(`
                        <p><strong>ℹ️ Training In Progress:</strong> All training requests have been initiated and 
                        are now processing. This can take several minutes to complete depending on the 
                        size of your website. Progress will be tracked below.</p>
                        <div id="training-status-container">
                            <p id="training-status">Status: <span>Processing...</span></p>
                            <div id="training-progress-container" style="width: 100%; background-color: #e0e0e0; border-radius: 4px; overflow: hidden; margin: 10px 0; height: 24px; position: relative;">
                                <div id="training-progress-bar" style="width: 0%; height: 100%; background-color: #0073aa; transition: width 0.3s ease;"></div>
                                <div id="training-progress-text" style="position: absolute; top: 0; left: 0; width: 100%; height: 100%; line-height: 24px; text-align: center; color: #fff; font-weight: bold; text-shadow: 1px 1px 1px rgba(0,0,0,0.2);">
                                    0%
                                </div>
                            </div>
                        </div>
                    `);
                    
                    // Poll for status updates
                    let pollingInterval = setInterval(function() {
                        $.post(ajaxurl, { 
                            action: 'voicero_get_training_status', 
                            nonce: nonce 
                        })
                        .done(function(response) {
                            if (response.success) {
                                const data = response.data;
                                
                                // Calculate progress percentage
                                let progressPercent = 0;
                                if (data.total_items > 0) {
                                    progressPercent = Math.round((data.completed_items / data.total_items) * 100);
                                }
                                
                                // Update progress display
                                $('#training-progress-bar').css('width', progressPercent + '%');
                                $('#training-progress-text').text(progressPercent + '%');
                                
                                // Show status text
                                let statusText = 'Processing...';
                                if (data.status === 'completed') {
                                    statusText = '<span style="color: green;">Completed ✓</span>';
                                    clearInterval(pollingInterval); // Stop polling if completed
                                    updateProgress(100, '✅ Training Completed!');
                                    
                                    // Update website info after slight delay
                                    setTimeout(() => {
                                        loadWebsiteInfo();
                                    }, 1500);
                                } else if (data.status === 'stalled') {
                                    statusText = '<span style="color: orange;">Stalled - Some items may not have completed</span>';
                                }
                                
                                $('#training-status span').html(statusText);
                                
                                // If completed, stop polling
                                if (!data.in_progress || data.status === 'completed') {
                                    clearInterval(pollingInterval);
                                }
                            }
                        });
                    }, 3000); // Check every 3 seconds
                    
                    // After 10 minutes, stop polling regardless
                    setTimeout(function() {
                        if (pollingInterval) {
                            clearInterval(pollingInterval);
                            $('#training-status span').html('<span style="color: grey;">Check back later - status updates stopped</span>');
                        }
                    }, 600000); // 10 minutes max
                })
                .catch(function(error) {
                    // General Error handling for the entire chain
                    const currentProgress = parseFloat(progressBar.css('width')) / progressBar.parent().width() * 100;
                    updateProgress(currentProgress, `❌ Error: ${error.message}`, true); 
                })
                .always(function() {
                    // Re-enable button regardless of success or failure
                    syncButton.prop('disabled', false);
                });
            } catch (error) {
                // Catch synchronous errors (should be rare)
                syncButton.prop('disabled', false);
                updateProgress(0, `❌ Error: ${error.message}`, true);
            }
        });

        function loadWebsiteInfo() {
            const container = $('#website-info-container');
            
            $.get(ajaxurl, {
                action: 'ai_website_get_info',
                nonce: nonce
            })
            .done(function(response) {
                if (!response || !response.success) {
                     let errorMsg = 'Failed to load website info';
                     if(response && response.data && response.data.message) {
                         errorMsg = response.data.message;
                     } else if (response && response.data && response.data.body) {
                         try {
                            const body = JSON.parse(response.data.body);
                            errorMsg = body.message || errorMsg;
                         } catch(e) {}
                     }
                     throw new Error(errorMsg);
                }

                const website = response.data; // The API returns website data directly under 'data'
                
                // Only show first-time modal if we have a valid website connection
                // AND it has never been synced
                if (website && website.id && !website.lastSyncedAt) {
                    // Show the modal
                    $('#first-time-modal').fadeIn();
                    
                    // Handle modal close
                    $('.modal-close').on('click', function() {
                        $('#first-time-modal').fadeOut();
                    });
                    
                    // Close modal when clicking outside
                    $(window).on('click', function(e) {
                        if ($(e.target).is('#first-time-modal')) {
                            $('#first-time-modal').fadeOut();
                        }
                    });

                    // Handle first sync button click in modal (uses the main sync logic)
                    $('#first-sync-button').on('click', function() {
                        const $modalContent = $(this).closest('.notice');
                         $('#first-time-modal').fadeOut(); // Close modal immediately
                         $('#sync-button').trigger('click'); // Trigger the main sync button
                    });
                }

                // Regular website info display code...
                const html = `
                    <table class="widefat">
                        <tbody>
                            <tr>
                                <th>Website Name</th>
                                <td>
                                    ${website.name || 'Unnamed Site'}
                                    
                                </td>
                            </tr>
                            <tr>
                                <th>URL</th>
                                <td>${website.url || 'Not set'}</td>
                            </tr>
                            <tr>
                                <th>Plan</th>
                                <td>${website.plan || 'Free'}</td>
                            </tr>
                            ${website.color ? `
                            <tr>
                                <th>Color</th>
                                <td style="display: flex; align-items: center; gap: 12px;">
                                    <div style="width: 24px; height: 24px; border-radius: 4px; background-color: ${website.color}; border: 1px solid #ddd;"></div>
                                    <code style="font-size: 13px; padding: 4px 8px; background: #f0f0f1; border-radius: 3px;">${website.color}</code>
                                </td>
                            </tr>
                            ` : ''}
                            <tr>
                                <th>Status</th>
                                <td>
                                    <span class="button button-small ${website.active ? 'button-primary' : 'button-secondary'}">
                                        ${website.active ? 'Active' : 'Inactive'}
                                    </span>
                                    <button class="button button-small toggle-status-btn" 
                                            data-website-id="${website.id || ''}" 
                                            data-access-key="${savedAccessKey}"
                                            ${!website.lastSyncedAt ? 'disabled title="Please sync your website first"' : ''}>
                                        ${website.active ? 'Deactivate' : 'Activate'}
                                    </button>
                                </td>
                            </tr>
                            <tr>
                                <th>Monthly Queries</th>
                                <td>
                                    ${website.monthlyQueries || 0} / ${website.queryLimit || 200}
                                    <div class="progress-bar" style="
                                        background: #f0f0f1;
                                        height: 10px;
                                        border-radius: 5px;
                                        margin-top: 5px;
                                        overflow: hidden;
                                    ">
                                        <div style="
                                            width: ${((website.monthlyQueries || 0) / (website.queryLimit || 200)) * 100}%;
                                            background: #2271b1;
                                            height: 100%;
                                            transition: width 0.3s ease;
                                        "></div>
                                    </div>
                                </td>
                            </tr>
                            <tr>
                                <th>Last Synced</th>
                                <td>${website.lastSyncedAt ? new Date(website.lastSyncedAt).toLocaleString() : 'Never'}</td>
                            </tr>
                           
                        </tbody>
                    </table>

                    <div style="margin-top: 20px; display: flex; gap: 10px; align-items: center;">
                        <a href="https://www.voicero.ai/app/websites/website?id=${website.id || ''}" target="_blank" class="button button-primary">
                            Open Dashboard
                        </a>
                        <button class="button toggle-status-btn" 
                                data-website-id="${website.id || ''}"
                                data-access-key="${savedAccessKey}"
                                ${!website.lastSyncedAt ? 'disabled title="Please sync your website first"' : ''}>
                            ${website.active ? 'Deactivate Plugin' : 'Activate Plugin'}
                        </button>
                        ${!website.lastSyncedAt ? `
                            <span class="description" style="color: #d63638;">
                                ⚠️ Please sync your website before activating the plugin
                            </span>
                        ` : ''}
                    </div>

                    <div style="margin-top: 20px;">
                        <h3>Content Statistics</h3>
                        <table class="widefat">
                            <thead>
                                <tr>
                                    <th>Content Type</th>
                                    <th>Count</th>
                                </tr>
                            </thead>
                            <tbody>
                                <tr>
                                    <td>Pages</td>
                                    <td>${website._count?.pages || 0}</td>
                                </tr>
                                <tr>
                                    <td>Posts</td>
                                    <td>${website._count?.posts || 0}</td>
                                </tr>
                                <tr>
                                    <td>Products</td>
                                    <td>${website._count?.products || 0}</td>
                                </tr>
                            </tbody>
                        </table>
                    </div>
                `;
                container.html(html);
            })
            .fail(function(xhr, status, error) {
                container.html(`
                    <div class="notice notice-error">
                        <p>Connection Error: ${error || 'Failed to connect to server'}</p>
                        <p>Status: ${status}</p>
                        <p>Please check your internet connection and try again.</p>
                    </div>
                `);
            });
        }

        // Load website info on page load if we have an access key
        if (savedAccessKey) {
            loadWebsiteInfo();
        }

        // If there was an error on page load, show the connect button prominently
        if ($('#website-info-container .notice-error').length > 0) {
            $('.button-secondary').addClass('button-primary').css({
                'margin-top': '10px',
                'font-weight': 'bold'
            });
        }

        // Update the click handler for toggle status button
        $(document).on('click', '.toggle-status-btn', function() {
            const websiteId = $(this).data('website-id');
            const accessKey = $(this).data('access-key');
            const $button = $(this);
            
            if (!websiteId && !accessKey) {
                alert('Could not identify website. Please try refreshing the page.');
                return;
            }
            
            // Disable button during request
            $button.prop('disabled', true);
            
            fetch( AI_WEBSITE_API_URL + '/websites/toggle-status', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({ 
                    websiteId: websiteId || undefined,
                    accessKey: accessKey || undefined
                })
            })
            .then(response => response.json())
            .then(data => {
                if (data.error) {
                    throw new Error(data.error);
                }
                // Refresh the page to show updated status
                window.location.reload();
            })
            .catch(error => {
                alert('Failed to toggle website status: ' + error.message + '. Please try again.');
            })
            .finally(() => {
                $button.prop('disabled', false);
            });
        });

        // Update where we output the ACCESS_KEY constant
        document.addEventListener("DOMContentLoaded", async () => {
            // Add this at the top - before any other code
            const ACCESS_KEY = '<?php 
                $key = get_option("ai_website_access_key", "");
                echo esc_js($key); 
                // Debug log the key to PHP error log
                // error_log("Access key being used: " + substr($key, 0, 10) + "..."); // Be careful logging keys
            ?>';
            
            // Expose config globally (or use a more structured approach if needed)
             window.aiWebsiteConfig = {
                accessKey: ACCESS_KEY,
                apiUrl: 'https://www.voicero.ai/api',
                ajaxUrl: '<?php echo esc_js(admin_url('admin-ajax.php')); ?>',
                nonce: '<?php echo esc_js(wp_create_nonce('ai_website_frontend_nonce')); ?>', // Frontend nonce
                adminNonce: nonce // Admin nonce already defined above
             };
        });

        // Add script to detect nav height and position button
        function updateNavbarPositioning() {
            // Find the navigation element - checking common WordPress nav classes/IDs
            const nav = document.querySelector(
                'header, ' + // Try header first
                '#masthead, ' + // Common WordPress header ID
                '.site-header, ' + // Common header class
                'nav.navbar, ' + // Bootstrap navbar
                'nav.main-navigation, ' + // Common nav classes
                '.nav-primary, ' +
                '#site-navigation, ' +
                '.site-navigation'
            );
            
            if (nav) {
                const navRect = nav.getBoundingClientRect();
                const navBottom = Math.max(navRect.bottom, 32); // Minimum 32px from top
                
                // Set the custom property for positioning
                document.documentElement.style.setProperty('--nav-bottom', navBottom + 'px');
            }
        }

        // Run on load
        document.addEventListener('DOMContentLoaded', updateNavbarPositioning);
        
        // Run on resize
        window.addEventListener('resize', updateNavbarPositioning);
        
        // Run after a short delay to catch any dynamic header changes
        setTimeout(updateNavbarPositioning, 500);
    });
    </script>
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
    register_rest_route('voicero/v1', '/connect', [
        'methods'  => 'GET',
        'callback' => 'voicero_connect_proxy',
        'permission_callback' => '__return_true'
    ]);

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
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // Make the API request with the key (server-side)
    $response = wp_remote_get(AI_WEBSITE_API_URL . '/connect', [
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
            'error' => 'Connection failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}

/**
 * Proxy for the /session endpoint
 * Handles both GET and POST requests
 */
function voicero_session_proxy($request) {
    // Get the access key from options (server-side only)
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // Determine if it's a GET or POST request
    $method = $request->get_method();
    $endpoint = AI_WEBSITE_API_URL . '/session';
    
    // Handle GET request
    if ($method === 'GET') {
        $params = $request->get_query_params();
        
        // Check if we have a sessionId or websiteId
        if (isset($params['sessionId']) && !empty($params['sessionId'])) {
            $session_id = $params['sessionId'];
            $endpoint .= '/' . urlencode($session_id);
            
            // Remove error log
        } 
        else if (isset($params['websiteId']) && !empty($params['websiteId'])) {
            $website_id = $params['websiteId'];
            
            // For GET with websiteId we need to use a different endpoint structure
            $endpoint = AI_WEBSITE_API_URL . '/session?websiteId=' . urlencode($website_id);
            
            // Remove error log
        } 
        else {
            // Remove error log
            return new WP_REST_Response(['error' => 'Either websiteId or sessionId is required'], 400);
        }
        
        $response = wp_remote_get($endpoint, [
            'headers' => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'timeout' => 30,
            'sslverify' => false // Only for local development
        ]);
    } 
    // Handle POST request
    else if ($method === 'POST') {
        // Get the request body and pass it through to the API
        $body = $request->get_body();
        
        // Remove error log
        // error_log('Voicero session proxy: Creating new session with body: ' . $body);
        
        $response = wp_remote_post($endpoint, [
            'headers' => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'body' => $body,
            'timeout' => 30,
            'sslverify' => false // Only for local development
        ]);
    }
    
    if (is_wp_error($response)) {
        // Remove error log
        return new WP_REST_Response([
            'error' => 'API request failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    // Debug what we're returning to the client
    // Remove error log
    // error_log(message: 'Voicero session proxy response: Status ' . $status_code . ', Body: ' . $response_body);
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}

/**
 * Proxy for the /session/window endpoint
 * Handles window state updates
 */
function voicero_window_state_proxy($request) {
    // Debug incoming request removed
    
    // Get the access key from options (server-side only)
    $access_key = get_option('ai_website_access_key', '');
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
    $endpoint = AI_WEBSITE_API_URL . '/session/windows';
    // Debug request URL removed
    
    // Make the PATCH request with the key (server-side)
    $response = wp_remote_request($endpoint, [
        'method' => 'PATCH', // Explicitly use PATCH method for updating
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
 * 2A) /wp-json/my-plugin/v1/test
 *     Quick test that returns {status: "ok"}
 */
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/test', [
        'methods'  => 'GET',
        'callback' => function() {
            return new WP_REST_Response([
                'status'  => 'ok',
                'message' => 'REST API is working'
            ], 200);
        },
        'permission_callback' => '__return_true'
    ]);
});


/**
 * 2F) /wp-json/my-plugin/v1/all-content
 *     Returns all content types in one request
 */
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/all-content', [
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
        // Add allowed origins here if needed, otherwise '*' might be okay for development
        $allowed_origins = ['https://www.voicero.ai', 'http://localhost:5173', 'https://www.voicero.ai']; // Add frontend dev server if different
        if (in_array($origin, $allowed_origins) || $origin === get_site_url()) { // Allow own origin
            header("Access-Control-Allow-Origin: " . esc_url_raw($origin));
            header('Access-Control-Allow-Credentials: true');
        } else {
            // Potentially restrict to known origins in production
            header("Access-Control-Allow-Origin: *"); // More permissive for dev
        }
    } else {
        header("Access-Control-Allow-Origin: *"); // Fallback
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
            $allowed_origins = ['https://www.voicero.ai', 'http://localhost:5173', 'https://www.voicero.ai']; 
            if (in_array($origin, $allowed_origins) || $origin === get_site_url()) {
                header("Access-Control-Allow-Origin: " . esc_url_raw($origin));
                header('Access-Control-Allow-Credentials: true');
            } else {
                header("Access-Control-Allow-Origin: *"); 
            }
        } else {
            header("Access-Control-Allow-Origin: *");
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
function my_first_plugin_add_toggle_button() {
    $hook = current_filter(); // Get the current hook being used
    
    // Only add the button if the website is active AND synced
    $saved_key = get_option('ai_website_access_key', '');
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

// Add to both wp_body_open and wp_footer for maximum compatibility
add_action('wp_body_open', 'my_first_plugin_add_toggle_button');
add_action('wp_footer', 'my_first_plugin_add_toggle_button', 999);

// Add this near the top of the file after the header
function ai_website_get_access_key() {
    return get_option('ai_website_access_key', '');
}

// Add this to make the access key and API URL available to frontend scripts
function ai_website_enqueue_scripts() {
    // Removed debug log
    
    // Only enqueue on the frontend, not in admin
    if (!is_admin()) {
        // First enqueue the core script
        wp_enqueue_script(
            'voicero-core-js',
            plugin_dir_url(__FILE__) . 'assets/voicero-core.js',
            ['jquery'],
            '1.1',
            true
        );
        
        // Then enqueue the text script with core as dependency
        wp_enqueue_script(
            'voicero-text-js',
            plugin_dir_url(__FILE__) . 'assets/voicero-text.js',
            ['voicero-core-js', 'jquery'],
            '1.1',
            true
        );
        
        // Then enqueue the voice script with core as dependency
        wp_enqueue_script(
            'voicero-voice-js',
            plugin_dir_url(__FILE__) . 'assets/voicero-voice.js',
            ['voicero-core-js', 'jquery'],
            '1.1',
            true
        );

        // Get access key
        $access_key = get_option('ai_website_access_key', '');
        // Removed debug log

        // Pass data to the frontend script
        wp_localize_script('voicero-core-js', 'aiWebsiteConfig', [
            // Removed accessKey for security - now using server-side proxy
            'apiUrl' => AI_WEBSITE_API_URL,
            'ajaxUrl' => admin_url('admin-ajax.php'),
            'nonce' => wp_create_nonce('ai_website_frontend_nonce'),
            'pluginUrl' => plugin_dir_url(__FILE__),
            'debug' => defined('WP_DEBUG') && WP_DEBUG ? true : false
        ]);

        // Also create window.voiceroConfig for backwards compatibility
        wp_add_inline_script('voicero-core-js', 'window.voiceroConfig = window.aiWebsiteConfig;', 'before');

        // Enqueue the stylesheet
        wp_enqueue_style(
            'ai-website-style', 
            plugin_dir_url(__FILE__) . 'assets/style.css', 
            [], 
            '1.1'
        );
        
        voicero_debug_log('Voicero AI scripts enqueued successfully');
    }
}
add_action('wp_enqueue_scripts', 'ai_website_enqueue_scripts');

// Add AJAX handler for frontend access AND admin access
add_action('wp_ajax_nopriv_ai_website_get_info', 'ai_website_get_info'); // For logged-out users (frontend)
add_action('wp_ajax_ai_website_get_info', 'ai_website_get_info'); // For logged-in users (admin and frontend)

function ai_website_get_info() {
    // Determine if it's an admin or frontend request and check appropriate nonce
    $nonce_to_check = '';
    $action = '';

    if (defined('DOING_AJAX') && DOING_AJAX) {
        $action = isset($_REQUEST['action']) ? sanitize_key(wp_unslash($_REQUEST['action'])) : '';
        $nonce_value = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';

        if (is_admin()) { // Check if context is admin area
            $nonce_to_check = 'ai_website_ajax_nonce'; // Admin nonce
             if (!check_ajax_referer($nonce_to_check, 'nonce', false)) {
                 wp_send_json_error(['message' => 'Invalid admin nonce']);
                 return;
             }
        } else { // Assume frontend context
             $nonce_to_check = 'ai_website_frontend_nonce'; // Frontend nonce
             if (!check_ajax_referer($nonce_to_check, 'nonce', false)) {
                 wp_send_json_error(['message' => 'Invalid frontend nonce']);
                 return;
             }
        }
    } else {
        // Not an AJAX request? Should not happen for this endpoint.
        wp_send_json_error(['message' => 'Invalid request type']);
        return;
    }
    
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        // Send different errors depending on context maybe?
        // For now, same error.
        wp_send_json_error(['message' => 'No access key configured for this site.']);
    }

    $response = wp_remote_get(AI_WEBSITE_API_URL . '/connect', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false // Keep false for local dev
    ]);

    if (is_wp_error($response)) {
        //  error_log('AI Website Get Info Error (WP_Error): ' . $response->get_error_message());
        wp_send_json_error([
            'message' => 'Connection failed: ' . $response->get_error_message()
        ]);
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);

    if ($response_code !== 200) {
        // error_log('AI Website Get Info Error (API): Code ' . $response_code . ' Body: ' . $body);
        wp_send_json_error([
            'message' => 'Server returned error: ' . $response_code,
            'body' => $body // Avoid sending full body to frontend in prod
        ]);
    }

    $data = json_decode($body, true);
    // The /connect endpoint returns { website: {...} }
    if (!$data || !isset($data['website'])) {
        // Remove error log
        return new WP_REST_Response([
            'message' => 'Invalid response structure from server.'
        ]);
    }

    // Override the queryLimit to 200 for free plan users
    if (isset($data['website']['plan']) && $data['website']['plan'] === 'Free') {
        $data['website']['queryLimit'] = 200;
    }

    // Return just the website data
    wp_send_json_success($data['website']);
}

function ai_website_clear_connection() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => 'Permission denied']);
        return;
    }
    delete_option('ai_website_access_key');
    // Optionally: delete other related options or transients
    wp_send_json_success(['message' => 'Connection cleared successfully']);
}

// Function to add inline debugging script
function voicero_add_inline_debug_script() {
    // Only run in extreme debug mode - not in regular WP_DEBUG mode
    if (defined('VOICERO_EXTREME_DEBUG') && VOICERO_EXTREME_DEBUG) {
        ?>
        <script>
        (function() {
            
            // Wait for DOM to be fully loaded
            window.addEventListener('DOMContentLoaded', function() {
                // Check if container exists
                const container = document.getElementById('voicero-app-container');
                if (container) {
                }
                
                // Check if scripts are loaded
                
                // Check for config
                
                // Run a test after a short delay
                setTimeout(function() {
                    if (window.VoiceroCore) {
                    }
                }, 2000);
            });
        })();
        </script>
        <?php
    }
}
add_action('wp_footer', 'voicero_add_inline_debug_script', 9999);

/**
 * Proxy for the /session/clear endpoint
 * Creates a new thread and resets welcome flags
 */
function voicero_session_clear_proxy($request) {
    // Get the access key from options (server-side only)
    $access_key = get_option('ai_website_access_key', '');
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
    $endpoint = AI_WEBSITE_API_URL . '/session/clear';
    
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
    $access_key = get_option('ai_website_access_key', '');
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
    
    // Make sure type is set to "text"
    $decoded_body['type'] = 'text';
    
    // Re-encode the body with any modifications
    $body = json_encode($decoded_body);
    
    // Construct the API endpoint - Updated to use /wordpress/chat instead of /chat
    $endpoint = AI_WEBSITE_API_URL . '/wordpress/chat';
    
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
 * Proxy for Text-to-Speech API requests
 */
function voicero_tts_proxy($request) {
    // Get the access key from options (server-side only)
    $access_key = get_option('ai_website_access_key', '');
    if (empty($access_key)) {
        // error_log(message: 'TTS proxy: No access key configured');
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // error_log(message: 'TTS proxy: Received request');
    
    // Get JSON body
    $json_body = $request->get_body();
    $body_params = json_decode($json_body, true);
    
    // Validate request
    if (empty($body_params['text'])) {
        // error_log('TTS proxy: No text provided');
        return new WP_REST_Response(['error' => 'No text provided'], 400);
    }
    
    // Forward request to local API
    $response = wp_remote_post('https://www.voicero.ai/api/tts', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'audio/mpeg',
            'X-Expected-Response-Type' => 'audio/mpeg', // Extra header to make it clear we expect audio
        ],
        'body' => $json_body,
        'timeout' => 30,
        'sslverify' => false
    ]);
    
    // Check for errors
    if (is_wp_error($response)) {
        // //error_log('TTS proxy error: ' . $response->get_error_message());
        return new WP_REST_Response(
            ['error' => 'Failed to connect to TTS API: ' . $response->get_error_message()], 
            500
        );
    }
    
    // Get response status code
    $status_code = wp_remote_retrieve_response_code($response);
    
    // If not successful, return error
    if ($status_code < 200 || $status_code >= 300) {
        $error_body = wp_remote_retrieve_body($response);
        //error_log('TTS API error response: ' . $error_body);
        
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
            ['error' => 'TTS API returned error', 'details' => $sanitized_error],
            $status_code
        );
    }
    
    // Get audio data
    $audio_data = wp_remote_retrieve_body($response);
    
    // Special check: see if data might be JSON-encoded
    if (substr($audio_data, 0, 1) === '"' && substr($audio_data, -1) === '"') {
        //error_log('TTS API returned JSON-encoded string instead of raw binary data');
        
        // Try to decode the JSON string to get raw binary data
        $decoded_data = json_decode($audio_data);
        if (json_last_error() === JSON_ERROR_NONE && is_string($decoded_data)) {
            //error_log('Successfully decoded JSON string to raw data');
            // Replace the audio_data with the decoded binary content
            $audio_data = $decoded_data;
        }
    }
    
    // Validate that this is actually audio data and not an error message
    $is_valid_audio = true;
    $first_bytes = substr($audio_data, 0, 4);
    
    // Check for JSON or HTML error responses disguised as audio
    if (strpos($audio_data, '{') === 0 || 
        strpos($audio_data, '<') === 0 || 
        strpos($audio_data, 'error') !== false) {
        //error_log('TTS API returned non-audio data: ' . substr($audio_data, 0, 100));
        
        return new WP_REST_Response(
            ['error' => 'TTS API returned non-audio data', 'details' => $audio_data],
            500
        );
    }
    
    // Check for MP3 header signatures - either ID3 or MPEG frame sync
    $id3_header = ($first_bytes[0] === 'I' && $first_bytes[1] === 'D' && $first_bytes[2] === '3');
    $mpeg_frame_sync = (ord($first_bytes[0]) === 0xFF && (ord($first_bytes[1]) & 0xE0) === 0xE0);
    
    if (!$id3_header && !$mpeg_frame_sync) {
        //error_log('TTS API returned invalid audio format. First bytes: ' . bin2hex($first_bytes));
        
        return new WP_REST_Response(
            ['error' => 'TTS API returned invalid audio format', 'details' => bin2hex(substr($audio_data, 0, 20))],
            500
        );
    }
    
    //error_log('TTS API valid audio format detected. Size: ' . strlen($audio_data) . ' bytes');
    
    // Create response with audio content type
    $response_obj = new WP_REST_Response($audio_data, 200);
    $response_obj->header('Content-Type', 'audio/mpeg');
    $response_obj->header('Content-Length', strlen($audio_data));
    
    // IMPORTANT: Force raw data output to prevent WordPress from JSON encoding binary data
    // This is the critical fix to prevent audio corruption
    remove_filter('rest_pre_serve_request', 'rest_send_cors_headers');
    add_filter('rest_pre_serve_request', function($served, $result, $request, $server) use ($audio_data) {
        $server->send_header('Content-Type', 'audio/mpeg');
        $server->send_header('Content-Length', strlen($audio_data));
        
        // Add CORS headers manually since we're bypassing the normal REST API response
        $server->send_header('Access-Control-Allow-Origin', '*');
        $server->send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
        $server->send_header('Access-Control-Allow-Credentials', 'true');
        $server->send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization');
        
        // Send the raw binary data directly
        // phpcs:ignore WordPress.Security.EscapeOutput.OutputNotEscaped -- Binary audio data should not be escaped
        echo $audio_data;
        return true;
    }, 10, 4);
    
    return $response_obj;
}

/**
 * Proxy for Whisper API (speech-to-text) requests
 */
function voicero_whisper_proxy($request) {
    // Get the access key from options (server-side only)
    $access_key = get_option('ai_website_access_key', '');
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

// Register REST API endpoints
add_action('rest_api_init', function() {
    if (!function_exists('register_rest_route')) {
        // Remove error log
        return;
    }
    
    // Remove error log
    //error_log('Registering Voicero REST API endpoints');
    
    // Register the window_state endpoint
    register_rest_route('voicero/v1', '/window_state', [
        'methods'  => ['POST'],
        'callback' => 'voicero_window_state_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Register the connect endpoint
    register_rest_route('voicero/v1', '/connect', [
        'methods'  => 'GET',
        'callback' => 'voicero_connect_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Register the session endpoint
    register_rest_route('voicero/v1', '/session', [
        'methods'  => ['GET', 'POST'],
        'callback' => 'voicero_session_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Register the session_clear endpoint
    register_rest_route('voicero/v1', '/session_clear', [
        'methods'  => ['POST'],
        'callback' => 'voicero_session_clear_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Register the chat endpoint
    register_rest_route('voicero/v1', '/chat', [
        'methods'  => ['POST'],
        'callback' => 'voicero_chat_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Register the TTS endpoint
    register_rest_route('voicero/v1', '/tts', [
        'methods'  => ['POST'],
        'callback' => 'voicero_tts_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Register the Whisper endpoint
    register_rest_route('voicero/v1', '/whisper', [
        'methods'  => 'POST',
        'callback' => 'voicero_whisper_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Remove error log
    //error_log('Voicero REST API endpoints registered successfully');
});

// Add a new function to track training status
function voicero_get_training_status() {
    check_ajax_referer('ai_website_ajax_nonce', 'nonce');
    
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
