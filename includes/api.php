<?php
/**
 * API and proxy endpoints for Voicero.AI
 */

if (!defined('ABSPATH')) {
    exit; // Prevent direct access
}

// Define the API base URL if not already defined
if (!defined('VOICERO_API_URL')) {
    define('VOICERO_API_URL', 'http://localhost:3000/api');
}

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
    
    // Register the session/windows endpoint used by the JavaScript
    register_rest_route('voicero/v1', '/session/windows', [
        'methods'  => ['POST'],
        'callback' => 'voicero_window_state_proxy',
        'permission_callback' => '__return_true'
    ]);
    
    // Alternative endpoint without nested path
    register_rest_route('voicero/v1', '/window_state', [
        'methods'  => ['POST'],
        'callback' => 'voicero_window_state_proxy',
        'permission_callback' => '__return_true'
    ]);

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

    // 10) Second Look analysis endpoint
    register_rest_route(
        'voicero/v1',
        '/wordpress/secondLook',
        [
            'methods'             => 'POST',
            'callback'            => 'voicero_second_look_proxy',
            'permission_callback' => '__return_true', // Allow all users to use the second look feature
        ]
    );

    // Register the websites/get endpoint
    register_rest_route(
        'voicero/v1',
        '/websites/get',
        [
            'methods'             => 'GET',
            'callback'            => 'voicero_websites_get_proxy',
            'permission_callback' => '__return_true',
        ]
    );

    // Register the website auto features update endpoint
    register_rest_route(
        'voicero/v1',
        '/website-auto-features',
        [
            'methods'             => 'POST',
            'callback'            => 'voicero_website_auto_features_proxy',
            'permission_callback' => function() {
                // Allow access to site administrators or through valid API request
                return current_user_can('manage_options') || 
                       (isset($_SERVER['HTTP_X_VOICERO_API']) && $_SERVER['HTTP_X_VOICERO_API'] === get_option('voicero_api_secret', ''));
            },
        ]
    );
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

function voicero_session_proxy(WP_REST_Request $request) {
    // 1) Pull the server-side access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        return new WP_REST_Response(
            ['error' => esc_html__('No access key configured', 'voicero-ai')],
            403
        );
    }

    // 2) Base URL
    $base = rtrim(VOICERO_API_URL, '/') . '/session';

    // 3) Handle GET — must use query-string, NOT a path segment
    if ('GET' === $request->get_method()) {
        $sessionId = $request->get_param('sessionId');
        $websiteId = $request->get_param('websiteId');

        if ($sessionId) {
            $endpoint = $base . '?sessionId=' . rawurlencode($sessionId);
        } elseif ($websiteId) {
            $endpoint = $base . '?websiteId=' . rawurlencode($websiteId);
        } else {
            return new WP_REST_Response(
                ['error' => esc_html__('Either sessionId or websiteId is required', 'voicero-ai')],
                400
            );
        }

        $response = wp_remote_get(esc_url_raw($endpoint), [
            'headers'   => [
                'Authorization' => 'Bearer ' . $access_key,
                'Accept'        => 'application/json',
            ],
            'timeout'   => 30,
            'sslverify' => false,
        ]);
    }
    // 4) Handle POST — pass through body to create a new session
    else {
        $endpoint = $base;
        $body     = $request->get_body();
        $response = wp_remote_post($endpoint, [
            'headers'   => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type'  => 'application/json',
                'Accept'        => 'application/json',
            ],
            'body'      => $body,
            'timeout'   => 30,
            'sslverify' => false,
        ]);
    }

    // 5) Error?
    if (is_wp_error($response)) {
        return new WP_REST_Response(
            ['error' => 'API request failed: ' . $response->get_error_message()],
            500
        );
    }

    // 6) Forward the API's JSON back to the caller
    $status_code   = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $data          = json_decode($response_body, true);

    return new WP_REST_Response($data, $status_code);
}

function voicero_window_state_proxy($request) {
    // Get the access key from options (server-side only)
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // Get the request body
    $body = $request->get_body();
    
    // Decode the body to validate it has the required fields
    $decoded_body = json_decode($body, true);
    if (!isset($decoded_body['sessionId']) || !isset($decoded_body['windowState'])) {
        return new WP_REST_Response(['error' => 'Session ID and window state are required'], 400);
    }
    
    // Ensure session ID is a properly formatted string
    $session_id = trim($decoded_body['sessionId']);
    if (empty($session_id)) {
        return new WP_REST_Response(['error' => 'Valid Session ID is required'], 400);
    }
    
    // Construct the API endpoint
    $endpoint = VOICERO_API_URL . '/session/windows';
    
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
        return new WP_REST_Response([
            'error' => 'API request failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}

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
 * Proxy for the SecondLook feature that analyzes forms and product pages
 * 
 * @param WP_REST_Request $request The incoming request
 * @return WP_REST_Response The response from the API
 */
function voicero_second_look_proxy($request) {
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
    
    // Check for either websitePageData or formData (backward compatibility)
    if (!isset($decoded_body['websitePageData']) && (!isset($decoded_body['formData']) || !is_array($decoded_body['formData']))) {
        return new WP_REST_Response(['error' => 'Website page data is required'], 400);
    }
    
    // Construct the API endpoint
    $endpoint = VOICERO_API_URL . '/wordpress/secondLook';
    
    // Log the request for debugging
    error_log('VoiceroSecondLook: Forwarding request to ' . $endpoint);
    error_log('VoiceroSecondLook: Original request body (first 1000 chars): ' . substr($body, 0, 1000));
    
    // If we got websitePageData, ensure it's correctly handled before forwarding
    if (isset($decoded_body['websitePageData'])) {
        // Convert websitePageData to formData format according to the API's expectations
        $formData = [
            'forms' => [],
            'url' => $decoded_body['url'] ?? $decoded_body['websitePageData']['url'] ?? ''
        ];
        
        // Extract forms from websitePageData if they exist
        if (isset($decoded_body['websitePageData']['forms']) && is_array($decoded_body['websitePageData']['forms'])) {
            foreach ($decoded_body['websitePageData']['forms'] as $idx => $form) {
                // Structure the form data according to the expected API format
                $formFields = [];
                
                // Try to extract input fields if available
                if (isset($decoded_body['websitePageData']['inputs']) && is_array($decoded_body['websitePageData']['inputs'])) {
                    foreach ($decoded_body['websitePageData']['inputs'] as $input) {
                        $formFields[] = [
                            'name' => $input['name'] ?? $input['id'] ?? 'field_' . rand(1000, 9999),
                            'type' => $input['type'] ?? 'text',
                            'label' => $input['label'] ?? $input['placeholder'] ?? '',
                            'placeholder' => $input['placeholder'] ?? '',
                            'required' => false
                        ];
                    }
                }
                
                $formData['forms'][] = [
                    'form_id' => $form['id'] ?? 'form_' . ($idx + 1),
                    'title' => 'Form ' . ($idx + 1),
                    'fields' => $formFields,
                    'submit_text' => 'Submit'
                ];
            }
        }
        
        // Replace the old formData with our new structure
        $decoded_body['formData'] = $formData;
        
        // Re-encode the body with the new structure
        $body = json_encode($decoded_body);
        
        // Log the transformed request for debugging
        error_log('VoiceroSecondLook: Transformed request body: ' . substr($body, 0, 1000));
    }
    
    // Make the POST request with the key (server-side)
    $response = wp_remote_post($endpoint, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => $body,
        'timeout' => 30, // Longer timeout for analysis
        'sslverify' => false // Only for local development
    ]);
    
    if (is_wp_error($response)) {
        error_log('VoiceroSecondLook: API request failed: ' . $response->get_error_message());
        return new WP_REST_Response([
            'error' => 'API request failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Return the API response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    error_log('VoiceroSecondLook: API response status: ' . $status_code);
    
    return new WP_REST_Response(json_decode($response_body, true), $status_code);
}

function voicero_tts_proxy(WP_REST_Request $request) {
    /* 1. Guard clauses ---------------------------------------------------- */
    $access_key = get_option('voicero_access_key', '');
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }

    $json_body   = $request->get_body();
    $body_params = json_decode($json_body, true);

    if (empty($body_params['text'])) {
        return new WP_REST_Response(['error' => 'No text provided'], 400);
    }

    /* 2. Forward to Voicero API ------------------------------------------- */
    $response = wp_remote_post(
        'http://localhost:3000/api/tts',
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

    if (is_wp_error($response)) {
        return new WP_REST_Response(
            ['error' => 'Failed to connect to TTS API: ' . $response->get_error_message()],
            500
        );
    }

    $status_code = wp_remote_retrieve_response_code($response);
    if ($status_code < 200 || $status_code >= 300) {
        return new WP_REST_Response(
            [
                'error'   => 'TTS API returned error',
                'details' => wp_remote_retrieve_body($response),
            ],
            $status_code
        );
    }

    $audio_data = wp_remote_retrieve_body($response);

    /* Basic sanity check (ID3 or MPEG‑sync) */
    if (!str_starts_with($audio_data, 'ID3')
         && (ord($audio_data[0]) !== 0xFF || (ord($audio_data[1]) & 0xE0) !== 0xE0)) {
        return new WP_REST_Response(
            ['error' => 'Invalid audio payload from TTS API'],
            500
        );
    }

    /* 3. Save the MP3 to uploads ----------------------------------------- */
    $upload_dir = wp_upload_dir();
    $subdir     = trailingslashit($upload_dir['basedir']) . 'voicero';

    if (!file_exists($subdir)) {
        wp_mkdir_p($subdir);
    }

    $filename   = 'tts-' . gmdate('Ymd-His') . '-' . wp_generate_password(6, false) . '.mp3';
    $saved      = wp_upload_bits($filename, null, $audio_data, 'voicero');

    if ($saved['error']) {
        return new WP_REST_Response(
            ['error' => 'Failed to write audio file: ' . esc_html($saved['error'])],
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

function voicero_whisper_proxy($request) {
    // Get the access key from options (server-side only)
    $access_key = get_option('voicero_access_key', '');
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => 'No access key configured'], 403);
    }
    
    // Get the uploaded file
    $files = $request->get_file_params();
    if (empty($files['audio']) || !isset($files['audio']['tmp_name'])) {
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
    $response = wp_remote_post('http://localhost:3000/api/whisper', [
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
        return new WP_REST_Response(
            ['error' => 'Failed to connect to Whisper API: ' . $response->get_error_message()], 
            500
        );
    }
    
    // Get response status code
    $status_code = wp_remote_retrieve_response_code($response);
    
    // If not successful, return error
    if ($status_code < 200 || $status_code >= 300) {
        $error_body = wp_remote_retrieve_body($response);
        
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
    $response = wp_remote_post('http://localhost:3000/api/support/help', [
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
    $response = wp_remote_post('http://localhost:3000/api/contacts/help', [
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

function voicero_websites_get_proxy(WP_REST_Request $request) {
    // Get the access key from options (server-side only)
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        return new WP_REST_Response(['error' => esc_html__('No access key configured', 'voicero-ai')], 403);
    }
    
    // Extract websiteId from query parameters
    $website_id = $request->get_param('id');
    if (empty($website_id)) {
        return new WP_REST_Response(['error' => esc_html__('Website ID is required', 'voicero-ai')], 400);
    }
    
    // Construct the API endpoint
    $endpoint = VOICERO_API_URL . '/websites/get?id=' . urlencode($website_id);
    
    // Make the API request with the key (server-side)
    $response = wp_remote_get($endpoint, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);
    
    if (is_wp_error($response)) {
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
 * Handle AJAX requests for website info from both frontend and admin
 */
add_action('wp_ajax_nopriv_voicero_get_info', 'voicero_get_info'); // For logged-out users (frontend)
add_action('wp_ajax_voicero_get_info', 'voicero_get_info'); // For logged-in users (admin and frontend)

/**
 * Handle AJAX requests for detailed website data
 */
add_action('wp_ajax_voicero_websites_get', 'voicero_websites_get_ajax');

/**
 * Handle AJAX requests for user information
 */
add_action('wp_ajax_voicero_get_user_info', 'voicero_get_user_info_ajax');

function voicero_websites_get_ajax() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Grab & verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check if we have an ID
    $website_id = isset($_REQUEST['id']) ? sanitize_text_field(wp_unslash($_REQUEST['id'])) : '';
    if (empty($website_id)) {
        wp_send_json_error(['message' => esc_html__('Website ID is required', 'voicero-ai')], 400);
        return;
    }

    // 4) Get the access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')], 403);
        return;
    }

    // 5) Make the API request
    $endpoint = VOICERO_API_URL . '/websites/get?id=' . urlencode($website_id);
    $response = wp_remote_get($endpoint, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }

    // 6) Process the response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $data = json_decode($response_body, true);

    if ($status_code !== 200 || !$data) {
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %d: HTTP status code */
                esc_html__('Server returned error: %d', 'voicero-ai'),
                intval($status_code)
            ),
            'body' => wp_kses_post($response_body)
        ]);
        return;
    }

    // 7) Return the data
    wp_send_json_success($data);
}

function voicero_get_user_info_ajax() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }
    
    // 3) Check if we have a website ID
    $website_id = isset($_REQUEST['websiteId']) ? sanitize_text_field(wp_unslash($_REQUEST['websiteId'])) : '';
    if (empty($website_id)) {
        wp_send_json_error(['message' => esc_html__('Website ID is required', 'voicero-ai')], 400);
        return;
    }

    // 4) Get the access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')], 403);
        return;
    }

    // 5) Make the API request to the users/me endpoint
    $endpoint = VOICERO_API_URL . '/user/me?websiteId=' . urlencode($website_id);
    error_log('Requesting user info from endpoint: ' . $endpoint);
    
    $response = wp_remote_get($endpoint, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);

    if (is_wp_error($response)) {
        error_log('Error requesting user info: ' . $response->get_error_message());
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }

    // 6) Process the response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $data = json_decode($response_body, true);

    // Log the response for debugging
    error_log('User info API response - Status: ' . $status_code);
    error_log('User info API response - Body: ' . substr($response_body, 0, 1000)); // Log first 1000 chars
    
    if ($status_code !== 200 || !$data) {
        error_log('Error in user info response: Status ' . $status_code);
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %d: HTTP status code */
                esc_html__('Server returned error: %d', 'voicero-ai'),
                intval($status_code)
            ),
            'body' => wp_kses_post($response_body)
        ]);
        return;
    }

    // Check if email field exists
    if (empty($data['email'])) {
        error_log('Warning: Email field is missing from user info response');
        // Continue anyway - don't stop processing just because email is missing
    }

    // 7) Return the user data
    wp_send_json_success($data);
}

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

/**
 * Handle login requests via AJAX
 */
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

/**
 * Check if the chat is available 
 */
add_action('wp_ajax_voicero_check_availability', 'voicero_check_availability');
add_action('wp_ajax_nopriv_voicero_check_availability', 'voicero_check_availability');

function voicero_check_availability() {
    // Verify nonce
    if (!isset($_POST['nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['nonce'])), 'voicero_frontend_nonce')) {
        wp_send_json_error(['message' => esc_html__('Security check failed', 'voicero-ai')]);
    }

    // Get access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai'), 'available' => false]);
    }

    // Make API request to check if website is active
    $response = wp_remote_get(VOICERO_API_URL . '/websites/status', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false
    ]);

    if (is_wp_error($response)) {
        // For frontend, still return success with available=false
        wp_send_json_success([
            'available' => false,
            'message' => esc_html__('Error checking availability', 'voicero-ai')
        ]);
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);

    if ($response_code !== 200 || !$data) {
        // For frontend, still return success with available=false
        wp_send_json_success([
            'available' => false,
            'message' => esc_html__('Website not activated', 'voicero-ai')
        ]);
    }

    // Check if the website is active and synced
    $is_active = isset($data['active']) ? (bool)$data['active'] : false;
    $is_synced = isset($data['lastSyncedAt']) && !empty($data['lastSyncedAt']);

    // Only available if both active and synced
    $is_available = $is_active && $is_synced;

    // Get conversation ID from cookie if it exists
    $conversation_id = isset($_COOKIE['voicero_conversation_id']) ? sanitize_text_field($_COOKIE['voicero_conversation_id']) : null;

    wp_send_json_success([
        'available' => $is_available,
        'active' => $is_active,
        'synced' => $is_synced,
        'conversation_id' => $conversation_id,
        'messages' => [] // No saved messages for now
    ]);
}

/**
 * Handle chat messages
 */
add_action('wp_ajax_voicero_chat_message', 'voicero_chat_message');
add_action('wp_ajax_nopriv_voicero_chat_message', 'voicero_chat_message');

function voicero_chat_message() {
    // Verify nonce
    if (!isset($_POST['nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['nonce'])), 'voicero_frontend_nonce')) {
        wp_send_json_error(['message' => esc_html__('Security check failed', 'voicero-ai')]);
    }

    // Get the message from POST data
    if (!isset($_POST['message']) || empty($_POST['message'])) {
        wp_send_json_error(['message' => esc_html__('No message provided', 'voicero-ai')]);
    }

    $message = sanitize_textarea_field(wp_unslash($_POST['message']));
    $conversation_id = isset($_POST['conversation_id']) ? sanitize_text_field(wp_unslash($_POST['conversation_id'])) : null;

    // Get access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')]);
    }

    // Prepare API request
    $api_url = VOICERO_API_URL . '/chat';
    
    // Get current page URL and title to provide context
    $current_url = isset($_SERVER['HTTP_REFERER']) ? esc_url_raw(wp_unslash($_SERVER['HTTP_REFERER'])) : '';
    $current_title = '';
    
    // Get page metadata if possible
    if (!empty($current_url)) {
        $current_post_id = url_to_postid($current_url);
        if ($current_post_id) {
            $current_title = get_the_title($current_post_id);
        }
    }
    
    // Prepare the request body
    $request_body = [
        'message' => $message,
        'context' => [
            'url' => $current_url,
            'title' => $current_title,
            'userAgent' => isset($_SERVER['HTTP_USER_AGENT']) ? sanitize_text_field(wp_unslash($_SERVER['HTTP_USER_AGENT'])) : '',
        ]
    ];
    
    // Add conversation ID if it exists
    if ($conversation_id) {
        $request_body['conversationId'] = $conversation_id;
    }

    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode($request_body),
        'timeout' => 30, // Longer timeout for AI response
        'sslverify' => false
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error([
            'message' => esc_html__('Error communicating with AI service', 'voicero-ai'),
            'error' => $response->get_error_message()
        ]);
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);

    if ($response_code !== 200 || !$data) {
        wp_send_json_error([
            'message' => esc_html__('Failed to get response from AI service', 'voicero-ai'),
            'error' => $response_code,
            'body' => wp_kses_post($body)
        ]);
    }

    // Extract the response message and conversation ID
    $ai_message = isset($data['message']) ? $data['message'] : esc_html__('Sorry, I couldn\'t process your request.', 'voicero-ai');
    $new_conversation_id = isset($data['conversationId']) ? $data['conversationId'] : null;

    // Set cookie with conversation ID if it exists
    if ($new_conversation_id) {
        setcookie('voicero_conversation_id', $new_conversation_id, time() + (86400 * 30), '/'); // 30 days
    }

    wp_send_json_success([
        'message' => $ai_message,
        'conversation_id' => $new_conversation_id
    ]);
}

/**
 * Handle voice transcription requests
 */
add_action('wp_ajax_voicero_transcribe_audio', 'voicero_transcribe_audio');
add_action('wp_ajax_nopriv_voicero_transcribe_audio', 'voicero_transcribe_audio');

function voicero_transcribe_audio() {
    // Verify nonce
    if (!isset($_POST['nonce']) || !wp_verify_nonce(sanitize_text_field(wp_unslash($_POST['nonce'])), 'voicero_frontend_nonce')) {
        wp_send_json_error(['message' => esc_html__('Security check failed', 'voicero-ai')]);
    }

    // Check if we have audio data
    if (!isset($_FILES['audio']) || empty($_FILES['audio']['tmp_name'])) {
        wp_send_json_error(['message' => esc_html__('No audio data provided', 'voicero-ai')]);
    }

    // Get access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')]);
    }

    // Prepare API request
    $api_url = VOICERO_API_URL . '/transcribe';
    
    // Read the audio file
    $audio_data = file_get_contents($_FILES['audio']['tmp_name']);
    if (!$audio_data) {
        wp_send_json_error(['message' => esc_html__('Failed to read audio data', 'voicero-ai')]);
    }
    
    // Create a boundary for the multipart form data
    $boundary = wp_generate_password(24, false);
    
    // Prepare the multipart data
    $multipart_data = "--$boundary\r\n";
    $multipart_data .= "Content-Disposition: form-data; name=\"file\"; filename=\"audio.webm\"\r\n";
    $multipart_data .= "Content-Type: audio/webm\r\n\r\n";
    $multipart_data .= $audio_data . "\r\n";
    $multipart_data .= "--$boundary--\r\n";
    
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'multipart/form-data; boundary=' . $boundary,
            'Accept' => 'application/json'
        ],
        'body' => $multipart_data,
        'timeout' => 30, // Longer timeout for audio processing
        'sslverify' => false
    ]);

    if (is_wp_error($response)) {
        wp_send_json_error([
            'message' => esc_html__('Error communicating with transcription service', 'voicero-ai'),
            'error' => $response->get_error_message()
        ]);
    }

    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    $data = json_decode($body, true);

    if ($response_code !== 200 || !$data) {
        wp_send_json_error([
            'message' => esc_html__('Failed to transcribe audio', 'voicero-ai'),
            'error' => $response_code,
            'body' => wp_kses_post($body)
        ]);
    }

    // Extract the transcription
    $transcription = isset($data['text']) ? $data['text'] : '';

    wp_send_json_success([
        'transcription' => $transcription
    ]);
}

/**
 * Handle AJAX requests for AI history
 */
add_action('wp_ajax_voicero_get_ai_history', 'voicero_get_ai_history_ajax');

function voicero_get_ai_history_ajax() {
    // Log all request data for debugging
    error_log('AI History AJAX call received: ' . json_encode($_REQUEST));
    
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        error_log('AI History - Not an AJAX request');
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check admin capability
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => esc_html__('Insufficient permissions', 'voicero-ai')], 403);
        return;
    }

    // 4) Get the website ID (allow override via request)
    $website_id = isset($_REQUEST['websiteId'])
        ? sanitize_text_field(wp_unslash($_REQUEST['websiteId']))
        : get_option('voicero_website_id', '');
    error_log('AI History - Website ID from option: ' . $website_id);
    
    if (empty($website_id)) {
        wp_send_json_error(['message' => esc_html__('Website ID not configured', 'voicero-ai')], 400);
        return;
    }

    // Validate website ID format (should be a UUID in most cases)
    if (!preg_match('/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i', $website_id)) {
        error_log('AI History - Website ID may have invalid format: ' . $website_id);
        // Don't fail here, the API will validate
    }

    // 5) Get the access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')], 403);
        return;
    }

    // 6) Prepare the request data - ensure exact parameter names match the API
    $request_data = [
        'websiteId' => $website_id,
        'type' => 'WordPress'
    ];

    // Log the request data for debugging
    error_log('AI History request data: ' . json_encode($request_data));

    // 7) Make the API request
    // Allow the API base URL to be configured via constant
    $api_base = defined('VOICERO_API_URL') ? VOICERO_API_URL : 'http://localhost:3000/api';
    $endpoint  = trailingslashit($api_base) . 'aiHistory';
    
    try {
        $response = wp_remote_post($endpoint, [
            'headers' => [
                'Authorization' => 'Bearer ' . $access_key,
                'Content-Type' => 'application/json',
                'Accept' => 'application/json'
            ],
            'body' => json_encode($request_data),
            'timeout' => 30, // Longer timeout for potential analysis generation
            'sslverify' => false // Only for local development
        ]);
    } catch (Exception $e) {
        error_log('AI History API exception: ' . $e->getMessage());
        wp_send_json_error([
            'message' => 'Exception during API request: ' . $e->getMessage(),
            'endpoint' => $endpoint
        ], 500);
        return;
    }

    // 8) Handle errors
    if (is_wp_error($response)) {
        $error_message = $response->get_error_message();
        error_log('AI History API error: ' . $error_message);
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($error_message)
            ),
            'endpoint' => $endpoint
        ], 500);
        return;
    }

    // 9) Process the response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    // Log the response for debugging
    error_log('AI History API response code: ' . $status_code);
    error_log('AI History API response body: ' . substr($response_body, 0, 1000)); // Log first 1000 chars
    
    $data = json_decode($response_body, true);

    // Handle specific error codes
    if ($status_code === 400) {
        error_log('Bad request (400) from AI History API. Check request format.');
        wp_send_json_error([
            'message' => 'API reported bad request format. Check website ID and access key.',
            'status' => $status_code,
            'details' => $data, 
            'request' => $request_data,
            'endpoint' => $endpoint
        ], 400);
        return;
    } else if ($status_code === 401) {
        error_log('Unauthorized (401) from AI History API. Check access credentials.');
        wp_send_json_error([
            'message' => 'API authorization failed. Check your access key.',
            'status' => $status_code,
            'endpoint' => $endpoint
        ], 401);
        return;
    } else if ($status_code === 404) {
        error_log('Not found (404) from AI History API. Check the endpoint URL.');
        wp_send_json_error([
            'message' => 'API endpoint not found. Check the API configuration.',
            'status' => $status_code,
            'endpoint' => $endpoint
        ], 404);
        return;
    } else if ($status_code === 405) {
        error_log('Method not allowed (405) from AI History API. The endpoint does not support the request method.');
        wp_send_json_error([
            'message' => 'API does not allow this request method. Contact the developer.',
            'status' => $status_code,
            'endpoint' => $endpoint
        ], 405);
        return;
    } else if ($status_code !== 200) {
        $error_message = isset($data['error']) ? $data['error'] : esc_html__('Unknown error occurred', 'voicero-ai');
        wp_send_json_error([
            'message' => $error_message,
            'status' => $status_code,
            'details' => $data, 
            'request' => $request_data,
            'endpoint' => $endpoint
        ], 500);
        return;
    }

    // If no data was returned, return a graceful error
    if (!is_array($data)) {
        wp_send_json_error([
            'message' => 'API returned invalid data format',
            'status' => $status_code,
            'endpoint' => $endpoint
        ], 500);
        return;
    }

    // 10) Return the data
    wp_send_json_success($data);
}

/**
 * Handle AJAX requests for messages/contacts
 */
add_action('wp_ajax_voicero_get_messages', 'voicero_get_messages_ajax');

function voicero_get_messages_ajax() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check if we have a website ID
    $website_id = isset($_REQUEST['websiteId']) ? sanitize_text_field(wp_unslash($_REQUEST['websiteId'])) : '';
    if (empty($website_id)) {
        wp_send_json_error(['message' => esc_html__('Website ID is required', 'voicero-ai')], 400);
        return;
    }

    // 4) Get the filter parameter
    $filter = isset($_REQUEST['filter']) ? sanitize_text_field(wp_unslash($_REQUEST['filter'])) : 'all';

    // 5) Get the access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')], 403);
        return;
    }

    // 6) Make the API request to the contacts endpoint
    $api_url = VOICERO_API_URL . '/contacts';
    
    error_log('Contacting API for messages: ' . $api_url);
    error_log('Website ID: ' . $website_id);
    
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode([
            'websiteId' => $website_id,
            'filter' => $filter
        ]),
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);

    // 7) Handle errors
    if (is_wp_error($response)) {
        $error_message = $response->get_error_message();
        error_log('Error contacting contacts API: ' . $error_message);
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($error_message)
            )
        ], 500);
        return;
    }

    // 8) Process the response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    
    error_log('Contacts API response code: ' . $status_code);
    error_log('Contacts API response body (first 200 chars): ' . substr($response_body, 0, 200));
    
    $data = json_decode($response_body, true);

    if ($status_code !== 200 || !is_array($data)) {
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %d: HTTP status code */
                esc_html__('Server returned error: %d', 'voicero-ai'),
                intval($status_code)
            ),
            'body' => wp_kses_post($response_body)
        ], $status_code);
        return;
    }

    // 9) Format the data for the frontend
    $messages = [];
    $stats = [
        'total' => 0,
        'unread' => 0,
        'read' => 0,
        'high_priority' => 0,
        'response_rate' => 0
    ];
    
    if (isset($data['success']) && $data['success'] && isset($data['contacts'])) {
        $contacts = $data['contacts'];
        
        // Count stats
        $stats['total'] = count($contacts);
        
        // Process each contact into a message format
        foreach ($contacts as $contact) {
            $is_read = isset($contact['isRead']) ? (bool)$contact['isRead'] : false;
            
            if (!$is_read) {
                $stats['unread']++;
            } else {
                $stats['read']++;
            }
            
            if (isset($contact['isPriority']) && $contact['isPriority']) {
                $stats['high_priority']++;
            }
            
            $messages[] = [
                'id' => $contact['id'],
                'email' => isset($contact['email']) ? $contact['email'] : (isset($contact['user']['email']) ? $contact['user']['email'] : 'No email'),
                'message' => isset($contact['message']) ? $contact['message'] : 'No message content',
                'time' => isset($contact['createdAt']) ? date('M j, Y g:i a', strtotime($contact['createdAt'])) : 'Unknown date',
                'is_read' => $is_read,
                'is_priority' => isset($contact['isPriority']) ? (bool)$contact['isPriority'] : false
            ];
        }
        
        // Calculate response rate if data available
        if (isset($data['responseRate'])) {
            $stats['response_rate'] = $data['responseRate'];
        } else if ($stats['total'] > 0) {
            // Basic calculation if not provided
            $stats['response_rate'] = round(($stats['read'] / $stats['total']) * 100);
        }
    }
    
    // 10) Return the formatted data
    wp_send_json_success([
        'messages' => $messages,
        'stats' => $stats
    ]);
}

/**
 * Handle AJAX requests to mark a message as read
 */
add_action('wp_ajax_voicero_mark_message_read', 'voicero_mark_message_read_ajax');

function voicero_mark_message_read_ajax() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check required params
    $message_id = isset($_REQUEST['message_id']) ? sanitize_text_field(wp_unslash($_REQUEST['message_id'])) : '';
    $website_id = isset($_REQUEST['websiteId']) ? sanitize_text_field(wp_unslash($_REQUEST['websiteId'])) : '';
    
    if (empty($message_id)) {
        wp_send_json_error(['message' => esc_html__('Message ID is required', 'voicero-ai')], 400);
        return;
    }
    
    if (empty($website_id)) {
        wp_send_json_error(['message' => esc_html__('Website ID is required', 'voicero-ai')], 400);
        return;
    }

    // 4) Get the access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')], 403);
        return;
    }

    // 5) Make the API request to mark message as read
    $api_url = VOICERO_API_URL . '/contacts/read';
    
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode([
            'messageId' => $message_id,
            'websiteId' => $website_id
        ]),
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);

    // 6) Handle errors
    if (is_wp_error($response)) {
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }

    // 7) Process the response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $data = json_decode($response_body, true);

    if ($status_code !== 200) {
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %d: HTTP status code */
                esc_html__('Server returned error: %d', 'voicero-ai'),
                intval($status_code)
            ),
            'body' => wp_kses_post($response_body)
        ], $status_code);
        return;
    }

    // 8) Return success with updated stats
    wp_send_json_success([
        'success' => true,
        'stats' => isset($data['stats']) ? $data['stats'] : [
            'total' => 0,
            'unread' => 0,
            'read' => 0,
            'high_priority' => 0,
            'response_rate' => 0
        ]
    ]);
}

/**
 * Handle AJAX requests to send a reply to a message
 */
add_action('wp_ajax_voicero_send_reply', 'voicero_send_reply_ajax');

function voicero_send_reply_ajax() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check required params
    $message_id = isset($_REQUEST['message_id']) ? sanitize_text_field(wp_unslash($_REQUEST['message_id'])) : '';
    $subject = isset($_REQUEST['subject']) ? sanitize_text_field(wp_unslash($_REQUEST['subject'])) : '';
    $content = isset($_REQUEST['content']) ? sanitize_textarea_field(wp_unslash($_REQUEST['content'])) : '';
    $website_id = isset($_REQUEST['websiteId']) ? sanitize_text_field(wp_unslash($_REQUEST['websiteId'])) : '';
    
    if (empty($message_id) || empty($content)) {
        wp_send_json_error(['message' => esc_html__('Message ID and content are required', 'voicero-ai')], 400);
        return;
    }
    
    if (empty($website_id)) {
        wp_send_json_error(['message' => esc_html__('Website ID is required', 'voicero-ai')], 400);
        return;
    }

    // 4) Get the access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')], 403);
        return;
    }

    // 5) Make the API request to send reply
    $api_url = VOICERO_API_URL . '/contacts/reply';
    
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode([
            'messageId' => $message_id,
            'websiteId' => $website_id,
            'subject' => $subject,
            'content' => $content
        ]),
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);

    // 6) Handle errors
    if (is_wp_error($response)) {
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }

    // 7) Process the response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);

    if ($status_code !== 200) {
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %d: HTTP status code */
                esc_html__('Server returned error: %d', 'voicero-ai'),
                intval($status_code)
            ),
            'body' => wp_kses_post($response_body)
        ], $status_code);
        return;
    }

    // 8) Return success
    wp_send_json_success([
        'success' => true,
        'message' => esc_html__('Reply sent successfully', 'voicero-ai')
    ]);
}

/**
 * Handle AJAX requests to delete a message
 */
add_action('wp_ajax_voicero_delete_message', 'voicero_delete_message_ajax');

function voicero_delete_message_ajax() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check required params
    $message_id = isset($_REQUEST['message_id']) ? sanitize_text_field(wp_unslash($_REQUEST['message_id'])) : '';
    $website_id = isset($_REQUEST['websiteId']) ? sanitize_text_field(wp_unslash($_REQUEST['websiteId'])) : '';
    
    if (empty($message_id)) {
        wp_send_json_error(['message' => esc_html__('Message ID is required', 'voicero-ai')], 400);
        return;
    }
    
    if (empty($website_id)) {
        wp_send_json_error(['message' => esc_html__('Website ID is required', 'voicero-ai')], 400);
        return;
    }

    // 4) Get the access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')], 403);
        return;
    }

    // 5) Make the API request to delete message
    $api_url = VOICERO_API_URL . '/contacts/delete';
    
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode([
            'messageId' => $message_id,
            'websiteId' => $website_id
        ]),
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);

    // 6) Handle errors
    if (is_wp_error($response)) {
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }

    // 7) Process the response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $data = json_decode($response_body, true);

    if ($status_code !== 200) {
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %d: HTTP status code */
                esc_html__('Server returned error: %d', 'voicero-ai'),
                intval($status_code)
            ),
            'body' => wp_kses_post($response_body)
        ], $status_code);
        return;
    }

    // 8) Return success with updated stats
    wp_send_json_success([
        'success' => true,
        'stats' => isset($data['stats']) ? $data['stats'] : [
            'total' => 0,
            'unread' => 0,
            'read' => 0,
            'high_priority' => 0,
            'response_rate' => 0
        ],
        'message' => esc_html__('Message deleted successfully', 'voicero-ai')
    ]);
}

/**
 * Handle AJAX requests for website auto features update
 */
add_action('wp_ajax_voicero_update_website_autos', 'voicero_update_website_autos_ajax');

function voicero_update_website_autos_ajax() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check admin capability
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => esc_html__('Insufficient permissions', 'voicero-ai')], 403);
        return;
    }

    // 4) Get the features data from request
    $features = isset($_REQUEST['features']) ? $_REQUEST['features'] : [];
    if (empty($features) || !is_array($features)) {
        wp_send_json_error(['message' => esc_html__('No feature data provided', 'voicero-ai')], 400);
        return;
    }

    // 5) Get the access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')], 403);
        return;
    }

    // 6) Get the website ID by making a request to the connect endpoint
    error_log('Getting website ID from API connect endpoint');
    
    $response = wp_remote_get(VOICERO_API_URL . '/connect', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false
    ]);
    
    if (is_wp_error($response)) {
        error_log('Error getting website info: ' . $response->get_error_message());
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    
    if ($response_code !== 200) {
        error_log('API returned error: ' . $response_code . ' - ' . $body);
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %d: HTTP status code */
                esc_html__('Server returned error: %d', 'voicero-ai'),
                intval($response_code)
            ),
            'body' => wp_kses_post($body)
        ]);
        return;
    }
    
    $data = json_decode($body, true);
    if (!$data || !isset($data['website']) || !isset($data['website']['id'])) {
        error_log('Invalid response structure from server: ' . $body);
        wp_send_json_error([
            'message' => esc_html__('Invalid response structure from server.', 'voicero-ai')
        ]);
        return;
    }
    
    $website_id = $data['website']['id'];
    error_log('Found website ID: ' . $website_id);

    // 7) Prepare request payload - ensure all values are explicit booleans
    // This must exactly match the expected format in the Next.js API
    $payload = [
        'websiteId' => $website_id,
    ];
    
    // Add all features with explicit boolean conversion
    if (isset($features['allowAutoRedirect'])) {
        $payload['allowAutoRedirect'] = $features['allowAutoRedirect'] === true || $features['allowAutoRedirect'] === 'true' || $features['allowAutoRedirect'] === '1' || $features['allowAutoRedirect'] === 1;
    }
    
    if (isset($features['allowAutoScroll'])) {
        $payload['allowAutoScroll'] = $features['allowAutoScroll'] === true || $features['allowAutoScroll'] === 'true' || $features['allowAutoScroll'] === '1' || $features['allowAutoScroll'] === 1;
    }
    
    if (isset($features['allowAutoHighlight'])) {
        $payload['allowAutoHighlight'] = $features['allowAutoHighlight'] === true || $features['allowAutoHighlight'] === 'true' || $features['allowAutoHighlight'] === '1' || $features['allowAutoHighlight'] === 1;
    }
    
    if (isset($features['allowAutoClick'])) {
        $payload['allowAutoClick'] = $features['allowAutoClick'] === true || $features['allowAutoClick'] === 'true' || $features['allowAutoClick'] === '1' || $features['allowAutoClick'] === 1;
    }
    
    if (isset($features['allowAutoFillForm'])) {
        $payload['allowAutoFillForm'] = $features['allowAutoFillForm'] === true || $features['allowAutoFillForm'] === 'true' || $features['allowAutoFillForm'] === '1' || $features['allowAutoFillForm'] === 1;
    }
    
    if (isset($features['allowAutoCancel'])) {
        $payload['allowAutoCancel'] = $features['allowAutoCancel'] === true || $features['allowAutoCancel'] === 'true' || $features['allowAutoCancel'] === '1' || $features['allowAutoCancel'] === 1;
    }
    
    if (isset($features['allowAutoTrackOrder'])) {
        $payload['allowAutoTrackOrder'] = $features['allowAutoTrackOrder'] === true || $features['allowAutoTrackOrder'] === 'true' || $features['allowAutoTrackOrder'] === '1' || $features['allowAutoTrackOrder'] === 1;
    }
    
    if (isset($features['allowAutoGetUserOrders'])) {
        $payload['allowAutoGetUserOrders'] = $features['allowAutoGetUserOrders'] === true || $features['allowAutoGetUserOrders'] === 'true' || $features['allowAutoGetUserOrders'] === '1' || $features['allowAutoGetUserOrders'] === 1;
    }
    
    if (isset($features['allowAutoUpdateUserInfo'])) {
        $payload['allowAutoUpdateUserInfo'] = $features['allowAutoUpdateUserInfo'] === true || $features['allowAutoUpdateUserInfo'] === 'true' || $features['allowAutoUpdateUserInfo'] === '1' || $features['allowAutoUpdateUserInfo'] === 1;
    }
    
    if (isset($features['allowAutoLogout'])) {
        $payload['allowAutoLogout'] = $features['allowAutoLogout'] === true || $features['allowAutoLogout'] === 'true' || $features['allowAutoLogout'] === '1' || $features['allowAutoLogout'] === 1;
    }
    
    if (isset($features['allowAutoLogin'])) {
        $payload['allowAutoLogin'] = $features['allowAutoLogin'] === true || $features['allowAutoLogin'] === 'true' || $features['allowAutoLogin'] === '1' || $features['allowAutoLogin'] === 1;
    }
    
    // Add support for allowAutoReturn and allowAutoExchange if they exist
    if (isset($features['allowAutoReturn'])) {
        $payload['allowAutoReturn'] = $features['allowAutoReturn'] === true || $features['allowAutoReturn'] === 'true' || $features['allowAutoReturn'] === '1' || $features['allowAutoReturn'] === 1;
    }
    
    if (isset($features['allowAutoExchange'])) {
        $payload['allowAutoExchange'] = $features['allowAutoExchange'] === true || $features['allowAutoExchange'] === 'true' || $features['allowAutoExchange'] === '1' || $features['allowAutoExchange'] === 1;
    }
    
    if (isset($features['allowAutoGenerateImage'])) {
        $payload['allowAutoGenerateImage'] = $features['allowAutoGenerateImage'] === true || $features['allowAutoGenerateImage'] === 'true' || $features['allowAutoGenerateImage'] === '1' || $features['allowAutoGenerateImage'] === 1;
    }
    
    error_log('Updating website auto features with payload: ' . json_encode($payload));
    
    // 8) Make the API request to updateWebsiteAutos endpoint
    $api_url = VOICERO_API_URL . '/wordpress/updateWebsiteAutos';
    
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode($payload),
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);

    // 9) Handle API errors
    if (is_wp_error($response)) {
        error_log('Error updating website auto features: ' . $response->get_error_message());
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }

    // 10) Process the response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $data = json_decode($response_body, true);
    
    error_log('API response code: ' . $status_code);
    error_log('API response body: ' . substr($response_body, 0, 500)); // Log first 500 chars
    
    if ($status_code !== 200 || !$data || !isset($data['success']) || !$data['success']) {
        $error_message = isset($data['error']) ? $data['error'] : esc_html__('Unknown error occurred', 'voicero-ai');
        wp_send_json_error([
            'message' => $error_message,
            'status' => $status_code,
            'details' => $data
        ], $status_code >= 400 ? $status_code : 500);
        return;
    }

    // 11) Store the updated settings in WordPress options for later use
    if (isset($data['settings']) && is_array($data['settings'])) {
        update_option('voicero_ai_features', $data['settings'], false);
    }

    // 12) Return success
    wp_send_json_success([
        'message' => isset($data['message']) ? $data['message'] : esc_html__('AI features updated successfully', 'voicero-ai'),
        'settings' => isset($data['settings']) ? $data['settings'] : []
    ]);
}

/**
 * REST API proxy for website auto features update
 * 
 * @param WP_REST_Request $request The request object
 * @return WP_REST_Response The response
 */
function voicero_website_auto_features_proxy(WP_REST_Request $request) {
    // Get the request body
    $params = $request->get_json_params();
    
    // Validate required data
    if (empty($params) || !is_array($params)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'No feature data provided'
        ], 400);
    }
    
    // Get the access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        return new WP_REST_Response([
            'success' => false,
            'message' => 'No access key configured'
        ], 403);
    }
    
    // Get the website ID by making a request to the connect endpoint
    error_log('REST API: Getting website ID from API connect endpoint');
    
    $response = wp_remote_get(VOICERO_API_URL . '/connect', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false
    ]);
    
    if (is_wp_error($response)) {
        error_log('REST API: Error getting website info: ' . $response->get_error_message());
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Connection failed: ' . $response->get_error_message()
        ], 500);
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    
    if ($response_code !== 200) {
        error_log('REST API: API returned error: ' . $response_code . ' - ' . $body);
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Server returned error: ' . $response_code
        ], $response_code);
    }
    
    $data = json_decode($body, true);
    if (!$data || !isset($data['website']) || !isset($data['website']['id'])) {
        error_log('REST API: Invalid response structure from server: ' . $body);
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Invalid response structure from server'
        ], 500);
    }
    
    $website_id = $data['website']['id'];
    error_log('REST API: Found website ID: ' . $website_id);
    
    // Prepare request payload - ensure all values are explicit booleans
    // This must exactly match the expected format in the Next.js API
    $payload = [
        'websiteId' => $website_id,
    ];
    
    // Add all features with explicit boolean conversion
    if (isset($params['allowAutoRedirect'])) {
        $payload['allowAutoRedirect'] = $params['allowAutoRedirect'] === true || $params['allowAutoRedirect'] === 'true' || $params['allowAutoRedirect'] === '1' || $params['allowAutoRedirect'] === 1;
    }
    
    if (isset($params['allowAutoScroll'])) {
        $payload['allowAutoScroll'] = $params['allowAutoScroll'] === true || $params['allowAutoScroll'] === 'true' || $params['allowAutoScroll'] === '1' || $params['allowAutoScroll'] === 1;
    }
    
    if (isset($params['allowAutoHighlight'])) {
        $payload['allowAutoHighlight'] = $params['allowAutoHighlight'] === true || $params['allowAutoHighlight'] === 'true' || $params['allowAutoHighlight'] === '1' || $params['allowAutoHighlight'] === 1;
    }
    
    if (isset($params['allowAutoClick'])) {
        $payload['allowAutoClick'] = $params['allowAutoClick'] === true || $params['allowAutoClick'] === 'true' || $params['allowAutoClick'] === '1' || $params['allowAutoClick'] === 1;
    }
    
    if (isset($params['allowAutoFillForm'])) {
        $payload['allowAutoFillForm'] = $params['allowAutoFillForm'] === true || $params['allowAutoFillForm'] === 'true' || $params['allowAutoFillForm'] === '1' || $params['allowAutoFillForm'] === 1;
    }
    
    if (isset($params['allowAutoCancel'])) {
        $payload['allowAutoCancel'] = $params['allowAutoCancel'] === true || $params['allowAutoCancel'] === 'true' || $params['allowAutoCancel'] === '1' || $params['allowAutoCancel'] === 1;
    }
    
    if (isset($params['allowAutoTrackOrder'])) {
        $payload['allowAutoTrackOrder'] = $params['allowAutoTrackOrder'] === true || $params['allowAutoTrackOrder'] === 'true' || $params['allowAutoTrackOrder'] === '1' || $params['allowAutoTrackOrder'] === 1;
    }
    
    if (isset($params['allowAutoGetUserOrders'])) {
        $payload['allowAutoGetUserOrders'] = $params['allowAutoGetUserOrders'] === true || $params['allowAutoGetUserOrders'] === 'true' || $params['allowAutoGetUserOrders'] === '1' || $params['allowAutoGetUserOrders'] === 1;
    }
    
    if (isset($params['allowAutoUpdateUserInfo'])) {
        $payload['allowAutoUpdateUserInfo'] = $params['allowAutoUpdateUserInfo'] === true || $params['allowAutoUpdateUserInfo'] === 'true' || $params['allowAutoUpdateUserInfo'] === '1' || $params['allowAutoUpdateUserInfo'] === 1;
    }
    
    if (isset($params['allowAutoLogout'])) {
        $payload['allowAutoLogout'] = $params['allowAutoLogout'] === true || $params['allowAutoLogout'] === 'true' || $params['allowAutoLogout'] === '1' || $params['allowAutoLogout'] === 1;
    }
    
    if (isset($params['allowAutoLogin'])) {
        $payload['allowAutoLogin'] = $params['allowAutoLogin'] === true || $params['allowAutoLogin'] === 'true' || $params['allowAutoLogin'] === '1' || $params['allowAutoLogin'] === 1;
    }
    
    // Add support for allowAutoReturn and allowAutoExchange if they exist
    if (isset($params['allowAutoReturn'])) {
        $payload['allowAutoReturn'] = $params['allowAutoReturn'] === true || $params['allowAutoReturn'] === 'true' || $params['allowAutoReturn'] === '1' || $params['allowAutoReturn'] === 1;
    }
    
    if (isset($params['allowAutoExchange'])) {
        $payload['allowAutoExchange'] = $params['allowAutoExchange'] === true || $params['allowAutoExchange'] === 'true' || $params['allowAutoExchange'] === '1' || $params['allowAutoExchange'] === 1;
    }
    
    if (isset($params['allowAutoGenerateImage'])) {
        $payload['allowAutoGenerateImage'] = $params['allowAutoGenerateImage'] === true || $params['allowAutoGenerateImage'] === 'true' || $params['allowAutoGenerateImage'] === '1' || $params['allowAutoGenerateImage'] === 1;
    }
    
    error_log('REST API: Updating website auto features with payload: ' . json_encode($payload));
    
    // Make the API request to updateWebsiteAutos endpoint
    $api_url = VOICERO_API_URL . '/wordpress/updateWebsiteAutos';
    
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode($payload),
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);
    
    // Handle API errors
    if (is_wp_error($response)) {
        error_log('REST API: Error updating website auto features: ' . $response->get_error_message());
        return new WP_REST_Response([
            'success' => false,
            'message' => 'Connection failed: ' . $response->get_error_message()
        ], 500);
    }
    
    // Process the response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $data = json_decode($response_body, true);
    
    error_log('REST API: API response code: ' . $status_code);
    error_log('REST API: API response body: ' . substr($response_body, 0, 500)); // Log first 500 chars
    
    // Store the updated settings in WordPress options for later use
    if (isset($data['settings']) && is_array($data['settings'])) {
        update_option('voicero_ai_features', $data['settings'], false);
    }
    
    // Return the API response
    return new WP_REST_Response($data, $status_code);
}

/**
 * Handle AJAX requests for AI features (original handler, now uses the proxy)
 */
add_action('wp_ajax_voicero_save_ai_features', 'voicero_save_ai_features_ajax');

function voicero_save_ai_features_ajax() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check admin capability
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => esc_html__('Insufficient permissions', 'voicero-ai')], 403);
        return;
    }

    // 4) Get the features data from request
    $features = isset($_REQUEST['features']) ? $_REQUEST['features'] : [];
    if (empty($features) || !is_array($features)) {
        wp_send_json_error(['message' => esc_html__('No feature data provided', 'voicero-ai')], 400);
        return;
    }

    // 5) Log the request for debugging
    error_log('Original save AI features handler called with features: ' . json_encode($features));

    // 6) Map to the API feature names - ensure they are explicit booleans
    $api_features = [];
    
    // Use strict comparisons for explicit boolean values
    if (isset($features['ai_redirect'])) {
        $api_features['allowAutoRedirect'] = ($features['ai_redirect'] === true || $features['ai_redirect'] === 'true' || $features['ai_redirect'] === '1' || $features['ai_redirect'] === 1);
    }
    
    if (isset($features['ai_scroll'])) {
        $api_features['allowAutoScroll'] = ($features['ai_scroll'] === true || $features['ai_scroll'] === 'true' || $features['ai_scroll'] === '1' || $features['ai_scroll'] === 1);
    }
    
    if (isset($features['ai_highlight'])) {
        $api_features['allowAutoHighlight'] = ($features['ai_highlight'] === true || $features['ai_highlight'] === 'true' || $features['ai_highlight'] === '1' || $features['ai_highlight'] === 1);
    }
    
    if (isset($features['ai_click'])) {
        $api_features['allowAutoClick'] = ($features['ai_click'] === true || $features['ai_click'] === 'true' || $features['ai_click'] === '1' || $features['ai_click'] === 1);
    }
    
    if (isset($features['ai_forms'])) {
        $api_features['allowAutoFillForm'] = ($features['ai_forms'] === true || $features['ai_forms'] === 'true' || $features['ai_forms'] === '1' || $features['ai_forms'] === 1);
    }
    
    if (isset($features['ai_cancel_orders'])) {
        $api_features['allowAutoCancel'] = ($features['ai_cancel_orders'] === true || $features['ai_cancel_orders'] === 'true' || $features['ai_cancel_orders'] === '1' || $features['ai_cancel_orders'] === 1);
    }
    
    if (isset($features['ai_track_orders'])) {
        $api_features['allowAutoTrackOrder'] = ($features['ai_track_orders'] === true || $features['ai_track_orders'] === 'true' || $features['ai_track_orders'] === '1' || $features['ai_track_orders'] === 1);
    }
    
    if (isset($features['ai_order_history'])) {
        $api_features['allowAutoGetUserOrders'] = ($features['ai_order_history'] === true || $features['ai_order_history'] === 'true' || $features['ai_order_history'] === '1' || $features['ai_order_history'] === 1);
    }
    
    if (isset($features['ai_update_account'])) {
        $api_features['allowAutoUpdateUserInfo'] = ($features['ai_update_account'] === true || $features['ai_update_account'] === 'true' || $features['ai_update_account'] === '1' || $features['ai_update_account'] === 1);
    }
    
    if (isset($features['ai_logout'])) {
        $api_features['allowAutoLogout'] = ($features['ai_logout'] === true || $features['ai_logout'] === 'true' || $features['ai_logout'] === '1' || $features['ai_logout'] === 1);
    }
    
    if (isset($features['ai_login'])) {
        $api_features['allowAutoLogin'] = ($features['ai_login'] === true || $features['ai_login'] === 'true' || $features['ai_login'] === '1' || $features['ai_login'] === 1);
    }
    
    error_log('Mapped features to API format: ' . json_encode($api_features));

    // 7) Get the access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')], 403);
        return;
    }

    // 8) Get the website ID by making a request to the connect endpoint
    error_log('Legacy handler: Getting website ID from API connect endpoint');
    
    $response = wp_remote_get(VOICERO_API_URL . '/connect', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false
    ]);
    
    if (is_wp_error($response)) {
        error_log('Legacy handler: Error getting website info: ' . $response->get_error_message());
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    
    if ($response_code !== 200) {
        error_log('Legacy handler: API returned error: ' . $response_code . ' - ' . $body);
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %d: HTTP status code */
                esc_html__('Server returned error: %d', 'voicero-ai'),
                intval($response_code)
            ),
            'body' => wp_kses_post($body)
        ]);
        return;
    }
    
    $data = json_decode($body, true);
    if (!$data || !isset($data['website']) || !isset($data['website']['id'])) {
        error_log('Legacy handler: Invalid response structure from server: ' . $body);
        wp_send_json_error([
            'message' => esc_html__('Invalid response structure from server.', 'voicero-ai')
        ]);
        return;
    }
    
    $website_id = $data['website']['id'];
    error_log('Legacy handler: Found website ID: ' . $website_id);

    // 9) Call the API directly since we have all the data we need
    $api_url = VOICERO_API_URL . '/wordpress/updateWebsiteAutos';
    
    // Prepare payload - start with websiteId to ensure proper structure
    $payload = [
        'websiteId' => $website_id
    ];
    
    // Add each feature value from our mapped array
    foreach ($api_features as $key => $value) {
        // Ensure every value is a true boolean
        $payload[$key] = (bool)$value;
    }
    
    error_log('Legacy handler: Updating website auto features: ' . json_encode($payload));
    
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode($payload),
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);

    // 10) Handle API errors
    if (is_wp_error($response)) {
        error_log('Legacy handler: Error updating website auto features: ' . $response->get_error_message());
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }

    // 11) Process the response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $data = json_decode($response_body, true);
    
    error_log('Legacy handler: API response code: ' . $status_code);
    error_log('Legacy handler: API response body: ' . substr($response_body, 0, 500)); // Log first 500 chars
    
    if ($status_code !== 200 || !$data || !isset($data['success']) || !$data['success']) {
        $error_message = isset($data['error']) ? $data['error'] : esc_html__('Unknown error occurred', 'voicero-ai');
        wp_send_json_error([
            'message' => $error_message,
            'status' => $status_code,
            'details' => $data
        ], $status_code >= 400 ? $status_code : 500);
        return;
    }

    // 12) Store the updated settings in WordPress options for later use
    if (isset($data['settings']) && is_array($data['settings'])) {
        update_option('voicero_ai_features', $data['settings'], false);
    }

    // 13) Return success response to browser
    wp_send_json_success([
        'message' => isset($data['message']) ? $data['message'] : esc_html__('AI features updated successfully', 'voicero-ai'),
        'settings' => isset($data['settings']) ? $data['settings'] : []
    ]);
}

/**
 * Handle AJAX requests for website information update
 */
add_action('wp_ajax_voicero_update_website', 'voicero_update_website_ajax');

function voicero_update_website_ajax() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check admin capability
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => esc_html__('Insufficient permissions', 'voicero-ai')], 403);
        return;
    }

    // 4) Get the website data
    $website_data = isset($_REQUEST['website_data']) ? $_REQUEST['website_data'] : [];
    if (empty($website_data) || !is_array($website_data)) {
        wp_send_json_error(['message' => esc_html__('No website data provided', 'voicero-ai')], 400);
        return;
    }

    // 5) Validate required fields
    if (empty($website_data['name']) && empty($website_data['url']) && empty($website_data['customInstructions'])) {
        wp_send_json_error(['message' => esc_html__('At least one field (name, url, or customInstructions) must be provided', 'voicero-ai')], 400);
        return;
    }

    // 6) Get the access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')], 403);
        return;
    }

    // 7) Get the website ID by making a request to the connect endpoint
    error_log('Getting website ID from API connect endpoint');
    
    $response = wp_remote_get(VOICERO_API_URL . '/connect', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false
    ]);
    
    if (is_wp_error($response)) {
        error_log('Error getting website info: ' . $response->get_error_message());
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    
    if ($response_code !== 200) {
        error_log('API returned error: ' . $response_code . ' - ' . $body);
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %d: HTTP status code */
                esc_html__('Server returned error: %d', 'voicero-ai'),
                intval($response_code)
            ),
            'body' => wp_kses_post($body)
        ]);
        return;
    }
    
    $data = json_decode($body, true);
    if (!$data || !isset($data['website']) || !isset($data['website']['id'])) {
        error_log('Invalid response structure from server: ' . $body);
        wp_send_json_error([
            'message' => esc_html__('Invalid response structure from server.', 'voicero-ai')
        ]);
        return;
    }
    
    $website_id = $data['website']['id'];
    error_log('Found website ID: ' . $website_id);

    // 8) Prepare request payload
    $payload = $website_data;
    $payload['websiteId'] = $website_id;
    
    error_log('Updating website with payload: ' . json_encode($payload));
    
    // 9) Make the API request to updateWebsite endpoint
    $api_url = VOICERO_API_URL . '/wordpress/updateWebsite';
    
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode($payload),
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);

    // 10) Handle API errors
    if (is_wp_error($response)) {
        error_log('Error updating website: ' . $response->get_error_message());
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }

    // 11) Process the response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $data = json_decode($response_body, true);
    
    error_log('API response code: ' . $status_code);
    error_log('API response body: ' . substr($response_body, 0, 500)); // Log first 500 chars
    
    if ($status_code !== 200 || !$data || !isset($data['success']) || !$data['success']) {
        $error_message = isset($data['error']) ? $data['error'] : esc_html__('Unknown error occurred', 'voicero-ai');
        wp_send_json_error([
            'message' => $error_message,
            'status' => $status_code,
            'details' => $data
        ], $status_code >= 400 ? $status_code : 500);
        return;
    }

    // 12) Store the updated settings in WordPress options for later use
    if (isset($data['website']) && is_array($data['website'])) {
        update_option('voicero_website_name', $data['website']['name'], false);
        update_option('voicero_website_url', $data['website']['url'], false);
        if (isset($data['website']['customInstructions'])) {
            update_option('voicero_custom_instructions', $data['website']['customInstructions'], false);
        }
    }

    // 13) Also update the original website info to maintain backward compatibility
    if (isset($website_data['name'])) {
        update_option('voicero_website_name', $website_data['name']);
    }
    if (isset($website_data['url'])) {
        update_option('voicero_website_url', $website_data['url']);
    }
    if (isset($website_data['customInstructions'])) {
        update_option('voicero_custom_instructions', $website_data['customInstructions']);
    }

    // 14) Return success
    wp_send_json_success([
        'message' => isset($data['message']) ? $data['message'] : esc_html__('Website information updated successfully', 'voicero-ai'),
        'website' => isset($data['website']) ? $data['website'] : []
    ]);
}

/**
 * Handle the original AJAX request for website info (backward compatibility)
 */
add_action('wp_ajax_voicero_save_website_info', 'voicero_save_website_info_ajax');

function voicero_save_website_info_ajax() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check admin capability
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => esc_html__('Insufficient permissions', 'voicero-ai')], 403);
        return;
    }

    // 4) Get website data from the original format
    $website_name = isset($_REQUEST['website_name']) ? sanitize_text_field(wp_unslash($_REQUEST['website_name'])) : '';
    $website_url = isset($_REQUEST['website_url']) ? esc_url_raw(wp_unslash($_REQUEST['website_url'])) : '';
    $custom_instructions = isset($_REQUEST['custom_instructions']) ? sanitize_textarea_field(wp_unslash($_REQUEST['custom_instructions'])) : '';
    
    // 5) Log the request
    error_log('Legacy website info handler called with name: ' . $website_name . ', URL: ' . $website_url);
    
    // 6) Convert to the new format
    $_REQUEST['website_data'] = [
        'name' => $website_name,
        'url' => $website_url,
        'customInstructions' => $custom_instructions
    ];
    
    // 7) Delegate to the new handler
    return voicero_update_website_ajax();
}

/**
 * Handle AJAX requests for user settings update
 */
add_action('wp_ajax_voicero_update_user_settings', 'voicero_update_user_settings_ajax');

function voicero_update_user_settings_ajax() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check admin capability
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => esc_html__('Insufficient permissions', 'voicero-ai')], 403);
        return;
    }

    // 4) Get the user data
    $user_data = isset($_REQUEST['user_data']) ? $_REQUEST['user_data'] : [];
    if (empty($user_data) || !is_array($user_data)) {
        wp_send_json_error(['message' => esc_html__('No user data provided', 'voicero-ai')], 400);
        return;
    }

    // 5) Validate required fields
    if (empty($user_data['name']) && empty($user_data['username']) && empty($user_data['email'])) {
        wp_send_json_error(['message' => esc_html__('At least one field (name, username, or email) must be provided', 'voicero-ai')], 400);
        return;
    }

    // 6) Get the access key
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => esc_html__('No access key configured', 'voicero-ai')], 403);
        return;
    }

    // 7) Get the website ID by making a request to the connect endpoint
    error_log('Getting website ID from API connect endpoint');
    
    $response = wp_remote_get(VOICERO_API_URL . '/connect', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'timeout' => 15,
        'sslverify' => false
    ]);
    
    if (is_wp_error($response)) {
        error_log('Error getting website info: ' . $response->get_error_message());
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }
    
    $response_code = wp_remote_retrieve_response_code($response);
    $body = wp_remote_retrieve_body($response);
    
    if ($response_code !== 200) {
        error_log('API returned error: ' . $response_code . ' - ' . $body);
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %d: HTTP status code */
                esc_html__('Server returned error: %d', 'voicero-ai'),
                intval($response_code)
            ),
            'body' => wp_kses_post($body)
        ]);
        return;
    }
    
    $data = json_decode($body, true);
    if (!$data || !isset($data['website']) || !isset($data['website']['id'])) {
        error_log('Invalid response structure from server: ' . $body);
        wp_send_json_error([
            'message' => esc_html__('Invalid response structure from server.', 'voicero-ai')
        ]);
        return;
    }
    
    $website_id = $data['website']['id'];
    error_log('Found website ID: ' . $website_id);

    // 8) Prepare request payload
    $payload = $user_data;
    $payload['websiteId'] = $website_id;
    
    error_log('Updating user settings with payload: ' . json_encode($payload));
    
    // 9) Make the API request to updateUserSettings endpoint
    $api_url = VOICERO_API_URL . '/wordpress/updateUserSettings';
    
    $response = wp_remote_post($api_url, [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode($payload),
        'timeout' => 15,
        'sslverify' => false // Only for local development
    ]);

    // 10) Handle API errors
    if (is_wp_error($response)) {
        error_log('Error updating user settings: ' . $response->get_error_message());
        wp_send_json_error([
            'message' => sprintf(
                /* translators: %s: detailed error message */
                esc_html__('Connection failed: %s', 'voicero-ai'),
                esc_html($response->get_error_message())
            )
        ], 500);
        return;
    }

    // 11) Process the response
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $data = json_decode($response_body, true);
    
    error_log('API response code: ' . $status_code);
    error_log('API response body: ' . substr($response_body, 0, 500)); // Log first 500 chars
    
    if ($status_code !== 200 || !$data || !isset($data['success']) || !$data['success']) {
        $error_message = isset($data['error']) ? $data['error'] : esc_html__('Unknown error occurred', 'voicero-ai');
        wp_send_json_error([
            'message' => $error_message,
            'status' => $status_code,
            'details' => $data
        ], $status_code >= 400 ? $status_code : 500);
        return;
    }

    // 12) Store the updated settings in WordPress options for later use
    if (isset($data['user']) && is_array($data['user'])) {
        update_option('voicero_user_name', $data['user']['name'], false);
        update_option('voicero_username', $data['user']['username'], false);
        update_option('voicero_email', $data['user']['email'], false);
    }

    // 13) Also update the local user settings to maintain backward compatibility
    if (isset($user_data['name'])) {
        update_option('voicero_user_name', $user_data['name']);
    }
    if (isset($user_data['username'])) {
        update_option('voicero_username', $user_data['username']);
    }
    if (isset($user_data['email'])) {
        update_option('voicero_email', $user_data['email']);
    }

    // 14) Return success
    wp_send_json_success([
        'message' => isset($data['message']) ? $data['message'] : esc_html__('User settings updated successfully', 'voicero-ai'),
        'user' => isset($data['user']) ? $data['user'] : []
    ]);
}

/**
 * Handle the original AJAX request for user settings (backward compatibility)
 */
add_action('wp_ajax_voicero_save_user_settings', 'voicero_save_user_settings_ajax');

function voicero_save_user_settings_ajax() {
    // 1) Must be AJAX
    if (!defined('DOING_AJAX') || !DOING_AJAX) {
        wp_send_json_error(['message' => esc_html__('Invalid request type', 'voicero-ai')], 400);
        return;
    }

    // 2) Verify nonce
    $nonce = isset($_REQUEST['nonce']) ? sanitize_text_field(wp_unslash($_REQUEST['nonce'])) : '';
    if (!check_ajax_referer('voicero_ajax_nonce', 'nonce', false)) {
        wp_send_json_error(['message' => esc_html__('Invalid nonce', 'voicero-ai')], 403);
        return;
    }

    // 3) Check admin capability
    if (!current_user_can('manage_options')) {
        wp_send_json_error(['message' => esc_html__('Insufficient permissions', 'voicero-ai')], 403);
        return;
    }

    // 4) Get user data from the original format
    $user_name = isset($_REQUEST['user_name']) ? sanitize_text_field(wp_unslash($_REQUEST['user_name'])) : '';
    $username = isset($_REQUEST['username']) ? sanitize_text_field(wp_unslash($_REQUEST['username'])) : '';
    $email = isset($_REQUEST['email']) ? sanitize_email(wp_unslash($_REQUEST['email'])) : '';
    
    // 5) Log the request
    error_log('Legacy user settings handler called with name: ' . $user_name . ', username: ' . $username . ', email: ' . $email);
    
    // 6) Convert to the new format
    $_REQUEST['user_data'] = [
        'name' => $user_name,
        'username' => $username,
        'email' => $email
    ];
    
    // 7) Delegate to the new handler
    return voicero_update_user_settings_ajax();
}

/**
 * Handle AJAX requests for customer data
 */
add_action('wp_ajax_voicero_set_customer_data', 'voicero_set_customer_data_ajax');
add_action('wp_ajax_nopriv_voicero_set_customer_data', 'voicero_set_customer_data_ajax');

function voicero_set_customer_data_ajax() {
    // Log for debugging
    error_log('voicero_set_customer_data_ajax called - checking nonce');
    
    // 1) Verify nonce - accept either frontend or ajax nonce for flexibility
    $nonce = isset($_POST['nonce']) ? sanitize_text_field(wp_unslash($_POST['nonce'])) : '';
    
    // Try with different nonce actions to be flexible with how the nonce was created
    $nonce_valid = wp_verify_nonce($nonce, 'voicero_frontend_nonce') || 
                  wp_verify_nonce($nonce, 'voicero_ajax_nonce');
    
    if (empty($nonce) || !$nonce_valid) {
        error_log('Voicero nonce verification failed: ' . $nonce);
        wp_send_json_error(['message' => 'Security check failed - invalid nonce']);
        return;
    }

    // 2) Get the payload
    if (!isset($_POST['payload'])) {
        error_log('Voicero: No payload provided in request');
        wp_send_json_error(['message' => 'No payload provided']);
        return;
    }

    // Handle different possible payload formats
    $raw_payload = $_POST['payload'];
    
    // Log payload excerpt for debugging
    error_log('Voicero payload (first 100 chars): ' . substr($raw_payload, 0, 100));
    
    // Try different payload parsing approaches
    // First try with no modification
    $payload = json_decode($raw_payload, true);
    
    // If that fails, try with stripslashes
    if (!$payload) {
        $payload = json_decode(stripslashes($raw_payload), true);
    }
    
    // If both approaches fail, error out
    if (!$payload) {
        error_log('Voicero: Failed to parse payload JSON: ' . json_last_error_msg());
        wp_send_json_error(['message' => 'Invalid payload format: ' . json_last_error_msg()]);
        return;
    }

    // 3) Get the access key from server-side (more secure than client-side)
    $access_key = voicero_get_access_key();
    if (empty($access_key)) {
        wp_send_json_error(['message' => 'No access key configured']);
        return;
    }

    // 4) Forward to external API
    $response = wp_remote_post(VOICERO_API_URL . '/wordpress/setCustomer', [
        'headers' => [
            'Authorization' => 'Bearer ' . $access_key,
            'Content-Type' => 'application/json',
            'Accept' => 'application/json'
        ],
        'body' => json_encode($payload),
        'timeout' => 30, // Longer timeout for API
        'sslverify' => false // For local development
    ]);

    // 5) Handle errors
    if (is_wp_error($response)) {
        error_log('VoiceroUserData API Error: ' . $response->get_error_message());
        wp_send_json_error([
            'message' => 'API connection failed: ' . $response->get_error_message()
        ]);
        return;
    }

    // 6) Get response details
    $status_code = wp_remote_retrieve_response_code($response);
    $response_body = wp_remote_retrieve_body($response);
    $data = json_decode($response_body, true);

    // 7) Check status code for specific error handling
    if ($status_code !== 200) {
        error_log('VoiceroUserData API Error: Status ' . $status_code . ' - ' . $response_body);
        wp_send_json_error([
            'message' => 'API returned error: ' . $status_code,
            'data' => $data
        ], $status_code);
        return;
    }

    // 8) Return the successful response to the client
    wp_send_json_success($data);
}