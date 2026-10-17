import { spawn, type ChildProcess } from 'node:child_process'
import { existsSync, readFileSync, readdirSync, statSync } from 'node:fs'
import { homedir } from 'node:os'
import { isAbsolute, join, resolve } from 'node:path'
import { getSettings } from '../settings'

export interface ChromeProfile {
  directory: string
  displayName: string
}

let launchedChrome: ChildProcess | null = null

export function chromeUserDataDir(): string {
  if (process.platform === 'win32') {
    return join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Google', 'Chrome', 'User Data')
  }
  if (process.platform === 'darwin') return join(homedir(), 'Library', 'Application Support', 'Google', 'Chrome')
  return join(process.env.XDG_CONFIG_HOME ?? join(homedir(), '.config'), 'google-chrome')
}

export function findChrome(): string {
  const configured = getSettings().browser.chromePath.trim()
  if (configured) {
    const absolute = resolve(configured)
    if (!existsSync(absolute)) throw new Error(`Chrome was not found at the configured path: ${absolute}`)
    return absolute
  }

  const candidates: string[] = process.platform === 'win32'
    ? [
        join(process.env.PROGRAMFILES ?? 'C:/Program Files', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        join(process.env['PROGRAMFILES(X86)'] ?? 'C:/Program Files (x86)', 'Google', 'Chrome', 'Application', 'chrome.exe'),
        join(process.env.LOCALAPPDATA ?? join(homedir(), 'AppData', 'Local'), 'Google', 'Chrome', 'Application', 'chrome.exe')
      ]
    : process.platform === 'darwin'
      ? ['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', join(homedir(), 'Applications/Google Chrome.app/Contents/MacOS/Google Chrome')]
      : ['/usr/bin/google-chrome', '/usr/bin/google-chrome-stable', '/usr/bin/chromium', '/usr/bin/chromium-browser']

  const found = candidates.find((candidate) => existsSync(candidate))
  if (!found) throw new Error('Google Chrome was not found. Set its path in Browser settings.')
  return resolve(found)
}

function readJsonFile(path: string): unknown {
  try {
    return JSON.parse(readFileSync(path, 'utf8')) as unknown
  } catch {
    return null
  }
}

export function listChromeProfiles(userDataDir: string = chromeUserDataDir()): ChromeProfile[] {
  const root = resolve(userDataDir)
  const localState = readJsonFile(join(root, 'Local State'))
  const profiles: ChromeProfile[] = []
  const infoCache = localState && typeof localState === 'object' && 'profile' in localState
    ? (localState as { profile?: unknown }).profile
    : undefined
  const cached = infoCache && typeof infoCache === 'object' && 'info_cache' in infoCache
    ? (infoCache as { info_cache?: unknown }).info_cache
    : undefined
  const cache = cached && typeof cached === 'object' ? cached as Record<string, unknown> : {}

  for (const directory of Object.keys(cache)) {
    const fullPath = join(root, directory)
    if (!statIsDirectory(fullPath)) continue
    const entry = cache[directory]
    const displayName = entry && typeof entry === 'object' && 'name' in entry && typeof (entry as { name?: unknown }).name === 'string'
      ? (entry as { name: string }).name
      : directory
    profiles.push({ directory, displayName })
  }

  // Local State is not written until Chrome has created its first profile.
  if (profiles.length === 0 && existsSync(root)) {
    for (const directory of readdirSync(root)) {
      if (!/^Default$|^Profile \d+$/.test(directory) || !statIsDirectory(join(root, directory))) continue
      profiles.push({ directory, displayName: directory })
    }
  }
  return profiles.sort((a, b) => a.directory.localeCompare(b.directory, undefined, { numeric: true }))
}

function statIsDirectory(path: string): boolean {
  try { return statSync(path).isDirectory() } catch { return false }
}

export async function launchWithDebugging(chromePath: string, profileDir: string, port: number): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Chrome debug port must be between 1 and 65535.')
  if (!profileDir.trim()) throw new Error('Choose a Chrome profile before launching.')
  if (launchedChrome && launchedChrome.exitCode === null) throw new Error('Rellum already launched a Chrome debugging session.')

  const userDataDir = chromeUserDataDir()
  const executable = isAbsolute(chromePath) ? chromePath : resolve(chromePath)
  if (!existsSync(executable)) throw new Error(`Chrome was not found at ${executable}`)
  if (existsSync(join(userDataDir, 'SingletonLock'))) throw new Error(profileLockMessage('Chrome is already using this profile.'))

  const child = spawn(executable, [
    `--remote-debugging-port=${port}`,
    `--user-data-dir=${userDataDir}`,
    `--profile-directory=${profileDir}`
  ], { detached: false, stdio: ['ignore', 'ignore', 'pipe'], windowsHide: false })
  launchedChrome = child
  let errorText = ''
  child.stderr?.on('data', (chunk: Buffer) => { errorText += chunk.toString().slice(0, 300) })
  child.once('error', (error) => { if (launchedChrome === child) launchedChrome = null; errorText = error.message })

  await new Promise<void>((resolvePromise, reject) => {
    const timer = setTimeout(() => {
      if (child.exitCode !== null) {
        reject(new Error(profileLockMessage(errorText)))
      } else resolvePromise()
    }, 350)
    child.once('exit', (code) => {
      clearTimeout(timer)
      if (code === null || code === 0) resolvePromise()
      else reject(new Error(profileLockMessage(errorText)))
    })
    child.once('error', () => {
      clearTimeout(timer)
      reject(new Error(profileLockMessage(errorText)))
    })
  })
}

function profileLockMessage(detail: string): string {
  return `Chrome could not start with this profile. Your main Chrome may already be running; close it and try again, or use Attach instead.${detail ? ` (${detail})` : ''}`
}

export async function attach(port: number): Promise<void> {
  if (!Number.isInteger(port) || port < 1 || port > 65535) throw new Error('Chrome debug port must be between 1 and 65535.')
  try {
    const response = await fetch(`http://127.0.0.1:${port}/json/version`)
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
  } catch {
    throw new Error(`Could not attach to Chrome on port ${port}. Start Chrome with remote debugging or launch it from Rellum.`)
  }
}

export function isLaunched(): boolean {
  return launchedChrome !== null && launchedChrome.exitCode === null
}

export function killLaunched(): void {
  const child = launchedChrome
  launchedChrome = null
  if (!child || child.exitCode !== null || child.killed) return
  child.kill()
}
