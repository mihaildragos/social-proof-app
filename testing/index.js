const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 4000;

app.use(cors());
app.use(express.json());

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', service: 'external-service-mocks' });
});

// Mock Stripe endpoints
app.post('/stripe/customers', (req, res) => {
  res.json({
    id: 'cus_mock_' + Date.now(),
    email: req.body.email,
    created: Math.floor(Date.now() / 1000)
  });
});

app.post('/stripe/subscriptions', (req, res) => {
  res.json({
    id: 'sub_mock_' + Date.now(),
    customer: req.body.customer,
    status: 'active',
    current_period_start: Math.floor(Date.now() / 1000),
    current_period_end: Math.floor(Date.now() / 1000) + 2592000 // 30 days
  });
});

// Mock SendGrid endpoints
app.post('/sendgrid/mail/send', (req, res) => {
  console.log('Mock SendGrid email sent:', req.body);
  res.status(202).json({ message: 'Email sent successfully' });
});

// Mock Clerk endpoints
app.get('/clerk/users/:userId', (req, res) => {
  res.json({
    id: req.params.userId,
    email_addresses: [{ email_address: 'user@example.com' }],
    first_name: 'Test',
    last_name: 'User'
  });
});

app.listen(PORT, () => {
  console.log(`External service mocks running on port ${PORT}`);
}); 