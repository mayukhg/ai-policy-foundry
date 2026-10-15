/**
 * Server-side Mixpanel client for AI Policy Foundry.
 * Reads MIXPANEL_TOKEN (or MIXPANEL_PROJECT_TOKEN) from env — never hardcode credentials.
 */
import Mixpanel from 'mixpanel';
import { v4 as uuidv4 } from 'uuid';
import { logger } from './logger.js';

const token =
  process.env.MIXPANEL_TOKEN ||
  process.env.MIXPANEL_PROJECT_TOKEN ||
  '';

let mp = null;

if (token) {
  mp = Mixpanel.init(token);
} else {
  logger.warn(
    '[mixpanel] No MIXPANEL_TOKEN / MIXPANEL_PROJECT_TOKEN set — server tracking disabled'
  );
}

/**
 * @param {string} distinctId
 * @param {string} event
 * @param {Record<string, unknown>} [props]
 */
export function track(distinctId, event, props = {}) {
  if (!mp) return;
  try {
    mp.track(distinctId, event, {
      platform: 'ai_policy_foundry',
      $insert_id: uuidv4(),
      timestamp: new Date().toISOString(),
      ...props,
    });
  } catch (err) {
    logger.warn(`[mixpanel] track failed for ${event}:`, err.message);
  }
}

/**
 * @param {string} distinctId
 * @param {Record<string, unknown>} traits
 */
export function setUser(distinctId, traits) {
  if (!mp) return;
  try {
    mp.people.set(distinctId, {
      platform: 'ai_policy_foundry',
      ...traits,
    });
  } catch (err) {
    logger.warn(`[mixpanel] people.set failed:`, err.message);
  }
}

export default { track, setUser };
