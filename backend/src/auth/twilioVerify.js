import twilio from 'twilio';

export function isTwilioConfigured() {
  return !!(
    process.env.TWILIO_ACCOUNT_SID &&
    process.env.TWILIO_AUTH_TOKEN &&
    process.env.TWILIO_VERIFY_SERVICE_SID
  );
}

function clientAndSid() {
  const accountSid = process.env.TWILIO_ACCOUNT_SID;
  const authToken = process.env.TWILIO_AUTH_TOKEN;
  const verifySid = process.env.TWILIO_VERIFY_SERVICE_SID;
  if (!accountSid || !authToken || !verifySid) {
    return null;
  }
  return { client: twilio(accountSid, authToken), verifySid };
}

export async function sendVerificationSms(toE164) {
  const t = clientAndSid();
  if (!t) {
    const err = new Error('TWILIO_NOT_CONFIGURED');
    err.code = 'TWILIO_NOT_CONFIGURED';
    throw err;
  }
  await t.client.verify.v2.services(t.verifySid).verifications.create({
    to: toE164,
    channel: 'sms',
  });
}

export async function verifyOtp(toE164, code) {
  const t = clientAndSid();
  if (!t) {
    const err = new Error('TWILIO_NOT_CONFIGURED');
    err.code = 'TWILIO_NOT_CONFIGURED';
    throw err;
  }
  const check = await t.client.verify.v2
    .services(t.verifySid)
    .verificationChecks.create({ to: toE164, code: String(code).trim() });
  return check.status === 'approved';
}
