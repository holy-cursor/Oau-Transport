import React from 'react';
import Modal from '../../components/Modal.jsx';

export default function MailSentModal({ email, onClose }) {
  return <Modal title="Check your email" onClose={onClose}><div className="mail-success" role="status"><div className="success-mark" aria-hidden="true"><svg viewBox="0 0 80 80"><circle cx="40" cy="40" r="35"/><path d="M24 41l11 11 22-24"/></svg></div><h3>Your sign-in link is on its way.</h3><p>Open the link sent to<br/><strong>{email}</strong></p><small>Not there? Check Spam or Junk.</small><button className="primary full" onClick={onClose}>Got it</button></div></Modal>;
}
