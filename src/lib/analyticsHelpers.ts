/** Map UI labels → Mixpanel policy_category enum */
export function mapPolicyCategory(
  policyType?: string
):
  | 'data_privacy'
  | 'model_governance'
  | 'access_control'
  | 'bias_fairness'
  | 'transparency'
  | 'security'
  | 'operational' {
  const t = (policyType || '').toLowerCase();
  if (t.includes('privacy')) return 'data_privacy';
  if (t.includes('access')) return 'access_control';
  if (t.includes('bias') || t.includes('fair')) return 'bias_fairness';
  if (t.includes('transpar')) return 'transparency';
  if (t.includes('retention') || t.includes('incident') || t.includes('operational'))
    return 'operational';
  if (t.includes('model') || t.includes('governance')) return 'model_governance';
  return 'security';
}

/** Map compliance UI labels → Mixpanel framework ids */
export function mapFramework(label?: string): string {
  const t = (label || '').toLowerCase();
  if (t.includes('gdpr')) return 'gdpr';
  if (t.includes('eu ai') || t.includes('eu_ai')) return 'eu_ai_act';
  if (t.includes('iso 42001') || t.includes('iso_42001')) return 'iso_42001';
  if (t.includes('hipaa')) return 'hipaa';
  if (t.includes('sox')) return 'sox';
  if (t.includes('nist')) return 'nist_ai_rmf';
  if (t.includes('iso')) return 'iso_42001';
  if (t.includes('cis') || t.includes('soc') || t.includes('pci')) return 'custom';
  return 'custom';
}

/** Map app page ids → foundry_dashboard_viewed.section */
export function mapDashboardSection(
  page: string
):
  | 'overview'
  | 'policies'
  | 'compliance'
  | 'frameworks'
  | 'assets'
  | 'exemptions'
  | 'audit'
  | 'settings' {
  switch (page) {
    case 'executive':
    case 'dashboard':
      return 'overview';
    case 'generator':
      return 'policies';
    case 'threat-intel':
      return 'audit';
    default:
      return 'overview';
  }
}
