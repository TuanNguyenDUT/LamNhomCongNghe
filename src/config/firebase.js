/**
 * Cấu hình Firebase Admin SDK cho Push Notification (Task 6).
 * SDK được khởi tạo lazy để ứng dụng vẫn chạy khi môi trường local chưa có
 * Firebase credentials. Credential chỉ bắt buộc tại thời điểm gửi push thật.
 */

const {
  applicationDefault,
  cert,
  getApps,
  initializeApp,
} = require('firebase-admin/app');
const { getMessaging } = require('firebase-admin/messaging');

class FirebaseConfigurationError extends Error {
  constructor(message) {
    super(message);
    this.name = 'FirebaseConfigurationError';
    this.code = 'FCM_NOT_CONFIGURED';
    this.httpStatus = 503;
  }
}

function normalizePrivateKey(value = '') {
  return String(value).replace(/\\n/g, '\n').trim();
}

function hasExplicitServiceAccountEnv() {
  return Boolean(
    process.env.FCM_PROJECT_ID &&
    process.env.FCM_CLIENT_EMAIL &&
    process.env.FCM_PRIVATE_KEY
  );
}

function shouldUseApplicationDefault() {
  return Boolean(
    process.env.GOOGLE_APPLICATION_CREDENTIALS ||
    String(process.env.FCM_USE_APPLICATION_DEFAULT || '').toLowerCase() === 'true'
  );
}

function getFirebaseConfigurationStatus() {
  if (getApps().length > 0) {
    return { configured: true, credential_source: 'initialized' };
  }
  if (hasExplicitServiceAccountEnv()) {
    return { configured: true, credential_source: 'environment' };
  }
  if (shouldUseApplicationDefault()) {
    return { configured: true, credential_source: 'application_default' };
  }
  return { configured: false, credential_source: null };
}

function getFirebaseApp() {
  const existing = getApps()[0];
  if (existing) {
    return existing;
  }

  if (hasExplicitServiceAccountEnv()) {
    return initializeApp({
      credential: cert({
        projectId: process.env.FCM_PROJECT_ID,
        clientEmail: process.env.FCM_CLIENT_EMAIL,
        privateKey: normalizePrivateKey(process.env.FCM_PRIVATE_KEY),
      }),
      projectId: process.env.FCM_PROJECT_ID,
    });
  }

  if (shouldUseApplicationDefault()) {
    return initializeApp({
      credential: applicationDefault(),
      ...(process.env.FCM_PROJECT_ID ? { projectId: process.env.FCM_PROJECT_ID } : {}),
    });
  }

  throw new FirebaseConfigurationError(
    'Firebase chưa được cấu hình. Hãy đặt FCM_PROJECT_ID, FCM_CLIENT_EMAIL, ' +
    'FCM_PRIVATE_KEY hoặc GOOGLE_APPLICATION_CREDENTIALS.'
  );
}

function getFirebaseMessaging() {
  return getMessaging(getFirebaseApp());
}

module.exports = {
  FirebaseConfigurationError,
  getFirebaseApp,
  getFirebaseConfigurationStatus,
  getFirebaseMessaging,
  normalizePrivateKey,
};
