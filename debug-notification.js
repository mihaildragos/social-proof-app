// Debug script to test notification display functionality
// Run this in the browser console on the test client page

console.log('🔧 Debugging Social Proof Notifications');

// 1. Check if the social proof script is loaded
if (window.SocialProof) {
    console.log('✅ SocialProof object exists');
    if (window.SocialProof.init) {
        console.log('✅ SocialProof.init function exists');
    } else {
        console.log('❌ SocialProof.init function missing');
    }
} else {
    console.log('❌ SocialProof object not found - script not loaded properly');
}

// 2. Check if the container exists
const container = document.getElementById('social-proof-container');
if (container) {
    console.log('✅ Social proof container exists');
    console.log('Container style:', container.style.cssText);
} else {
    console.log('❌ Social proof container not found');
}

// 3. Test notification creation
function testNotification() {
    console.log('🧪 Testing notification display...');
    
    const testNotification = {
        id: 'test_' + Date.now(),
        type: 'order.created',
        content: {
            title: 'New Order! 🎉',
            message: 'John Doe just purchased Blue T-Shirt',
            customer_name: 'John Doe',
            product_name: 'Blue T-Shirt',
            amount: '29.99',
            currency: 'USD',
            location: 'New York, US'
        },
        createdAt: new Date().toISOString()
    };

    // If SocialProof has a showNotification method, use it
    if (window.SocialProof && typeof window.SocialProof.showNotification === 'function') {
        console.log('✅ Using SocialProof.showNotification');
        window.SocialProof.showNotification(testNotification);
    } else {
        console.log('⚠️ SocialProof.showNotification not found, trying manual creation');
        
        // Try to create notification manually
        if (container) {
            const notifEl = document.createElement('div');
            notifEl.className = 'social-proof-notification';
            notifEl.innerHTML = `
                <div class="social-proof-notification-content">
                    <div class="social-proof-notification-text">
                        <div class="social-proof-notification-title">${testNotification.content.title}</div>
                        <div class="social-proof-notification-message">${testNotification.content.message}</div>
                        <div class="social-proof-notification-time">Just now</div>
                    </div>
                </div>
                <button class="social-proof-notification-close">&times;</button>
            `;
            
            container.appendChild(notifEl);
            console.log('✅ Manual notification created');
            
            // Auto-remove after 5 seconds
            setTimeout(() => {
                if (container.contains(notifEl)) {
                    container.removeChild(notifEl);
                    console.log('🗑️ Test notification removed');
                }
            }, 5000);
        } else {
            console.log('❌ Cannot create notification - container missing');
        }
    }
}

// 4. Test SSE connection
function testSSE() {
    console.log('🔌 Testing SSE connection...');
    
    // Get the site ID from the page
    const params = new URLSearchParams(window.location.search);
    const siteId = params.get('siteId');
    
    if (!siteId) {
        console.log('❌ No siteId found in URL');
        return;
    }
    
    const sseUrl = `http://localhost:3000/api/notifications/sse/${siteId}`;
    console.log('SSE URL:', sseUrl);
    
    const eventSource = new EventSource(sseUrl);
    
    eventSource.onopen = function() {
        console.log('✅ SSE connection opened');
    };
    
    eventSource.onmessage = function(event) {
        console.log('📨 SSE message received:', event.data);
        try {
            const notification = JSON.parse(event.data);
            console.log('📋 Parsed notification:', notification);
        } catch (err) {
            console.error('❌ Error parsing SSE message:', err);
        }
    };
    
    eventSource.onerror = function(err) {
        console.error('❌ SSE error:', err);
    };
    
    // Close after 30 seconds
    setTimeout(() => {
        eventSource.close();
        console.log('🔌 SSE connection closed');
    }, 30000);
}

// 5. Expose functions for manual testing
window.debugNotifications = {
    test: testNotification,
    testSSE: testSSE,
    info: () => {
        console.log('SocialProof:', window.SocialProof);
        console.log('Container:', container);
        console.log('Site ID:', new URLSearchParams(window.location.search).get('siteId'));
    }
};

console.log('🎮 Debug functions available:');
console.log('- debugNotifications.test() - Test notification display');
console.log('- debugNotifications.testSSE() - Test SSE connection');
console.log('- debugNotifications.info() - Show debug info');

// Auto-run basic checks
console.log('\n🔍 Running basic checks...');
if (window.SocialProof) {
    console.log('✅ SocialProof loaded');
} else {
    console.log('❌ SocialProof not loaded');
}

if (container) {
    console.log('✅ Container exists');
} else {
    console.log('❌ Container missing');
}

const siteId = new URLSearchParams(window.location.search).get('siteId');
if (siteId) {
    console.log('✅ Site ID found:', siteId);
} else {
    console.log('❌ No site ID in URL');
} 