/**
 * E2E test runner for FIPS Capacitor Plugin.
 *
 * Prerequisites:
 *   - Two Android emulators running (emulator-5554 and emulator-5556)
 *   - fips-e2e APK installed on both
 *   - adb in PATH
 *
 * The app outputs structured logcat messages with tag "FipsE2E":
 *   FipsE2E:STATUS:ready|starting|running|stopped
 *   FipsE2E:NPUB:<npub>
 *   FipsE2E:ADDRESS:<fips_address>
 *   FipsE2E:NODE_ADDR:<node_addr>
 *   FipsE2E:DATAGRAM_SENT:<json>
 *   FipsE2E:DATAGRAM_RECV:<json>
 *   FipsE2E:PEER_ADDED:<npub>
 *   FipsE2E:PEERS:<json>
 *   FipsE2E:ERROR:<message>
 *
 * Usage:
 *   node e2e/run-tests.mjs
 */

import { execSync } from "child_process";
import { setTimeout as sleep } from "timers/promises";

const ADB = "adb";
const DEVICE_A = "emulator-5554";
const DEVICE_B = "emulator-5556";
const LOGCAT_TAG = "FipsE2E";
const TIMEOUT = 60000;
const POLL_INTERVAL = 500;

function adb(device: string, cmd: string) {
  return execSync(`${ADB} -s ${device} ${cmd}`, { encoding: "utf-8", timeout: 15000 }).trim();
}

function clearLogcat(device: string) {
  adb(device, "logcat -c");
}

function getLogcat(device: string, since?: number): string {
  const sinceArg = since ? ` -t "${since}"` : " -d";
  return adb(device, `logcat${sinceArg} -s ${LOGCAT_TAG}:*`);
}

function parseLogcatEntries(raw: string): Map<string, string[]> {
  const entries = new Map<string, string[]>();
  const lines = raw.split("\n");
  for (const line of lines) {
    const idx = line.indexOf(`${LOGCAT_TAG}:`);
    if (idx === -1) continue;
    const content = line.substring(idx + LOGCAT_TAG.length + 1);
    const colonIdx = content.indexOf(":");
    if (colonIdx === -1) continue;
    const key = content.substring(0, colonIdx);
    const value = content.substring(colonIdx + 1);
    if (!entries.has(key)) entries.set(key, []);
    entries.get(key)!.push(value);
  }
  return entries;
}

async function waitForLog(
  device: string,
  key: string,
  expectedValue?: string,
  timeoutMs = TIMEOUT
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const raw = getLogcat(device);
    const entries = parseLogcatEntries(raw);
    const values = entries.get(key);
    if (values && values.length > 0) {
      const last = values[values.length - 1];
      if (!expectedValue || last.includes(expectedValue)) {
        return last;
      }
    }
    await sleep(POLL_INTERVAL);
  }
  throw new Error(`Timed out waiting for log key "${key}"${expectedValue ? ` containing "${expectedValue}"` : ""} on ${device}`);
}

async function waitForLogContaining(
  device: string,
  key: string,
  substring: string,
  timeoutMs = TIMEOUT
): Promise<string> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    const raw = getLogcat(device);
    const entries = parseLogcatEntries(raw);
    const values = entries.get(key);
    if (values) {
      for (const v of values) {
        if (v.includes(substring)) return v;
      }
    }
    await sleep(POLL_INTERVAL);
  }
  throw new Error(`Timed out waiting for log key "${key}" containing "${substring}" on ${device}`);
}

function launchApp(device: string) {
  adb(device, "shell am start -n com.formstr.fips.e2e/.MainActivity");
}

function stopApp(device: string) {
  adb(device, "shell am force-stop com.formstr.fips.e2e");
}

function logSection(title: string) {
  console.log(`\n${"=".repeat(60)}`);
  console.log(`  ${title}`);
  console.log(`${"=".repeat(60)}`);
}

function logStep(step: string) {
  console.log(`  → ${step}`);
}

function logResult(passed: boolean, message: string) {
  const icon = passed ? "✓" : "✗";
  console.log(`    ${icon} ${message}`);
}

async function runTests() {
  logSection("FIPS Capacitor Plugin — E2E Tests");
  logStep(`Device A: ${DEVICE_A}`);
  logStep(`Device B: ${DEVICE_B}`);

  let passed = 0;
  let failed = 0;

  // Ensure clean state
  stopApp(DEVICE_A);
  stopApp(DEVICE_B);
  await sleep(2000);

  // Test 1: Launch app on Device A and start node
  logSection("Test 1: Start node on Device A");
  try {
    clearLogcat(DEVICE_A);
    launchApp(DEVICE_A);
    await sleep(3000);

    await waitForLog(DEVICE_A, "STATUS", "ready", 15000);
    logResult(true, "App launched on Device A");

    // Trigger start via JavaScript console
    adb(DEVICE_A, `shell "echo 'startNode()' | adb shell input text"`);
    // Use am broadcast to trigger the function
    adb(DEVICE_A, `shell am broadcast -a com.formstr.fips.e2e.START_NODE`);

    await waitForLog(DEVICE_A, "STATUS", "running", 30000);
    logResult(true, "Device A node started");
    passed++;
  } catch (e: any) {
    logResult(false, `Device A start failed: ${e.message}`);
    failed++;
  }

  // Test 2: Launch app on Device B and start node
  logSection("Test 2: Start node on Device B");
  try {
    clearLogcat(DEVICE_B);
    launchApp(DEVICE_B);
    await sleep(3000);

    await waitForLog(DEVICE_B, "STATUS", "ready", 15000);
    logResult(true, "App launched on Device B");

    adb(DEVICE_B, `shell am broadcast -a com.formstr.fips.e2e.START_NODE`);

    await waitForLog(DEVICE_B, "STATUS", "running", 30000);
    logResult(true, "Device B node started");
    passed++;
  } catch (e: any) {
    logResult(false, `Device B start failed: ${e.message}`);
    failed++;
  }

  // Test 3: Get npub from Device A
  logSection("Test 3: Get npub from Device A");
  let npubA = "";
  try {
    npubA = await waitForLog(DEVICE_A, "NPUB", "npub1", 15000);
    logResult(true, `Device A npub: ${npubA}`);
    passed++;
  } catch (e: any) {
    logResult(false, `Get npub A failed: ${e.message}`);
    failed++;
  }

  // Test 4: Get npub from Device B
  logSection("Test 4: Get npub from Device B");
  let npubB = "";
  try {
    npubB = await waitForLog(DEVICE_B, "NPUB", "npub1", 15000);
    logResult(true, `Device B npub: ${npubB}`);
    passed++;
  } catch (e: any) {
    logResult(false, `Get npub B failed: ${e.message}`);
    failed++;
  }

  // Test 5: Device B adds Device A as peer
  logSection("Test 5: Device B adds Device A as peer");
  try {
    clearLogcat(DEVICE_B);
    adb(DEVICE_B, `shell am broadcast -a com.formstr.fips.e2e.ADD_PEER -e npub "${npubA}"`);
    await waitForLog(DEVICE_B, "PEER_ADDED", npubA, 15000);
    await sleep(3000);
    logResult(true, "Peer added on Device B");
    passed++;
  } catch (e: any) {
    logResult(false, `Add peer failed: ${e.message}`);
    failed++;
  }

  // Test 6: Device B sends datagram to Device A
  logSection("Test 6: Device B sends datagram to Device A");
  const testPayload = `E2E_TEST_${Date.now()}`;
  try {
    clearLogcat(DEVICE_A);
    clearLogcat(DEVICE_B);

    adb(DEVICE_B, `shell am broadcast -a com.formstr.fips.e2e.SEND_DATAGRAM -e npub "${npubA}" -e payload "${testPayload}"`);
    await waitForLog(DEVICE_B, "DATAGRAM_SENT", testPayload, 15000);
    logResult(true, `Datagram sent from Device B: ${testPayload}`);

    await sleep(3000);

    const recv = await waitForLogContaining(DEVICE_A, "DATAGRAM_RECV", testPayload, 20000);
    logResult(true, `Datagram received by Device A: ${recv}`);
    passed++;
  } catch (e: any) {
    logResult(false, `Datagram test failed: ${e.message}`);
    failed++;
  }

  // Test 7: Stop nodes
  logSection("Test 7: Stop nodes");
  try {
    adb(DEVICE_A, "shell am broadcast -a com.formstr.fips.e2e.STOP_NODE");
    adb(DEVICE_B, "shell am broadcast -a com.formstr.fips.e2e.STOP_NODE");
    await sleep(3000);

    await waitForLog(DEVICE_A, "STATUS", "stopped", 15000);
    await waitForLog(DEVICE_B, "STATUS", "stopped", 15000);
    logResult(true, "Both nodes stopped");
    passed++;
  } catch (e: any) {
    logResult(false, `Stop failed: ${e.message}`);
    failed++;
  }

  // Cleanup
  stopApp(DEVICE_A);
  stopApp(DEVICE_B);

  // Summary
  logSection("Results");
  const total = passed + failed;
  console.log(`  Passed: ${passed}/${total}`);
  console.log(`  Failed: ${failed}/${total}`);
  console.log(`${"=".repeat(60)}\n`);

  process.exit(failed > 0 ? 1 : 0);
}

runTests().catch((e) => {
  console.error("E2E test runner crashed:", e);
  process.exit(1);
});
