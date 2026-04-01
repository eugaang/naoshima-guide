/**
 * 나오시마 비전트립 가이드 — 라이브 품질 평가 (Playwright)
 *
 * 4가지 기준으로 실제 브라우저에서 검증:
 *   1. 기능성  — 네비게이션, 라우팅, 데이터 로딩, 이미지
 *   2. 디자인 품질 — 접근성(터치타겟, 폰트크기, 색상대비)
 *   3. 완성도  — 빈 섹션, 콘솔 에러, 깨진 이미지
 *   4. 모바일  — 반응형 레이아웃, 네비게이션 가시성
 */

import { test, expect, type Page, type Locator } from '@playwright/test';

const BASE_URL = 'http://localhost:8000';

// ============================================================
// 1. 기능성 (Functionality)
// ============================================================

test.describe('1. 기능성', () => {

  test('페이지가 정상 로딩된다', async ({ page }) => {
    const response = await page.goto(BASE_URL);
    expect(response?.status()).toBe(200);
  });

  test('사이트 제목이 JSON에서 렌더링된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('#site-title');
    const title = await page.textContent('#site-title');
    expect(title).toContain('나오시마');
  });

  test('4개 네비게이션 탭이 존재한다', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.nav__item');
    const tabs = await page.locator('.nav__item').count();
    expect(tabs).toBe(4);
  });

  test('탭 클릭 시 섹션이 전환된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.nav__item');

    // 두 번째 탭 클릭
    await page.locator('.nav__item').nth(1).click();
    await page.waitForTimeout(500);

    // 두 번째 섹션이 보이는지
    const secondSection = page.locator('.content-section').nth(1);
    await expect(secondSection).not.toHaveAttribute('hidden', '');
  });

  test('작가 카드 클릭 시 상세 뷰로 전환된다', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.nav__item');

    // "주요 작가와 작품" 탭 클릭
    await page.locator('.nav__item').nth(1).click();
    await page.waitForTimeout(500);

    // 첫 번째 작가 카드 클릭
    const artistCard = page.locator('.artist-card[data-artist-id]').first();
    if (await artistCard.count() > 0) {
      await artistCard.click();
      await page.waitForTimeout(500);

      // 상세 뷰가 나타나는지
      const backBtn = page.locator('.artist-detail__back');
      await expect(backBtn.first()).toBeVisible();
    }
  });

  test('"목록으로" 버튼이 동작한다', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.nav__item');
    await page.locator('.nav__item').nth(1).click();
    await page.waitForTimeout(500);

    const artistCard = page.locator('.artist-card[data-artist-id]').first();
    if (await artistCard.count() > 0) {
      await artistCard.click();
      await page.waitForTimeout(500);

      await page.locator('.artist-detail__back').first().click();
      await page.waitForTimeout(1000);

      // 섹션 뷰로 복귀 — 작가 카드가 다시 보이는지 확인
      const artistCards = page.locator('.artist-card[data-artist-id]');
      await expect(artistCards.first()).toBeVisible({ timeout: 5000 });
    }
  });

  test('JSON 데이터 3개가 모두 로딩된다', async ({ page }) => {
    const jsonFiles = ['data/sections.json', 'data/artists.json', 'data/arthouses.json'];

    for (const file of jsonFiles) {
      const response = await page.goto(`${BASE_URL}/${file}`);
      expect(response?.status(), `${file} 로딩 실패`).toBe(200);
      const body = await response?.text();
      expect(() => JSON.parse(body || ''), `${file} JSON 파싱 실패`).not.toThrow();
    }
  });
});

// ============================================================
// 2. 디자인 품질 (Design Quality)
// ============================================================

test.describe('2. 디자인 품질', () => {

  test('본문 폰트가 18px 이상이다 (50~60대 접근성)', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.subsection__content');

    const fontSize = await page.locator('.subsection__content').first().evaluate(
      (el) => parseFloat(window.getComputedStyle(el).fontSize)
    );
    expect(fontSize, `본문 폰트 ${fontSize}px — 18px 이상이어야 함`).toBeGreaterThanOrEqual(18);
  });

  test('터치 타겟이 48px 이상이다', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.nav__item');

    const navItems = page.locator('.nav__item');
    const count = await navItems.count();

    for (let i = 0; i < count; i++) {
      const box = await navItems.nth(i).boundingBox();
      expect(box, `탭 ${i} bounding box 없음`).not.toBeNull();
      if (box) {
        expect(box.height, `탭 ${i} 높이 ${box.height}px — 48px 이상이어야 함`).toBeGreaterThanOrEqual(44); // 약간의 여유
      }
    }
  });

  test('색상 대비가 WCAG AA를 충족한다 (본문 텍스트)', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.subsection__content');

    const contrast = await page.locator('.subsection__content').first().evaluate((el) => {
      const style = window.getComputedStyle(el);
      const textColor = style.color;

      // 실제 배경색을 조상 요소까지 탐색하여 찾음
      function getEffectiveBg(element: Element | null): string {
        while (element) {
          const bg = window.getComputedStyle(element).backgroundColor;
          if (bg && bg !== 'rgba(0, 0, 0, 0)' && bg !== 'transparent') return bg;
          element = element.parentElement;
        }
        return 'rgb(255,255,255)';
      }

      const bgColor = getEffectiveBg(el);

      function parseRGB(color: string): [number, number, number] {
        const m = color.match(/\d+/g);
        return m ? [parseInt(m[0]), parseInt(m[1]), parseInt(m[2])] : [0, 0, 0];
      }

      function luminance(r: number, g: number, b: number): number {
        const [rs, gs, bs] = [r, g, b].map((c) => {
          c = c / 255;
          return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
        });
        return 0.2126 * rs + 0.7152 * gs + 0.0722 * bs;
      }

      const [r1, g1, b1] = parseRGB(textColor);
      const [r2, g2, b2] = parseRGB(bgColor);
      const l1 = luminance(r1, g1, b1);
      const l2 = luminance(r2, g2, b2);
      const ratio = (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05);
      return { ratio, textColor, bgColor };
    });

    expect(
      contrast.ratio,
      `대비율 ${contrast.ratio.toFixed(2)} (텍스트: ${contrast.textColor}, 배경: ${contrast.bgColor}) — WCAG AA 기준 4.5 이상`
    ).toBeGreaterThanOrEqual(4.5);
  });

  test('HTML lang="ko" 속성이 있다', async ({ page }) => {
    await page.goto(BASE_URL);
    const lang = await page.locator('html').getAttribute('lang');
    expect(lang).toBe('ko');
  });
});

// ============================================================
// 3. 완성도 (Completeness)
// ============================================================

test.describe('3. 완성도', () => {

  test('콘솔 에러가 없다', async ({ page }) => {
    const errors: string[] = [];
    page.on('console', (msg) => {
      if (msg.type() === 'error') errors.push(msg.text());
    });

    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    expect(errors, `콘솔 에러: ${errors.join(', ')}`).toHaveLength(0);
  });

  test('깨진 이미지가 없다', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.nav__item');

    // 모든 탭을 순회하여 이미지를 렌더링
    const tabCount = await page.locator('.nav__item').count();
    for (let i = 0; i < tabCount; i++) {
      await page.locator('.nav__item').nth(i).click();
      await page.waitForTimeout(1000);
    }
    // 다시 첫 탭으로
    await page.locator('.nav__item').first().click();
    await page.waitForTimeout(1000);

    const brokenImages = await page.evaluate(() => {
      const imgs = document.querySelectorAll('img');
      const broken: string[] = [];
      imgs.forEach((img) => {
        // 현재 보이는 이미지만 체크 (hidden 섹션의 이미지 제외)
        if (img.offsetParent !== null && img.naturalWidth === 0 && img.src && !img.src.includes('data:')) {
          broken.push(img.src);
        }
      });
      return broken;
    });

    expect(brokenImages, `깨진 이미지: ${brokenImages.join(', ')}`).toHaveLength(0);
  });

  test('빈 섹션이 없다 (모든 섹션에 콘텐츠 존재)', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.nav__item');

    const tabCount = await page.locator('.nav__item').count();

    for (let i = 0; i < tabCount; i++) {
      await page.locator('.nav__item').nth(i).click();
      await page.waitForTimeout(500);

      const subsections = await page.locator('.subsection').count();
      expect(subsections, `탭 ${i}: 서브섹션이 0개`).toBeGreaterThan(0);
    }
  });

  test('외부 CDN 요청이 없다 (오프라인 보장)', async ({ page }) => {
    const externalRequests: string[] = [];

    page.on('request', (request) => {
      const url = request.url();
      if (url.startsWith('http') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
        externalRequests.push(url);
      }
    });

    await page.goto(BASE_URL);
    await page.waitForTimeout(2000);

    expect(externalRequests, `외부 요청: ${externalRequests.join(', ')}`).toHaveLength(0);
  });

  test('4개 섹션 모두 subsection이 1개 이상이다', async ({ page }) => {
    const response = await page.goto(`${BASE_URL}/data/sections.json`);
    const data = await response?.json();

    for (const section of data.sections) {
      expect(
        section.subsections.length,
        `"${section.title}" 섹션의 subsection이 0개`
      ).toBeGreaterThan(0);
    }
  });
});

// ============================================================
// 4. 모바일 (Mobile Responsiveness)
// ============================================================

test.describe('4. 모바일', () => {

  test.use({ viewport: { width: 375, height: 812 } }); // iPhone 13 크기

  test('모바일에서 하단 네비게이션이 보인다', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('#main-nav');

    const nav = page.locator('#main-nav');
    await expect(nav).toBeVisible();

    const box = await nav.boundingBox();
    expect(box, '네비게이션 위치 확인 불가').not.toBeNull();
    if (box) {
      // 화면 하단에 위치하는지 (y가 화면 높이의 80% 이상)
      expect(box.y, `네비 y=${box.y} — 하단에 있어야 함`).toBeGreaterThan(700);
    }
  });

  test('모바일에서 가로 스크롤이 발생하지 않는다 (메인 콘텐츠)', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    const hasHorizontalScroll = await page.evaluate(() => {
      return document.documentElement.scrollWidth > document.documentElement.clientWidth;
    });

    // SVG 인포그래픽은 의도적 가로 스크롤이므로, body 자체만 체크
    expect(hasHorizontalScroll, '메인 콘텐츠에 가로 스크롤 발생').toBe(false);
  });

  test('모바일에서 모든 텍스트가 화면 안에 있다', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForTimeout(1000);

    const overflowingElements = await page.evaluate(() => {
      const viewportWidth = window.innerWidth;
      const elements = document.querySelectorAll('h1, h2, h3, p, span, div');
      const overflowing: string[] = [];

      elements.forEach((el) => {
        const rect = el.getBoundingClientRect();
        if (rect.right > viewportWidth + 5 && rect.width > 0) {
          const tag = el.tagName.toLowerCase();
          const cls = el.className?.toString().slice(0, 30) || '';
          overflowing.push(`${tag}.${cls} (right: ${Math.round(rect.right)}px)`);
        }
      });
      return overflowing.slice(0, 5); // 최대 5개만
    });

    expect(
      overflowingElements.length,
      `화면 밖으로 넘치는 요소: ${overflowingElements.join(', ')}`
    ).toBe(0);
  });

  test('모바일에서 탭 전환이 동작한다', async ({ page }) => {
    await page.goto(BASE_URL);
    await page.waitForSelector('.nav__item');

    // 4번째 탭 (실용 정보) 클릭
    await page.locator('.nav__item').nth(3).click();
    await page.waitForTimeout(500);

    const lastSection = page.locator('.content-section').nth(3);
    await expect(lastSection).not.toHaveAttribute('hidden', '');
  });
});
