const DISPOSABLE_EMAIL_DOMAINS = new Set([
  'mailinator.com', 'guerrillamail.com', 'guerrillamail.net', 'guerrillamail.org', 'guerrillamail.biz',
  '10minutemail.com', '10minmail.com', 'tempmail.com', 'temp-mail.org', 'temp-mail.io', 'tempmailo.com',
  'yopmail.com', 'yopmail.fr', 'yopmail.net', 'throwawaymail.com', 'trashmail.com', 'sharklasers.com',
  'dispostable.com', 'getairmail.com', 'fakemailgenerator.com', 'mohmal.com', 'crazymailing.com',
  'mytemp.email', 'generator.email', 'maildrop.cc', 'inboxkitten.com', 'nada.ltd', 'getnada.com',
  'burnermail.io', 'discard.email', 'tempr.email', 'fake.com', 'fakeemail.com', 'fakemail.com',
  'spamgourmet.com', '0-mail.com', 'anonaddy.me', 'fakeinbox.com', 'emailondeck.com', 'throwaway.email',
  'burneremail.com', 'tmail.ws', 'minuteinbox.com', 'fastmail.fm', 'mytempemail.com', 'dropmail.me'
]);

const DUMMY_LOCAL_PARTS = new Set([
  'test', 'testing', 'tester', 'fake', 'fakeemail', 'fakemail', 'fakeuser', 'dummy', 'dummyemail',
  'asdf', 'asdfgh', 'asdfghjkl', 'qwerty', '1234', '12345', '123456', '0000', 'abc', 'xyz',
  'aaa', 'bbb', 'admin', 'user', 'nobody', 'sample', 'placeholder', 'temp', 'throwaway', 'burner'
]);

const FAKE_TLDS = new Set(['fake', 'dummy', 'invalid', 'local', 'localhost']);

export function validateEmailClient(email, language = 'en') {
  const normalized = String(email || '').trim().toLowerCase();
  if (!normalized) {
    return {
      valid: false,
      error: language === 'kn' ? 'ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ.' : language === 'hi' ? 'ईमेल पता दर्ज करें।' : 'Please enter your email address.'
    };
  }

  const atIndex = normalized.lastIndexOf('@');
  if (atIndex <= 0 || atIndex === normalized.length - 1) {
    return {
      valid: false,
      error: language === 'kn' ? 'ದಯವಿಟ್ಟು ಮಾನ್ಯವಾದ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಿ.' : language === 'hi' ? 'कृपया एक वैध ईमेल पता दर्ज करें।' : 'Please enter a valid email address.'
    };
  }

  const localPart = normalized.slice(0, atIndex);
  const domain = normalized.slice(atIndex + 1);
  const domainParts = domain.split('.');

  if (domainParts.length < 2) {
    return {
      valid: false,
      error: language === 'kn' ? 'ಮಾನ್ಯವಾದ ಇಮೇಲ್ ಡೊಮೇನ್ ನಮೂದಿಸಿ (ಉದಾ: name@gmail.com).' : language === 'hi' ? 'वैध ईमेल डोमेन दर्ज करें (उदा: name@gmail.com)।' : 'Please enter a valid email domain (e.g. name@gmail.com).'
    };
  }

  const tld = domainParts[domainParts.length - 1];
  if (!/^[a-zA-Z]{2,}$/.test(tld) || FAKE_TLDS.has(tld)) {
    return {
      valid: false,
      error: language === 'kn' ? 'ಅಮಾನ್ಯ ಇಮೇಲ್ ವಿಸ್ತರಣೆ (.com, .in ಇತ್ಯಾದಿ ಬಳಸಿ).' : language === 'hi' ? 'अमान्य ईमेल डोमेन (.com, .in आदि का उपयोग करें)।' : 'Invalid email extension. Please use a real domain like .com or .in.'
    };
  }

  // Disposable domain check
  if (DISPOSABLE_EMAIL_DOMAINS.has(domain)) {
    return {
      valid: false,
      error: language === 'kn' ? 'ತಾತ್ಕಾಲಿಕ / ಬರ್ನರ್ ಇಮೇಲ್ ಅನುಮತಿಸಲಾಗುವುದಿಲ್ಲ. ನಿಮ್ಮ ನಿಜವಾದ ಇಮೇಲ್ ಬಳಸಿ.' : language === 'hi' ? 'अस्थायी या डिस्पोजेबल ईमेल की अनुमति नहीं है। अपना असली ईमेल उपयोग करें।' : 'Temporary or disposable email services are not allowed. Please enter your real email.'
    };
  }

  // Fake pattern checks
  const domainBase = domainParts[0];
  if (DUMMY_LOCAL_PARTS.has(localPart) || /^(fake|dummy|test|asdf)[0-9]*$/i.test(localPart) || /^(.)\1{3,}$/.test(localPart)) {
    return {
      valid: false,
      error: language === 'kn' ? 'ನಕಲಿ ಅಥವಾ ಪರೀಕ್ಷಾರ್ಥ ಇಮೇಲ್ ಅನುಮತಿಸಲಾಗುವುದಿಲ್ಲ. ನಿಮ್ಮ ಸಕ್ರಿಯ ಇಮೇಲ್ ಬಳಸಿ.' : language === 'hi' ? 'नकली या परीक्षण ईमेल की अनुमति नहीं है। अपना सक्रिय ईमेल पता दर्ज करें।' : 'Test or fake emails are not allowed. Please enter your active, personal email.'
    };
  }

  if (localPart === domainBase && (DUMMY_LOCAL_PARTS.has(localPart) || localPart.length < 5)) {
    return {
      valid: false,
      error: language === 'kn' ? 'ನಕಲಿ ಇಮೇಲ್ ವಿಳಾಸವನ್ನು ನಮೂದಿಸಬೇಡಿ.' : language === 'hi' ? 'नकली ईमेल पता दर्ज न करें।' : 'Please do not enter a placeholder or dummy email.'
    };
  }

  return { valid: true, email: normalized };
}

export function validateSocialLoginClient(provider, email, language = 'en') {
  const emailCheck = validateEmailClient(email, language);
  if (!emailCheck.valid) return emailCheck;

  const normProvider = String(provider || '').trim().toLowerCase();
  const domain = emailCheck.email.split('@')[1];

  if (normProvider === 'google' && (domain === 'facebook.com' || domain === 'fb.com')) {
    return {
      valid: false,
      error: language === 'kn' ? 'Google ಲಾಗಿನ್ ಮಾಡಲು Gmail ಅಥವಾ Google ಖಾತೆ ಬಳಸಿ.' : language === 'hi' ? 'Google लॉगिन के लिए कृपया Gmail या Google खाता उपयोग करें।' : 'Please use a valid Google or Gmail account to sign in with Google.'
    };
  }

  if (normProvider === 'facebook' && (domain === 'facebook.com' || domain === 'fb.com')) {
    return {
      valid: false,
      error: language === 'kn' ? 'ನಿಷ್ಕ್ರಿಯಗೊಂಡ @facebook.com ಇಮೇಲ್ ಬದಲಿಗೆ ನಿಮ್ಮ Facebook ನ ನಿಜವಾದ ಇಮೇಲ್ ಬಳಸಿ.' : language === 'hi' ? 'अमान्य @facebook.com ईमेल के बजाय अपने Facebook खाते से जुड़ा असली ईमेल उपयोग करें।' : 'Retired @facebook.com emails cannot be used. Please use the real email linked to your Facebook account.'
    };
  }

  return { valid: true, email: emailCheck.email };
}
