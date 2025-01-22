<?php
/**
 * Plugin Name: AI-Website
 * Description: Example plugin that shows all pages in JSON on an admin page and sets up custom REST endpoints for AI usage.
 * Version: 1.1
 * Author: Your Name
 */

if (!defined('ABSPATH')) {
    exit; // Prevent direct access
}

/* ------------------------------------------------------------------------
   1. ADMIN PAGE TO DISPLAY PAGES IN JSON
------------------------------------------------------------------------ */
add_action('admin_menu', 'ai_website_add_admin_page');
function ai_website_add_admin_page() {
    add_menu_page(
        'AI-Website',         // Page <title>
        'AI-Website',         // Menu label
        'manage_options',     // Capability required
        'ai-website-admin',   // Menu slug (unique ID)
        'ai_website_render_admin_page', // Callback that renders the page
        'dashicons-analytics',// Icon (dashicons)
        100                   // Position in the menu
    );
}

function ai_website_render_admin_page() {
    // Check if refresh button was clicked
    if (isset($_POST['refresh_content']) && check_admin_referer('refresh_content_nonce')) {
        // We'll add a success message
        add_settings_error('my_plugin_messages', 'content_refreshed', 'Content refreshed successfully!', 'updated');
    }

    // Pull all published pages
    $all_pages = get_pages([
        'post_status' => 'publish',
        'sort_order'  => 'asc',
        'sort_column' => 'post_title'
    ]);

    // Pull all published posts
    $all_posts = get_posts([
        'post_status' => 'publish',
        'numberposts' => -1
    ]);

    // Pull all products if WooCommerce is active
    $all_products = [];
    if (class_exists('WC_Product_Query')) {
        $query = new WC_Product_Query([
            'status' => 'publish',
            'limit'  => -1,
        ]);
        $all_products = $query->get_products();
    }

    // Format pages
    $formatted_pages = [];
    foreach ($all_pages as $page) {
        // Clean up the content by:
        // 1. Removing extra whitespace and newlines
        // 2. Converting multiple spaces to single space
        // 3. Trimming whitespace from start/end
        $clean_content = wp_strip_all_tags($page->post_content);  // First strip HTML
        $clean_content = preg_replace('/\s+/', ' ', $clean_content);  // Replace multiple spaces/newlines with single space
        $clean_content = trim($clean_content);  // Remove leading/trailing whitespace

        $formatted_pages[] = [
            'id'      => $page->ID,
            'title'   => $page->post_title,
            'content' => $clean_content,
            'url'     => get_permalink($page->ID),
        ];
    }

    // Format posts
    $formatted_posts = [];
    foreach ($all_posts as $post) {
        $clean_content = wp_strip_all_tags($post->post_content);
        $clean_content = preg_replace('/\s+/', ' ', $clean_content);
        $clean_content = trim($clean_content);

        $formatted_posts[] = [
            'id'      => $post->ID,
            'title'   => $post->post_title,
            'content' => $clean_content,
            'url'     => get_permalink($post->ID),
        ];
    }

    // Format products
    $formatted_products = [];
    foreach ($all_products as $product) {
        $clean_description = wp_strip_all_tags($product->get_description());
        $clean_description = preg_replace('/\s+/', ' ', $clean_description);
        $clean_description = trim($clean_description);

        $clean_short_description = wp_strip_all_tags($product->get_short_description());
        $clean_short_description = preg_replace('/\s+/', ' ', $clean_short_description);
        $clean_short_description = trim($clean_short_description);

        $categories = wp_get_post_terms($product->get_id(), 'product_cat', ['fields' => 'names']);
        
        $attributes = [];
        foreach ($product->get_attributes() as $attribute) {
            $attributes[] = [
                'name' => wc_attribute_label($attribute->get_name()),
                'options' => $attribute->get_options(),
            ];
        }

        $formatted_products[] = [
            'id'          => $product->get_id(),
            'title'       => $product->get_name(),
            'price'       => $product->get_price(),
            'sale_price'  => $product->get_sale_price(),
            'regular_price' => $product->get_regular_price(),
            'content'     => $clean_description,
            'short_description' => $clean_short_description,
            'link'        => get_permalink($product->get_id()),
            'image'       => wp_get_attachment_url($product->get_image_id()),
            'categories'  => $categories,
            'attributes'  => $attributes,
            'sku'         => $product->get_sku(),
            'stock_status' => $product->get_stock_status(),
            'in_stock'    => $product->is_in_stock(),
        ];
    }

    // Combine all data
    $all_data = [
        'pages' => $formatted_pages,
        'posts' => $formatted_posts,
        'products' => $formatted_products,
        'timestamp' => current_time('mysql')
    ];

    // Output as pretty HTML
    echo '<div class="wrap">';
    echo '<h1>My Plugin: All Content</h1>';
    
    // Show any admin notices
    settings_errors('my_plugin_messages');

    // Add refresh button
    echo '<form method="post">';
    wp_nonce_field('refresh_content_nonce');
    echo '<p><input type="submit" name="refresh_content" class="button button-primary" value="Refresh Content"></p>';
    echo '</form>';

    // Add tabs for different content types
    echo '<div class="nav-tab-wrapper">';
    echo '<a href="#" class="nav-tab nav-tab-active" data-tab="all">All Data</a>';
    echo '<a href="#" class="nav-tab" data-tab="pages">Pages</a>';
    echo '<a href="#" class="nav-tab" data-tab="posts">Posts</a>';
    echo '<a href="#" class="nav-tab" data-tab="products">Products</a>';
    echo '</div>';

    // Content sections
    echo '<div class="tab-content" id="tab-all" style="display:block;">';
    echo '<h2>All Data</h2>';
    echo '<pre>' . esc_html(wp_json_encode($all_data, JSON_PRETTY_PRINT)) . '</pre>';
    echo '</div>';

    echo '<div class="tab-content" id="tab-pages" style="display:none;">';
    echo '<h2>Pages</h2>';
    echo '<pre>' . esc_html(wp_json_encode($formatted_pages, JSON_PRETTY_PRINT)) . '</pre>';
    echo '</div>';

    echo '<div class="tab-content" id="tab-posts" style="display:none;">';
    echo '<h2>Posts</h2>';
    echo '<pre>' . esc_html(wp_json_encode($formatted_posts, JSON_PRETTY_PRINT)) . '</pre>';
    echo '</div>';

    echo '<div class="tab-content" id="tab-products" style="display:none;">';
    echo '<h2>Products</h2>';
    echo '<pre>' . esc_html(wp_json_encode($formatted_products, JSON_PRETTY_PRINT)) . '</pre>';
    echo '</div>';

    // Add inline JavaScript for tab switching
    echo '<script>
        document.addEventListener("DOMContentLoaded", function() {
            const tabs = document.querySelectorAll(".nav-tab");
            tabs.forEach(tab => {
                tab.addEventListener("click", function(e) {
                    e.preventDefault();
                    
                    // Remove active class from all tabs
                    tabs.forEach(t => t.classList.remove("nav-tab-active"));
                    
                    // Add active class to clicked tab
                    this.classList.add("nav-tab-active");
                    
                    // Hide all content sections
                    document.querySelectorAll(".tab-content").forEach(content => {
                        content.style.display = "none";
                    });
                    
                    // Show selected content section
                    const tabId = "tab-" + this.dataset.tab;
                    document.getElementById(tabId).style.display = "block";
                });
            });
        });
    </script>';

    echo '</div>'; // Close wrap div
}

/* ------------------------------------------------------------------------
   2. REGISTER REST API ENDPOINTS
------------------------------------------------------------------------ */
// Optional debug logs for REST initialization
add_action('rest_api_init', function() {
    error_log('REST API initialized from My First Plugin');
});

// Force-enable the REST API if something else is blocking it
add_action('init', function() {
    remove_filter('rest_authentication_errors', 'restrict_rest_api');
    add_filter('rest_enabled', '__return_true');
    add_filter('rest_jsonp_enabled', '__return_true');
});

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
 * 2E) /wp-json/my-plugin/v1/products
 *     Returns all published WooCommerce products with additional details
 */
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/products', [
        'methods'  => 'GET',
        'callback' => function() {
            if (!class_exists('WC_Product_Query')) {
                return new WP_REST_Response(['error' => 'WooCommerce not installed'], 500);
            }

            // Query WooCommerce products
            $args = [
                'status' => 'publish',
                'limit'  => -1, // Get all products
            ];
            $query = new WC_Product_Query($args);
            $products = $query->get_products();

            $formatted_products = [];
            foreach ($products as $product) {
                // Get product categories
                $categories = wp_get_post_terms($product->get_id(), 'product_cat', ['fields' => 'names']);
                
                // Get product attributes
                $attributes = [];
                foreach ($product->get_attributes() as $attribute) {
                    $attributes[] = [
                        'name' => wc_attribute_label($attribute->get_name()),
                        'options' => $attribute->get_options(),
                    ];
                }

                $formatted_products[] = [
                    'id'          => $product->get_id(),
                    'title'       => $product->get_name(),
                    'price'       => $product->get_price(),
                    'sale_price'  => $product->get_sale_price(),
                    'regular_price' => $product->get_regular_price(),
                    'content'     => wp_strip_all_tags($product->get_description()),
                    'short_description' => wp_strip_all_tags($product->get_short_description()),
                    'link'        => get_permalink($product->get_id()),
                    'image'       => wp_get_attachment_url($product->get_image_id()),
                    'categories'  => $categories,
                    'attributes'  => $attributes,
                    'sku'         => $product->get_sku(),
                    'stock_status' => $product->get_stock_status(),
                    'in_stock'    => $product->is_in_stock(),
                ];
            }

            return new WP_REST_Response($formatted_products, 200);
        },
        'permission_callback' => '__return_true'
    ]);
});

/**
 * 2B) /wp-json/my-plugin/v1/pages
 *     Returns all published pages (with stripped content)
 */
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/pages', [
        'methods'  => 'GET',
        'callback' => function() {
            $all_pages = get_pages(['post_status' => 'publish']);
            $formatted_pages = [];

            foreach ($all_pages as $page) {
                $formatted_pages[] = [
                    'id'      => $page->ID,
                    'title'   => $page->post_title,
                    'content' => wp_strip_all_tags($page->post_content),
                    'link'    => get_permalink($page->ID),
                    'is_home' => ($page->ID == get_option('page_on_front'))
                ];
            }

            return new WP_REST_Response($formatted_pages, 200);
        },
        'permission_callback' => '__return_true'
    ]);
});

/**
 * 2C) /wp-json/my-plugin/v1/site-info
 *     Basic site info
 */
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/site-info', [
        'methods'  => 'GET',
        'callback' => function() {
            return new WP_REST_Response([
                'name'           => get_bloginfo('name'),
                'description'    => get_bloginfo('description'),
                'url'            => home_url(),
                'front_page_id'  => get_option('page_on_front'),
                'page_for_posts' => get_option('page_for_posts')
            ], 200);
        },
        'permission_callback' => '__return_true'
    ]);
});

/**
 * 2D) /wp-json/my-plugin/v1/posts
 *     Returns all published blog posts
 */
add_action('rest_api_init', function() {
    register_rest_route('my-plugin/v1', '/posts', [
        'methods'  => 'GET',
        'callback' => function() {
            $posts = get_posts([
                'post_type'   => 'post',
                'post_status' => 'publish',
                'numberposts' => -1
            ]);

            $formatted_posts = [];
            foreach ($posts as $p) {
                $formatted_posts[] = [
                    'id'      => $p->ID,
                    'title'   => $p->post_title,
                    'content' => wp_strip_all_tags($p->post_content),
                    'link'    => get_permalink($p->ID),
                ];
            }

            return new WP_REST_Response($formatted_posts, 200);
        },
        'permission_callback' => '__return_true'
    ]);
});

/* ------------------------------------------------------------------------
   3. (OPTIONAL) CORS HEADERS
------------------------------------------------------------------------ */
add_action('init', function() {
    header("Access-Control-Allow-Origin: *");
    header("Access-Control-Allow-Methods: GET, POST, OPTIONS");
    header("Access-Control-Allow-Headers: Content-Type");
});

/* ------------------------------------------------------------------------
   4. ENQUEUE ASSETS (script.js & style.css)
------------------------------------------------------------------------ */
function my_first_plugin_enqueue_scripts() {
    // Make sure 'assets/script.js' actually exists in your plugin folder
    wp_enqueue_style('my-first-plugin-style', plugin_dir_url(__FILE__) . 'assets/style.css', [], '1.1');
    wp_enqueue_script('recordrtc', 'https://www.WebRTC-Experiment.com/RecordRTC.js', [], '1.0.0', true);
    wp_enqueue_script(
        'my-first-plugin-script',
        plugin_dir_url(__FILE__) . 'assets/script.js',
        ['recordrtc'],
        '1.1',
        true
    );
}
add_action('wp_enqueue_scripts', 'my_first_plugin_enqueue_scripts');

/* ------------------------------------------------------------------------
   5. ADD FRONT-END INTERFACES TO <body>
------------------------------------------------------------------------ */
function my_first_plugin_add_toggle_button() {
    echo '
    <div id="voice-toggle-container">
        <span>AI Assistant</span>
        <div class="toggle" id="main-voice-toggle">
            <div class="toggle-handle"></div>
        </div>
    </div>

    <div id="interaction-chooser">
        <div class="interaction-option voice">
            <img src="' . plugin_dir_url(__FILE__) . 'assets/mic-icon.png" alt="Voice">
            <span>Talk to Website</span>
        </div>
        <div class="interaction-option text">
            <img src="' . plugin_dir_url(__FILE__) . 'assets/keyboard.png" alt="Text">
            <span>Type to Website</span>
        </div>
    </div>

    <!-- Voice Interface -->
    <div id="voice-interface" class="interface-panel">
        <div class="interface-content">
            <button id="close-voice">×</button>
            <div class="voice-status-container">
                <div class="recording-waves">
                    <div class="wave"></div>
                    <div class="wave"></div>
                    <div class="wave"></div>
                </div>
                <div class="ai-speaking-indicator">AI is speaking...</div>
            </div>
            <button id="mic-button" title="Click to start/stop recording">
                <img src="' . plugin_dir_url(__FILE__) . 'assets/mic-icon.png" alt="Microphone">
                <span>Start</span>
            </button>
            <div id="transcript-container">
                <div class="transcript-line">
                    <strong>User:</strong> <span class="transcript-text"></span>
                </div>
                <div class="transcript-line ai-response">
                    <strong>AI:</strong> <span></span>
                </div>
            </div>
        </div>
    </div>

    <!-- Text Interface -->
    <div id="text-interface" class="interface-panel">
        <div class="interface-content">
            <button id="close-text">×</button>
            <div class="chat-container">
                <div id="chat-messages"></div>
                <div class="chat-input-container">
                    <input type="text" id="chat-input" placeholder="Type your message...">
                    <button id="send-message">Send</button>
                </div>
            </div>
        </div>
    </div>

    <!-- Hidden Popup (Content Collection) -->
    <div id="voice-popup">
      <div class="voice-popup-content">
      </div>
    </div>
    ';
}
add_action('wp_body_open', 'my_first_plugin_add_toggle_button');
