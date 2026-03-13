import type { AddonContext, Account } from '@wealthfolio/addon-sdk';
import type { LunchmoneyAccount } from './lunchmoney';

export async function createWfAccountFromLm(
  ctx: AddonContext,
  lm: LunchmoneyAccount,
): Promise<Account> {
  return ctx.api.accounts.create({
    name: lm.display_name || lm.name,
    accountType: 'CASH',
    currency: lm.currency.toUpperCase(),
    isDefault: false,
    isActive: true,
    trackingMode: 'HOLDINGS',
    group: lm.institution_name || undefined,
  });
}
