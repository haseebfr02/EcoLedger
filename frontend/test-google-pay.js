// Test script for Google Pay integration
// Run with: node test-google-pay.js

import crypto from 'crypto';

// PayFast sandbox test credentials (official)
const TEST_CONFIG = {
  payfast: {
    merchantId: "10000100",
    merchantKey: "46f0cd694581a",
    // ⚠️ In sandbox, usually no passphrase. Leave empty unless you created one.
    passphrase: '',
  },
  googlePay: {
    merchantId: "10000100",
    environment: 'TEST'
  }
};

// Mock Google Pay token (not used in sandbox, but included for structure)
const mockGooglePayToken = {
  "signature": "MOCK_SIGNATURE",
  "protocolVersion": "ECv2",
  "signedMessage": "mock_signed_message"
};

async function testGooglePayFlow() {
  console.log('🧪 Testing Google Pay flow with PayFast...\n');

  // Step 1: Prepare PayFast payment data
  const transactionId = `test_${Date.now()}`;
  const amount = '100.00';

  const payfastData = {
    merchant_id: TEST_CONFIG.payfast.merchantId,
    merchant_key: TEST_CONFIG.payfast.merchantKey,
    return_url: 'https://98.86.231.129/payment-success',
    cancel_url: 'https://98.86.231.129/payment-failed',
    notify_url: 'https://98.86.231.129/api/payment-webhook',
    name_first: 'Test',
    name_last: 'User',
    email_address: 'test@example.com',
    m_payment_id: transactionId,
    amount: amount,
    item_name: 'Test Carbon Credits Purchase - Google Pay',
    item_description: `Test purchase via Google Pay - Transaction ${transactionId}`,
    payment_method: 'cc' // ✅ must be "cc" for card payments
  };

  console.log('📦 PayFast data prepared:', {
    merchant_id: payfastData.merchant_id,
    amount: payfastData.amount,
    item_name: payfastData.item_name,
    payment_method: payfastData.payment_method
  });

  // Step 2: Generate PayFast signature
  //let signatureString = Object.keys(payfastData)
    //.sort()
    //.map(key => `${key}=${encodeURIComponent(payfastData[key])}`)
    //.join('&');

  //const signature = crypto.createHash('md5').update(signatureString).digest('hex');
  //payfastData.signature = signature;

  //console.log('🔐 PayFast signature generated:', signature.substring(0, 8) + '...');

  // Step 3: Call PayFast Sandbox API
  const payfastUrl = 'https://sandbox.payfast.co.za/eng/process';
  console.log('🌐 Making PayFast API call to:', payfastUrl);

  try {
    const response = await fetch(payfastUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams(payfastData).toString()
    });

    console.log('📡 PayFast response status:', response.status);

    const responseText = await response.text();
    //console.log('📄 PayFast response body (first 500 chars):\n', responseText.substring(0, 500));

    // Step 4: Parse response (only works if PayFast returns key=value format, not HTML)
    try {
      const responseParams = new URLSearchParams(responseText);
      console.log('🔍 Parsed PayFast response:', Object.fromEntries(responseParams.entries()));
    } catch {
      console.log('⚠️ Response not in key=value format (likely HTML error page).');
    }

  } catch (error) {
    console.error('💥 API Error:', error.message);
  }
}

// Environment check
function checkEnvironment() {
  console.log('🔧 Environment check:');
  console.log('PAYFAST_MERCHANT_ID:', TEST_CONFIG.payfast.merchantId ? '✅ Set' : '❌ Missing');
  console.log('PAYFAST_MERCHANT_KEY:', TEST_CONFIG.payfast.merchantKey ? '✅ Set' : '❌ Missing');
  console.log('PAYFAST_PASSPHRASE:', TEST_CONFIG.payfast.passphrase ? '(set)' : '(empty)');
  console.log('GOOGLE_PAY_MERCHANT_ID:', TEST_CONFIG.googlePay.merchantId ? '✅ Set' : '❌ Missing');
  console.log('');
}

async function main() {
  console.log('🚀 Google Pay Integration Test\n');
  console.log('='.repeat(50));

  checkEnvironment();
  await testGooglePayFlow();

  //console.log('\n' + '='.repeat(50));
  console.log('🏁 Test completed');
}

main().catch(console.error);
