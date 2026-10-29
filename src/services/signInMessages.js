export const registrationMessage = 'Your account has not been registered by the Admin. Contact your transport administrator to register your email.';

export function signInError(error, mode) {
  const message = error?.message || 'Could not send your sign-in link. Please try again.';
  if (mode !== 'student' && (/database error saving new user|not authorized|not registered|user not found|signups? (?:are )?not allowed|signups? (?:are )?disabled/i.test(message)
    || ['user_not_found', 'signup_disabled', 'email_not_authorized'].includes(error?.code))) return registrationMessage;
  if (/database error saving new user/i.test(message)) return 'Could not create your account. Check your student email or contact the transport administrator.';
  return message;
}
