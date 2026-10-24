import { BadGatewayException, Injectable } from '@nestjs/common';

const STEAM_OPENID_ENDPOINT = 'https://steamcommunity.com/openid/login';
const OPENID_NAMESPACE = 'http://specs.openid.net/auth/2.0';
const OPENID_IDENTIFIER_SELECT = `${OPENID_NAMESPACE}/identifier_select`;
const STEAM_CLAIMED_ID_PATTERN =
  /^https?:\/\/steamcommunity\.com\/openid\/id\/(\d{17})$/;

@Injectable()
export class SteamOpenIdClient {
  createAuthenticationUrl(callbackUrl: string, realm: string): string {
    const url = new URL(STEAM_OPENID_ENDPOINT);
    url.searchParams.set('openid.ns', OPENID_NAMESPACE);
    url.searchParams.set('openid.mode', 'checkid_setup');
    url.searchParams.set('openid.return_to', callbackUrl);
    url.searchParams.set('openid.realm', realm);
    url.searchParams.set('openid.identity', OPENID_IDENTIFIER_SELECT);
    url.searchParams.set('openid.claimed_id', OPENID_IDENTIFIER_SELECT);
    return url.toString();
  }

  async verifyAuthentication(query: Record<string, string>): Promise<string> {
    const verificationBody = new URLSearchParams();

    for (const [name, value] of Object.entries(query)) {
      if (name.startsWith('openid.')) {
        verificationBody.set(name, value);
      }
    }
    verificationBody.set('openid.mode', 'check_authentication');

    let response: Response;
    try {
      response = await fetch(STEAM_OPENID_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: verificationBody,
        signal: AbortSignal.timeout(5_000),
      });
    } catch {
      throw new BadGatewayException('Steam authentication is unavailable');
    }

    if (!response.ok || !(await response.text()).includes('is_valid:true')) {
      throw new BadGatewayException(
        'Steam authentication could not be verified',
      );
    }

    const claimedId = query['openid.claimed_id'];
    const match = claimedId?.match(STEAM_CLAIMED_ID_PATTERN);
    if (!match) {
      throw new BadGatewayException(
        'Steam returned an invalid account identifier',
      );
    }

    return match[1];
  }
}
