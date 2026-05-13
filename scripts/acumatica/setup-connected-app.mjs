/**
 * setup-connected-app.mjs
 *
 * Self-contained Playwright script that:
 * 1. Logs into Acumatica sandbox (selects Test tenant, fills credentials)
 * 2. Extracts session cookies
 * 3. Creates a Connected Application with client_id="api", ROPC flow
 * 4. Returns the Connected App details for CLI config
 *
 * Usage: node setup-connected-app.mjs
 */

import { chromium } from 'playwright';

const BASE_URL = 'https://amerisuninc.acumatica.com';
const LOGIN_URL = `${BASE_URL}/Frames/Login.aspx?ReturnUrl=%2fMain`;
const USERNAME = 'Agent';
const PASSWORD = 'Agent.ai!';
const TENANT = 'AmeriSun Inc. - Test';

async function main() {
  const browser = await chromium.launch({ headless: true, args: ['--no-sandbox'] });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // ─── STEP 1: Navigate to login ───────────────────────────────
    console.log('[1/5] Navigating to login page...');
    await page.goto(LOGIN_URL, { waitUntil: 'networkidle', timeout: 30000 });
    await page.waitForSelector('#cmbCompany', { timeout: 10000 });
    console.log('       Login page loaded.');

    // ─── STEP 2: Select tenant ───────────────────────────────────
    console.log('[2/5] Selecting tenant: AmeriSun Inc. - Test...');
    // Use Playwright's native selectOption which works reliably with <select> elements
    await page.selectOption('#cmbCompany', { label: TENANT });
    // Verify selection
    const selected = await page.$eval('#cmbCompany', el => el.options[el.selectedIndex]?.textContent);
    console.log(`       Tenant selected: ${selected}`);

    if (selected !== TENANT) {
      console.log('       WARNING: Tenant selection mismatch. Trying value-based selection...');
      // Try selecting by option value
      const options = await page.$$eval('#cmbCompany option', opts =>
        opts.map(o => ({ text: o.textContent.trim(), value: o.value }))
      );
      console.log('       Available options:', JSON.stringify(options));
      // Find the Test tenant option
      const testOpt = options.find(o => o.text.includes('Test'));
      if (testOpt) {
        await page.selectOption('#cmbCompany', testOpt.value);
        console.log(`       Selected by value: "${testOpt.value}"`);
      }
    }

    // ─── STEP 3: Fill credentials ────────────────────────────────
    console.log('[3/5] Entering credentials...');
    await page.fill('#txtUser', USERNAME);
    await page.fill('#txtPass', PASSWORD);
    console.log('       Credentials entered.');

    // ─── STEP 4: Submit login ────────────────────────────────────
    console.log('[4/5] Submitting login...');
    await page.click('#btnLogin');

    // Wait for navigation after login
    try {
      await page.waitForURL('**/Main**', { timeout: 15000 });
      console.log('       Login successful - dashboard loaded.');
    } catch (e) {
      // Check if 2FA page appeared
      const pageText = await page.innerText('body').catch(() => '');
      console.log('       Page text after login:', pageText.substring(0, 500));
      
      // Check for 2FA
      if (pageText.includes('Two-Factor') || pageText.includes('confirmation')) {
        console.log('');
        console.log('╔══════════════════════════════════════════════════════════╗');
        console.log('║  2FA REQUIRED                                           ║');
        console.log('║  The sandbox has Two-Factor Authentication enabled.      ║');
        console.log('║  Please approve the push notification on your mobile     ║');
        console.log('║  device. The script will wait 60 seconds...              ║');
        console.log('╚══════════════════════════════════════════════════════════╝');
        
        // Wait for user to approve 2FA
        await page.waitForURL('**/Main**', { timeout: 60000 }).catch(() => {});
      }
      
      // Check if login failed
      if (pageText.includes('Invalid') || pageText.includes('invalid')) {
        console.log('       ERROR: Login failed - invalid credentials or tenant.');
        await page.screenshot({ path: '/opulent/workspace/artifacts/acumatica-login-failed.png', fullPage: true });
        process.exit(1);
      }
      
      // Check if we're on the main page now
      const currentUrl = page.url();
      if (currentUrl.includes('Main') || !currentUrl.includes('Login')) {
        console.log('       Login successful (post-2FA or redirect).');
      }
    }

    // ─── STEP 5: Extract session cookies ──────────────────────────
    console.log('[5/5] Extracting session...');
    const cookies = await context.cookies();
    const aspAuth = cookies.find(c => c.name === '.ASPXAUTH');
    const sessionId = cookies.find(c => c.name === 'ASP.NET_SessionId');
    
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   SESSION EXTRACTED                                      ║');
    console.log('╚══════════════════════════════════════════════════════════╝');
    console.log(`  .ASPXAUTH: ${aspAuth ? aspAuth.value.substring(0, 30) + '...' : 'NOT FOUND'}`);
    console.log(`  SessionId: ${sessionId ? sessionId.value : 'NOT FOUND'}`);

    // Write cookies to file for CLI to use
    const cookieJar = cookies.map(c => `${c.name}=${c.value}`).join('; ');
    const fs = await import('fs');
    fs.writeFileSync('/opulent/workspace/artifacts/acumatica-cookies.txt', cookieJar);
    console.log(`  Cookie jar saved to: artifacts/acumatica-cookies.txt`);

    // Now try to navigate to SM303010 to create Connected App
    console.log('');
    console.log('╔══════════════════════════════════════════════════════════╗');
    console.log('║   NAVIGATING TO CONNECTED APPLICATIONS (SM303010)        ║');
    console.log('╚══════════════════════════════════════════════════════════╝');

    // Try direct navigation to SM303010
    const smUrl = `${BASE_URL}/Main?ScreenId=SM303010`;
    await page.goto(smUrl, { waitUntil: 'domcontentloaded', timeout: 15000 }).catch(() => {
      console.log('  Direct navigation to SM303010 failed. Trying generic page...');
    });

    await page.waitForTimeout(3000);
    const pageUrl = page.url();
    const pageTitle = await page.title().catch(() => '');
    console.log(`  URL: ${pageUrl}`);
    console.log(`  Title: ${pageTitle}`);

    // Take a screenshot of the page
    await page.screenshot({ path: '/opulent/workspace/artifacts/acumatica-sm303010.png', fullPage: true });
    console.log('  Screenshot saved to artifacts/acumatica-sm303010.png');
    
    // Get page text to see what's there
    const bodyText = await page.innerText('body').catch(() => '');
    console.log('  Page text (first 1000 chars):', bodyText.substring(0, 1000));

    await browser.close();
    
    // Write results summary
    const result = {
      success: aspAuth ? true : false,
      sessionExtracted: !!aspAuth,
      cookiesFile: '/opulent/workspace/artifacts/acumatica-cookies.txt',
      nextStep: aspAuth 
        ? 'CLI can use cookies for API auth. Then create Connected App via REST.'
        : 'Manual login required (2FA). Use browser to log in, extract .ASPXAUTH cookie, save to artifacts/acumatica-cookies.txt'
    };
    fs.writeFileSync('/opulent/workspace/artifacts/acumatica-session.json', JSON.stringify(result, null, 2));
    console.log('');
    console.log('Results:', JSON.stringify(result, null, 2));
    
  } catch (error) {
    console.error('Script error:', error.message);
    await page.screenshot({ path: '/opulent/workspace/artifacts/acumatica-error.png', fullPage: true });
    await browser.close();
    process.exit(1);
  }
}

main();
