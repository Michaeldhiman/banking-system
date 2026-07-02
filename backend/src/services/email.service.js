const nodemailer = require('nodemailer');
const fs = require('fs');
const path = require('path');

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    type: 'OAuth2',
    user: process.env.EMAIL_USER,
    clientId: process.env.CLIENT_ID,
    clientSecret: process.env.CLIENT_SECRET,
    refreshToken: process.env.REFRESH_TOKEN,
  },
});

let emailServerConnected = false;

// Verify the connection configuration
transporter.verify((error, success) => {
  if (error) {
    console.warn('⚠️ Email server connection failed: OAuth2 credentials in .env are expired or invalid.');
    console.warn('⚠️ Email notifications will run in Mock Mode (logged to console).');
    emailServerConnected = false;
  } else {
    console.log('✅ Email server is ready to send messages');
    emailServerConnected = true;
  }
});

// Function to send email
const sendEmail = async (to, subject, text, html) => {
  if (!emailServerConnected) {
    console.log('✉️ [Mock Email] Send Success:');
    console.log(`   - To: ${to}`);
    console.log(`   - Subject: ${subject}`);
    console.log(`   - Summary: ${text.split('\n')[0]}`);
    return;
  }
  try {
    const info = await transporter.sendMail({
      from: `Banking ledger <${process.env.EMAIL_USER}>`, // sender address
      to, // list of receivers
      subject, // Subject line
      text, // plain text body
      html, // html body
    });

    console.log('Message sent: %s', info.messageId);
    console.log('Preview URL: %s', nodemailer.getTestMessageUrl(info));
  } catch (error) {
    console.error('Error sending email:', error);
  }
};

/**
 * @desc Helper function to load and populate HTML/TXT email templates
 */
const loadTemplate = (templateName, variables) => {
  try {
    const htmlPath = path.join(__dirname, '../templates', `${templateName}.html`);
    const txtPath = path.join(__dirname, '../templates', `${templateName}.txt`);
    
    let html = fs.readFileSync(htmlPath, 'utf8');
    let text = fs.readFileSync(txtPath, 'utf8');
    
    // Replace all placeholders formatted as {{variable}}
    for (const [key, value] of Object.entries(variables)) {
      const placeholder = new RegExp(`{{${key}}}`, 'g');
      html = html.replace(placeholder, String(value ?? ''));
      text = text.replace(placeholder, String(value ?? ''));
    }
    
    return { html, text };
  } catch (error) {
    console.error(`Error loading email template ${templateName}:`, error);
    // Safe fallback if files fail to load
    return {
      html: `<p>Notification details: ${JSON.stringify(variables)}</p>`,
      text: `Notification details: ${JSON.stringify(variables)}`
    };
  }
};

async function sendRegistrationEmail(userEmail, name) {
  const subject = "Welcome to Banking Ledger - Registration Successful";
  const { html, text } = loadTemplate('registration', { name });
  await sendEmail(userEmail, subject, text, html);
}

async function sendTransactionEmail(userEmail, name, transactionDetails) {
  const subject = "Transaction Completed Successfully";
  
  // Format variables for the template
  const variables = {
    name,
    amount: transactionDetails.amount,
    receiver: transactionDetails.receiver,
    transactionId: transactionDetails.transactionId,
    date: transactionDetails.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    time: transactionDetails.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    status: transactionDetails.status || "Success"
  };
  
  const { html, text } = loadTemplate('transaction-success', variables);
  await sendEmail(userEmail, subject, text, html);
}

async function sendTransactionEmailFailed(userEmail, name, transactionDetails) {
  const subject = "Transaction Failed - Action Required";
  
  // Format variables for the template
  const variables = {
    name,
    amount: transactionDetails.amount,
    receiver: transactionDetails.receiver,
    transactionId: transactionDetails.transactionId,
    date: transactionDetails.date || new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' }),
    time: transactionDetails.time || new Date().toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit' }),
    status: "Failed",
    failureReason: transactionDetails.failureReason || "Insufficient balance or transaction limit exceeded."
  };
  
  const { html, text } = loadTemplate('transaction-failed', variables);
  await sendEmail(userEmail, subject, text, html);
}

module.exports = {
  sendRegistrationEmail,
  sendTransactionEmail,
  sendTransactionEmailFailed
}