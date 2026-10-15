import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { identifyUser, trackEvent } from '@/lib/mixpanel'

// Demo session: identify user on every load (no dedicated login UI yet)
const DEMO_USER = {
  id: localStorage.getItem('user_id') || 'demo-user-id',
  email: 'demo@example.com',
  name: 'Demo User',
  role: (localStorage.getItem('user_role') || 'policy_author') as string,
  department: 'compliance',
  createdAt: localStorage.getItem('user_created') || new Date().toISOString(),
};

if (!localStorage.getItem('user_id')) {
  localStorage.setItem('user_id', DEMO_USER.id);
}
if (!localStorage.getItem('user_created')) {
  localStorage.setItem('user_created', DEMO_USER.createdAt);
}

identifyUser(DEMO_USER.id, {
  $email: DEMO_USER.email,
  $name: DEMO_USER.name,
  role: DEMO_USER.role,
  department: DEMO_USER.department,
  $created: DEMO_USER.createdAt,
  platform: 'ai_policy_foundry',
});

trackEvent('user_logged_in', {
  method: localStorage.getItem('token') ? 'sso' : 'email',
  role: DEMO_USER.role,
});

createRoot(document.getElementById("root")!).render(<App />);
