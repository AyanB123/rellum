import { chromium, type Browser, type Page } from 'playwright-core'

export interface BrowserTab {
  index: number
  title: string
  url: string
}

export interface BrowserStatus {
  connected: boolean
  port: number | null
  launched: boolean
  tabs: BrowserTab[]
  url?: string
}

export interface BrowserActionResult {
  ok: boolean
  message?: string
  url?: string
  text?: string
}

export interface BrowserScreenshotResult {
  ok: boolean
  data?: string
  message?: string
}

let browser: Browser | null = null
let connectedPort: number | null = null
let activePage: Page | null = null

function friendlyError(error: unknown, action: string): string {
  const message = error instanceof Error ? error.message : String(error)
  return `Could not ${action}: ${message}`
}

function pageForAction(): Page {
  if (activePage && !activePage.isClosed()) return activePage
  const pages = browser?.contexts().flatMap((context) => context.pages()) ?? []
  const page = pages.find((candidate) => !candidate.isClosed())
  if (!page) throw new Error('No Chrome tab is available.')
  activePage = page
  return page
}

export async function connectOverCDP(port: number): Promise<void> {
  await disconnect()
  browser = await chromium.connectOverCDP(`http://127.0.0.1:${port}`)
  connectedPort = port
  activePage = browser.contexts().flatMap((context) => context.pages()).find((page) => !page.isClosed()) ?? null
}

export async function disconnect(): Promise<void> {
  const current = browser
  browser = null
  activePage = null
  connectedPort = null
  if (current) current.disconnect()
}

export async function close(): Promise<void> {
  await disconnect()
}

export function isConnected(): boolean {
  return browser !== null && browser.isConnected()
}

export async function navigate(url: string): Promise<BrowserActionResult> {
  try {
    const page = pageForAction()
    const response = await page.goto(url)
    activePage = page
    return { ok: true, url: page.url(), message: response ? `Navigated (${response.status()})` : 'Navigated' }
  } catch (error) { return { ok: false, message: friendlyError(error, 'navigate') } }
}

export async function clickText(page: Page, text: string): Promise<BrowserActionResult> {
  try {
    const value = text.trim()
    if (!value) return { ok: false, message: 'Enter text to click.' }
    const textLocator = page.getByText(value, { exact: true }).first()
    if (await textLocator.count() > 0) await textLocator.click()
    else {
      const button = page.getByRole('button', { name: value, exact: true }).first()
      if (await button.count() > 0) await button.click()
      else {
        const link = page.getByRole('link', { name: value, exact: true }).first()
        if (await link.count() === 0) return { ok: false, message: `Could not find “${value}”.` }
        await link.click()
      }
    }
    activePage = page
    return { ok: true, url: page.url(), message: `Clicked “${value}”.` }
  } catch (error) { return { ok: false, message: friendlyError(error, 'click') } }
}

export async function fillText(page: Page, selector: string, text: string): Promise<BrowserActionResult> {
  try {
    await page.locator(selector).fill(text)
    activePage = page
    return { ok: true, message: 'Filled field.' }
  } catch (error) { return { ok: false, message: friendlyError(error, 'fill field') } }
}

export async function extractText(page: Page): Promise<BrowserActionResult> {
  try {
    const text = await page.locator('body').innerText()
    activePage = page
    return { ok: true, text }
  } catch (error) { return { ok: false, message: friendlyError(error, 'extract page text') } }
}

export async function screenshotPage(page: Page): Promise<BrowserScreenshotResult> {
  try {
    const data = await page.screenshot({ type: 'png', encoding: 'base64' })
    activePage = page
    return { ok: true, data }
  } catch (error) { return { ok: false, message: friendlyError(error, 'capture screenshot') } }
}

export async function listTabs(): Promise<BrowserTab[]> {
  if (!browser) return []
  const pages = browser.contexts().flatMap((context) => context.pages())
  const tabs: BrowserTab[] = []
  for (const [index, page] of pages.entries()) {
    tabs.push({ index, title: await page.title().catch(() => ''), url: page.url() })
  }
  return tabs
}

export async function currentPage(): Promise<Page> { return pageForAction() }
export function currentPort(): number | null { return connectedPort }
